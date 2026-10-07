// fetch-groq-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from the Groq docs (console.groq.com/docs).
//
// Unlike React/Next.js/Node/MDN/LangChain/Qdrant, Groq does not publish its docs source on GitHub,
// so this script CRAWLS the public pages politely (robots.txt respected, ~1 request / 0.8 s) and converts HTML -> Markdown.
// Licence: no open licence is stated. Docs are Copyright Groq, Inc. Attribution + URL are kept in every file.
//          Use the output as your own private RAG index and check Groq's terms before redistributing it.
//
// Setup  : npm i cheerio turndown turndown-plugin-gfm        (Node 18+)
// Usage  : node fetch-groq-docs.mjs                    # crawl from /docs/overview
//          node fetch-groq-docs.mjs --print-urls       # only list the pages it would fetch
//          node fetch-groq-docs.mjs --limit 120        # max pages (default 250)
//          node fetch-groq-docs.mjs --keep-python      # keep Python code blocks (dropped by default: JS corpus)
//          node fetch-groq-docs.mjs --html-dir ./html  # offline: convert pages you saved yourself (<slug>.html)
//          node fetch-groq-docs.mjs --pdf              # also one PDF per bundle part (md-to-pdf + Chromium)
// Output : ./out/groq/pages/**.md   ./out/groq/bundles/*.md   ./out/groq/manifest.json   (+ ./out/groq/pdf with --pdf)
//
// NOTE: model lists, limits and prices on these pages change often. Re-run regularly and trust `indexed_at`.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let cheerio, TurndownService, gfm;
try {
  cheerio = await import("cheerio");
  TurndownService = (await import("turndown")).default;
  gfm = (await import("turndown-plugin-gfm")).default.gfm;
} catch {
  console.error("Missing dependencies. Run:  npm i cheerio turndown turndown-plugin-gfm");
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const ORIGIN = (opt("--origin") || "https://console.groq.com").replace(/\/$/, "");
const SEED = "/docs/overview";
const LIMIT = Number(opt("--limit") || 250);
const DELAY_MS = Number(opt("--delay") || 800);
const HTML_DIR = opt("--html-dir");
const OUT = path.resolve("out/groq");
const INDEXED_AT = new Date().toISOString().slice(0, 10);
const MAX_BUNDLE = 1_500_000;
const UA = "DevAtlas-ingest/1.0 (personal RAG index; contact: you)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. fetching ----------
const norm = (href, base = ORIGIN) => {
  try {
    const u = new URL(href, base + "/");
    if (u.origin !== ORIGIN) return null;
    if (!/^\/docs(\/|$)/.test(u.pathname)) return null;
    if (/\.(png|jpe?g|svg|gif|webp|pdf|zip|json|xml|txt)$/i.test(u.pathname)) return null;
    return u.pathname.replace(/\/$/, "") || "/docs";
  } catch { return null; }
};

async function robotsDisallows() {
  try {
    const res = await fetch(`${ORIGIN}/robots.txt`, { headers: { "user-agent": UA } });
    if (!res.ok) return [];
    const rules = []; let applies = false;
    for (const raw of (await res.text()).split("\n")) {
      const line = raw.split("#")[0].trim();
      const m = line.match(/^(user-agent|disallow):\s*(.*)$/i);
      if (!m) continue;
      if (m[1].toLowerCase() === "user-agent") applies = m[2].trim() === "*";
      else if (applies && m[2].trim()) rules.push(m[2].trim());
    }
    return rules;
  } catch { return []; }
}

async function getHtml(p, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(ORIGIN + p, { headers: { "user-agent": UA, accept: "text/html" } });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
      if (res.status === 429) await sleep(5000 * i);
    } catch { /* retry */ }
    await sleep(1500 * i);
  }
  return null;
}

const linksOf = (html) => {
  const $ = cheerio.load(html);
  return [...new Set($("a[href]").map((_, a) => norm($(a).attr("href"))).get().filter(Boolean))];
};

// ---------- 2. HTML -> Markdown ----------
const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
td.use(gfm);
const looksPython = (code) =>
  /^(from \w[\w.]* import |import (os|json|sys|groq|requests)\b|def \w+\(|client = |print\()/m.test(code) &&
  !/\b(const|let|await|=>|function)\b/.test(code);
td.addRule("fencedCode", {
  filter: (node) => node.nodeName === "PRE",
  replacement: (_, node) => {
    const codeEl = node.querySelector ? node.querySelector("code") : null;
    const code = (codeEl || node).textContent.replace(/\n$/, "");
    if (!flag("--keep-python") && looksPython(code)) return "";
    const cls = `${node.getAttribute("class") || ""} ${codeEl?.getAttribute("class") || ""} ${node.getAttribute("data-language") || ""}`;
    const lang = (cls.match(/(?:language|lang)-([\w+-]+)/)?.[1] || node.getAttribute("data-language") || "").toLowerCase();
    return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
  },
});

function htmlToDoc(html, pagePath) {
  const $ = cheerio.load(html);
  const title = ($("h1").first().text() || $("title").text()).replace(/\s*[-|]\s*GroqDocs.*$/i, "").trim() || pagePath.split("/").pop();
  let root = $("main").first();
  if (!root.length) root = $("[role=main]").first();
  if (!root.length) root = $("article").first();
  if (!root.length) root = $("body");
  root.find("nav, aside, header, footer, script, style, noscript, svg, form, button, [aria-hidden=true]").remove();
  // sidebar-like link lists that slipped inside <main>
  root.find("div, ul, section").filter((_, el) => $(el).find('a[href^="/docs"], a[href*="console.groq.com/docs"]').length >= 12 && $(el).find("p, pre").length === 0).remove();
  // feedback widgets
  root.find("*").filter((_, el) => /^(Was this page helpful\??|Suggest Edits)\s*(Yes\s*No)?$/i.test($(el).text().trim())).remove();

  let md = td.turndown(root.html() || "");
  md = md
    .replace(/^#\s+.*\n+/, "")                                           // page H1 (re-added from front matter)
    .replace(/\]\((\/[^)\s]*)\)/g, `](${ORIGIN}$1)`)                      // site-relative links
    .replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { title, md };
}

// ---------- 3. topics ----------
function topicsFor(slug, md) {
  const s = slug.toLowerCase();
  const count = (re) => (md.match(re) || []).length;
  const t = new Set();
  if (/^models|model-permissions|model-migration|deprecations|reasoning|vision|speech|text-to-speech|content-moderation|lora/.test(s)) t.add("models");
  if (/^(api-reference|openai|responses-api|text-chat|quickstart|overview|libraries|errors|batch)/.test(s)) t.add("api");
  if (/stream/.test(s) || count(/\bstream(ing)?\b/gi) >= 6) t.add("streaming");
  if (/^tool-use|mcp|connectors|local-tool-calling|built-in-tools/.test(s) || count(/tool[_ -]?(call|use|choice)/gi) >= 6) t.add("tool-calling");
  if (/structured-outputs/.test(s) || count(/json_schema|response_format|structured output/gi) >= 6) t.add("structured-output");
  if (/rate-limits|spend-limits|service-tiers|flex-processing|performance-tier|^errors|batch/.test(s) || count(/rate limit|\b429\b|tokens per (minute|day)/gi) >= 6) t.add("rate-limits");
  if (/latency|performance-tier|prompt-caching|flex-processing|service-tiers|production-ready/.test(s) || count(/latency|time to first token|\bTTFT\b/gi) >= 6) t.add("latency");
  if (/^models|model-migration|reasoning|^vision|^text-chat|prompting/.test(s) || count(/which model|model selection|choose (a|the) model/gi) >= 1) t.add("model-selection");
  if (t.size === 0) t.add("general");
  return [...t];
}

// ---------- 4. collect pages ----------
const pages = new Map(); // path -> html

if (HTML_DIR) {
  for (const f of fs.readdirSync(HTML_DIR).filter((f) => f.endsWith(".html"))) {
    const slugPath = "/docs/" + f.replace(/\.html$/, "").replace(/__/g, "/");
    pages.set(slugPath, fs.readFileSync(path.join(HTML_DIR, f), "utf8"));
  }
  console.log(`Loaded ${pages.size} saved pages from ${HTML_DIR}`);
} else {
  const disallowed = await robotsDisallows();
  const allowed = (p) => !disallowed.some((d) => p.startsWith(d));
  const queue = [SEED];
  const seen = new Set(queue);
  while (queue.length && pages.size < LIMIT) {
    const p = queue.shift();
    if (!allowed(p)) { console.log("robots.txt disallows", p); continue; }
    const html = await getHtml(p);
    await sleep(DELAY_MS);
    if (!html) { console.log("skip (not fetched):", p); continue; }
    pages.set(p, html);
    for (const l of linksOf(html)) if (!seen.has(l)) { seen.add(l); queue.push(l); }
    if (flag("--print-urls")) console.log(p);
  }
  if (flag("--print-urls")) { console.log(`\n${pages.size} pages discovered (limit ${LIMIT}).`); process.exit(0); }
}

// ---------- 5. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const manifest = [];
const bundles = {};
for (const [p, html] of pages) {
  const slug = p.replace(/^\/docs\/?/, "") || "index";
  const { title, md } = htmlToDoc(html, p);
  if (md.trim().length < 200) continue;
  const topics = topicsFor(slug, md);
  const url = ORIGIN + p;
  const front = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `url: ${url}`,
    `library: groq`,
    `section: ${slug.split("/")[0]}`,
    `topics: [${topics.join(", ")}]`,
    `source: console.groq.com/docs (crawled ${INDEXED_AT})`,
    `license: not specified - Copyright Groq, Inc.; private use, check Groq's terms before redistributing`,
    `indexed_at: ${INDEXED_AT}`,
    "---",
    "",
  ].join("\n");
  const outPath = path.join(OUT, "pages", slug + ".md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${front}# ${title}\n\n${md}`);
  manifest.push({ title, url, section: slug.split("/")[0], topics, file: `pages/${slug}.md`, chars: md.length });
  for (const tp of topics) (bundles[tp] ||= []).push({ title, url, text: md });
}

const ATTRIB = `> Content from the Groq documentation (https://console.groq.com/docs), Copyright Groq, Inc. Private-use corpus; see Groq's terms. Crawled ${INDEXED_AT}.\n`;
const bundleFiles = [];
for (const [topic, list] of Object.entries(bundles)) {
  let part = 1, buf = [], size = 0;
  const flush = () => {
    if (!buf.length) return;
    const name = `groq-${topic}-${String(part).padStart(2, "0")}.md`;
    fs.writeFileSync(path.join(OUT, "bundles", name), [`# Groq - ${topic} (part ${part})\n`, ATTRIB, ...buf].join("\n"));
    bundleFiles.push(name); part++; buf = []; size = 0;
  };
  for (const pg of list) {
    const chunk = `\n---\n\n## ${pg.title}\nSource: ${pg.url}\n\n${pg.text}`;
    if (size + chunk.length > MAX_BUNDLE && buf.length) flush();
    buf.push(chunk); size += chunk.length;
  }
  flush();
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ indexedAt: INDEXED_AT, pages: manifest }, null, 2));
console.log(`\nDone. Groq docs: ${manifest.length} pages, ${bundleFiles.length} bundle parts -> ${OUT}`);
for (const [tp, list] of Object.entries(bundles)) console.log(`  ${tp.padEnd(18)} ${list.length} pages`);

// ---------- 6. optional PDFs ----------
if (flag("--pdf")) {
  fs.mkdirSync(path.join(OUT, "pdf"), { recursive: true });
  for (const f of bundleFiles) {
    const dest = path.join(OUT, "pdf", f.replace(/\.md$/, ".pdf"));
    console.log("PDF:", path.basename(dest));
    execSync(`npx --yes md-to-pdf "${path.join(OUT, "bundles", f)}" --dest "${dest}"`, { stdio: "inherit" });
  }
}

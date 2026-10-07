// fetch-nextjs-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from the official Next.js App Router docs.
//
// Source : https://github.com/vercel/next.js  (docs/01-app = App Router docs)
// License: MIT, Copyright (c) Vercel, Inc. -> attribution is kept in every file.
//
// Usage  : node fetch-nextjs-docs.mjs                 # latest (canary) docs
//          node fetch-nextjs-docs.mjs --ref v16.0.0   # docs of a specific release tag
//          node fetch-nextjs-docs.mjs --pdf           # also make one PDF per topic (needs internet; uses md-to-pdf + Chromium)
// Needs  : Node 18+, git.
// Output : ./out/nextjs/pages/**.md      one file per page  (best for RAG ingestion)
//          ./out/nextjs/bundles/*.md     one file per topic (for manual upload / PDF)
//          ./out/nextjs/manifest.json
//          ./out/nextjs/pdf/*.pdf        only with --pdf

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const REF = opt("--ref");
const REPO = "https://github.com/vercel/next.js.git";
const CACHE = path.resolve(`.cache/next.js${REF ? "-" + REF : ""}`);
const OUT = path.resolve("out/nextjs");
const DOCS_DIR = "docs/01-app";
const INDEXED_AT = new Date().toISOString().slice(0, 10);

// ---------- 1. get the source ----------
if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  execSync(`git clone --depth 1 ${REF ? `--branch ${REF} ` : ""}--filter=blob:none --sparse ${REPO} "${CACHE}"`, { stdio: "inherit" });
}
execSync(`git -C "${CACHE}" sparse-checkout set ${DOCS_DIR}`, { stdio: "inherit" });
if (!REF) execSync(`git -C "${CACHE}" pull --ff-only`, { stdio: "inherit" });
const commit = execSync(`git -C "${CACHE}" rev-parse --short HEAD`).toString().trim();
let version = REF || "canary";
try { version = REF || JSON.parse(fs.readFileSync(path.join(CACHE, "lerna.json"), "utf8")).version; } catch {}

// ---------- 2. helpers ----------
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [path.join(dir, e.name)] : []
  );

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/); // top-level keys only
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { meta, body: raw.slice(m[0].length) };
}

function toSegments(body) {
  const segs = [];
  let cur = null;
  for (const line of body.split("\n")) {
    const f = line.match(/^\s*```(.*)$/);
    if (f) {
      if (!cur) cur = { type: "fence", info: f[1].trim(), lines: [] };
      else { segs.push(cur); cur = null; }
      continue;
    }
    if (cur) cur.lines.push(line);
    else segs.push({ type: "line", text: line });
  }
  if (cur) segs.push(cur);
  return segs;
}

// MDX -> plain markdown. Keeps App Router content, drops Pages-Router-only blocks,
// keeps the JavaScript variant of TS/JS "switcher" code pairs, and drops yarn/pnpm/bun duplicates.
function cleanMdx(body) {
  const segs = toSegments(body.replace(/\{\/\*[\s\S]*?\*\/\}/g, ""));
  const out = [];
  let skipPages = false;
  let inTag = false;

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];

    if (s.type === "fence") {
      if (skipPages) continue;
      const lang = (s.info.split(/\s+/)[0] || "").toLowerCase();
      const meta = s.info.slice(lang.length);
      const pkg = meta.match(/package="?(\w+)"?/)?.[1];
      if (pkg && pkg !== "npm") continue;
      if (/\bswitcher\b/.test(meta) && (lang === "ts" || lang === "tsx")) {
        let j = i + 1;
        while (j < segs.length && segs[j].type === "line" && !segs[j].text.trim()) j++;
        const n = segs[j];
        if (n && n.type === "fence" && /\bswitcher\b/.test(n.info) && /^(js|jsx)\b/.test(n.info)) continue; // JS twin follows
      }
      const file = meta.match(/filename="([^"]+)"/)?.[1] || meta.match(/filename=(\S+)/)?.[1];
      if (file && !/^terminal$/i.test(file)) out.push(`**File:** \`${file}\`\n`);
      out.push("```" + lang, ...s.lines, "```");
      continue;
    }

    let line = s.text;
    if (skipPages) { if (/<\/PagesOnly>/.test(line)) skipPages = false; continue; }
    line = line.replace(/<PagesOnly>[\s\S]*?<\/PagesOnly>/g, "");
    if (/^\s*<PagesOnly[^>]*>\s*$/.test(line)) { skipPages = true; continue; }

    if (inTag) { if (/>\s*$/.test(line)) inTag = false; continue; } // multi-line <Image ... /> props
    if (/^\s*<[A-Z][A-Za-z]*\b[^>]*$/.test(line)) { inTag = true; continue; }
    if (/^\s*<[A-Z][A-Za-z]*\b[^>]*\/>\s*$/.test(line)) continue;   // self-closing component
    if (/^\s*<\/?[A-Z][A-Za-z]*\b[^>]*>\s*$/.test(line)) continue;  // lone open/close tag (AppOnly, Tabs...)

    line = line.replace(/<\/?[A-Z][A-Za-z]*\b[^>]*>/g, "");        // inline component tags, keep inner text
    line = line.replace(/\]\((\/[^)\s]+)\)/g, "](https://nextjs.org$1)"); // relative -> absolute links
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- 3. topic tagging (a page can belong to several topics) ----------
function topicsFor(slug) {
  const s = slug.toLowerCase();
  const t = new Set();
  if (/^getting-started\/|^index$|^glossary$|rendering-philosophy|project-structure/.test(s)) t.add("app-router");
  if (/layouts-and-pages|linking-and-navigating|dynamic-routes|route-groups|parallel-routes|intercepting-routes|redirecting|project-structure|file-conventions\/(layout|page|loading|error|not-found|template|default|src-folder|public-folder)|components\/link|use-router|use-pathname|use-params|use-search-params|use-selected-layout|functions\/navigation|functions\/redirect|functions\/permanentredirect|functions\/not-found|prefetch|single-page-applications|internationalization|multi-tenant|multi-zones/.test(s)) t.add("routing");
  if (/server-and-client|use-client|use-server|server-and-client-boundary|rendering-philosophy|directives\//.test(s)) t.add("server-components");
  if (/fetching-data|mutating-data|server-actions|functions\/fetch|client-side-data-fetching|forms|streaming|components\/form|backend-for-frontend|functions\/(after|connection)/.test(s)) t.add("data-fetching");
  if (/caching|revalidat|use-cache|cachelife|cachetag|unstable_cache|unstable_nostore|incremental-static|updatetag|functions\/refresh|cdn|static-exports|public-static-pages|preserving-ui-state|how-revalidation/.test(s)) t.add("caching");
  if (/authentication|functions\/(forbidden|unauthorized|cookies|headers)|file-conventions\/(forbidden|unauthorized)|data-security/.test(s)) t.add("authentication");
  if (/(^|\/)(proxy|middleware)$|next-request|next-response|useragent|functions\/(cookies|headers)/.test(s)) t.add("middleware");
  if (/route-handlers|file-conventions\/route$|backend-for-frontend|next-request|next-response|api-routes/.test(s)) t.add("api-routes");
  if (/deploying|self-hosting|static-exports|custom-server|ppr-platform|production-checklist|adapters|ci-build|environment-variables|api-reference\/cli|multi-zones|progressive-web|offline/.test(s)) t.add("deployment");
  if (/production-checklist|lazy-loading|memory-usage|prefetch|package-bundling|scripts|getting-started\/(images|fonts)|components\/(image|font|script)|streaming|third-party|instant-navigation|turbopack|open-telemetry|analytics|web-vitals|videos|instrumentation|bundle|partial-prefetching|view-transitions/.test(s)) t.add("performance");
  if (/authentication|data-security|content-security-policy|environment-variables|forbidden|unauthorized|production-checklist|server-actions|draft-mode|csp/.test(s)) t.add("security");
  if (t.size === 0) t.add("general");
  return [...t];
}

// ---------- 4. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const stripNum = (seg) => seg.replace(/^\d+-/, "");
const root = path.join(CACHE, DOCS_DIR);
const manifest = [];
const bundles = {};

for (const file of walk(root)) {
  const parts = path.relative(root, file).replace(/\.mdx?$/, "").split(path.sep).map(stripNum);
  if (parts.at(-1) === "index") parts.pop();
  const slug = parts.join("/") || "index";
  const url = "https://nextjs.org/docs/app" + (parts.length ? "/" + parts.join("/") : "");
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const title = meta.title || parts.at(-1) || "App Router";
  const text = cleanMdx(body);
  if (text.trim().length < 120) continue; // empty index / pure-link stubs

  const topics = topicsFor(slug);
  const section = parts[0] || "root";
  const front = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    meta.description ? `description: "${meta.description.replace(/"/g, '\\"')}"` : null,
    `url: ${url}`,
    `library: nextjs`,
    `router: app`,
    `version: ${version}`,
    `section: ${section}`,
    `topics: [${topics.join(", ")}]`,
    `source: nextjs.org/docs (vercel/next.js ${commit})`,
    `license: MIT - Copyright (c) Vercel, Inc.`,
    `indexed_at: ${INDEXED_AT}`,
    "---",
    "",
  ].filter((x) => x !== null).join("\n");

  const outPath = path.join(OUT, "pages", slug + ".md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${front}# ${title}\n\n${text}`);
  manifest.push({ title, url, section, topics, version, file: path.join("pages", slug + ".md"), chars: text.length });
  for (const tp of topics) (bundles[tp] ||= []).push({ title, url, text });
}

const ATTRIB = `> Content from the official Next.js documentation (https://nextjs.org/docs), MIT License, Copyright (c) Vercel, Inc. Version ${version}, indexed ${INDEXED_AT} from commit ${commit}.\n`;
for (const [topic, pages] of Object.entries(bundles)) {
  const md = [`# Next.js App Router - ${topic}\n`, ATTRIB, ...pages.map((p) => `\n---\n\n## ${p.title}\nSource: ${p.url}\n\n${p.text}`)].join("\n");
  fs.writeFileSync(path.join(OUT, "bundles", `nextjs-${topic}.md`), md);
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ version, commit, indexedAt: INDEXED_AT, pages: manifest }, null, 2));

console.log(`\nDone. Next.js ${version}: ${manifest.length} pages, ${Object.keys(bundles).length} topic bundles -> ${OUT}`);
for (const [tp, pages] of Object.entries(bundles)) console.log(`  ${tp.padEnd(18)} ${pages.length} pages`);

// ---------- 5. optional PDFs ----------
if (flag("--pdf")) {
  fs.mkdirSync(path.join(OUT, "pdf"), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, "bundles"))) {
    const src = path.join(OUT, "bundles", f);
    const dest = path.join(OUT, "pdf", f.replace(/\.md$/, ".pdf"));
    console.log("PDF:", path.basename(dest));
    execSync(`npx --yes md-to-pdf "${src}" --dest "${dest}"`, { stdio: "inherit" });
  }
}

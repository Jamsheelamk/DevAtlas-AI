// fetch-node-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from the official Node.js API docs.
//
// Source : https://github.com/nodejs/node  (doc/api/*.md - the same files nodejs.org renders)
// License: MIT (see LICENSE in that repo), Copyright Node.js contributors -> attribution kept in every file.
//
// Usage  : node fetch-node-docs.mjs                  # docs of the newest stable release tag (what /docs/latest shows)
//          node fetch-node-docs.mjs --ref v22.12.0   # docs of a specific release (e.g. an LTS you run in production)
//          node fetch-node-docs.mjs --keep-cjs       # keep CommonJS twins of ESM examples (dropped by default)
//          node fetch-node-docs.mjs --pdf            # also make one PDF per topic (md-to-pdf + Chromium, downloads on first run)
// Needs  : Node 18+, git.
// Output : ./out/node/pages/<module>.md    one file per module (http.md, fs.md, ...)  -> ingest these
//          ./out/node/bundles/*.md         one file per topic (HTTP, FS, Streams, ...)
//          ./out/node/manifest.json
//          ./out/node/pdf/*.pdf            only with --pdf

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const REPO = "https://github.com/nodejs/node.git";
const OUT = path.resolve("out/node");
const INDEXED_AT = new Date().toISOString().slice(0, 10);
const SKIP = new Set(["index", "documentation"]);

// ---------- 1. pick a release tag and fetch just doc/api ----------
function latestStableTag() {
  const raw = execSync(`git ls-remote --tags --refs ${REPO} "v*.*.*"`, { maxBuffer: 64 * 1024 * 1024 }).toString();
  const tags = raw.split("\n").map((l) => l.split("refs/tags/")[1]).filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
  const num = (t) => t.slice(1).split(".").map(Number);
  tags.sort((a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  return tags.at(-1);
}
const REF = opt("--ref") || latestStableTag();
const CACHE = path.resolve(`.cache/node-${REF}`);
if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  execSync(`git clone --depth 1 --branch ${REF} --filter=blob:none --sparse ${REPO} "${CACHE}"`, { stdio: "inherit" });
}
execSync(`git -C "${CACHE}" sparse-checkout set doc/api`, { stdio: "inherit" });
const commit = execSync(`git -C "${CACHE}" rev-parse --short HEAD`).toString().trim();
const BASE = `https://nodejs.org/docs/${REF}/api/`;

// ---------- 2. cleaning ----------
// Split markdown into prose chunks (even index) and fenced code chunks (odd index).
const splitFences = (md) => md.split(/(^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[^\n]*$)/m);

// <!-- YAML added: v1 ... deprecated: ... --> blocks -> one readable italic line
function yamlVersions(block) {
  const grab = (key) => {
    const m = block.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
    if (!m) return null;
    if (m[1].trim()) return m[1].trim().replace(/^\[|\]$/g, "");
    const after = block.slice(m.index + m[0].length).split("\n").slice(1);
    const items = [];
    for (const l of after) { const li = l.match(/^\s+-\s+(v[\w.x-]+)\s*$/); if (li) items.push(li[1]); else break; }
    return items.join(", ") || null;
  };
  const parts = [];
  const added = grab("added"), dep = grab("deprecated"), rem = grab("removed");
  if (added) parts.push(`Added in: ${added}`);
  if (dep) parts.push(`Deprecated since: ${dep}`);
  if (rem) parts.push(`Removed in: ${rem}`);
  return parts.length ? `\n_${parts.join(" | ")}_\n` : "";
}

function resolveUrl(u, pageUrl) {
  if (/^(https?:|mailto:)/.test(u)) return u;
  if (u.startsWith("#")) return pageUrl + u;
  const m = u.match(/^([\w./-]+?)\.md(#.*)?$/);
  if (m) return BASE + m[1].replace(/^\.\//, "") + ".html" + (m[2] || "");
  return u;
}

function cleanDoc(raw, pageUrl) {
  const parts = splitFences(raw);

  // collect reference-link definitions  [`fs.readFile()`]: #fsreadfilepath-options-callback
  const defs = new Map();
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(/^\[([^\]]+)\]:\s*(\S+)\s*$/gm, (_, k, u) => { defs.set(k.toLowerCase(), resolveUrl(u, pageUrl)); return ""; });
  }

  for (let i = 0; i < parts.length; i += 2) {
    let p = parts[i];
    p = p.replace(/<!--\s*YAML\n([\s\S]*?)-->/g, (_, y) => yamlVersions(y));
    p = p.replace(/<!--[\s\S]*?-->/g, "");               // introduced_in, type, source_link, ...
    p = p.replace(/<a id="[^"]*"><\/a>/g, "");
    // reference-style links -> inline links
    p = p.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (whole, text, ref) => {
      const url = defs.get((ref || text).toLowerCase());
      return url ? `[${text}](${url})` : whole;
    });
    // inline relative links
    p = p.replace(/\]\(([^)\s]+)\)/g, (_, u) => `](${resolveUrl(u, pageUrl)})`);
    parts[i] = p;
  }
  const md = parts.join("");

  // normalize code fences; drop CommonJS twin of an ESM example unless --keep-cjs
  const lines = md.split("\n");
  const out = [];
  let inFence = false, skip = false, prevFenceLang = null, blankSincePrevFence = true;
  for (const line of lines) {
    const f = line.match(/^(\s*)```(\S*)(.*)$/);
    if (f) {
      if (!inFence) {
        inFence = true;
        let lang = f[2].toLowerCase();
        skip = lang === "cjs" && prevFenceLang === "mjs" && !flag("--keep-cjs");
        prevFenceLang = lang;
        if (skip) { while (out.length && out.at(-1).trim() === "") out.pop(); continue; }
        if (lang === "mjs" || lang === "cjs") lang = "js";
        out.push("```" + lang);
      } else {
        inFence = false;
        if (skip) { skip = false; continue; }
        out.push("```");
      }
      continue;
    }
    if (inFence) { if (!skip) out.push(line); continue; }
    if (line.trim() !== "") prevFenceLang = null;       // prose between fences breaks the mjs/cjs pairing
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- 3. topic tagging by module (a module can belong to several topics) ----------
const TOPICS = {
  http:        ["http", "https", "http2", "net", "dgram", "dns", "tls", "url", "querystring", "quic", "dtls"],
  fs:          ["fs", "path", "os", "vfs", "tty"],
  streams:     ["stream", "stream_iter", "webstreams", "readline", "zlib", "buffer", "string_decoder"],
  events:      ["events", "diagnostics_channel", "domain"],
  async:       ["timers", "async_hooks", "async_context", "util", "events", "process", "stream"],
  crypto:      ["crypto", "webcrypto", "tls", "permissions"],
  process:     ["process", "child_process", "cluster", "os", "cli", "environment_variables", "repl", "globals", "single-executable-applications"],
  workers:     ["worker_threads", "cluster", "child_process"],
  performance: ["perf_hooks", "v8", "tracing", "inspector", "report", "diagnostics_channel", "async_hooks", "bench", "debugger"],
};
const topicsFor = (stem) => {
  const t = Object.entries(TOPICS).filter(([, mods]) => mods.includes(stem)).map(([k]) => k);
  return t.length ? t : ["general"];
};

// ---------- 4. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const manifest = [];
const bundles = {};
const dir = path.join(CACHE, "doc/api");

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
  const stem = file.replace(/\.md$/, "");
  if (SKIP.has(stem)) continue;
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  const title = (raw.match(/^#\s+(.+)$/m)?.[1] || stem).replace(/<!--.*?-->/g, "").replace(/`/g, "").trim();
  const pageUrl = `${BASE}${stem}.html`;
  const text = cleanDoc(raw.replace(/^#\s+.+\n/m, ""), pageUrl);   // drop the H1, we re-add it below
  const topics = topicsFor(stem);

  const front = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `url: ${pageUrl}`,
    `library: nodejs`,
    `module: ${stem}`,
    `version: ${REF}`,
    `topics: [${topics.join(", ")}]`,
    `source: nodejs.org/api (nodejs/node ${commit})`,
    `license: MIT - Copyright Node.js contributors`,
    `indexed_at: ${INDEXED_AT}`,
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "pages", `${stem}.md`), `${front}# ${title}\n\n${text}`);
  manifest.push({ title, module: stem, url: pageUrl, topics, version: REF, file: `pages/${stem}.md`, chars: text.length });
  for (const tp of topics) (bundles[tp] ||= []).push({ title, url: pageUrl, text });
}

const ATTRIB = `> Content from the official Node.js API documentation (https://nodejs.org/docs/${REF}/api/), MIT License, Copyright Node.js contributors. Node.js ${REF}, indexed ${INDEXED_AT} from commit ${commit}.\n`;
for (const [topic, pages] of Object.entries(bundles)) {
  const md = [`# Node.js - ${topic}\n`, ATTRIB, ...pages.map((p) => `\n---\n\n## ${p.title}\nSource: ${p.url}\n\n${p.text}`)].join("\n");
  fs.writeFileSync(path.join(OUT, "bundles", `node-${topic}.md`), md);
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ version: REF, commit, indexedAt: INDEXED_AT, pages: manifest }, null, 2));

console.log(`\nDone. Node.js ${REF}: ${manifest.length} modules, ${Object.keys(bundles).length} topic bundles -> ${OUT}`);
for (const [tp, pages] of Object.entries(bundles)) console.log(`  ${tp.padEnd(12)} ${pages.map((p) => p.url.split("/").pop().replace(".html", "")).join(", ")}`);

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

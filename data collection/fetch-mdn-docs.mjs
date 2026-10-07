// fetch-mdn-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from MDN Web Docs (en-US).
//
// Source : https://github.com/mdn/content  (files/en-us/web/...  - the same files developer.mozilla.org renders)
// License: MDN prose is CC BY-SA 2.5, code examples are CC0 (see LICENSE.md in that repo).
//          Attribution is kept in every file. Read the ShareAlike note in the chat before redistributing the corpus.
//
// Usage  : node fetch-mdn-docs.mjs                 # "core" scope: JavaScript, HTML, CSS, HTTP, Accessibility + the Web APIs you listed
//          node fetch-mdn-docs.mjs --scope full    # every Web API too (8,000+ extra pages - much bigger index)
//          node fetch-mdn-docs.mjs --pdf           # also one PDF per bundle part (md-to-pdf + Chromium; slow for big topics)
// Needs  : Node 18+, git.
// Output : ./out/mdn/pages/<slug>.md       one file per MDN page  -> ingest these
//          ./out/mdn/bundles/*.md          topic bundles, split into ~1.5 MB parts (for manual upload / PDF)
//          ./out/mdn/manifest.json
//          ./out/mdn/pdf/*.pdf             only with --pdf

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const SCOPE = opt("--scope") || "core";
const REPO = "https://github.com/mdn/content.git";
const CACHE = path.resolve(".cache/mdn-content");
const OUT = path.resolve("out/mdn");
const ROOT = "files/en-us/web";
const INDEXED_AT = new Date().toISOString().slice(0, 10);
const MAX_BUNDLE = 1_500_000; // bytes per bundle part

// ---------- what to include ----------
const FULL_AREAS = ["javascript", "html", "css", "http", "accessibility"];

// Web API interface/guide folders (under web/api) grouped by the topics you asked for.
const API_GROUPS = {
  fetch: ["fetch_api", "request", "response", "headers", "abortcontroller", "abortsignal"],
  dom: ["document_object_model", "document", "element", "node", "nodelist", "htmlcollection", "domtokenlist", "htmlelement", "event", "eventtarget", "documentfragment", "mutationobserver", "domparser", "domexception", "customevent", "ui_events", "keyboardevent", "mouseevent", "pointer_events", "htmlformelement", "htmlinputelement", "htmltemplateelement", "shadowroot", "range", "selection", "treewalker", "window"],
  "web-storage": ["web_storage_api", "storage", "storageevent", "storagemanager", "storage_api"],
  websockets: ["websockets_api", "websocket", "websocketstream", "closeevent"],
  "browser-apis": ["service_worker_api", "serviceworker", "serviceworkercontainer", "serviceworkerregistration", "cache", "cachestorage", "web_workers_api", "worker", "sharedworker", "notifications_api", "notification", "geolocation_api", "geolocation", "history_api", "history", "location", "navigator", "intersection_observer_api", "intersectionobserver", "resizeobserver", "performance_api", "performance", "performanceobserver", "url", "urlsearchparams", "clipboard_api", "clipboard", "file_api", "blob", "file", "filereader", "formdata", "broadcast_channel_api", "broadcastchannel", "messagechannel", "messageport", "messageevent", "streams_api", "readablestream", "writablestream", "web_components", "customelementregistry", "console_api", "console", "indexeddb_api", "idbdatabase", "idbobjectstore", "idbtransaction", "idbrequest", "idbfactory", "idbcursor", "idbindex", "cookie_store_api", "cookiestore", "xmlhttprequest_api", "xmlhttprequest", "server-sent_events", "eventsource", "web_crypto_api", "crypto", "subtlecrypto", "css_object_model", "canvas_api", "canvasrenderingcontext2d", "htmlcanvaselement", "screen", "visualviewport"],
};
const API_DIR_TOPICS = new Map();
for (const [topic, dirs] of Object.entries(API_GROUPS)) for (const d of dirs) API_DIR_TOPICS.set(d, topic);

// ---------- 1. fetch (shallow + sparse: only the folders we need) ----------
const sparseDirs = [
  ...FULL_AREAS.map((a) => `${ROOT}/${a}`),
  ...(SCOPE === "full" ? [`${ROOT}/api`] : [...API_DIR_TOPICS.keys()].map((d) => `${ROOT}/api/${d}`)),
];
if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  execSync(`git clone --depth 1 --filter=blob:none --sparse ${REPO} "${CACHE}"`, { stdio: "inherit" });
}
execSync(`git -C "${CACHE}" sparse-checkout set ${sparseDirs.join(" ")}`, { stdio: "inherit" });
execSync(`git -C "${CACHE}" pull --ff-only`, { stdio: "inherit" });
const commit = execSync(`git -C "${CACHE}" rev-parse --short HEAD`).toString().trim();
const commitDate = execSync(`git -C "${CACHE}" log -1 --format=%cs`).toString().trim();

// ---------- 2. cleaning ----------
const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name === "index.md" ? [path.join(dir, e.name)] : []
  );
};

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/); // top-level keys only
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  const st = m[1].match(/^status:\s*(?:\[(.*?)\]|\n((?:\s+-\s+.*\n?)+))/m);
  meta.statusList = st ? (st[1] ? st[1].split(",").map((s) => s.trim()) : st[2].split("\n").map((s) => s.replace(/^\s+-\s+/, "").trim()).filter(Boolean)) : [];
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

// MDN "kumascript" macros -> readable text. Unknown macros are removed.
function macro(name, args) {
  const n = name.toLowerCase();
  const [a = "", b] = args;
  const code = (s) => (/\s/.test(s) ? s : "`" + s + "`");
  const shown = (s) => s.replace(/\//g, ".");
  switch (n) {
    case "domxref": case "jsxref": return code(shown(b ?? a));
    case "cssxref": case "csp": case "event": case "httpheader": case "httpmethod": return code(b ?? a);
    case "httpstatus": return code(b ?? a);
    case "htmlattrxref": return code(a);
    case "htmlelement": case "svgelement": case "mathmlelement": return "`<" + a + ">`";
    case "glossary": return b ?? a;
    case "rfc": return `RFC ${a}`;
    case "optional_inline": return "(optional)";
    case "experimental_inline": return "(experimental)";
    case "deprecated_inline": return "(deprecated)";
    case "non-standard_inline": return "(non-standard)";
    case "readonlyinline": return "(read-only)";
    case "securecontext_inline": return "(secure context)";
    case "deprecated_header": return "**Deprecated:** this feature is no longer recommended.";
    case "non-standard_header": return "**Non-standard:** this feature is not on a standards track.";
    case "seecomptable": case "experimental_header": return "**Experimental:** check browser compatibility before relying on this.";
    case "securecontext_header": return "**Secure context:** only available in secure contexts (HTTPS).";
    case "availableinworkers": return "Available in Web Workers.";
    default: return ""; // Specifications, Compat, sidebars, EmbedLiveSample, InteractiveExample, ...
  }
}
const MACRO_RE = /\{\{\s*([\w-]+)\s*(?:\(([\s\S]*?)\))?\s*\}\}/g;
const parseArgs = (s) => (s ? [...s.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1] ?? m[2]) : []);

function cleanMdn(body, pageUrl) {
  const segs = toSegments(body);
  const out = [];
  let dropLevel = 0; // inside a "Specifications" / "Browser compatibility" / "See also" section
  for (const s of segs) {
    if (s.type === "fence") {
      if (dropLevel) continue;
      const lang = (s.info.split(/\s+/)[0] || "").replace(/-(nolint|example.*)$/i, "").replace(/-?(good|bad)$/i, "").toLowerCase();
      out.push("```" + lang, ...s.lines, "```");
      continue;
    }
    let line = s.text;
    const h = line.match(/^(#{2,6})\s+(.*?)\s*$/);
    if (h) {
      const level = h[1].length;
      if (dropLevel && level <= dropLevel) dropLevel = 0;
      if (!dropLevel && /^(specifications?|browser compatibility|see also)$/i.test(h[2])) { dropLevel = level; continue; }
    }
    if (dropLevel) continue;

    const wasMacroOnly = /^\s*\{\{.*\}\}\s*$/.test(line);
    line = line.replace(MACRO_RE, (_, name, a) => macro(name, parseArgs(a)));
    if (wasMacroOnly && !line.trim()) continue;
    line = line.replace(/!\[[^\]]*\]\([^)]*\)/g, "");                       // images
    line = line.replace(/\]\((\/en-US\/docs\/[^)\s]*)\)/g, "](https://developer.mozilla.org$1)");
    line = line.replace(/\]\((#[^)\s]*)\)/g, `](${pageUrl}$1)`);
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- 3. topics from the page slug ----------
function topicsFor(slug) {
  const parts = slug.split("/"); // Web/API/Document/querySelector
  const area = (parts[1] || "").toLowerCase();
  const t = new Set();
  if (area === "javascript") t.add("javascript");
  else if (area === "html") t.add("html");
  else if (area === "css") t.add("css");
  else if (area === "http") t.add("http");
  else if (area === "accessibility") t.add("accessibility");
  else if (area === "api") {
    t.add("web-apis");
    const topic = API_DIR_TOPICS.get((parts[2] || "").toLowerCase());
    if (topic) t.add(topic);
    if (slug.toLowerCase() === "web/api/window/fetch") t.add("fetch");
  }
  if (t.size === 0) t.add("general");
  return [...t];
}

// ---------- 4. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const files = [
  ...FULL_AREAS.flatMap((a) => walk(path.join(CACHE, ROOT, a))),
  ...(SCOPE === "full" ? walk(path.join(CACHE, ROOT, "api")) : [...API_DIR_TOPICS.keys()].flatMap((d) => walk(path.join(CACHE, ROOT, "api", d)))),
  ...(fs.existsSync(path.join(CACHE, ROOT, "api/index.md")) ? [path.join(CACHE, ROOT, "api/index.md")] : []),
];

const manifest = [];
const bundles = {};
const seen = new Set();

for (const file of files) {
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const slug = meta.slug;
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);
  const pageUrl = `https://developer.mozilla.org/en-US/docs/${slug}`;
  const text = cleanMdn(body, pageUrl);
  if (text.trim().length < 60) continue; // empty landing pages
  const title = meta.title || slug.split("/").at(-1);
  const topics = topicsFor(slug);

  const front = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `url: ${pageUrl}`,
    `library: mdn`,
    `slug: ${slug}`,
    meta["page-type"] ? `page_type: ${meta["page-type"]}` : null,
    meta["browser-compat"] ? `browser_compat: ${String(meta["browser-compat"]).replace(/^\[|\]$/g, "")}` : null,
    meta.statusList.length ? `status: [${meta.statusList.join(", ")}]` : null,
    `topics: [${topics.join(", ")}]`,
    `source: developer.mozilla.org (mdn/content ${commit}, ${commitDate})`,
    `license: prose CC BY-SA 2.5, code examples CC0 - https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license`,
    `indexed_at: ${INDEXED_AT}`,
    "---",
    "",
  ].filter((x) => x !== null).join("\n");

  const rel = slug.replace(/^Web\//, "").toLowerCase().replace(/[^a-z0-9/_.-]+/g, "_") + ".md";
  const outPath = path.join(OUT, "pages", rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${front}# ${title}\n\n${text}`);
  manifest.push({ title, url: pageUrl, slug, topics, page_type: meta["page-type"] || null, file: path.join("pages", rel), chars: text.length });
  for (const tp of topics) (bundles[tp] ||= []).push({ title, url: pageUrl, text });
}

// bundles, split into parts of ~1.5 MB so each part stays readable / PDF-able
const ATTRIB = `> Content from MDN Web Docs (https://developer.mozilla.org), by Mozilla and individual contributors. Prose is licensed CC BY-SA 2.5, code examples CC0. Indexed ${INDEXED_AT} from mdn/content ${commit}.\n`;
const bundleFiles = [];
for (const [topic, pages] of Object.entries(bundles)) {
  let part = 1, buf = [], size = 0;
  const flush = () => {
    if (!buf.length) return;
    const name = `mdn-${topic}-${String(part).padStart(2, "0")}.md`;
    fs.writeFileSync(path.join(OUT, "bundles", name), [`# MDN - ${topic} (part ${part})\n`, ATTRIB, ...buf].join("\n"));
    bundleFiles.push(name); part++; buf = []; size = 0;
  };
  for (const p of pages) {
    const chunk = `\n---\n\n## ${p.title}\nSource: ${p.url}\n\n${p.text}`;
    if (size + chunk.length > MAX_BUNDLE && buf.length) flush();
    buf.push(chunk); size += chunk.length;
  }
  flush();
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ scope: SCOPE, commit, commitDate, indexedAt: INDEXED_AT, pages: manifest }, null, 2));

console.log(`\nDone. MDN (${SCOPE} scope, ${commitDate}): ${manifest.length} pages, ${bundleFiles.length} bundle parts -> ${OUT}`);
for (const [tp, pages] of Object.entries(bundles)) console.log(`  ${tp.padEnd(14)} ${pages.length} pages`);

// ---------- 5. optional PDFs ----------
if (flag("--pdf")) {
  fs.mkdirSync(path.join(OUT, "pdf"), { recursive: true });
  for (const f of bundleFiles) {
    const dest = path.join(OUT, "pdf", f.replace(/\.md$/, ".pdf"));
    console.log("PDF:", path.basename(dest));
    execSync(`npx --yes md-to-pdf "${path.join(OUT, "bundles", f)}" --dest "${dest}"`, { stdio: "inherit" });
  }
}

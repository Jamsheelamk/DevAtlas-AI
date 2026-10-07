// fetch-qdrant-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from the official Qdrant documentation.
//
// Source : https://github.com/qdrant/landing_page  (qdrant-landing/content/documentation - the files behind qdrant.tech/documentation)
// License: NO licence file was found in that repo. The docs are Copyright Qdrant. Attribution + source URL are kept in
//          every file. Use the corpus for your own private RAG index and check qdrant.tech's terms before redistributing it.
//
// Usage  : node fetch-qdrant-docs.mjs                       # concepts, guides, tutorials (skips cloud/enterprise/integration catalogs)
//          node fetch-qdrant-docs.mjs --scope full          # every documentation section
//          node fetch-qdrant-docs.mjs --langs http,typescript,python   # languages for inlined code examples (default: http,typescript)
//          node fetch-qdrant-docs.mjs --pdf                 # also one PDF per bundle part (md-to-pdf + Chromium)
// Needs  : Node 18+, git.
// Output : ./out/qdrant/pages/**.md   ./out/qdrant/bundles/*.md   ./out/qdrant/manifest.json   (+ ./out/qdrant/pdf with --pdf)

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const SCOPE = opt("--scope") || "core";
const LANGS = (opt("--langs") || "http,typescript").split(",").map((s) => s.trim());
const REPO = "https://github.com/qdrant/landing_page.git";
const CACHE = path.resolve(".cache/qdrant-landing");
const OUT = path.resolve("out/qdrant");
const LANDING = "qdrant-landing";
const DOC_DIR = `${LANDING}/content/documentation`;
const BASE = "https://qdrant.tech";
const INDEXED_AT = new Date().toISOString().slice(0, 10);
const MAX_BUNDLE = 1_500_000;

// sections skipped in the default ("core") scope: cloud/enterprise admin, integration catalogs, release notes, support pages
const SKIP_CORE = /^(cloud|cloud-|private-cloud|hybrid-cloud|frameworks|platforms|data-management|migrate-to-qdrant|migration-|dl-|release-notes|support|ecosystem-tab|guides-tab|deploy-tab|cloud-tab|examples|tutorials-lp-overview|tutorials-ecosystem|data-synchronization)/;
const ALWAYS_SKIP = /^(headless|snippets)(\/|$)/;

// ---------- 1. fetch ----------
if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  execSync(`git clone --depth 1 --filter=blob:none --sparse ${REPO} "${CACHE}"`, { stdio: "inherit" });
}
execSync(`git -C "${CACHE}" sparse-checkout set ${DOC_DIR}`, { stdio: "inherit" });
execSync(`git -C "${CACHE}" pull --ff-only`, { stdio: "inherit" });
const commit = execSync(`git -C "${CACHE}" rev-parse --short HEAD`).toString().trim();
const commitDate = execSync(`git -C "${CACHE}" log -1 --format=%cs`).toString().trim();
const DOC = path.join(CACHE, DOC_DIR);

// ---------- 2. helpers ----------
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : []);

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { meta, body: raw.slice(m[0].length) };
}

const EXT = { http: "http.md", typescript: "typescript.ts", python: "python.py", rust: "rust.rs", java: "java.java", csharp: "csharp.cs", go: "go.go" };
const FENCE_LANG = { typescript: "typescript", python: "python", rust: "rust", java: "java", csharp: "csharp", go: "go" };

// {{< code-snippet path="/documentation/headless/snippets/x/y/" >}} -> the selected language examples
function inlineSnippet(p) {
  const dir = path.join(DOC, p.replace(/^\/?documentation\//, ""));
  const blocks = [];
  for (const lang of LANGS) {
    const f = path.join(dir, EXT[lang] || "");
    if (!EXT[lang] || !fs.existsSync(f)) continue;
    let code = fs.readFileSync(f, "utf8").split("\n").filter((l) => !/@hide\b/.test(l)).join("\n").replace(/^\s*\n/, "").trimEnd();
    blocks.push(lang === "http" ? code : "```" + FENCE_LANG[lang] + "\n" + code + "\n```");
  }
  return blocks.length ? "\n\n" + blocks.join("\n\n") + "\n\n" : "";
}

function expandShortcodes(body, depth = 0) {
  body = body.replace(/\{\{[<%]\s*\/[\s\S]*?[>%]\}\}/g, ""); // closing tags
  return body.replace(/\{\{[<%]\s*([\w-]+)([\s\S]*?)[>%]\}\}/g, (_, name, rest) => {
    if (name === "code-snippet") {
      const p = rest.match(/path\s*=\s*"([^"]+)"/)?.[1];
      return p ? inlineSnippet(p) : "";
    }
    if (name === "include" && depth < 2) {
      const p = rest.match(/"([^"]+)"/)?.[1];
      const f = p && path.join(CACHE, LANDING, p);
      if (f && fs.existsSync(f)) return "\n\n" + expandShortcodes(parseFrontmatter(fs.readFileSync(f, "utf8")).body, depth + 1).trim() + "\n\n";
    }
    return ""; // figure, chart, island, prompt, accordion, ...
  });
}

function cleanDoc(raw) {
  let body = expandShortcodes(raw.replace(/\{\{\/\*[\s\S]*?\*\/\}\}/g, "").replace(/<!--[\s\S]*?-->/g, ""));
  const parts = body.split(/(^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[^\n]*$)/m);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i]
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")                       // images
      .replace(/\]\((\/[^)\s]*)\)/g, `](${BASE}$1)`)              // site-relative links
      .replace(/<code>([\s\S]*?)<\/code>/g, "`$1`")
      .replace(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, u, t) => `[${t}](${u.startsWith("/") ? BASE + u : u})`)
      .replace(/<aside\b[^>]*>/g, "\n**Note:** ")
      .replace(/<\/aside>/g, "\n")
      .replace(/<\/?(div|span|br|center|details|summary|strong|b|em|i|p)\b[^>]*>/g, "");
  }
  return parts.join("").replace(/^\s*#\s+.*\n/, "").replace(/\n{3,}/g, "\n\n").trim() + "\n";  // drop the page's own H1 (re-added from front matter)
}

// ---------- 3. topics ----------
function topicsFor(rel, title, desc) {
  const s = rel.toLowerCase();
  const h = `${title} ${desc}`.toLowerCase();
  const t = new Set();
  const in_ = (re) => re.test(s);
  const has = (re) => re.test(h);
  if (in_(/manage-data\/(collections|points|storage)|snapshots|\/collections/) || has(/\bcollections?\b/) && in_(/manage-data/)) t.add("collections");
  if (in_(/manage-data\/vectors|^embeddings\/|^fastembed\/|^inference\//) || has(/\b(multi)?vectors?\b/) && in_(/manage-data/)) t.add("vectors");
  if (in_(/manage-data\/(payload|indexing)/) || has(/\bpayload/)) t.add("payloads");
  if (in_(/search\/filtering|automate-filtering|manage-data\/indexing|filter/) || has(/\bfilter/)) t.add("filtering");
  if (in_(/search\/(search|explore|low-latency|search-relevance)|overview\/vector-search|search-patterns/) || has(/dense|similarity search|nearest neighbo/)) t.add("dense-search");
  if (in_(/text-search|sparse|bm25/) || has(/sparse|bm25|full[- ]text|splade/)) t.add("sparse-search");
  if (in_(/hybrid/) || has(/hybrid|fusion|\brrf\b|multi-stage/)) t.add("hybrid-search");
  if (in_(/hnsw|manage-data\/indexing|optimizer/) || has(/\bhnsw\b/)) t.add("hnsw");
  if (in_(/quantization/) || has(/quantization/)) t.add("quantization");
  if (in_(/rerank|search-precision/) || has(/rerank|re-rank|late interaction|colbert/)) t.add("reranking");
  if (in_(/^scaling\/|sharding|distributed|horizontal-scaling|resilience/) || has(/\bshard|replicat/)) t.add("sharding");
  if (in_(/multitenancy|tenant/) || has(/multitenan|multi-tenan|tenant/)) t.add("multitenancy");
  if (in_(/^ops-optimization\/|^search-tuning\/|low-latency|capacity|production-checklist|optimi[sz]e|performance|read-write-contention|when-your-collection-outgrows-ram/) || has(/performance|latency|optimi[sz]/)) t.add("performance");
  if (t.size === 0) t.add("general");
  return [...t];
}

// ---------- 4. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const manifest = [];
const bundles = {};

for (const file of walk(DOC)) {
  const relFile = path.relative(DOC, file).split(path.sep).join("/");            // manage-data/collections.md
  if (ALWAYS_SKIP.test(relFile)) continue;
  if (SCOPE !== "full" && SKIP_CORE.test(relFile)) continue;
  const slug = relFile.replace(/\.md$/, "").replace(/(^|\/)_index$/, "") || "index"; // manage-data/collections
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const text = cleanDoc(body);
  if (text.trim().length < 200) continue;                                          // empty section indexes

  const title = meta.title || path.basename(slug);
  const desc = meta.description || meta.short_description || "";
  const url = `${BASE}/documentation/${slug === "index" ? "" : slug + "/"}`;
  const topics = topicsFor(slug, title, desc);

  const front = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    desc ? `description: "${desc.replace(/"/g, '\\"')}"` : null,
    `url: ${url}`,
    `library: qdrant`,
    `section: ${slug.split("/")[0]}`,
    `topics: [${topics.join(", ")}]`,
    `source: qdrant.tech/documentation (qdrant/landing_page ${commit}, ${commitDate})`,
    `license: not specified in source repo - Copyright Qdrant; private use, check qdrant.tech terms before redistributing`,
    `indexed_at: ${INDEXED_AT}`,
    "---",
    "",
  ].filter((x) => x !== null).join("\n");

  const outPath = path.join(OUT, "pages", slug + ".md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${front}# ${title}\n\n${text}`);
  manifest.push({ title, url, section: slug.split("/")[0], topics, file: `pages/${slug}.md`, chars: text.length });
  for (const tp of topics) (bundles[tp] ||= []).push({ title, url, text });
}

const ATTRIB = `> Content from the official Qdrant documentation (https://qdrant.tech/documentation), Copyright Qdrant. Private-use corpus; see qdrant.tech terms. Indexed ${INDEXED_AT} from qdrant/landing_page ${commit}.\n`;
const bundleFiles = [];
for (const [topic, pages] of Object.entries(bundles)) {
  let part = 1, buf = [], size = 0;
  const flush = () => {
    if (!buf.length) return;
    const name = `qdrant-${topic}-${String(part).padStart(2, "0")}.md`;
    fs.writeFileSync(path.join(OUT, "bundles", name), [`# Qdrant - ${topic} (part ${part})\n`, ATTRIB, ...buf].join("\n"));
    bundleFiles.push(name); part++; buf = []; size = 0;
  };
  for (const p of pages) {
    const chunk = `\n---\n\n## ${p.title}\nSource: ${p.url}\n\n${p.text}`;
    if (size + chunk.length > MAX_BUNDLE && buf.length) flush();
    buf.push(chunk); size += chunk.length;
  }
  flush();
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ scope: SCOPE, langs: LANGS, commit, commitDate, indexedAt: INDEXED_AT, pages: manifest }, null, 2));

console.log(`\nDone. Qdrant docs (${SCOPE} scope, ${commitDate}): ${manifest.length} pages, ${bundleFiles.length} bundle parts -> ${OUT}`);
for (const [tp, pages] of Object.entries(bundles)) console.log(`  ${tp.padEnd(15)} ${pages.length} pages`);

// ---------- 5. optional PDFs ----------
if (flag("--pdf")) {
  fs.mkdirSync(path.join(OUT, "pdf"), { recursive: true });
  for (const f of bundleFiles) {
    const dest = path.join(OUT, "pdf", f.replace(/\.md$/, ".pdf"));
    console.log("PDF:", path.basename(dest));
    execSync(`npx --yes md-to-pdf "${path.join(OUT, "bundles", f)}" --dest "${dest}"`, { stdio: "inherit" });
  }
}

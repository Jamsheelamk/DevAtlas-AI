// fetch-upstash-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from the Upstash documentation (Redis, QStash queues, Vector, Workflow).
//
// Source : https://github.com/upstash/docs  (Mintlify .mdx files behind upstash.com/docs)
// License: NO licence file was found in that repo. The docs are Copyright Upstash. Attribution + source URL are kept in
//          every file. Use the corpus as your own private RAG index and check Upstash's terms before redistributing it.
//
// Usage  : node fetch-upstash-docs.mjs                # JavaScript/TypeScript view: Redis, Ratelimit, QStash, Vector, Workflow, tutorials
//          node fetch-upstash-docs.mjs --python       # also include the Python SDKs / Python tutorials / Python code blocks
//          node fetch-upstash-docs.mjs --scope full   # every section (Search, Box, Realtime, Blob, ...)
//          node fetch-upstash-docs.mjs --pdf          # also one PDF per bundle part (md-to-pdf + Chromium)
// Needs  : Node 18+, git.
// Output : ./out/upstash/pages/**.md   ./out/upstash/bundles/*.md   ./out/upstash/manifest.json   (+ ./out/upstash/pdf with --pdf)

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const FULL = opt("--scope") === "full";
const PY = flag("--python");
const REPO = "https://github.com/upstash/docs.git";
const CACHE = path.resolve(".cache/upstash-docs");
const OUT = path.resolve("out/upstash");
const BASE = "https://upstash.com/docs";
const INDEXED_AT = new Date().toISOString().slice(0, 10);
const MAX_BUNDLE = 1_500_000;

// ---------- scope ----------
const CORE_DIRS = ["redis", "qstash", "vector", "workflow"];
const FULL_DIRS = [...CORE_DIRS, "search", "box", "realtime", "blob", "devops", "common", "agent-resources"];
const DIRS = FULL ? FULL_DIRS : CORE_DIRS;
const SKIP_PATH = [
  /^redis\/search\//,                                                   // Redis Search product (use --scope full)
  /^redis\/integrations\//,                                             // third-party integration catalog
  /^qstash\/(api|openapi|misc)\//,                                      // OpenAPI-generated stubs / misc
  ...(PY ? [] : [/^redis\/sdks\/(py|ratelimit-py)\//, /^vector\/sdks\/py\//, /^qstash\/sdks\/py\//, /^workflow\/.*\/py\//,
    /^redis\/tutorials\/.*(python|laravel|goapi|django|flask|php|java|dotnet|ruby)/i, /(^|\/)(python|laravel|golang|php|java|ruby|dotnet)[-_\w]*\.mdx?$/i]),
];
const DROP_LANGS = PY ? new Set(["go", "golang", "java", "php", "ruby", "csharp", "c#", "rust", "swift", "kotlin", "dart"])
                      : new Set(["python", "py", "go", "golang", "java", "php", "ruby", "csharp", "c#", "rust", "swift", "kotlin", "dart"]);

// ---------- 1. fetch ----------
const sparse = [...DIRS.map((d) => d), "_snippets", "snippets"];
if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  execSync(`git clone --depth 1 --filter=blob:none --sparse ${REPO} "${CACHE}"`, { stdio: "inherit" });
}
execSync(`git -C "${CACHE}" sparse-checkout set ${sparse.join(" ")}`, { stdio: "inherit" });
execSync(`git -C "${CACHE}" pull --ff-only`, { stdio: "inherit" });
const commit = execSync(`git -C "${CACHE}" rev-parse --short HEAD`).toString().trim();
const commitDate = execSync(`git -C "${CACHE}" log -1 --format=%cs`).toString().trim();

// ---------- 2. helpers ----------
const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [path.join(dir, e.name)] : [])
    : [];

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

// Inline imported snippets: import X from "/snippets/foo.mdx"  ->  <X /> replaced by the snippet text.
function inlineSnippets(body, depth = 0) {
  const map = new Map();
  body = body.replace(/^import\s+(\w+)\s+from\s+['"](\/[^'"]+\.mdx?)['"];?\s*$/gm, (_, n, p) => { map.set(n, p); return ""; });
  body = body.replace(/^import\s+.*\s+from\s+['"][^'"]+['"];?\s*$/gm, "").replace(/^export\s+(const|default|function)\b.*$/gm, "");
  if (depth < 2) {
    for (const [name, p] of map) {
      const file = path.join(CACHE, p);
      if (!fs.existsSync(file)) continue;
      const snip = inlineSnippets(parseFrontmatter(fs.readFileSync(file, "utf8")).body, depth + 1).trim();
      body = body.replace(new RegExp(`<${name}\\b[^>]*/>`, "g"), `\n${snip}\n`);
    }
  }
  return body;
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

const CALLOUT = { Note: "Note", Tip: "Tip", Info: "Info", Warning: "Warning", Check: "Check", Callout: "Note" };
const attrsOf = (s) => {
  const a = {};
  for (const m of s.matchAll(/(\w[\w-]*)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) a[m[1]] = m[2] ?? m[3] ?? m[4];
  for (const m of s.matchAll(/\s(required|deprecated)(?=\s|\/|$)/g)) a[m[1]] = true;
  return a;
};
const isComponent = (n) => /^[A-Z][a-z]/.test(n); // <Card>, <Tabs> ... but not <QSTASH_TOKEN> / <YOUR_KEY>

function cleanMdx(body) {
  const segs = toSegments(inlineSnippets(body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<!--[\s\S]*?-->/g, "")));
  const out = [];
  let skipUntil = null;
  let pending = null;

  const handleTag = (tag) => {
    const m = tag.match(/^\s*<([A-Z][A-Za-z]*)\b([\s\S]*?)(\/?)>\s*$/);
    if (!m) return;
    const [, name, rest, selfClose] = m;
    const a = attrsOf(rest);
    if (name === "Card") { if (!selfClose) skipUntil = "</Card>"; return; }
    if (CALLOUT[name]) { out.push(`**${CALLOUT[name]}:**`); return; }
    if (["Tab", "Accordion", "Step", "Expandable"].includes(name) && a.title) { out.push(`**${a.title}**`); return; }
    if (name === "RequestExample") { out.push("**Request example:**"); return; }
    if (name === "ResponseExample") { out.push("**Response example:**"); return; }
    if (name === "ParamField" || name === "ResponseField") {
      const key = a.path || a.body || a.query || a.header || a.name || "";
      const bits = [a.type, a.required ? "required" : null, a.default ? `default: ${a.default}` : null].filter(Boolean);
      out.push(`- **\`${key}\`**${bits.length ? ` (${bits.join(", ")})` : ""}`);
    }
  };

  for (const s of segs) {
    if (s.type === "fence") {
      if (skipUntil || pending) continue;
      const toks = s.info.replace(/\{[^}]*\}/g, "").replace(/\btheme=\S+/g, "").trim().split(/\s+/).filter(Boolean);
      const lang = (toks[0] || "").toLowerCase();
      if (DROP_LANGS.has(lang)) continue;
      const file = toks.slice(1).find((t) => /\.(ts|tsx|js|jsx|json|mjs|env|yaml|yml|sh|toml)$/.test(t));
      if (file) out.push(`**File:** \`${file}\`\n`);
      out.push("```" + lang, ...s.lines, "```");
      continue;
    }

    let line = s.text;
    if (skipUntil) { if (line.includes(skipUntil)) skipUntil = null; continue; }
    if (pending !== null) {
      pending += "\n" + line;
      if (/>\s*$/.test(line)) { const t = pending; pending = null; handleTag(t); if (skipUntil && /\/>\s*$/.test(t)) skipUntil = null; }
      continue;
    }

    const one = line.match(/^\s*<(Note|Tip|Info|Warning|Check)>(.*)<\/\1>\s*$/);
    if (one) { out.push(`**${CALLOUT[one[1]]}:** ${one[2]}`); continue; }

    // whole element on one line: <ResponseField type="string">text</ResponseField>, <Step title="x">text</Step>, <Card ...>text</Card>
    const inl = line.match(/^\s*<(Card|ParamField|ResponseField|Tab|Step|Accordion|Expandable)\b(.*?)>(.*)<\/\1>\s*$/);
    if (inl) {
      const [, name, rest, inner] = inl;
      if (name !== "Card") {
        const a = attrsOf(rest);
        if (name === "ParamField" || name === "ResponseField") {
          const key = a.path || a.body || a.query || a.header || a.name || "";
          const bits = [a.type, a.required ? "required" : null, a.default ? `default: ${a.default}` : null].filter(Boolean);
          out.push(`- ${key ? `**\`${key}\`** ` : ""}${bits.length ? `(${bits.join(", ")}) ` : ""}${inner.trim()}`);
        } else out.push(`**${a.title || name}** ${inner.trim()}`);
      }
      continue;
    }

    // attribute values may contain ">" (e.g. type="(x) => void"), so these tags are matched greedily on one line
    if (/^\s*<(ParamField|ResponseField|Card|Tab|Accordion|Step|Expandable|RequestExample|ResponseExample)\b.*>\s*$/.test(line) && !/<\//.test(line)) {
      handleTag(line);
      if (skipUntil && /\/>\s*$/.test(line)) skipUntil = null;
      continue;
    }
    const open = line.match(/^\s*<([A-Z][A-Za-z]*)\b[^>]*$/);
    if (open && isComponent(open[1])) { pending = line; continue; }
    if (/^\s*<([A-Z][A-Za-z]*)\b[^>]*>\s*$/.test(line) && isComponent(line.match(/<([A-Z][A-Za-z]*)/)[1])) {
      handleTag(line);
      if (skipUntil && /\/>\s*$/.test(line)) skipUntil = null;
      continue;
    }
    if (/^\s*<\/[A-Z][a-z][A-Za-z]*>\s*$/.test(line)) continue;

    line = line.replace(/<Icon\b[^>]*\/>/g, "").replace(/<Tooltip[^>]*>(.*?)<\/Tooltip>/g, "$1");
    line = line.replace(/<\/?(CodeGroup|Tabs|Steps|AccordionGroup|CardGroup|Columns|Frame|RequestExample|ResponseExample)\b[^>]*>/g, "");
    line = line.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
    line = line.replace(/\]\((\/[^)\s]+)\)/g, (m, u) => `](${BASE}${u.startsWith("/docs/") ? u.slice(5) : u})`);
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- 3. topics ----------
function topicsFor(rel, md) {
  const s = rel.toLowerCase();
  const count = (re) => (md.match(re) || []).length;
  const t = new Set();
  if (/^redis\//.test(s)) t.add("redis");
  if (/^redis\/commands\//.test(s)) t.add("redis-commands");
  if (/cach(e|ing)|session|readyourwrites|nextjs_with_redis|laravel_caching|python_fastapi_caching/.test(s) || (/^redis\//.test(s) && count(/\bcach(e|ing|ed)\b/gi) >= 6)) t.add("caching");
  if (/rate[-_]?limit/.test(s) || count(/rate[ -]?limit/gi) >= 8) t.add("rate-limiting");
  if (/^qstash\//.test(s) || /^workflow\//.test(s) || /job_processing|queues?\b/.test(s)) t.add("queues");
  if (/^vector\//.test(s)) t.add("vector");
  if (/^workflow\//.test(s) || /tutorials\/|quickstarts\/|serverless|edge|lambda|vercel|cloudflare|cdk|cloud_run|app_runner|nextjs|nuxtjs|connect-client|connect-with-upstash/.test(s)) t.add("serverless-patterns");
  if (t.size === 0) t.add("general");
  return [...t];
}

// ---------- 4. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const files = [...DIRS.flatMap((d) => walk(path.join(CACHE, d))), ...["introduction.mdx"].map((f) => path.join(CACHE, f)).filter(fs.existsSync)];
const manifest = [];
const bundles = {};
const seen = new Set();

for (const file of files) {
  const rel = path.relative(CACHE, file).replace(/\.mdx?$/, "").split(path.sep).join("/");
  if (seen.has(rel) || SKIP_PATH.some((re) => re.test(rel + ".mdx"))) continue;
  seen.add(rel);
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const text = cleanMdx(body);
  if (text.trim().length < 150) continue;                         // OpenAPI stubs, empty indexes
  const title = meta.title || path.basename(rel);
  const topics = topicsFor(rel, text);
  const url = `${BASE}/${rel.replace(/\/(index|overview)$/, (m) => m === "/index" ? "" : m)}`;

  const front = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    meta.description ? `description: "${meta.description.replace(/"/g, '\\"')}"` : null,
    `url: ${url}`,
    `library: upstash`,
    `product: ${rel.split("/")[0]}`,
    `topics: [${topics.join(", ")}]`,
    `source: upstash.com/docs (upstash/docs ${commit}, ${commitDate})`,
    `license: not specified in source repo - Copyright Upstash; private use, check Upstash's terms before redistributing`,
    `indexed_at: ${INDEXED_AT}`,
    "---",
    "",
  ].filter((x) => x !== null).join("\n");

  const outPath = path.join(OUT, "pages", rel + ".md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${front}# ${title}\n\n${text}`);
  manifest.push({ title, url, product: rel.split("/")[0], topics, file: `pages/${rel}.md`, chars: text.length });
  for (const tp of topics) (bundles[tp] ||= []).push({ title, url, text });
}

const ATTRIB = `> Content from the official Upstash documentation (https://upstash.com/docs), Copyright Upstash. Private-use corpus; see Upstash's terms. Indexed ${INDEXED_AT} from upstash/docs ${commit}.\n`;
const bundleFiles = [];
for (const [topic, list] of Object.entries(bundles)) {
  let part = 1, buf = [], size = 0;
  const flush = () => {
    if (!buf.length) return;
    const name = `upstash-${topic}-${String(part).padStart(2, "0")}.md`;
    fs.writeFileSync(path.join(OUT, "bundles", name), [`# Upstash - ${topic} (part ${part})\n`, ATTRIB, ...buf].join("\n"));
    bundleFiles.push(name); part++; buf = []; size = 0;
  };
  for (const p of list) {
    const chunk = `\n---\n\n## ${p.title}\nSource: ${p.url}\n\n${p.text}`;
    if (size + chunk.length > MAX_BUNDLE && buf.length) flush();
    buf.push(chunk); size += chunk.length;
  }
  flush();
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ commit, commitDate, indexedAt: INDEXED_AT, python: PY, scope: FULL ? "full" : "core", pages: manifest }, null, 2));

console.log(`\nDone. Upstash docs (${FULL ? "full" : "core"}, ${commitDate}): ${manifest.length} pages, ${bundleFiles.length} bundle parts -> ${OUT}`);
for (const [tp, list] of Object.entries(bundles)) console.log(`  ${tp.padEnd(20)} ${list.length} pages`);

// ---------- 5. optional PDFs ----------
if (flag("--pdf")) {
  fs.mkdirSync(path.join(OUT, "pdf"), { recursive: true });
  for (const f of bundleFiles) {
    const dest = path.join(OUT, "pdf", f.replace(/\.md$/, ".pdf"));
    console.log("PDF:", path.basename(dest));
    execSync(`npx --yes md-to-pdf "${path.join(OUT, "bundles", f)}" --dest "${dest}"`, { stdio: "inherit" });
  }
}

// fetch-langchain-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from the official LangChain / LangGraph docs (JavaScript edition).
//
// Source : https://github.com/langchain-ai/docs  (src/... - the Mintlify files behind docs.langchain.com)
// License: MIT, Copyright (c) LangChain (see LICENSE in that repo) -> attribution kept in every file.
//
// Usage  : node fetch-langchain-docs.mjs                 # LangChain + LangGraph + JS integrations + LangSmith evaluation docs
//          node fetch-langchain-docs.mjs --deepagents    # also include the Deep Agents docs
//          node fetch-langchain-docs.mjs --only langgraph   # dedicated LangGraph corpus -> ./out/langgraph (graph API, state, persistence, HITL, multi-agent, workflows)
//          node fetch-langchain-docs.mjs --pdf           # also one PDF per bundle part (md-to-pdf + Chromium)
// Needs  : Node 18+, git.
// Output : ./out/langchain/pages/**.md     one file per page  -> ingest these
//          ./out/langchain/bundles/*.md    topic bundles (~1.5 MB parts)
//          ./out/langchain/manifest.json
//          ./out/langchain/pdf/*.pdf       only with --pdf
//
// The docs mix Python and JavaScript on shared pages (":::python" / ":::js" blocks).
// This script keeps ONLY the JavaScript variant and skips python/ pages entirely.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const LG = opt("--only") === "langgraph";
const NAME = LG ? "langgraph" : "langchain";
const REPO = "https://github.com/langchain-ai/docs.git";
const CACHE = path.resolve(".cache/langchain-docs");
const OUT = path.resolve(`out/${NAME}`);
const SRC = "src";
const BASE = "https://docs.langchain.com";
const INDEXED_AT = new Date().toISOString().slice(0, 10);
const MAX_BUNDLE = 1_500_000;

// ---------- 1. fetch ----------
const sparse = LG ? ["src/oss/langgraph", "src/oss/langchain", "src/oss/concepts", "src/snippets"] : [
  "src/oss/langchain", "src/oss/langgraph", "src/oss/concepts", "src/oss/javascript", "src/oss/integrations",
  "src/snippets", "src/langsmith",
  ...(flag("--deepagents") ? ["src/oss/deepagents"] : []),
];
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
  const npm = m[1].match(/^\s+npm:\s*['"]?([^'"\n]+)['"]?/m);
  if (npm) meta.npm = npm[1].trim();
  return { meta, body: raw.slice(m[0].length) };
}

// Inline /snippets/*.mdx components (e.g. <ChatModelTabsJs />) so their content is not lost.
function inlineSnippets(body, depth = 0) {
  const map = new Map();
  body = body.replace(/^import\s+(\w+)\s+from\s+['"](\/snippets\/[^'"]+\.mdx)['"];?\s*$/gm, (_, name, p) => { map.set(name, p); return ""; });
  body = body.replace(/^import\s+.*\s+from\s+['"][^'"]+['"];?\s*$/gm, "").replace(/^export\s+(const|default|function)\b.*$/gm, "");
  if (depth < 2) {
    for (const [name, p] of map) {
      const file = path.join(CACHE, SRC, p);
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
const isComponent = (n) => /^[A-Z][a-z]/.test(n); // <Card>, <Tabs> ... but not <YOUR_KEY>

function cleanMdx(body) {
  const segs = toSegments(inlineSnippets(body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<!--[\s\S]*?-->/g, "")));
  const out = [];
  let skipLang = false;     // inside :::python
  let dropBlock = false;    // inside :::agent
  let skipUntil = null;     // closing tag to wait for (e.g. </Card>)
  let pending = null;       // multi-line opening tag being collected

  const handleTag = (tag) => {
    const m = tag.match(/^\s*<([A-Z][A-Za-z]*)\b([\s\S]*?)(\/?)>\s*$/);
    if (!m) return;
    const [, name, rest, selfClose] = m;
    const a = attrsOf(rest);
    if (name === "Card") { if (!selfClose) skipUntil = "</Card>"; return; }
    if (CALLOUT[name]) { out.push(`**${CALLOUT[name]}:**`); return; }
    if (["Tab", "Accordion", "Step", "Expandable"].includes(name) && a.title) { out.push(`**${a.title}**`); return; }
    if (name === "Update" && a.label) { out.push(`**${a.label}**`); return; }
    if (name === "ParamField" || name === "ResponseField") {
      const key = a.path || a.body || a.query || a.header || a.name || "";
      const bits = [a.type, a.required ? "required" : null, a.default ? `default: ${a.default}` : null].filter(Boolean);
      out.push(`- **\`${key}\`**${bits.length ? ` (${bits.join(", ")})` : ""}`);
    }
  };

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];

    if (s.type === "fence") {
      if (skipLang || dropBlock || skipUntil || pending) continue;
      const toks = s.info.replace(/\{[^}]*\}/g, "").replace(/\btheme=\S+/g, "").trim().split(/\s+/).filter(Boolean);
      const lang = (toks[0] || "").toLowerCase();
      const rest = toks.slice(1);
      if (lang === "python" || lang === "py") continue;                                   // JS corpus: no Python code
      if (rest.some((t) => ["yarn", "pnpm", "bun"].includes(t.toLowerCase()))) continue; // duplicate install commands
      const file = rest.find((t) => /\.(ts|tsx|js|jsx|json|mjs|env|yaml|yml|sh|toml)$/.test(t));
      if (file) out.push(`**File:** \`${file}\`\n`);
      out.push("```" + lang, ...s.lines, "```");
      continue;
    }

    let line = s.text;

    // :::python / :::js / :::caution / :::agent blocks
    const fenceBlock = line.match(/^\s*:::(\w+)?\s*$/);
    if (fenceBlock) {
      const kind = fenceBlock[1];
      if (!kind) { skipLang = false; dropBlock = false; continue; }          // closing ":::"
      if (kind === "python") { skipLang = true; continue; }
      if (kind === "agent") { dropBlock = true; continue; }
      if (kind === "caution") { if (!skipLang && !dropBlock) out.push("**Caution:**"); continue; }
      continue;                                                              // :::js -> keep content
    }
    if (skipLang || dropBlock) continue;

    if (skipUntil) { if (line.includes(skipUntil)) skipUntil = null; continue; }
    if (pending !== null) {
      pending += "\n" + line;
      if (/>\s*$/.test(line)) { const t = pending; pending = null; handleTag(t); if (skipUntil && /\/>\s*$/.test(t)) skipUntil = null; }
      continue;
    }

    // one-line callouts: <Note>text</Note>
    const one = line.match(/^\s*<(Note|Tip|Info|Warning|Check)>(.*)<\/\1>\s*$/);
    if (one) { out.push(`**${CALLOUT[one[1]]}:** ${one[2]}`); continue; }

    // attribute values may contain ">" (e.g. type="(x) => void"), so match these tags greedily on one line
    if (/^\s*<(ParamField|ResponseField|Card|Tab|Accordion|Step|Expandable|Update)\b.*>\s*$/.test(line) && !/<\//.test(line)) {
      handleTag(line);
      if (skipUntil && /\/>\s*$/.test(line)) skipUntil = null;
      continue;
    }
    const open = line.match(/^\s*<([A-Z][A-Za-z]*)\b[^>]*$/);              // tag continues on next lines
    if (open && isComponent(open[1])) { pending = line; continue; }
    if (/^\s*<([A-Z][A-Za-z]*)\b[^>]*>\s*$/.test(line) && isComponent(line.match(/<([A-Z][A-Za-z]*)/)[1])) {
      handleTag(line);
      if (skipUntil && /\/>\s*$/.test(line)) skipUntil = null;
      continue;
    }
    if (/^\s*<\/[A-Z][a-z][A-Za-z]*>\s*$/.test(line)) continue;           // closing tags

    line = line.replace(/<Icon\b[^>]*\/>/g, "").replace(/<Tooltip[^>]*>(.*?)<\/Tooltip>/g, "$1");
    line = line.replace(/<\/?(CodeGroup|Tabs|Steps|AccordionGroup|CardGroup|Columns|Frame)\b[^>]*>/g, "");
    line = line.replace(/@\[([^\]]+)\]/g, "$1");                                  // Mintlify API cross-refs: @[`Document`]
    line = line.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
    line = line.replace(/\]\((\/[^)\s]+)\)/g, `](${BASE}$1)`);
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- 3. topics (a page can belong to several) ----------
function topicsForLangGraph(rel) {
  const s = rel.toLowerCase();
  const t = new Set();
  if (/langgraph\/(overview|graph-api|use-graph-api|pregel|thinking-in-langgraph|choosing-apis|functional-api|use-functional-api|use-subgraphs|application-structure|quickstart|install)/.test(s)) t.add("graph-architecture");
  if (/langgraph\/(graph-api|use-graph-api|thinking-in-langgraph|persistence|add-memory|stores)|concepts\/(context|memory)|errors\/(invalid_concurrent|invalid_graph_node)/.test(s)) t.add("state");
  if (/langgraph\/(graph-api|use-graph-api|workflows-agents|thinking-in-langgraph|pregel)|errors\/(invalid_graph_node|graph_recursion)/.test(s)) t.add("nodes-edges");
  if (/langgraph\/(persistence|checkpointers|add-memory|stores|fault-tolerance|use-time-travel)|short-term-memory|long-term-memory|errors\/missing_checkpointer/.test(s)) t.add("persistence");
  if (/langgraph\/interrupts|human-in-the-loop|use-time-travel/.test(s)) t.add("human-in-the-loop");
  if (/langgraph\/(agentic-rag|workflows-agents|quickstart|sql-agent)|langchain\/(agents|runtime|middleware|context-engineering)/.test(s)) t.add("agents");
  if (/multi-agent|use-subgraphs|errors\/multiple_subgraphs/.test(s)) t.add("multi-agent");
  if (/langgraph\/(workflows-agents|functional-api|use-functional-api|graph-api|use-graph-api|thinking-in-langgraph)|multi-agent\/custom-workflow/.test(s)) t.add("workflows");
  if (/streaming|event-streaming|frontend/.test(s)) t.add("streaming");
  if (t.size === 0) t.add("general");
  return [...t];
}

function topicsFor(rel) {
  if (LG) return topicsForLangGraph(rel);
  const s = rel.toLowerCase();
  const t = new Set();
  if (/integrations\/retrievers|langchain\/retrieval|knowledge-base|retriever/.test(s)) t.add("retrievers");
  if (/document_loaders|document-loaders/.test(s)) t.add("document-loaders");
  if (/splitters|document_transformers|text-split/.test(s)) t.add("text-splitters");
  if (/embeddings/.test(s)) t.add("embeddings");
  if (/vectorstores|vector-stores/.test(s)) t.add("vector-stores");
  if (/langchain\/(agents|multi-agent|middleware|runtime|human-in-the-loop|guardrails|context-engineering|streaming|event-streaming)|langgraph\/|integrations\/(agents|middleware)|\/concepts\//.test(s)) t.add("agents");
  if (/langchain\/tools|integrations\/tools|langchain\/mcp|\/mcp/.test(s)) t.add("tools");
  if (/structured-output|structured_output/.test(s)) t.add("structured-output");
  if (/memory|persistence|checkpointers|\/stores/.test(s)) t.add("memory");
  if (/(^|[/-])rag([/-]|$)|retrieval|knowledge-base|agentic-rag/.test(s)) t.add("rag");
  if (/^langsmith\//.test(s) || /langchain\/test/.test(s)) t.add("evaluation");
  if (/\/chat\/|langchain\/models|integrations\/llms/.test(s)) t.add("models");
  if (/langgraph\//.test(s)) t.add("langgraph");
  if (t.size === 0) t.add("general");
  return [...t];
}

// ---------- 4. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const srcRoot = path.join(CACHE, SRC);
const wanted = (rel) => {
  if (LG) return rel.startsWith("oss/langgraph/") || rel.startsWith("oss/concepts/") ||
    /^oss\/langchain\/(multi-agent|human-in-the-loop|agents|short-term-memory|long-term-memory|streaming|event-streaming|middleware|runtime|context-engineering)/.test(rel);
  if (/^oss\/(openwiki|contributing)\//.test(rel) || /^oss\/python\//.test(rel)) return false;
  if (rel.startsWith("langsmith/")) return /eval/i.test(rel);                     // LangSmith: evaluation pages only
  if (rel.startsWith("oss/")) return true;
  return false;
};
const dirs = LG ? ["oss/langgraph", "oss/langchain", "oss/concepts"] : ["oss/langchain", "oss/langgraph", "oss/concepts", "oss/javascript", "oss/integrations", "langsmith", ...(flag("--deepagents") ? ["oss/deepagents"] : [])];
const manifest = [];
const bundles = {};
const seen = new Set();

for (const d of dirs) {
  for (const file of walk(path.join(srcRoot, d))) {
    const rel = path.relative(srcRoot, file).replace(/\.mdx?$/, "").split(path.sep).join("/");
    if (seen.has(rel) || !wanted(rel)) continue;
    seen.add(rel);
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    const urlPath = rel.replace(/\/index$/, "");
    const url = `${BASE}/${urlPath}`;
    const text = cleanMdx(body);
    if (text.trim().length < 150) continue;
    const title = meta.title || path.basename(rel);
    const topics = topicsFor(rel);

    const front = [
      "---",
      `title: "${title.replace(/"/g, '\\"')}"`,
      meta.description ? `description: "${meta.description.replace(/"/g, '\\"')}"` : null,
      `url: ${url}`,
      `library: ${rel.startsWith("oss/langgraph/") ? "langgraph" : "langchain"}`,
      `language: javascript`,
      meta.npm ? `package: "${meta.npm}"` : null,
      `section: ${rel.split("/").slice(0, 2).join("/")}`,
      `topics: [${topics.join(", ")}]`,
      `source: docs.langchain.com (langchain-ai/docs ${commit}, ${commitDate})`,
      `license: MIT - Copyright (c) LangChain`,
      `indexed_at: ${INDEXED_AT}`,
      "---",
      "",
    ].filter((x) => x !== null).join("\n");

    const outPath = path.join(OUT, "pages", rel + ".md");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${front}# ${title}\n\n${text}`);
    manifest.push({ title, url, topics, package: meta.npm || null, file: `pages/${rel}.md`, chars: text.length });
    for (const tp of topics) (bundles[tp] ||= []).push({ title, url, text });
  }
}

const ATTRIB = `> Content from the official LangChain documentation (https://docs.langchain.com), MIT License, Copyright (c) LangChain. JavaScript variants only. Indexed ${INDEXED_AT} from langchain-ai/docs ${commit}.\n`;
const bundleFiles = [];
for (const [topic, pages] of Object.entries(bundles)) {
  let part = 1, buf = [], size = 0;
  const flush = () => {
    if (!buf.length) return;
    const name = `${NAME}-${topic}-${String(part).padStart(2, "0")}.md`;
    fs.writeFileSync(path.join(OUT, "bundles", name), [`# ${LG ? "LangGraph" : "LangChain"} (JS) - ${topic} (part ${part})\n`, ATTRIB, ...buf].join("\n"));
    bundleFiles.push(name); part++; buf = []; size = 0;
  };
  for (const p of pages) {
    const chunk = `\n---\n\n## ${p.title}\nSource: ${p.url}\n\n${p.text}`;
    if (size + chunk.length > MAX_BUNDLE && buf.length) flush();
    buf.push(chunk); size += chunk.length;
  }
  flush();
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ commit, commitDate, indexedAt: INDEXED_AT, pages: manifest }, null, 2));

console.log(`\nDone. ${LG ? "LangGraph" : "LangChain"} docs (JS, ${commitDate}): ${manifest.length} pages, ${bundleFiles.length} bundle parts -> ${OUT}`);
for (const [tp, pages] of Object.entries(bundles)) console.log(`  ${tp.padEnd(18)} ${pages.length} pages`);

// ---------- 5. optional PDFs ----------
if (flag("--pdf")) {
  fs.mkdirSync(path.join(OUT, "pdf"), { recursive: true });
  for (const f of bundleFiles) {
    const dest = path.join(OUT, "pdf", f.replace(/\.md$/, ".pdf"));
    console.log("PDF:", path.basename(dest));
    execSync(`npx --yes md-to-pdf "${path.join(OUT, "bundles", f)}" --dest "${dest}"`, { stdio: "inherit" });
  }
}

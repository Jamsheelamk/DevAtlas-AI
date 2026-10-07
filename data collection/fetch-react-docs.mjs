// fetch-react-docs.mjs
// Builds a clean, RAG-ready Markdown corpus from the official React docs.
//
// Source : https://github.com/reactjs/react.dev  (src/content/learn + src/content/reference)
// License: docs are CC BY 4.0 (see LICENSE-DOCS.md in that repo) -> keep attribution (done below).
//
// Usage  : node fetch-react-docs.mjs
// Needs  : Node 18+, git. No npm dependencies.
// Output : ./out/pages/**.md        one file per doc page (best for RAG ingestion)
//          ./out/bundles/*.md       one file per topic (Hooks, State, ...) - handy for PDF / manual upload
//          ./out/manifest.json      metadata for every page

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = "https://github.com/reactjs/react.dev.git";
const CACHE = path.resolve(".cache/react.dev");
const OUT = path.resolve("out/react");
const SECTIONS = ["src/content/learn", "src/content/reference"];
const INDEXED_AT = new Date().toISOString().slice(0, 10);

// ---------- 1. get the source (shallow, sparse clone) ----------
if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  execSync(`git clone --depth 1 --filter=blob:none --sparse ${REPO} "${CACHE}"`, { stdio: "inherit" });
}
execSync(`git -C "${CACHE}" sparse-checkout set ${SECTIONS.join(" ")}`, { stdio: "inherit" });
execSync(`git -C "${CACHE}" pull --ff-only`, { stdio: "inherit" });
const commit = execSync(`git -C "${CACHE}" rev-parse --short HEAD`).toString().trim();

// ---------- 2. helpers ----------
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : []
  );

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

const LABELS = { Note: "Note", Pitfall: "Pitfall", Hint: "Hint", Recap: "Recap", YouWillLearn: "You will learn", Intro: null, DeepDive: "Deep dive", Solution: "Solution", Challenges: null, LearnMore: null, Canary: "Canary (experimental)", Experimental: "Experimental" };

// Converts MDX-flavoured markdown to plain markdown. Code fences are left untouched (JSX inside code must survive).
function cleanMdx(body, urlBase) {
  const lines = body.split("\n");
  const out = [];
  let inFence = false;
  let skipFence = false;

  for (let line of lines) {
    const fence = line.match(/^(\s*)```(.*)$/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        const info = fence[2].trim();
        const [lang = "", ...rest] = info.replace(/\{[^}]*\}/g, "").trim().split(/\s+/);
        skipFence = rest.includes("hidden"); // hidden Sandpack support files add noise
        if (skipFence) continue;
        const file = rest.find((t) => /\.(js|jsx|css|json|html|ts|tsx)$/.test(t));
        out.push("```" + lang);
        if (file) out.push(`// File: ${file}`);
      } else {
        inFence = false;
        if (skipFence) { skipFence = false; continue; }
        out.push("```");
      }
      continue;
    }
    if (inFence) {
      if (!skipFence) out.push(line.replace(/\s*\/\/ \[\[.*?\]\]\s*$/, ""));
      continue;
    }

    // --- prose lines ---
    line = line.replace(/\s*\{\/\*.*?\*\/\}\s*$/, ""); // heading id comments
    line = line.replace(/\{\/\*.*?\*\/\}/g, "");
    if (/^\s*<(Sandpack|Diagram|Illustration|IllustrationBlock|InlineToc|TeamMember|Math|MathI|Video|YouTubeIframe)\b[^>]*\/?>\s*$/.test(line)) continue;
    if (/^\s*<\/(Sandpack|Diagram|Illustration|IllustrationBlock|MathBlock|Math|MathI)>\s*$/.test(line)) continue;
    line = line.replace(/<CodeStep[^>]*>(.*?)<\/CodeStep>/g, "$1");

    const open = line.match(/^\s*<([A-Z][A-Za-z]*)\b[^>]*>\s*$/);
    if (open) {
      const label = LABELS[open[1]];
      if (label) out.push(`**${label}:**`);
      continue;
    }
    if (/^\s*<\/[A-Z][A-Za-z]*>\s*$/.test(line)) continue;
    if (/^\s*<[A-Z][A-Za-z]*\b[^>]*\/>\s*$/.test(line)) continue;

    // inline component tags -> keep inner text
    line = line.replace(/<\/?[A-Z][A-Za-z]*\b[^>]*>/g, "");
    // relative links -> absolute
    line = line.replace(/\]\((\/[^)\s]+)\)/g, `](${urlBase}$1)`);
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- 3. topic tagging (a page can belong to several topics) ----------
const HOOK_RE = /(^|\/)use[A-Z]?\w*\.md$/;
function topicsFor(rel, title) {
  const t = new Set();
  const p = rel.toLowerCase();
  if (p.startsWith("reference/")) t.add("api-reference");
  if (p.startsWith("reference/rsc/") || /server-(components|functions)|use-(client|server)|directives/.test(p)) t.add("server-components");
  if (p.includes("reference/react/hooks.md") || HOOK_RE.test(rel) || /custom-hooks|hooks/.test(p)) t.add("hooks");
  if (/reference\/react\/(components|component|fragment|purecomponent|strictmode|profiler|suspense|activity|viewtransition|children|clone|createelement|isvalidelement)/.test(p) ||
      /describing-the-ui|your-first-component|importing-and-exporting|writing-markup|javascript-in-jsx|passing-props|conditional-rendering|rendering-lists|keeping-components-pure|understanding-your-ui|thinking-in-react/.test(p)) t.add("components");
  if (/managing-state|state-a-component|adding-interactivity|responding-to-events|state-as-a-snapshot|queueing-a-series|updating-objects|updating-arrays|reacting-to-input|choosing-the-state|sharing-state|preserving-and-resetting|extracting-state-logic|passing-data-deeply|scaling-up|usestate|usereducer|usecontext|createcontext/.test(p)) t.add("state");
  if (/escape-hatches|synchronizing-with-effects|you-might-not-need|lifecycle-of-reactive|separating-events|removing-effect|reusing-logic|referencing-values|manipulating-the-dom|useeffect|uselayouteffect|useinsertioneffect|useeffectevent|useref/.test(p)) t.add("effects");
  const stem = path.basename(rel, ".md").toLowerCase();
  if (["memo", "usememo", "usecallback", "usetransition", "usedeferredvalue", "lazy", "suspense", "profiler", "cache", "cachesignal", "useoptimistic", "starttransition", "react-compiler", "viewtransition"].includes(stem) ||
      p === "learn/react-compiler/introduction.md" || p === "reference/react-compiler/index.md") t.add("performance");
  if (t.size === 0) t.add("general");
  return [...t];
}

// ---------- 4. build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "pages"), { recursive: true });
fs.mkdirSync(path.join(OUT, "bundles"), { recursive: true });

const manifest = [];
const bundles = {};

for (const section of SECTIONS) {
  const root = path.join(CACHE, section);
  for (const file of walk(root)) {
    const relFromContent = path.relative(path.join(CACHE, "src/content"), file); // learn/x.md
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    const title = meta.title || path.basename(file, ".md");
    const urlPath = "/" + relFromContent.replace(/\.md$/, "").replace(/\/index$/, "");
    const url = "https://react.dev" + urlPath;
    const topics = topicsFor(relFromContent, title);
    const text = cleanMdx(body, "https://react.dev");
    if (text.trim().length < 80) continue; // skip empty index stubs

    const front = [
      "---",
      `title: "${title.replace(/"/g, '\\"')}"`,
      `url: ${url}`,
      `library: react`,
      `section: ${relFromContent.split("/")[0]}`,
      `topics: [${topics.join(", ")}]`,
      `source: react.dev (commit ${commit})`,
      `license: CC BY 4.0 - https://creativecommons.org/licenses/by/4.0/`,
      `indexed_at: ${INDEXED_AT}`,
      "---",
      "",
    ].join("\n");
    const doc = `${front}# ${title}\n\n${text}`;

    const outRel = relFromContent.replace(/\.md$/, "") + ".md";
    const outPath = path.join(OUT, "pages", outRel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, doc);

    manifest.push({ title, url, section: relFromContent.split("/")[0], topics, file: path.join("pages", outRel), chars: doc.length });
    for (const tp of topics) (bundles[tp] ||= []).push({ title, url, text });
  }
}

const ATTRIB = `> Content from the official React documentation (https://react.dev), licensed under CC BY 4.0. Copyright Meta Platforms, Inc. and affiliates. Indexed ${INDEXED_AT} from commit ${commit}.\n`;
for (const [topic, pages] of Object.entries(bundles)) {
  const md = [`# React - ${topic}\n`, ATTRIB, ...pages.map((p) => `\n---\n\n## ${p.title}\nSource: ${p.url}\n\n${p.text}`)].join("\n");
  fs.writeFileSync(path.join(OUT, "bundles", `react-${topic}.md`), md);
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ commit, indexedAt: INDEXED_AT, pages: manifest }, null, 2));

console.log(`\nDone. ${manifest.length} pages, ${Object.keys(bundles).length} topic bundles -> ${OUT}`);
for (const [tp, pages] of Object.entries(bundles)) console.log(`  ${tp.padEnd(18)} ${pages.length} pages`);

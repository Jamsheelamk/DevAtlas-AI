// collect-all.mjs
// Master orchestrator for DevAtlas AI documentation collection scripts.
//
// Usage:
//   node collect-all.mjs                  # Interactive / default selective run
//   node collect-all.mjs --quick          # Fast run for core AI & Fullstack libraries
//   node collect-all.mjs --only react     # Run single collector
//   node collect-all.mjs --all            # Run all 9 collectors sequentially

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const COLLECTORS = [
  { id: "react", file: "fetch-react-docs.mjs", args: [], desc: "React 19 / Hooks / RSC Docs" },
  { id: "nextjs", file: "fetch-nextjs-docs.mjs", args: [], desc: "Next.js App Router Docs" },
  { id: "node", file: "fetch-node-docs.mjs", args: [], desc: "Node.js Core APIs" },
  { id: "mdn", file: "fetch-mdn-docs.mjs", args: ["--scope", "core"], desc: "MDN Web Docs (Core)" },
  { id: "langchain", file: "fetch-langchain-docs.mjs", args: [], desc: "LangChain JavaScript Docs" },
  { id: "langgraph", file: "fetch-landgraph-docs.mjs", args: ["--only", "langgraph"], desc: "LangGraph JS & StateGraph" },
  { id: "groq", file: "fetch-groq-docs.mjs", args: ["--limit", "30"], desc: "Groq LPU & Models Docs" },
  { id: "qdrant", file: "fetch-qdrant-docs.mjs", args: ["--scope", "core"], desc: "Qdrant Vector Database Docs" },
  { id: "upstash", file: "fetch-upstash-docs.mjs", args: [], desc: "Upstash Redis & Vector Docs" },
];

const targetOnly = opt("--only");
const isQuick = flag("--quick");

let queue = COLLECTORS;
if (targetOnly) {
  queue = COLLECTORS.filter((c) => c.id.toLowerCase() === targetOnly.toLowerCase());
  if (queue.length === 0) {
    console.error(`Unknown collector "${targetOnly}". Available: ${COLLECTORS.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }
} else if (isQuick) {
  // Quick mode selects core AI Agent + State libraries
  queue = COLLECTORS.filter((c) => ["react", "langgraph", "groq", "qdrant", "upstash"].includes(c.id));
}

console.log("==============================================================");
console.log(` DevAtlas AI - Documentation Collector Orchestrator`);
console.log(` Running ${queue.length} collectors: ${queue.map((c) => c.id).join(", ")}`);
console.log("==============================================================\n");

for (const item of queue) {
  const filePath = path.join(__dirname, item.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`[SKIP] Script not found: ${item.file}`);
    continue;
  }

  console.log(`\n>>> [${item.id.toUpperCase()}] Starting: ${item.desc} (${item.file})`);
  const runArgs = [...item.args];
  const res = spawnSync("node", [filePath, ...runArgs], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
  });

  if (res.status !== 0) {
    console.error(`[WARN] Collector ${item.id} exited with status ${res.status}`);
  } else {
    console.log(`[DONE] Collector ${item.id} finished successfully.`);
  }
}

console.log("\n==============================================================");
console.log(" All selected documentation collectors finished.");
console.log(" Manifests and Markdown pages saved to data collection/out/<framework>");
console.log("==============================================================");

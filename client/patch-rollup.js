// client/patch-rollup.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "node_modules/rollup/dist/native.js");

if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, "utf8");
  if (!content.includes("@rollup/wasm-node/dist/native.js")) {
    content = content.replace(
      /const nativeModule = requireWithFriendlyError\([\s\S]*?\);/,
      `let nativeModule;
try {
  nativeModule = requireWithFriendlyError(
    existsSync(path.join(__dirname, localName)) ? localName : \`@rollup/rollup-\${packageBase}\`
  );
} catch (err) {
  try {
    nativeModule = require('@rollup/wasm-node/dist/native.js');
  } catch (wasmErr) {
    throw err;
  }
}`
    );
    fs.writeFileSync(target, content, "utf8");
    console.log("[Patch] Rollup wasm fallback successfully configured.");
  }
}

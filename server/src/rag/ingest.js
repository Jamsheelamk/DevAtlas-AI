// server/src/rag/ingest.js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { getEmbedding } from "../services/embeddings.js";
import { initQdrant, upsertPoints } from "../services/qdrant.js";

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const val = kv[2].replace(/^["']|["']$/g, "").trim();
      meta[kv[1]] = val;
    }
  }
  return { meta, body: raw.slice(m[0].length) };
}

// Chunks markdown by headings (H1, H2, H3) while keeping code blocks intact
function chunkMarkdown(markdown, maxChars = 1200) {
  const sections = markdown.split(/(?=^#{1,3}\s+)/m);
  const chunks = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxChars) {
      chunks.push(trimmed);
    } else {
      // Split large sections by paragraphs
      const paragraphs = trimmed.split(/\n\n+/);
      let buffer = "";
      for (const para of paragraphs) {
        if ((buffer + "\n\n" + para).length > maxChars && buffer.length > 0) {
          chunks.push(buffer.trim());
          buffer = para;
        } else {
          buffer = buffer ? buffer + "\n\n" + para : para;
        }
      }
      if (buffer.trim()) chunks.push(buffer.trim());
    }
  }
  return chunks;
}

export async function ingestAllCorpora(onProgress = null) {
  await initQdrant();

  const outRoot = config.paths.dataCollectionOut;
  if (!fs.existsSync(outRoot)) {
    console.warn(`[Ingest] Documentation directory "${outRoot}" does not exist yet.`);
    return { indexedPages: 0, indexedChunks: 0 };
  }

  const libDirs = fs
    .readdirSync(outRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`[Ingest] Discovered ${libDirs.length} documentation libraries: ${libDirs.join(", ")}`);

  let totalChunks = 0;
  let totalPages = 0;
  const pointsToUpsert = [];

  for (const lib of libDirs) {
    const libDir = path.join(outRoot, lib);
    const manifestPath = path.join(libDir, "manifest.json");
    const pagesDir = path.join(libDir, "pages");

    if (!fs.existsSync(pagesDir)) continue;

    let manifest = null;
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch (e) {}
    }

    const files = fs
      .readdirSync(pagesDir)
      .filter((f) => f.endsWith(".md"));

    console.log(`  -> [${lib}] Processing ${files.length} pages...`);

    for (const file of files) {
      const fullPath = path.join(pagesDir, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      const { meta, body } = parseFrontmatter(raw);

      const title = meta.title || path.basename(file, ".md");
      const url = meta.url || `https://${lib}.docs/`;
      const section = meta.section || "general";
      const topics = meta.topics ? meta.topics.replace(/[[\]]/g, "").split(",").map((s) => s.trim()) : [];

      const chunks = chunkMarkdown(body);
      totalPages++;

      for (let idx = 0; idx < chunks.length; idx++) {
        const chunkText = chunks[idx];
        const pointId = crypto
          .createHash("md5")
          .update(`${lib}:${file}:${idx}`)
          .digest("hex");

        const vector = await getEmbedding(chunkText);

        pointsToUpsert.push({
          id: pointId,
          vector,
          payload: {
            library: lib.toLowerCase(),
            file,
            title,
            url,
            section,
            topics,
            content: chunkText,
            chunkIndex: idx,
            totalChunks: chunks.length,
          },
        });
        totalChunks++;
      }
    }
  }

  console.log(`[Ingest] Upserting ${pointsToUpsert.length} vector points...`);
  await upsertPoints(pointsToUpsert);

  console.log(`[Ingest] Indexing complete! Indexed ${totalPages} pages and ${totalChunks} chunks.`);
  return { indexedPages: totalPages, indexedChunks: totalChunks };
}

// Standalone execution
if (process.argv[1] && process.argv[1].endsWith("ingest.js")) {
  ingestAllCorpora().then(() => {
    console.log("Done.");
    process.exit(0);
  });
}

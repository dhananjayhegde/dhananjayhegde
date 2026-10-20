const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CACHE_VERSION = 6;
const CACHE_PATH = path.join(process.cwd(), ".cache", "table-of-contents.json");

function readCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    return cache.version === CACHE_VERSION && cache.entries
      ? cache
      : { version: CACHE_VERSION, entries: {} };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not read the table of contents cache: ${error.message}`);
    }
    return { version: CACHE_VERSION, entries: {} };
  }
}

const cache = readCache();

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function headingText(html) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function renderItems(items, parentNumber = []) {
  if (!items.length) return "";

  return `<ol>${items
    .map(
      (item, index) => {
        const sectionNumber = [...parentNumber, index + 1];
        return `<li><span class="table-of-contents__number">${sectionNumber.join(
          "."
        )}</span> <a href="#${item.id}">${item.text}</a>${renderItems(
          item.children,
          sectionNumber
        )}</li>`;
      }
    )
    .join("")}</ol>`;
}

function buildTableOfContents(content) {
  const root = { level: 0, children: [] };
  const stack = [root];
  const headingPattern =
    /<h([1-3])\b[^>]*\bid=(["'])(.*?)\2[^>]*>([\s\S]*?)<\/h\1>/gi;

  for (const match of content.matchAll(headingPattern)) {
    const item = {
      level: Number(match[1]),
      id: match[3],
      text: headingText(match[4]),
      children: [],
    };

    while (stack.length > 1 && stack.at(-1).level >= item.level) {
      stack.pop();
    }

    stack.at(-1).children.push(item);
    stack.push(item);
  }

  if (!root.children.length) return "";

  return `<nav class="table-of-contents" aria-labelledby="table-of-contents-heading"><h2 id="table-of-contents-heading">Table of contents</h2>${renderItems(
    root.children
  )}</nav>`;
}

function tableOfContents(content, inputPath = "") {
  const html = String(content);
  const hash = crypto.createHash("sha256").update(html).digest("hex");
  const cacheKey = inputPath || hash;
  const cached = cache.entries[cacheKey];

  if (cached?.hash === hash) return cached.html;

  const toc = buildTableOfContents(html);
  cache.entries[cacheKey] = { hash, html: toc };
  saveCache();
  return toc;
}

module.exports = { buildTableOfContents, tableOfContents };

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DOMParser } from "linkedom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const constantsPath = path.join(root, "js", "constants.js");
const outPath = path.join(root, "js", "labelBarSvgAssets.js");

const TAG_ALIASES = {
  "tag/lion.svg": "lion.svg",
  "tag/tag01.2.svg": "tag01.2.svg",
  "tag/tag02.svg": "tag02.svg",
  "tag/tag03.svg": "tag03.svg",
  "tag/tag04.svg": "tag04.svg",
  "tag/tag05.2.svg": "tag05.2.svg",
};

function readAssetList() {
  const src = fs.readFileSync(constantsPath, "utf8");
  const match = src.match(/var LABEL_BAR_SVG_ASSETS = \[([\s\S]*?)\];/);
  if (!match) throw new Error("LABEL_BAR_SVG_ASSETS not found in constants.js");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function embeddedKeysFor(filename) {
  const keys = new Set([filename]);
  if (TAG_ALIASES[filename]) keys.add(TAG_ALIASES[filename]);
  const slash = filename.lastIndexOf("/");
  if (slash >= 0) {
    const dir = filename.slice(0, slash);
    const base = filename.slice(slash + 1);
    if (dir !== "home") keys.add(base);
  }
  return [...keys];
}

function extractInnerMarkup(markup) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") {
    throw new Error("root element is not <svg>");
  }
  return "\n" + svg.innerHTML + "\n";
}

function escapeJsString(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

const assets = readAssetList();
const embedded = {};
const warnings = [];

for (const filename of assets) {
  const filePath = path.join(root, "svg", filename);
  if (!fs.existsSync(filePath)) {
    warnings.push("missing file: " + filename);
    continue;
  }
  const markup = extractInnerMarkup(fs.readFileSync(filePath, "utf8"));
  for (const key of embeddedKeysFor(filename)) {
    embedded[key] = markup;
  }
}

const lines = [
  "/** Auto-generated embedded label-bar SVG inner markup (works without HTTP server) */",
  "(function () {",
  '  "use strict";',
  "  window.LABEL_BAR_SVG_EMBEDDED = {",
];

const sortedKeys = Object.keys(embedded).sort();
for (const key of sortedKeys) {
  lines.push('  "' + key.replace(/"/g, '\\"') + '": "' + escapeJsString(embedded[key]) + '",');
}

lines.push("  };");
lines.push("})();");
lines.push("");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");

console.log("Wrote " + sortedKeys.length + " embedded keys to " + outPath);
if (warnings.length) {
  console.warn("Warnings:");
  warnings.forEach((w) => console.warn("  " + w));
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const csv = fs.readFileSync(path.join(root, "data/sheet-palette-colors.csv"), "utf8")
  .replace(/\r\n/g, "\n")
  .trim();
const escaped = csv
  .replace(/\\/g, "\\\\")
  .replace(/"/g, '\\"')
  .replace(/\n/g, "\\r\\n");
const out =
  '(function (global) {\n' +
  '  "use strict";\n' +
  '  global.EMBEDDED_PALETTE_CSV_TEXT = "' +
  escaped +
  '";\n' +
  '})(typeof window !== "undefined" ? window : this);\n';
fs.writeFileSync(path.join(root, "js/embeddedPaletteCsv.js"), out);
console.log("Wrote js/embeddedPaletteCsv.js (" + csv.split("\n").length + " lines)");

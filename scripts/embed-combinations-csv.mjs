import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const csv = fs
  .readFileSync(path.join(root, "data/handkerchief-combinations.csv"), "utf8")
  .replace(/^\uFEFF/, "")
  .replace(/\r\n/g, "\n")
  .trim();
const escaped = csv
  .replace(/\\/g, "\\\\")
  .replace(/"/g, '\\"')
  .replace(/\n/g, "\\n");
const out =
  '(function (global) {\n' +
  '  "use strict";\n' +
  '  global.EMBEDDED_COMBINATIONS_CSV_TEXT = "' +
  escaped +
  '";\n' +
  '})(typeof window !== "undefined" ? window : this);\n';
fs.writeFileSync(path.join(root, "js/embeddedCombinationsCsv.js"), out);
console.log(
  "Wrote js/embeddedCombinationsCsv.js (" + csv.split("\n").length + " lines)"
);

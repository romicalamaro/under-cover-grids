import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs");
const outFile = path.join(outDir, "persian-translations-review.docx");

function loadBrowserScript(relativePath, globalKey) {
  const code = fs.readFileSync(path.join(root, relativePath), "utf8");
  const sandbox = { window: {}, global: {} };
  sandbox.global = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window[globalKey] ?? sandbox.global[globalKey];
}

function normEn(text) {
  return String(text).replace(/\s+/g, " ").trim().toLowerCase();
}

/** @typedef {{ en: string, fa: string }} Pair */

/** @param {Pair[]} pairs */
function dedupeByEn(pairs) {
  const seen = new Set();
  /** @type {Pair[]} */
  const out = [];
  for (const pair of pairs) {
    const key = normEn(pair.en);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
  }
  return out;
}

/** @param {Pair[]} pairs @param {Set<string>} exclude */
function dedupeExcluding(pairs, exclude) {
  const seen = new Set(exclude);
  /** @type {Pair[]} */
  const out = [];
  for (const pair of pairs) {
    const key = normEn(pair.en);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
  }
  return out;
}

function buildMadLibLines(lines) {
  return lines
    .map((line) =>
      line
        .map((part) => {
          if (part.t === "text") return part.v;
          if (part.t === "nameMode") return "___";
          if (part.t === "blank") return "___";
          return "";
        })
        .join("")
    )
    .join("\n");
}

/** @returns {Pair[]} */
function collectSitePairs() {
  return [
    { en: "home", fa: "خانه" },
    { en: "signs", fa: "نشانه‌ها" },
    { en: "shop", fa: "فروشگاه" },
    { en: "design", fa: "طراحی" },
    { en: "archive", fa: "بایگانی" },
    {
      en: "Modular fashion textiles expressing solidarity with Iranian women's fight for bodily autonomy.",
      fa: "منسوجات مدولار مُد که همبستگی با مبارزهٔ زنان ایرانی برای خودمختاری بر بدنشان ابراز می‌کند.",
    },
    {
      en: "Under is a modular textile brand that creates adaptable scarves and wraps that express solidarity and support for Iranian women. Its designs are based on a visual sign language that translates emotional states into graphic patterns, giving voice to women for whom Iran is part of their identity.\nAll designs on this website were created by Iranian women living outside Iran.",
      fa: "زیر یک برند منسوجات مدولار است که شال‌ها و پوشش‌هایی خلق می‌کند که همبستگی و حمایت از زنان ایرانی ابراز می‌کند. طراحی‌های آن بر پایهٔ یک زبان اشارهٔ دیداری است که حالات عاطفی را به الگوهای گرافیکی ترجمه می‌کند و به زنانی که ایران بخشی از هویتشان است، صدا می‌دهد.\nهمهٔ طراحی‌های این وب‌سایت توسط زنان ایرانی ساکن خارج از ایران خلق شده‌اند.",
    },
    {
      en: "Design your own textile and join the protest for women's right to their own bodies.",
      fa: "منسوجات خود را طراحی کنید و به اعتراض برای حق زنان بر بدن خود بپیوندید.",
    },
    { en: "Start in Persian", fa: "شروع به فارسی" },
  ];
}


/** @param {Pair[]} out */
function pushPair(out, en, fa) {
  if (!en || fa === undefined) return;
  out.push({ en: String(en), fa: String(fa) });
}

/** UI keys referenced in js/questionnaire.js (excludes dead strings). */
const ACTIVE_UI_KEYS = [
  "yes",
  "no",
  "continue",
  "shuffleLayout",
  "shuffleLayoutAria",
  "submitOrder",
  "savedToArchive",
  "sectionAriaPrefix",
  "feelingsAria",
  "gridAria",
  "familyAria",
  "palettePrefix",
  "initialsPlaceholder",
  "namePlaceholder",
];

/**
 * Step string fields that appear in the live questionnaire UI.
 * Steps omitted here are internal-only or replaced by another UI (e.g. spider chart).
 */
const STEP_UI_FIELDS = {
  livingDuration: ["options", "ariaLabel"],
  leavingYear: ["ariaLabel"],
  from: ["ariaLabel"],
  nowIn: ["ariaLabel"],
  name: ["ariaLabel", "placeholder", "modeAriaLabel"],
  age: ["ariaLabel"],
  homeAt: ["options", "ariaLabel"],
  gridType: ["ariaLabel", "options"],
  octagonsN: ["label", "ariaLabel", "rangeLabels"],
  innerScale: ["label", "ariaLabel", "rangeLabels"],
  closeFamilyInIran: ["label", "ariaLabel", "options"],
  iranLossTypes: ["label", "ariaLabel", "options"],
  fanLeaves: ["label", "ariaLabel", "rangeLabels"],
  hopeMode: ["ariaLabel", "options"],
};

/** @param {Pair[]} out @param {object} enStep @param {object} faStep @param {string} field */
function pushStepField(out, enStep, faStep, field) {
  if (field === "label" && enStep.label) {
    pushPair(out, enStep.label, faStep.label);
  } else if (field === "placeholder" && enStep.placeholder) {
    pushPair(out, enStep.placeholder, faStep.placeholder);
  } else if (field === "ariaLabel" && enStep.ariaLabel) {
    pushPair(out, enStep.ariaLabel, faStep.ariaLabel);
  } else if (field === "modeAriaLabel" && enStep.modeAriaLabel) {
    pushPair(out, enStep.modeAriaLabel, faStep.modeAriaLabel);
  } else if (field === "options" && enStep.options) {
    for (const key of Object.keys(enStep.options)) {
      pushPair(out, enStep.options[key], faStep.options[key]);
    }
  } else if (field === "rangeLabels" && enStep.rangeLabels) {
    enStep.rangeLabels.forEach((label, i) => {
      pushPair(out, label, faStep.rangeLabels[i]);
    });
  }
}

/** @returns {Pair[]} */
function collectQuestionnairePairs(en, fa) {
  /** @type {Pair[]} */
  const pairs = [];

  for (const id of Object.keys(en.sectionLabels)) {
    pushPair(pairs, en.sectionLabels[id].name, fa.sectionLabels[id].name);
  }

  for (const key of ACTIVE_UI_KEYS) {
    pushPair(pairs, en.ui[key], fa.ui[key]);
  }

  pushPair(pairs, en.ui.nameModes.anonymous, fa.ui.nameModes.anonymous);
  pushPair(pairs, en.ui.nameModes.initials, fa.ui.nameModes.initials);
  pushPair(pairs, en.ui.nameModes.name, fa.ui.nameModes.name);

  pushPair(pairs, en.madLibs.ariaLabel, fa.madLibs.ariaLabel);
  pushPair(pairs, buildMadLibLines(en.madLibs.lines), buildMadLibLines(fa.madLibs.lines));

  pushPair(pairs, en.feelings.intro, fa.feelings.intro);
  pushPair(pairs, en.feelings.hopeHeading, fa.feelings.hopeHeading);
  en.feelings.tableRows.forEach((row, i) => {
    pushPair(pairs, row.label, fa.feelings.tableRows[i].label);
  });
  en.feelings.scaleLabels.forEach((label, i) => {
    pushPair(pairs, label, fa.feelings.scaleLabels[i]);
  });

  for (const stepId of Object.keys(STEP_UI_FIELDS)) {
    const enStep = en.steps[stepId];
    const faStep = fa.steps[stepId];
    if (!enStep || !faStep) continue;
    for (const field of STEP_UI_FIELDS[stepId]) {
      pushStepField(pairs, enStep, faStep, field);
    }
  }

  return dedupeByEn(pairs);
}

/** @returns {Pair[]} */
function collectSignsOnlyPairs(catalog, alreadySeen) {
  /** @type {Pair[]} */
  const pairs = [];

  for (const section of catalog.sections) {
    pushPair(pairs, section.description, section.descriptionFa);
  }

  return dedupeExcluding(pairs, alreadySeen);
}

/** Single-line phrases (words, labels, short sentences) go in a table; multi-line text stays as blocks. */
function isShortPair(pair) {
  const en = String(pair.en).trim();
  return en.length > 0 && !en.includes("\n");
}

function enCellParagraph(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
      }),
    ],
  });
}

function faCellParagraph(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.START,
    bidirectional: true,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        rightToLeft: true,
        italics: opts.italics,
        bold: opts.bold,
      }),
    ],
  });
}

function faTableCell(children) {
  return new TableCell({
    borders: TABLE_CELL_BORDERS,
    children,
  });
}

function enTableCell(children) {
  return new TableCell({
    borders: TABLE_CELL_BORDERS,
    children,
  });
}

const TABLE_CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
};

/** @param {Pair[]} pairs */
function pairsTable(pairs) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4500, 4500],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          enTableCell([enCellParagraph("English", { bold: true })]),
          faTableCell([faCellParagraph("Persian", { bold: true })]),
        ],
      }),
      ...pairs.map(
        (pair) =>
          new TableRow({
            children: [
              enTableCell([enCellParagraph(pair.en)]),
              faTableCell([faCellParagraph(pair.fa || "")]),
            ],
          })
      ),
    ],
  });
}

/** @param {import('docx').(Paragraph | Table)[]} children @param {Pair[]} pairs @param {{ value: number }} indexRef */
function appendPairsContent(children, pairs, indexRef) {
  /** @type {Pair[]} */
  let shortBatch = [];

  function flushShortBatch() {
    if (!shortBatch.length) return;
    children.push(pairsTable(shortBatch));
    children.push(enParagraph("", { after: 200 }));
    shortBatch = [];
  }

  for (const pair of pairs) {
    if (isShortPair(pair)) {
      shortBatch.push(pair);
      continue;
    }
    flushShortBatch();
    indexRef.value += 1;
    children.push(...pairBlock(indexRef.value, pair));
  }
  flushShortBatch();
}

function enParagraph(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
      }),
    ],
    spacing: { after: opts.after ?? 100 },
  });
}

function faParagraph(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.START,
    bidirectional: true,
    children: [
      new TextRun({
        text,
        rightToLeft: true,
        italics: opts.italics,
      }),
    ],
    spacing: { after: opts.after ?? 160 },
  });
}

/** @param {number} index @param {Pair} pair */
function pairBlock(index, pair) {
  const blocks = [enParagraph(`${index}. ${pair.en}`)];

  if (pair.fa) {
    blocks.push(faParagraph(pair.fa));
  } else {
    blocks.push(
      enParagraph("[no Persian translation yet]", { italics: true, after: 160 })
    );
  }

  return blocks;
}

function sectionHeading(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text: title, bold: true })],
  });
}

async function main() {
  const strings = loadBrowserScript("js/questionnaireStrings.js", "QuestionnaireStrings");
  const catalog = loadBrowserScript("js/signsCatalog.js", "SignsCatalog");

  const sitePairs = dedupeByEn(collectSitePairs());
  const questionnairePairs = collectQuestionnairePairs(strings.en, strings.fa);
  const seenBeforeSigns = new Set([
    ...sitePairs.map((p) => normEn(p.en)),
    ...questionnairePairs.map((p) => normEn(p.en)),
  ]);
  const signsPairs = collectSignsOnlyPairs(catalog, seenBeforeSigns);

  /** @type {{ title: string, hint?: string, pairs: Pair[] }[]} */
  const sections = [
    {
      title: "Site",
      hint: "Navigation, home page, and design entry screen.",
      pairs: sitePairs,
    },
    {
      title: "Questionnaire",
      hint: "Design questionnaire — questions, answers, buttons, profile sentences (___ = user input).",
      pairs: questionnairePairs,
    },
    {
      title: "Signs glossary",
      hint: "Section descriptions on the Signs page (sign names stay English only).",
      pairs: signsPairs,
    },
  ];

  const today = new Date().toISOString().slice(0, 10);
  let globalIndex = 0;
  const totalUnique =
    sitePairs.length + questionnairePairs.length + signsPairs.length;

  /** @type {(Paragraph | Table)[]} */
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 160 },
      children: [new TextRun({ text: "UNDER — Persian Translation Review", bold: true })],
    }),
    enParagraph(`Generated: ${today}`, { after: 160 }),
    enParagraph(
      "Please review the Persian (FA) translations against the English (EN) source. Short phrases appear in two-column tables; longer multi-line text appears below each section. ___ marks a user-input field, not text to translate.",
      { after: 280 }
    ),
  ];

  const indexRef = { value: 0 };

  for (const section of sections) {
    if (!section.pairs.length) continue;
    children.push(sectionHeading(section.title));
    if (section.hint) {
      children.push(enParagraph(section.hint, { italics: true, after: 200 }));
    }
    appendPairsContent(children, section.pairs, indexRef);
  }

  globalIndex = indexRef.value;

  children.push(
    sectionHeading("Summary"),
    enParagraph(`Total phrases: ${totalUnique}`, { after: 80 })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  fs.mkdirSync(outDir, { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outFile, buffer);

  console.log(
    `Wrote ${outFile} — site: ${sitePairs.length}, questionnaire: ${questionnairePairs.length}, signs-only: ${signsPairs.length}, total: ${totalUnique}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

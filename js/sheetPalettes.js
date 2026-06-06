(function (global) {
  "use strict";

  var SHEET_DOC_ID = "1yMwNB7MopTJWDEH328VF0WiU2XXdPu5Cfs0I1YDyeDQ";
  var SHEET_GID = "790839210";
  var SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/" +
    SHEET_DOC_ID +
    "/export?format=csv&gid=" +
    SHEET_GID;
  var LOCAL_CSV_URL = "data/sheet-palette-colors.csv";

  var PALETTE_KEYS = ["palette1", "palette2", "palette3", "palette4", "palette5", "palette6", "palette7", "palette8"];

  /**
   * טבלת פלטות — חלוקות (עמודת Division ב-CSV). Slots באותה חלוקה = אותו צבע מומלץ.
   * @see data/sheet-palette-colors.csv
   */
  var PALETTE_DIVISIONS = {
    BACKGROUND: { 1: ["A1", "A2"] },
    GRID: { 1: ["B1", "B2"], 2: ["B3"] },
    "BORDER / FRAME": {
      1: ["C1", "C2"],
      2: ["C3", "C4"],
      3: ["C5", "C6"],
      4: ["C7", "C8"],
      5: ["C9"],
      6: ["C10"],
    },
    "FAN — מבנה": { 1: ["D1", "D2", "D3", "D4", "D5"] },
    "FAN — fills": { 1: ["D6", "D7", "D8", "D9", "D10", "D11"] },
    "עיגולים + כוכבים + מחומש": {
      1: ["E1", "E2"],
      2: ["E3", "E4"],
      3: ["E5", "E6"],
      4: ["E7", "E8"],
      5: ["E9", "E10"],
    },
    FEELINGS: {
      1: ["F1"],
      2: ["F2"],
      3: ["F3", "F4"],
      4: ["F5", "F6", "F7"],
      6: ["F8", "F9"],
      7: ["F10"],
      8: ["F11", "F12", "F13"],
      9: ["F14"],
      10: ["F15"],
      11: ["F16"],
      12: ["F17"],
    },
    "LABEL BAR": { 1: ["G1", "G2"], 2: ["G3", "G4"], 3: ["G5"] },
    "COLOR DIVISIONS": {
      1: ["H1"],
      2: ["H2"],
      3: ["H3"],
      4: ["H4"],
      5: ["H5"],
    },
  };

  /** Offline fallback — matches Google Sheet Palette 1 column. */
  var FALLBACK_DEFAULTS = {
    A1: "#fffce8",
    A2: "#fffce8",
    B1: "#ff3c3c",
    B2: "#ff3c3c",
    C1: "#ff3c3c",
    C2: "#685450",
    C3: "#3c06a7",
    C4: "#ff3c3c",
    C5: "#f7cecd",
    C6: "#655551",
    C7: "#655551",
    C8: "#f7cecd",
    C9: "#ff3c3c",
    C10: "#f7cecd",
    D1: "#ff3c3c",
    D2: "#ff3c3c",
    D3: "#ff3c3c",
    D4: "#ff3c3c",
    D5: "#ff3c3c",
    D6: "#685450",
    D7: "#685450",
    D8: "#685450",
    D9: "#685450",
    D10: "#685450",
    D11: "#685450",
    E1: "#685450",
    E2: "#ff3c3c",
    E3: "#ffffff",
    E4: "#ff3c3c",
    E5: "#ffffff",
    E6: "#ff3c3c",
    E7: "#ffffff",
    E8: "#ff3c3c",
    E9: "#685450",
    E10: "#ff3c3c",
    F1: "#3c06a7",
    F2: "#3c06a7",
    F3: "#3c06a7",
    F4: "#ff3c3c",
    F5: "#ff3c3c",
    F6: "#3c06a7",
    F7: "#ff3c3c",
    F8: "#3c06a7",
    F9: "#ff3c3c",
    F10: "#ff3c3c",
    F11: "#ff3c3c",
    F12: "#3c06a7",
    F13: "#3c06a7",
    F14: "#3c06a7",
    F15: "#ff3c3c",
    F16: "#3c06a7",
    F17: "#ff3c3c",
    G1: "#ff3c3c",
    G2: "#ff3c3c",
    G3: "#3c06a7",
    G4: "#3c06a7",
    G5: "#3c06a7",
    H1: "#00ff89",
    H2: "#b2ff00",
    H3: "#00fff9",
    H4: "#000000",
    H5: "#303030",
  };

  /** Mirror palette1 ↔ default so getColor() fallback chain always works. */
  function syncPaletteFallbacks(parsed) {
    var slot;
    for (slot in parsed.palette1) {
      if (!Object.prototype.hasOwnProperty.call(parsed.palette1, slot)) continue;
      if (!parsed.default[slot]) parsed.default[slot] = parsed.palette1[slot];
    }
    for (slot in parsed.default) {
      if (!Object.prototype.hasOwnProperty.call(parsed.default, slot)) continue;
      if (!parsed.palette1[slot]) parsed.palette1[slot] = parsed.default[slot];
    }
    return parsed;
  }

  function emptyPalettes() {
    var base = Object.assign({}, FALLBACK_DEFAULTS);
    return {
      default: Object.assign({}, base),
      palette1: Object.assign({}, base),
      palette2: {},
      palette3: {},
      palette4: {},
      palette5: {},
      palette6: {},
      palette7: {},
      palette8: {},
    };
  }

  function getPopulatedPaletteKeys() {
    var keys = [];
    var i;
    for (i = 0; i < PALETTE_KEYS.length; i++) {
      var key = PALETTE_KEYS[i];
      var palette = palettes[key];
      if (palette && Object.keys(palette).length > 0) keys.push(key);
    }
    return keys.length ? keys : ["palette1"];
  }

  var palettes = emptyPalettes();

  var activePalette = "palette1";
  var loaded = false;
  /** @type {"google"|"local"|"embedded"|null} */
  var lastLoadSource = null;
  var palettesLoadedCallbacks = [];
  /** Incremented on every load so JSONP script URLs stay unique (avoids stale gviz cache). */
  var sheetLoadGeneration = 0;
  var GVIZ_SCRIPT_ATTR = "data-sheet-palette-gviz";
  var ACTIVE_PALETTE_STORAGE_KEY = "undercover.activeSheetPalette";

  function normalizeHex(value) {
    if (!value || typeof value !== "string") return null;
    var v = value.trim();
    if (!v) return null;
    if (v.charAt(0) !== "#") v = "#" + v;
    v = v.toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(v)) {
      return (
        "#" +
        v.charAt(1) +
        v.charAt(1) +
        v.charAt(2) +
        v.charAt(2) +
        v.charAt(3) +
        v.charAt(3)
      );
    }
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    return null;
  }

  function parseCsvLine(line) {
    var fields = [];
    var current = "";
    var inQuotes = false;
    var i;
    for (i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (line.charAt(i + 1) === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  }

  /**
   * RFC-style CSV: quoted fields may contain line breaks (common in Google Sheets export).
   * @returns {string[][]}
   */
  function parseCsvRecords(text) {
    var records = [];
    var fields = [];
    var current = "";
    var inQuotes = false;
    var body = (text || "").replace(/^\uFEFF/, "");
    var i;
    var ch;
    for (i = 0; i < body.length; i++) {
      ch = body.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (body.charAt(i + 1) === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else if (ch === "\r") {
          if (body.charAt(i + 1) === "\n") i++;
          current += "\n";
        } else if (ch === "\n") {
          current += "\n";
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else if (ch === "\r") {
        if (body.charAt(i + 1) === "\n") i++;
        fields.push(current);
        current = "";
        records.push(fields);
        fields = [];
      } else if (ch === "\n") {
        fields.push(current);
        current = "";
        records.push(fields);
        fields = [];
      } else {
        current += ch;
      }
    }
    if (current.length || fields.length) {
      fields.push(current);
      records.push(fields);
    }
    return records;
  }

  function countPaletteColumnsFromHeader(headerCols, paletteStart) {
    var count = 0;
    var ci;
    for (ci = paletteStart; ci < headerCols.length; ci++) {
      var label = (headerCols[ci] || "").trim();
      if (label) count++;
    }
    return count || 1;
  }

  /**
   * Column indices for palette CSV.
   * Supports: Palette 1…N (after Element), legacy Default+Palette 1–5.
   */
  function getPaletteCsvLayout(headerCols) {
    var cols = headerCols || [];
    var header = cols.join(",");
    var hasDivision =
      header.indexOf(",Division,") !== -1 || header.indexOf(",Division,Slot,") !== -1;
    var hasDefault =
      header.indexOf(",Default,") !== -1 ||
      /,Default\s*,/i.test(header) ||
      /,Default\s*$/i.test(header);

    if (hasDivision && hasDefault) {
      var paletteStartWithDefault = 5;
      return {
        hasDivision: true,
        slot: 2,
        default: 4,
        paletteStart: paletteStartWithDefault,
        paletteCount: Math.min(
          countPaletteColumnsFromHeader(cols, paletteStartWithDefault),
          PALETTE_KEYS.length
        ),
      };
    }
    if (hasDivision) {
      var paletteStartDivision = 4;
      return {
        hasDivision: true,
        slot: 2,
        default: -1,
        paletteStart: paletteStartDivision,
        paletteCount: Math.min(
          countPaletteColumnsFromHeader(cols, paletteStartDivision),
          PALETTE_KEYS.length
        ),
      };
    }
    var paletteStartLegacy = 4;
    return {
      hasDivision: false,
      slot: 1,
      default: 3,
      paletteStart: paletteStartLegacy,
      paletteCount: Math.min(
        countPaletteColumnsFromHeader(cols, paletteStartLegacy),
        PALETTE_KEYS.length
      ),
    };
  }

  function isValidPaletteCsvHeader(text) {
    if (!text || text.indexOf("Category,") === -1) return false;
    return (
      text.indexOf(",Slot,") !== -1 || text.indexOf(",Division,Slot,") !== -1
    );
  }

  function parseCsv(text) {
    var records = parseCsvRecords(text);
    if (!records.length) {
      return syncPaletteFallbacks({
        default: {},
        palette1: {},
        palette2: {},
        palette3: {},
        palette4: {},
        palette5: {},
        palette6: {},
        palette7: {},
        palette8: {},
      });
    }
    var layout = getPaletteCsvLayout(records[0]);
    /** Filled only from sheet cells — not pre-seeded from embedded defaults. */
    var result = {
      default: {},
      palette1: {},
      palette2: {},
      palette3: {},
      palette4: {},
      palette5: {},
      palette6: {},
      palette7: {},
      palette8: {},
    };
    var ri;
    for (ri = 1; ri < records.length; ri++) {
      var cols = records[ri];
      if (!cols || !cols.length) continue;
      var slot = (cols[layout.slot] || "").replace(/\r/g, "").trim();
      if (!slot) continue;

      if (layout.default >= 0) {
        var defaultHex = normalizeHex((cols[layout.default] || "").replace(/\r/g, ""));
        if (defaultHex) result.default[slot] = defaultHex;
      }

      var paletteCount = layout.paletteCount || PALETTE_KEYS.length;
      var pi;
      for (pi = 0; pi < paletteCount; pi++) {
        var rawPalette = (cols[layout.paletteStart + pi] || "").replace(/\r/g, "").trim();
        var paletteHex = normalizeHex(rawPalette);
        if (rawPalette && !paletteHex) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn(
              "SheetPalettes: invalid hex for slot " +
                slot +
                " in " +
                PALETTE_KEYS[pi] +
                ': "' +
                rawPalette +
                '" (skipped)'
            );
          }
        }
        if (paletteHex) result[PALETTE_KEYS[pi]][slot] = paletteHex;
      }
    }
    return syncPaletteFallbacks(result);
  }

  function getColor(slotId) {
    var palette = palettes[activePalette] || {};
    return palette[slotId] || palettes.default[slotId] || FALLBACK_DEFAULTS[slotId] || "#000000";
  }

  /** Override palette slot (sidebar pipettes; persists until sheet reload / palette switch). */
  function setSlotColor(slotId, hex) {
    if (!slotId) return false;
    var normalized = normalizeHex(hex);
    if (!normalized) return false;
    if (!palettes.palette1) palettes.palette1 = {};
    if (!palettes.default) palettes.default = {};
    if (!palettes[activePalette]) palettes[activePalette] = {};
    palettes[activePalette][slotId] = normalized;
    palettes.palette1[slotId] = normalized;
    palettes.default[slotId] = normalized;
    syncBorderGlobals();
    return true;
  }

  function rememberActivePalette(key) {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(ACTIVE_PALETTE_STORAGE_KEY, key);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function getRememberedActivePalette() {
    try {
      if (!global.sessionStorage) return null;
      var saved = global.sessionStorage.getItem(ACTIVE_PALETTE_STORAGE_KEY);
      return PALETTE_KEYS.indexOf(saved) !== -1 ? saved : null;
    } catch (e) {
      return null;
    }
  }

  function setActivePalette(key) {
    if (PALETTE_KEYS.indexOf(key) === -1) return false;
    activePalette = key;
    rememberActivePalette(key);
    syncBorderGlobals();
    updatePaletteButtonStates();
    return true;
  }

  function getActivePaletteKey() {
    return activePalette;
  }

  /** Populated sheet palettes (1, 2, 3, …) — toggle and randomize-all. */
  function getPrimarySheetPaletteKeys() {
    var available = getPopulatedPaletteKeys();
    var keys = [];
    var i;
    for (i = 0; i < PALETTE_KEYS.length; i++) {
      var key = PALETTE_KEYS[i];
      if (available.indexOf(key) !== -1) keys.push(key);
    }
    return keys.length ? keys : ["palette1"];
  }

  /** Shuffle palette button: cycle palette1 → palette2 → palette3 → … */
  function toggleSheetPalette() {
    var keys = getPrimarySheetPaletteKeys();
    if (keys.length < 2) {
      setActivePalette(keys[0]);
      return activePalette;
    }
    var idx = keys.indexOf(activePalette);
    var next = idx >= 0 ? (idx + 1) % keys.length : 0;
    setActivePalette(keys[next]);
    return activePalette;
  }

  /** Random choice among loaded sheet palettes (e.g. randomize-all controls). */
  function pickRandomPalette() {
    var keys = getPrimarySheetPaletteKeys();
    if (keys.length < 2) {
      setActivePalette(keys[0]);
      return activePalette;
    }
    var index = Math.floor(Math.random() * keys.length);
    setActivePalette(keys[index]);
    return activePalette;
  }

  function syncBorderGlobals() {
    if (typeof global.BORDER_SIDE_X_FILL_TOP === "undefined") return;
    try {
      global.BORDER_SIDE_BLUE_X_FILL_TOP = getColor("C1");
      global.BORDER_SIDE_BLUE_X_FILL_BOTTOM = getColor("C1");
      global.BORDER_SIDE_BLUE_X_FILL_LEFT = getColor("C2");
      global.BORDER_SIDE_BLUE_X_FILL_RIGHT = getColor("C2");
      global.BORDER_SIDE_X_FILL_TOP = getColor("C3");
      global.BORDER_SIDE_X_FILL_BOTTOM = getColor("C3");
      global.BORDER_SIDE_X_FILL_LEFT = getColor("C4");
      global.BORDER_SIDE_X_FILL_RIGHT = getColor("C4");
      global.BORDER_SIDE_CELL_COLOR_GREY = getColor("C5");
      global.BORDER_SIDE_CELL_COLOR_BEIGE = getColor("C6");
      global.AUTO_MERGE_OUTLINE_COLOR = getColor("F6");
      global.AUTO_MERGE_SHADOW_COLOR = getColor("F7");
      global.CANVAS_EDGE_SERIAL_FILL = getColor("G5");
      global.BROWN_BAR_BANNER_FILL = getColor("G4");
      global.LABEL_BAR_AGE_OVERLAY_FILL = getColor("G4");
      global.LABEL_BAR_SYMBOL_SEPARATOR_FILL = getColor("G4");
      global.LABEL_BAR_ICON_FILL = getColor("G4");
    } catch (e) {
      /* ignore */
    }
  }

  function formatPaletteKeyLabel(key) {
    var match = key && key.match(/^palette(\d+)$/);
    return match ? "Palette " + match[1] : key || "—";
  }

  function updateActivePaletteLabel() {
    var label = document.getElementById("sheet-palette-active-label");
    if (!label) return;
    label.textContent = formatPaletteKeyLabel(activePalette);
  }

  function updatePaletteButtonStates() {
    var container = document.getElementById("sheet-palette-buttons");
    if (!container) return;
    var buttons = container.querySelectorAll("[data-palette-key]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var isActive = btn.getAttribute("data-palette-key") === activePalette;
      btn.classList.toggle("sidebar__palette-btn--active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
    updateActivePaletteLabel();
  }

  function notifyPalettesLoaded() {
    var i;
    for (i = 0; i < palettesLoadedCallbacks.length; i++) {
      try {
        palettesLoadedCallbacks[i](palettes, lastLoadSource);
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("SheetPalettes: onLoaded callback failed.", e);
        }
      }
    }
  }

  /** Fill empty palette slots in `into` from `from` (never overwrites existing hex). */
  function mergePaletteGaps(into, from) {
    if (!into || !from) return into;
    var pi;
    var key;
    var slot;
    for (pi = 0; pi < PALETTE_KEYS.length; pi++) {
      key = PALETTE_KEYS[pi];
      if (!from[key]) continue;
      if (!into[key]) into[key] = {};
      for (slot in from[key]) {
        if (!Object.prototype.hasOwnProperty.call(from[key], slot)) continue;
        if (!into[key][slot]) into[key][slot] = from[key][slot];
      }
    }
    if (from.default) {
      if (!into.default) into.default = {};
      for (slot in from.default) {
        if (!Object.prototype.hasOwnProperty.call(from.default, slot)) continue;
        if (!into.default[slot]) into.default[slot] = from.default[slot];
      }
    }
    return syncPaletteFallbacks(into);
  }

  function countMissingPaletteSlots(parsed, paletteKey) {
    var palette = (parsed && parsed[paletteKey]) || {};
    var reference = (parsed && parsed.palette1) || {};
    var missing = [];
    var slot;
    for (slot in reference) {
      if (!Object.prototype.hasOwnProperty.call(reference, slot)) continue;
      if (!palette[slot]) missing.push(slot);
    }
    return missing;
  }

  function warnIfPaletteIncomplete(parsed) {
    if (typeof console === "undefined" || !console.warn) return;
    var missing8 = countMissingPaletteSlots(parsed, "palette8");
    if (missing8.length) {
      console.warn(
        "SheetPalettes: palette8 is incomplete (" +
          missing8.length +
          " missing slots). Canvas may show palette1 fallbacks for: " +
          missing8.slice(0, 12).join(", ") +
          (missing8.length > 12 ? "…" : "")
      );
    }
  }

  function getEmbeddedLocalPaletteCsvText() {
    if (
      global.EMBEDDED_PALETTE_CSV_TEXT &&
      typeof global.EMBEDDED_PALETTE_CSV_TEXT === "string" &&
      global.EMBEDDED_PALETTE_CSV_TEXT.length
    ) {
      return global.EMBEDDED_PALETTE_CSV_TEXT;
    }
    return null;
  }

  /** file:// blocks fetch(); fall back to js/embeddedPaletteCsv.js when needed. */
  function resolveLocalPaletteCsvText() {
    return fetchLocalCsv()
      .catch(function (fetchErr) {
        var embedded = getEmbeddedLocalPaletteCsvText();
        if (embedded) return embedded;
        throw fetchErr;
      });
  }

  function finalizeParsedPalettes(parsed, sourceKey, sourceLabel) {
    return resolveLocalPaletteCsvText()
      .then(function (localText) {
        var localParsed = tryParsePaletteCsv(localText);
        var usedEmbedded = localText === getEmbeddedLocalPaletteCsvText();
        if (localParsed) {
          mergePaletteGaps(parsed, localParsed);
          if (sourceKey === "google") {
            sourceLabel += usedEmbedded ? " + embedded gaps" : " + local gaps";
          }
        }
        warnIfPaletteIncomplete(parsed);
        return applyParsedPaletteData(parsed, sourceKey, sourceLabel);
      })
      .catch(function (resolveErr) {
        var embedded = getEmbeddedLocalPaletteCsvText();
        var embeddedParsed = embedded ? tryParsePaletteCsv(embedded) : null;
        if (embeddedParsed) {
          mergePaletteGaps(parsed, embeddedParsed);
          if (sourceKey === "google") {
            sourceLabel += " + embedded gaps (fetch failed)";
          }
        }
        warnIfPaletteIncomplete(parsed);
        return applyParsedPaletteData(parsed, sourceKey, sourceLabel);
      });
  }

  function applyParsedPaletteData(parsed, sourceKey, sourceLabel) {
    palettes = syncPaletteFallbacks(parsed || emptyPalettes());
    loaded = true;
    lastLoadSource = sourceKey;
    syncBorderGlobals();
    if (typeof console !== "undefined" && console.info) {
      console.info("SheetPalettes: colors loaded from " + sourceLabel + ".");
    }
    notifyPalettesLoaded();
    return palettes;
  }

  function applyParsedPalettes(text, sourceKey, sourceLabel) {
    if (!text || !isValidPaletteCsvHeader(text)) {
      throw new Error("Invalid CSV response");
    }
    return applyParsedPaletteData(parseCsv(text), sourceKey, sourceLabel);
  }

  function tryParsePaletteCsv(text) {
    if (!text || !isValidPaletteCsvHeader(text)) return null;
    try {
      return parseCsv(text);
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("SheetPalettes: palette CSV parse failed.", e);
      }
      return null;
    }
  }

  /**
   * Google gviz JSONP often omits Palette 8 text cells; CSV export is complete.
   * Merge every available source so empty slots do not fall back to palette 1.
   */
  function loadParsedPalettesFromGoogleSources() {
    return Promise.allSettled([
      fetchGoogleSheetViaGviz(),
      fetchGoogleSheetCsv(),
    ]).then(function (results) {
      var gvizText =
        results[0].status === "fulfilled" ? results[0].value : null;
      var csvText =
        results[1].status === "fulfilled" ? results[1].value : null;
      var gvizParsed = tryParsePaletteCsv(gvizText);
      var csvParsed = tryParsePaletteCsv(csvText);
      var merged = null;
      var sourceLabel = "Google Sheet";

      if (csvParsed) {
        merged = csvParsed;
        sourceLabel = gvizParsed
          ? "Google Sheet (csv primary)"
          : "Google Sheet (csv)";
      } else if (gvizParsed) {
        merged = gvizParsed;
        sourceLabel = "Google Sheet (gviz)";
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "SheetPalettes: CSV export failed; palette8 may be incomplete until local CSV fills gaps."
          );
        }
      }

      if (!merged) {
        throw new Error("Google Sheet palette data unavailable");
      }

      return finalizeParsedPalettes(merged, "google", sourceLabel);
    });
  }

  function gvizCellValue(cell) {
    if (!cell || cell.v == null || cell.v === "") return "";
    return String(cell.v);
  }

  function escapeCsvField(value) {
    if (!value) return "";
    if (value.indexOf(",") >= 0 || value.indexOf('"') >= 0 || value.indexOf("\n") >= 0) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /** Build CSV text from Google Visualization API JSON (same shape as export?format=csv). */
  function gvizResponseToCsv(response) {
    if (!response || response.status !== "ok" || !response.table || !response.table.rows) {
      throw new Error("Invalid Google Sheet gviz response");
    }
    var tableCols = response.table.cols || [];
    var colCount = tableCols.length || 5;
    var headerParts = [];
    var hi;
    for (hi = 0; hi < colCount; hi++) {
      var label = tableCols[hi] && tableCols[hi].label;
      headerParts.push(escapeCsvField(label != null ? String(label) : ""));
    }
    var lines = [headerParts.join(",")];
    var rows = response.table.rows;
    var ri;
    for (ri = 0; ri < rows.length; ri++) {
      var cells = rows[ri].c || [];
      var cols = [];
      var ci;
      for (ci = 0; ci < colCount; ci++) {
        cols.push(escapeCsvField(gvizCellValue(cells[ci])));
      }
      lines.push(cols.join(","));
    }
    return lines.join("\n");
  }

  function getGoogleSheetGvizUrl(generation) {
    return (
      "https://docs.google.com/spreadsheets/d/" +
      SHEET_DOC_ID +
      "/gviz/tq?tqx=out:json&headers=1&gid=" +
      SHEET_GID +
      "&_=" +
      Date.now() +
      "." +
      generation
    );
  }

  function removeStaleGvizScripts() {
    var stale = document.querySelectorAll("script[" + GVIZ_SCRIPT_ATTR + "]");
    var i;
    for (i = 0; i < stale.length; i++) {
      if (stale[i].parentNode) stale[i].parentNode.removeChild(stale[i]);
    }
  }

  function isFileProtocol() {
    try {
      return !!(global.location && global.location.protocol === "file:");
    } catch (e) {
      return false;
    }
  }

  /**
   * JSONP via gviz — works when opening index.html as file:// (fetch CSV is often blocked).
   */
  function fetchGoogleSheetViaGviz() {
    return new Promise(function (resolve, reject) {
      var generation = sheetLoadGeneration;
      var timeoutMs = 20000;
      var timeoutId = setTimeout(function () {
        restoreGvizHandler();
        reject(new Error("Google Sheet gviz timeout"));
      }, timeoutMs);

      var previousSetResponse = null;
      if (
        global.google &&
        global.google.visualization &&
        global.google.visualization.Query
      ) {
        previousSetResponse = global.google.visualization.Query.setResponse;
      } else {
        if (!global.google) global.google = {};
        if (!global.google.visualization) global.google.visualization = {};
        if (!global.google.visualization.Query) global.google.visualization.Query = {};
      }

      function restoreGvizHandler() {
        clearTimeout(timeoutId);
        if (
          global.google &&
          global.google.visualization &&
          global.google.visualization.Query
        ) {
          if (previousSetResponse) {
            global.google.visualization.Query.setResponse = previousSetResponse;
          }
        }
      }

      global.google.visualization.Query.setResponse = function (response) {
        if (generation !== sheetLoadGeneration) return;
        restoreGvizHandler();
        if (previousSetResponse) {
          try {
            previousSetResponse.call(global.google.visualization.Query, response);
          } catch (ignore) {
            /* ignore chained handler errors */
          }
        }
        try {
          resolve(gvizResponseToCsv(response));
        } catch (e) {
          reject(e);
        }
      };

      removeStaleGvizScripts();
      var script = document.createElement("script");
      script.setAttribute(GVIZ_SCRIPT_ATTR, "1");
      script.onerror = function () {
        if (generation !== sheetLoadGeneration) return;
        restoreGvizHandler();
        reject(new Error("Google Sheet gviz script failed"));
      };
      script.src = getGoogleSheetGvizUrl(generation);
      (document.head || document.documentElement).appendChild(script);
    });
  }

  /** Fresh Google Sheets export URL on every call (avoids browser/CDN cache). */
  function getGoogleSheetCsvUrl() {
    var sep = SHEET_CSV_URL.indexOf("?") >= 0 ? "&" : "?";
    return SHEET_CSV_URL + sep + "_=" + Date.now();
  }

  function fetchNoCache(url) {
    return fetch(url, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  }

  function fetchGoogleSheetCsv() {
    return fetchNoCache(getGoogleSheetCsvUrl()).then(function (response) {
      if (!response.ok) {
        throw new Error("Google Sheet CSV fetch failed (" + response.status + ")");
      }
      return response.text();
    });
  }

  function fetchLocalCsv() {
    var url =
      LOCAL_CSV_URL +
      (LOCAL_CSV_URL.indexOf("?") >= 0 ? "&" : "?") +
      "_=" +
      Date.now();
    return fetchNoCache(url).then(function (response) {
      if (!response.ok) {
        throw new Error("Local CSV fetch failed (" + response.status + ")");
      }
      return response.text();
    });
  }

  function loadFromGoogleSheet() {
    return loadParsedPalettesFromGoogleSources();
  }

  /**
   * Loads palette colors on every page load/refresh. Primary source: Google Sheet.
   */
  function loadSheetPalettes() {
    sheetLoadGeneration += 1;
    palettes = emptyPalettes();
    loaded = false;
    return loadFromGoogleSheet()
      .catch(function (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "SheetPalettes: Google Sheet unavailable; trying local data/sheet-palette-colors.csv.",
            err
          );
        }
        return resolveLocalPaletteCsvText()
          .then(function (text) {
            var label = getEmbeddedLocalPaletteCsvText() === text
              ? "embedded palette CSV (offline fallback)"
              : "data/sheet-palette-colors.csv (offline fallback)";
            return applyParsedPalettes(text, "local", label);
          })
          .catch(function (localErr) {
            if (typeof console !== "undefined" && console.warn) {
              console.warn(
                "SheetPalettes: using embedded defaults (no sheet access).",
                localErr
              );
            }
            palettes = emptyPalettes();
            loaded = true;
            lastLoadSource = "embedded";
            syncBorderGlobals();
            notifyPalettesLoaded();
            return palettes;
          });
      });
  }

  function onPalettesLoaded(callback) {
    if (typeof callback !== "function") return;
    palettesLoadedCallbacks.push(callback);
    if (loaded) {
      try {
        callback(palettes, lastLoadSource);
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("SheetPalettes: onLoaded callback failed.", e);
        }
      }
    }
  }

  global.SheetPalettes = {
    PALETTE_DIVISIONS: PALETTE_DIVISIONS,
    loadSheetPalettes: loadSheetPalettes,
    reloadSheetPalettes: loadSheetPalettes,
    onPalettesLoaded: onPalettesLoaded,
    getColor: getColor,
    setSlotColor: setSlotColor,
    setActivePalette: setActivePalette,
    getActivePaletteKey: getActivePaletteKey,
    getRememberedActivePalette: getRememberedActivePalette,
    toggleSheetPalette: toggleSheetPalette,
    pickRandomPalette: pickRandomPalette,
    syncBorderGlobals: syncBorderGlobals,
    updatePaletteButtonStates: updatePaletteButtonStates,
    get isLoaded() {
      return loaded;
    },
    get lastLoadSource() {
      return lastLoadSource;
    },
    get palettes() {
      return palettes;
    },
  };

  global.getColor = getColor;
})(typeof window !== "undefined" ? window : this);

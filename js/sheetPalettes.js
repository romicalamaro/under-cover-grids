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
  /** Local proxy (npm run serve) — Palette 8–12 need full Google CSV; file:// blocks direct fetch. */
  var SHEET_CSV_PROXY_URL = "http://127.0.0.1:8080/api/google-sheet-palette.csv";

  var PALETTE_KEYS = [
    "palette1",
    "palette2",
    "palette3",
    "palette4",
    "palette5",
    "palette6",
    "palette7",
    "palette8",
    "palette9",
    "palette10",
    "palette11",
    "palette12",
  ];
  /** gviz returns these columns as numbers — hex text is null; load only from CSV export. */
  var GVIZ_CSV_ONLY_PALETTE_KEYS = [
    "palette8",
    "palette9",
    "palette10",
    "palette11",
    "palette12",
  ];

  /**
   * טבלת פלטות — חלוקות (עמודת Division ב-CSV). Slots באותה חלוקה = אותו צבע מומלץ.
   * @see data/sheet-palette-colors.csv
   */
  var PALETTE_DIVISIONS = {
    BACKGROUND: { 1: ["A1", "A2", "A3"] },
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
    A3: "#685450",
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
      palette9: {},
      palette10: {},
      palette11: {},
      palette12: {},
    };
  }

  function cloneParsedPalettes(parsed) {
    if (!parsed) return null;
    var copy = emptyPalettes();
    applyAuthoritativePaletteSlots(copy, parsed);
    if (parsed.default) {
      copy.default = Object.assign({}, parsed.default);
    }
    return syncPaletteFallbacks(copy);
  }

  /** Snapshot current in-memory palettes for live overlay updates. */
  function copyPalettesState() {
    var copy = {
      default: Object.assign({}, palettes.default || {}),
      palette1: Object.assign({}, palettes.palette1 || {}),
      palette2: Object.assign({}, palettes.palette2 || {}),
      palette3: Object.assign({}, palettes.palette3 || {}),
      palette4: Object.assign({}, palettes.palette4 || {}),
      palette5: Object.assign({}, palettes.palette5 || {}),
      palette6: Object.assign({}, palettes.palette6 || {}),
      palette7: Object.assign({}, palettes.palette7 || {}),
      palette8: Object.assign({}, palettes.palette8 || {}),
      palette9: Object.assign({}, palettes.palette9 || {}),
      palette10: Object.assign({}, palettes.palette10 || {}),
      palette11: Object.assign({}, palettes.palette11 || {}),
      palette12: Object.assign({}, palettes.palette12 || {}),
    };
    return syncPaletteFallbacks(copy);
  }

  function csvOnlyPaletteIsEmpty(key) {
    return !palettes[key] || !Object.keys(palettes[key]).length;
  }

  /**
   * Palette 8–12 need CSV export (gviz omits hex text). Fill from embedded/local authority.
   * @param {{ force?: boolean }} [options]
   */
  function ensureCsvOnlyPalettesFromAuthority(options) {
    options = options || {};
    if (!loaded) return;
    var ki;
    var needs = !!options.force || isFileProtocol();
    if (!needs) {
      for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
        if (csvOnlyPaletteIsEmpty(GVIZ_CSV_ONLY_PALETTE_KEYS[ki])) {
          needs = true;
          break;
        }
        if (countMissingPaletteSlots(palettes, GVIZ_CSV_ONLY_PALETTE_KEYS[ki]).length) {
          needs = true;
          break;
        }
      }
    }
    if (!needs) return;
    var embedded = getEmbeddedLocalPaletteCsvText();
    var parsed = embedded ? tryParsePaletteCsv(embedded) : null;
    if (parsed) {
      applyCsvOnlyPaletteAuthorityToPalettes(parsed, options);
      return;
    }
    resolveLocalPaletteCsvText()
      .then(function (text) {
        var localParsed = tryParsePaletteCsv(text);
        if (localParsed) applyCsvOnlyPaletteAuthorityToPalettes(localParsed, options);
      })
      .catch(function () {
        /* ignore — embedded/local unavailable */
      });
  }

  /** @deprecated alias */
  function hydrateCsvOnlyPalettesIfNeeded() {
    ensureCsvOnlyPalettesFromAuthority();
  }

  function refreshCsvOnlyPalettesFromGoogle() {
    if (isFileProtocol()) {
      ensureCsvOnlyPalettesFromAuthority({ force: true });
      syncBorderGlobals();
      return Promise.resolve(palettes);
    }
    return fetchGoogleSheetCsv()
      .then(function (text) {
        var parsed = tryParsePaletteCsv(text);
        if (parsed) fillCsvOnlyPaletteGapsFromAuthority(palettes, parsed);
        return palettes;
      })
      .catch(function () {
        ensureCsvOnlyPalettesFromAuthority({ force: true });
        return palettes;
      });
  }

  function getPopulatedPaletteKeys() {
    hydrateCsvOnlyPalettesIfNeeded();
    var keys = [];
    var i;
    var sheetReady =
      palettes.palette1 && Object.keys(palettes.palette1).length > 0;
    for (i = 0; i < PALETTE_KEYS.length; i++) {
      var key = PALETTE_KEYS[i];
      var palette = palettes[key];
      if (palette && Object.keys(palette).length > 0) {
        keys.push(key);
        continue;
      }
      if (
        sheetReady &&
        GVIZ_CSV_ONLY_PALETTE_KEYS.indexOf(key) !== -1
      ) {
        keys.push(key);
      }
    }
    return keys.length ? keys : ["palette1"];
  }

  var palettes = emptyPalettes();

  function getDefaultSheetPaletteKey() {
    var n =
      typeof DEFAULT_SHEET_PALETTE_NUM !== "undefined"
        ? Number(DEFAULT_SHEET_PALETTE_NUM)
        : 3;
    if (!Number.isFinite(n) || n < 1 || n > PALETTE_KEYS.length) n = 3;
    return "palette" + n;
  }

  var activePalette = getDefaultSheetPaletteKey();
  var loaded = false;
  /** @type {"google"|"local"|"embedded"|null} */
  var lastLoadSource = null;
  var palettesLoadedCallbacks = [];
  /** Incremented on full reload to cancel stale in-flight gviz JSONP requests. */
  var sheetLoadGeneration = 0;
  var GVIZ_SCRIPT_ATTR = "data-sheet-palette-gviz";
  /** Fingerprint of last applied sheet data — skip UI refresh when unchanged. */
  var lastPaletteFingerprint = null;
  /** Google gviz `sig` changes when the sheet is edited — used for live sync. */
  var lastGvizSig = null;
  var lastGoogleLiveRawKey = null;
  var liveSyncTimerId = null;
  var liveSyncIntervalMs = 1500;
  var liveSyncPollInFlight = false;
  var lastLiveSyncAt = null;

  function normalizeHex(value) {
    if (value == null || value === "") return null;
    var v = String(value).trim();
    if (!v) return null;
    /** gviz returns numeric hex cells as floats, e.g. 685450.0 */
    if (/^\d+(\.0+)?$/.test(v)) {
      v = v.split(".")[0];
    }
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
        palette9: {},
        palette10: {},
        palette11: {},
        palette12: {},
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
      palette9: {},
      palette10: {},
      palette11: {},
      palette12: {},
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
    if (palette[slotId]) return palette[slotId];
    /** `default` mirrors palette1 — only use that fallback for palette1 itself. */
    if (activePalette === "palette1" && palettes.default[slotId]) {
      return palettes.default[slotId];
    }
    return FALLBACK_DEFAULTS[slotId] || "#000000";
  }

  /** Slot order A1…H5 — matches CSV row order for stable gradient sequencing. */
  function getPaletteSlotOrder() {
    return Object.keys(FALLBACK_DEFAULTS);
  }

  function getSlotColorForPalette(paletteKey, slotId) {
    var palette = palettes[paletteKey] || {};
    if (palette[slotId]) return palette[slotId];
    if (paletteKey === "palette1" && palettes.default && palettes.default[slotId]) {
      return palettes.default[slotId];
    }
    return FALLBACK_DEFAULTS[slotId] || null;
  }

  /** Unique hex colors for one palette (deduped, first-seen slot order). */
  function getUniquePaletteColors(paletteKey) {
    if (PALETTE_KEYS.indexOf(paletteKey) === -1) return [];
    var seen = {};
    var result = [];
    var slots = getPaletteSlotOrder();
    var i;
    for (i = 0; i < slots.length; i++) {
      var hex = normalizeHex(getSlotColorForPalette(paletteKey, slots[i]));
      if (hex && !seen[hex]) {
        seen[hex] = true;
        result.push(hex);
      }
    }
    return result;
  }

  /** Neutrals excluded from optional swatch colors (not A1/G4 required slots). */
  var PROMINENT_EXCLUDED_NEUTRALS = {
    "#000000": true,
    "#303030": true,
    "#ffffff": true,
    "#d9d9d9": true,
    "#685450": true,
    "#655551": true,
    "#fffce8": true,
    "#fffce9": true,
    "#f7cecd": true,
    "#ffebf0": true,
  };

  var PROMINENT_BACKGROUND_SLOT = "A1";
  var PROMINENT_LABEL_SLOT = "G4";
  var PROMINENT_FEELING_SLOTS = [
    "F2",
    "F3",
    "F5",
    "F7",
    "F8",
    "F11",
    "F12",
    "F15",
    "F1",
    "F4",
    "F6",
    "F10",
    "F13",
    "F14",
    "F16",
    "F17",
  ];
  var PROMINENT_MAX_COLORS = 5;

  function isProminentExcludedNeutral(hex) {
    var normalized = normalizeHex(hex);
    return !!(normalized && PROMINENT_EXCLUDED_NEUTRALS[normalized]);
  }

  /**
   * 3–5 colors for palette preview circles: always background (A1), label (G4),
   * and one feeling marker; extras skip black/gray/white/beige neutrals.
   */
  function getProminentPaletteColors(paletteKey) {
    if (PALETTE_KEYS.indexOf(paletteKey) === -1) return [];
    var seen = {};
    var result = [];
    var slots = getPaletteSlotOrder();
    var i;
    var fi;
    var hex;

    function addColor(value, allowNeutral) {
      hex = normalizeHex(value);
      if (!hex || seen[hex]) return;
      if (!allowNeutral && isProminentExcludedNeutral(hex)) return;
      seen[hex] = true;
      result.push(hex);
    }

    addColor(getSlotColorForPalette(paletteKey, PROMINENT_BACKGROUND_SLOT), true);
    addColor(getSlotColorForPalette(paletteKey, PROMINENT_LABEL_SLOT), true);

    for (fi = 0; fi < PROMINENT_FEELING_SLOTS.length; fi++) {
      hex = normalizeHex(
        getSlotColorForPalette(paletteKey, PROMINENT_FEELING_SLOTS[fi])
      );
      if (hex && !isProminentExcludedNeutral(hex)) {
        addColor(hex, false);
        break;
      }
    }

    for (i = 0; i < slots.length && result.length < PROMINENT_MAX_COLORS; i++) {
      var slot = slots[i];
      if (
        slot === PROMINENT_BACKGROUND_SLOT ||
        slot === PROMINENT_LABEL_SLOT ||
        slot.charAt(0) === "F"
      ) {
        continue;
      }
      addColor(getSlotColorForPalette(paletteKey, slot), false);
    }

    if (result.length < 3) {
      for (fi = 0; fi < PROMINENT_FEELING_SLOTS.length; fi++) {
        addColor(
          getSlotColorForPalette(paletteKey, PROMINENT_FEELING_SLOTS[fi]),
          true
        );
        if (result.length >= 3) break;
      }
    }
    if (result.length < 3) {
      for (i = 0; i < slots.length && result.length < 3; i++) {
        addColor(getSlotColorForPalette(paletteKey, slots[i]), true);
      }
    }

    return result.slice(0, PROMINENT_MAX_COLORS);
  }

  /** Soft mesh positions — organic spread like blurred color blobs in a circle. */
  var PALETTE_MESH_POSITIONS = [
    [28, 22],
    [76, 34],
    [48, 84],
    [14, 58],
    [86, 68],
  ];

  /** Overlapping radial layers for soft color mixing (pair with CSS blur on swatch). */
  function getPaletteMeshGradient(paletteKey, options) {
    var colors = getProminentPaletteColors(paletteKey);
    if (!colors.length) return "#cccccc";
    if (colors.length === 1) return colors[0];
    var opaque = options && options.opaque;
    var baseColor = colors[0];
    var layers = [];
    var i;
    for (i = 0; i < colors.length; i++) {
      var pos = PALETTE_MESH_POSITIONS[i % PALETTE_MESH_POSITIONS.length];
      layers.push(
        "radial-gradient(circle at " +
          pos[0] +
          "% " +
          pos[1] +
          "%, " +
          colors[i] +
          " 0%, " +
          colors[i] +
          " 42%, " +
          (opaque ? baseColor : "transparent") +
          " 72%)"
      );
    }
    return layers.join(", ");
  }

  /** @deprecated alias — questionnaire swatches use mesh blur, not conic wedges. */
  function getPaletteConicGradient(paletteKey) {
    return getPaletteMeshGradient(paletteKey);
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

  function setActivePalette(key) {
    if (PALETTE_KEYS.indexOf(key) === -1) return false;
    activePalette = key;
    syncBorderGlobals();
    updatePaletteButtonStates();
    if (GVIZ_CSV_ONLY_PALETTE_KEYS.indexOf(key) !== -1) {
      ensureCsvOnlyPalettesFromAuthority({ force: isFileProtocol() });
      refreshCsvOnlyPalettesFromGoogle().then(function () {
        syncBorderGlobals();
        notifyPalettesLoaded();
      });
    }
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

  /** Overwrite matching slots in `into` with authoritative google CSV values. */
  function applyAuthoritativePaletteSlots(into, authority) {
    if (!into || !authority) return into;
    var pi;
    var key;
    var slot;
    for (pi = 0; pi < PALETTE_KEYS.length; pi++) {
      key = PALETTE_KEYS[pi];
      if (!authority[key]) continue;
      if (!into[key]) into[key] = {};
      for (slot in authority[key]) {
        if (!Object.prototype.hasOwnProperty.call(authority[key], slot)) continue;
        into[key][slot] = authority[key][slot];
      }
    }
    return syncPaletteFallbacks(into);
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

  /** Palettes 8–12 from CSV export — gviz omits text hex when sheet columns are numeric. */
  function supplementCsvOnlyPalettesFromAuthority(merged, authority) {
    if (!merged || !authority) return merged;
    var patch = {};
    var ki;
    var key;
    var hasPatch = false;
    for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
      key = GVIZ_CSV_ONLY_PALETTE_KEYS[ki];
      if (!authority[key]) continue;
      patch[key] = authority[key];
      hasPatch = true;
    }
    if (!hasPatch) return merged;
    applyAuthoritativePaletteSlots(merged, patch);
    return merged;
  }

  /** Live sync: fill empty 8–12 slots only — never overwrite fresh gviz values with stale CSV/embedded. */
  function fillCsvOnlyPaletteGapsFromAuthority(into, authority) {
    if (!into || !authority) return into;
    var ki;
    var key;
    var slot;
    for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
      key = GVIZ_CSV_ONLY_PALETTE_KEYS[ki];
      if (!authority[key]) continue;
      if (!into[key]) into[key] = {};
      for (slot in authority[key]) {
        if (!Object.prototype.hasOwnProperty.call(authority[key], slot)) continue;
        if (!into[key][slot]) into[key][slot] = authority[key][slot];
      }
    }
    return syncPaletteFallbacks(into);
  }

  function applyCsvOnlyPaletteAuthorityToPalettes(authority, options) {
    options = options || {};
    var ki;
    var key;
    var patch;
    for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
      key = GVIZ_CSV_ONLY_PALETTE_KEYS[ki];
      if (!authority[key]) continue;
      patch = {};
      patch[key] = authority[key];
      if (csvOnlyPaletteIsEmpty(key) || options.force) {
        supplementCsvOnlyPalettesFromAuthority(palettes, patch);
      } else {
        fillCsvOnlyPaletteGapsFromAuthority(palettes, patch);
      }
    }
  }

  /**
   * Palette 8–12 in Google columns L–P often lag — embedded/local CSV wins.
   * Keeps csv-only palettes in sync after `npm run embed:palette-csv` without waiting on the sheet.
   */
  function overlayEmbeddedCsvOnlyPalettesAuthority(into) {
    if (!into) return into;
    var embedded = getEmbeddedLocalPaletteCsvText();
    var parsed = embedded ? tryParsePaletteCsv(embedded) : null;
    if (!parsed) return into;
    var patch = {};
    var ki;
    var key;
    var hasPatch = false;
    for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
      key = GVIZ_CSV_ONLY_PALETTE_KEYS[ki];
      if (!parsed[key] || !Object.keys(parsed[key]).length) continue;
      patch[key] = parsed[key];
      hasPatch = true;
    }
    if (!hasPatch) return into;
    applyAuthoritativePaletteSlots(into, patch);
    return into;
  }

  function csvOnlyPalettesNeedFill(merged) {
    var ki;
    for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
      if (countMissingPaletteSlots(merged, GVIZ_CSV_ONLY_PALETTE_KEYS[ki]).length) {
        return true;
      }
    }
    return false;
  }

  function resolveCsvOnlyPalettesAuthority(merged, csvParsed, options) {
    options = options || {};
    if (!merged) return Promise.resolve(merged);
    if (csvParsed) {
      if (options.livePoll) {
        return Promise.resolve(fillCsvOnlyPaletteGapsFromAuthority(merged, csvParsed));
      }
      return Promise.resolve(supplementCsvOnlyPalettesFromAuthority(merged, csvParsed));
    }
    /** Live poll without CSV: gviz carries palette 8–12 as numeric hex; embedded fills gaps only. */
    if (options.livePoll && !csvParsed) {
      var embeddedLive = getEmbeddedLocalPaletteCsvText();
      var embeddedLiveParsed = embeddedLive ? tryParsePaletteCsv(embeddedLive) : null;
      if (embeddedLiveParsed) {
        fillCsvOnlyPaletteGapsFromAuthority(merged, embeddedLiveParsed);
      }
      return Promise.resolve(merged);
    }
    if (!csvOnlyPalettesNeedFill(merged)) return Promise.resolve(merged);
    return resolveLocalPaletteCsvText()
      .then(function (text) {
        var localParsed = tryParsePaletteCsv(text);
        if (localParsed) supplementCsvOnlyPalettesFromAuthority(merged, localParsed);
        return merged;
      })
      .catch(function () {
        return merged;
      });
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
    var ki;
    var key;
    var missing;
    for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
      key = GVIZ_CSV_ONLY_PALETTE_KEYS[ki];
      missing = countMissingPaletteSlots(parsed, key);
      if (!missing.length) continue;
      console.warn(
        "SheetPalettes: " +
          key +
          " is incomplete (" +
          missing.length +
          " missing slots). Canvas may show palette1 fallbacks for: " +
          missing.slice(0, 12).join(", ") +
          (missing.length > 12 ? "…" : "")
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

  function finalizeParsedPalettes(parsed, sourceKey, sourceLabel, options) {
    options = options || {};
    var csvPrimary = options.csvPrimaryParsed || null;

    function finishParsedPalettes() {
      var toApply = parsed;
      if (!options.livePoll) {
        if (csvPrimary) {
          applyAuthoritativePaletteSlots(parsed, csvPrimary);
        }
        toApply = parsed;
      }
      /** Live poll: gviz is fresh — embedded/CSV only fill gaps, never overwrite palette 8–12. */
      if (options.livePoll) {
        var embeddedLive = getEmbeddedLocalPaletteCsvText();
        var embeddedLiveParsed = embeddedLive ? tryParsePaletteCsv(embeddedLive) : null;
        if (embeddedLiveParsed) {
          fillCsvOnlyPaletteGapsFromAuthority(toApply, embeddedLiveParsed);
        }
      } else {
        overlayEmbeddedCsvOnlyPalettesAuthority(toApply);
      }
      warnIfPaletteIncomplete(toApply);
      return applyParsedPaletteData(toApply, sourceKey, sourceLabel, {
        skipMemoryGapFill: options.livePoll === true,
      });
    }

    if (options.skipLocalGapFill) {
      return Promise.resolve(finishParsedPalettes());
    }
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
        return finishParsedPalettes();
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
        return finishParsedPalettes();
      });
  }

  function computePaletteFingerprint(parsed) {
    if (!parsed) return "";
    var parts = [];
    var pi;
    var key;
    var palette;
    var slots;
    var si;
    var slot;
    for (pi = 0; pi < PALETTE_KEYS.length; pi++) {
      key = PALETTE_KEYS[pi];
      palette = parsed[key] || {};
      slots = Object.keys(palette).sort();
      for (si = 0; si < slots.length; si++) {
        slot = slots[si];
        parts.push(key + ":" + slot + "=" + palette[slot]);
      }
    }
    palette = parsed.default || {};
    slots = Object.keys(palette).sort();
    for (si = 0; si < slots.length; si++) {
      slot = slots[si];
      parts.push("default:" + slot + "=" + palette[slot]);
    }
    return parts.join("|");
  }

  function isPaletteRegression(incoming, paletteKey) {
    if (!loaded || !palettes || !palettes[paletteKey]) return false;
    var currentMissing = countMissingPaletteSlots(palettes, paletteKey).length;
    var incomingMissing = countMissingPaletteSlots(incoming, paletteKey).length;
    return incomingMissing > currentMissing;
  }

  function isCsvOnlyPaletteRegression(incoming) {
    var ki;
    for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
      if (isPaletteRegression(incoming, GVIZ_CSV_ONLY_PALETTE_KEYS[ki])) return true;
    }
    return false;
  }

  function applyParsedPaletteData(parsed, sourceKey, sourceLabel, options) {
    options = options || {};
    var incoming = syncPaletteFallbacks(parsed || emptyPalettes());
    /** Live polls use fresh sheet/CSV data; memory gap-fill would preserve stale palette8 gviz nulls. */
    if (loaded && palettes && !options.skipMemoryGapFill) {
      mergePaletteGaps(incoming, palettes);
    }
    if (
      loaded &&
      !options.skipMemoryGapFill &&
      isCsvOnlyPaletteRegression(incoming)
    ) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "SheetPalettes: skipped update — palette8–12 would lose colors (partial sheet response)."
        );
      }
      return palettes;
    }
    var nextFingerprint = computePaletteFingerprint(incoming);
    if (loaded && nextFingerprint === lastPaletteFingerprint) {
      return palettes;
    }
    lastPaletteFingerprint = nextFingerprint;
    palettes = incoming;
    loaded = true;
    if (!options.skipMemoryGapFill) {
      hydrateCsvOnlyPalettesIfNeeded();
      if (GVIZ_CSV_ONLY_PALETTE_KEYS.indexOf(activePalette) !== -1) {
        refreshCsvOnlyPalettesFromGoogle().then(function () {
          syncBorderGlobals();
          notifyPalettesLoaded();
        });
      }
    }
    lastLoadSource = sourceKey;
    syncBorderGlobals();
    if (typeof console !== "undefined" && console.info) {
      console.info("SheetPalettes: colors loaded from " + sourceLabel + ".");
    }
    lastLiveSyncAt = Date.now();
    updateLiveSyncStatus(sourceLabel);
    notifyPalettesLoaded();
    return palettes;
  }

  function formatLiveSyncClock(ts) {
    try {
      return new Date(ts).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function updateLiveSyncStatus(sourceLabel) {
    var el = document.getElementById("sheet-palette-live-status");
    if (!el) return;
    var time = lastLiveSyncAt ? formatLiveSyncClock(lastLiveSyncAt) : "";
    var fileHint = isFileProtocol()
      ? " · פתח דרך npm run serve לעדכון מלא"
      : isLocalDevHost()
        ? " · מקור: Google Sheet (עדכון חי)"
        : "";
    var csvOnlyHint = "";
    if (
      palettes &&
      GVIZ_CSV_ONLY_PALETTE_KEYS.indexOf(activePalette) !== -1 &&
      countMissingPaletteSlots(palettes, activePalette).length > 10
    ) {
      csvOnlyHint =
        " · " +
        formatPaletteKeyLabel(activePalette) +
        ": הרץ npm run serve + תיקון פורמט בגיליון";
    }
    el.textContent = time
      ? "עדכון חי מהגיליון · " + time + fileHint + csvOnlyHint
      : "עדכון חי מהגיליון" + fileHint + csvOnlyHint;
    el.title = sourceLabel || "Google Sheet";
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
  /** When CSV export fails (e.g. file://), gviz csvText must be part of the change key. */
  function getGoogleLiveRawKey(gvizPayload, csvText) {
    var effectiveCsv =
      csvText || (gvizPayload && gvizPayload.csvText) || "";
    return (
      (gvizPayload && gvizPayload.sig ? gvizPayload.sig : "") +
      "|" +
      effectiveCsv
    );
  }

  function rememberGoogleLiveRawKey(gvizPayload, csvText) {
    lastGoogleLiveRawKey = getGoogleLiveRawKey(gvizPayload, csvText);
    if (gvizPayload && gvizPayload.sig) {
      lastGvizSig = gvizPayload.sig;
    }
  }

  function loadParsedPalettesFromGoogleSources() {
    return Promise.allSettled([
      fetchGoogleSheetGvizPayload(),
      fetchGoogleSheetCsv(),
    ]).then(function (results) {
      var gvizPayload =
        results[0].status === "fulfilled" ? results[0].value : null;
      var csvText =
        results[1].status === "fulfilled" ? results[1].value : null;
      var gvizParsed = gvizPayload
        ? tryParsePaletteCsv(gvizPayload.csvText)
        : null;
      var csvParsed = csvText ? tryParsePaletteCsv(csvText) : null;
      var merged = mergeGoogleSheetSources(csvParsed, gvizParsed);
      var sourceLabel = "Google Sheet";

      if (merged) {
        sourceLabel = csvParsed
          ? gvizParsed
            ? "Google Sheet (csv primary)"
            : "Google Sheet (csv)"
          : "Google Sheet (gviz)";
      }

      if (!merged) {
        throw new Error("Google Sheet palette data unavailable");
      }

      if (!csvParsed && typeof console !== "undefined" && console.warn) {
        console.warn(
          "SheetPalettes: CSV export failed; palette8 may be incomplete until local CSV fills gaps."
        );
      }

      rememberGoogleLiveRawKey(gvizPayload, csvText);
      return resolveCsvOnlyPalettesAuthority(merged, csvParsed).then(function (enriched) {
        return finalizeParsedPalettes(enriched, "google", sourceLabel, {
          csvPrimaryParsed: csvParsed,
        });
      });
    });
  }

  function gvizCellValue(cell) {
    if (!cell) return "";
    if (cell.f != null && String(cell.f).trim() !== "") {
      return String(cell.f);
    }
    if (cell.v == null || cell.v === "") return "";
    if (typeof cell.v === "number") {
      if (Number.isInteger(cell.v)) return String(cell.v);
      if (cell.v === Math.floor(cell.v)) return String(Math.trunc(cell.v));
    }
    return String(cell.v);
  }

  /** CSV export is authoritative (palette8 complete); gviz fills rare gaps only. */
  function mergeGoogleSheetSources(csvParsed, gvizParsed) {
    if (csvParsed) {
      if (gvizParsed) mergePaletteGaps(csvParsed, gvizParsed);
      return csvParsed;
    }
    if (gvizParsed) {
      var ki;
      for (ki = 0; ki < GVIZ_CSV_ONLY_PALETTE_KEYS.length; ki++) {
        gvizParsed[GVIZ_CSV_ONLY_PALETTE_KEYS[ki]] = {};
      }
    }
    return gvizParsed || null;
  }

  /**
   * Live sync: gviz updates all palettes immediately (8–12 as numeric hex).
   * Stale CSV export only fills empty slots — never overwrites fresh gviz edits.
   */
  function mergeGoogleSheetSourcesLive(csvParsed, gvizParsed) {
    if (!gvizParsed && !csvParsed) return null;
    var merged = gvizParsed
      ? cloneParsedPalettes(gvizParsed)
      : cloneParsedPalettes(csvParsed);
    if (csvParsed) {
      mergePaletteGaps(merged, csvParsed);
    }
    return merged;
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

  /** npm run serve / localhost — live sync reads Google Sheet; local CSV is fallback only. */
  function isLocalDevHost() {
    try {
      var host = global.location && global.location.hostname;
      return host === "localhost" || host === "127.0.0.1";
    } catch (e) {
      return false;
    }
  }

  function localPaletteSourceLabel(text) {
    return getEmbeddedLocalPaletteCsvText() === text
      ? "embedded palette CSV"
      : "data/sheet-palette-colors.csv";
  }

  function loadFromLocalCsvAuthoritative() {
    return resolveLocalPaletteCsvText().then(function (text) {
      return applyParsedPalettes(
        text,
        "local",
        localPaletteSourceLabel(text) + " (local dev)"
      );
    });
  }

  function pollLocalCsvLive() {
    return fetchLocalCsv().then(function (text) {
      var parsed = tryParsePaletteCsv(text);
      if (!parsed) throw new Error("Local palette CSV unavailable");
      return applyParsedPaletteData(
        parsed,
        "local",
        localPaletteSourceLabel(text) + " (live local dev)",
        { skipMemoryGapFill: true }
      );
    });
  }

  /** Local dev: Google Sheet first (same as palette-colors-preview), local CSV if sheet unreachable. */
  function pollLocalDevLive() {
    return pollGoogleSheetLive().catch(function () {
      return pollLocalCsvLive();
    });
  }

  /**
   * JSONP via gviz — works when opening index.html as file:// (fetch CSV is often blocked).
   * Returns CSV text plus `sig` (changes when the sheet is edited).
   */
  function fetchGoogleSheetGvizPayload() {
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
          resolve({
            csvText: gvizResponseToCsv(response),
            sig:
              response && response.sig != null ? String(response.sig) : null,
          });
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

  function fetchGoogleSheetViaGviz() {
    return fetchGoogleSheetGvizPayload().then(function (payload) {
      return payload.csvText;
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

  /** JSONP proxy — works on file:// where fetch() to localhost is blocked. */
  function fetchCsvViaJsonpProxy() {
    return new Promise(function (resolve, reject) {
      var cb =
        "sheetPaletteCsv_" +
        Date.now() +
        "_" +
        Math.floor(Math.random() * 1e6);
      var timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error("proxy JSONP timeout"));
      }, 15000);
      var script = document.createElement("script");
      function cleanup() {
        clearTimeout(timeoutId);
        try {
          delete global[cb];
        } catch (ignore) {
          global[cb] = undefined;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      global[cb] = function (text) {
        cleanup();
        if (typeof text !== "string" || !isValidPaletteCsvHeader(text)) {
          reject(new Error("Invalid proxy JSONP CSV"));
          return;
        }
        resolve(text);
      };
      script.onerror = function () {
        cleanup();
        reject(new Error("proxy JSONP failed"));
      };
      script.src =
        SHEET_CSV_PROXY_URL +
        (SHEET_CSV_PROXY_URL.indexOf("?") >= 0 ? "&" : "?") +
        "callback=" +
        encodeURIComponent(cb) +
        "&_=" +
        Date.now();
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function fetchGoogleSheetCsv() {
    var urls = [getGoogleSheetCsvUrl()];
    urls.push(
      SHEET_CSV_PROXY_URL +
        (SHEET_CSV_PROXY_URL.indexOf("?") >= 0 ? "&" : "?") +
        "_=" +
        Date.now()
    );
    function tryUrl(index) {
      if (index >= urls.length) {
        return fetchCsvViaJsonpProxy().catch(function () {
          return Promise.reject(new Error("Google Sheet CSV fetch failed"));
        });
      }
      return fetchNoCache(urls[index]).then(function (response) {
        if (!response.ok) {
          throw new Error("Google Sheet CSV fetch failed (" + response.status + ")");
        }
        return response.text();
      }).catch(function () {
        return tryUrl(index + 1);
      });
    }
    return tryUrl(0);
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
   * Live poll: gviz for palettes 1–7 (instant), CSV for palettes 8–12 (full hex text).
   */
  function pollGoogleSheetLive() {
    return Promise.allSettled([
      fetchGoogleSheetGvizPayload(),
      fetchGoogleSheetCsv(),
    ]).then(function (results) {
      var gvizPayload =
        results[0].status === "fulfilled" ? results[0].value : null;
      var csvText =
        results[1].status === "fulfilled" ? results[1].value : null;
      var gvizParsed = gvizPayload
        ? tryParsePaletteCsv(gvizPayload.csvText)
        : null;
      var csvParsed = csvText ? tryParsePaletteCsv(csvText) : null;

      if (!gvizParsed && !csvParsed) {
        throw new Error("Google Sheet palette data unavailable");
      }

      var merged = mergeGoogleSheetSourcesLive(csvParsed, gvizParsed);
      var sourceLabel =
        gvizParsed && csvParsed
          ? "Google Sheet (live gviz + csv)"
          : csvParsed
            ? "Google Sheet (live csv)"
            : "Google Sheet (live gviz)";

      rememberGoogleLiveRawKey(gvizPayload, csvText);

      return resolveCsvOnlyPalettesAuthority(merged, csvParsed, { livePoll: true }).then(function (enriched) {
        return finalizeParsedPalettes(enriched, "google", sourceLabel, {
          csvPrimaryParsed: csvParsed,
          livePoll: true,
          skipLocalGapFill: true,
        });
      });
    });
  }

  /**
   * Poll Google Sheet without clearing current palettes; UI updates only when data changed.
   */
  function refreshSheetPalettesIfChanged() {
    if (!loaded) return loadSheetPalettes();
    if (liveSyncPollInFlight) return Promise.resolve(palettes);
    liveSyncPollInFlight = true;
    var poll = isLocalDevHost() ? pollLocalDevLive() : pollGoogleSheetLive();
    return poll
      .catch(function (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "SheetPalettes: live sync poll failed (keeping current colors).",
            err
          );
        }
        return palettes;
      })
      .then(function (result) {
        liveSyncPollInFlight = false;
        return result;
      });
  }

  function startLiveSync(intervalMs) {
    stopLiveSync();
    if (typeof intervalMs === "number" && intervalMs > 0) {
      liveSyncIntervalMs = intervalMs;
    }
    function tick() {
      try {
        if (typeof document !== "undefined" && document.hidden) return;
      } catch (ignore) {
        /* ignore */
      }
      refreshSheetPalettesIfChanged();
    }
    liveSyncTimerId = setInterval(tick, liveSyncIntervalMs);
  }

  function stopLiveSync() {
    if (liveSyncTimerId != null) {
      clearInterval(liveSyncTimerId);
      liveSyncTimerId = null;
    }
  }

  /**
   * Fast boot: apply embedded CSV immediately (no network). Used before first paint.
   * @returns {Promise<typeof palettes>}
   */
  function loadEmbeddedPalettesFast() {
    var embedded = getEmbeddedLocalPaletteCsvText();
    if (embedded) {
      return Promise.resolve(
        applyParsedPalettes(embedded, "embedded", "embedded palette CSV (fast boot)")
      ).then(function (result) {
        ensureCsvOnlyPalettesFromAuthority({ force: true });
        syncBorderGlobals();
        return result;
      });
    }
    return resolveLocalPaletteCsvText()
      .then(function (text) {
        var label =
          getEmbeddedLocalPaletteCsvText() === text
            ? "embedded palette CSV (fast boot)"
            : "data/sheet-palette-colors.csv (fast boot)";
        return applyParsedPalettes(text, "local", label);
      })
      .catch(function () {
        palettes = emptyPalettes();
        loaded = true;
        lastLoadSource = "embedded";
        syncBorderGlobals();
        notifyPalettesLoaded();
        return palettes;
      });
  }

  function loadSheetPalettes() {
    sheetLoadGeneration += 1;
    palettes = emptyPalettes();
    loaded = false;
    lastPaletteFingerprint = null;
    lastGvizSig = null;
    lastGoogleLiveRawKey = null;
    if (isLocalDevHost()) {
      return loadFromGoogleSheet().catch(function (sheetErr) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "SheetPalettes: Google Sheet unavailable on localhost; trying local CSV.",
            sheetErr
          );
        }
        return loadFromLocalCsvAuthoritative();
      });
    }
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
    loadEmbeddedPalettesFast: loadEmbeddedPalettesFast,
    loadSheetPalettes: loadSheetPalettes,
    reloadSheetPalettes: loadSheetPalettes,
    refreshSheetPalettesIfChanged: refreshSheetPalettesIfChanged,
    startLiveSync: startLiveSync,
    stopLiveSync: stopLiveSync,
    onPalettesLoaded: onPalettesLoaded,
    getColor: getColor,
    getUniquePaletteColors: getUniquePaletteColors,
    getProminentPaletteColors: getProminentPaletteColors,
    getPaletteMeshGradient: getPaletteMeshGradient,
    getPaletteConicGradient: getPaletteConicGradient,
    setSlotColor: setSlotColor,
    setActivePalette: setActivePalette,
    getDefaultSheetPaletteKey: getDefaultSheetPaletteKey,
    getActivePaletteKey: getActivePaletteKey,
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
    get lastLiveSyncAt() {
      return lastLiveSyncAt;
    },
    get palettes() {
      return palettes;
    },
  };

  global.getColor = getColor;
})(typeof window !== "undefined" ? window : this);

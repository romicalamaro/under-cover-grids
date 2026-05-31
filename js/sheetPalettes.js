(function (global) {
  "use strict";

  var SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/1V7A6B8TV905pomdluT97zMrABwlBeNSLeaaPLEigRRA/export?format=csv&gid=624707697";
  var LOCAL_CSV_URL = "data/sheet-palette-colors.csv";

  var PALETTE_KEYS = ["palette1", "palette2", "palette3", "palette4", "palette5"];

  /** Offline fallback — matches Google Sheet Default column. */
  var FALLBACK_DEFAULTS = {
    A1: "#fffce8",
    A2: "#fffce8",
    B1: "#ff3c3c",
    B2: "#ff3c3c",
    C1: "#ff3c3c",
    C2: "#685450",
    C3: "#655551",
    C4: "#655551",
    C5: "#eb4f46",
    C6: "#3c06a7",
    C7: "#f7cecd",
    C8: "#655551",
    C9: "#655551",
    C10: "#ff3c3c",
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
    F1: "#ff3c3c",
    F2: "#ff3c3c",
    F3: "#ffffff",
    F4: "#ff3c3c",
    F5: "#ff3c3c",
    F6: "#b2ff00",
    F7: "#000000",
    F8: "#685450",
    G1: "#685450",
    G2: "#685450",
    G3: "#b2ff00",
    G4: "#b2ff00",
    G5: "#ff3c3c",
    H1: "#4200ae",
    H2: "#b2ff00",
    H3: "#ffffff",
    H4: "#000000",
    H5: "#888888",
  };

  /** Snapshot of Palette 1 from the sheet — used when CSV fetch fails (e.g. file://). */
  var FALLBACK_PALETTE1 = {
    A1: "#ffc8e2",
    B1: "#ff132d",
    B2: "#ff132d",
    C1: "#ff132d",
    C2: "#685450",
    C3: "#d9d9d9",
    C4: "#685450",
    C5: "#ff132d",
    C6: "#d9d9d9",
    C7: "#0c6664",
    C9: "#0c6664",
    D1: "#0c6664",
    D2: "#0c6664",
    D3: "#0c6664",
    D4: "#0c6664",
    D5: "#0c6664",
    F3: "#b2ff00",
    F7: "#3c06a7",
    G1: "#fffce8",
    G2: "#fffce8",
    G3: "#0c6664",
    G4: "#0c6664",
    G5: "#685450",
  };

  /** Snapshot of Palette 2 from the sheet — used when CSV fetch fails (e.g. file://). */
  var FALLBACK_PALETTE2 = {
    A1: "#ffffff",
    A2: "#ffffff",
    B1: "#ff80ff",
    B2: "#ff80ff",
    C1: "#4200ae",
    C2: "#685450",
    C3: "#d9d9d9",
    C4: "#685450",
    C5: "#4200ae",
    C6: "#d9d9d9",
    C7: "#ff80ff",
    C9: "#ff80ff",
    D1: "#4200ae",
    D2: "#4200ae",
    D3: "#4200ae",
    D4: "#4200ae",
    D5: "#4200ae",
    D6: "#4200ae",
    D7: "#4200ae",
    D8: "#4200ae",
    D9: "#4200ae",
    D10: "#4200ae",
    D11: "#4200ae",
    F2: "#ff80ff",
    F3: "#b2ff00",
    F4: "#ff80ff",
    F5: "#ff132d",
    F6: "#b2ff00",
    G1: "#685450",
    G2: "#685450",
    G3: "#b2ff00",
    G4: "#b2ff00",
    G5: "#ff80ff",
    H1: "#4200ae",
  };

  /** Snapshot of Palette 3 from the sheet — used when CSV fetch fails (e.g. file://). */
  var FALLBACK_PALETTE3 = {
    A1: "#ffffff",
    A2: "#ffffff",
    B1: "#685450",
    B2: "#685450",
    C1: "#ff132d",
    C2: "#685450",
    C3: "#d9d9d9",
    C4: "#685450",
    C5: "#ff132d",
    C6: "#d9d9d9",
    C10: "#ff132d",
    D1: "#685450",
    D2: "#685450",
    D3: "#685450",
    D4: "#685450",
    D5: "#685450",
    D6: "#685450",
    D7: "#685450",
    D8: "#685450",
    D9: "#685450",
    D10: "#685450",
    D11: "#685450",
    F2: "#ff132d",
    F3: "#d9d9d9",
    F4: "#ff132d",
    F5: "#d9d9d9",
    F6: "#ff132d",
    F7: "#ff132d",
    G1: "#685450",
    G2: "#685450",
    G3: "#ffffff",
    G4: "#ffffff",
    H1: "#00ff89",
    H2: "#008849",
    H3: "#00fff9",
    H4: "#000000",
    H5: "#d9d9d9",
  };

  function emptyPalettes() {
    return {
      default: Object.assign({}, FALLBACK_DEFAULTS),
      palette1: Object.assign({}, FALLBACK_PALETTE1),
      palette2: Object.assign({}, FALLBACK_PALETTE2),
      palette3: Object.assign({}, FALLBACK_PALETTE3),
      palette4: {},
      palette5: {},
    };
  }

  var palettes = emptyPalettes();

  var activePalette = "palette1";
  var loaded = false;

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

  function parseCsv(text) {
    var lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    var result = {
      default: Object.assign({}, FALLBACK_DEFAULTS),
      palette1: {},
      palette2: {},
      palette3: {},
      palette4: {},
      palette5: {},
    };
    var li;
    for (li = 1; li < lines.length; li++) {
      var line = lines[li];
      if (!line || !line.trim()) continue;
      var cols = parseCsvLine(line);
      var slot = (cols[1] || "").replace(/\r/g, "").trim();
      if (!slot) continue;

      var defaultHex = normalizeHex((cols[3] || "").replace(/\r/g, ""));
      if (defaultHex) result.default[slot] = defaultHex;

      var pi;
      for (pi = 0; pi < PALETTE_KEYS.length; pi++) {
        var paletteHex = normalizeHex((cols[4 + pi] || "").replace(/\r/g, ""));
        if (paletteHex) result[PALETTE_KEYS[pi]][slot] = paletteHex;
      }
    }
    return result;
  }

  function getColor(slotId) {
    var palette = palettes[activePalette] || {};
    return palette[slotId] || palettes.default[slotId] || FALLBACK_DEFAULTS[slotId] || "#000000";
  }

  function setActivePalette(key) {
    if (PALETTE_KEYS.indexOf(key) === -1) return false;
    activePalette = key;
    syncBorderGlobals();
    updatePaletteButtonStates();
    return true;
  }

  function getActivePaletteKey() {
    return activePalette;
  }

  function pickRandomPalette() {
    var index = Math.floor(Math.random() * PALETTE_KEYS.length);
    setActivePalette(PALETTE_KEYS[index]);
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
      global.BORDER_SIDE_X_FILL_LEFT = getColor("C4");
      global.BORDER_SIDE_X_FILL_RIGHT = getColor("C5");
      global.BORDER_SIDE_X_FILL_BOTTOM = getColor("C6");
      global.BORDER_SIDE_CELL_COLOR_GREY = getColor("C7");
      global.BORDER_SIDE_CELL_COLOR_BEIGE = getColor("C8");
      global.AUTO_MERGE_OUTLINE_COLOR = getColor("F6");
      global.AUTO_MERGE_SHADOW_COLOR = getColor("D6");
      global.CANVAS_EDGE_SERIAL_FILL = getColor("G5");
      global.BROWN_BAR_BANNER_FILL = getColor("G4");
      global.LABEL_BAR_AGE_OVERLAY_FILL = getColor("G4");
      global.LABEL_BAR_SYMBOL_SEPARATOR_FILL = getColor("G4");
      global.LABEL_BAR_ICON_FILL = getColor("G4");
    } catch (e) {
      /* ignore */
    }
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
  }

  function applyParsedPalettes(text, sourceLabel) {
    if (!text || text.indexOf("Category,Slot") === -1) {
      throw new Error("Invalid CSV response");
    }
    palettes = parseCsv(text);
    loaded = true;
    syncBorderGlobals();
    if (typeof console !== "undefined" && console.info) {
      console.info("SheetPalettes: loaded from " + sourceLabel + ".");
    }
    return palettes;
  }

  function loadSheetPalettes() {
    return fetch(SHEET_CSV_URL)
      .then(function (response) {
        if (!response.ok) throw new Error("CSV fetch failed");
        return response.text();
      })
      .then(function (text) {
        return applyParsedPalettes(text, "Google Sheet");
      })
      .catch(function (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "SheetPalettes: Google Sheet fetch failed, trying local CSV.",
            err
          );
        }
        return fetch(LOCAL_CSV_URL)
          .then(function (response) {
            if (!response.ok) throw new Error("Local CSV fetch failed");
            return response.text();
          })
          .then(function (text) {
            return applyParsedPalettes(text, "data/sheet-palette-colors.csv");
          })
          .catch(function (localErr) {
            if (typeof console !== "undefined" && console.warn) {
              console.warn(
                "SheetPalettes: local CSV unavailable, using embedded defaults.",
                localErr
              );
            }
            palettes = emptyPalettes();
            loaded = true;
            syncBorderGlobals();
            return palettes;
          });
      });
  }

  global.SheetPalettes = {
    loadSheetPalettes: loadSheetPalettes,
    getColor: getColor,
    setActivePalette: setActivePalette,
    getActivePaletteKey: getActivePaletteKey,
    pickRandomPalette: pickRandomPalette,
    syncBorderGlobals: syncBorderGlobals,
    updatePaletteButtonStates: updatePaletteButtonStates,
    get isLoaded() {
      return loaded;
    },
    get palettes() {
      return palettes;
    },
  };

  global.getColor = getColor;
})(typeof window !== "undefined" ? window : this);

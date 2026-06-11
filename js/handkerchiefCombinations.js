(function () {
  "use strict";

  var COMBO_COUNT = 8;
  var CSV_PATH = "data/handkerchief-combinations.csv";
  var STORAGE_KEY = "undercover.activeHandkerchiefCombo";

  /** @type {Record<string, string>[]} */
  var combinations = [];
  /** @type {number} */
  var activeComboIndex = 0;

  var SLIDER_KEYS = [
    "octagonsN",
    "innerScale",
    "colorDivisions",
    "borderSideSegments",
    "borderFrameDivisions",
    "borderSideWhiteFill",
    "fanLeaves",
    "angerVerticalLength",
    "anxietyVerticalStroke",
    "angerTriangleDensity",
    "circleDensity",
    "longingCircleDensity",
    "griefCircleDensity",
    "strengthDensity",
    "autoMergeIntensity",
    "prideFillPercent",
    "guiltShameFillPercent",
    "helplessnessPercent",
  ];

  var SLIDER_DOM = {
    octagonsN: "octagons-n",
    innerScale: "inner-scale",
    colorDivisions: "color-divisions",
    borderSideSegments: "border-side-segments",
    borderFrameDivisions: "border-frame-divisions",
    borderSideWhiteFill: "border-side-white-fill",
    fanLeaves: "fan-leaves",
    angerVerticalLength: "anger-vertical-length",
    anxietyVerticalStroke: "anxiety-vertical-stroke",
    angerTriangleDensity: "anger-triangle-density",
    circleDensity: "circle-density",
    longingCircleDensity: "longing-circle-density",
    griefCircleDensity: "grief-circle-density",
    strengthDensity: "strength-density",
    autoMergeIntensity: "auto-merge-intensity",
    prideFillPercent: "pride-fill-percent",
    guiltShameFillPercent: "guilt-shame-fill-percent",
    helplessnessPercent: "helplessness-percent",
  };

  /**
   * Minimal CSV row parser (handles quoted fields).
   * @param {string} line
   * @returns {string[]}
   */
  function parseCsvLine(line) {
    var out = [];
    var cur = "";
    var inQuotes = false;
    var i;
    for (i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  /**
   * @param {string} text
   * @returns {Record<string, string>[]}
   */
  function parseCombinationsCsv(text) {
    var lines = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(function (line) {
        return line.trim().length > 0;
      });
    if (lines.length < 2) return [];

    var header = parseCsvLine(lines[0]);
    var comboStart = header.indexOf("Combo 1");
    if (comboStart < 0) comboStart = 4;

    var keyCol = header.indexOf("Key");
    if (keyCol < 0) keyCol = 2;

    var combos = [];
    var c;
    for (c = 0; c < COMBO_COUNT; c++) {
      combos.push({});
    }

    var rowIdx;
    for (rowIdx = 1; rowIdx < lines.length; rowIdx++) {
      var cells = parseCsvLine(lines[rowIdx]);
      var key = (cells[keyCol] || "").trim();
      if (!key) continue;
      for (c = 0; c < COMBO_COUNT; c++) {
        var val = cells[comboStart + c];
        if (val !== undefined && String(val).trim() !== "") {
          combos[c][key] = String(val).trim();
        }
      }
    }
    return combos;
  }

  var FEELINGS_STEP_SLIDER_KEYS = [
    "angerVerticalLength",
    "anxietyVerticalStroke",
    "angerTriangleDensity",
    "circleDensity",
    "longingCircleDensity",
    "griefCircleDensity",
    "strengthDensity",
    "autoMergeIntensity",
    "prideFillPercent",
    "guiltShameFillPercent",
    "helplessnessPercent",
  ];

  /** @param {string} key @param {string|number} rawValue @returns {number|string} */
  function resolveFeelingsComboSliderValue(key, rawValue) {
    var bounds = {
      angerVerticalLength: {
        min:
          typeof ANGER_VERTICAL_LENGTH_MIN !== "undefined"
            ? ANGER_VERTICAL_LENGTH_MIN
            : 0,
        max:
          typeof ANGER_VERTICAL_LENGTH_MAX !== "undefined"
            ? ANGER_VERTICAL_LENGTH_MAX
            : 30,
      },
      anxietyVerticalStroke: {
        min:
          typeof ANXIETY_VERTICAL_STROKE_MIN !== "undefined"
            ? ANXIETY_VERTICAL_STROKE_MIN
            : 0,
        max:
          typeof ANXIETY_VERTICAL_STROKE_MAX !== "undefined"
            ? ANXIETY_VERTICAL_STROKE_MAX
            : 100,
      },
      angerTriangleDensity: {
        min:
          typeof ANGER_TRIANGLE_DENSITY_MIN !== "undefined"
            ? ANGER_TRIANGLE_DENSITY_MIN
            : 0,
        max:
          typeof ANGER_TRIANGLE_DENSITY_MAX !== "undefined"
            ? ANGER_TRIANGLE_DENSITY_MAX
            : 30,
      },
      circleDensity: {
        min: typeof CIRCLE_DENSITY_MIN !== "undefined" ? CIRCLE_DENSITY_MIN : 0,
        max: typeof CIRCLE_DENSITY_MAX !== "undefined" ? CIRCLE_DENSITY_MAX : 30,
      },
      longingCircleDensity: {
        min: typeof CIRCLE_DENSITY_MIN !== "undefined" ? CIRCLE_DENSITY_MIN : 0,
        max: typeof CIRCLE_DENSITY_MAX !== "undefined" ? CIRCLE_DENSITY_MAX : 30,
      },
      griefCircleDensity: {
        min: typeof CIRCLE_DENSITY_MIN !== "undefined" ? CIRCLE_DENSITY_MIN : 0,
        max: typeof CIRCLE_DENSITY_MAX !== "undefined" ? CIRCLE_DENSITY_MAX : 30,
      },
      strengthDensity: {
        min:
          typeof STRENGTH_DENSITY_MIN !== "undefined"
            ? STRENGTH_DENSITY_MIN
            : 0,
        max:
          typeof STRENGTH_DENSITY_MAX !== "undefined"
            ? STRENGTH_DENSITY_MAX
            : 30,
      },
      autoMergeIntensity: {
        min:
          typeof AUTO_MERGE_INTENSITY_MIN !== "undefined"
            ? AUTO_MERGE_INTENSITY_MIN
            : 0,
        max:
          typeof AUTO_MERGE_INTENSITY_MAX !== "undefined"
            ? AUTO_MERGE_INTENSITY_MAX
            : 7,
      },
      prideFillPercent: {
        min:
          typeof PRIDE_FILL_PERCENT_MIN !== "undefined"
            ? PRIDE_FILL_PERCENT_MIN
            : 0,
        max:
          typeof PRIDE_FILL_PERCENT_MAX !== "undefined"
            ? PRIDE_FILL_PERCENT_MAX
            : 30,
      },
      guiltShameFillPercent: {
        min:
          typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
            ? GUILT_SHAME_FILL_PERCENT_MIN
            : 0,
        max:
          typeof GUILT_SHAME_FILL_PERCENT_MAX !== "undefined"
            ? GUILT_SHAME_FILL_PERCENT_MAX
            : 30,
      },
      helplessnessPercent: {
        min:
          typeof HELPLESSNESS_PERCENT_MIN !== "undefined"
            ? HELPLESSNESS_PERCENT_MIN
            : 0,
        max:
          typeof HELPLESSNESS_PERCENT_MAX !== "undefined"
            ? HELPLESSNESS_PERCENT_MAX
            : 30,
      },
    };
    var b = bounds[key];
    if (!b) return rawValue;
    var min = b.min;
    var max = b.max;
    if (
      window.UnderCoverComboBridge &&
      window.UnderCoverComboBridge.getFeelingsSliderBounds
    ) {
      var gridBounds = window.UnderCoverComboBridge.getFeelingsSliderBounds(key);
      if (gridBounds) {
        min = gridBounds.min;
        max = gridBounds.max;
      }
    }
    var steps =
      typeof FEELINGS_SLIDER_STEPS !== "undefined" ? FEELINGS_SLIDER_STEPS : 5;
    var num = Number(String(rawValue).trim());
    if (!isFinite(num)) return rawValue;
    if (Number.isInteger(num) && num >= 1 && num <= steps) {
      return feelingsValueFromStep(num, min, max);
    }
    if (steps < 2) return Math.min(max, Math.max(min, num));
    var stepSize = (max - min) / (steps - 1);
    var idx = Math.round((num - min) / stepSize);
    if (idx < 0) idx = 0;
    if (idx > steps - 1) idx = steps - 1;
    return min + idx * stepSize;
  }

  function setSliderValue(id, value) {
    var el = document.getElementById(id);
    if (!el || value === undefined || value === "") return;
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Combo apply: set DOM values without firing per-slider handlers (avoids grid races). */
  function setSliderValueSilent(id, value) {
    var el = document.getElementById(id);
    if (!el || value === undefined || value === "") return;
    el.value = String(value);
  }

  /** @param {string} sliderKey @param {string|number} rawValue @returns {number|string} */
  function resolveComboSliderValue(sliderKey, rawValue) {
    var sliderValue = rawValue;
    if (sliderKey === "innerScale") {
      var stepRaw = String(sliderValue).trim();
      var steps =
        typeof INNER_SCALE_STEPS !== "undefined" ? INNER_SCALE_STEPS : 10;
      if (/^\d+$/.test(stepRaw)) {
        sliderValue = Math.max(1, Math.min(steps, Number(stepRaw)));
      } else {
        sliderValue = innerScaleStepFromValue(Number(sliderValue));
      }
    }
    if (sliderKey === "octagonsN") {
      var octStepRaw = String(sliderValue).trim();
      var octSteps =
        typeof OCTAGONS_N_STEPS !== "undefined" ? OCTAGONS_N_STEPS : 10;
      if (/^\d+$/.test(octStepRaw)) {
        var octNum = Number(octStepRaw);
        if (octNum > octSteps) {
          sliderValue = octagonsNStepFromValue(octNum);
        } else {
          sliderValue = Math.max(1, Math.min(octSteps, octNum));
        }
      } else {
        sliderValue = octagonsNStepFromValue(Number(octStepRaw));
      }
    }
    if (FEELINGS_STEP_SLIDER_KEYS.indexOf(sliderKey) >= 0) {
      sliderValue = resolveFeelingsComboSliderValue(sliderKey, sliderValue);
    }
    return sliderValue;
  }

  /**
   * @param {Record<string, string>} row
   * @param {{ boot?: boolean }} [options]
   */
  function applyCombinationRow(row, options) {
    options = options || {};
    if (!row) return;

    if (window.IdentityControls && window.IdentityControls.applyProfileState) {
      window.IdentityControls.applyProfileState(row, { silent: true });
    }

    var ki;
    for (ki = 0; ki < SLIDER_KEYS.length; ki++) {
      var sliderKey = SLIDER_KEYS[ki];
      if (row[sliderKey] === undefined) continue;
      setSliderValueSilent(
        SLIDER_DOM[sliderKey],
        resolveComboSliderValue(sliderKey, row[sliderKey])
      );
    }

    var bridge = window.UnderCoverComboBridge;
    if (!bridge) return;

    if (row.hopeMode === "view" || row.hopeMode === "merge") {
      bridge.resetHopeMergeState();
      bridge.setHopeMode(row.hopeMode);
    }

    if (row.labelBarTagIndex !== undefined && row.labelBarTagIndex !== "") {
      var tagIndex = parseInt(String(row.labelBarTagIndex), 10);
      if (isFinite(tagIndex)) {
        bridge.setLabelBarTagIndex(tagIndex);
      }
    }

    bridge.applyColorDivisionLayout(
      row.colorDivisionShuffleSeed !== undefined ? row.colorDivisionShuffleSeed : 0,
      row.colorDivisionAreaOrder || ""
    );

    if (options.boot && bridge.finalizeApplySilent) {
      bridge.finalizeApplySilent();
    } else {
      bridge.finalizeApply();
      if (bridge.applyPrideLayers) {
        bridge.applyPrideLayers();
      }
    }
  }

  function rememberActiveCombo(index) {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(index + 1));
    } catch (e) {
      /* ignore */
    }
  }

  function getRememberedComboIndex() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      var n = parseInt(raw, 10);
      if (!isFinite(n) || n < 1 || n > COMBO_COUNT) return 0;
      return n - 1;
    } catch (e) {
      return 0;
    }
  }

  function updateComboButtonsUi() {
    var buttons = document.querySelectorAll("[data-handkerchief-combo]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var idx = parseInt(btn.getAttribute("data-handkerchief-combo") || "0", 10) - 1;
      var isActive = idx === activeComboIndex;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    }
    var label = document.getElementById("handkerchief-combo-active-label");
    if (label) {
      label.textContent = "Combo " + String(activeComboIndex + 1);
    }
  }

  function applyComboByIndex(index) {
    if (index < 0 || index >= COMBO_COUNT) return;
    if (!combinations[index] || !Object.keys(combinations[index]).length) {
      console.warn(
        "[HandkerchiefCombinations] Combo " +
          (index + 1) +
          " is empty — fill data/handkerchief-combinations.csv"
      );
      return;
    }
    activeComboIndex = index;
    rememberActiveCombo(index);
    updateComboButtonsUi();
    applyCombinationRow(combinations[index]);
  }

  function loadCombinationsFromCsv() {
    function applyText(text) {
      combinations = parseCombinationsCsv(text);
      return combinations;
    }
    if (location.protocol === "file:") {
      if (
        typeof window.EMBEDDED_COMBINATIONS_CSV_TEXT === "string" &&
        window.EMBEDDED_COMBINATIONS_CSV_TEXT.trim()
      ) {
        return Promise.resolve(applyText(window.EMBEDDED_COMBINATIONS_CSV_TEXT));
      }
      return Promise.reject(new Error("No embedded combinations CSV"));
    }
    return fetch(CSV_PATH, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        return applyText(text);
      })
      .catch(function (err) {
        if (
          typeof window.EMBEDDED_COMBINATIONS_CSV_TEXT === "string" &&
          window.EMBEDDED_COMBINATIONS_CSV_TEXT.trim()
        ) {
          return applyText(window.EMBEDDED_COMBINATIONS_CSV_TEXT);
        }
        throw err;
      });
  }

  function updateComboButtonsLockState() {
    var locked =
      typeof window.SectionProgression !== "undefined" &&
      window.SectionProgression.isSectionUnlocked &&
      !window.SectionProgression.isSectionUnlocked("combinations");
    var buttons = document.querySelectorAll("[data-handkerchief-combo]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].disabled = locked;
    }
  }

  function initComboControls() {
    var buttons = document.querySelectorAll("[data-handkerchief-combo]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          if (btn.disabled) return;
          var idx = parseInt(btn.getAttribute("data-handkerchief-combo") || "1", 10) - 1;
          applyComboByIndex(idx);
        });
      })(buttons[i]);
    }
    updateComboButtonsUi();
    updateComboButtonsLockState();
  }

  function init() {
    initComboControls();
  }

  /** Load CSV only; guided flow skips auto-apply on boot. */
  function loadAndApplyInitialCombo() {
    return loadCombinationsFromCsv()
      .then(function () {
        activeComboIndex = 0;
        updateComboButtonsUi();
        updateComboButtonsLockState();
      })
      .catch(function (err) {
        console.warn("[HandkerchiefCombinations] Could not load CSV:", err);
      });
  }

  window.HandkerchiefCombinations = {
    init: init,
    loadAndApplyInitialCombo: loadAndApplyInitialCombo,
    loadCombinationsFromCsv: loadCombinationsFromCsv,
    applyComboByIndex: applyComboByIndex,
    parseCombinationsCsv: parseCombinationsCsv,
    getCombinations: function () {
      return combinations.slice();
    },
    getActiveComboIndex: function () {
      return activeComboIndex;
    },
  };
})();

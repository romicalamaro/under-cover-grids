(function () {
  "use strict";

  /** @type {Array<{ value: string, label: string }>} */
  var IRAN_LOSS_TYPE_OPTIONS = [
    { value: "lovedOne", label: "Loss of a loved one" },
    {
      value: "place",
      label: "Loss of place (home, neighborhood, city)",
    },
    {
      value: "languageCulture",
      label: "Loss of language / culture in daily life",
    },
    {
      value: "freedomOfMovement",
      label: "Loss of freedom of movement (cannot return / visit)",
    },
    {
      value: "familyFriendsConnection",
      label: "Loss of connection with part of the family or friends",
    },
  ];

  /** @type {Array<{ value: string, label: string }>} */
  var CLOSE_FAMILY_IN_IRAN_OPTIONS = [
    {
      value: "largePart",
      label: "Yes, a large part of the family",
    },
    {
      value: "someMembers",
      label: "Yes, some family members",
    },
    {
      value: "almostAllOutside",
      label: "No, almost everyone is outside Iran",
    },
  ];

  /** @type {null | string} */
  var closeFamilyInIran = null;
  /** @type {string[] | null} null = not answered yet */
  var iranLossTypes = null;
  /** @type {(() => void) | null} */
  var onFamilyChange = null;

  function notifyChange(scope) {
    syncDerivedSliders(true, scope);
    if (onFamilyChange) onFamilyChange();
    if (
      typeof window.SectionProgression !== "undefined" &&
      window.SectionProgression.markFrameSectionEngaged
    ) {
      window.SectionProgression.markFrameSectionEngaged();
    }
  }

  /**
   * More family in Iran → more frame divisions.
   * @param {null | string} choice
   * @returns {1|2|3}
   */
  function borderFrameDivisionsFromCloseFamily(choice) {
    if (choice === "largePart") return 3;
    if (choice === "someMembers") return 2;
    if (choice === "almostAllOutside") return 1;
    return 2;
  }

  function isCloseFamilyInIranChoice(value) {
    var i;
    for (i = 0; i < CLOSE_FAMILY_IN_IRAN_OPTIONS.length; i++) {
      if (CLOSE_FAMILY_IN_IRAN_OPTIONS[i].value === value) return true;
    }
    return false;
  }

  /**
   * Each selected loss type adds one white-fill step (more empty margin cells).
   * @param {string[] | null} types
   * @returns {number}
   */
  function borderSideWhiteFillFromLossTypes(types) {
    var count = Array.isArray(types) ? types.length : 0;
    if (count <= 0) return 0;
    var steps =
      typeof BORDER_SIDE_WHITE_FILL_STEPS !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_STEPS
        : 5;
    if (steps < 2) return 0;
    var max =
      typeof BORDER_SIDE_WHITE_FILL_MAX !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_MAX
        : 100;
    var idx = Math.min(count, steps - 1);
    return Math.round((idx / (steps - 1)) * max);
  }

  function borderFrameDivisionsLabel(step) {
    if (typeof window.borderFrameDivisionsLabel === "function") {
      return window.borderFrameDivisionsLabel(step);
    }
    if (step === 1) return "Minimum";
    if (step === 3) return "Maximum";
    return "Medium";
  }

  function syncBorderSideWhiteFillOutput() {
    if (typeof window.syncBorderSideWhiteFillOutput === "function") {
      window.syncBorderSideWhiteFillOutput();
      return;
    }
    var out = document.getElementById("border-side-white-fill-out");
    if (!out) return;
    var slider = document.getElementById("border-side-white-fill");
    var cap =
      typeof BORDER_SIDE_WHITE_CAP_PERCENT !== "undefined"
        ? BORDER_SIDE_WHITE_CAP_PERCENT
        : 50;
    var sliderMax =
      typeof BORDER_SIDE_WHITE_FILL_MAX !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_MAX
        : 100;
    var v = slider ? Number(slider.value) : 0;
    out.textContent =
      String(Math.round((v * cap) / sliderMax)) + "%";
  }

  /**
   * @param {boolean} [commit]
   * @param {"both"|"closeFamily"|"whiteFill"} [scope]
   */
  function syncDerivedSliders(commit, scope) {
    if (!scope) scope = "both";
    if (scope === "both" || scope === "closeFamily") {
      syncFrameDivisionsSlider(commit);
    }
    if (scope === "both" || scope === "whiteFill") {
      syncWhiteFillSlider(commit);
    }
  }

  function syncFrameDivisionsSlider(commit) {
    var divisions = borderFrameDivisionsFromCloseFamily(closeFamilyInIran);
    var frameSlider = document.getElementById("border-frame-divisions");
    if (!frameSlider) return;
    if (Number(frameSlider.value) === divisions) return;

    frameSlider.value = String(divisions);
    var frameOut = document.getElementById("border-frame-divisions-out");
    if (frameOut) {
      frameOut.textContent = borderFrameDivisionsLabel(divisions);
    }
    frameSlider.dispatchEvent(new Event("input", { bubbles: true }));
    if (commit) {
      frameSlider.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function syncWhiteFillSlider(commit) {
    var whiteFill = borderSideWhiteFillFromLossTypes(iranLossTypes);
    var whiteSlider = document.getElementById("border-side-white-fill");
    if (!whiteSlider) return;
    if (Number(whiteSlider.value) === whiteFill) return;

    whiteSlider.value = String(whiteFill);
    syncBorderSideWhiteFillOutput();
    whiteSlider.dispatchEvent(new Event("input", { bubbles: true }));
    if (commit) {
      whiteSlider.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function syncCloseFamilyUi() {
    var buttons = document.querySelectorAll("[data-close-family-in-iran]");
    buttons.forEach(function (btn) {
      var value = btn.getAttribute("data-close-family-in-iran");
      var selected = value === closeFamilyInIran;
      btn.classList.toggle("is-selected", selected);
      btn.setAttribute("aria-pressed", String(selected));
    });
  }

  function syncLossTypesUi() {
    var buttons = document.querySelectorAll("[data-iran-loss-type]");
    var selected = Array.isArray(iranLossTypes) ? iranLossTypes : [];
    buttons.forEach(function (btn) {
      var value = btn.getAttribute("data-iran-loss-type");
      var checked = value ? selected.indexOf(value) >= 0 : false;
      btn.classList.toggle("is-selected", checked);
      btn.setAttribute("aria-pressed", String(checked));
    });
  }

  function initCloseFamilyPicker() {
    var buttons = document.querySelectorAll("[data-close-family-in-iran]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-close-family-in-iran");
        if (!value || !isCloseFamilyInIranChoice(value)) return;
        closeFamilyInIran = value;
        syncCloseFamilyUi();
        notifyChange("closeFamily");
      });
    });
  }

  function initLossTypePicker() {
    var buttons = document.querySelectorAll("[data-iran-loss-type]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-iran-loss-type");
        if (!value) return;
        if (!Array.isArray(iranLossTypes)) {
          iranLossTypes = [];
        }
        var idx = iranLossTypes.indexOf(value);
        if (idx >= 0) {
          iranLossTypes.splice(idx, 1);
        } else {
          iranLossTypes.push(value);
        }
        syncLossTypesUi();
        notifyChange("whiteFill");
      });
    });
  }

  /**
   * @param {{ closeFamilyInIran?: null | string, iranLossTypes?: string[] | null }} row
   * @param {boolean} [silent]
   */
  function applyFamilyState(row, silent) {
    if (!row) return;

    if (isCloseFamilyInIranChoice(row.closeFamilyInIran)) {
      closeFamilyInIran = row.closeFamilyInIran;
      syncCloseFamilyUi();
    }

    if (row.iranLossTypes !== undefined) {
      iranLossTypes = Array.isArray(row.iranLossTypes)
        ? row.iranLossTypes.slice()
        : null;
      syncLossTypesUi();
    }

    syncDerivedSliders(!silent);
    if (!silent && onFamilyChange) onFamilyChange();
  }

  function init() {
    initCloseFamilyPicker();
    initLossTypePicker();
    syncDerivedSliders(false);
  }

  window.FamilyControls = {
    CLOSE_FAMILY_IN_IRAN_OPTIONS: CLOSE_FAMILY_IN_IRAN_OPTIONS,
    IRAN_LOSS_TYPE_OPTIONS: IRAN_LOSS_TYPE_OPTIONS,
    borderFrameDivisionsFromCloseFamily: borderFrameDivisionsFromCloseFamily,
    borderSideWhiteFillFromLossTypes: borderSideWhiteFillFromLossTypes,
    getCloseFamilyInIran: function () {
      return closeFamilyInIran;
    },
    getIranLossTypes: function () {
      return iranLossTypes;
    },
    getBorderFrameDivisions: function () {
      return borderFrameDivisionsFromCloseFamily(closeFamilyInIran);
    },
    getBorderSideWhiteFill: function () {
      return borderSideWhiteFillFromLossTypes(iranLossTypes);
    },
    applyFamilyState: applyFamilyState,
    setOnFamilyChange: function (fn) {
      onFamilyChange = typeof fn === "function" ? fn : null;
    },
    syncDerivedSliders: syncDerivedSliders,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

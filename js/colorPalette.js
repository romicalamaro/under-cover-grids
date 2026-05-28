(function (global) {
  "use strict";

  /**
   * Canvas color roles — each gets one of the 5 active palette colors.
   * Rules for pairings/constraints can be added here later.
   */
  var COLOR_ROLES = [
    "canvasBackground",
    "patternStroke",
    "diamondFill",
    "labelBarBackground",
    "labelBarContent",
    "circleFill",
    "hopeDots",
    "halfCircle",
    "borderSideXTop",
    "borderSideXLeft",
    "borderSideXRight",
    "borderSideXBottom",
    "borderSideBlueXTop",
    "borderSideBlueXLeft",
    "borderSideBlueXRight",
    "borderSideBlueXBottom",
    "borderSideGrey",
    "borderSideBeige",
    "autoMergeOutline",
    "autoMergeShadow",
    "canvasEdgeSerial",
  ];

  var ROLE_TO_INPUT_ID = {
    canvasBackground: "canvas-background-color",
    patternStroke: "pattern-stroke-color",
    diamondFill: "diamond-fill-color",
    labelBarBackground: "label-bar-background-color",
    labelBarContent: "label-bar-content-color",
    circleFill: "circle-fill-color",
    hopeDots: "hope-dots-color",
    halfCircle: "half-circle-color",
  };

  var ROLE_TO_GLOBAL = {
    borderSideXTop: "BORDER_SIDE_X_FILL_TOP",
    borderSideXLeft: "BORDER_SIDE_X_FILL_LEFT",
    borderSideXRight: "BORDER_SIDE_X_FILL_RIGHT",
    borderSideXBottom: "BORDER_SIDE_X_FILL_BOTTOM",
    borderSideBlueXTop: "BORDER_SIDE_BLUE_X_FILL_TOP",
    borderSideBlueXLeft: "BORDER_SIDE_BLUE_X_FILL_LEFT",
    borderSideBlueXRight: "BORDER_SIDE_BLUE_X_FILL_RIGHT",
    borderSideBlueXBottom: "BORDER_SIDE_BLUE_X_FILL_BOTTOM",
    borderSideGrey: "BORDER_SIDE_CELL_COLOR_GREY",
    borderSideBeige: "BORDER_SIDE_CELL_COLOR_BEIGE",
    autoMergeOutline: "AUTO_MERGE_OUTLINE_COLOR",
    autoMergeShadow: "AUTO_MERGE_SHADOW_COLOR",
    canvasEdgeSerial: "CANVAS_EDGE_SERIAL_FILL",
  };

  var activePick = [];
  var assignments = {};
  var onApplied = null;

  function getPalette() {
    return typeof COLOR_PALETTE !== "undefined" ? COLOR_PALETTE : [];
  }

  function getPickCount() {
    return typeof COLOR_PALETTE_PICK_COUNT !== "undefined"
      ? COLOR_PALETTE_PICK_COUNT
      : 5;
  }

  function shuffleArray(arr) {
    var copy = arr.slice();
    var i;
    var j;
    var tmp;
    for (i = copy.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function normalizeHex(value) {
    if (!value || typeof value !== "string") return null;
    var v = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    return null;
  }

  function pickRandomPaletteColors(count) {
    var palette = getPalette();
    var n = Math.min(count, palette.length);
    return shuffleArray(palette).slice(0, n);
  }

  function pickRandomFrom(activeColors) {
    return activeColors[Math.floor(Math.random() * activeColors.length)];
  }

  function pickRandomFromExcept(activeColors, excludeHex) {
    var choices = activeColors.filter(function (color) {
      return color !== excludeHex;
    });
    if (!choices.length) return pickRandomFrom(activeColors);
    return pickRandomFrom(choices);
  }

  /**
   * Assign colors to roles. Rules run first; remaining roles pick freely.
   */
  function assignRolesFromActiveColors(roles, activeColors) {
    var result = {};
    var i;
    var role;
    var color;

    // Rule: grid background and grid line color must never match.
    result.canvasBackground = pickRandomFrom(activeColors);
    result.patternStroke = pickRandomFromExcept(
      activeColors,
      result.canvasBackground
    );

    // Rule: label bar background and content (text + symbols) must never match.
    result.labelBarBackground = pickRandomFrom(activeColors);
    result.labelBarContent = pickRandomFromExcept(
      activeColors,
      result.labelBarBackground
    );

    for (i = 0; i < roles.length; i++) {
      role = roles[i];
      if (Object.prototype.hasOwnProperty.call(result, role)) continue;
      color = pickRandomFrom(activeColors);
      result[role] = color;
    }
    return result;
  }

  function setGlobalColor(name, hex) {
    if (!name || !hex) return;
    try {
      global[name] = hex;
    } catch (e) {
      /* ignore */
    }
  }

  var LABEL_BAR_CONTENT_LINKED_GLOBALS = [
    "BROWN_BAR_BANNER_FILL",
    "LABEL_BAR_AGE_OVERLAY_FILL",
    "LABEL_BAR_SYMBOL_SEPARATOR_FILL",
    "LABEL_BAR_ICON_FILL",
  ];

  function applyLabelBarContentLinkedGlobals(hex) {
    var i;
    for (i = 0; i < LABEL_BAR_CONTENT_LINKED_GLOBALS.length; i++) {
      setGlobalColor(LABEL_BAR_CONTENT_LINKED_GLOBALS[i], hex);
    }
  }

  function applyAssignments(nextAssignments) {
    var role;
    var hex;
    var inputId;
    var input;
    var globalName;

    for (role in nextAssignments) {
      if (!Object.prototype.hasOwnProperty.call(nextAssignments, role)) continue;
      hex = normalizeHex(nextAssignments[role]);
      if (!hex) continue;

      inputId = ROLE_TO_INPUT_ID[role];
      if (inputId) {
        input = document.getElementById(inputId);
        if (input) input.value = hex;
      }

      globalName = ROLE_TO_GLOBAL[role];
      if (globalName) setGlobalColor(globalName, hex);

      if (role === "labelBarContent") {
        applyLabelBarContentLinkedGlobals(hex);
      }
    }
  }

  function updateActivePaletteSwatches() {
    var container = document.getElementById("active-palette-swatches");
    if (!container) return;

    container.innerHTML = activePick
      .map(function (hex) {
        return (
          '<span class="sidebar__palette-swatch" style="background-color:' +
          hex +
          ';" title="' +
          hex +
          '" aria-label="' +
          hex +
          '"></span>'
        );
      })
      .join("");
  }

  function randomizeCanvasColors() {
    activePick = pickRandomPaletteColors(getPickCount());
    assignments = assignRolesFromActiveColors(COLOR_ROLES, activePick);
    applyAssignments(assignments);
    updateActivePaletteSwatches();

    if (typeof onApplied === "function") {
      onApplied({
        activePick: activePick.slice(),
        assignments: Object.assign({}, assignments),
      });
    }

    return {
      activePick: activePick.slice(),
      assignments: Object.assign({}, assignments),
    };
  }

  global.ColorPalette = {
    randomizeCanvasColors: randomizeCanvasColors,
    getActivePick: function () {
      return activePick.slice();
    },
    getAssignments: function () {
      return Object.assign({}, assignments);
    },
    get roles() {
      return COLOR_ROLES.slice();
    },
    set onApplied(fn) {
      onApplied = fn;
    },
    get onApplied() {
      return onApplied;
    },
  };
})(typeof window !== "undefined" ? window : this);

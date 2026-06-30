/**
 * Renders the home-scroll Signs accordion (section list) and legacy card helpers for phase 2.
 */
(function () {
  "use strict";

  var built = false;
  var entriesBySection = {};
  var accordionItems = [];

  /**
   * Auto-animation registry: each open Signs section that has a slider gets a
   * looping timer here, keyed by section id, so we can stop it cleanly when the
   * section closes (or another opens). On the Signs page the sliders are not
   * interactive controls anymore — the visuals animate on their own.
   */
  var signsAnimationLoops = {};

  /** Project browns that disappear on the brown sign-card background */
  var SIGN_BROWN_HEX = {
    "685450": true,
    "8b7355": true,
    "5c4033": true,
  };

  /**
   * On the Signs page only, the project purple fill (#3c06a7) should read as a
   * light grey instead — distinct from white. This recolour is scoped to the
   * sign-icon SVGs here and does NOT touch the shared product palette.
   */
  var SIGN_PURPLE_HEX = "3c06a7";
  var SIGN_PURPLE_REPLACEMENT = "#b0b0b0";

  function normalizeHexColor(value) {
    if (!value) return "";
    var s = String(value).trim().toLowerCase();
    if (s === "none" || s === "transparent" || s === "currentcolor") return "";
    var rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      var r = parseInt(rgb[1], 10);
      var g = parseInt(rgb[2], 10);
      var b = parseInt(rgb[3], 10);
      return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    if (s.charAt(0) === "#") s = s.slice(1);
    if (s.length === 3) {
      s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    }
    return s.length >= 6 ? s.slice(0, 6) : "";
  }

  function isSignBrownColor(value) {
    var hex = normalizeHexColor(value);
    return !!hex && !!SIGN_BROWN_HEX[hex];
  }

  function remapBrownPaintAttribute(el, attr) {
    if (!el || !el.getAttribute) return;
    var value = el.getAttribute(attr);
    if (isSignBrownColor(value)) {
      el.setAttribute(attr, "#fff");
    }
  }

  function remapBrownInInlineStyle(el) {
    if (!el || !el.getAttribute) return;
    var style = el.getAttribute("style");
    if (!style || style.indexOf("685450") < 0 && style.indexOf("8B7355") < 0 && style.indexOf("8b7355") < 0 && style.indexOf("5C4033") < 0 && style.indexOf("5c4033") < 0) {
      return;
    }
    el.setAttribute(
      "style",
      style
        .replace(/#685450/gi, "#fff")
        .replace(/#8[bB]7355/gi, "#fff")
        .replace(/#5[cC]4033/gi, "#fff")
    );
  }

  function remapBrownToWhiteInSvg(root) {
    if (!root) return;
    var nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
    var i;
    var el;

    remapBrownPaintAttribute(root, "fill");
    remapBrownPaintAttribute(root, "stroke");
    remapBrownInInlineStyle(root);

    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      remapBrownPaintAttribute(el, "fill");
      remapBrownPaintAttribute(el, "stroke");
      remapBrownInInlineStyle(el);
    }

    var styles = root.querySelectorAll ? root.querySelectorAll("style") : [];
    for (i = 0; i < styles.length; i++) {
      var cssText = styles[i].textContent || "";
      if (!cssText) continue;
      styles[i].textContent = cssText
        .replace(/#685450/gi, "#fff")
        .replace(/#8[bB]7355/gi, "#fff")
        .replace(/#5[cC]4033/gi, "#fff");
    }
  }

  function isSignPurpleColor(value) {
    return normalizeHexColor(value) === SIGN_PURPLE_HEX;
  }

  function remapPurplePaintAttribute(el, attr) {
    if (!el || !el.getAttribute) return;
    if (isSignPurpleColor(el.getAttribute(attr))) {
      el.setAttribute(attr, SIGN_PURPLE_REPLACEMENT);
    }
  }

  function remapPurpleInInlineStyle(el) {
    if (!el || !el.getAttribute) return;
    var style = el.getAttribute("style");
    if (!style || style.toLowerCase().indexOf(SIGN_PURPLE_HEX) < 0) return;
    el.setAttribute(
      "style",
      style.replace(/#3c06a7/gi, SIGN_PURPLE_REPLACEMENT)
    );
  }

  function remapPurpleToGrayInSvg(root) {
    if (!root) return;
    var nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
    var i;
    var el;

    remapPurplePaintAttribute(root, "fill");
    remapPurplePaintAttribute(root, "stroke");
    remapPurpleInInlineStyle(root);

    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      remapPurplePaintAttribute(el, "fill");
      remapPurplePaintAttribute(el, "stroke");
      remapPurpleInInlineStyle(el);
    }

    var styles = root.querySelectorAll ? root.querySelectorAll("style") : [];
    for (i = 0; i < styles.length; i++) {
      var cssText = styles[i].textContent || "";
      if (!cssText) continue;
      styles[i].textContent = cssText.replace(
        /#3c06a7/gi,
        SIGN_PURPLE_REPLACEMENT
      );
    }
  }

  function applyCircleOutlinePreviewStyle(svg, previewId) {
    if (previewId !== "grief" && previewId !== "longing") return;
    var markerG = svg.querySelector(".sign-card__single-marker");
    if (!markerG) return;
    markerG.setAttribute("fill", "none");
    markerG.setAttribute("stroke", "#fff");
  }

  function applyPainHelplessnessPreviewStyle(svg, previewId) {
    if (previewId !== "pain" && previewId !== "helplessness") return;
    var markerG = svg.querySelector(".sign-card__single-marker");
    if (!markerG) return;
    if (previewId === "pain") {
      markerG.setAttribute("fill", "#fff");
      markerG.setAttribute("stroke", "#fff");
      var shapes = markerG.querySelectorAll("polygon, path");
      var i;
      for (i = 0; i < shapes.length; i++) {
        shapes[i].setAttribute("fill", "#fff");
        shapes[i].setAttribute("stroke", "#fff");
      }
      return;
    }
    markerG.setAttribute("fill", "none");
    markerG.setAttribute("stroke", "#fff");
    var lines = markerG.querySelectorAll("line");
    var j;
    for (j = 0; j < lines.length; j++) {
      lines[j].setAttribute("stroke", "#fff");
    }
  }

  function applyFanLeavesPreviewStyle(svg, previewId) {
    if (previewId !== "fanLeaves" || !svg) return;
    var bgFills = svg.querySelectorAll('[id^="radial-fan-background-"]');
    var i;
    for (i = 0; i < bgFills.length; i++) {
      bgFills[i].setAttribute("fill", "none");
      bgFills[i].setAttribute("stroke", "none");
    }
  }

  /**
   * The frame-line border side carries red/pink/cream accent fills from the
   * design canvas. On the Signs page the sign glyphs are monochrome
   * (browns -> white, purple -> grey), so we neutralise these accents to white
   * too, keeping the single family frame line consistent with the other signs.
   */
  var SIGN_FRAME_LINE_ACCENT_HEX = {
    ff3c3c: true,
    f7cecd: true,
    fffce9: true,
  };

  function isFrameLineAccentColor(value) {
    var hex = normalizeHexColor(value);
    return !!hex && !!SIGN_FRAME_LINE_ACCENT_HEX[hex];
  }

  function remapFrameLineAccentPaint(el, attr) {
    if (!el || !el.getAttribute) return;
    if (isFrameLineAccentColor(el.getAttribute(attr))) {
      el.setAttribute(attr, "#fff");
    }
  }

  function remapFrameLineAccentsToWhite(root) {
    if (!root) return;
    var nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
    var i;

    remapFrameLineAccentPaint(root, "fill");
    remapFrameLineAccentPaint(root, "stroke");
    for (i = 0; i < nodes.length; i++) {
      remapFrameLineAccentPaint(nodes[i], "fill");
      remapFrameLineAccentPaint(nodes[i], "stroke");
    }
  }

  function applyFrameLinePreviewStyle(svg, previewId) {
    if (previewId !== "familyFrameLine" || !svg) return;
    remapFrameLineAccentsToWhite(svg);
  }

  function applySignSvgColors(svg, previewId) {
    if (!svg) return;
    remapBrownToWhiteInSvg(svg);
    remapPurpleToGrayInSvg(svg);
    applyCircleOutlinePreviewStyle(svg, previewId);
    applyPainHelplessnessPreviewStyle(svg, previewId);
    applyFanLeavesPreviewStyle(svg, previewId);
    applyFrameLinePreviewStyle(svg, previewId);
  }

  function applySignIconColors(iconWrap, previewId) {
    if (!iconWrap) return;
    applySignSvgColors(iconWrap.querySelector("svg"), previewId);
  }

  function resolveEmbeddedKey(filename) {
    var embedded =
      typeof window !== "undefined" ? window.LABEL_BAR_SVG_EMBEDDED : null;
    if (!filename || !embedded) return null;
    if (embedded[filename]) return filename;
    var slash = filename.lastIndexOf("/");
    if (slash >= 0) {
      var dir = filename.slice(0, slash);
      var base = filename.slice(slash + 1);
      if (dir !== "home" && embedded[base]) return base;
    }
    return null;
  }

  function getIconInnerMarkup(filename) {
    var key = resolveEmbeddedKey(filename);
    if (!key) return "";
    var embedded = window.LABEL_BAR_SVG_EMBEDDED;
    return embedded && embedded[key] ? embedded[key] : "";
  }

  function getIconDimensions(filename) {
    if (
      typeof LABEL_BAR_SVG_DIMENSIONS !== "undefined" &&
      LABEL_BAR_SVG_DIMENSIONS[filename]
    ) {
      return LABEL_BAR_SVG_DIMENSIONS[filename];
    }
    var key = resolveEmbeddedKey(filename);
    if (
      key &&
      typeof LABEL_BAR_SVG_DIMENSIONS !== "undefined" &&
      LABEL_BAR_SVG_DIMENSIONS[key]
    ) {
      return LABEL_BAR_SVG_DIMENSIONS[key];
    }
    return { width: 1, height: 1 };
  }

  function createSvgFileIcon(filename) {
    var innerMarkup = getIconInnerMarkup(filename);
    if (!innerMarkup) return null;

    var dims = getIconDimensions(filename);
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute(
      "viewBox",
      "0 0 " + String(dims.width) + " " + String(dims.height)
    );
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = innerMarkup;
    return svg;
  }

  function createPlaceholderSvg() {
    var placeholder = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    placeholder.setAttribute("viewBox", "0 0 100 100");
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.setAttribute("class", "sign-card__icon-placeholder");
    return placeholder;
  }

  function appendBilingualBlock(container, enText, faText, baseClass) {
    var en = enText != null ? String(enText) : "";
    var fa = faText != null ? String(faText) : "";
    if (!en && !fa) return container;

    if (en) {
      var enEl = document.createElement("span");
      enEl.className = baseClass + "-en";
      enEl.textContent = en;
      container.appendChild(enEl);
    }

    if (fa) {
      var faEl = document.createElement("span");
      faEl.className = baseClass + "-fa";
      faEl.setAttribute("lang", "fa");
      faEl.setAttribute("dir", "rtl");
      faEl.textContent = fa;
      container.appendChild(faEl);
    }

    return container;
  }

  function createBilingualBlock(enText, faText, baseClass) {
    var block = document.createElement("span");
    block.className = baseClass;
    appendBilingualBlock(block, enText, faText, baseClass);
    return block;
  }

  function createVisualNode(entry) {
    var visual = entry.visual || {};
    var node = null;

    if (visual.type === "svgFile" && visual.file) {
      node = createSvgFileIcon(visual.file);
    } else if (visual.type === "gridIcon" && visual.gridType) {
      if (window.GridUnitIcons && window.GridUnitIcons.createIcon) {
        node = window.GridUnitIcons.createIcon(visual.gridType);
      }
    } else if (visual.type === "canvasPreview" && visual.previewId) {
      node = createPlaceholderSvg();
      node.setAttribute("data-preview-id", visual.previewId);
    }

    if (!node) {
      node = createPlaceholderSvg();
    }

    return node;
  }

  function createSignListRow(entry) {
    var previewId =
      entry.visual && entry.visual.previewId ? entry.visual.previewId : "";

    var row = document.createElement("article");
    row.className = "page2-home-signs__sign-row";
    row.setAttribute("data-sign-id", entry.id);
    row.setAttribute("data-sign-section", entry.section || "");
    if (previewId) {
      row.setAttribute("data-preview-id", previewId);
    }
    if (previewId === "fanLeaves") {
      row.classList.add("page2-home-signs__sign-row--fan");
    }
    if (previewId === "familyFrameLine") {
      row.classList.add("page2-home-signs__sign-row--frame-line");
    }

    var iconWrap = document.createElement("div");
    iconWrap.className = "page2-home-signs__sign-icon";
    if (entry.visual && entry.visual.type === "gridIcon" && entry.visual.gridType) {
      iconWrap.setAttribute("data-grid-type", entry.visual.gridType);
    }
    if (previewId === "fanLeaves") {
      iconWrap.classList.add("page2-home-signs__sign-icon--fan");
    }
    if (previewId === "familyFrameLine") {
      iconWrap.classList.add("page2-home-signs__sign-icon--frame-line");
    }
    iconWrap.appendChild(createVisualNode(entry));
    applySignIconColors(iconWrap, previewId);

    row.appendChild(iconWrap);

    if (previewId !== "fanLeaves" && previewId !== "familyFrameLine") {
      row.appendChild(
        createBilingualBlock(
          entry.label || "",
          "",
          "page2-home-signs__sign-label"
        )
      );
    }

    return row;
  }

  var GRID_INNER_SCALE_DEFAULT = 4;

  function getGridInnerScaleConfig() {
    var catalog = getCatalog();
    if (catalog && catalog.gridInnerScaleConfig) {
      return catalog.gridInnerScaleConfig;
    }
    return {
      label:
        "How much do you feel that Iranian identity is a central part of your life today?",
      labelFa:
        "تا چه حد احساس می‌کنید هویت ایرانی بخش مرکزی زندگی‌تان امروز است؟",
      ariaLabel:
        "How much do you feel that Iranian identity is a central part of your life today? Very much in the background to at the center of my life.",
      ariaLabelFa:
        "تا چه حد احساس می‌کنید هویت ایرانی بخش مرکزی زندگی‌تان امروز است؟ از بسیار در پس‌زمینه تا در مرکز زندگی من.",
      min: 1,
      max: 10,
      step: 1,
      rangeLabels: ["Very much in the background", "At the center of my life"],
      rangeLabelsFa: ["بسیار در پس‌زمینه", "در مرکز زندگی من"],
    };
  }

  function syncSignsSliderBarFill(slider) {
    var min = Number(slider.min);
    var max = Number(slider.max);
    var val = Number(slider.value);
    var pct = max <= min ? 0 : ((val - min) / (max - min)) * 100;
    var fill = pct + "%";
    slider.style.setProperty("--bar-fill", fill);
    var track = slider.closest(".questionnaire-slider-track");
    if (track) {
      track.style.setProperty("--bar-fill", fill);
      track.classList.toggle("is-at-min", val <= min);
      track.classList.toggle("is-at-max", val >= max);
    }
  }

  function createSignsSliderTrack(slider) {
    var track = document.createElement("div");
    track.className = "questionnaire-slider-track";

    var handle = document.createElement("div");
    handle.className = "questionnaire-slider-handle";
    handle.setAttribute("aria-hidden", "true");

    var leftArrow = document.createElement("span");
    leftArrow.className =
      "questionnaire-slider-handle__arrow questionnaire-slider-handle__arrow--left";
    var rightArrow = document.createElement("span");
    rightArrow.className =
      "questionnaire-slider-handle__arrow questionnaire-slider-handle__arrow--right";

    handle.appendChild(leftArrow);
    handle.appendChild(rightArrow);
    track.appendChild(slider);
    track.appendChild(handle);
    return track;
  }

  function updateGridIconsInnerScale(panel, stepNumber) {
    var icons = panel.querySelectorAll(".page2-home-signs__sign-icon[data-grid-type]");
    if (!icons.length || !window.GridUnitIcons) return;
    var innerScale =
      typeof innerScaleValueFromStep === "function"
        ? innerScaleValueFromStep(stepNumber)
        : stepNumber / 10;
    var i;
    var iconWrap;
    var gridType;
    var svg;
    for (i = 0; i < icons.length; i++) {
      iconWrap = icons[i];
      gridType = iconWrap.getAttribute("data-grid-type");
      if (!gridType) continue;
      svg = iconWrap.querySelector("svg.grid-unit-icon");
      if (!svg) continue;
      if (window.GridUnitIcons.updateIconInnerScale) {
        window.GridUnitIcons.updateIconInnerScale(svg, gridType, innerScale);
      }
    }
  }

  var FAN_LEAVES_DEFAULT = 4;
  var FAN_LEAVES_CONFIG = {
    ariaLabel:
      "When you lived in Iran, how free did you feel to choose how to dress in public spaces? Fan leaves. Step 0 fully open, step 9 four ribs, step 10 closed.",
    min:
      typeof WEAR_CONTROL_OPENING_STEP_MIN !== "undefined"
        ? WEAR_CONTROL_OPENING_STEP_MIN
        : 0,
    max:
      typeof WEAR_CONTROL_OPENING_STEP_MAX !== "undefined"
        ? WEAR_CONTROL_OPENING_STEP_MAX
        : 10,
    step: 1,
  };

  function appendSignsPanelSlider(
    panel,
    config,
    defaultValue,
    sliderId,
    onInput,
    layoutOptions
  ) {
    layoutOptions = layoutOptions || {};
    var controlsWrap = document.createElement("div");
    controlsWrap.className = "page2-home-signs__panel-controls";
    if (layoutOptions.modifierClass) {
      controlsWrap.classList.add(layoutOptions.modifierClass);
    }

    if (!layoutOptions.hideHeading && config.label) {
      var heading = document.createElement("p");
      heading.className = "page2-home-signs__control-heading";
      appendBilingualBlock(
        heading,
        config.label,
        config.labelFa || "",
        "page2-home-signs__control-heading"
      );
      controlsWrap.appendChild(heading);
    }

    var sliderWrap = document.createElement("div");
    sliderWrap.className = "questionnaire-slider-wrap";

    if (
      !layoutOptions.hideRangeLabels &&
      config.rangeLabels &&
      config.rangeLabels.length
    ) {
      var rangeLabels = document.createElement("div");
      rangeLabels.className = "questionnaire-slider-range-labels";
      rangeLabels.setAttribute("aria-hidden", "true");
      config.rangeLabels.forEach(function (label, index) {
        var span = document.createElement("span");
        span.className = "questionnaire-slider-range-label";
        if (index === config.rangeLabels.length - 1) {
          span.classList.add("questionnaire-slider-range-label--end");
        }
        var faLabel =
          config.rangeLabelsFa && config.rangeLabelsFa[index]
            ? config.rangeLabelsFa[index]
            : "";
        appendBilingualBlock(span, label, faLabel, "questionnaire-slider-range-label");
        rangeLabels.appendChild(span);
      });
      sliderWrap.appendChild(rangeLabels);
    }

    var control = document.createElement("div");
    control.className = "questionnaire-slider-control";

    var slider = document.createElement("input");
    slider.type = "range";
    slider.className = "questionnaire-slider";
    slider.min = String(config.min);
    slider.max = String(config.max);
    slider.step = String(config.step || 1);
    slider.value = String(defaultValue);
    slider.setAttribute(
      "aria-label",
      config.ariaLabelFa
        ? config.ariaLabel + " / " + config.ariaLabelFa
        : config.ariaLabel
    );
    slider.id = sliderId;

    slider.addEventListener("input", function () {
      syncSignsSliderBarFill(slider);
      if (onInput) onInput(Number(slider.value));
    });

    control.appendChild(createSignsSliderTrack(slider));
    syncSignsSliderBarFill(slider);

    if (!layoutOptions.hideOutput) {
      var output = document.createElement("output");
      output.className = "questionnaire-slider-output";
      output.setAttribute("for", slider.id);
      output.textContent = String(defaultValue);
      slider.addEventListener("input", function () {
        output.textContent = slider.value;
      });
      control.appendChild(output);
    }

    sliderWrap.appendChild(control);
    controlsWrap.appendChild(sliderWrap);
    panel.appendChild(controlsWrap);

    return slider;
  }

  function appendGridInnerScaleSlider(panel) {
    appendSignsPanelSlider(
      panel,
      getGridInnerScaleConfig(),
      GRID_INNER_SCALE_DEFAULT,
      "page2-home-signs-grid-inner-scale",
      function (stepNumber) {
        updateGridIconsInnerScale(panel, stepNumber);
      },
      {
        modifierClass: "page2-home-signs__panel-controls--compact",
        hideHeading: true,
        hideRangeLabels: true,
        hideOutput: true,
      }
    );
    updateGridIconsInnerScale(panel, GRID_INNER_SCALE_DEFAULT);
  }

  function updateFanPreview(panel, step) {
    var row = panel.querySelector('[data-preview-id="fanLeaves"]');
    if (
      !row ||
      !window.UnderCoverSignPreviews ||
      typeof window.UnderCoverSignPreviews.renderPreview !== "function"
    ) {
      return;
    }

    var iconWrap = row.querySelector(".page2-home-signs__sign-icon");
    if (!iconWrap) return;

    var previewSvg = window.UnderCoverSignPreviews.renderPreview("fanLeaves", {
      fanLeavesStep: step,
      signsFanTightCrop: true,
      signsFanPreserveClip: true,
    });
    if (!previewSvg) return;

    iconWrap.innerHTML = "";
    iconWrap.appendChild(previewSvg);
    applySignIconColors(iconWrap, "fanLeaves");
    row.setAttribute("data-preview-hydrated", "true");
  }

  function appendFanLeavesSlider(panel) {
    appendSignsPanelSlider(
      panel,
      FAN_LEAVES_CONFIG,
      FAN_LEAVES_DEFAULT,
      "page2-home-signs-fan-leaves",
      function (step) {
        updateFanPreview(panel, step);
      },
      {
        modifierClass: "page2-home-signs__panel-controls--compact",
        hideHeading: true,
        hideRangeLabels: true,
        hideOutput: true,
      }
    );
    if (
      window.UnderCoverSignPreviews &&
      window.UnderCoverSignPreviews.isReady &&
      window.UnderCoverSignPreviews.isReady()
    ) {
      updateFanPreview(panel, FAN_LEAVES_DEFAULT);
    }
  }

  /**
   * Family section frame-line divisions slider: 3 discrete steps that map to
   * the engine's border-frame-divisions levels (1 = Minimum, 2 = Medium,
   * 3 = Maximum). Controls how many divisions the single horizontal frame
   * line is split into.
   */
  var FAMILY_DIVISIONS_DEFAULT = 2;
  var FAMILY_DIVISIONS_CONFIG = {
    ariaLabel:
      "Number of divisions in the family frame line. Minimum to maximum.",
    ariaLabelFa: "تعداد بخش‌های خط قاب خانواده. از کمینه تا بیشینه.",
    min: 1,
    max: 3,
    step: 1,
  };

  function updateFamilyFramePreview(panel, step) {
    var row = panel.querySelector('[data-preview-id="familyFrameLine"]');
    if (
      !row ||
      !window.UnderCoverSignPreviews ||
      typeof window.UnderCoverSignPreviews.renderPreview !== "function"
    ) {
      return;
    }

    var iconWrap = row.querySelector(".page2-home-signs__sign-icon");
    if (!iconWrap) return;

    var previewSvg = window.UnderCoverSignPreviews.renderPreview(
      "familyFrameLine",
      { borderFrameDivisions: step }
    );
    if (!previewSvg) return;

    iconWrap.innerHTML = "";
    iconWrap.appendChild(previewSvg);
    applySignIconColors(iconWrap, "familyFrameLine");
    row.setAttribute("data-preview-hydrated", "true");
  }

  function appendFamilyDivisionsSlider(panel) {
    appendSignsPanelSlider(
      panel,
      FAMILY_DIVISIONS_CONFIG,
      FAMILY_DIVISIONS_DEFAULT,
      "page2-home-signs-family-divisions",
      function (step) {
        updateFamilyFramePreview(panel, step);
      },
      {
        modifierClass: "page2-home-signs__panel-controls--compact",
        hideHeading: true,
        hideRangeLabels: true,
        hideOutput: true,
      }
    );
    if (
      window.UnderCoverSignPreviews &&
      window.UnderCoverSignPreviews.isReady &&
      window.UnderCoverSignPreviews.isReady()
    ) {
      updateFamilyFramePreview(panel, FAMILY_DIVISIONS_DEFAULT);
    }
  }

  function populateFamilyAccordionPanel(panel) {
    var entries = entriesBySection.family || [];
    if (!entries.length) return;

    var listWrap = document.createElement("div");
    listWrap.className =
      "page2-home-signs__panel-list page2-home-signs__panel-list--frame-line";
    listWrap.setAttribute("data-sign-count", "1");

    listWrap.appendChild(createSignListRow(entries[0]));
    panel.appendChild(listWrap);
    appendFamilyDivisionsSlider(panel);
    panel.setAttribute("data-populated", "true");
  }

  function populateBodyAutonomyAccordionPanel(panel) {
    var entries = entriesBySection.bodyAutonomy || [];
    if (!entries.length) return;

    var listWrap = document.createElement("div");
    listWrap.className =
      "page2-home-signs__panel-list page2-home-signs__panel-list--fan";
    listWrap.setAttribute("data-sign-count", String(entries.length));

    var fragment = document.createDocumentFragment();
    var i;
    for (i = 0; i < entries.length; i++) {
      fragment.appendChild(createSignListRow(entries[i]));
    }
    listWrap.appendChild(fragment);
    panel.appendChild(listWrap);
    appendFanLeavesSlider(panel);
    panel.setAttribute("data-populated", "true");
  }

  function populateGridAccordionPanel(panel) {
    var entries = entriesBySection.grid || [];
    if (!entries.length) return;

    var listWrap = document.createElement("div");
    listWrap.className = "page2-home-signs__panel-list";
    listWrap.setAttribute("data-sign-count", String(entries.length));

    var fragment = document.createDocumentFragment();
    var i;
    for (i = 0; i < entries.length; i++) {
      fragment.appendChild(createSignListRow(entries[i]));
    }
    listWrap.appendChild(fragment);
    panel.appendChild(listWrap);
    appendGridInnerScaleSlider(panel);
    panel.setAttribute("data-populated", "true");
  }

  /**
   * Cycling sections (profile, feelings): build every sign row once, stacked in
   * the same centered cell (the CSS overlaps them), and mark only the first row
   * `is-cycle-active` so it is the one shown. startSignsCycleLoop then advances
   * which row is active over time.
   */
  function populateCyclingAccordionPanel(panel, sectionId) {
    var entries = entriesBySection[sectionId] || [];
    if (!entries.length) return;

    var listWrap = document.createElement("div");
    listWrap.className =
      "page2-home-signs__panel-list page2-home-signs__panel-list--cycle";
    listWrap.setAttribute("data-sign-count", String(entries.length));

    var fragment = document.createDocumentFragment();
    var i;
    var row;
    for (i = 0; i < entries.length; i++) {
      row = createSignListRow(entries[i]);
      if (i === 0) {
        row.classList.add("is-cycle-active");
      }
      fragment.appendChild(row);
    }
    listWrap.appendChild(fragment);
    panel.appendChild(listWrap);
    panel.setAttribute("data-populated", "true");
  }

  function populateAccordionPanel(sectionId) {
    var panel = document.getElementById("page2-home-signs-panel-" + sectionId);
    if (!panel || panel.getAttribute("data-populated") === "true") {
      return;
    }

    if (SIGNS_CYCLE_SECTIONS[sectionId]) {
      populateCyclingAccordionPanel(panel, sectionId);
      return;
    }

    if (sectionId === "grid") {
      populateGridAccordionPanel(panel);
      return;
    }

    if (sectionId === "bodyAutonomy") {
      populateBodyAutonomyAccordionPanel(panel);
      return;
    }

    if (sectionId === "family") {
      populateFamilyAccordionPanel(panel);
      return;
    }

    var entries = entriesBySection[sectionId] || [];
    if (!entries.length) return;

    var listWrap = document.createElement("div");
    listWrap.className = "page2-home-signs__panel-list";
    listWrap.setAttribute("data-sign-count", String(entries.length));

    var fragment = document.createDocumentFragment();
    var i;
    for (i = 0; i < entries.length; i++) {
      fragment.appendChild(createSignListRow(entries[i]));
    }
    listWrap.appendChild(fragment);
    panel.appendChild(listWrap);
    panel.setAttribute("data-populated", "true");
  }

  /**
   * Per-section auto-animation settings. Instead of dragging a slider, each
   * Signs visual animates on its own with a frame-synced (requestAnimationFrame)
   * loop that sweeps smoothly back and forth between `min` and `max`.
   *
   * - grid (kind "grid"): driven CONTINUOUSLY — the inner scale flows through
   *   every in-between value, so it glides like a dragged slider.
   * - bodyAutonomy (kind "fan") and family (kind "family"): the drawing engine
   *   only has whole steps (fan ribs / 3 frames), so we round to the nearest
   *   step and only redraw when it changes. The MOTION is smooth/eased, but the
   *   shape still lands on whole states because that is how the art is built.
   *
   * `sweepMs` = time for one min->max pass (a full open+close is ~2x that).
   * `staticValue` = the single frame shown when the user prefers reduced motion.
   */
  var SIGNS_AUTO_ANIMATIONS = {
    grid: {
      kind: "grid",
      min: 1,
      max: 10,
      sweepMs: 2200,
      staticValue: 7,
    },
    bodyAutonomy: {
      kind: "fan",
      min: 1,
      max: 10,
      sweepMs: 4400,
      staticValue: 4,
    },
    family: {
      kind: "family",
      min: 1,
      max: 3,
      sweepMs: 1500,
      staticValue: 2,
    },
  };

  /**
   * Sections whose signs are NOT shown all at once. Instead a single sign is
   * displayed in one fixed (centered) position and the visible sign swaps to the
   * next one every `intervalMs`, looping through the whole list. profile and
   * feelings use this so their many signs read one-at-a-time.
   */
  var SIGNS_CYCLE_SECTIONS = {
    profile: { intervalMs: 1000 },
    feelings: { intervalMs: 1000 },
  };

  function prefersReducedMotionSigns() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /**
   * Grid only: feed a CONTINUOUS step value (e.g. 4.37) straight into the grid
   * icon geometry. innerScaleValueFromStep would round to whole steps, so here
   * we interpolate the internal inner-scale (INNER_SCALE_MIN..MAX) ourselves to
   * keep the motion perfectly fluid.
   */
  function setGridIconsInnerScaleContinuous(panel, stepFloat) {
    var icons = panel.querySelectorAll(
      ".page2-home-signs__sign-icon[data-grid-type]"
    );
    if (
      !icons.length ||
      !window.GridUnitIcons ||
      !window.GridUnitIcons.updateIconInnerScale
    ) {
      return;
    }
    var steps =
      typeof INNER_SCALE_STEPS !== "undefined" ? INNER_SCALE_STEPS : 10;
    var minScale =
      typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
    var maxScale =
      typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    var t = steps > 1 ? (stepFloat - 1) / (steps - 1) : 1;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var innerScale = minScale + t * (maxScale - minScale);

    var i;
    var iconWrap;
    var gridType;
    var svg;
    for (i = 0; i < icons.length; i++) {
      iconWrap = icons[i];
      gridType = iconWrap.getAttribute("data-grid-type");
      if (!gridType) continue;
      svg = iconWrap.querySelector("svg.grid-unit-icon");
      if (!svg) continue;
      window.GridUnitIcons.updateIconInnerScale(svg, gridType, innerScale);
    }
  }

  /**
   * Fan only (Signs page): we cannot touch the engine, which only has 11 whole
   * open/close positions. So on the Signs page we render ONE fully-open fan and
   * add our own *continuous* open/close stages with an angular wedge mask
   * anchored at the fan's hinge.
   *
   * The hinge (focal point) sits at the bottom-centre of the cropped fan icon
   * (x = 50%, y ~= 102% of the box, derived from CANVAS + the Signs crop rect).
   * The fan's LEFT rib is the fixed edge: a conic-gradient mask anchors its left
   * boundary at ~ -90deg (pointing left from the hinge) and grows the revealed
   * span clockwise toward the right. A tiny span keeps only the left rib =
   * closed; a ~180deg span reveals the whole fan = open. The left base stays
   * static while the fan unfolds/folds to the right. Masking never distorts the
   * art and is infinitely smooth.
   */
  var FAN_PIVOT_X = "50%";
  var FAN_PIVOT_Y = "102%";
  var FAN_LEFT_ANGLE = -90;
  var FAN_OPEN_SPAN = 180;
  /**
   * On the Signs page the fan should NOT collapse all the way to a single rib.
   * Instead the close phase stops while 3 fan leaves are still open (see the
   * reference image). The full fan has RADIAL_FAN_RIB_COUNT ribs spread evenly
   * across FAN_OPEN_SPAN (180deg), which makes (ribCount - 1) leaves between
   * them. We reveal FAN_CLOSED_LEAVES of those leaves at the most-closed point,
   * so the closed span = open span * (closed leaves / total leaves).
   */
  var FAN_CLOSED_LEAVES = 3;
  var FAN_TOTAL_LEAVES =
    (typeof RADIAL_FAN_RIB_COUNT !== "undefined" ? RADIAL_FAN_RIB_COUNT : 25) -
    1;
  var FAN_CLOSED_SPAN =
    FAN_TOTAL_LEAVES > 0
      ? FAN_OPEN_SPAN * (FAN_CLOSED_LEAVES / FAN_TOTAL_LEAVES)
      : 12;
  var FAN_OPEN_BASE_STEP =
    typeof WEAR_CONTROL_OPENING_STEP_MIN !== "undefined"
      ? WEAR_CONTROL_OPENING_STEP_MIN
      : 0;

  function fanWedgeMask(spanDeg) {
    var span = spanDeg.toFixed(2);
    return (
      "conic-gradient(from " +
      FAN_LEFT_ANGLE +
      "deg at " +
      FAN_PIVOT_X +
      " " +
      FAN_PIVOT_Y +
      ", #000 0deg, #000 " +
      span +
      "deg, transparent " +
      span +
      "deg)"
    );
  }

  function applyFanWedge(svg, spanDeg) {
    var mask = fanWedgeMask(spanDeg);
    svg.style.webkitMaskImage = mask;
    svg.style.maskImage = mask;
  }

  function ensureFanBaseSvg(panel) {
    if (
      !window.UnderCoverSignPreviews ||
      !window.UnderCoverSignPreviews.isReady ||
      !window.UnderCoverSignPreviews.isReady() ||
      typeof window.UnderCoverSignPreviews.renderPreview !== "function"
    ) {
      return null;
    }

    var row = panel.querySelector('[data-preview-id="fanLeaves"]');
    if (!row) return null;
    var iconWrap = row.querySelector(".page2-home-signs__sign-icon");
    if (!iconWrap) return null;

    var existing = iconWrap.querySelector("svg[data-fan-base]");
    if (existing) return existing;

    var svg = window.UnderCoverSignPreviews.renderPreview("fanLeaves", {
      fanLeavesStep: FAN_OPEN_BASE_STEP,
      signsFanTightCrop: true,
      signsFanPreserveClip: true,
    });
    if (!svg) return null;

    svg.setAttribute("data-fan-base", "1");
    iconWrap.innerHTML = "";
    iconWrap.appendChild(svg);
    applySignSvgColors(svg, "fanLeaves");
    row.setAttribute("data-preview-hydrated", "true");
    return svg;
  }

  /**
   * Draw one frame for a section. Grid flows continuously; fan reveals a
   * continuous angular wedge over a single open frame; family redraws on step
   * change.
   */
  function renderSignsAnimationFrame(panel, cfg, valueFloat, loopState) {
    if (cfg.kind === "grid") {
      setGridIconsInnerScaleContinuous(panel, valueFloat);
      return;
    }

    if (cfg.kind === "fan") {
      if (!loopState.fanBase || !loopState.fanBase.isConnected) {
        loopState.fanBase = ensureFanBaseSvg(panel);
        if (!loopState.fanBase) return;
      }
      var tNorm = (valueFloat - cfg.min) / (cfg.max - cfg.min);
      if (tNorm < 0) tNorm = 0;
      if (tNorm > 1) tNorm = 1;
      // Loop starts at tNorm 0 = closed; tNorm 1 = fully open. Left edge fixed,
      // right edge sweeps open.
      var span = FAN_CLOSED_SPAN + tNorm * (FAN_OPEN_SPAN - FAN_CLOSED_SPAN);
      applyFanWedge(loopState.fanBase, span);
      return;
    }

    var step = Math.round(valueFloat);
    if (loopState.lastStep === step) return;
    loopState.lastStep = step;
    updateFamilyFramePreview(panel, step);
  }

  function stopSignsAnimationLoop(sectionId) {
    var loop = signsAnimationLoops[sectionId];
    if (loop && loop.raf) {
      window.cancelAnimationFrame(loop.raf);
    }
    delete signsAnimationLoops[sectionId];
  }

  function stopAllSignsAnimationLoops() {
    var key;
    for (key in signsAnimationLoops) {
      if (!signsAnimationLoops.hasOwnProperty(key)) continue;
      if (signsAnimationLoops[key].raf) {
        window.cancelAnimationFrame(signsAnimationLoops[key].raf);
      }
    }
    signsAnimationLoops = {};
  }

  /**
   * Frame-synced ping-pong loop. A sine curve gives a value that eases in and
   * out at both ends (slow near fully open / fully closed, quicker through the
   * middle), so the sweep reads as a smooth, breathing open/close rather than a
   * series of ticks.
   */
  function startSignsAnimationLoop(sectionId, cfg, panel) {
    if (!cfg || !panel) return;
    stopSignsAnimationLoop(sectionId);

    var min = cfg.min;
    var max = cfg.max;
    if (!isFinite(min) || !isFinite(max) || max <= min) return;

    var loopState = { raf: 0, lastStep: null, startTime: null };

    if (prefersReducedMotionSigns()) {
      var staticValue =
        cfg.staticValue != null ? cfg.staticValue : (min + max) / 2;
      if (cfg.kind === "grid") {
        setGridIconsInnerScaleContinuous(panel, staticValue);
      } else if (cfg.kind === "fan") {
        updateFanPreview(panel, Math.round(staticValue));
      } else if (cfg.kind === "family") {
        updateFamilyFramePreview(panel, Math.round(staticValue));
      }
      return;
    }

    var sweepMs = cfg.sweepMs || 2200;
    var periodMs = sweepMs * 2;

    function frame(now) {
      if (loopState.startTime === null) loopState.startTime = now;
      var elapsed = now - loopState.startTime;
      var theta = ((elapsed % periodMs) / periodMs) * 2 * Math.PI;
      var eased = 0.5 - 0.5 * Math.cos(theta);
      var value = min + eased * (max - min);
      renderSignsAnimationFrame(panel, cfg, value, loopState);
      loopState.raf = window.requestAnimationFrame(frame);
    }

    loopState.raf = window.requestAnimationFrame(frame);
    signsAnimationLoops[sectionId] = loopState;
  }

  /**
   * Cycle loop: every `intervalMs` move the `is-cycle-active` class to the next
   * sign row, wrapping back to the first. Frame-synced via requestAnimationFrame
   * and stored in signsAnimationLoops so the existing pause/resume/stop helpers
   * (which cancel `loop.raf`) clean it up too. When the user prefers reduced
   * motion we leave the first sign showing and never loop.
   */
  function startSignsCycleLoop(sectionId, cfg, panel) {
    if (!cfg || !panel) return;
    stopSignsAnimationLoop(sectionId);

    var rows = panel.querySelectorAll(".page2-home-signs__sign-row");
    if (!rows.length) return;

    var activeIndex = 0;
    var i;
    for (i = 0; i < rows.length; i++) {
      rows[i].classList.toggle("is-cycle-active", i === 0);
    }

    if (rows.length < 2 || prefersReducedMotionSigns()) {
      return;
    }

    var intervalMs = cfg.intervalMs || 500;
    var loopState = { raf: 0, startTime: null };

    function frame(now) {
      if (loopState.startTime === null) loopState.startTime = now;
      var elapsed = now - loopState.startTime;
      var nextIndex = Math.floor(elapsed / intervalMs) % rows.length;
      if (nextIndex !== activeIndex) {
        rows[activeIndex].classList.remove("is-cycle-active");
        rows[nextIndex].classList.add("is-cycle-active");
        activeIndex = nextIndex;
      }
      loopState.raf = window.requestAnimationFrame(frame);
    }

    loopState.raf = window.requestAnimationFrame(frame);
    signsAnimationLoops[sectionId] = loopState;
  }

  function startSignsAnimationForSection(sectionId) {
    var panel = document.getElementById("page2-home-signs-panel-" + sectionId);
    if (!panel) return;

    if (SIGNS_CYCLE_SECTIONS[sectionId]) {
      startSignsCycleLoop(sectionId, SIGNS_CYCLE_SECTIONS[sectionId], panel);
      return;
    }

    var cfg = SIGNS_AUTO_ANIMATIONS[sectionId];
    if (!cfg) return;
    startSignsAnimationLoop(sectionId, cfg, panel);
  }

  function pauseSignsAnimations() {
    stopAllSignsAnimationLoops();
  }

  function resumeSignsAnimations() {
    var sectionId;
    for (sectionId in SIGNS_AUTO_ANIMATIONS) {
      if (!SIGNS_AUTO_ANIMATIONS.hasOwnProperty(sectionId)) continue;
      startSignsAnimationForSection(sectionId);
    }
    for (sectionId in SIGNS_CYCLE_SECTIONS) {
      if (!SIGNS_CYCLE_SECTIONS.hasOwnProperty(sectionId)) continue;
      startSignsAnimationForSection(sectionId);
    }
  }

  function getCatalog() {
    return window.SignsCatalog || null;
  }

  function indexEntriesBySection(catalog) {
    entriesBySection = {};
    var entries = catalog.entries || [];
    var i;
    var entry;
    var sectionId;

    for (i = 0; i < entries.length; i++) {
      entry = entries[i];
      sectionId = entry.section || "";
      if (!sectionId) continue;
      if (!entriesBySection[sectionId]) {
        entriesBySection[sectionId] = [];
      }
      entriesBySection[sectionId].push(entry);
    }
  }

  function createAccordionItem(sectionMeta, index) {
    var item = document.createElement("article");
    item.className = "page2-home-signs__item";
    item.setAttribute("data-sign-section", sectionMeta.id);
    item.setAttribute("role", "listitem");
    item.id = "page2-home-signs-item-" + sectionMeta.id;

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "page2-home-signs__trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute(
      "aria-controls",
      "page2-home-signs-panel-" + sectionMeta.id
    );
    trigger.id = "page2-home-signs-trigger-" + sectionMeta.id;

    var num = document.createElement("span");
    num.className = "page2-home-signs__num";
    num.textContent = String(index + 1);

    var title = createBilingualBlock(
      sectionMeta.label || sectionMeta.id,
      sectionMeta.labelFa || "",
      "page2-home-signs__title"
    );

    var desc = createBilingualBlock(
      sectionMeta.description || "",
      sectionMeta.descriptionFa || "",
      "page2-home-signs__desc"
    );
    if (!sectionMeta.description && !sectionMeta.descriptionFa) {
      desc.classList.add("page2-home-signs__desc--empty");
    }

    trigger.appendChild(num);
    trigger.appendChild(title);
    trigger.appendChild(desc);

    var panel = document.createElement("div");
    panel.className = "page2-home-signs__panel";
    panel.id = "page2-home-signs-panel-" + sectionMeta.id;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", trigger.id);
    panel.hidden = true;

    // Signs page is always-open now: the header is a static label, not a
    // toggle, so we intentionally do not attach click/keydown listeners.

    item.appendChild(trigger);
    item.appendChild(panel);
    return item;
  }

  function buildHomeSignsAccordion() {
    if (built) return;

    var listEl = document.getElementById("page2-home-signs-list");
    if (!listEl) return;

    var catalog = getCatalog();
    if (
      !catalog ||
      !Array.isArray(catalog.entries) ||
      !catalog.entries.length ||
      !Array.isArray(catalog.sections) ||
      !catalog.sections.length
    ) {
      return;
    }

    indexEntriesBySection(catalog);

    var fragment = document.createDocumentFragment();
    accordionItems = [];

    var i;
    var sectionMeta;
    var item;
    for (i = 0; i < catalog.sections.length; i++) {
      sectionMeta = catalog.sections[i];
      if (!entriesBySection[sectionMeta.id]) continue;

      item = createAccordionItem(sectionMeta, accordionItems.length);
      accordionItems.push(item);
      fragment.appendChild(item);
    }

    listEl.appendChild(fragment);
    built = true;
    openAllSections();
  }

  /**
   * Signs page now has no closed state: every section is permanently expanded.
   * We mark all items open, populate + hydrate their panels, and start each
   * section's auto-animation loop so all visuals animate at once (the per-loop
   * stop in startSignsAnimationLoop is scoped to its own section id, so the
   * loops coexist instead of cancelling each other).
   */
  function openAllSections() {
    var i;
    var item;
    var sectionId;
    var trigger;
    var panel;
    for (i = 0; i < accordionItems.length; i++) {
      item = accordionItems[i];
      sectionId = item.getAttribute("data-sign-section");
      item.classList.add("is-expanded");
      trigger = item.querySelector(".page2-home-signs__trigger");
      panel = item.querySelector(".page2-home-signs__panel");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "true");
      }
      if (panel) {
        panel.hidden = false;
      }
      populateAccordionPanel(sectionId);
      hydrateCanvasPreviewsForSection(sectionId);
      startSignsAnimationForSection(sectionId);
    }
    updateScrollability();
  }

  function updateScrollability() {
    if (
      window.Page2Navigation &&
      typeof window.Page2Navigation.updateScrollability === "function"
    ) {
      window.Page2Navigation.updateScrollability();
    }
  }

  function getFanLeavesStepFromPanel(row) {
    var panel = row.closest(".page2-home-signs__panel");
    if (!panel) return null;
    var slider = panel.querySelector("#page2-home-signs-fan-leaves");
    if (!slider) return null;
    return Number(slider.value);
  }

  function getFamilyDivisionsStepFromPanel(row) {
    var panel = row.closest(".page2-home-signs__panel");
    if (!panel) return null;
    var slider = panel.querySelector("#page2-home-signs-family-divisions");
    if (!slider) return null;
    return Number(slider.value);
  }

  function hydrateCanvasPreviewRow(row) {
    var previewId = row.getAttribute("data-preview-id");
    if (!previewId) return;
    if (
      !window.UnderCoverSignPreviews ||
      typeof window.UnderCoverSignPreviews.renderPreview !== "function"
    ) {
      return;
    }

    var iconWrap = row.querySelector(".page2-home-signs__sign-icon");
    if (!iconWrap || row.getAttribute("data-preview-hydrated") === "true") {
      return;
    }

    var previewOptions = null;
    if (previewId === "fanLeaves") {
      var fanStep = getFanLeavesStepFromPanel(row);
      if (fanStep !== null && isFinite(fanStep)) {
        previewOptions = {
          fanLeavesStep: fanStep,
          signsFanTightCrop: true,
          signsFanPreserveClip: true,
        };
      } else {
        previewOptions = {
          signsFanTightCrop: true,
          signsFanPreserveClip: true,
        };
      }
    } else if (previewId === "familyFrameLine") {
      var divStep = getFamilyDivisionsStepFromPanel(row);
      if (divStep !== null && isFinite(divStep)) {
        previewOptions = { borderFrameDivisions: divStep };
      }
    }

    var previewSvg = window.UnderCoverSignPreviews.renderPreview(
      previewId,
      previewOptions
    );
    if (!previewSvg) return;

    iconWrap.innerHTML = "";
    iconWrap.appendChild(previewSvg);
    applySignIconColors(iconWrap, previewId);
    row.setAttribute("data-preview-hydrated", "true");
  }

  function getAccordionPreviewRows(sectionId) {
    var selector =
      "#page2-home-signs .page2-home-signs__sign-row[data-preview-id]";
    if (sectionId) {
      selector +=
        '[data-sign-section="' + sectionId + '"]';
    }
    return document.querySelectorAll(selector);
  }

  function hydrateCanvasPreviewsForSection(sectionId) {
    if (
      !window.UnderCoverSignPreviews ||
      !window.UnderCoverSignPreviews.isReady ||
      !window.UnderCoverSignPreviews.isReady()
    ) {
      return;
    }

    if (sectionId === "bodyAutonomy") {
      var fanPanel = document.getElementById(
        "page2-home-signs-panel-bodyAutonomy"
      );
      if (fanPanel && fanPanel.getAttribute("data-populated") === "true") {
        var fanSlider = fanPanel.querySelector("#page2-home-signs-fan-leaves");
        var fanStep = fanSlider
          ? Number(fanSlider.value)
          : FAN_LEAVES_DEFAULT;
        updateFanPreview(fanPanel, fanStep);
      }
      return;
    }

    if (sectionId === "family") {
      var framePanel = document.getElementById(
        "page2-home-signs-panel-family"
      );
      if (framePanel && framePanel.getAttribute("data-populated") === "true") {
        var divSlider = framePanel.querySelector(
          "#page2-home-signs-family-divisions"
        );
        var divStepValue = divSlider
          ? Number(divSlider.value)
          : FAMILY_DIVISIONS_DEFAULT;
        updateFamilyFramePreview(framePanel, divStepValue);
      }
      return;
    }

    var rows = getAccordionPreviewRows(sectionId);
    var i;
    for (i = 0; i < rows.length; i++) {
      hydrateCanvasPreviewRow(rows[i]);
    }
  }

  function hydrateCanvasPreviews() {
    if (
      !window.UnderCoverSignPreviews ||
      !window.UnderCoverSignPreviews.isReady ||
      !window.UnderCoverSignPreviews.isReady()
    ) {
      return;
    }

    var rows = getAccordionPreviewRows("");
    var i;
    for (i = 0; i < rows.length; i++) {
      hydrateCanvasPreviewRow(rows[i]);
    }
    updateScrollability();
  }

  function hydrateCanvasPreviewCard(card) {
    hydrateCanvasPreviewRow(card);
  }

  function buildSignsLayout() {
    buildHomeSignsAccordion();
  }

  function onSignPreviewsReady() {
    var rows = getAccordionPreviewRows("");
    var i;
    for (i = 0; i < rows.length; i++) {
      rows[i].removeAttribute("data-preview-hydrated");
    }
    // All sections are open, so re-hydrate every preview row at once.
    hydrateCanvasPreviews();
  }

  function init() {
    buildSignsLayout();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        pauseSignsAnimations();
      } else {
        resumeSignsAnimations();
      }
    });
    window.addEventListener(
      "undercover:sign-previews-ready",
      onSignPreviewsReady
    );
    if (
      window.UnderCoverSignPreviews &&
      window.UnderCoverSignPreviews.isReady &&
      window.UnderCoverSignPreviews.isReady()
    ) {
      onSignPreviewsReady();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.SignsPage = {
    build: buildSignsLayout,
    hydrateCanvasPreviews: hydrateCanvasPreviews,
  };
})();

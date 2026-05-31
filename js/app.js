(function () {
  "use strict";

  var HALF_CIRCLE_BUILD_ID = "half-circle-y450-2026-05-28T16:30";
  var HALF_CIRCLE_RADIUS_SCALE = 0.9;
  var HALF_CIRCLE_INNER_ARC_PAIR_GAP_PX = 20;
  var HALF_CIRCLE_FAN_STROKE_WIDTH = 1.5;
  var HALF_CIRCLE_FOCAL_Y = 450;
  var NS = "http://www.w3.org/2000/svg";
  var designSvg = null;
  var cachedExportFontDataUri = null;
  var lastOctagonsN = OCTAGONS_N_DEFAULT;
  var lastTileSize = CANVAS_W / (OCTAGONS_N_DEFAULT + 1);
  var gridType = GRID_TYPE_OCTAGON;
  var starValidLayouts = [];
  var cachedAllSegments = [];
  /** @type {{ outline: {x:number,y:number}[] }[]} */
  var cachedStarFills = [];
  var cachedVerticalGridLines = [];
  var lastVerticalGridLayoutSignature = "";

  var interactionMode = "view";
  var removedEdges = new Set();
  /** Edges removed by Auto Merge (separate from manual merge mask/dots). */
  var autoMergeEdgeKeys = new Set();
  /** @type {{ points: { x: number, y: number }[] }[] | null} */
  var autoMergeFillRegions = null;
  var dragPath = [];
  var isDragging = false;

  var circleSelectedIds = new Set();
  var lastCircleLayoutSignature = "";
  var longingCircleSelectedIds = new Set();
  var lastLongingCircleLayoutSignature = "";
  var griefCircleSelectedIds = new Set();
  var lastGriefCircleLayoutSignature = "";
  var helplessnessSelectedIds = new Set();
  var lastHelplessnessLayoutSignature = "";
  var GRIEF_INNER_CIRCLE_DIAMETER_GAP_PX = 18;
  var diamondFilledIds = new Set();
  var lastDiamondLayoutSignature = "";
  var guiltShameFilledIds = new Set();
  var HOPE_STIPPLE_IMAGE = "stipple-1779907006832.png";
  var HOPE_DOTS_MASK_ID = "hope-dots-mask";
  var HOPE_DOTS_MASK_INVERT_FILTER_ID = "hope-dots-mask-invert-filter";
  var hopeStippleImageReady = false;
  var hopeStippleImageElement = null;
  var hopeStippleExportDataUri = null;
  var hopeStippleRawExportDataUri = null;
  /** Frame inset overlay (lines, caps, ellipses, diagonals); default hidden */
  var frameInsetOverlayVisible = false;

  /** Feelings On/Off toggles — which emotion layers are drawn on the canvas. */
  var emotionCanvasVisible = {
    anger: true,
    fear: true,
    hope: true,
    sadness: true,
    longing: true,
    grief: true,
    pride: true,
    happiness: true,
    pain: true,
    guiltShame: true,
  };

  var FEELINGS_CANVAS_KEYS = [
    "anger",
    "fear",
    "hope",
    "sadness",
    "longing",
    "grief",
    "pride",
    "happiness",
    "pain",
    "guiltShame",
  ];

  /** Persist mask holes so continued merging cannot drop earlier cutouts. */
  var stickyMergedCutoutFaces = null;

  /** Random column edges for brown-bar outer-third grid (regenerated on layout change). */
  var cachedBrownBarGridXBounds = null;
  var lastBrownBarGridLayoutSignature = "";
  /** Random height ratios for left/right margin rows (regenerated on slider input). */
  var cachedBorderSideSegmentRatios = null;
  /** Stable shuffled order for whitening left/right margin division cells. */
  var cachedBorderSideWhiteCellOrder = null;
  /** Cell ids (col-row) currently painted white by the color-fade slider. */
  var borderSideWhiteCellIds = new Set();
  /** One random 8-digit serial per page load (top + bottom white strips). */
  var canvasEdgeSerial = null;
  /** Five random rects tiling the grid frame (normalized 0–1 within layout bounds). */
  var cachedColorDivisionNormalizedRects = null;
  /** Maps area slot (0–3) → index in cachedColorDivisionNormalizedRects (shuffled). */
  var cachedColorDivisionRectOrder = null;
  var lastColorDivisionLayoutSignature = "";
  /** Incremented by Shuffle layout to force a new Mondrian-style split. */
  var colorDivisionShuffleSeed = 0;
  /** Cached inline SVG assets for the dynamic label bar. */
  var labelBarSvgCache = {};
  var labelBarSvgLoadPromises = {};

  var magnifierCenterX = CANVAS_W / 2;
  var magnifierCenterY = CANVAS_H / 2;
  var magnifierListenersBound = false;

  /**
   * Symmetric border thickness (px) so the white ring area = CANVAS_BORDER_AREA_RATIO × canvas.
   * Solves 2b(W+H) − 4b² = ratio·W·H for the smaller root.
   * @returns {number}
   */
  function getCanvasBorderPx() {
    var target = CANVAS_BORDER_AREA_RATIO * CANVAS_W * CANVAS_H;
    var halfPerimeter = CANVAS_W + CANVAS_H;
    var disc = halfPerimeter * halfPerimeter - 4 * target;
    if (disc < 0) disc = 0;
    return Math.max(0, (halfPerimeter - Math.sqrt(disc)) / 4);
  }

  /** Uniform scale so circles/octagons keep correct proportions (never stretch X vs Y). */
  function getInnerContentScale() {
    var border = getCanvasBorderPx();
    return Math.min(
      (CANVAS_W - 2 * border) / CANVAS_W,
      (CANVAS_H - 2 * border) / CANVAS_H
    );
  }

  /** Top-left of scaled content inside the symmetric border inset (centers when letterboxing). */
  function getInnerContentOffset() {
    var border = getCanvasBorderPx();
    var s = getInnerContentScale();
    var innerW = CANVAS_W - 2 * border;
    var innerH = CANVAS_H - 2 * border;
    return {
      x: border + (innerW - CANVAS_W * s) / 2,
      y: border + (innerH - CANVAS_H * s) / 2,
    };
  }

  function getInnerContentTransformAttr() {
    var off = getInnerContentOffset();
    var s = getInnerContentScale();
    return "translate(" + off.x + "," + off.y + ") scale(" + s + ")";
  }

  function elSvg(name) {
    return document.createElementNS(NS, name);
  }

  function isEmotionCanvasVisible(key) {
    return emotionCanvasVisible[key] !== false;
  }

  function syncVisibilityTogglePair(onId, offId, visible) {
    var onBtn = document.getElementById(onId);
    var offBtn = document.getElementById(offId);
    if (!onBtn || !offBtn) return;
    onBtn.classList.toggle("is-active", visible);
    offBtn.classList.toggle("is-active", !visible);
    onBtn.setAttribute("aria-pressed", String(visible));
    offBtn.setAttribute("aria-pressed", String(!visible));
  }

  function syncFeelingsCanvasToggleButtons(key) {
    var visible = isEmotionCanvasVisible(key);
    syncVisibilityTogglePair(
      "feelings-" + key + "-canvas-on",
      "feelings-" + key + "-canvas-off",
      visible
    );
  }

  function setEmotionCanvasVisible(key, visible) {
    if (FEELINGS_CANVAS_KEYS.indexOf(key) < 0) return;
    emotionCanvasVisible[key] = !!visible;
    syncFeelingsCanvasToggleButtons(key);
    refreshEmotionCanvasLayers();
  }

  function refreshEmotionCanvasLayers() {
    renderVerticalGridLayer();
    renderDiamondFillsLayer();
    renderHollowDiamondFillsLayer();
    renderPatternLayer();
    if (isStarGrid()) {
      renderBackgroundLayer();
      renderGridMaskLayer("refreshEmotionCanvasLayers");
    }
    renderAutoMergeFillsLayer();
    applyMergeReveal();
    renderStippleDotsLayer();
  }

  function initFeelingsCanvasToggles() {
    var i;
    var key;
    for (i = 0; i < FEELINGS_CANVAS_KEYS.length; i++) {
      key = FEELINGS_CANVAS_KEYS[i];
      syncFeelingsCanvasToggleButtons(key);
      (function (emotionKey) {
        var onBtn = document.getElementById(
          "feelings-" + emotionKey + "-canvas-on"
        );
        var offBtn = document.getElementById(
          "feelings-" + emotionKey + "-canvas-off"
        );
        if (onBtn) {
          onBtn.addEventListener("click", function () {
            setEmotionCanvasVisible(emotionKey, true);
          });
        }
        if (offBtn) {
          offBtn.addEventListener("click", function () {
            setEmotionCanvasVisible(emotionKey, false);
          });
        }
      })(key);
    }
  }

  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function parseCssColorToHex(cssColor) {
    if (!cssColor || cssColor === "none" || cssColor === "transparent") {
      return null;
    }
    if (cssColor.charAt(0) === "#") {
      if (cssColor.length === 4) {
        return (
          "#" +
          cssColor[1] +
          cssColor[1] +
          cssColor[2] +
          cssColor[2] +
          cssColor[3] +
          cssColor[3]
        );
      }
      return cssColor.length === 7 ? cssColor : null;
    }
    var m = cssColor.match(
      /rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)(?:\s*,\s*([\d.]+%?))?\s*\)/
    );
    if (!m) return null;
    if (m[4] !== undefined) {
      var alpha = m[4].indexOf("%") >= 0 ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (alpha < 0.05) return null;
    }
    function channel(v) {
      if (String(v).indexOf("%") >= 0) {
        return Math.round((parseFloat(v) / 100) * 255);
      }
      return Math.max(0, Math.min(255, Math.round(Number(v))));
    }
    var r = channel(m[1]);
    var g = channel(m[2]);
    var b = channel(m[3]);
    return (
      "#" +
      [r, g, b]
        .map(function (n) {
          return n.toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  function sheetColor(slotId) {
    if (window.SheetPalettes && window.SheetPalettes.getColor) {
      return window.SheetPalettes.getColor(slotId);
    }
    if (typeof getColor === "function") return getColor(slotId);
    return "#000000";
  }

  function getGridBoundaryStrokeColor() {
    return sheetColor("B2");
  }

  function getBorderDivisionStrokeColor() {
    return sheetColor("C10");
  }

  function getAutoMergeFillColor() {
    return sheetColor("F5");
  }

  function getCheckerboardDarkColor() {
    return sheetColor("G2");
  }

  function getCheckerboardLightColor() {
    return sheetColor("G3");
  }

  function getHopeDotsColor() {
    return sheetColor("F7");
  }

  function bakeHopeColoredStippleDataUri(img, colorHex) {
    try {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var rgb = hexToRgb(colorHex);
      var data = imageData.data;
      var i;
      var lum;
      var dot;
      for (i = 0; i < data.length; i += 4) {
        lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        dot = 1 - lum / 255;
        if (dot < 0.04) {
          data[i + 3] = 0;
        } else {
          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          data[i + 3] = Math.round(255 * dot);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL("image/png");
    } catch (e) {
      return null;
    }
  }

  function blobToDataUri(blob) {
    return new Promise(function (resolve) {
      try {
        var reader = new FileReader();
        reader.onload = function () {
          resolve(typeof reader.result === "string" ? reader.result : null);
        };
        reader.onerror = function () {
          resolve(null);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function ensureHopeStippleRawExportDataUri() {
    if (hopeStippleRawExportDataUri) {
      return Promise.resolve(hopeStippleRawExportDataUri);
    }
    return fetch(HOPE_STIPPLE_IMAGE)
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.blob();
      })
      .then(function (blob) {
        if (!blob) return null;
        return blobToDataUri(blob);
      })
      .then(function (dataUri) {
        if (dataUri) hopeStippleRawExportDataUri = dataUri;
        return hopeStippleRawExportDataUri;
      })
      .catch(function () {
        return hopeStippleRawExportDataUri;
      });
  }

  function markHopeStipplePixelVisited(visited, width, height, cx, cy, radius) {
    var x0 = Math.max(0, cx - radius);
    var x1 = Math.min(width - 1, cx + radius);
    var y0 = Math.max(0, cy - radius);
    var y1 = Math.min(height - 1, cy + radius);
    var x;
    var y;
    var rowBase;
    for (y = y0; y <= y1; y++) {
      rowBase = y * width;
      for (x = x0; x <= x1; x++) {
        visited[rowBase + x] = 1;
      }
    }
  }

  function buildHopeDotsCirclesExportLines() {
    if (
      !isEmotionCanvasVisible("hope") ||
      !hasActiveMergeCutouts() ||
      !hopeStippleImageReady ||
      !hopeStippleImageElement
    ) {
      return Promise.resolve(null);
    }

    return new Promise(function (resolve) {
      try {
        var mergedRegions = getMergedRegionsForMask();
        if (!mergedRegions || !mergedRegions.length) return resolve(null);

        var canvas = document.createElement("canvas");
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        var ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        ctx.drawImage(hopeStippleImageElement, 0, 0, CANVAS_W, CANVAS_H);
        var imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        var data = imageData.data;
        var visited = new Uint8Array(CANVAS_W * CANVAS_H);
        var dotColor = getHopeDotsColor();
        var dedupeRadius = 3;
        var luminanceThreshold = 128;
        var circleR = 2;
        var circles = [];
        var x;
        var y;
        var idx;
        var di;
        var r;
        var g;
        var b;
        var a;
        var lum;

        for (y = 0; y < CANVAS_H; y++) {
          for (x = 0; x < CANVAS_W; x++) {
            idx = y * CANVAS_W + x;
            if (visited[idx]) continue;

            di = idx * 4;
            r = data[di];
            g = data[di + 1];
            b = data[di + 2];
            a = data[di + 3];
            if (a === 0) continue;

            lum = (r + g + b) / 3;
            if (lum >= luminanceThreshold) continue;

            circles.push(
              '<circle cx="' +
                x +
                '" cy="' +
                y +
                '" r="' +
                circleR +
                '" fill="' +
                dotColor +
                '"/>'
            );
            markHopeStipplePixelVisited(
              visited,
              CANVAS_W,
              CANVAS_H,
              x,
              y,
              dedupeRadius
            );
          }
        }

        if (!circles.length) return resolve(null);

        var lines = [];
        lines.push("<defs>");
        lines.push('<clipPath id="' + MERGE_REGIONS_CLIP_ID + '">');
        for (var i = 0; i < mergedRegions.length; i++) {
          var pts = mergedRegions[i].points;
          if (!pts || !pts.length) continue;
          var pointsAttr = "";
          for (var p = 0; p < pts.length; p++) {
            if (p) pointsAttr += " ";
            pointsAttr += pts[p].x + "," + pts[p].y;
          }
          lines.push('<polygon points="' + pointsAttr + '"/>');
        }
        lines.push("</clipPath>");
        lines.push("</defs>");

        lines.push('<g clip-path="url(#inner-content-clip)">');
        lines.push(
          '<g id="layer-stipple-svg" clip-path="url(#' +
            MERGE_REGIONS_CLIP_ID +
            ')">'
        );
        for (var c = 0; c < circles.length; c++) {
          lines.push(circles[c]);
        }
        lines.push("</g>");
        lines.push("</g>");
        resolve(lines);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function refreshHopeColoredExportDataUri() {
    if (!hopeStippleImageReady) return;
    var img = new Image();
    img.onload = function () {
      hopeStippleExportDataUri = bakeHopeColoredStippleDataUri(
        img,
        getHopeDotsColor()
      );
    };
    img.src = HOPE_STIPPLE_IMAGE;
  }

  function ensureHopeDotsMaskDef(defs) {
    if (!defs || !hopeStippleImageReady) return;

    var filter = defs.querySelector("#" + HOPE_DOTS_MASK_INVERT_FILTER_ID);
    if (!filter) {
      filter = elSvg("filter");
      filter.setAttribute("id", HOPE_DOTS_MASK_INVERT_FILTER_ID);
      var cm = elSvg("feColorMatrix");
      cm.setAttribute("type", "matrix");
      cm.setAttribute(
        "values",
        "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1 -1 -1 1 1"
      );
      filter.appendChild(cm);
      defs.appendChild(filter);
    }

    var mask = defs.querySelector("#" + HOPE_DOTS_MASK_ID);
    if (!mask) {
      mask = elSvg("mask");
      mask.setAttribute("id", HOPE_DOTS_MASK_ID);
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      mask.setAttribute("x", "0");
      mask.setAttribute("y", "0");
      mask.setAttribute("width", String(CANVAS_W));
      mask.setAttribute("height", String(CANVAS_H));
      defs.appendChild(mask);
    }

    while (mask.firstChild) mask.removeChild(mask.firstChild);
    var maskImg = elSvg("image");
    maskImg.setAttribute("href", HOPE_STIPPLE_IMAGE);
    maskImg.setAttribute("filter", "url(#" + HOPE_DOTS_MASK_INVERT_FILTER_ID + ")");
    maskImg.setAttribute("x", "0");
    maskImg.setAttribute("y", "0");
    maskImg.setAttribute("width", String(CANVAS_W));
    maskImg.setAttribute("height", String(CANVAS_H));
    maskImg.setAttribute("preserveAspectRatio", "none");
    mask.appendChild(maskImg);
  }

  function loadHopeStippleImage() {
    var img = new Image();
    img.onload = function () {
      hopeStippleImageElement = img;
      hopeStippleImageReady = true;
      hopeStippleExportDataUri = bakeHopeColoredStippleDataUri(
        img,
        getHopeDotsColor()
      );
      ensureHopeStippleRawExportDataUri();
      renderStippleDotsLayer();
      applyMergeReveal();
    };
    img.onerror = function () {
      hopeStippleImageElement = null;
      hopeStippleImageReady = false;
      hopeStippleExportDataUri = null;
      hopeStippleRawExportDataUri = null;
    };
    img.src = HOPE_STIPPLE_IMAGE;
  }

  function getStarGridOctagonsNMax() {
    return typeof STAR_GRID_OCTAGONS_N_MAX !== "undefined"
      ? STAR_GRID_OCTAGONS_N_MAX
      : OCTAGONS_N_MAX;
  }

  function getOctagonsNMaxForActiveGrid() {
    return isStarGrid() ? getStarGridOctagonsNMax() : OCTAGONS_N_MAX;
  }

  function getOctagonsN() {
    var slider = document.getElementById("octagons-n");
    var v = slider ? Number(slider.value) : OCTAGONS_N_DEFAULT;
    return Math.min(
      getOctagonsNMaxForActiveGrid(),
      Math.max(OCTAGONS_N_MIN, Math.round(v))
    );
  }

  function isStarGrid() {
    return gridType === GRID_TYPE_STAR;
  }

  function isOctagonGrid() {
    return gridType === GRID_TYPE_OCTAGON;
  }

  function ensureStarValidLayouts() {
    if (
      typeof NestedStarOctagonsGeometry === "undefined" ||
      !NestedStarOctagonsGeometry.buildValidLayouts
    ) {
      return;
    }
    var starMaxN = getStarGridOctagonsNMax();
    starValidLayouts = NestedStarOctagonsGeometry.buildValidLayouts(
      CANVAS_W,
      CANVAS_H
    ).filter(function (layout) {
      return layout.n <= starMaxN;
    });
    if (!starValidLayouts.length) {
      starValidLayouts = [
        NestedStarOctagonsGeometry.computeLayoutFromN(
          OCTAGONS_N_DEFAULT,
          CANVAS_W,
          CANVAS_H
        ),
      ];
    }
  }

  function getStarLayout() {
    if (!starValidLayouts.length) ensureStarValidLayouts();
    return NestedStarOctagonsGeometry.snapLayoutToN(
      lastOctagonsN,
      starValidLayouts,
      CANVAS_W,
      CANVAS_H
    );
  }

  function syncOctagonDensitySliderRange() {
    var slider = document.getElementById("octagons-n");
    if (!slider) return;
    if (isStarGrid() && starValidLayouts.length) {
      var minN = starValidLayouts[0].n;
      var maxN = Math.min(
        starValidLayouts[starValidLayouts.length - 1].n,
        getStarGridOctagonsNMax()
      );
      slider.min = String(minN);
      slider.max = String(maxN);
      if (Number(slider.value) > maxN) {
        slider.value = String(maxN);
      }
    } else {
      slider.min = String(OCTAGONS_N_MIN);
      slider.max = String(OCTAGONS_N_MAX);
    }
  }

  function syncGridTypeButtons() {
    var octBtn = document.getElementById("grid-choose-octagon-btn");
    var starBtn = document.getElementById("grid-choose-star-btn");
    if (octBtn) {
      octBtn.classList.toggle("is-active", isOctagonGrid());
      octBtn.setAttribute("aria-pressed", String(isOctagonGrid()));
    }
    if (starBtn) {
      starBtn.classList.toggle("is-active", isStarGrid());
      starBtn.setAttribute("aria-pressed", String(isStarGrid()));
    }
  }

  function syncGridSlidersForGridType() {
    var innerScaleWrap = document.querySelector(
      "#inner-scale"
    );
    innerScaleWrap =
      innerScaleWrap &&
      innerScaleWrap.closest(".sidebar__grid-density");
    if (innerScaleWrap) innerScaleWrap.hidden = isStarGrid();
  }

  /** Star grid: layers not used yet (gradient overlay, etc.). */
  var STAR_GRID_DEFERRED_LAYER_SELECTORS = ["#layer-frame-inset-overlay"];

  function setSvgSubtreeVisible(selector, visible) {
    if (!designSvg) return;
    var el = designSvg.querySelector(selector);
    if (el) el.style.display = visible ? "" : "none";
  }

  function applyStarGridLayerVisibility() {
    var i;
    for (i = 0; i < STAR_GRID_DEFERRED_LAYER_SELECTORS.length; i++) {
      setSvgSubtreeVisible(STAR_GRID_DEFERRED_LAYER_SELECTORS[i], false);
    }
    setSvgSubtreeVisible("#layer-border-divisions", true);
    setSvgSubtreeVisible("#grid-boundary", true);
    setSvgSubtreeVisible("#layer-edge-brown-bars", true);
    setSvgSubtreeVisible("#edge-brown-bar-label-content", true);
    setSvgSubtreeVisible("#layer-edge-serial", true);
    setSvgSubtreeVisible("#inner-clipped-pattern", true);
    setSvgSubtreeVisible("#inner-clipped-vertical-grid", false);
    setSvgSubtreeVisible("#inner-clipped-vertical-grid-overlay", true);
    setSvgSubtreeVisible("#inner-content", true);
    setSvgSubtreeVisible("#canvas-background-fill", true);
  }

  function applyOctagonGridLayerVisibility() {
    var i;
    for (i = 0; i < STAR_GRID_DEFERRED_LAYER_SELECTORS.length; i++) {
      setSvgSubtreeVisible(STAR_GRID_DEFERRED_LAYER_SELECTORS[i], true);
    }
    setSvgSubtreeVisible("#layer-border-divisions", true);
    setSvgSubtreeVisible("#grid-boundary", true);
    setSvgSubtreeVisible("#layer-edge-brown-bars", true);
    setSvgSubtreeVisible("#edge-brown-bar-label-content", true);
    setSvgSubtreeVisible("#layer-edge-serial", true);
    setSvgSubtreeVisible("#inner-clipped-pattern", true);
    setSvgSubtreeVisible("#inner-clipped-vertical-grid", true);
    setSvgSubtreeVisible("#inner-clipped-vertical-grid-overlay", false);
    setSvgSubtreeVisible("#inner-content", true);
    setSvgSubtreeVisible("#canvas-background-fill", true);
  }

  function updateInnerContentTransformForGridType() {
    if (!designSvg) return;
    var inner = designSvg.querySelector("#inner-content");
    if (!inner) return;
    inner.setAttribute("transform", getInnerContentTransformAttr());
  }

  function refreshBorderFrameAndLabelBars() {
    updateGridBoundaryRect();
    updateBorderDivisionLines();
    updateCanvasEdgeBrownBars();
  }

  function setGridType(nextType) {
    if (nextType !== GRID_TYPE_OCTAGON && nextType !== GRID_TYPE_STAR) return;
    if (gridType === nextType) return;
    gridType = nextType;
    clearMergeState();
    clearAutoMergeState();
    if (isStarGrid()) {
      ensureStarValidLayouts();
      syncOctagonDensitySliderRange();
      setMode("view");
    } else {
      syncOctagonDensitySliderRange();
    }
    syncGridTypeButtons();
    syncGridSlidersForGridType();
    render();
  }

  function initGridTypeButtons() {
    var octBtn = document.getElementById("grid-choose-octagon-btn");
    var starBtn = document.getElementById("grid-choose-star-btn");
    if (octBtn) {
      octBtn.addEventListener("click", function () {
        setGridType(GRID_TYPE_OCTAGON);
      });
    }
    if (starBtn) {
      starBtn.addEventListener("click", function () {
        setGridType(GRID_TYPE_STAR);
      });
    }
    syncGridTypeButtons();
    syncGridSlidersForGridType();
  }

  function getInnerScale() {
    var slider = document.getElementById("inner-scale");
    var v = slider ? Number(slider.value) : INNER_SCALE_DEFAULT;
    return Math.min(
      INNER_SCALE_MAX,
      Math.max(INNER_SCALE_MIN, Math.round(v * 100) / 100)
    );
  }

  function getCircleDensity() {
    var slider = document.getElementById("circle-density");
    var v = slider ? Number(slider.value) : CIRCLE_DENSITY_DEFAULT;
    return Math.min(
      CIRCLE_DENSITY_MAX,
      Math.max(CIRCLE_DENSITY_MIN, Math.round(v))
    );
  }

  function getLongingCircleDensity() {
    var slider = document.getElementById("longing-circle-density");
    var v = slider ? Number(slider.value) : CIRCLE_DENSITY_DEFAULT;
    return Math.min(
      CIRCLE_DENSITY_MAX,
      Math.max(CIRCLE_DENSITY_MIN, Math.round(v))
    );
  }

  function getGriefCircleDensity() {
    var slider = document.getElementById("grief-circle-density");
    var v = slider ? Number(slider.value) : CIRCLE_DENSITY_DEFAULT;
    return Math.min(
      CIRCLE_DENSITY_MAX,
      Math.max(CIRCLE_DENSITY_MIN, Math.round(v))
    );
  }

  function getHelplessnessPercent() {
    var slider = document.getElementById("helplessness-percent");
    var def =
      typeof HELPLESSNESS_PERCENT_DEFAULT !== "undefined"
        ? HELPLESSNESS_PERCENT_DEFAULT
        : 10;
    var min =
      typeof HELPLESSNESS_PERCENT_MIN !== "undefined"
        ? HELPLESSNESS_PERCENT_MIN
        : 10;
    var max =
      typeof HELPLESSNESS_PERCENT_MAX !== "undefined"
        ? HELPLESSNESS_PERCENT_MAX
        : 40;
    var v = slider ? Number(slider.value) : def;
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  function isHelplessnessLayerVisible() {
    var toggle = document.getElementById("helplessness-layer-toggle");
    return !toggle || toggle.checked;
  }

  function getAngerVerticalLengthPercent() {
    var slider = document.getElementById("anger-vertical-length");
    var v = slider ? Number(slider.value) : ANGER_VERTICAL_LENGTH_DEFAULT;
    return Math.min(
      ANGER_VERTICAL_LENGTH_MAX,
      Math.max(ANGER_VERTICAL_LENGTH_MIN, Math.round(v))
    );
  }

  function getAnxietyVerticalStrokePercent() {
    var slider = document.getElementById("anxiety-vertical-stroke");
    var def =
      typeof ANXIETY_VERTICAL_STROKE_DEFAULT !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_DEFAULT
        : 17;
    var min =
      typeof ANXIETY_VERTICAL_STROKE_MIN !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_MIN
        : 0;
    var max =
      typeof ANXIETY_VERTICAL_STROKE_MAX !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_MAX
        : 100;
    var v = slider ? Number(slider.value) : def;
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  function getPrideFillPercent() {
    var slider = document.getElementById("pride-fill-percent");
    var v = slider ? Number(slider.value) : PRIDE_FILL_PERCENT_DEFAULT;
    return Math.min(
      PRIDE_FILL_PERCENT_MAX,
      Math.max(PRIDE_FILL_PERCENT_MIN, Math.round(v))
    );
  }

  function getGuiltShameFillPercent() {
    var slider = document.getElementById("guilt-shame-fill-percent");
    var def =
      typeof GUILT_SHAME_FILL_PERCENT_DEFAULT !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_DEFAULT
        : 25;
    var min =
      typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_MIN
        : 10;
    var max =
      typeof GUILT_SHAME_FILL_PERCENT_MAX !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_MAX
        : 40;
    var v = slider ? Number(slider.value) : def;
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  function getAutoMergeIntensity() {
    var slider = document.getElementById("auto-merge-intensity");
    var min =
      typeof AUTO_MERGE_INTENSITY_MIN !== "undefined"
        ? AUTO_MERGE_INTENSITY_MIN
        : 0;
    var max =
      typeof AUTO_MERGE_INTENSITY_MAX !== "undefined"
        ? AUTO_MERGE_INTENSITY_MAX
        : 100;
    var def =
      typeof AUTO_MERGE_INTENSITY_DEFAULT !== "undefined"
        ? AUTO_MERGE_INTENSITY_DEFAULT
        : 50;
    var v = slider ? Number(slider.value) : def;
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  /**
   * Map slider 0–100 to area count and deleted-edge count per area.
   * @returns {{ areaCountMin: number, areaCountMax: number, edgesPerAreaMin: number, edgesPerAreaMax: number, boundsInset: number }}
   */
  function getAutoMergePlanOptions() {
    var pct = getAutoMergeIntensity();
    var t = pct / 100;
    var areasAtMin =
      typeof AUTO_MERGE_AREA_COUNT_AT_MIN !== "undefined"
        ? AUTO_MERGE_AREA_COUNT_AT_MIN
        : 3;
    var areasAtMax =
      typeof AUTO_MERGE_AREA_COUNT_AT_MAX !== "undefined"
        ? AUTO_MERGE_AREA_COUNT_AT_MAX
        : 10;
    var edgeMinAtMin =
      typeof AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MIN !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MIN
        : 2;
    var edgeMaxAtMin =
      typeof AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MIN !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MIN
        : 4;
    var edgeMinAtMax =
      typeof AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MAX !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MAX
        : 3;
    var edgeMaxAtMax =
      typeof AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MAX !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MAX
        : 10;

    var areaSpan = areasAtMax - areasAtMin;
    var areaCountMin = Math.round(areasAtMin + t * areaSpan * 0.35);
    var areaCountMax = Math.round(areasAtMin + t * areaSpan);
    if (areaCountMax < areasAtMin) areaCountMax = areasAtMin;
    if (areaCountMin < areasAtMin) areaCountMin = areasAtMin;
    if (areaCountMax < areaCountMin) areaCountMax = areaCountMin;

    var edgesPerAreaMin = Math.round(edgeMinAtMin + t * (edgeMinAtMax - edgeMinAtMin));
    var edgesPerAreaMax = Math.round(edgeMaxAtMin + t * (edgeMaxAtMax - edgeMinAtMin));
    if (edgesPerAreaMax < edgesPerAreaMin) edgesPerAreaMax = edgesPerAreaMin;

    return {
      areaCountMin: areaCountMin,
      areaCountMax: areaCountMax,
      edgesPerAreaMin: edgesPerAreaMin,
      edgesPerAreaMax: edgesPerAreaMax,
      boundsInset:
        typeof AUTO_MERGE_SEED_BOUNDS_INSET_PX !== "undefined"
          ? AUTO_MERGE_SEED_BOUNDS_INSET_PX
          : 40,
    };
  }

  function updateAutoMergeIntensityOutput() {
    var out = document.getElementById("auto-merge-intensity-out");
    if (!out) return;
    var opts = getAutoMergePlanOptions();
    out.textContent =
      String(getAutoMergeIntensity()) +
      "% · " +
      opts.areaCountMin +
      "–" +
      opts.areaCountMax +
      " areas";
  }

  function getGridStrokeWidth() {
    return GRID_STROKE_WIDTH_DEFAULT;
  }

  function getBorderLeftRightSegments() {
    return BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT;
  }

  /**
   * Section 3 (Family and friends in Iran): 3-step control that changes only
   * the border strip thickness (in columns of the existing border width).
   * @returns {1|2|3}
   */
  function getBorderSideThicknessColumns() {
    var slider = document.getElementById("border-side-segments");
    var v = slider ? Number(slider.value) : 1;
    var clamped = Math.min(3, Math.max(1, Math.round(v)));
    return /** @type {1|2|3} */ (clamped);
  }

  /**
   * @param {1|2|3} cols
   * @returns {"Thin"|"Medium"|"Thick"}
   */
  function borderSideThicknessLabel(cols) {
    if (cols === 1) return "Thin";
    if (cols === 2) return "Medium";
    return "Thick";
  }

  function getBorderSideWhiteFillSliderValue() {
    var slider = document.getElementById("border-side-white-fill");
    var fallback =
      typeof BORDER_SIDE_WHITE_FILL_DEFAULT !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_DEFAULT
        : 0;
    var v = slider ? Number(slider.value) : fallback;
    var min =
      typeof BORDER_SIDE_WHITE_FILL_MIN !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_MIN
        : 0;
    var max =
      typeof BORDER_SIDE_WHITE_FILL_MAX !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_MAX
        : 100;
    return Math.min(max, Math.max(min, Math.round(v)));
  }

  /**
   * Effective share of margin division cells painted white (0 … cap).
   * @returns {number}
   */
  function getBorderSideWhiteFillTargetPercent() {
    var cap =
      typeof BORDER_SIDE_WHITE_CAP_PERCENT !== "undefined"
        ? BORDER_SIDE_WHITE_CAP_PERCENT
        : 60;
    var sliderMax =
      typeof BORDER_SIDE_WHITE_FILL_MAX !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_MAX
        : 100;
    return Math.round(
      (getBorderSideWhiteFillSliderValue() * cap) / sliderMax
    );
  }

  function syncBorderSideWhiteFillOutput() {
    var out = document.getElementById("border-side-white-fill-out");
    if (out) {
      out.textContent = String(getBorderSideWhiteFillTargetPercent()) + "%";
    }
  }

  /**
   * Left/right margin division slots (one per column × row).
   * @returns {{ id: string }[]}
   */
  function getBorderSideDivisionCellCatalog() {
    var cols = getBorderSideThicknessColumns();
    var yBounds = getLeftRightBorderCellYBounds();
    var rowCount = yBounds.length - 1;
    var catalog = [];
    var c;
    var r;
    for (c = 0; c < cols; c++) {
      for (r = 0; r < rowCount; r++) {
        catalog.push({ id: String(c) + "-" + String(r) });
      }
    }
    return catalog;
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncBorderSideWhiteCells(forceReshuffle) {
    var catalog = getBorderSideDivisionCellCatalog();
    var catalogIds = catalog.map(function (item) {
      return item.id;
    });
    var validSet = new Set(catalogIds);

    if (forceReshuffle || !cachedBorderSideWhiteCellOrder) {
      cachedBorderSideWhiteCellOrder = shufflePickIds(catalog, catalogIds.length);
    } else {
      cachedBorderSideWhiteCellOrder = cachedBorderSideWhiteCellOrder.filter(
        function (id) {
          return validSet.has(id);
        }
      );
      var existing = new Set(cachedBorderSideWhiteCellOrder);
      var newcomers = [];
      var i;
      for (i = 0; i < catalogIds.length; i++) {
        if (!existing.has(catalogIds[i])) newcomers.push(catalogIds[i]);
      }
      if (newcomers.length) {
        for (i = newcomers.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = newcomers[i];
          newcomers[i] = newcomers[j];
          newcomers[j] = tmp;
        }
        cachedBorderSideWhiteCellOrder =
          cachedBorderSideWhiteCellOrder.concat(newcomers);
      }
    }

    var targetPercent = getBorderSideWhiteFillTargetPercent();
    var target = Math.round((catalog.length * targetPercent) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    borderSideWhiteCellIds.clear();
    for (i = 0; i < target; i++) {
      borderSideWhiteCellIds.add(cachedBorderSideWhiteCellOrder[i]);
    }
  }

  /**
   * @param {number} colIndex 0 = outer margin column
   * @param {number} rowIndex 0 = top row
   * @returns {boolean}
   */
  function isBorderSideCellWhitened(colIndex, rowIndex) {
    if (getBorderSideWhiteFillTargetPercent() <= 0) return false;
    return borderSideWhiteCellIds.has(
      String(colIndex) + "-" + String(rowIndex)
    );
  }

  function getCircleStrokeWidth() {
    return getGridStrokeWidth() * 3;
  }

  function getLongingCircleStrokeWidth() {
    return getGridStrokeWidth() * 3;
  }

  function getGriefCircleStrokeWidth() {
    return getGridStrokeWidth() * 3;
  }

  function isCanvasBackgroundColor(hex) {
    var normalized = normalizeHexColor(hex, "");
    if (!normalized) return false;
    var allowed = getCanvasBackgroundColors();
    var i;
    for (i = 0; i < allowed.length; i++) {
      if (normalizeHexColor(allowed[i], "") === normalized) return true;
    }
    return false;
  }

  function snapPatternStrokeColor(value) {
    var normalized = normalizeHexColor(value, PATTERN_STROKE_COLOR_DEFAULT);
    if (!isCanvasBackgroundColor(normalized)) return normalized;
    return sheetColor("B1");
  }

  function getPatternStrokeColor() {
    return sheetColor("B1");
  }

  function getCanvasBackgroundColors() {
    if (
      typeof CANVAS_BACKGROUND_COLORS !== "undefined" &&
      CANVAS_BACKGROUND_COLORS.length
    ) {
      return CANVAS_BACKGROUND_COLORS.slice();
    }
    return [CANVAS_BACKGROUND_COLOR_DEFAULT || BG_COLOR];
  }

  function snapCanvasBackgroundColor(value) {
    var allowed = getCanvasBackgroundColors();
    var normalized = normalizeHexColor(value, "");
    var i;
    if (normalized) {
      for (i = 0; i < allowed.length; i++) {
        if (normalizeHexColor(allowed[i], "") === normalized) return normalized;
      }
    }
    return normalizeHexColor(
      allowed[0],
      CANVAS_BACKGROUND_COLOR_DEFAULT || BG_COLOR
    );
  }

  function getCanvasBackgroundColor() {
    return sheetColor("A1");
  }

  function getCircleFillColor() {
    return sheetColor("F3");
  }

  function getCircleStrokeColor() {
    return sheetColor("F4");
  }

  function getDiamondFillColor() {
    return sheetColor("F2");
  }

  function getGuiltShameDiamondFillColor() {
    return sheetColor("F8");
  }

  function getLabelBarBackgroundColor() {
    return sheetColor("G1");
  }

  function getLabelBarContentColor() {
    return sheetColor("G4");
  }

  function ensureLabelBarBackgroundDiffersFromCanvas() {
    return false;
  }

  function getHalfCircleFaceFillColor() {
    return sheetColor("D6");
  }

  function getHalfCircleStarFillColor() {
    return sheetColor("E3");
  }

  function getHalfCircleInnerStarFillColor() {
    return sheetColor("E5");
  }

  function normalizeHexColor(value, fallback) {
    if (!value || typeof value !== "string") return fallback;
    var v = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    return fallback;
  }

  /**
   * @param {string[]} lines
   */
  function pushBackgroundExportLines(lines) {
    lines.push(
      '<rect x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '" fill="' +
        getCanvasBackgroundColor() +
        '"/>'
    );
  }

  function renderBackgroundLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-background");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    var whiteRect = elSvg("rect");
    whiteRect.setAttribute("x", "0");
    whiteRect.setAttribute("y", "0");
    whiteRect.setAttribute("width", String(CANVAS_W));
    whiteRect.setAttribute("height", String(CANVAS_H));
    whiteRect.setAttribute("fill", getCanvasBackgroundColor());
    layer.appendChild(whiteRect);
  }

  function updateCanvasBackgroundColor() {
    if (!designSvg) return;
    var fill = getCanvasBackgroundColor();
    var borderFill = designSvg.querySelector("#canvas-background-fill");
    if (borderFill) borderFill.setAttribute("fill", fill);
    if (isStarGrid()) {
      renderBackgroundLayer();
      updateBorderDivisionLines();
      renderGridMaskLayer("canvas-background-color");
      renderPatternLayer();
      applyMergeReveal();
      return;
    }
    renderBackgroundLayer();
    renderGridMaskLayer("canvas-background-color");
    renderHalfCircleLayer();
  }

  var GRID_WHITE_MASK_ID = "grid-white-mask";
  var MERGE_REGIONS_CLIP_ID = "merge-regions-clip";

  /**
   * @param {SVGElement} defs
   * @param {{ points: { x: number, y: number }[] }[]} mergedRegions
   */
  function updateMergeRegionsClipPath(defs, mergedRegions) {
    var existing = defs.querySelector("#" + MERGE_REGIONS_CLIP_ID);
    if (existing) defs.removeChild(existing);

    if (!mergedRegions.length) return;

    var clip = elSvg("clipPath");
    clip.setAttribute("id", MERGE_REGIONS_CLIP_ID);
    var i;
    var pts;
    var p;
    var pointsAttr;
    var poly;

    for (i = 0; i < mergedRegions.length; i++) {
      pts = mergedRegions[i].points;
      if (!pts.length) continue;
      pointsAttr = "";
      for (p = 0; p < pts.length; p++) {
        if (p) pointsAttr += " ";
        pointsAttr += pts[p].x + "," + pts[p].y;
      }
      poly = elSvg("polygon");
      poly.setAttribute("points", pointsAttr);
      clip.appendChild(poly);
    }

    if (clip.childNodes.length) defs.appendChild(clip);
  }

  function hasActiveMergeCutouts() {
    if (removedEdges.size > 0) return true;
    return !!(stickyMergedCutoutFaces && stickyMergedCutoutFaces.length);
  }

  function updateGridWhiteMaskDef(defs, mergedRegions, bounds) {
    var existing = defs.querySelector("#" + GRID_WHITE_MASK_ID);
    if (existing) defs.removeChild(existing);

    var mask = elSvg("mask");
    mask.setAttribute("id", GRID_WHITE_MASK_ID);

    var white = elSvg("rect");
    white.setAttribute("x", String(bounds.x));
    white.setAttribute("y", String(bounds.y));
    white.setAttribute("width", String(bounds.width));
    white.setAttribute("height", String(bounds.height));
    white.setAttribute("fill", "white");
    mask.appendChild(white);

    for (var i = 0; i < mergedRegions.length; i++) {
      var pts = mergedRegions[i].points;
      if (!pts.length) continue;
      var pointsAttr = "";
      for (var p = 0; p < pts.length; p++) {
        if (p) pointsAttr += " ";
        pointsAttr += pts[p].x + "," + pts[p].y;
      }
      var hole = elSvg("polygon");
      hole.setAttribute("points", pointsAttr);
      hole.setAttribute("fill", "black");
      mask.appendChild(hole);
    }

    defs.appendChild(mask);
  }

  /**
   * @param {{ x: number, y: number }[]} points
   * @returns {{ x: number, y: number }}
   */
  function getMergeRegionCentroid(points) {
    var x = 0;
    var y = 0;
    var i;
    for (i = 0; i < points.length; i++) {
      x += points[i].x;
      y += points[i].y;
    }
    return { x: x / points.length, y: y / points.length };
  }

  /**
   * True when inner lies inside outer (all vertices + smaller area).
   * @param {{ points: { x: number, y: number }[] }} inner
   * @param {{ points: { x: number, y: number }[] }} outer
   * @returns {boolean}
   */
  function isMergeRegionContainedIn(inner, outer) {
    var innerPts = inner.points;
    var outerPts = outer.points;
    if (!innerPts || !innerPts.length || !outerPts || !outerPts.length) {
      return false;
    }
    var innerArea = polygonAreaAbs(innerPts);
    var outerArea = polygonAreaAbs(outerPts);
    if (innerArea >= outerArea - 1e-3) return false;
    var i;
    for (i = 0; i < innerPts.length; i++) {
      if (
        !hopePointInPolygon(innerPts[i].x, innerPts[i].y, outerPts)
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * True when a smaller region is redundant inside a larger one (full enclosure
   * or centroid falls inside the larger polygon).
   * @param {{ points: { x: number, y: number }[] }} inner
   * @param {{ points: { x: number, y: number }[] }} outer
   * @returns {boolean}
   */
  function isMergeRegionRedundantIn(inner, outer) {
    if (isMergeRegionContainedIn(inner, outer)) return true;
    var innerArea = polygonAreaAbs(inner.points);
    var outerArea = polygonAreaAbs(outer.points);
    if (innerArea >= outerArea - 1e-3) return false;
    var c = getMergeRegionCentroid(inner.points);
    return hopePointInPolygon(c.x, c.y, outer.points);
  }

  /**
   * Drop redundant holes enclosed by or overlapping a larger merged region.
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function dedupeContainedMergeRegions(regions) {
    if (!regions || regions.length <= 1) return regions || [];
    var sorted = regions.slice().sort(function (a, b) {
      return polygonAreaAbs(b.points) - polygonAreaAbs(a.points);
    });
    var kept = [];
    var i;
    var j;
    for (i = 0; i < sorted.length; i++) {
      var contained = false;
      for (j = 0; j < kept.length; j++) {
        if (isMergeRegionRedundantIn(sorted[i], kept[j])) {
          contained = true;
          break;
        }
      }
      if (!contained) kept.push(sorted[i]);
    }
    return kept;
  }

  function renderGridMaskLayer(trigger) {
    if (!designSvg) return;
    var defs = designSvg.querySelector("defs");
    var layer = designSvg.querySelector("#layer-grid-mask");
    if (!defs || !layer) return;

    var bounds = getGridContentBounds();
    var mergeSegments = getSegmentsForMergeRegionDetection();
    var rawMergedRegions = TopkapiGeometry.getMergedPolygonRegions(
      mergeSegments,
      removedEdges
    );
    var freshRegions = filterHopeMergeRegionsForGridType(rawMergedRegions);
    var mergedRegions;
    if (!removedEdges.size) {
      stickyMergedCutoutFaces = null;
      mergedRegions = freshRegions;
    } else if (isStarGrid()) {
      stickyMergedCutoutFaces = freshRegions;
      mergedRegions = freshRegions;
    } else if (trigger === "restore" || interactionMode === "restore") {
      stickyMergedCutoutFaces = freshRegions;
      mergedRegions = freshRegions;
    } else if (freshRegions.length) {
      stickyMergedCutoutFaces = dedupeContainedMergeRegions(freshRegions);
      mergedRegions = stickyMergedCutoutFaces;
    } else if (
      rawMergedRegions.length &&
      stickyMergedCutoutFaces &&
      stickyMergedCutoutFaces.length
    ) {
      mergedRegions = stickyMergedCutoutFaces;
    } else {
      mergedRegions = stickyMergedCutoutFaces || [];
    }

    updateGridWhiteMaskDef(defs, mergedRegions, bounds);
    updateMergeRegionsClipPath(defs, mergedRegions);

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    var maskRect = elSvg("rect");
    maskRect.setAttribute("x", String(bounds.x));
    maskRect.setAttribute("y", String(bounds.y));
    maskRect.setAttribute("width", String(bounds.width));
    maskRect.setAttribute("height", String(bounds.height));
    maskRect.setAttribute("fill", getCanvasBackgroundColor());
    maskRect.setAttribute("mask", "url(#" + GRID_WHITE_MASK_ID + ")");
    layer.appendChild(maskRect);

    applyMergeReveal();
  }

  function applyMergeReveal() {
    if (!designSvg) return;

    var active = hasActiveMergeCutouts();
    var showHope = isEmotionCanvasVisible("hope");
    var maskClipped = designSvg.querySelector("#inner-clipped-grid-mask");
    var dotsClipped = designSvg.querySelector("#inner-clipped-stipple-dots");
    var dotsLayer = designSvg.querySelector("#layer-stipple-dots");
    var defs = designSvg.querySelector("defs");
    var hasClipDef = !!(
      defs && defs.querySelector("#" + MERGE_REGIONS_CLIP_ID)
    );
    if (maskClipped) {
      maskClipped.style.display = active && showHope ? "" : "none";
    }

    if (!active || !showHope) {
      if (dotsClipped) dotsClipped.style.display = "none";
      if (dotsLayer) dotsLayer.removeAttribute("clip-path");
      return;
    }

    if (dotsClipped) dotsClipped.style.display = "";
    if (dotsLayer && hasClipDef) {
      dotsLayer.setAttribute("clip-path", "url(#" + MERGE_REGIONS_CLIP_ID + ")");
    } else if (dotsLayer) {
      dotsLayer.removeAttribute("clip-path");
    }

    renderStippleDotsLayer();
  }

  /**
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function getMergedRegionsForMask() {
    var freshRegions = filterHopeMergeRegionsForGridType(
      TopkapiGeometry.getMergedPolygonRegions(
        getSegmentsForMergeRegionDetection(),
        removedEdges
      )
    );
    if (!removedEdges.size) return freshRegions;
    if (stickyMergedCutoutFaces) return stickyMergedCutoutFaces;
    return freshRegions;
  }

  /**
   * @param {string[]} lines
   */
  function getAutoMergeOutlineColor() {
    return sheetColor("F6");
  }

  function getAutoMergeOutlineWidth() {
    var mult =
      typeof AUTO_MERGE_OUTLINE_WIDTH_GRID_MULTIPLIER !== "undefined"
        ? AUTO_MERGE_OUTLINE_WIDTH_GRID_MULTIPLIER
        : 3;
    return getGridStrokeWidth() * mult;
  }

  function getAutoMergeShadowFilterParams() {
    return {
      shadowColor: sheetColor("D6"),
      blur:
        typeof AUTO_MERGE_SHADOW_BLUR_PX !== "undefined"
          ? AUTO_MERGE_SHADOW_BLUR_PX
          : 4,
      offsetX:
        typeof AUTO_MERGE_SHADOW_OFFSET_X_PX !== "undefined"
          ? AUTO_MERGE_SHADOW_OFFSET_X_PX
          : -5,
      offsetY:
        typeof AUTO_MERGE_SHADOW_OFFSET_Y_PX !== "undefined"
          ? AUTO_MERGE_SHADOW_OFFSET_Y_PX
          : 5,
      opacity:
        typeof AUTO_MERGE_SHADOW_OPACITY !== "undefined"
          ? AUTO_MERGE_SHADOW_OPACITY
          : 0.9,
    };
  }

  function getAutoMergeShadowFilterId() {
    return typeof AUTO_MERGE_SHADOW_FILTER_ID !== "undefined"
      ? AUTO_MERGE_SHADOW_FILTER_ID
      : "auto-merge-region-shadow";
  }

  function getAutoMergeShadowFilterUrl() {
    return "url(#" + getAutoMergeShadowFilterId() + ")";
  }

  /**
   * @param {SVGElement} defs
   */
  function ensureAutoMergeShadowFilter(defs) {
    var filterId = getAutoMergeShadowFilterId();
    var existing = defs.querySelector("#" + filterId);
    if (existing) defs.removeChild(existing);

    var shadow = getAutoMergeShadowFilterParams();

    var filter = elSvg("filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    var drop = elSvg("feDropShadow");
    drop.setAttribute("dx", String(shadow.offsetX));
    drop.setAttribute("dy", String(shadow.offsetY));
    drop.setAttribute("stdDeviation", String(shadow.blur));
    drop.setAttribute("flood-color", shadow.shadowColor);
    drop.setAttribute("flood-opacity", String(shadow.opacity));
    filter.appendChild(drop);
    defs.appendChild(filter);
  }

  /**
   * @param {string[]} lines
   */
  function pushAutoMergeShadowFilterDefLines(lines) {
    var filterId = getAutoMergeShadowFilterId();
    var shadow = getAutoMergeShadowFilterParams();

    lines.push(
      '<filter id="' +
        filterId +
        '" x="-50%" y="-50%" width="200%" height="200%">' +
        '<feDropShadow dx="' +
        shadow.offsetX +
        '" dy="' +
        shadow.offsetY +
        '" stdDeviation="' +
        shadow.blur +
        '" flood-color="' +
        shadow.shadowColor +
        '" flood-opacity="' +
        shadow.opacity +
        '"/>' +
        "</filter>"
    );
  }

  /**
   * @param {string} pointsAttr
   * @param {string} fillColor
   * @returns {string}
   */
  function getAutoMergeRegionExportMarkup(pointsAttr, fillColor) {
    var outline = getAutoMergeOutlineColor();
    var strokeWidth = getAutoMergeOutlineWidth();
    var filterUrl = getAutoMergeShadowFilterUrl();
    return (
      "<g>" +
      '<g filter="' +
      filterUrl +
      '">' +
      '<polygon points="' +
      pointsAttr +
      '" fill="' +
      fillColor +
      '" stroke="none"/>' +
      "</g>" +
      '<polygon points="' +
      pointsAttr +
      '" fill="' +
      fillColor +
      '" stroke="' +
      outline +
      '" stroke-width="' +
      strokeWidth +
      '" stroke-linejoin="round"/>' +
      "</g>"
    );
  }

  /**
   * @param {{ x: number, y: number }[]} pts
   * @param {string} fillColor
   * @returns {SVGElement}
   */
  function createAutoMergeRegionGroup(pts, fillColor) {
    var pointsAttr = "";
    var p;
    for (p = 0; p < pts.length; p++) {
      if (p) pointsAttr += " ";
      pointsAttr += pts[p].x + "," + pts[p].y;
    }

    var g = elSvg("g");
    var shadowPoly = elSvg("polygon");
    shadowPoly.setAttribute("points", pointsAttr);
    shadowPoly.setAttribute("fill", fillColor);
    shadowPoly.setAttribute("stroke", "none");
    shadowPoly.setAttribute("filter", getAutoMergeShadowFilterUrl());
    g.appendChild(shadowPoly);

    var poly = elSvg("polygon");
    poly.setAttribute("points", pointsAttr);
    poly.setAttribute("fill", fillColor);
    poly.setAttribute("stroke", getAutoMergeOutlineColor());
    poly.setAttribute("stroke-width", String(getAutoMergeOutlineWidth()));
    poly.setAttribute("stroke-linejoin", "round");
    g.appendChild(poly);
    return g;
  }

  /**
   * @param {string[]} lines
   */
  function pushAutoMergeFillExportLines(lines) {
    if (
      !isEmotionCanvasVisible("pride") ||
      !autoMergeFillRegions ||
      !autoMergeFillRegions.length
    ) {
      return;
    }

    var fillColor = getAutoMergeFillColor();
    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push('<g id="layer-auto-merge-fills">');
    var i;
    var pts;
    var p;
    var pointsAttr;
    for (i = 0; i < autoMergeFillRegions.length; i++) {
      pts = autoMergeFillRegions[i].points;
      if (!pts.length) continue;
      pointsAttr = "";
      for (p = 0; p < pts.length; p++) {
        if (p) pointsAttr += " ";
        pointsAttr += pts[p].x + "," + pts[p].y;
      }
      lines.push(getAutoMergeRegionExportMarkup(pointsAttr, fillColor));
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  function pushGridMaskExportLines(lines) {
    if (!hasActiveMergeCutouts()) return;

    var bounds = getGridContentBounds();
    var mergedRegions = getMergedRegionsForMask();

    lines.push("<defs>");
    lines.push('<mask id="' + GRID_WHITE_MASK_ID + '">');
    lines.push(
      '<rect x="' +
        bounds.x +
        '" y="' +
        bounds.y +
        '" width="' +
        bounds.width +
        '" height="' +
        bounds.height +
        '" fill="white"/>'
    );
    for (var i = 0; i < mergedRegions.length; i++) {
      var pts = mergedRegions[i].points;
      if (!pts.length) continue;
      var pointsAttr = "";
      for (var p = 0; p < pts.length; p++) {
        if (p) pointsAttr += " ";
        pointsAttr += pts[p].x + "," + pts[p].y;
      }
      lines.push(
        '<polygon points="' + pointsAttr + '" fill="black"/>'
      );
    }
    lines.push("</mask>");
    lines.push("</defs>");

    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push('<g id="layer-grid-mask">');
    lines.push(
      '<rect x="' +
        bounds.x +
        '" y="' +
        bounds.y +
        '" width="' +
        bounds.width +
        '" height="' +
        bounds.height +
        '" fill="' +
        getCanvasBackgroundColor() +
        '" mask="url(#' +
        GRID_WHITE_MASK_ID +
        ')"/>'
    );
    lines.push("</g>");
    lines.push("</g>");
  }

  function renderStippleDotsLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-stipple-dots");
    var defs = designSvg.querySelector("defs");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    if (
      !isEmotionCanvasVisible("hope") ||
      !hasActiveMergeCutouts() ||
      !hopeStippleImageReady
    ) {
      applyMergeReveal();
      return;
    }

    var hasMergeClip = !!(
      defs && defs.querySelector("#" + MERGE_REGIONS_CLIP_ID)
    );
    if (hasMergeClip) {
      layer.setAttribute("clip-path", "url(#" + MERGE_REGIONS_CLIP_ID + ")");
    }

    ensureHopeDotsMaskDef(defs);
    var fill = elSvg("rect");
    fill.setAttribute("x", "0");
    fill.setAttribute("y", "0");
    fill.setAttribute("width", String(CANVAS_W));
    fill.setAttribute("height", String(CANVAS_H));
    fill.setAttribute("fill", getHopeDotsColor());
    fill.setAttribute("mask", "url(#" + HOPE_DOTS_MASK_ID + ")");
    layer.appendChild(fill);
  }

  /**
   * @param {string[]} lines
   */
  function pushStippleDotsExportLines(lines) {
    if (
      !isEmotionCanvasVisible("hope") ||
      !hasActiveMergeCutouts() ||
      !hopeStippleImageReady
    ) {
      return;
    }

    var mergedRegions = getMergedRegionsForMask();
    if (mergedRegions.length) {
      lines.push("<defs>");
      lines.push('<clipPath id="' + MERGE_REGIONS_CLIP_ID + '">');
      var i;
      var pts;
      var p;
      var pointsAttr;
      for (i = 0; i < mergedRegions.length; i++) {
        pts = mergedRegions[i].points;
        if (!pts.length) continue;
        pointsAttr = "";
        for (p = 0; p < pts.length; p++) {
          if (p) pointsAttr += " ";
          pointsAttr += pts[p].x + "," + pts[p].y;
        }
        lines.push('<polygon points="' + pointsAttr + '"/>');
      }
      lines.push("</clipPath>");
      lines.push("</defs>");
    }

    var imageHref = hopeStippleExportDataUri || hopeStippleRawExportDataUri || HOPE_STIPPLE_IMAGE;
    var dotColor = getHopeDotsColor();

    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push("<defs>");
    lines.push(
      '<filter id="' +
        HOPE_DOTS_MASK_INVERT_FILTER_ID +
        '-export"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1 -1 -1 1 1"/></filter>'
    );
    lines.push(
      '<mask id="' +
        HOPE_DOTS_MASK_ID +
        '-export" maskUnits="userSpaceOnUse" x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '"><image href="' +
        imageHref +
        '" filter="url(#' +
        HOPE_DOTS_MASK_INVERT_FILTER_ID +
        '-export)" x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '" preserveAspectRatio="none"/></mask>'
    );
    lines.push("</defs>");
    lines.push(
      '<g id="layer-stipple-dots" clip-path="url(#' +
        MERGE_REGIONS_CLIP_ID +
        ')">'
    );
    if (hopeStippleExportDataUri) {
      lines.push(
        '<image href="' +
          imageHref +
          '" x="0" y="0" width="' +
          CANVAS_W +
          '" height="' +
          CANVAS_H +
          '" preserveAspectRatio="none"/>'
      );
    } else {
      lines.push(
        '<rect x="0" y="0" width="' +
          CANVAS_W +
          '" height="' +
          CANVAS_H +
          '" fill="' +
          dotColor +
          '" mask="url(#' +
          HOPE_DOTS_MASK_ID +
          '-export)"/>'
      );
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  function buildLayoutSignature() {
    return lastOctagonsN + "|" + CANVAS_W + "|" + CANVAS_H;
  }

  function getUprightSquareCatalog() {
    if (isStarGrid()) {
      if (
        typeof NestedStarOctagonsGeometry === "undefined" ||
        !NestedStarOctagonsGeometry.buildJunctionCircleCatalog
      ) {
        return [];
      }
      return NestedStarOctagonsGeometry.buildJunctionCircleCatalog(
        getStarLayout(),
        CANVAS_W,
        CANVAS_H
      );
    }
    return TopkapiGeometry.buildUprightSquareCatalog(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H
    );
  }

  function getHelplessnessJunctionCatalog() {
    if (isStarGrid()) {
      if (
        typeof NestedStarOctagonsGeometry === "undefined" ||
        !NestedStarOctagonsGeometry.buildHelplessnessJunctionCatalog
      ) {
        return [];
      }
      return NestedStarOctagonsGeometry.buildHelplessnessJunctionCatalog(
        getStarLayout(),
        CANVAS_W,
        CANVAS_H
      );
    }
    return TopkapiGeometry.buildHelplessnessJunctionCatalog(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H,
      getInnerScale()
    );
  }

  function buildHelplessnessLayoutSignature() {
    if (isStarGrid()) {
      var layout = getStarLayout();
      return (
        "star-hp|" +
        layout.n +
        "|" +
        layout.rows +
        "|" +
        layout.cols +
        "|" +
        layout.offsetY +
        "|" +
        CANVAS_W +
        "|" +
        CANVAS_H
      );
    }
    return buildDiamondLayoutSignature() + "|" + getInnerScale();
  }

  function buildCircleLayoutSignature() {
    return buildDiamondLayoutSignature();
  }

  function getDiamondCatalog() {
    if (isStarGrid()) {
      if (
        typeof NestedStarOctagonsGeometry === "undefined" ||
        !NestedStarOctagonsGeometry.buildJunctionDiamondCatalog
      ) {
        return [];
      }
      return NestedStarOctagonsGeometry.buildJunctionDiamondCatalog(
        getStarLayout(),
        CANVAS_W,
        CANVAS_H
      );
    }
    return TopkapiGeometry.buildDiamondCatalog(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H,
      1
    );
  }

  function buildDiamondLayoutSignature() {
    if (isStarGrid()) {
      var layout = getStarLayout();
      return (
        "star|" +
        layout.n +
        "|" +
        layout.rows +
        "|" +
        layout.cols +
        "|" +
        layout.offsetY +
        "|" +
        CANVAS_W +
        "|" +
        CANVAS_H
      );
    }
    return lastOctagonsN + "|" + CANVAS_W + "|" + CANVAS_H;
  }

  /**
   * @param {{ id: string }[]} catalog
   * @param {number} count
   * @returns {string[]}
   */
  function shufflePickIds(catalog, count) {
    var ids = catalog.map(function (item) {
      return item.id;
    });
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    return ids.slice(0, count);
  }

  /**
   * @param {number} seed
   * @returns {function(): number}
   */
  function createSeededRandom(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {{ id: string }[]} catalog
   * @param {number} count
   * @param {number} seed
   * @returns {string[]}
   */
  function seededShufflePickIds(catalog, count, seed) {
    var rng = createSeededRandom(seed);
    var ids = catalog.map(function (item) {
      return item.id;
    });
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    return ids.slice(0, count);
  }

  function getHelplessnessShuffleSeed() {
    return HELPLESSNESS_SHUFFLE_SEED + getHelplessnessPercent() * 1000;
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncHelplessnessSelection(forceReshuffle) {
    var catalog = getHelplessnessJunctionCatalog();
    var validIds = new Set();
    for (var i = 0; i < catalog.length; i++) {
      validIds.add(catalog[i].id);
    }

    if (!forceReshuffle) {
      helplessnessSelectedIds.forEach(function (id) {
        if (!validIds.has(id)) helplessnessSelectedIds.delete(id);
      });
    }

    var target = Math.round((catalog.length * getHelplessnessPercent()) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    if (forceReshuffle || helplessnessSelectedIds.size !== target) {
      helplessnessSelectedIds.clear();
      var picked = seededShufflePickIds(
        catalog,
        target,
        getHelplessnessShuffleSeed()
      );
      for (var p = 0; p < picked.length; p++) {
        helplessnessSelectedIds.add(picked[p]);
      }
    }
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncCircleSelection(forceReshuffle) {
    var catalog = getUprightSquareCatalog();
    var validIds = new Set();
    for (var i = 0; i < catalog.length; i++) {
      validIds.add(catalog[i].id);
    }

    if (!forceReshuffle) {
      circleSelectedIds.forEach(function (id) {
        if (!validIds.has(id)) circleSelectedIds.delete(id);
      });
    }

    var density = getCircleDensity();
    var target = Math.round((catalog.length * density) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    if (forceReshuffle || circleSelectedIds.size !== target) {
      circleSelectedIds.clear();
      var picked = shufflePickIds(catalog, target);
      for (var p = 0; p < picked.length; p++) {
        circleSelectedIds.add(picked[p]);
      }
    }
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncLongingCircleSelection(forceReshuffle) {
    var catalog = getUprightSquareCatalog();
    var validIds = new Set();
    for (var i = 0; i < catalog.length; i++) {
      validIds.add(catalog[i].id);
    }

    if (!forceReshuffle) {
      longingCircleSelectedIds.forEach(function (id) {
        if (!validIds.has(id)) longingCircleSelectedIds.delete(id);
      });
    }

    var density = getLongingCircleDensity();
    var target = Math.round((catalog.length * density) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    if (forceReshuffle || longingCircleSelectedIds.size !== target) {
      longingCircleSelectedIds.clear();
      var picked = shufflePickIds(catalog, target);
      for (var p = 0; p < picked.length; p++) {
        longingCircleSelectedIds.add(picked[p]);
      }
    }
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncGriefCircleSelection(forceReshuffle) {
    var catalog = getUprightSquareCatalog();
    var validIds = new Set();
    for (var i = 0; i < catalog.length; i++) {
      validIds.add(catalog[i].id);
    }

    if (!forceReshuffle) {
      griefCircleSelectedIds.forEach(function (id) {
        if (!validIds.has(id)) griefCircleSelectedIds.delete(id);
      });
    }

    var density = getGriefCircleDensity();
    var target = Math.round((catalog.length * density) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    if (forceReshuffle || griefCircleSelectedIds.size !== target) {
      griefCircleSelectedIds.clear();
      var picked = shufflePickIds(catalog, target);
      for (var p = 0; p < picked.length; p++) {
        griefCircleSelectedIds.add(picked[p]);
      }
    }
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncDiamondFill(forceReshuffle) {
    var catalog = getDiamondCatalog();
    var validIds = new Set();
    for (var i = 0; i < catalog.length; i++) {
      validIds.add(catalog[i].id);
    }

    if (!forceReshuffle) {
      diamondFilledIds.forEach(function (id) {
        if (!validIds.has(id)) diamondFilledIds.delete(id);
      });
      return;
    }

    var target = Math.round((catalog.length * getPrideFillPercent()) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    diamondFilledIds.clear();
    var picked = shufflePickIds(catalog, target);
    for (var p = 0; p < picked.length; p++) {
      diamondFilledIds.add(picked[p]);
    }
  }

  /** Random-fill inner diamonds (Pride slider / button). */
  function syncPrideShapes() {
    syncDiamondFill(true);
  }

  function syncGuiltShameDiamondFill(forceReshuffle) {
    var catalog = getDiamondCatalog();
    var validIds = new Set();
    for (var i = 0; i < catalog.length; i++) {
      validIds.add(catalog[i].id);
    }

    if (!forceReshuffle) {
      guiltShameFilledIds.forEach(function (id) {
        if (!validIds.has(id)) guiltShameFilledIds.delete(id);
      });
      return;
    }

    var target = Math.round((catalog.length * getGuiltShameFillPercent()) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    guiltShameFilledIds.clear();
    var picked = shufflePickIds(catalog, target);
    for (var p = 0; p < picked.length; p++) {
      guiltShameFilledIds.add(picked[p]);
    }
  }

  function syncGuiltShameShapes() {
    syncGuiltShameDiamondFill(true);
  }

  /**
   * @returns {{ id: string, points: { x: number, y: number }[] }[]}
   */
  function getFilledHollowDiamonds() {
    if (!isEmotionCanvasVisible("guiltShame")) return [];
    var catalog = getDiamondCatalog();
    var filled = [];
    for (var i = 0; i < catalog.length; i++) {
      var dm = catalog[i];
      if (guiltShameFilledIds.has(dm.id)) filled.push(dm);
    }
    return filled;
  }

  /**
   * @param {{ x: number, y: number }[]} points
   * @param {number} scale
   * @returns {{ x: number, y: number }[]}
   */
  function scaleDiamondPointsTowardCenter(points, scale) {
    var cx = 0;
    var cy = 0;
    var i;
    for (i = 0; i < points.length; i++) {
      cx += points[i].x;
      cy += points[i].y;
    }
    cx /= points.length;
    cy /= points.length;
    var scaled = [];
    for (i = 0; i < points.length; i++) {
      scaled.push({
        x: cx + (points[i].x - cx) * scale,
        y: cy + (points[i].y - cy) * scale,
      });
    }
    return scaled;
  }

  /**
   * @param {{ x: number, y: number }[]} points
   * @returns {string}
   */
  function pointsToClosedPathD(points) {
    if (!points.length) return "";
    var d = "M" + points[0].x + "," + points[0].y;
    for (var i = 1; i < points.length; i++) {
      d += "L" + points[i].x + "," + points[i].y;
    }
    return d + "Z";
  }

  /**
   * @param {{ x: number, y: number }[]} outerPoints
   * @returns {string}
   */
  function hollowDiamondPathD(outerPoints) {
    var innerScale =
      typeof GUILT_SHAME_INNER_DIAMOND_SCALE !== "undefined"
        ? GUILT_SHAME_INNER_DIAMOND_SCALE
        : 0.5;
    var innerPoints = scaleDiamondPointsTowardCenter(outerPoints, innerScale);
    return pointsToClosedPathD(outerPoints) + pointsToClosedPathD(innerPoints);
  }

  /**
   * @param {{ id: string, points: { x: number, y: number }[] }[]} diamonds
   * @returns {SVGElement}
   */
  function hollowDiamondsToGroup(diamonds) {
    var g = elSvg("g");
    var fillColor = getGuiltShameDiamondFillColor();
    for (var i = 0; i < diamonds.length; i++) {
      var dm = diamonds[i];
      var path = elSvg("path");
      path.setAttribute("d", hollowDiamondPathD(dm.points));
      path.setAttribute("fill", fillColor);
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("stroke", "none");
      g.appendChild(path);
    }
    return g;
  }

  /**
   * @returns {{ id: string, points: { x: number, y: number }[] }[]}
   */
  function getFilledDiamonds() {
    if (!isEmotionCanvasVisible("pain")) return [];
    var catalog = getDiamondCatalog();
    var filled = [];
    for (var i = 0; i < catalog.length; i++) {
      var dm = catalog[i];
      if (diamondFilledIds.has(dm.id)) filled.push(dm);
    }
    return filled;
  }

  /**
   * @param {{ id: string, points: { x: number, y: number }[] }[]} diamonds
   * @returns {SVGElement}
   */
  function diamondsToGroup(diamonds) {
    var g = elSvg("g");
    var fillColor = getDiamondFillColor();
    for (var i = 0; i < diamonds.length; i++) {
      var dm = diamonds[i];
      var pts = dm.points;
      var pointsAttr = "";
      for (var p = 0; p < pts.length; p++) {
        if (p) pointsAttr += " ";
        pointsAttr += pts[p].x + "," + pts[p].y;
      }
      var poly = elSvg("polygon");
      poly.setAttribute("points", pointsAttr);
      poly.setAttribute("fill", fillColor);
      poly.setAttribute("stroke", "none");
      g.appendChild(poly);
    }
    return g;
  }

  /**
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {SVGElement}
   */
  function autoMergeFillsToGroup(regions) {
    var g = elSvg("g");
    var fillColor = getAutoMergeFillColor();
    var i;
    var pts;

    for (i = 0; i < regions.length; i++) {
      pts = regions[i].points;
      if (!pts.length) continue;
      g.appendChild(createAutoMergeRegionGroup(pts, fillColor));
    }
    return g;
  }

  function renderAutoMergeFillsLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-auto-merge-fills");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    if (
      isEmotionCanvasVisible("pride") &&
      autoMergeFillRegions &&
      autoMergeFillRegions.length
    ) {
      var defs = designSvg.querySelector("defs");
      if (defs) ensureAutoMergeShadowFilter(defs);
      layer.appendChild(autoMergeFillsToGroup(autoMergeFillRegions));
    }
  }

  /**
   * @returns {{ cx: number, cy: number, r: number }[]}
   */
  function getActiveCircles() {
    if (!isEmotionCanvasVisible("sadness")) return [];
    var catalog = getUprightSquareCatalog();
    var circles = [];
    for (var i = 0; i < catalog.length; i++) {
      var sq = catalog[i];
      if (circleSelectedIds.has(sq.id)) {
        circles.push({ cx: sq.cx, cy: sq.cy, r: sq.r });
      }
    }
    return circles;
  }

  /**
   * @returns {{ cx: number, cy: number, r: number }[]}
   */
  function getActiveLongingCircles() {
    if (!isEmotionCanvasVisible("longing")) return [];
    var catalog = getUprightSquareCatalog();
    var circles = [];
    for (var i = 0; i < catalog.length; i++) {
      var sq = catalog[i];
      if (longingCircleSelectedIds.has(sq.id)) {
        circles.push({ cx: sq.cx, cy: sq.cy, r: sq.r });
      }
    }
    return circles;
  }

  /**
   * @returns {{ cx: number, cy: number, r: number }[]}
   */
  function getActiveGriefCircles() {
    if (!isEmotionCanvasVisible("grief")) return [];
    var catalog = getUprightSquareCatalog();
    var circles = [];
    for (var i = 0; i < catalog.length; i++) {
      var sq = catalog[i];
      if (griefCircleSelectedIds.has(sq.id)) {
        circles.push({ cx: sq.cx, cy: sq.cy, r: sq.r });
      }
    }
    return circles;
  }

  /**
   * @returns {{ cx: number, cy: number, halfW: number, halfH: number }[]}
   */
  function getActiveHelplessnessMarks() {
    if (!isHelplessnessLayerVisible()) return [];
    var catalog = getHelplessnessJunctionCatalog();
    var marks = [];
    for (var i = 0; i < catalog.length; i++) {
      var entry = catalog[i];
      if (helplessnessSelectedIds.has(entry.id)) {
        marks.push({
          cx: entry.cx,
          cy: entry.cy,
          halfW: entry.halfW,
          halfH: entry.halfH,
        });
      }
    }
    return marks;
  }

  /**
   * @param {{ cx: number, cy: number, halfW: number, halfH: number }[]} marks
   */
  function appendHelplessnessMarkLines(group, marks) {
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      var xMin = m.cx - m.halfW;
      var yMin = m.cy - m.halfH;
      var xMax = m.cx + m.halfW;
      var yMax = m.cy + m.halfH;
      var line1 = elSvg("line");
      line1.setAttribute("x1", String(xMin));
      line1.setAttribute("y1", String(yMin));
      line1.setAttribute("x2", String(xMax));
      line1.setAttribute("y2", String(yMax));
      group.appendChild(line1);
      var line2 = elSvg("line");
      line2.setAttribute("x1", String(xMax));
      line2.setAttribute("y1", String(yMin));
      line2.setAttribute("x2", String(xMin));
      line2.setAttribute("y2", String(yMax));
      group.appendChild(line2);
    }
  }

  /**
   * @param {{ cx: number, cy: number, halfW: number, halfH: number }[]} marks
   * @returns {SVGElement}
   */
  function helplessnessToGroup(marks) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-helplessness");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getPatternStrokeColor());
    g.setAttribute(
      "stroke-width",
      String(
        typeof HELPLESSNESS_STROKE_WIDTH !== "undefined"
          ? HELPLESSNESS_STROKE_WIDTH
          : 3
      )
    );
    appendHelplessnessMarkLines(g, marks);
    return g;
  }

  /**
   * @param {{ cx: number, cy: number, r: number }[]} circles
   * @returns {SVGElement}
   */
  function circlesToGroup(circles) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-circles");
    g.setAttribute("fill", getCircleFillColor());
    var circleStroke = getCircleStrokeWidth();
    g.setAttribute("stroke", getCircleStrokeColor());
    g.setAttribute("stroke-width", String(circleStroke));

    var strokeInset = circleStroke / 2;
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      var circle = elSvg("circle");
      circle.setAttribute("cx", String(c.cx));
      circle.setAttribute("cy", String(c.cy));
      circle.setAttribute("r", String(Math.max(0, c.r - strokeInset)));
      g.appendChild(circle);
    }
    return g;
  }

  /**
   * @param {{ cx: number, cy: number, r: number }[]} circles
   * @returns {SVGElement}
   */
  function longingCirclesToGroup(circles) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-longing-circles");
    g.setAttribute("fill", "none");
    var circleStroke = getLongingCircleStrokeWidth();
    g.setAttribute("stroke", getPatternStrokeColor());
    g.setAttribute("stroke-width", String(circleStroke));

    var strokeInset = circleStroke / 2;
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      var circle = elSvg("circle");
      circle.setAttribute("cx", String(c.cx));
      circle.setAttribute("cy", String(c.cy));
      circle.setAttribute("r", String(Math.max(0, c.r - strokeInset)));
      g.appendChild(circle);
    }
    return g;
  }

  /**
   * Outline-only circles with a nested inner ring (diameter 3px smaller).
   * @param {{ cx: number, cy: number, r: number }[]} circles
   * @returns {SVGElement}
   */
  function griefCirclesToGroup(circles) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-grief-circles");
    g.setAttribute("fill", "none");
    var circleStroke = getGriefCircleStrokeWidth();
    g.setAttribute("stroke", getPatternStrokeColor());
    g.setAttribute("stroke-width", String(circleStroke));

    var strokeInset = circleStroke / 2;
    var innerRadiusOffset = GRIEF_INNER_CIRCLE_DIAMETER_GAP_PX / 2;
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      var outerDrawR = Math.max(0, c.r - strokeInset);

      var outerCircle = elSvg("circle");
      outerCircle.setAttribute("cx", String(c.cx));
      outerCircle.setAttribute("cy", String(c.cy));
      outerCircle.setAttribute("r", String(outerDrawR));
      g.appendChild(outerCircle);

      var innerDrawR = Math.max(0, outerDrawR - innerRadiusOffset);
      if (innerDrawR > 0) {
        var innerCircle = elSvg("circle");
        innerCircle.setAttribute("cx", String(c.cx));
        innerCircle.setAttribute("cy", String(c.cy));
        innerCircle.setAttribute("r", String(innerDrawR));
        g.appendChild(innerCircle);
      }
    }
    return g;
  }

  function updateLayoutState() {
    lastOctagonsN = getOctagonsN();
    if (isStarGrid()) {
      var starLayout = getStarLayout();
      lastOctagonsN = starLayout.n;
      lastTileSize = starLayout.tileSize;
    } else {
      lastTileSize = TopkapiGeometry.tileSizeFromN(lastOctagonsN, CANVAS_W);
    }
  }

  function buildAllSegments() {
    if (isStarGrid()) {
      var layout = getStarLayout();
      if (
        typeof NestedStarOctagonsGeometry === "undefined" ||
        !NestedStarOctagonsGeometry.buildPattern
      ) {
        cachedStarFills = [];
        return [];
      }
      var pattern = NestedStarOctagonsGeometry.buildPattern(layout);
      cachedStarFills = pattern.starFills || [];
      return pattern.segments;
    }
    cachedStarFills = [];
    return TopkapiGeometry.buildPatternSegments(
      lastTileSize,
      CANVAS_W,
      CANVAS_H,
      lastOctagonsN,
      getInnerScale()
    );
  }

  /**
   * Inner star fill outlines as segments (tracing only — not drawn as extra lines).
   * @param {{ outline: { x: number, y: number }[] }[]} starFills
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function starFillOutlineSegments(starFills) {
    var out = [];
    var seen = new Set();
    var fi;
    var ei;
    var pts;
    var n;
    var a;
    var b;
    var key;

    for (fi = 0; fi < starFills.length; fi++) {
      pts = starFills[fi].outline;
      if (!pts || pts.length < 3) continue;
      n = pts.length;
      for (ei = 0; ei < n; ei++) {
        a = pts[ei];
        b = pts[(ei + 1) % n];
        key = TopkapiGeometry.segmentKey(a.x, a.y, b.x, b.y);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
    return out;
  }

  /** Line network for face tracing / merge (includes star fill boundaries on star grid). */
  function getAllSegmentsForTracing() {
    if (!isStarGrid() || !cachedStarFills.length) {
      return cachedAllSegments;
    }
    var seen = new Set();
    var out = [];
    var i;
    var s;
    var key;
    for (i = 0; i < cachedAllSegments.length; i++) {
      s = cachedAllSegments[i];
      key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    var extra = starFillOutlineSegments(cachedStarFills);
    for (i = 0; i < extra.length; i++) {
      s = extra[i];
      key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  /**
   * Hope mask / merge cutouts use the same segment network as drag tracing (includes
   * star fill outlines on the star grid). False positives are filtered in
   * filterHopeMergeRegionsForGridType (min area + multi-star enclosure).
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getSegmentsForMergeRegionDetection() {
    return getAllSegmentsForTracing();
  }

  function hopePointInPolygon(px, py, points) {
    var inside = false;
    var i;
    var j;
    for (i = 0, j = points.length - 1; i < points.length; j = i++) {
      var yi = points[i].y;
      var yj = points[j].y;
      if ((yi > py) !== (yj > py)) {
        if (
          px <
          ((points[j].x - points[i].x) * (py - yi)) / (yj - yi) + points[i].x
        ) {
          inside = !inside;
        }
      }
    }
    return inside;
  }

  function getStarFillCentroid(outline) {
    var x = 0;
    var y = 450;
    var i;
    for (i = 0; i < outline.length; i++) {
      x += outline[i].x;
      y += outline[i].y;
    }
    return { x: x / outline.length, y: y / outline.length };
  }

  /** How many star cells lie inside a merged Hope cutout (must be 2+ for a real merge). */
  function countStarFillsInsideMergeRegion(region) {
    if (!cachedStarFills.length || !region.points.length) return 0;
    var count = 0;
    var i;
    var outline;
    var c;
    for (i = 0; i < cachedStarFills.length; i++) {
      outline = cachedStarFills[i].outline;
      if (!outline || outline.length < 3) continue;
      c = getStarFillCentroid(outline);
      if (hopePointInPolygon(c.x, c.y, region.points)) count++;
    }
    return count;
  }

  function polygonAreaAbs(points) {
    var area = 0;
    var i;
    var j;
    for (i = 0; i < points.length; i++) {
      j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area * 0.5);
  }

  function getStarGridHopeMergeMinAreaPx() {
    var tile = lastTileSize;
    if (!tile || tile <= 0) {
      tile = getStarLayout().tileSize;
    }
    var frac =
      typeof STAR_GRID_HOPE_MERGE_MIN_AREA_TILE_FRACTION !== "undefined"
        ? STAR_GRID_HOPE_MERGE_MIN_AREA_TILE_FRACTION
        : 0.45;
    return tile * tile * frac;
  }

  /**
   * Star grid: drop micro-faces and single-star false positives; keep real multi-star merges.
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function filterHopeMergeRegionsForGridType(regions) {
    if (!regions.length) return regions;
    if (isStarGrid()) {
      var minArea = getStarGridHopeMergeMinAreaPx();
      var out = [];
      var i;
      for (i = 0; i < regions.length; i++) {
        if (polygonAreaAbs(regions[i].points) < minArea) continue;
        if (countStarFillsInsideMergeRegion(regions[i]) < 2) continue;
        out.push(regions[i]);
      }
      return out;
    }

    var bounds = getGridContentBounds();
    var maxHoleArea = bounds.width * bounds.height * 0.4;
    var octOut = [];
    var oi;
    for (oi = 0; oi < regions.length; oi++) {
      if (polygonAreaAbs(regions[oi].points) > maxHoleArea) continue;
      octOut.push(regions[oi]);
    }
    return octOut;
  }

  function isConvexPolygon(points) {
    var n = points.length;
    if (n < 4) return false;
    var sign = 0;
    for (var i = 0; i < n; i++) {
      var a = points[i];
      var b = points[(i + 1) % n];
      var c = points[(i + 2) % n];
      var abx = b.x - a.x;
      var aby = b.y - a.y;
      var bcx = c.x - b.x;
      var bcy = c.y - b.y;
      var cross = abx * bcy - aby * bcx;
      if (Math.abs(cross) < 1e-6) continue;
      var s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return sign !== 0;
  }

  /**
   * Pride star-grid preference: drop "simple" single-cell octagon fills.
   * These show up often as a plain convex 8-sided region roughly one tile in area.
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function filterStarGridPrideAutoMergeRegions(regions) {
    if (!isStarGrid() || !regions.length) return regions;
    var layout = getStarLayout();
    var T = layout && layout.tileSize ? layout.tileSize : lastTileSize;
    if (!T || T <= 0) return regions;
    var tileArea = T * T;

    var out = [];
    for (var i = 0; i < regions.length; i++) {
      var region = regions[i];
      var pts = region.points || [];
      if (pts.length < 3) continue;

      var starsInside = countStarFillsInsideMergeRegion(region);
      var area = polygonAreaAbs(pts);
      var isSimpleOctagon =
        starsInside <= 1 &&
        pts.length >= 8 &&
        pts.length <= 10 &&
        isConvexPolygon(pts) &&
        area > tileArea * 0.55 &&
        area < tileArea * 0.95;

      if (isSimpleOctagon) continue;
      out.push(region);
    }
    return out;
  }

  function isSegmentRemoved(key) {
    if (removedEdges.has(key)) return true;
    if (isEmotionCanvasVisible("pride") && autoMergeEdgeKeys.has(key)) {
      return true;
    }
    return false;
  }

  function getVisibleSegments(segments) {
    var visible = [];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!isSegmentRemoved(key)) visible.push(s);
    }
    return visible;
  }

  /**
   * Visible grid with manual merges only (baseline for auto-merge clustering).
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getVisibleSegmentsManualOnly(segments) {
    var visible = [];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!removedEdges.has(key)) visible.push(s);
    }
    return visible;
  }

  function getCombinedRemovedEdgeSet() {
    var combined = new Set(removedEdges);
    autoMergeEdgeKeys.forEach(function (key) {
      combined.add(key);
    });
    return combined;
  }

  function isDragInteractionMode() {
    return interactionMode === "merge" || interactionMode === "restore";
  }

  function clearMergeState() {
    removedEdges.clear();
    stickyMergedCutoutFaces = null;
    updateResetButton();
  }

  function clearAutoMergeState() {
    autoMergeEdgeKeys.clear();
    autoMergeFillRegions = null;
    updateResetButton();
    renderAutoMergeFillsLayer();
  }

  function updateResetButton() {
    var resetBtn = document.getElementById("reset-grid-btn");
    if (resetBtn) {
      resetBtn.disabled =
        removedEdges.size === 0 && autoMergeEdgeKeys.size === 0;
    }
  }

  function applyAutoMergeDanglingPrune() {
    var changed = false;
    var combined = getCombinedRemovedEdgeSet();
    var pruneKeys = TopkapiGeometry.findDanglingPruneKeys(
      getAllSegmentsForTracing(),
      combined,
      { bounds: getGridContentBounds() }
    );
    var j;
    var pk;
    for (j = 0; j < pruneKeys.length; j++) {
      pk = pruneKeys[j];
      if (removedEdges.has(pk)) continue;
      if (autoMergeEdgeKeys.has(pk)) continue;
      autoMergeEdgeKeys.add(pk);
      changed = true;
    }
    return changed;
  }

  function runAutoMerge() {
    var allSegments = getAllSegmentsForTracing();
    if (!allSegments.length) return;

    clearAutoMergeState();

    var bounds = getGridContentBounds();
    var manualVisible = getVisibleSegmentsManualOnly(allSegments);
    var baselineFaces = TopkapiGeometry.traceFaces(manualVisible);
    var plan = TopkapiGeometry.computeAutoMergePlan(
      baselineFaces,
      bounds,
      getAutoMergePlanOptions()
    );

    var i;
    var key;
    for (i = 0; i < plan.edgeKeys.length; i++) {
      key = plan.edgeKeys[i];
      autoMergeEdgeKeys.add(key);
    }

    while (applyAutoMergeDanglingPrune()) {
      /* prune waves until stable */
    }

    var fillRegions = [];
    var clusters = plan.clusters || [];
    var ci;
    var fillRegion;

    for (ci = 0; ci < clusters.length; ci++) {
      fillRegion = TopkapiGeometry.getClusterFillRegion(
        allSegments,
        baselineFaces,
        clusters[ci].faceIndices,
        clusters[ci].edgeKeys,
        autoMergeEdgeKeys
      );
      if (fillRegion) fillRegions.push(fillRegion);
    }

    // Star grid has thousands of small faces; orphan detection fills ~300 extra
    // regions and blankets the canvas. Octagon grid still uses orphan fills.
    if (!isStarGrid()) {
      fillRegions = TopkapiGeometry.appendOrphanAutoMergeFillRegions(
        fillRegions,
        allSegments,
        baselineFaces,
        autoMergeEdgeKeys
      );
    }

    autoMergeFillRegions = TopkapiGeometry.filterAutoMergeFillRegions(
      fillRegions,
      baselineFaces
    );
    autoMergeFillRegions = filterStarGridPrideAutoMergeRegions(autoMergeFillRegions);

    renderPatternAndVerticalLayers();
    renderAutoMergeFillsLayer();
    updateResetButton();
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {SVGElement}
   */
  function segmentsToGroup(segments) {
    var g = elSvg("g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getPatternStrokeColor());
    g.setAttribute("stroke-width", String(getGridStrokeWidth()));
    g.setAttribute("stroke-linecap", "square");
    g.setAttribute("stroke-linejoin", "miter");

    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      var line = elSvg("line");
      line.setAttribute("x1", String(s.x1));
      line.setAttribute("y1", String(s.y1));
      line.setAttribute("x2", String(s.x2));
      line.setAttribute("y2", String(s.y2));
      line.setAttribute("data-key", key);
      g.appendChild(line);
    }
    return g;
  }

  /**
   * Inner nested stars (geometry stores these as filled outlines, not line segments).
   * @param {{ outline: {x:number,y:number}[] }[]} starFills
   * @returns {SVGElement}
   */
  function starFillsToGroup(starFills) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-star-fills");
    var i;
    var p;
    var d;
    for (i = 0; i < starFills.length; i++) {
      d =
        typeof NestedStarOctagonsGeometry !== "undefined" &&
        NestedStarOctagonsGeometry.closedPolygonPathD
          ? NestedStarOctagonsGeometry.closedPolygonPathD(starFills[i].outline)
          : "";
      if (!d) continue;
      p = elSvg("path");
      p.setAttribute("d", d);
      p.setAttribute("fill", getCanvasBackgroundColor());
      p.setAttribute("fill-rule", "nonzero");
      // Outlines are drawn as line segments (includes star-fill edges for merge).
      p.setAttribute("stroke", "none");
      g.appendChild(p);
    }
    return g;
  }

  function getGridContentBounds() {
    if (isStarGrid()) {
      var starLayout = getStarLayout();
      var gridH = starLayout.rows * starLayout.tileSize;
      var y0 = Math.max(0, starLayout.offsetY);
      var y1 = Math.min(CANVAS_H, starLayout.offsetY + gridH);
      return {
        x: 0,
        y: y0,
        width: CANVAS_W,
        height: y1 - y0,
      };
    }
    return TopkapiGeometry.getGridContentBounds(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H
    );
  }

  /**
   * Canvas X of the inner edge of the border strip (inward from white margin).
   * Thin = 1 column, Medium = 2, Thick = 3.
   * @returns {number}
   */
  function getBorderStripInnerEdgePx() {
    return getBorderSideThicknessColumns() * getCanvasBorderPx();
  }

  /**
   * Grid-boundary rect in inner-content coordinates, inset horizontally so the
   * thick outline sits on the inner edge of the innermost border column.
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function getGridBoundaryDisplayBounds() {
    var bounds = getGridContentBounds();
    var inset = getBorderStripInnerEdgePx();
    var off = getInnerContentOffset();
    var s = getInnerContentScale();
    return {
      x: (inset - off.x) / s,
      y: bounds.y,
      width: (CANVAS_W - 2 * inset) / s,
      height: bounds.height,
    };
  }

  /**
   * Color-division tiles use the grid content band only — not the white margin
   * frame (border-side-segments). The frame overlay is a separate top layer.
   */
  function getColorDivisionsCanvasBounds() {
    var bounds = getGridContentBounds();
    var off = getInnerContentOffset();
    var s = getInnerContentScale();
    return {
      x: off.x + bounds.x * s,
      y: off.y + bounds.y * s,
      width: bounds.width * s,
      height: bounds.height * s,
    };
  }

  function buildColorDivisionLayoutSignature() {
    return [gridType, colorDivisionShuffleSeed].join("|");
  }

  function absoluteColorDivisionRectToNormalized(rect, bounds) {
    var bw = bounds.width || 1;
    var bh = bounds.height || 1;
    return {
      nx: (rect.x - bounds.x) / bw,
      ny: (rect.y - bounds.y) / bh,
      nw: rect.width / bw,
      nh: rect.height / bh,
    };
  }

  function normalizedColorDivisionRectToAbsolute(norm, bounds) {
    return {
      x: bounds.x + norm.nx * bounds.width,
      y: bounds.y + norm.ny * bounds.height,
      width: norm.nw * bounds.width,
      height: norm.nh * bounds.height,
    };
  }

  function getAbsoluteColorDivisionRects() {
    if (!cachedColorDivisionNormalizedRects) return null;
    var bounds = getColorDivisionsCanvasBounds();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    var rects = [];
    var i;
    for (i = 0; i < cachedColorDivisionNormalizedRects.length; i++) {
      rects.push(
        normalizedColorDivisionRectToAbsolute(
          cachedColorDivisionNormalizedRects[i],
          bounds
        )
      );
    }
    return rects;
  }

  function absoluteColorDivisionRectsToNormalized(rects, bounds) {
    var normalized = [];
    var i;
    for (i = 0; i < rects.length; i++) {
      normalized.push(absoluteColorDivisionRectToNormalized(rects[i], bounds));
    }
    return normalized;
  }

  function getColorDivisionsSliderValue() {
    var slider = document.getElementById("color-divisions");
    var min =
      typeof COLOR_DIVISIONS_MIN !== "undefined" ? COLOR_DIVISIONS_MIN : 1;
    var max =
      typeof COLOR_DIVISIONS_MAX !== "undefined" ? COLOR_DIVISIONS_MAX : 5;
    var def =
      typeof COLOR_DIVISIONS_DEFAULT !== "undefined"
        ? COLOR_DIVISIONS_DEFAULT
        : 1;
    if (!slider) return def;
    var v = parseInt(slider.value, 10);
    if (!isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  }

  function getColorDivisionsColoredCount() {
    return Math.max(0, getColorDivisionsSliderValue() - 1);
  }

  function getColorDivisionsFillDefault(index) {
    if (
      typeof COLOR_DIVISIONS_FILL_DEFAULTS !== "undefined" &&
      COLOR_DIVISIONS_FILL_DEFAULTS[index]
    ) {
      return COLOR_DIVISIONS_FILL_DEFAULTS[index];
    }
    return typeof COLOR_DIVISIONS_FILL_DEFAULT !== "undefined"
      ? COLOR_DIVISIONS_FILL_DEFAULT
      : "#888888";
  }

  function getColorDivisionsFillColor(index) {
    var slots = ["H1", "H2", "H3", "H4", "H5"];
    return sheetColor(slots[index] || "H5");
  }

  function syncColorDivisionsOutput() {
    var out = document.getElementById("color-divisions-out");
    if (out) out.textContent = String(getColorDivisionsSliderValue());
  }

  function rectArea(r) {
    return r.width * r.height;
  }

  function pickWeightedRectIndex(rects) {
    var total = 0;
    var i;
    for (i = 0; i < rects.length; i++) {
      total += rectArea(rects[i]);
    }
    if (total <= 0) return 0;
    var pick = Math.random() * total;
    var acc = 0;
    for (i = 0; i < rects.length; i++) {
      acc += rectArea(rects[i]);
      if (pick <= acc) return i;
    }
    return rects.length - 1;
  }

  var COLOR_DIVISION_MIN_SPLIT_PX = 12;

  /**
   * @param {{ width: number, height: number }} rect
   * @returns {"vertical"|"horizontal"|null}
   */
  function pickColorDivisionSplitOrientation(rect) {
    var min = COLOR_DIVISION_MIN_SPLIT_PX;
    var canVertical = rect.width >= min * 2;
    var canHorizontal = rect.height >= min * 2;
    if (!canVertical && !canHorizontal) return null;
    if (!canVertical) return "horizontal";
    if (!canHorizontal) return "vertical";
    var aspect = rect.width / rect.height;
    if (aspect > 1.35) {
      return Math.random() < 0.7 ? "vertical" : "horizontal";
    }
    if (aspect < 0.75) {
      return Math.random() < 0.7 ? "horizontal" : "vertical";
    }
    return Math.random() < 0.5 ? "vertical" : "horizontal";
  }

  function splitColorDivisionRect(rect, orientation) {
    var ratio = 0.2 + Math.random() * 0.6;
    if (orientation === "vertical") {
      var w1 = rect.width * ratio;
      var w2 = rect.width - w1;
      return [
        { x: rect.x, y: rect.y, width: w1, height: rect.height },
        { x: rect.x + w1, y: rect.y, width: w2, height: rect.height },
      ];
    }
    var h1 = rect.height * ratio;
    var h2 = rect.height - h1;
    return [
      { x: rect.x, y: rect.y, width: rect.width, height: h1 },
      { x: rect.x, y: rect.y + h1, width: rect.width, height: h2 },
    ];
  }

  function generateColorDivisionRects(bounds) {
    var rects = [
      {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    ];
    var safety = 0;
    while (rects.length < 5 && safety < 32) {
      safety += 1;
      var idx = pickWeightedRectIndex(rects);
      var target = rects[idx];
      var orientation = pickColorDivisionSplitOrientation(target);
      if (!orientation) continue;
      var pair = splitColorDivisionRect(target, orientation);
      rects.splice(idx, 1, pair[0], pair[1]);
    }
    while (rects.length < 5) {
      var largest = 0;
      var li;
      for (li = 1; li < rects.length; li++) {
        if (rectArea(rects[li]) > rectArea(rects[largest])) largest = li;
      }
      var fallback = rects[largest];
      var forced = pickColorDivisionSplitOrientation(fallback);
      if (!forced) {
        forced = fallback.width >= fallback.height ? "vertical" : "horizontal";
      }
      var forcedPair = splitColorDivisionRect(fallback, forced);
      rects.splice(largest, 1, forcedPair[0], forcedPair[1]);
    }
    return rects;
  }

  var COLOR_DIVISION_ADJ_EPS = 0.5;

  function colorDivisionRectsShareEdge(a, b) {
    var e = COLOR_DIVISION_ADJ_EPS;
    var aR = a.x + a.width;
    var aB = a.y + a.height;
    var bR = b.x + b.width;
    var bB = b.y + b.height;
    var overlap;

    if (Math.abs(aR - b.x) <= e || Math.abs(bR - a.x) <= e) {
      overlap = Math.min(aB, bB) - Math.max(a.y, b.y);
      if (overlap > e) return true;
    }
    if (Math.abs(aB - b.y) <= e || Math.abs(bB - a.y) <= e) {
      overlap = Math.min(aR, bR) - Math.max(a.x, b.x);
      if (overlap > e) return true;
    }
    return false;
  }

  function buildColorDivisionAdjacency(rects) {
    var n = rects.length;
    var adj = [];
    var i;
    for (i = 0; i < n; i++) {
      adj[i] = [];
    }
    for (i = 0; i < n; i++) {
      var j;
      for (j = i + 1; j < n; j++) {
        if (colorDivisionRectsShareEdge(rects[i], rects[j])) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }
    return adj;
  }

  function maxColorDivisionComponentSize(activeIndices, adj) {
    if (!activeIndices.length) return 0;
    var inSet = {};
    var i;
    for (i = 0; i < activeIndices.length; i++) {
      inSet[activeIndices[i]] = true;
    }
    var visited = {};
    var maxSize = 0;
    for (i = 0; i < activeIndices.length; i++) {
      var start = activeIndices[i];
      if (visited[start]) continue;
      var stack = [start];
      var size = 0;
      visited[start] = true;
      while (stack.length) {
        var cur = stack.pop();
        size += 1;
        var neighbors = adj[cur];
        var n;
        for (n = 0; n < neighbors.length; n++) {
          var nb = neighbors[n];
          if (inSet[nb] && !visited[nb]) {
            visited[nb] = true;
            stack.push(nb);
          }
        }
      }
      if (size > maxSize) maxSize = size;
    }
    return maxSize;
  }

  function getColorDivisionMaxColoredSlots() {
    return Math.min(
      typeof COLOR_DIVISIONS_REGION_COUNT !== "undefined"
        ? COLOR_DIVISIONS_REGION_COUNT
        : 4,
      typeof COLOR_DIVISIONS_MAX !== "undefined" ? COLOR_DIVISIONS_MAX - 1 : 4
    );
  }

  function isValidColorDivisionRectOrder(order, adj, maxColored) {
    var prefix = [];
    var p;
    for (p = 1; p <= maxColored; p++) {
      prefix.push(order[p - 1]);
      if (maxColorDivisionComponentSize(prefix, adj) >= 3) {
        return false;
      }
    }
    return true;
  }

  function generateColorDivisionRectOrderGreedy(rects, adj, maxColored) {
    var n = rects.length;
    var remaining = [];
    var i;
    for (i = 0; i < n; i++) {
      remaining.push(i);
    }
    var order = [];
    var active = [];
    var slot;
    for (slot = 0; slot < n; slot++) {
      var candidates = [];
      var c;
      for (c = 0; c < remaining.length; c++) {
        var idx = remaining[c];
        if (slot < maxColored) {
          var trial = active.concat([idx]);
          if (maxColorDivisionComponentSize(trial, adj) >= 3) {
            continue;
          }
        }
        candidates.push(idx);
      }
      if (!candidates.length) {
        candidates = remaining.slice();
      }
      var pick = candidates[Math.floor(Math.random() * candidates.length)];
      order.push(pick);
      if (slot < maxColored) {
        active.push(pick);
      }
      var nextRemaining = [];
      for (c = 0; c < remaining.length; c++) {
        if (remaining[c] !== pick) nextRemaining.push(remaining[c]);
      }
      remaining = nextRemaining;
    }
    return order;
  }

  function generateValidColorDivisionRectOrder(rects) {
    var n = rects.length;
    var adj = buildColorDivisionAdjacency(rects);
    var maxColored = Math.min(getColorDivisionMaxColoredSlots(), n);
    var attempt;
    for (attempt = 0; attempt < 400; attempt++) {
      var order = [];
      var oi;
      for (oi = 0; oi < n; oi++) {
        order.push(oi);
      }
      for (oi = n - 1; oi > 0; oi--) {
        var oj = Math.floor(Math.random() * (oi + 1));
        var tmp = order[oi];
        order[oi] = order[oj];
        order[oj] = tmp;
      }
      if (isValidColorDivisionRectOrder(order, adj, maxColored)) {
        return order;
      }
    }
    return generateColorDivisionRectOrderGreedy(rects, adj, maxColored);
  }

  function reshuffleColorDivisionAreaOrder() {
    if (!cachedColorDivisionNormalizedRects) {
      ensureColorDivisionRects(false);
    }
    var absoluteRects = getAbsoluteColorDivisionRects();
    if (!absoluteRects) return;
    cachedColorDivisionRectOrder = generateValidColorDivisionRectOrder(
      absoluteRects
    );
    updateColorDivisionsLayer();
  }

  function reshuffleColorDivisionRects() {
    colorDivisionShuffleSeed += 1;
    lastColorDivisionLayoutSignature = "";
    cachedColorDivisionNormalizedRects = null;
    cachedColorDivisionRectOrder = null;
    ensureColorDivisionRects(true);
    updateColorDivisionsLayer();
  }

  function ensureColorDivisionRects(force) {
    var sig = buildColorDivisionLayoutSignature();
    if (
      !force &&
      sig === lastColorDivisionLayoutSignature &&
      cachedColorDivisionNormalizedRects &&
      cachedColorDivisionRectOrder
    ) {
      return;
    }
    lastColorDivisionLayoutSignature = sig;
    var bounds = getColorDivisionsCanvasBounds();
    var absoluteRects = generateColorDivisionRects(bounds);
    cachedColorDivisionNormalizedRects = absoluteColorDivisionRectsToNormalized(
      absoluteRects,
      bounds
    );
    cachedColorDivisionRectOrder = generateValidColorDivisionRectOrder(
      absoluteRects
    );
  }

  function getColorDivisionRectForAreaSlot(slot) {
    ensureColorDivisionRects(false);
    var absoluteRects = getAbsoluteColorDivisionRects();
    if (
      !absoluteRects ||
      !cachedColorDivisionRectOrder ||
      slot < 0 ||
      slot >= cachedColorDivisionRectOrder.length
    ) {
      return null;
    }
    return absoluteRects[cachedColorDivisionRectOrder[slot]];
  }

  function appendColorDivisionRectsToGroup(g, count) {
    ensureColorDivisionRects(false);
    if (
      !cachedColorDivisionNormalizedRects ||
      !cachedColorDivisionRectOrder ||
      count <= 0
    ) {
      return;
    }
    var regionCount =
      typeof COLOR_DIVISIONS_REGION_COUNT !== "undefined"
        ? COLOR_DIVISIONS_REGION_COUNT
        : 4;
    var n = Math.min(count, regionCount, cachedColorDivisionRectOrder.length);
    var i;
    for (i = 0; i < n; i++) {
      var r = getColorDivisionRectForAreaSlot(i);
      if (!r) continue;
      var rect = elSvg("rect");
      rect.setAttribute("x", String(r.x));
      rect.setAttribute("y", String(r.y));
      rect.setAttribute("width", String(r.width));
      rect.setAttribute("height", String(r.height));
      rect.setAttribute("fill", getColorDivisionsFillColor(i));
      rect.setAttribute("opacity", "1");
      rect.style.mixBlendMode = "exclusion";
      g.appendChild(rect);
    }
  }

  function createColorDivisionsLayer() {
    var layer = elSvg("g");
    layer.setAttribute("id", "layer-color-divisions");
    appendColorDivisionRectsToGroup(layer, getColorDivisionsColoredCount());
    return layer;
  }

  function updateColorDivisionsLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-color-divisions");
    if (!layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    appendColorDivisionRectsToGroup(layer, getColorDivisionsColoredCount());
  }

  function pushColorDivisionsExportLines(lines) {
    var count = getColorDivisionsColoredCount();
    if (count <= 0) return;
    ensureColorDivisionRects(false);
    if (!cachedColorDivisionNormalizedRects || !cachedColorDivisionRectOrder) return;
    var regionCount =
      typeof COLOR_DIVISIONS_REGION_COUNT !== "undefined"
        ? COLOR_DIVISIONS_REGION_COUNT
        : 4;
    var n = Math.min(count, regionCount, cachedColorDivisionRectOrder.length);
    lines.push('<g id="layer-color-divisions">');
    var i;
    for (i = 0; i < n; i++) {
      var r = getColorDivisionRectForAreaSlot(i);
      if (!r) continue;
      lines.push(
        '<rect x="' +
          r.x +
          '" y="' +
          r.y +
          '" width="' +
          r.width +
          '" height="' +
          r.height +
          '" fill="' +
          getColorDivisionsFillColor(i) +
          '" opacity="1" style="mix-blend-mode:exclusion"/>'
      );
    }
    lines.push("</g>");
  }

  function getVerticalGridStrokeWidthMin() {
    var mult =
      typeof ANXIETY_VERTICAL_STROKE_GRID_MULT_MIN !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_GRID_MULT_MIN
        : 2;
    return getGridStrokeWidth() * mult;
  }

  function getVerticalGridStrokeWidthMax() {
    return typeof ANXIETY_VERTICAL_STROKE_MAX_PX !== "undefined"
      ? ANXIETY_VERTICAL_STROKE_MAX_PX
      : 8;
  }

  function getVerticalGridStrokeWidth() {
    var minW = getVerticalGridStrokeWidthMin();
    var maxW = getVerticalGridStrokeWidthMax();
    if (maxW <= minW) return maxW;
    var t = getAnxietyVerticalStrokePercent() / 100;
    return minW + (maxW - minW) * t;
  }

  function syncAnxietyVerticalStrokeOutput() {
    var out = document.getElementById("anxiety-vertical-stroke-out");
    if (!out) return;
    var w = getVerticalGridStrokeWidth();
    out.textContent =
      (Math.abs(w - Math.round(w)) < 1e-6
        ? String(Math.round(w))
        : String(Math.round(w * 10) / 10)) + " px";
  }

  /** Geometry only — merge/erase state must not invalidate vertical lines. */
  function buildVerticalGridLayoutSignature() {
    if (isStarGrid()) {
      return (
        "star|" + lastOctagonsN + "|" + CANVAS_W + "|" + CANVAS_H + "|" + gridType
      );
    }
    return (
      lastOctagonsN +
      "|" +
      getInnerScale() +
      "|" +
      CANVAS_W +
      "|" +
      CANVAS_H
    );
  }

  /**
   * @returns {number[]}
   */
  function collectStarGridVerticalAnchorXCoords() {
    if (
      typeof NestedStarOctagonsGeometry === "undefined" ||
      !NestedStarOctagonsGeometry.collectStarGridVerticalAnchorXCoords
    ) {
      return [];
    }
    return NestedStarOctagonsGeometry.collectStarGridVerticalAnchorXCoords(
      getStarLayout()
    );
  }

  function pickVerticalShortenMode() {
    var r = Math.random();
    if (r < 0.2) return "full";
    if (r < 0.45) return "top";
    if (r < 0.7) return "bottom";
    return "both";
  }

  function randomVerticalTrimAmount() {
    return CANVAS_H * (0.05 + Math.random() * 0.35);
  }

  /**
   * Stores max random trims; Anger slider scales how much trim is applied at draw time.
   * @param {number} x
   * @param {number} yTop
   * @param {number} yBottom
   * @returns {{ x: number, yTop: number, yBottom: number, topTrim: number, bottomTrim: number } | null}
   */
  function buildRandomizedVerticalLine(x, yTop, yBottom) {
    var mode = pickVerticalShortenMode();
    var topTrim = 0;
    var bottomTrim = 0;

    if (mode === "top" || mode === "both") {
      topTrim = randomVerticalTrimAmount();
    }
    if (mode === "bottom" || mode === "both") {
      bottomTrim = randomVerticalTrimAmount();
    }

    if (yBottom - yTop - topTrim - bottomTrim <= 0) return null;

    return {
      x: x,
      yTop: yTop,
      yBottom: yBottom,
      topTrim: topTrim,
      bottomTrim: bottomTrim,
    };
  }

  /**
   * @param {{ x: number, yTop: number, yBottom: number, topTrim: number, bottomTrim: number }} vl
   * @returns {{ x: number, y1: number, y2: number } | null}
   */
  function resolveVerticalLineDrawCoords(vl) {
    var t = getAngerVerticalLengthPercent() / 100;
    var yTop = vl.yTop;
    var yBottom = vl.yBottom;
    var y1OldMin = yTop + vl.topTrim;
    var y2OldMin = yBottom - vl.bottomTrim;
    var oldMinSpan = y2OldMin - y1OldMin;
    if (oldMinSpan <= 0) return null;

    var fullSpan = yBottom - yTop;
    var minRatio =
      typeof ANGER_VERTICAL_LENGTH_MIN_SPAN_RATIO !== "undefined"
        ? ANGER_VERTICAL_LENGTH_MIN_SPAN_RATIO
        : 0.5;
    var halfOld = oldMinSpan / 2;
    var halfAtZero = halfOld * minRatio;
    var halfFull = fullSpan / 2;
    var halfTarget = halfAtZero + (halfFull - halfAtZero) * t;
    var centerLow = (y1OldMin + y2OldMin) / 2;
    var centerHigh = (yTop + yBottom) / 2;
    var center = centerLow + (centerHigh - centerLow) * t;
    var y1 = center - halfTarget;
    var y2 = center + halfTarget;

    y1 = Math.max(yTop, Math.min(y1, yBottom));
    y2 = Math.max(yTop, Math.min(y2, yBottom));
    if (y2 <= y1) return null;

    return { x: vl.x, y1: y1, y2: y2 };
  }

  /**
   * Full width of the grid content area (inner frame), inclusive.
   * @param {number} x
   * @param {{ x: number, width: number }} bounds
   * @returns {boolean}
   */
  function isVerticalLineXInGridBounds(x, bounds) {
    var left = bounds.x;
    var right = bounds.x + bounds.width;
    return x >= left && x <= right;
  }

  /** Half octagon side: ((√2 - 1) × tileSize) / 2 — follows octagons-per-row slider. */
  function getVerticalLineMinDistance() {
    return ((Math.SQRT2 - 1) * lastTileSize) / 2;
  }

  /**
   * @param {number} x
   * @param {number} otherX
   * @param {number} minDist
   * @returns {boolean}
   */
  function isVerticalLineTooClose(x, otherX, minDist) {
    return Math.abs(x - otherX) < minDist;
  }

  /**
   * @param {boolean} force
   */
  function syncVerticalGridLines(force) {
    var sig = buildVerticalGridLayoutSignature();
    if (!force && sig === lastVerticalGridLayoutSignature) return;
    lastVerticalGridLayoutSignature = sig;

    var xs = isStarGrid()
      ? collectStarGridVerticalAnchorXCoords()
      : TopkapiGeometry.collectUniqueGridXCoords(cachedAllSegments);
    var bounds = getGridContentBounds();
    // "Fear" verticals are currently driven by the Anger layer logic.
    // Restrict verticals to the left third of the grid content area.
    var xBounds = { x: bounds.x, width: bounds.width / 3 };
    var yTop = bounds.y;
    var yBottom = bounds.y + bounds.height;
    var minDist = getVerticalLineMinDistance();
    var lines = [];
    var lastPlacedX = null;
    var i;
    var line;

    for (i = 0; i < xs.length; i++) {
      if (!isVerticalLineXInGridBounds(xs[i], xBounds)) continue;
      if (
        lastPlacedX !== null &&
        isVerticalLineTooClose(xs[i], lastPlacedX, minDist)
      ) {
        continue;
      }
      line = buildRandomizedVerticalLine(xs[i], yTop, yBottom);
      if (line) {
        lines.push(line);
        lastPlacedX = xs[i];
      }
    }

    cachedVerticalGridLines = lines;
  }

  function getActiveVerticalGridLayer() {
    if (!designSvg) return null;
    var layerId = isStarGrid()
      ? "layer-vertical-grid-overlay"
      : "layer-vertical-grid";
    return designSvg.querySelector("#" + layerId);
  }

  function clearInactiveVerticalGridLayer() {
    if (!designSvg) return;
    var inactiveId = isStarGrid()
      ? "layer-vertical-grid"
      : "layer-vertical-grid-overlay";
    var inactive = designSvg.querySelector("#" + inactiveId);
    if (!inactive) return;
    while (inactive.firstChild) inactive.removeChild(inactive.firstChild);
  }

  /**
   * @param {SVGElement} layer
   */
  function appendVerticalGridLinesToLayer(layer) {
    layer.setAttribute("fill", "none");
    layer.setAttribute("stroke", sheetColor("F1"));
    layer.setAttribute("stroke-width", String(getVerticalGridStrokeWidth()));
    for (var i = 0; i < cachedVerticalGridLines.length; i++) {
      var draw = resolveVerticalLineDrawCoords(cachedVerticalGridLines[i]);
      if (!draw) continue;
      var line = elSvg("line");
      line.setAttribute("x1", String(draw.x));
      line.setAttribute("y1", String(draw.y1));
      line.setAttribute("x2", String(draw.x));
      line.setAttribute("y2", String(draw.y2));
      layer.appendChild(line);
    }
  }

  function renderVerticalGridLayer() {
    if (!designSvg) return;
    clearInactiveVerticalGridLayer();
    var layer = getActiveVerticalGridLayer();
    if (!layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (!isEmotionCanvasVisible("anger")) return;
    appendVerticalGridLinesToLayer(layer);
  }

  /**
   * @param {string[]} lines
   */
  function pushVerticalGridExportLines(lines) {
    if (!isEmotionCanvasVisible("anger") || !cachedVerticalGridLines.length) {
      return;
    }
    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push(
      '<g id="' +
        (isStarGrid() ? "layer-vertical-grid-overlay" : "layer-vertical-grid") +
        '" fill="none" stroke="' +
        sheetColor("F1") +
        '" stroke-width="' +
        getVerticalGridStrokeWidth() +
        '">'
    );
    for (var i = 0; i < cachedVerticalGridLines.length; i++) {
      var draw = resolveVerticalLineDrawCoords(cachedVerticalGridLines[i]);
      if (!draw) continue;
      lines.push(
        '<line x1="' +
          draw.x +
          '" y1="' +
          draw.y1 +
          '" x2="' +
          draw.x +
          '" y2="' +
          draw.y2 +
          '"/>'
      );
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  function renderPatternAndVerticalLayers() {
    syncVerticalGridLines(false);
    renderVerticalGridLayer();
    if (isStarGrid()) {
      renderBackgroundLayer();
    }
    renderPatternLayer();
    renderGridMaskLayer("renderPatternAndVerticalLayers");
    renderAutoMergeFillsLayer();
    applyMergeReveal();
    renderStippleDotsLayer();
  }

  function applyGridBoundaryAttrs(rect, bounds) {
    rect.setAttribute("x", String(bounds.x));
    rect.setAttribute("y", String(bounds.y));
    rect.setAttribute("width", String(bounds.width));
    rect.setAttribute("height", String(bounds.height));
  }

  function applyGridBoundaryStyle(rect) {
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", getGridBoundaryStrokeColor());
    rect.setAttribute("stroke-width", String(GRID_BOUNDARY_STROKE_WIDTH));
    rect.setAttribute("vector-effect", "non-scaling-stroke");
  }

  function createGridBoundaryRect() {
    var rect = elSvg("rect");
    rect.setAttribute("id", "grid-boundary");
    applyGridBoundaryAttrs(rect, getGridBoundaryDisplayBounds());
    applyGridBoundaryStyle(rect);
    return rect;
  }

  function updateGridBoundaryRect() {
    if (!designSvg) return;
    var rect = designSvg.querySelector("#grid-boundary");
    if (!rect) return;
    applyGridBoundaryAttrs(rect, getGridBoundaryDisplayBounds());
    applyGridBoundaryStyle(rect);
  }

  function pushGridBoundaryExportLine(lines, bounds) {
    lines.push(
      '<rect x="' +
        bounds.x +
        '" y="' +
        bounds.y +
        '" width="' +
        bounds.width +
        '" height="' +
        bounds.height +
        '" fill="none" stroke="' +
        getGridBoundaryStrokeColor() +
        '" stroke-width="' +
        GRID_BOUNDARY_STROKE_WIDTH +
        '" vector-effect="non-scaling-stroke"/>'
    );
  }

  /**
   * @returns {{
   *   left: number,
   *   right: number,
   *   centerX: number,
   *   verticalTop: number,
   *   verticalBottom: number,
   *   horizontalTop: number,
   *   horizontalBottom: number,
   *   centerVerticalBottom: number
   * }}
   */
  function getGridFrameInsetOverlayLayout() {
    var bounds = getGridContentBounds();
    var left = bounds.x + GRID_FRAME_INSET_OVERLAY_HORIZONTAL_PX;
    var right = bounds.x + bounds.width - GRID_FRAME_INSET_OVERLAY_HORIZONTAL_PX;
    var verticalTop = bounds.y + GRID_FRAME_INSET_OVERLAY_VERTICAL_PX;
    var verticalBottom =
      bounds.y + bounds.height - GRID_FRAME_INSET_OVERLAY_VERTICAL_PX;
    var centerX = (left + right) / 2;
    var verticalSpan = verticalBottom - verticalTop;
    return {
      left: left,
      right: right,
      centerX: centerX,
      verticalTop: verticalTop,
      verticalBottom: verticalBottom,
      horizontalTop:
        verticalTop + GRID_FRAME_INSET_OVERLAY_TOP_SHIFT_DOWN_PX,
      horizontalBottom:
        verticalBottom - GRID_FRAME_INSET_OVERLAY_BOTTOM_SHIFT_UP_PX,
      centerVerticalBottom: verticalTop + verticalSpan / 3,
    };
  }

  /**
   * Diagonals from top cap ellipses (extreme verticals) to center vertical × bottom horizontal.
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function getGridFrameInsetOverlayDiagonalSegments() {
    var L = getGridFrameInsetOverlayLayout();
    var ellipses = getGridFrameInsetOverlayCapEllipses();
    var midY = (L.verticalTop + L.verticalBottom) / 2;
    var targetX = L.centerX;
    var targetY = L.horizontalBottom;
    var segments = [];
    var i;
    for (i = 0; i < ellipses.length; i++) {
      var ell = ellipses[i];
      if (ell.cy >= midY) continue;
      segments.push({
        x1: ell.cx,
        y1: ell.cy,
        x2: targetX,
        y2: targetY,
      });
    }
    return segments;
  }

  /**
   * Inset frame overlay: side verticals, center vertical (⅓ height), horizontals, diagonals.
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function getGridFrameInsetOverlaySegments() {
    var L = getGridFrameInsetOverlayLayout();
    var segments = [
      { x1: L.left, y1: L.verticalTop, x2: L.left, y2: L.verticalBottom },
      { x1: L.right, y1: L.verticalTop, x2: L.right, y2: L.verticalBottom },
      {
        x1: L.centerX,
        y1: L.verticalTop,
        x2: L.centerX,
        y2: L.centerVerticalBottom,
      },
      { x1: L.left, y1: L.horizontalTop, x2: L.right, y2: L.horizontalTop },
      {
        x1: L.left,
        y1: L.horizontalBottom,
        x2: L.right,
        y2: L.horizontalBottom,
      },
    ];
    var diagonals = getGridFrameInsetOverlayDiagonalSegments();
    for (var d = 0; d < diagonals.length; d++) {
      segments.push(diagonals[d]);
    }
    return segments;
  }

  /**
   * Cap rectangles on vertical tops (all three) and bottoms (left/right only).
   * @returns {{ x: number, y: number, width: number, height: number }[]}
   */
  function getGridFrameInsetOverlayCapRects() {
    var L = getGridFrameInsetOverlayLayout();
    var w = GRID_FRAME_INSET_OVERLAY_CAP_RECT_WIDTH;
    var h = GRID_FRAME_INSET_OVERLAY_CAP_RECT_LENGTH;
    var halfW = w / 2;
    var rects = [];
    var topXs = [L.left, L.centerX, L.right];
    var i;
    for (i = 0; i < topXs.length; i++) {
      rects.push({
        x: topXs[i] - halfW,
        y: L.verticalTop - h,
        width: w,
        height: h,
      });
    }
    rects.push({
      x: L.left - halfW,
      y: L.verticalBottom,
      width: w,
      height: h,
    });
    rects.push({
      x: L.right - halfW,
      y: L.verticalBottom,
      width: w,
      height: h,
    });
    return rects;
  }

  /**
   * Vertical ellipses on left/right cap rects; gap measured from inner rect edge
   * (canvas-facing) to nearest ellipse edge, then ellipse center offset by ry.
   * @returns {{ cx: number, cy: number, rx: number, ry: number }[]}
   */
  function getGridFrameInsetOverlayCapEllipses() {
    var L = getGridFrameInsetOverlayLayout();
    var rects = getGridFrameInsetOverlayCapRects();
    var gap = GRID_FRAME_INSET_OVERLAY_CAP_ELLIPSE_INSET_PX;
    var rx = GRID_FRAME_INSET_OVERLAY_CAP_ELLIPSE_RX;
    var ry = GRID_FRAME_INSET_OVERLAY_CAP_ELLIPSE_RY;
    var ellipses = [];
    var i;
    for (i = 0; i < rects.length; i++) {
      var rect = rects[i];
      var cx = rect.x + rect.width / 2;
      if (Math.abs(cx - L.centerX) < 1e-6) continue;
      var isTopCap = rect.y + rect.height <= L.verticalTop + 1e-6;
      var innerEdgeY = isTopCap ? rect.y + rect.height : rect.y;
      var cy = isTopCap ? innerEdgeY + gap + ry : innerEdgeY - gap - ry;
      ellipses.push({ cx: cx, cy: cy, rx: rx, ry: ry });
    }
    return ellipses;
  }

  function frameInsetOverlayToGroup() {
    var g = elSvg("g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getPatternStrokeColor());
    g.setAttribute("stroke-width", String(GRID_FRAME_INSET_OVERLAY_STROKE_WIDTH));
    g.setAttribute("stroke-linecap", "square");
    g.setAttribute("stroke-linejoin", "miter");

    var segments = getGridFrameInsetOverlaySegments();
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var line = elSvg("line");
      line.setAttribute("x1", String(s.x1));
      line.setAttribute("y1", String(s.y1));
      line.setAttribute("x2", String(s.x2));
      line.setAttribute("y2", String(s.y2));
      g.appendChild(line);
    }

    var capFill = getPatternStrokeColor();
    var rects = getGridFrameInsetOverlayCapRects();
    for (var r = 0; r < rects.length; r++) {
      var rect = rects[r];
      var el = elSvg("rect");
      el.setAttribute("x", String(rect.x));
      el.setAttribute("y", String(rect.y));
      el.setAttribute("width", String(rect.width));
      el.setAttribute("height", String(rect.height));
      el.setAttribute("fill", capFill);
      g.appendChild(el);
    }

    var ellipses = getGridFrameInsetOverlayCapEllipses();
    for (var e = 0; e < ellipses.length; e++) {
      var ell = ellipses[e];
      var ellipseEl = elSvg("ellipse");
      ellipseEl.setAttribute("cx", String(ell.cx));
      ellipseEl.setAttribute("cy", String(ell.cy));
      ellipseEl.setAttribute("rx", String(ell.rx));
      ellipseEl.setAttribute("ry", String(ell.ry));
      ellipseEl.setAttribute("fill", capFill);
      g.appendChild(ellipseEl);
    }
    return g;
  }

  function applyFrameInsetOverlayVisibility() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-frame-inset-overlay");
    if (!layer) return;
    layer.style.display = frameInsetOverlayVisible ? "" : "none";
  }

  function syncFrameOverlayToggleButton() {
    var btn = document.getElementById("frame-overlay-toggle-btn");
    if (!btn) return;
    var visible = frameInsetOverlayVisible;
    btn.classList.toggle("is-active", visible);
    btn.setAttribute("aria-pressed", String(visible));
    btn.textContent = visible ? "Hide frame overlay" : "Show frame overlay";
  }

  function toggleFrameInsetOverlay() {
    frameInsetOverlayVisible = !frameInsetOverlayVisible;
    applyFrameInsetOverlayVisibility();
    syncFrameOverlayToggleButton();
  }

  function createFrameInsetOverlayLayer() {
    var layer = elSvg("g");
    layer.setAttribute("id", "layer-frame-inset-overlay");
    layer.setAttribute("transform", getInnerContentTransformAttr());
    layer.appendChild(frameInsetOverlayToGroup());
    applyFrameInsetOverlayVisibility();
    return layer;
  }

  function updateFrameInsetOverlayLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-frame-inset-overlay");
    if (!layer) return;
    layer.setAttribute("transform", getInnerContentTransformAttr());
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    layer.appendChild(frameInsetOverlayToGroup());
    applyFrameInsetOverlayVisibility();
  }

  function pushFrameInsetOverlayExportLines(lines) {
    var segments = getGridFrameInsetOverlaySegments();
    var rects = getGridFrameInsetOverlayCapRects();
    var ellipses = getGridFrameInsetOverlayCapEllipses();
    var stroke = getPatternStrokeColor();
    lines.push(
      '<g id="layer-frame-inset-overlay" transform="' +
        getInnerContentTransformAttr() +
        '">'
    );
    lines.push(
      '<g fill="none" stroke="' +
        stroke +
        '" stroke-width="' +
        GRID_FRAME_INSET_OVERLAY_STROKE_WIDTH +
        '" stroke-linecap="square" stroke-linejoin="miter">'
    );
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      lines.push(
        '<line x1="' +
          s.x1 +
          '" y1="' +
          s.y1 +
          '" x2="' +
          s.x2 +
          '" y2="' +
          s.y2 +
          '"/>'
      );
    }
    for (var r = 0; r < rects.length; r++) {
      var rect = rects[r];
      lines.push(
        '<rect x="' +
          rect.x +
          '" y="' +
          rect.y +
          '" width="' +
          rect.width +
          '" height="' +
          rect.height +
          '" fill="' +
          stroke +
          '"/>'
      );
    }
    for (var e = 0; e < ellipses.length; e++) {
      var ell = ellipses[e];
      lines.push(
        '<ellipse cx="' +
          ell.cx +
          '" cy="' +
          ell.cy +
          '" rx="' +
          ell.rx +
          '" ry="' +
          ell.ry +
          '" fill="' +
          stroke +
          '"/>'
      );
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  var BORDER_DIVISION_STROKE_WIDTH = 1;

  var BORDER_DIVISION_STROKE_WIDTH = 1;
  var BORDER_SIDE_WHITE_INNER_SHADOW_FILTER_ID =
    "border-side-white-inner-shadow-blur";
  var BORDER_SIDE_WHITE_INNER_SHADOW_LEFT_GRAD_ID =
    "border-side-white-inner-shadow-left";
  var BORDER_SIDE_WHITE_INNER_SHADOW_TOP_GRAD_ID =
    "border-side-white-inner-shadow-top";

  function getBorderSideWhiteInnerShadowDepth(cellW, cellH) {
    var maxPx =
      typeof BORDER_SIDE_WHITE_INNER_SHADOW_DEPTH_MAX_PX !== "undefined"
        ? BORDER_SIDE_WHITE_INNER_SHADOW_DEPTH_MAX_PX
        : 16;
    var ratio =
      typeof BORDER_SIDE_WHITE_INNER_SHADOW_DEPTH_RATIO !== "undefined"
        ? BORDER_SIDE_WHITE_INNER_SHADOW_DEPTH_RATIO
        : 0.34;
    return Math.max(3, Math.min(maxPx, Math.round(Math.min(cellW, cellH) * ratio)));
  }

  function getBorderSideWhiteInnerShadowBlur() {
    return typeof BORDER_SIDE_WHITE_INNER_SHADOW_BLUR !== "undefined"
      ? BORDER_SIDE_WHITE_INNER_SHADOW_BLUR
      : 2.8;
  }

  function getBorderSideWhiteInnerShadowOpacity() {
    return typeof BORDER_SIDE_WHITE_INNER_SHADOW_OPACITY !== "undefined"
      ? BORDER_SIDE_WHITE_INNER_SHADOW_OPACITY
      : 0.24;
  }

  /**
   * @param {SVGElement} defs
   */
  function ensureBorderSideWhiteInnerShadowDefs(defs) {
    if (!defs || getBorderSideWhiteFillTargetPercent() <= 0) return;

    var ids = [
      BORDER_SIDE_WHITE_INNER_SHADOW_FILTER_ID,
      BORDER_SIDE_WHITE_INNER_SHADOW_LEFT_GRAD_ID,
      BORDER_SIDE_WHITE_INNER_SHADOW_TOP_GRAD_ID,
    ];
    var i;
    for (i = 0; i < ids.length; i++) {
      var existing = defs.querySelector("#" + ids[i]);
      if (existing) defs.removeChild(existing);
    }

    var blur = getBorderSideWhiteInnerShadowBlur();
    var filter = elSvg("filter");
    filter.setAttribute("id", BORDER_SIDE_WHITE_INNER_SHADOW_FILTER_ID);
    filter.setAttribute("x", "-40%");
    filter.setAttribute("y", "-40%");
    filter.setAttribute("width", "180%");
    filter.setAttribute("height", "180%");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    var gauss = elSvg("feGaussianBlur");
    gauss.setAttribute("in", "SourceGraphic");
    gauss.setAttribute("stdDeviation", String(blur));
    filter.appendChild(gauss);
    defs.appendChild(filter);

    var shadowColor = getPatternStrokeColor();
    var opacity = String(getBorderSideWhiteInnerShadowOpacity());

    function appendShadowGradient(id, x1, y1, x2, y2) {
      var grad = elSvg("linearGradient");
      grad.setAttribute("id", id);
      grad.setAttribute("gradientUnits", "objectBoundingBox");
      grad.setAttribute("x1", x1);
      grad.setAttribute("y1", y1);
      grad.setAttribute("x2", x2);
      grad.setAttribute("y2", y2);
      var stop0 = elSvg("stop");
      stop0.setAttribute("offset", "0%");
      stop0.setAttribute("stop-color", shadowColor);
      stop0.setAttribute("stop-opacity", opacity);
      var stop1 = elSvg("stop");
      stop1.setAttribute("offset", "100%");
      stop1.setAttribute("stop-color", shadowColor);
      stop1.setAttribute("stop-opacity", "0");
      grad.appendChild(stop0);
      grad.appendChild(stop1);
      defs.appendChild(grad);
    }

    appendShadowGradient(
      BORDER_SIDE_WHITE_INNER_SHADOW_LEFT_GRAD_ID,
      "0",
      "0",
      "1",
      "0"
    );
    appendShadowGradient(
      BORDER_SIDE_WHITE_INNER_SHADOW_TOP_GRAD_ID,
      "0",
      "0",
      "0",
      "1"
    );
  }

  /**
   * @param {string[]} lines
   */
  function pushBorderSideWhiteInnerShadowDefLines(lines) {
    if (getBorderSideWhiteFillTargetPercent() <= 0) return;

    var blur = getBorderSideWhiteInnerShadowBlur();
    var shadowColor = getPatternStrokeColor();
    var opacity = String(getBorderSideWhiteInnerShadowOpacity());

    lines.push(
      '<filter id="' +
        BORDER_SIDE_WHITE_INNER_SHADOW_FILTER_ID +
        '" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="' +
        blur +
        '"/>' +
        "</filter>"
    );
    lines.push(
      '<linearGradient id="' +
        BORDER_SIDE_WHITE_INNER_SHADOW_LEFT_GRAD_ID +
        '" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="' +
        shadowColor +
        '" stop-opacity="' +
        opacity +
        '"/>' +
        '<stop offset="100%" stop-color="' +
        shadowColor +
        '" stop-opacity="0"/>' +
        "</linearGradient>"
    );
    lines.push(
      '<linearGradient id="' +
        BORDER_SIDE_WHITE_INNER_SHADOW_TOP_GRAD_ID +
        '" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' +
        shadowColor +
        '" stop-opacity="' +
        opacity +
        '"/>' +
        '<stop offset="100%" stop-color="' +
        shadowColor +
        '" stop-opacity="0"/>' +
        "</linearGradient>"
    );
  }

  /**
   * Soft inset shadow along the top + left inner edges of one whitened cell.
   * @param {SVGElement} g
   * @param {number} x
   * @param {number} b
   * @param {number} yTop
   * @param {number} yBottom
   */
  function appendBorderSideWhitenedCellInnerShadowAtX(g, x, b, yTop, yBottom) {
    if (getBorderSideWhiteFillTargetPercent() <= 0) return;

    var h = yBottom - yTop;
    var depth = getBorderSideWhiteInnerShadowDepth(b, h);
    var filterUrl = "url(#" + BORDER_SIDE_WHITE_INNER_SHADOW_FILTER_ID + ")";

    var left = elSvg("rect");
    left.setAttribute("x", String(x));
    left.setAttribute("y", String(yTop));
    left.setAttribute("width", String(depth));
    left.setAttribute("height", String(h));
    left.setAttribute(
      "fill",
      "url(#" + BORDER_SIDE_WHITE_INNER_SHADOW_LEFT_GRAD_ID + ")"
    );
    left.setAttribute("filter", filterUrl);
    left.setAttribute("stroke", "none");
    left.setAttribute("pointer-events", "none");
    g.appendChild(left);

    var top = elSvg("rect");
    top.setAttribute("x", String(x));
    top.setAttribute("y", String(yTop));
    top.setAttribute("width", String(b));
    top.setAttribute("height", String(depth));
    top.setAttribute(
      "fill",
      "url(#" + BORDER_SIDE_WHITE_INNER_SHADOW_TOP_GRAD_ID + ")"
    );
    top.setAttribute("filter", filterUrl);
    top.setAttribute("stroke", "none");
    top.setAttribute("pointer-events", "none");
    g.appendChild(top);
  }

  /**
   * @param {string[]} lines
   * @param {number} x
   * @param {number} b
   * @param {number} yTop
   * @param {number} yBottom
   */
  function pushBorderSideWhitenedCellInnerShadowAtXExport(
    lines,
    x,
    b,
    yTop,
    yBottom
  ) {
    if (getBorderSideWhiteFillTargetPercent() <= 0) return;

    var h = yBottom - yTop;
    var depth = getBorderSideWhiteInnerShadowDepth(b, h);
    var filterUrl = "url(#" + BORDER_SIDE_WHITE_INNER_SHADOW_FILTER_ID + ")";
    var leftGrad = "url(#" + BORDER_SIDE_WHITE_INNER_SHADOW_LEFT_GRAD_ID + ")";
    var topGrad = "url(#" + BORDER_SIDE_WHITE_INNER_SHADOW_TOP_GRAD_ID + ")";

    lines.push(
      '<rect x="' +
        x +
        '" y="' +
        yTop +
        '" width="' +
        depth +
        '" height="' +
        h +
        '" fill="' +
        leftGrad +
        '" filter="' +
        filterUrl +
        '" stroke="none"/>'
    );
    lines.push(
      '<rect x="' +
        x +
        '" y="' +
        yTop +
        '" width="' +
        b +
        '" height="' +
        depth +
        '" fill="' +
        topGrad +
        '" filter="' +
        filterUrl +
        '" stroke="none"/>'
    );
  }

  function isBodyAutonomyHomeChecked() {
    return true;
  }

  function isBodyAutonomyOutsideChecked() {
    return true;
  }

  /**
   * ViewBox Y of the grid-boundary stroke (outer edge) on top and bottom.
   * @returns {{ top: number, bottom: number }}
   */
  function getBorderDivisionFrameY() {
    var bounds = getGridContentBounds();
    var off = getInnerContentOffset();
    var s = getInnerContentScale();
    var halfStroke = GRID_BOUNDARY_STROKE_WIDTH / 2;
    return {
      top: off.y + (bounds.y - halfStroke) * s,
      bottom: off.y + (bounds.y + bounds.height + halfStroke) * s,
    };
  }

  /**
   * 1px dividers in the white margin strips only (corners stay blank).
   * Top/bottom vertical ticks extend to the grid-boundary separating line.
   * @param {SVGElement} container
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  function appendBorderDivisionLine(container, x1, y1, x2, y2) {
    var line = elSvg("line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", getBorderDivisionStrokeColor());
    line.setAttribute("stroke-width", String(BORDER_DIVISION_STROKE_WIDTH));
    line.setAttribute("shape-rendering", "crispEdges");
    container.appendChild(line);
  }

  /**
   * Top/bottom Y for left/right horizontal divisions (inset inside grid border).
   * @returns {{ top: number, bottom: number }}
   */
  function getLeftRightBorderDivisionYBounds() {
    var frameY = getBorderDivisionFrameY();
    var inset = BORDER_SIDE_DIVISION_INSET_PX;
    return {
      top: frameY.top + inset,
      bottom: frameY.bottom - inset,
    };
  }

  function regenerateBorderSideSegmentRatios() {
    var segments = getBorderLeftRightSegments();
    var min =
      typeof BORDER_SIDE_SEGMENT_HEIGHT_MIN_RATIO !== "undefined"
        ? BORDER_SIDE_SEGMENT_HEIGHT_MIN_RATIO
        : 0.05;
    var max =
      typeof BORDER_SIDE_SEGMENT_HEIGHT_MAX_RATIO !== "undefined"
        ? BORDER_SIDE_SEGMENT_HEIGHT_MAX_RATIO
        : 1.4;
    var power =
      typeof BORDER_SIDE_SEGMENT_HEIGHT_RANDOM_POWER !== "undefined"
        ? BORDER_SIDE_SEGMENT_HEIGHT_RANDOM_POWER
        : 2.2;
    var ratios = [];
    var i;
    var t;
    var w;
    for (i = 0; i < segments; i++) {
      if (power <= 1) {
        ratios.push(min + Math.random() * (max - min));
      } else {
        t = Math.random();
        if (Math.random() < 0.5) {
          w = Math.pow(t, power);
        } else {
          w = 1 - Math.pow(1 - t, power);
        }
        ratios.push(min + w * (max - min));
      }
    }
    cachedBorderSideSegmentRatios = ratios;
  }

  function ensureBorderSideSegmentRatios() {
    var segments = getBorderLeftRightSegments();
    if (
      !cachedBorderSideSegmentRatios ||
      cachedBorderSideSegmentRatios.length !== segments
    ) {
      regenerateBorderSideSegmentRatios();
    }
  }

  /**
   * Interior horizontal divider Y in left/right strips (variable row heights).
   * @returns {number[]}
   */
  function getLeftRightBorderInteriorYPositions() {
    var divY = getLeftRightBorderDivisionYBounds();
    var segments = getBorderLeftRightSegments();
    var span = divY.bottom - divY.top;
    var ys = [];
    var y;
    var heights;
    var i;

    ensureBorderSideSegmentRatios();
    heights = distributeLengthsByRatios(span, cachedBorderSideSegmentRatios);
    y = divY.top;
    for (i = 0; i < segments - 1; i++) {
      y += heights[i];
      ys.push(y);
    }
    return ys;
  }

  /**
   * Cell boundaries in left/right strips: inset top/bottom, then interior dividers.
   * Diagonal cells lie only between consecutive entries.
   * @returns {number[]}
   */
  function getLeftRightBorderCellYBounds() {
    var divY = getLeftRightBorderDivisionYBounds();
    var interior = getLeftRightBorderInteriorYPositions();
    var bounds = [divY.top];
    var i;
    for (i = 0; i < interior.length; i++) bounds.push(interior[i]);
    bounds.push(divY.bottom);
    return bounds;
  }

  /**
   * Repeating strip cell roles (top → bottom): home, grey, outside, beige, …
   * @param {number} cellIndex 0-based row in left/right strip (0 = top)
   * @returns {"home"|"grey"|"outside"|"beige"}
   */
  function getBorderSideCellType(cellIndex) {
    var phase = cellIndex % 4;
    if (phase === 0) return "home";
    if (phase === 1) return "grey";
    if (phase === 2) return "outside";
    return "beige";
  }

  /**
   * Solid fill only (no colored X triangles) — grey / beige when Family + Friends on.
   * @param {"home"|"grey"|"outside"|"beige"} cellType
   * @param {boolean} home
   * @param {boolean} outside
   * @returns {boolean}
   */
  function isBorderSideSolidColorOnlyCell(cellType, home, outside) {
    if (!home || !outside) return false;
    return cellType === "grey" || cellType === "beige";
  }

  /**
   * Rhombus inscribed in a margin cell: top/bottom vertices on cell edges.
   * @param {number} cellX
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   * @returns {number[][]}
   */
  function getBorderSideCellRhombusPoints(cellX, cellW, yTop, yBottom) {
    var cx = cellX + cellW / 2;
    var cy = (yTop + yBottom) / 2;
    return [
      [cx, yTop],
      [cellX + cellW, cy],
      [cx, yBottom],
      [cellX, cy],
    ];
  }

  /**
   * Complementary rhombus fill: grey cell → yellow/beige, beige cell → grey.
   * @param {"grey"|"beige"} cellType
   * @returns {string}
   */
  function getBorderSideRhombusFillForCellType(cellType) {
    return sheetColor("C9");
  }

  /**
   * @param {SVGElement} g
   * @param {number} cellX
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   * @param {string} fill
   */
  function appendBorderSideCellRhombus(g, cellX, cellW, yTop, yBottom, fill) {
    appendSvgPolygonFill(
      g,
      getBorderSideCellRhombusPoints(cellX, cellW, yTop, yBottom),
      fill
    );
  }

  /**
   * @param {SVGElement} g
   * @param {number} cellX
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   */
  function appendBorderSideCellRhombusOutline(g, cellX, cellW, yTop, yBottom) {
    var points = getBorderSideCellRhombusPoints(cellX, cellW, yTop, yBottom);
    var poly = elSvg("polygon");
    var i;
    var parts = [];
    for (i = 0; i < points.length; i++) {
      parts.push(String(points[i][0]) + "," + String(points[i][1]));
    }
    poly.setAttribute("points", parts.join(" "));
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", getPatternStrokeColor());
    poly.setAttribute("stroke-width", String(BORDER_DIVISION_STROKE_WIDTH));
    g.appendChild(poly);
  }

  /**
   * Full cell frame (top, bottom, left, right) on top of white fill.
   * @param {SVGElement} g
   * @param {number} x
   * @param {number} b
   * @param {number} yTop
   * @param {number} yBottom
   */
  function appendBorderSideWhitenedCellFrameLinesAtX(g, x, b, yTop, yBottom) {
    appendBorderDivisionLine(g, x, yTop, x + b, yTop);
    appendBorderDivisionLine(g, x, yBottom, x + b, yBottom);
    appendBorderDivisionLine(g, x, yTop, x, yBottom);
    appendBorderDivisionLine(g, x + b, yTop, x + b, yBottom);
  }

  /**
   * Vertical dividers between adjacent margin columns (full strip height).
   * @param {SVGElement} g
   */
  function appendLeftRightBorderColumnDividers(g) {
    var b = getCanvasBorderPx();
    var cols = getBorderSideThicknessColumns();
    if (cols <= 1) return;

    var divY = getLeftRightBorderDivisionYBounds();
    var c;
    for (c = 1; c < cols; c++) {
      var xLeft = c * b;
      appendBorderDivisionLine(g, xLeft, divY.top, xLeft, divY.bottom);
      var xRight = CANVAS_W - c * b;
      appendBorderDivisionLine(g, xRight, divY.top, xRight, divY.bottom);
    }
  }

  /**
   * X / rhombus outlines on a whitened margin cell (one column).
   * @param {SVGElement} g
   * @param {number} x
   * @param {number} b
   * @param {number} yTop
   * @param {number} yBottom
   * @param {"home"|"grey"|"outside"|"beige"} cellType
   * @param {boolean} home
   * @param {boolean} outside
   * @param {boolean} outlineOnly
   */
  function appendBorderSideWhitenedCellOutlinesAtX(
    g,
    x,
    b,
    yTop,
    yBottom,
    cellType,
    home,
    outside,
    outlineOnly
  ) {
    if (cellType === "grey" || cellType === "beige") {
      if (home && outside) {
        appendBorderSideCellRhombusOutline(g, x, b, yTop, yBottom);
      }
      appendBorderSideWhitenedCellFrameLinesAtX(g, x, b, yTop, yBottom);
      return;
    }
    if (cellType === "outside") {
      if (outside || outlineOnly) {
        appendBorderSideCellDiagonalsAtX(g, x, b, yTop, yBottom);
      }
      appendBorderSideWhitenedCellFrameLinesAtX(g, x, b, yTop, yBottom);
      return;
    }
    if (home || outlineOnly) {
      appendBorderSideCellDiagonalsAtX(g, x, b, yTop, yBottom);
    }
    appendBorderSideWhitenedCellFrameLinesAtX(g, x, b, yTop, yBottom);
  }

  /**
   * @param {SVGElement} g
   * @param {number} b
   * @param {number} rightX
   * @param {number} yTop
   * @param {number} yBottom
   * @param {"home"|"grey"|"outside"|"beige"} cellType
   * @param {boolean} home
   * @param {boolean} outside
   * @param {boolean} outlineOnly
   */
  function appendBorderSideWhitenedCellOutlines(
    g,
    b,
    rightX,
    yTop,
    yBottom,
    cellType,
    home,
    outside,
    outlineOnly
  ) {
    appendBorderSideWhitenedCellOutlinesAtX(
      g,
      0,
      b,
      yTop,
      yBottom,
      cellType,
      home,
      outside,
      outlineOnly
    );
    appendBorderSideWhitenedCellOutlinesAtX(
      g,
      rightX,
      b,
      yTop,
      yBottom,
      cellType,
      home,
      outside,
      outlineOnly
    );
  }

  /**
   * @param {string[]} lines
   * @param {number} cellX
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   */
  function pushBorderSideCellRhombusOutlineExport(
    lines,
    cellX,
    cellW,
    yTop,
    yBottom
  ) {
    var points = getBorderSideCellRhombusPoints(cellX, cellW, yTop, yBottom);
    var i;
    var parts = [];
    for (i = 0; i < points.length; i++) {
      parts.push(String(points[i][0]) + "," + String(points[i][1]));
    }
    lines.push(
      '<polygon points="' +
        parts.join(" ") +
        '" fill="none" stroke="' +
        getPatternStrokeColor() +
        '" stroke-width="' +
        BORDER_DIVISION_STROKE_WIDTH +
        '"/>'
    );
  }

  /**
   * @param {string[]} lines
   * @param {{ cx: number, cy: number, halfW: number, halfH: number }[]} marks
   */
  function pushHelplessnessMarkExportLines(lines, marks) {
    var stroke = getPatternStrokeColor();
    var sw =
      typeof HELPLESSNESS_STROKE_WIDTH !== "undefined"
        ? HELPLESSNESS_STROKE_WIDTH
        : 3;
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      var xMin = m.cx - m.halfW;
      var yMin = m.cy - m.halfH;
      var xMax = m.cx + m.halfW;
      var yMax = m.cy + m.halfH;
      lines.push(
        '<line x1="' +
          xMin +
          '" y1="' +
          yMin +
          '" x2="' +
          xMax +
          '" y2="' +
          yMax +
          '" stroke="' +
          stroke +
          '" stroke-width="' +
          sw +
          '"/>'
      );
      lines.push(
        '<line x1="' +
          xMax +
          '" y1="' +
          yMin +
          '" x2="' +
          xMin +
          '" y2="' +
          yMax +
          '" stroke="' +
          stroke +
          '" stroke-width="' +
          sw +
          '"/>'
      );
    }
  }

  function pushHelplessnessExportLines(lines) {
    var marks = getActiveHelplessnessMarks();
    if (!marks.length) return;
    var stroke = getPatternStrokeColor();
    var sw =
      typeof HELPLESSNESS_STROKE_WIDTH !== "undefined"
        ? HELPLESSNESS_STROKE_WIDTH
        : 3;
    lines.push(
      '<g id="layer-helplessness" fill="none" stroke="' +
        stroke +
        '" stroke-width="' +
        sw +
        '">'
    );
    pushHelplessnessMarkExportLines(lines, marks);
    lines.push("</g>");
  }

  /**
   * @param {string[]} lines
   * @param {number} x
   * @param {number} b
   * @param {number} yTop
   * @param {number} yBottom
   */
  function pushBorderSideCellDiagonalsAtXExport(lines, x, b, yTop, yBottom) {
    var stroke = getPatternStrokeColor();
    var sw = BORDER_DIVISION_STROKE_WIDTH;
    lines.push(
      '<line x1="' +
        x +
        '" y1="' +
        yTop +
        '" x2="' +
        (x + b) +
        '" y2="' +
        yBottom +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        sw +
        '" shape-rendering="crispEdges"/>'
    );
    lines.push(
      '<line x1="' +
        (x + b) +
        '" y1="' +
        yTop +
        '" x2="' +
        x +
        '" y2="' +
        yBottom +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        sw +
        '" shape-rendering="crispEdges"/>'
    );
  }

  /**
   * @param {string[]} lines
   * @param {number} x
   * @param {number} x2
   * @param {number} y
   */
  function pushBorderDivisionLineExport(lines, x, y, x2, y2) {
    lines.push(
      '<line x1="' +
        x +
        '" y1="' +
        y +
        '" x2="' +
        x2 +
        '" y2="' +
        y2 +
        '" stroke="' +
        getPatternStrokeColor() +
        '" stroke-width="' +
        BORDER_DIVISION_STROKE_WIDTH +
        '" shape-rendering="crispEdges"/>'
    );
  }

  /**
   * @param {string[]} lines
   * @param {number} x
   * @param {number} b
   * @param {number} yTop
   * @param {number} yBottom
   */
  function pushBorderSideWhitenedCellFrameLinesAtXExport(lines, x, b, yTop, yBottom) {
    pushBorderDivisionLineExport(lines, x, yTop, x + b, yTop);
    pushBorderDivisionLineExport(lines, x, yBottom, x + b, yBottom);
    pushBorderDivisionLineExport(lines, x, yTop, x, yBottom);
    pushBorderDivisionLineExport(lines, x + b, yTop, x + b, yBottom);
  }

  /**
   * @param {string[]} lines
   */
  function pushLeftRightBorderColumnDividersExport(lines) {
    var b = getCanvasBorderPx();
    var cols = getBorderSideThicknessColumns();
    if (cols <= 1) return;

    var divY = getLeftRightBorderDivisionYBounds();
    var c;
    for (c = 1; c < cols; c++) {
      var xLeft = c * b;
      pushBorderDivisionLineExport(lines, xLeft, divY.top, xLeft, divY.bottom);
      var xRight = CANVAS_W - c * b;
      pushBorderDivisionLineExport(lines, xRight, divY.top, xRight, divY.bottom);
    }
  }

  /**
   * @param {string[]} lines
   * @param {number} x
   * @param {number} b
   * @param {number} yTop
   * @param {number} yBottom
   * @param {"home"|"grey"|"outside"|"beige"} cellType
   * @param {boolean} home
   * @param {boolean} outside
   * @param {boolean} outlineOnly
   */
  function pushBorderSideWhitenedCellOutlinesAtXExport(
    lines,
    x,
    b,
    yTop,
    yBottom,
    cellType,
    home,
    outside,
    outlineOnly
  ) {
    if (cellType === "grey" || cellType === "beige") {
      if (home && outside) {
        pushBorderSideCellRhombusOutlineExport(lines, x, b, yTop, yBottom);
      }
      pushBorderSideWhitenedCellFrameLinesAtXExport(lines, x, b, yTop, yBottom);
      return;
    }
    if (cellType === "outside") {
      if (outside || outlineOnly) {
        pushBorderSideCellDiagonalsAtXExport(lines, x, b, yTop, yBottom);
      }
      pushBorderSideWhitenedCellFrameLinesAtXExport(lines, x, b, yTop, yBottom);
      return;
    }
    if (home || outlineOnly) {
      pushBorderSideCellDiagonalsAtXExport(lines, x, b, yTop, yBottom);
    }
    pushBorderSideWhitenedCellFrameLinesAtXExport(lines, x, b, yTop, yBottom);
  }

  /**
   * @param {string[]} lines
   * @param {number} b
   * @param {number} rightX
   * @param {number} yTop
   * @param {number} yBottom
   * @param {"home"|"grey"|"outside"|"beige"} cellType
   * @param {boolean} home
   * @param {boolean} outside
   * @param {boolean} outlineOnly
   */
  function pushBorderSideWhitenedCellOutlinesExport(
    lines,
    b,
    rightX,
    yTop,
    yBottom,
    cellType,
    home,
    outside,
    outlineOnly
  ) {
    pushBorderSideWhitenedCellOutlinesAtXExport(
      lines,
      0,
      b,
      yTop,
      yBottom,
      cellType,
      home,
      outside,
      outlineOnly
    );
    pushBorderSideWhitenedCellOutlinesAtXExport(
      lines,
      rightX,
      b,
      yTop,
      yBottom,
      cellType,
      home,
      outside,
      outlineOnly
    );
  }

  /**
   * @param {string[]} lines
   * @param {number} cellX
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   * @param {string} fill
   */
  function pushBorderSideCellRhombusExport(
    lines,
    cellX,
    cellW,
    yTop,
    yBottom,
    fill
  ) {
    var points = getBorderSideCellRhombusPoints(cellX, cellW, yTop, yBottom);
    var i;
    var parts = [];
    for (i = 0; i < points.length; i++) {
      parts.push(String(points[i][0]) + "," + String(points[i][1]));
    }
    lines.push(
      '<polygon points="' +
        parts.join(" ") +
        '" fill="' +
        fill +
        '" stroke="none"/>'
    );
  }

  /**
   * @param {SVGElement} g
   */
  function appendLeftRightBorderSolidCellRhombusesToGroup(g) {
    var home = isBodyAutonomyHomeChecked();
    var outside = isBodyAutonomyOutsideChecked();
    if (!home || !outside) return;

    var b = getCanvasBorderPx();
    var yBounds = getLeftRightBorderCellYBounds();
    var rightX = CANVAS_W - b;
    var j;
    var yTop;
    var yBottom;
    var cellType;
    var rhombusFill;

    for (j = 0; j < yBounds.length - 1; j++) {
      cellType = getBorderSideCellType(j);
      if (!isBorderSideSolidColorOnlyCell(cellType, home, outside)) continue;
      if (isBorderSideCellWhitened(0, j)) continue;
      yTop = yBounds[j];
      yBottom = yBounds[j + 1];
      rhombusFill = getBorderSideRhombusFillForCellType(cellType);
      appendBorderSideCellRhombus(g, 0, b, yTop, yBottom, rhombusFill);
      appendBorderSideCellRhombus(g, rightX, b, yTop, yBottom, rhombusFill);
    }
  }

  /**
   * @param {SVGElement} g
   * @param {number} x
   * @param {number} yTop
   * @param {number} w
   * @param {number} h
   * @param {string} fill
   */
  function appendBorderSideSolidCellRect(g, x, yTop, w, h, fill) {
    var rect = elSvg("rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(yTop));
    rect.setAttribute("width", String(w));
    rect.setAttribute("height", String(h));
    rect.setAttribute("fill", fill);
    g.appendChild(rect);
  }

  /**
   * @param {SVGElement} g
   * @param {{ x: number, y: number, width: number, height: number }} cell
   * @param {string} fill
   */
  function appendBrownBarGridCellFillRect(g, cell, fill) {
    var rect = elSvg("rect");
    rect.setAttribute("x", String(cell.x));
    rect.setAttribute("y", String(cell.y));
    rect.setAttribute("width", String(cell.width));
    rect.setAttribute("height", String(cell.height));
    rect.setAttribute("fill", fill);
    rect.setAttribute("stroke", "none");
    rect.setAttribute("shape-rendering", "crispEdges");
    g.appendChild(rect);
  }

  /**
   * @param {SVGElement} g
   * @param {number[][]} points
   * @param {string} fill
   */
  function appendSvgPolygonFill(g, points, fill) {
    var poly = elSvg("polygon");
    var i;
    var parts = [];
    for (i = 0; i < points.length; i++) {
      parts.push(String(points[i][0]) + "," + String(points[i][1]));
    }
    poly.setAttribute("points", parts.join(" "));
    poly.setAttribute("fill", fill);
    g.appendChild(poly);
  }

  /**
   * X-shaped four-triangle fill inside one margin cell.
   * @param {SVGElement} g
   * @param {number} cellX
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   * @param {string} topFill
   * @param {string} leftFill
   * @param {string} rightFill
   * @param {string} bottomFill
   */
  function appendBorderSideCellXPatternFills(
    g,
    cellX,
    cellW,
    yTop,
    yBottom,
    topFill,
    leftFill,
    rightFill,
    bottomFill
  ) {
    var cx = cellX + cellW / 2;
    var cy = (yTop + yBottom) / 2;
    var xL = cellX;
    var xR = cellX + cellW;

    appendSvgPolygonFill(
      g,
      [
        [xL, yTop],
        [xR, yTop],
        [cx, cy],
      ],
      topFill
    );
    appendSvgPolygonFill(
      g,
      [
        [xL, yTop],
        [xL, yBottom],
        [cx, cy],
      ],
      leftFill
    );
    appendSvgPolygonFill(
      g,
      [
        [xR, yTop],
        [xR, yBottom],
        [cx, cy],
      ],
      rightFill
    );
    appendSvgPolygonFill(
      g,
      [
        [xL, yBottom],
        [xR, yBottom],
        [cx, cy],
      ],
      bottomFill
    );
  }

  /**
   * @param {string[]} lines
   * @param {number} cellX
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   * @param {string} topFill
   * @param {string} leftFill
   * @param {string} rightFill
   * @param {string} bottomFill
   */
  function pushBorderSideCellXPatternExport(
    lines,
    cellX,
    cellW,
    yTop,
    yBottom,
    topFill,
    leftFill,
    rightFill,
    bottomFill
  ) {
    var cx = cellX + cellW / 2;
    var cy = (yTop + yBottom) / 2;
    var xL = cellX;
    var xR = cellX + cellW;

    function pushPoly(pts, fill) {
      var i;
      var attr = [];
      for (i = 0; i < pts.length; i++) {
        attr.push(String(pts[i][0]) + "," + String(pts[i][1]));
      }
      lines.push(
        '<polygon points="' + attr.join(" ") + '" fill="' + fill + '"/>'
      );
    }

    pushPoly(
      [
        [xL, yTop],
        [xR, yTop],
        [cx, cy],
      ],
      topFill
    );
    pushPoly(
      [
        [xL, yTop],
        [xL, yBottom],
        [cx, cy],
      ],
      leftFill
    );
    pushPoly(
      [
        [xR, yTop],
        [xR, yBottom],
        [cx, cy],
      ],
      rightFill
    );
    pushPoly(
      [
        [xL, yBottom],
        [xR, yBottom],
        [cx, cy],
      ],
      bottomFill
    );
  }

  function appendBorderSideBrownCellXPatternFills(g, cellX, cellW, yTop, yBottom) {
    appendBorderSideCellXPatternFills(
      g,
      cellX,
      cellW,
      yTop,
      yBottom,
      BORDER_SIDE_X_FILL_TOP,
      BORDER_SIDE_X_FILL_LEFT,
      BORDER_SIDE_X_FILL_RIGHT,
      BORDER_SIDE_X_FILL_BOTTOM
    );
  }

  function appendBorderSideBlueCellXPatternFills(g, cellX, cellW, yTop, yBottom) {
    appendBorderSideCellXPatternFills(
      g,
      cellX,
      cellW,
      yTop,
      yBottom,
      BORDER_SIDE_BLUE_X_FILL_TOP,
      BORDER_SIDE_BLUE_X_FILL_LEFT,
      BORDER_SIDE_BLUE_X_FILL_RIGHT,
      BORDER_SIDE_BLUE_X_FILL_BOTTOM
    );
  }

  function pushBorderSideBrownCellXPatternExport(lines, cellX, cellW, yTop, yBottom) {
    pushBorderSideCellXPatternExport(
      lines,
      cellX,
      cellW,
      yTop,
      yBottom,
      BORDER_SIDE_X_FILL_TOP,
      BORDER_SIDE_X_FILL_LEFT,
      BORDER_SIDE_X_FILL_RIGHT,
      BORDER_SIDE_X_FILL_BOTTOM
    );
  }

  function pushBorderSideBlueCellXPatternExport(lines, cellX, cellW, yTop, yBottom) {
    pushBorderSideCellXPatternExport(
      lines,
      cellX,
      cellW,
      yTop,
      yBottom,
      BORDER_SIDE_BLUE_X_FILL_TOP,
      BORDER_SIDE_BLUE_X_FILL_LEFT,
      BORDER_SIDE_BLUE_X_FILL_RIGHT,
      BORDER_SIDE_BLUE_X_FILL_BOTTOM
    );
  }

  /**
   * Left/right margin cell fills driven by Body Autonomy checkboxes.
   * @param {SVGElement} g
   */
  function appendLeftRightBorderCellFillsToGroup(g) {
    var home = isBodyAutonomyHomeChecked();
    var outside = isBodyAutonomyOutsideChecked();
    if (!home && !outside) return;

    var b = getCanvasBorderPx();
    var yBounds = getLeftRightBorderCellYBounds();
    var rightX = CANVAS_W - b;
    var j;
    var yTop;
    var yBottom;
    var h;
    var cellType;

    for (j = 0; j < yBounds.length - 1; j++) {
      yTop = yBounds[j];
      yBottom = yBounds[j + 1];
      h = yBottom - yTop;
      cellType = getBorderSideCellType(j);

      if (isBorderSideCellWhitened(0, j)) {
        appendBorderSideSolidCellRect(
          g,
          0,
          yTop,
          b,
          h,
          getCanvasBackgroundColor()
        );
        appendBorderSideWhitenedCellInnerShadowAtX(g, 0, b, yTop, yBottom);
        appendBorderSideSolidCellRect(
          g,
          rightX,
          yTop,
          b,
          h,
          getCanvasBackgroundColor()
        );
        appendBorderSideWhitenedCellInnerShadowAtX(g, rightX, b, yTop, yBottom);
        continue;
      }

      if (cellType === "outside") {
        if (!outside) continue;
        appendBorderSideBrownCellXPatternFills(g, 0, b, yTop, yBottom);
        appendBorderSideBrownCellXPatternFills(g, rightX, b, yTop, yBottom);
      } else if (cellType === "grey") {
        if (!home || !outside) continue;
        appendBorderSideSolidCellRect(
          g,
          0,
          yTop,
          b,
          h,
          BORDER_SIDE_CELL_COLOR_GREY
        );
        appendBorderSideSolidCellRect(
          g,
          rightX,
          yTop,
          b,
          h,
          BORDER_SIDE_CELL_COLOR_GREY
        );
      } else if (cellType === "beige") {
        if (!home || !outside) continue;
        var beigeFill =
          typeof BORDER_SIDE_CELL_COLOR_BEIGE !== "undefined"
            ? BORDER_SIDE_CELL_COLOR_BEIGE
            : BORDER_SIDE_X_FILL_RIGHT;
        appendBorderSideSolidCellRect(g, 0, yTop, b, h, beigeFill);
        appendBorderSideSolidCellRect(g, rightX, yTop, b, h, beigeFill);
      } else {
        if (!home) continue;
        appendBorderSideBlueCellXPatternFills(g, 0, b, yTop, yBottom);
        appendBorderSideBlueCellXPatternFills(g, rightX, b, yTop, yBottom);
      }
    }
  }

  /**
   * Corner-to-corner X strokes in one left/right margin cell.
   * @param {SVGElement} g
   * @param {number} b
   * @param {number} rightX
   * @param {number} yTop
   * @param {number} yBottom
   */
  function appendBorderSideCellDiagonalsAtX(g, x, b, yTop, yBottom) {
    appendBorderDivisionLine(g, x, yTop, x + b, yBottom);
    appendBorderDivisionLine(g, x + b, yTop, x, yBottom);
  }

  /**
   * Corner-to-corner X strokes in one left/right margin cell.
   * @param {SVGElement} g
   * @param {number} b
   * @param {number} rightX
   * @param {number} yTop
   * @param {number} yBottom
   */
  function appendBorderSideCellDiagonals(g, b, rightX, yTop, yBottom) {
    appendBorderSideCellDiagonalsAtX(g, 0, b, yTop, yBottom);
    appendBorderSideCellDiagonalsAtX(g, rightX, b, yTop, yBottom);
  }

  /**
   * X strokes: outline-only when no checkboxes (home + outside rows);
   * with Outside checked, also on outside rows alongside fills.
   * @param {SVGElement} g
   */
  function appendLeftRightBorderCellDiagonalsToGroup(g) {
    var home = isBodyAutonomyHomeChecked();
    var outside = isBodyAutonomyOutsideChecked();
    var outlineOnly = !home && !outside;
    if (!outlineOnly && !outside && getBorderSideWhiteFillTargetPercent() <= 0) return;

    var b = getCanvasBorderPx();
    var yBounds = getLeftRightBorderCellYBounds();
    var j;
    var yTop;
    var yBottom;
    var cellType;
    var rightX = CANVAS_W - b;

    for (j = 0; j < yBounds.length - 1; j++) {
      cellType = getBorderSideCellType(j);
      yTop = yBounds[j];
      yBottom = yBounds[j + 1];

      if (isBorderSideCellWhitened(0, j)) {
        appendBorderSideWhitenedCellOutlines(
          g,
          b,
          rightX,
          yTop,
          yBottom,
          cellType,
          home,
          outside,
          outlineOnly
        );
        continue;
      }

      if (cellType === "grey" || cellType === "beige") continue;
      if (!outlineOnly && cellType !== "outside") continue;
      appendBorderSideCellDiagonals(g, b, rightX, yTop, yBottom);
    }
  }

  /**
   * Top/bottom cell edges in left/right strips, aligned with grid separation frame.
   * @param {SVGElement} g
   */
  function appendLeftRightBorderFrameEdgeLines(g) {
    var b = getCanvasBorderPx();
    var divY = getLeftRightBorderDivisionYBounds();
    appendBorderDivisionLine(g, 0, divY.top, b, divY.top);
    appendBorderDivisionLine(g, 0, divY.bottom, b, divY.bottom);
    appendBorderDivisionLine(g, CANVAS_W - b, divY.top, CANVAS_W, divY.top);
    appendBorderDivisionLine(g, CANVAS_W - b, divY.bottom, CANVAS_W, divY.bottom);
  }

  /**
   * @param {SVGElement} g
   */
  function appendBorderDivisionLinesToGroup(g) {
    var b = getCanvasBorderPx();
    var i;
    var y;

    appendLeftRightBorderFrameEdgeLines(g);

    var sideInteriorY = getLeftRightBorderInteriorYPositions();
    for (i = 0; i < sideInteriorY.length; i++) {
      y = sideInteriorY[i];
      appendBorderDivisionLine(g, 0, y, b, y);
      appendBorderDivisionLine(g, CANVAS_W - b, y, CANVAS_W, y);
    }
  }

  /**
   * Border thickness overlays: extra columns/bands drawn on top of the grid,
   * extending inward from the existing 1-column border. Does not change margins.
   * @param {SVGElement} g
   */
  function appendBorderDivisionOverlayLayersToGroup(g) {
    var cols = getBorderSideThicknessColumns();
    var extra = Math.max(0, cols - 1);
    if (!extra) return;

    var b = getCanvasBorderPx();
    var home = isBodyAutonomyHomeChecked();
    var outside = isBodyAutonomyOutsideChecked();
    var outlineOnly = !home && !outside;

    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getBorderDivisionStrokeColor());
    g.setAttribute("stroke-width", String(BORDER_DIVISION_STROKE_WIDTH));

    var __overlayBaseRects = 0;

    function appendOverlayCellBase(x, y, w, h) {
      __overlayBaseRects++;
      var rect = elSvg("rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", String(h));
      rect.setAttribute("fill", getCanvasBackgroundColor());
      rect.setAttribute("stroke", "none");
      rect.setAttribute("shape-rendering", "crispEdges");
      g.appendChild(rect);
    }

    // Left/right overlays use the same variable-height rows as the margin strip.
    var yBounds = getLeftRightBorderCellYBounds();
    var divY = getLeftRightBorderDivisionYBounds();
    var sideInteriorY = getLeftRightBorderInteriorYPositions();
    var rightBase = CANVAS_W - b;

    // Overlay columns start at x=b (inset by one column), going inward.
    for (var c = 1; c <= extra; c++) {
      var leftX = c * b;
      var rightX = rightBase - c * b;
      // Middle column (2nd overall) is vertically mirrored vs 1st + 3rd.
      // When thickness is 2, the only overlay column is the 2nd one → mirrored.
      // When thickness is 3, c=1 is the 2nd column → mirrored; c=2 is the 3rd → normal.
      var isMirrored = c === 1;
      var rowCount = yBounds.length - 1;

      // Cell fills first (white bases must sit below division lines).
      for (var j = 0; j < yBounds.length - 1; j++) {
        var yTop = yBounds[j];
        var yBottom = yBounds[j + 1];
        var h = yBottom - yTop;
        var cellIndex = isMirrored ? rowCount - 1 - j : j;
        var cellType = getBorderSideCellType(cellIndex);

        // Ensure overlay cells match the white margin background (no grid bleed-through).
        appendOverlayCellBase(leftX, yTop, b, h);
        appendOverlayCellBase(rightX, yTop, b, h);

        if (isBorderSideCellWhitened(c, j)) {
          appendBorderSideWhitenedCellInnerShadowAtX(g, leftX, b, yTop, yBottom);
          appendBorderSideWhitenedCellInnerShadowAtX(
            g,
            rightX,
            b,
            yTop,
            yBottom
          );
          appendBorderSideWhitenedCellOutlinesAtX(
            g,
            leftX,
            b,
            yTop,
            yBottom,
            cellType,
            home,
            outside,
            outlineOnly
          );
          appendBorderSideWhitenedCellOutlinesAtX(
            g,
            rightX,
            b,
            yTop,
            yBottom,
            cellType,
            home,
            outside,
            outlineOnly
          );
          continue;
        }

        if (cellType === "outside") {
          if (outside) {
            appendBorderSideBrownCellXPatternFills(g, leftX, b, yTop, yBottom);
            appendBorderSideBrownCellXPatternFills(g, rightX, b, yTop, yBottom);
          }
          if (outside || outlineOnly) {
            appendBorderSideCellDiagonalsAtX(g, leftX, b, yTop, yBottom);
            appendBorderSideCellDiagonalsAtX(g, rightX, b, yTop, yBottom);
          }
        } else if (cellType === "grey") {
          if (home && outside) {
            appendBorderSideSolidCellRect(
              g,
              leftX,
              yTop,
              b,
              h,
              BORDER_SIDE_CELL_COLOR_GREY
            );
            appendBorderSideSolidCellRect(
              g,
              rightX,
              yTop,
              b,
              h,
              BORDER_SIDE_CELL_COLOR_GREY
            );
          }
        } else if (cellType === "beige") {
          if (home && outside) {
            var beigeFill =
              typeof BORDER_SIDE_CELL_COLOR_BEIGE !== "undefined"
                ? BORDER_SIDE_CELL_COLOR_BEIGE
                : BORDER_SIDE_X_FILL_RIGHT;
            appendBorderSideSolidCellRect(g, leftX, yTop, b, h, beigeFill);
            appendBorderSideSolidCellRect(g, rightX, yTop, b, h, beigeFill);
          }
        } else {
          // "home"
          if (home) {
            appendBorderSideBlueCellXPatternFills(g, leftX, b, yTop, yBottom);
            appendBorderSideBlueCellXPatternFills(g, rightX, b, yTop, yBottom);
          }
          if (outlineOnly) {
            appendBorderSideCellDiagonalsAtX(g, leftX, b, yTop, yBottom);
            appendBorderSideCellDiagonalsAtX(g, rightX, b, yTop, yBottom);
          }
        }

        // Solid-only rhombus overlays (same as margin strip).
        if (home && outside && (cellType === "grey" || cellType === "beige")) {
          var rhombusFill = getBorderSideRhombusFillForCellType(
            /** @type {"grey"|"beige"} */ (cellType)
          );
          appendBorderSideCellRhombus(g, leftX, b, yTop, yBottom, rhombusFill);
          appendBorderSideCellRhombus(g, rightX, b, yTop, yBottom, rhombusFill);
        }
      }

      // Division lines on top of cell fills.
      appendBorderDivisionLine(g, leftX, divY.top, leftX + b, divY.top);
      appendBorderDivisionLine(g, leftX, divY.bottom, leftX + b, divY.bottom);
      appendBorderDivisionLine(g, rightX, divY.top, rightX + b, divY.top);
      appendBorderDivisionLine(g, rightX, divY.bottom, rightX + b, divY.bottom);
      for (var i = 0; i < sideInteriorY.length; i++) {
        var yLine = sideInteriorY[i];
        appendBorderDivisionLine(g, leftX, yLine, leftX + b, yLine);
        appendBorderDivisionLine(g, rightX, yLine, rightX + b, yLine);
      }
    }

    // Top/bottom overlays: simple b×b cells across the inner width (avoid corners).
    var innerX0 = b;
    var innerX1 = CANVAS_W - b;
    var cellsAcross = Math.floor(Math.max(0, innerX1 - innerX0) / b);
    for (var t = 1; t <= extra; t++) {
      var topY0 = t * b;
      var topY1 = (t + 1) * b;
      var bottomY0 = CANVAS_H - (t + 1) * b;
      var bottomY1 = CANVAS_H - t * b;

      for (var xi = 0; xi < cellsAcross; xi++) {
        var x = innerX0 + xi * b;
        var ct = getBorderSideCellType(xi);
        var hhTop = topY1 - topY0;
        var hhBottom = bottomY1 - bottomY0;

        function drawBandCell(y0, y1, hh) {
          // White base so the grid underneath doesn't show through.
          appendOverlayCellBase(x, y0, b, hh);

          if (ct === "outside") {
            if (outside) appendBorderSideBrownCellXPatternFills(g, x, b, y0, y1);
            if (outside || outlineOnly) appendBorderSideCellDiagonalsAtX(g, x, b, y0, y1);
          } else if (ct === "grey") {
            if (home && outside)
              appendBorderSideSolidCellRect(g, x, y0, b, hh, BORDER_SIDE_CELL_COLOR_GREY);
          } else if (ct === "beige") {
            if (home && outside) {
              var beigeFill2 =
                typeof BORDER_SIDE_CELL_COLOR_BEIGE !== "undefined"
                  ? BORDER_SIDE_CELL_COLOR_BEIGE
                  : BORDER_SIDE_X_FILL_RIGHT;
              appendBorderSideSolidCellRect(g, x, y0, b, hh, beigeFill2);
            }
          } else {
            if (home) appendBorderSideBlueCellXPatternFills(g, x, b, y0, y1);
            if (outlineOnly) appendBorderSideCellDiagonalsAtX(g, x, b, y0, y1);
          }

          if (home && outside && (ct === "grey" || ct === "beige")) {
            var rFill = getBorderSideRhombusFillForCellType(
              /** @type {"grey"|"beige"} */ (ct)
            );
            appendBorderSideCellRhombus(g, x, b, y0, y1, rFill);
          }

          // Vertical divider between cells (matches division-line style).
          appendBorderDivisionLine(g, x, y0, x, y1);
        }

        drawBandCell(topY0, topY1, hhTop);
        drawBandCell(bottomY0, bottomY1, hhBottom);
      }

      // Close the band edges.
      appendBorderDivisionLine(g, innerX0, topY0, innerX1, topY0);
      appendBorderDivisionLine(g, innerX0, topY1, innerX1, topY1);
      appendBorderDivisionLine(g, innerX0, bottomY0, innerX1, bottomY0);
      appendBorderDivisionLine(g, innerX0, bottomY1, innerX1, bottomY1);
    }

    // Column separators on top of all overlay fills.
    appendLeftRightBorderColumnDividers(g);
  }

  /**
   * Export mirror of appendBorderDivisionOverlayLayersToGroup (Medium/Thick columns).
   * @param {string[]} lines
   */
  function pushBorderDivisionOverlayExportLines(lines) {
    var cols = getBorderSideThicknessColumns();
    var extra = Math.max(0, cols - 1);
    if (!extra) return;

    var b = getCanvasBorderPx();
    var home = isBodyAutonomyHomeChecked();
    var outside = isBodyAutonomyOutsideChecked();
    var outlineOnly = !home && !outside;
    var whiteFill = getCanvasBackgroundColor();
    var strokeColor = getBorderDivisionStrokeColor();
    var strokeWidth = BORDER_DIVISION_STROKE_WIDTH;
    var yBounds = getLeftRightBorderCellYBounds();
    var divY = getLeftRightBorderDivisionYBounds();
    var sideInteriorY = getLeftRightBorderInteriorYPositions();
    var rightBase = CANVAS_W - b;
    var c;
    var j;
    var i;
    var t;
    var xi;

    lines.push(
      '<g id="layer-border-divisions-overlay" fill="none" stroke="' +
        strokeColor +
        '" stroke-width="' +
        strokeWidth +
        '">'
    );

    function pushOverlayCellBase(x, y, w, h) {
      lines.push(
        '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          w +
          '" height="' +
          h +
          '" fill="' +
          whiteFill +
          '" stroke="none" shape-rendering="crispEdges"/>'
      );
    }

    for (c = 1; c <= extra; c++) {
      var leftX = c * b;
      var rightX = rightBase - c * b;
      var isMirrored = c === 1;
      var rowCount = yBounds.length - 1;

      for (j = 0; j < yBounds.length - 1; j++) {
        var yTop = yBounds[j];
        var yBottom = yBounds[j + 1];
        var h = yBottom - yTop;
        var cellIndex = isMirrored ? rowCount - 1 - j : j;
        var cellType = getBorderSideCellType(cellIndex);

        pushOverlayCellBase(leftX, yTop, b, h);
        pushOverlayCellBase(rightX, yTop, b, h);

        if (isBorderSideCellWhitened(c, j)) {
          pushBorderSideWhitenedCellInnerShadowAtXExport(
            lines,
            leftX,
            b,
            yTop,
            yBottom
          );
          pushBorderSideWhitenedCellInnerShadowAtXExport(
            lines,
            rightX,
            b,
            yTop,
            yBottom
          );
          pushBorderSideWhitenedCellOutlinesAtXExport(
            lines,
            leftX,
            b,
            yTop,
            yBottom,
            cellType,
            home,
            outside,
            outlineOnly
          );
          pushBorderSideWhitenedCellOutlinesAtXExport(
            lines,
            rightX,
            b,
            yTop,
            yBottom,
            cellType,
            home,
            outside,
            outlineOnly
          );
          continue;
        }

        if (cellType === "outside") {
          if (outside) {
            pushBorderSideBrownCellXPatternExport(
              lines,
              leftX,
              b,
              yTop,
              yBottom
            );
            pushBorderSideBrownCellXPatternExport(
              lines,
              rightX,
              b,
              yTop,
              yBottom
            );
          }
          if (outside || outlineOnly) {
            pushBorderSideCellDiagonalsAtXExport(lines, leftX, b, yTop, yBottom);
            pushBorderSideCellDiagonalsAtXExport(
              lines,
              rightX,
              b,
              yTop,
              yBottom
            );
          }
        } else if (cellType === "grey") {
          if (home && outside) {
            lines.push(
              '<rect x="' +
                leftX +
                '" y="' +
                yTop +
                '" width="' +
                b +
                '" height="' +
                h +
                '" fill="' +
                BORDER_SIDE_CELL_COLOR_GREY +
                '"/>'
            );
            lines.push(
              '<rect x="' +
                rightX +
                '" y="' +
                yTop +
                '" width="' +
                b +
                '" height="' +
                h +
                '" fill="' +
                BORDER_SIDE_CELL_COLOR_GREY +
                '"/>'
            );
          }
        } else if (cellType === "beige") {
          if (home && outside) {
            var beigeFill =
              typeof BORDER_SIDE_CELL_COLOR_BEIGE !== "undefined"
                ? BORDER_SIDE_CELL_COLOR_BEIGE
                : BORDER_SIDE_X_FILL_RIGHT;
            lines.push(
              '<rect x="' +
                leftX +
                '" y="' +
                yTop +
                '" width="' +
                b +
                '" height="' +
                h +
                '" fill="' +
                beigeFill +
                '"/>'
            );
            lines.push(
              '<rect x="' +
                rightX +
                '" y="' +
                yTop +
                '" width="' +
                b +
                '" height="' +
                h +
                '" fill="' +
                beigeFill +
                '"/>'
            );
          }
        } else {
          if (home) {
            pushBorderSideBlueCellXPatternExport(
              lines,
              leftX,
              b,
              yTop,
              yBottom
            );
            pushBorderSideBlueCellXPatternExport(
              lines,
              rightX,
              b,
              yTop,
              yBottom
            );
          }
          if (outlineOnly) {
            pushBorderSideCellDiagonalsAtXExport(lines, leftX, b, yTop, yBottom);
            pushBorderSideCellDiagonalsAtXExport(
              lines,
              rightX,
              b,
              yTop,
              yBottom
            );
          }
        }

        if (home && outside && (cellType === "grey" || cellType === "beige")) {
          var rhombusFill = getBorderSideRhombusFillForCellType(
            /** @type {"grey"|"beige"} */ (cellType)
          );
          pushBorderSideCellRhombusExport(
            lines,
            leftX,
            b,
            yTop,
            yBottom,
            rhombusFill
          );
          pushBorderSideCellRhombusExport(
            lines,
            rightX,
            b,
            yTop,
            yBottom,
            rhombusFill
          );
        }
      }

      pushBorderDivisionLineExport(lines, leftX, divY.top, leftX + b, divY.top);
      pushBorderDivisionLineExport(
        lines,
        leftX,
        divY.bottom,
        leftX + b,
        divY.bottom
      );
      pushBorderDivisionLineExport(lines, rightX, divY.top, rightX + b, divY.top);
      pushBorderDivisionLineExport(
        lines,
        rightX,
        divY.bottom,
        rightX + b,
        divY.bottom
      );
      for (i = 0; i < sideInteriorY.length; i++) {
        var yLine = sideInteriorY[i];
        pushBorderDivisionLineExport(lines, leftX, yLine, leftX + b, yLine);
        pushBorderDivisionLineExport(lines, rightX, yLine, rightX + b, yLine);
      }
    }

    var innerX0 = b;
    var innerX1 = CANVAS_W - b;
    var cellsAcross = Math.floor(Math.max(0, innerX1 - innerX0) / b);
    for (t = 1; t <= extra; t++) {
      var topY0 = t * b;
      var topY1 = (t + 1) * b;
      var bottomY0 = CANVAS_H - (t + 1) * b;
      var bottomY1 = CANVAS_H - t * b;

      for (xi = 0; xi < cellsAcross; xi++) {
        var x = innerX0 + xi * b;
        var ct = getBorderSideCellType(xi);
        var hhTop = topY1 - topY0;
        var hhBottom = bottomY1 - bottomY0;

        function drawBandCellExport(y0, y1, hh) {
          pushOverlayCellBase(x, y0, b, hh);

          if (ct === "outside") {
            if (outside) {
              pushBorderSideBrownCellXPatternExport(lines, x, b, y0, y1);
            }
            if (outside || outlineOnly) {
              pushBorderSideCellDiagonalsAtXExport(lines, x, b, y0, y1);
            }
          } else if (ct === "grey") {
            if (home && outside) {
              lines.push(
                '<rect x="' +
                  x +
                  '" y="' +
                  y0 +
                  '" width="' +
                  b +
                  '" height="' +
                  hh +
                  '" fill="' +
                  BORDER_SIDE_CELL_COLOR_GREY +
                  '"/>'
              );
            }
          } else if (ct === "beige") {
            if (home && outside) {
              var beigeFill2 =
                typeof BORDER_SIDE_CELL_COLOR_BEIGE !== "undefined"
                  ? BORDER_SIDE_CELL_COLOR_BEIGE
                  : BORDER_SIDE_X_FILL_RIGHT;
              lines.push(
                '<rect x="' +
                  x +
                  '" y="' +
                  y0 +
                  '" width="' +
                  b +
                  '" height="' +
                  hh +
                  '" fill="' +
                  beigeFill2 +
                  '"/>'
              );
            }
          } else {
            if (home) {
              pushBorderSideBlueCellXPatternExport(lines, x, b, y0, y1);
            }
            if (outlineOnly) {
              pushBorderSideCellDiagonalsAtXExport(lines, x, b, y0, y1);
            }
          }

          if (home && outside && (ct === "grey" || ct === "beige")) {
            var rFill = getBorderSideRhombusFillForCellType(
              /** @type {"grey"|"beige"} */ (ct)
            );
            pushBorderSideCellRhombusExport(lines, x, b, y0, y1, rFill);
          }

          pushBorderDivisionLineExport(lines, x, y0, x, y1);
        }

        drawBandCellExport(topY0, topY1, hhTop);
        drawBandCellExport(bottomY0, bottomY1, hhBottom);
      }

      pushBorderDivisionLineExport(lines, innerX0, topY0, innerX1, topY0);
      pushBorderDivisionLineExport(lines, innerX0, topY1, innerX1, topY1);
      pushBorderDivisionLineExport(lines, innerX0, bottomY0, innerX1, bottomY0);
      pushBorderDivisionLineExport(lines, innerX0, bottomY1, innerX1, bottomY1);
    }

    lines.push("</g>");
  }

  function createBorderDivisionOverlayGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "layer-border-divisions-overlay");
    appendBorderDivisionOverlayLayersToGroup(g);
    return g;
  }

  function updateBorderDivisionOverlay() {
    if (!designSvg) return;
    syncBorderSideWhiteCells(false);
    ensureBorderSideWhiteInnerShadowDefs(designSvg.querySelector("defs"));
    var g = designSvg.querySelector("#layer-border-divisions-overlay");
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    appendBorderDivisionOverlayLayersToGroup(g);
  }

  /**
   * Side-cell fills, then margin division ticks + X diagonals on #layer-border-divisions.
   * @param {SVGElement} g
   */
  function appendBorderDivisionLayersToGroup(g) {
    appendLeftRightBorderCellFillsToGroup(g);
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getBorderDivisionStrokeColor());
    g.setAttribute("stroke-width", String(BORDER_DIVISION_STROKE_WIDTH));
    appendBorderDivisionLinesToGroup(g);
    appendLeftRightBorderSolidCellRhombusesToGroup(g);
    appendLeftRightBorderCellDiagonalsToGroup(g);
  }

  function createBorderDivisionLinesGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "layer-border-divisions");
    appendBorderDivisionLayersToGroup(g);
    return g;
  }

  /**
   * Full-width brown bar flush to the outermost horizontal division lines
   * in the left/right margin strips (divY.top / divY.bottom).
   * @param {"top"|"bottom"} edge
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function getCanvasEdgeBrownBarLayout(edge) {
    var divY = getLeftRightBorderDivisionYBounds();
    var height =
      CANVAS_EDGE_BROWN_BAR_HEIGHT_PX + CANVAS_EDGE_BROWN_BAR_OUTWARD_EXTEND_PX;
    var y =
      edge === "top"
        ? divY.top - height
        : divY.bottom;
    return {
      x: 0,
      y: y,
      width: CANVAS_W,
      height: height,
    };
  }

  /**
   * White margin strip between canvas edge and the brown bar.
   * @param {"top"|"bottom"} edge
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function getCanvasEdgeSerialStripLayout(edge) {
    var bar = getCanvasEdgeBrownBarLayout(edge);
    if (edge === "top") {
      return {
        x: 0,
        y: 0,
        width: CANVAS_W,
        height: Math.max(0, bar.y),
      };
    }
    return {
      x: 0,
      y: bar.y + bar.height,
      width: CANVAS_W,
      height: Math.max(0, CANVAS_H - (bar.y + bar.height)),
    };
  }

  function getCanvasEdgeSerialEdgeInsetPx() {
    return typeof CANVAS_EDGE_SERIAL_EDGE_INSET_PX !== "undefined"
      ? CANVAS_EDGE_SERIAL_EDGE_INSET_PX
      : 50;
  }

  function getCanvasEdgeSerialDigitCount() {
    return typeof CANVAS_EDGE_SERIAL_DIGIT_COUNT !== "undefined"
      ? CANVAS_EDGE_SERIAL_DIGIT_COUNT
      : 8;
  }

  /**
   * @param {number} stripWidth
   * @returns {number[]}
   */
  function getCanvasEdgeSerialDigitXPositions(stripWidth) {
    var count = getCanvasEdgeSerialDigitCount();
    var inset = getCanvasEdgeSerialEdgeInsetPx();
    var span = stripWidth - 2 * inset;
    var positions = [];
    var i;
    if (count <= 1) {
      positions.push(inset + span / 2);
      return positions;
    }
    for (i = 0; i < count; i++) {
      positions.push(inset + (span * i) / (count - 1));
    }
    return positions;
  }

  function getCanvasEdgeSerialFill() {
    return sheetColor("G5");
  }

  function getCanvasEdgeSerialCircleGapPx() {
    return typeof CANVAS_EDGE_SERIAL_CIRCLE_GAP_PX !== "undefined"
      ? CANVAS_EDGE_SERIAL_CIRCLE_GAP_PX
      : 3;
  }

  function getCanvasEdgeSerialCircleDiameterRatio() {
    return typeof CANVAS_EDGE_SERIAL_CIRCLE_DIAMETER_RATIO !== "undefined"
      ? CANVAS_EDGE_SERIAL_CIRCLE_DIAMETER_RATIO
      : 0.35;
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number }} strip
   * @returns {{ r: number, gap: number }}
   */
  function getCanvasEdgeSerialCircleMetrics(strip) {
    var gap = getCanvasEdgeSerialCircleGapPx();
    var digitSlots = getCanvasEdgeSerialDigitCount();
    var inset = getCanvasEdgeSerialEdgeInsetPx();
    var span = strip.width - 2 * inset;
    var slotPitch = digitSlots <= 1 ? span : span / (digitSlots - 1);
    var maxCircles = 9;
    var maxBySlot = (slotPitch * 0.88 - (maxCircles - 1) * gap) / (2 * maxCircles);
    var maxByHeight = (strip.height * getCanvasEdgeSerialCircleDiameterRatio()) / 2;
    var r = Math.min(maxBySlot, maxByHeight);
    return { r: Math.max(1, r), gap: gap };
  }

  /**
   * @param {SVGElement} container
   * @param {number} centerX
   * @param {number} centerY
   * @param {number} digit 0–9
   * @param {number} r
   * @param {number} gap edge-to-edge spacing between circles (px)
   */
  function appendCanvasEdgeSerialDigitCircles(container, centerX, centerY, digit, r, gap) {
    var count = Math.max(0, Math.min(9, Math.floor(digit)));
    var fill = getCanvasEdgeSerialFill();
    var step = 2 * r + gap;
    var totalWidth = count * 2 * r + (count - 1) * gap;
    var startX = centerX - totalWidth / 2 + r;
    var ci;
    var circle;

    for (ci = 0; ci < count; ci++) {
      circle = elSvg("circle");
      circle.setAttribute("cx", String(startX + ci * step));
      circle.setAttribute("cy", String(centerY));
      circle.setAttribute("r", String(r));
      circle.setAttribute("fill", fill);
      circle.setAttribute("stroke", "none");
      container.appendChild(circle);
    }
  }

  function generateCanvasEdgeSerial() {
    var count = getCanvasEdgeSerialDigitCount();
    var digits = [];
    var i;

    if (count <= 0) return "";

    if (count === 1) {
      return String(1 + Math.floor(Math.random() * 9));
    }

    digits.push(String(1 + Math.floor(Math.random() * 9)));
    for (i = 1; i < count - 1; i++) {
      digits.push(String(Math.floor(Math.random() * 10)));
    }
    digits.push(String(1 + Math.floor(Math.random() * 9)));
    return digits.join("");
  }

  function ensureCanvasEdgeSerial() {
    if (canvasEdgeSerial === null) {
      canvasEdgeSerial = generateCanvasEdgeSerial();
    }
    return canvasEdgeSerial;
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number }} strip
   * @param {string} serial
   * @returns {SVGElement}
   */
  function createCanvasEdgeSerialDigitCircles(strip, serial) {
    var g = elSvg("g");
    var xs = getCanvasEdgeSerialDigitXPositions(strip.width);
    var metrics = getCanvasEdgeSerialCircleMetrics(strip);
    var centerY = strip.y + strip.height / 2;
    var i;
    var digit;

    if (!serial || strip.height <= 0 || metrics.r <= 0) return g;

    for (i = 0; i < serial.length && i < xs.length; i++) {
      digit = parseInt(serial.charAt(i), 10);
      if (isNaN(digit)) continue;
      appendCanvasEdgeSerialDigitCircles(
        g,
        strip.x + xs[i],
        centerY,
        digit,
        metrics.r,
        metrics.gap
      );
    }
    return g;
  }

  function appendCanvasEdgeSerialToGroup(g) {
    var serial = ensureCanvasEdgeSerial();
    g.appendChild(
      createCanvasEdgeSerialDigitCircles(getCanvasEdgeSerialStripLayout("top"), serial)
    );
    g.appendChild(
      createCanvasEdgeSerialDigitCircles(
        getCanvasEdgeSerialStripLayout("bottom"),
        serial
      )
    );
  }

  function createCanvasEdgeSerialGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "layer-edge-serial");
    appendCanvasEdgeSerialToGroup(g);
    return g;
  }

  function updateCanvasEdgeSerialLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-edge-serial");
    if (!layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    appendCanvasEdgeSerialToGroup(layer);
  }

  function applyCanvasEdgeBrownBarAttrs(rect, edge) {
    var layout = getCanvasEdgeBrownBarLayout(edge);
    rect.setAttribute("x", String(layout.x));
    rect.setAttribute("y", String(layout.y));
    rect.setAttribute("width", String(layout.width));
    rect.setAttribute("height", String(layout.height));
    rect.setAttribute("fill", getLabelBarBackgroundColor());
    rect.setAttribute("stroke", "none");
  }

  function createCanvasEdgeBrownBarRect(edge) {
    var rect = elSvg("rect");
    rect.setAttribute("id", edge === "top" ? "top-brown-bar" : "bottom-brown-bar");
    applyCanvasEdgeBrownBarAttrs(rect, edge);
    return rect;
  }

  /**
   * Y offsets from the inner edge (grid side), 0 → height toward canvas edge.
   * Canonical geometry is defined on the bottom bar; top bar mirrors these values.
   * @param {number} barHeight
   * @returns {number[]}
   */
  function getCanvasEdgeBrownBarInnerRelativeYOffsets(barHeight) {
    var segments =
      typeof CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS
        : 3;
    var offsets = [];
    var i;
    for (i = 1; i < segments; i++) {
      offsets.push((barHeight * i) / segments);
    }
    return offsets;
  }

  /**
   * @param {number} innerRelY distance from inner edge toward canvas outer edge
   * @param {{ x: number, y: number, width: number, height: number }} bottomLayout
   * @returns {number}
   */
  function getBottomBrownBarCanvasY(innerRelY, bottomLayout) {
    return bottomLayout.y + innerRelY;
  }

  /**
   * Vertical mirror of bottom-bar inner-relative Y onto the top bar.
   * @param {number} innerRelY
   * @param {{ x: number, y: number, width: number, height: number }} topLayout
   * @returns {number}
   */
  function getTopBrownBarMirroredCanvasY(innerRelY, topLayout) {
    return topLayout.y + topLayout.height - innerRelY;
  }

  /**
   * Outermost third on bottom bar (toward canvas edge); mirrored to innermost third on top bar.
   * @param {number} barHeight
   * @returns {{ start: number, end: number, height: number }}
   */
  function getBrownBarOuterThirdInnerRelBounds(barHeight) {
    var third = barHeight / 3;
    return { start: third * 2, end: barHeight, height: third };
  }

  /**
   * Inner segment (grid-facing band) inside each top/bottom brown bar.
   * @param {number} barHeight
   * @param {number} [segmentIndex] 0 = innermost row toward the grid
   * @returns {{ start: number, end: number, height: number }}
   */
  function getBrownBarInnerSegmentRelBounds(barHeight, segmentIndex) {
    var segments =
      typeof CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS
        : 3;
    var segmentH = barHeight / segments;
    var idx =
      typeof segmentIndex === "number"
        ? Math.max(0, Math.min(segmentIndex, segments - 1))
        : 0;
    return {
      start: segmentH * idx,
      end: segmentH * (idx + 1),
      height: segmentH,
    };
  }

  /**
   * Innermost segment (grid-facing band) inside each top/bottom brown bar.
   * @param {number} barHeight
   * @returns {{ start: number, end: number, height: number }}
   */
  function getBrownBarFirstSegmentInnerRelBounds(barHeight) {
    return getBrownBarInnerSegmentRelBounds(barHeight, 0);
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @returns {{ x: number, centerInnerRelY: number, fontSize: number, opticalDy: number }}
   */
  function getBrownBarBannerTextMetrics(layout) {
    var segment = getBrownBarFirstSegmentInnerRelBounds(layout.height);
    var ratio =
      typeof BROWN_BAR_BANNER_FONT_HEIGHT_RATIO !== "undefined"
        ? BROWN_BAR_BANNER_FONT_HEIGHT_RATIO
        : 0.85;
    var fontSize = segment.height * ratio;
    var dyEm =
      typeof BROWN_BAR_BANNER_OPTICAL_CENTER_DY_EM !== "undefined"
        ? BROWN_BAR_BANNER_OPTICAL_CENTER_DY_EM
        : 0.12;
    return {
      x: layout.x + layout.width / 2,
      centerInnerRelY: segment.start + segment.height / 2,
      fontSize: fontSize,
      opticalDy: fontSize * dyEm,
    };
  }

  function getBrownBarBannerDisplayText() {
    return typeof BROWN_BAR_BANNER_TEXT !== "undefined"
      ? BROWN_BAR_BANNER_TEXT
      : "";
  }

  function getBrownBarBannerStrikeWord() {
    return typeof BROWN_BAR_BANNER_STRIKE_WORD !== "undefined"
      ? BROWN_BAR_BANNER_STRIKE_WORD
      : "IRANIAN";
  }

  function getBrownBarBannerStrikePrefix() {
    var full = getBrownBarBannerDisplayText();
    var word = getBrownBarBannerStrikeWord();
    var i = full.indexOf(word);
    return i >= 0 ? full.slice(0, i) : "";
  }

  function getBrownBarBannerFontFamily() {
    return typeof BROWN_BAR_BANNER_FONT_FAMILY !== "undefined"
      ? BROWN_BAR_BANNER_FONT_FAMILY
      : "DIN Condensed";
  }

  function getBrownBarBannerFill() {
    return getLabelBarContentColor();
  }

  function getBrownBarBannerLetterSpacing() {
    return typeof BROWN_BAR_BANNER_LETTER_SPACING !== "undefined"
      ? BROWN_BAR_BANNER_LETTER_SPACING
      : -1;
  }

  function applyBrownBarBannerTextAttrs(text, metrics, anchor) {
    text.setAttribute("fill", getBrownBarBannerFill());
    text.setAttribute("font-family", getBrownBarBannerFontFamily());
    text.setAttribute("font-weight", "700");
    text.setAttribute("font-size", String(metrics.fontSize));
    text.setAttribute("letter-spacing", String(getBrownBarBannerLetterSpacing()));
    text.setAttribute("text-anchor", anchor || "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("alignment-baseline", "middle");
    text.setAttribute("dy", String(metrics.opticalDy));
  }

  function getBrownBarBannerMeasureGroup() {
    if (!designSvg) return null;
    var g = designSvg.getElementById("brown-bar-banner-measure");
    if (!g) {
      g = elSvg("g");
      g.setAttribute("id", "brown-bar-banner-measure");
      g.setAttribute("opacity", "0");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("aria-hidden", "true");
      designSvg.appendChild(g);
    }
    while (g.firstChild) g.removeChild(g.firstChild);
    return g;
  }

  function createBrownBarBannerMeasureText(metrics, canvasY, x, anchor, content) {
    var text = elSvg("text");
    applyBrownBarBannerTextAttrs(text, metrics, anchor);
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(canvasY));
    text.textContent = content;
    return text;
  }

  /**
   * @param {{ fontSize: number, opticalDy: number, x: number }} metrics
   * @param {number} canvasY
   * @returns {{ x1: number, y1: number, x2: number, y2: number, strokeWidth: number }}
   */
  function getBrownBarBannerStrikeLineGeometry(metrics, canvasY) {
    var full = getBrownBarBannerDisplayText();
    var prefix = getBrownBarBannerStrikePrefix();
    var segment = getBrownBarBannerStrikeWord();
    var insetRatio =
      typeof BROWN_BAR_BANNER_STRIKE_INSET_RATIO !== "undefined"
        ? BROWN_BAR_BANNER_STRIKE_INSET_RATIO
        : 0.08;
    var strokeRatio =
      typeof BROWN_BAR_BANNER_STRIKE_STROKE_WIDTH_RATIO !== "undefined"
        ? BROWN_BAR_BANNER_STRIKE_STROKE_WIDTH_RATIO
        : 0.11;
    var measureG;
    var fullText;
    var prefixText;
    var segmentText;
    var fullBb;
    var prefixBb;
    var segmentBb;
    var textLeft;
    var inset;

    measureG = getBrownBarBannerMeasureGroup();
    if (measureG) {
      var liveBannerText =
        designSvg &&
        designSvg.querySelector("#edge-brown-bar-banner-text text");
      var liveBb =
        liveBannerText && liveBannerText.textContent === full
          ? liveBannerText.getBBox()
          : null;

      fullText = createBrownBarBannerMeasureText(
        metrics,
        canvasY,
        0,
        "start",
        full
      );
      measureG.appendChild(fullText);
      fullBb = fullText.getBBox();
      if (liveBb && liveBb.width > 1) {
        textLeft = liveBb.x;
      } else if (fullBb.width > 1) {
        textLeft = metrics.x - fullBb.width / 2;
      } else {
        textLeft = metrics.x - full.length * metrics.fontSize * 0.48;
      }

      prefixText = createBrownBarBannerMeasureText(
        metrics,
        canvasY,
        textLeft,
        "start",
        prefix
      );
      measureG.appendChild(prefixText);
      prefixBb = prefixText.getBBox();

      segmentText = createBrownBarBannerMeasureText(
        metrics,
        canvasY,
        textLeft + prefixBb.width,
        "start",
        segment
      );
      measureG.appendChild(segmentText);
      segmentBb = segmentText.getBBox();
      inset = segmentBb.width * insetRatio;

      if (!segmentBb.width || !fullBb.width) {
        textLeft = metrics.x - full.length * metrics.fontSize * 0.48;
        inset = segment.length * metrics.fontSize * 0.48 * insetRatio;
        return {
          x1: textLeft + prefix.length * metrics.fontSize * 0.48 + inset,
          y1: canvasY + metrics.opticalDy,
          x2:
            textLeft +
            (prefix.length + segment.length) * metrics.fontSize * 0.48 -
            inset,
          y2: canvasY + metrics.opticalDy,
          strokeWidth: Math.max(1, metrics.fontSize * strokeRatio),
        };
      }

      var strikeY = canvasY + metrics.opticalDy;
      return {
        x1: segmentBb.x + inset,
        y1: strikeY,
        x2: segmentBb.x + segmentBb.width - inset,
        y2: strikeY,
        strokeWidth: Math.max(1, metrics.fontSize * strokeRatio),
      };
    }

    textLeft = metrics.x - full.length * metrics.fontSize * 0.48;
    inset = segment.length * metrics.fontSize * 0.48 * insetRatio;
    return {
      x1: textLeft + prefix.length * metrics.fontSize * 0.48 + inset,
      y1: canvasY + metrics.opticalDy,
      x2:
        textLeft +
        (prefix.length + segment.length) * metrics.fontSize * 0.48 -
        inset,
      y2: canvasY + metrics.opticalDy,
      strokeWidth: Math.max(1, metrics.fontSize * strokeRatio),
    };
  }

  function createBrownBarBannerStrikeLine(metrics, canvasY) {
    var geom = getBrownBarBannerStrikeLineGeometry(metrics, canvasY);
    var line = elSvg("line");
    line.setAttribute("x1", String(geom.x1));
    line.setAttribute("y1", String(geom.y1));
    line.setAttribute("x2", String(geom.x2));
    line.setAttribute("y2", String(geom.y2));
    line.setAttribute("stroke", getBrownBarBannerFill());
    line.setAttribute("stroke-width", String(geom.strokeWidth));
    line.setAttribute("stroke-linecap", "butt");
    return line;
  }

  /**
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @returns {SVGElement}
   */
  function createBrownBarBannerLabelGroup(edge, layout) {
    var metrics = getBrownBarBannerTextMetrics(layout);
    var g = elSvg("g");
    var text = elSvg("text");
    var canvasY =
      edge === "bottom"
        ? getBottomBrownBarCanvasY(metrics.centerInnerRelY, layout)
        : getTopBrownBarMirroredCanvasY(metrics.centerInnerRelY, layout);

    applyBrownBarBannerTextAttrs(text, metrics, "middle");
    text.setAttribute("x", String(metrics.x));
    text.setAttribute("y", String(canvasY));
    text.textContent = getBrownBarBannerDisplayText();

    g.appendChild(text);
    g.appendChild(createBrownBarBannerStrikeLine(metrics, canvasY));
    return g;
  }

  function appendBrownBarBannerText(g) {
    appendLabelBarContent(g);
  }

  /**
   * @returns {{ type: "svg" | "text", svgFile: string, text: string }[]}
   */
  function getLabelBarItems() {
    return [];
  }

  function getLabelBarSvgDimensions(filename) {
    if (
      typeof LABEL_BAR_SVG_DIMENSIONS !== "undefined" &&
      LABEL_BAR_SVG_DIMENSIONS[filename]
    ) {
      return LABEL_BAR_SVG_DIMENSIONS[filename];
    }
    if (labelBarSvgCache[filename]) {
      return {
        width: labelBarSvgCache[filename].width,
        height: labelBarSvgCache[filename].height,
      };
    }
    return null;
  }

  function getLabelBarSvgHref(filename) {
    return (
      "svg/" +
      filename
        .split("/")
        .map(function (part) {
          return encodeURIComponent(part);
        })
        .join("/")
    );
  }

  function hexToLabelBarIconFilter(hex) {
    var color = normalizeHexColor(hex, "#ffffff");
    if (color === "#ffffff") return "brightness(0) invert(1)";
    if (color === "#000000") return "brightness(0)";
    var r = parseInt(color.slice(1, 3), 16) / 255;
    var g = parseInt(color.slice(3, 5), 16) / 255;
    var b = parseInt(color.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;
    var d;
    if (max !== min) {
      d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return (
      "brightness(0) saturate(100%) invert(" +
      Math.round(l * 100) +
      "%) sepia(" +
      Math.round(s * 100) +
      "%) saturate(5000%) hue-rotate(" +
      Math.round(h * 360) +
      "deg) brightness(" +
      Math.round(((r + g + b) / 3) * 200) +
      "%) contrast(" +
      Math.round((max || 1) * 100) +
      "%)"
    );
  }

  function invalidateLabelBarSvgTintCache() {
    var file;
    for (file in labelBarSvgCache) {
      if (!Object.prototype.hasOwnProperty.call(labelBarSvgCache, file)) continue;
      labelBarSvgCache[file].tintedInnerMarkup = null;
      labelBarSvgCache[file].tintedColor = null;
    }
  }

  function getLabelBarIconFilterStyle() {
    return hexToLabelBarIconFilter(getLabelBarContentColor());
  }

  function labelBarSvgUsesNativeColors(file) {
    if (!file) return false;
    if (
      typeof LABEL_BAR_NATIVE_COLOR_SVGS !== "undefined" &&
      LABEL_BAR_NATIVE_COLOR_SVGS.indexOf(file) >= 0
    ) {
      return true;
    }
    return false;
  }

  function applyLabelBarSvgTintFill(root, tintColor) {
    if (!root) return;
    var shapes = root.querySelectorAll(
      "path, rect, circle, ellipse, polygon, polyline, line"
    );
    var styleEls = root.querySelectorAll("style");
    var i;
    var fill;
    var stroke;
    var iconFill = normalizeHexColor(
      tintColor,
      typeof LABEL_BAR_CONTENT_COLOR_DEFAULT !== "undefined"
        ? LABEL_BAR_CONTENT_COLOR_DEFAULT
        : "#ffffff"
    );
    for (i = 0; i < styleEls.length; i++) {
      if (styleEls[i].parentNode) {
        styleEls[i].parentNode.removeChild(styleEls[i]);
      }
    }
    for (i = 0; i < shapes.length; i++) {
      fill = shapes[i].getAttribute("fill");
      stroke = shapes[i].getAttribute("stroke");
      if (fill && fill !== "none" && fill !== "transparent") {
        shapes[i].setAttribute("fill", iconFill);
      } else if (
        (!fill || fill === "inherit") &&
        shapes[i].hasAttribute("class")
      ) {
        shapes[i].setAttribute("fill", iconFill);
      }
      if (stroke && stroke !== "none" && stroke !== "transparent") {
        shapes[i].setAttribute("stroke", iconFill);
      }
    }
  }

  function getLabelBarSvgTintedInnerMarkup(file) {
    if (labelBarSvgUsesNativeColors(file)) return "";
    var cached = labelBarSvgCache[file];
    if (!cached) return "";
    var tintColor = getLabelBarContentColor();
    if (cached.tintedInnerMarkup && cached.tintedColor === tintColor) {
      return cached.tintedInnerMarkup;
    }
    var parser = new DOMParser();
    var doc = parser.parseFromString(
      "<svg xmlns=\"http://www.w3.org/2000/svg\">" +
        cached.innerMarkup +
        "</svg>",
      "image/svg+xml"
    );
    applyLabelBarSvgTintFill(doc.documentElement, tintColor);
    cached.tintedInnerMarkup = doc.documentElement.innerHTML;
    cached.tintedColor = tintColor;
    return cached.tintedInnerMarkup;
  }

  function setSvgImageHref(img, href) {
    img.setAttribute("href", href);
    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  }

  /**
   * @param {string} markup full SVG document string
   * @returns {{ width: number, height: number, innerMarkup: string, doc: Document }}
   */
  function parseLabelBarSvgMarkup(markup) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(markup, "image/svg+xml");
    var svgEl = doc.documentElement;
    var vb = svgEl.getAttribute("viewBox");
    var width;
    var height;
    if (vb) {
      var parts = vb.trim().split(/\s+/).map(Number);
      width = parts[2];
      height = parts[3];
    } else {
      width = parseFloat(svgEl.getAttribute("width")) || 100;
      height = parseFloat(svgEl.getAttribute("height")) || 100;
    }
    return {
      width: width,
      height: height,
      innerMarkup: svgEl.innerHTML,
      doc: doc,
    };
  }

  function cacheLabelBarSvgAsset(filename, cached) {
    cached.tintedInnerMarkup = null;
    cached.tintedColor = null;
    labelBarSvgCache[filename] = cached;
    return cached;
  }

  /**
   * @param {string} filename
   * @returns {Promise<{ width: number, height: number, innerMarkup: string, doc: Document }>}
   */
  function ensureLabelBarSvgAsset(filename) {
    if (!filename) return Promise.reject(new Error("missing filename"));
    if (labelBarSvgCache[filename]) {
      return Promise.resolve(labelBarSvgCache[filename]);
    }
    if (labelBarSvgLoadPromises[filename]) {
      return labelBarSvgLoadPromises[filename];
    }
    labelBarSvgLoadPromises[filename] = fetch(getLabelBarSvgHref(filename))
      .then(function (res) {
        if (!res.ok) throw new Error("svg fetch failed");
        return res.text();
      })
      .then(function (markup) {
        return cacheLabelBarSvgAsset(filename, parseLabelBarSvgMarkup(markup));
      })
      .catch(function () {
        var embedded =
          typeof window !== "undefined" &&
          window.LABEL_BAR_SVG_EMBEDDED &&
          window.LABEL_BAR_SVG_EMBEDDED[filename];
        if (embedded) {
          return cacheLabelBarSvgAsset(
            filename,
            parseLabelBarSvgMarkup(
              '<svg xmlns="http://www.w3.org/2000/svg">' + embedded + "</svg>"
            )
          );
        }
        throw new Error("svg unavailable: " + filename);
      });
    return labelBarSvgLoadPromises[filename];
  }

  /**
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @param {number} [segmentIndex]
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function getLabelBarSegmentCanvasBounds(edge, layout, segmentIndex) {
    var segment = getBrownBarInnerSegmentRelBounds(layout.height, segmentIndex);
    if (edge === "bottom") {
      return {
        x: layout.x,
        y: getBottomBrownBarCanvasY(segment.start, layout),
        width: layout.width,
        height: segment.height,
      };
    }
    return {
      x: layout.x,
      y: getTopBrownBarMirroredCanvasY(segment.end, layout),
      width: layout.width,
      height: segment.height,
    };
  }

  /**
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @param {number} segmentIndex
   * @returns {ReturnType<typeof getLabelBarContentArea>}
   */
  function getLabelBarInnerSegmentContentArea(edge, layout, segmentIndex) {
    var vInset = getLabelBarVerticalInsetPx();
    var halfGap = getLabelBarAdjacentRowContentGapPx() / 2;
    var topInset = vInset;
    var bottomInset = vInset;

    // Row 1 = inner segment (index 0); row 2 = index 1. On the top bar, row 2 sits
    // above row 1 in canvas Y, so the 5px gap belongs on seg0 top / seg1 bottom.
    if (edge === "bottom") {
      if (segmentIndex === 0) {
        bottomInset = halfGap;
      } else if (segmentIndex === 1) {
        topInset = halfGap;
      }
    } else if (segmentIndex === 0) {
      topInset = halfGap;
    } else if (segmentIndex === 1) {
      bottomInset = halfGap;
    }

    return getLabelBarContentArea(
      getLabelBarSegmentCanvasBounds(edge, layout, segmentIndex),
      topInset,
      bottomInset
    );
  }

  function getLabelBarEndCapRowSpan() {
    return typeof LABEL_BAR_END_CAP_ROW_SPAN !== "undefined"
      ? LABEL_BAR_END_CAP_ROW_SPAN
      : 2;
  }

  /**
   * Inner-edge band covering N horizontal brown-bar segments (for lion end caps).
   * @param {number} barHeight
   * @param {number} rowSpan
   * @returns {{ start: number, end: number, height: number }}
   */
  function getBrownBarInnerSegmentSpanBounds(barHeight, rowSpan) {
    var segments =
      typeof CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS
        : 3;
    var segmentH = barHeight / segments;
    var span = Math.max(1, Math.min(rowSpan, segments));
    return { start: 0, end: segmentH * span, height: segmentH * span };
  }

  /**
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function getLabelBarEndCapCanvasBounds(edge, layout) {
    var span = getBrownBarInnerSegmentSpanBounds(
      layout.height,
      getLabelBarEndCapRowSpan()
    );
    if (edge === "bottom") {
      return {
        x: layout.x,
        y: getBottomBrownBarCanvasY(span.start, layout),
        width: layout.width,
        height: span.height,
      };
    }
    return {
      x: layout.x,
      y: getTopBrownBarMirroredCanvasY(span.end, layout),
      width: layout.width,
      height: span.height,
    };
  }

  /**
   * Lion end-cap placement area (2 rows minus 5px top/bottom inset, same as other label items).
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @returns {ReturnType<typeof getLabelBarContentArea>}
   */
  function getLabelBarEndCapContentArea(edge, layout) {
    return getLabelBarContentArea(getLabelBarEndCapCanvasBounds(edge, layout));
  }

  function getLabelBarTextHeightRatio() {
    return typeof LABEL_BAR_TEXT_FONT_HEIGHT_RATIO !== "undefined"
      ? LABEL_BAR_TEXT_FONT_HEIGHT_RATIO
      : 1;
  }

  function applyLabelBarTextAttrs(text, fontSize) {
    text.setAttribute("fill", getLabelBarContentColor());
    text.setAttribute("font-family", getBrownBarBannerFontFamily());
    text.setAttribute("font-weight", "700");
    text.setAttribute("font-size", String(fontSize));
    text.setAttribute("letter-spacing", String(getBrownBarBannerLetterSpacing()));
    text.setAttribute("text-anchor", "start");
    /** Same cell as SVG icons: font-size = area.height, vertically centered on cell midline. */
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("alignment-baseline", "middle");
  }

  function getLabelBarMeasureGroup() {
    if (!designSvg) return null;
    var g = designSvg.getElementById("label-bar-measure");
    if (!g) {
      g = elSvg("g");
      g.setAttribute("id", "label-bar-measure");
      g.setAttribute("opacity", "0");
      g.setAttribute("pointer-events", "none");
      g.setAttribute("aria-hidden", "true");
      designSvg.appendChild(g);
    }
    while (g.firstChild) g.removeChild(g.firstChild);
    return g;
  }

  function getLabelBarBandCenterY(area) {
    return area.y + area.height / 2;
  }

  function getLabelBarTextYOffsetPx() {
    return typeof LABEL_BAR_TEXT_Y_OFFSET_PX !== "undefined"
      ? LABEL_BAR_TEXT_Y_OFFSET_PX
      : 0;
  }

  function getLabelBarTextY(area) {
    return getLabelBarBandCenterY(area) + getLabelBarTextYOffsetPx();
  }

  /** Top bar label rows: flip glyphs/text vertically vs the bottom bar. */
  function labelBarEdgeContentFlippedVertically(edge) {
    return edge === "top";
  }

  /**
   * SVG transform: vertical mirror around the content band midline (position unchanged).
   * @param {ReturnType<typeof getLabelBarContentArea>} contentArea
   * @returns {string}
   */
  function getLabelBarVerticalFlipTransform(contentArea) {
    var cy = getLabelBarBandCenterY(contentArea);
    return (
      "translate(0," + cy + ") scale(1,-1) translate(0," + -cy + ")"
    );
  }

  /**
   * Measure text width at the same font-size used for SVG icon cell height (area.height).
   * @param {string} text
   * @param {number} fontSize
   * @returns {{ width: number, bbox: { x: number, y: number, width: number, height: number } | null }}
   */
  function measureLabelBarTextAtCellSize(text, fontSize) {
    var measureG = getLabelBarMeasureGroup();
    var textEl;
    var bb;
    if (!measureG || !text) {
      return {
        width: Math.max(1, (text || "").length * fontSize * 0.55),
        bbox: null,
      };
    }
    textEl = elSvg("text");
    applyLabelBarTextAttrs(textEl, fontSize);
    textEl.setAttribute("x", "0");
    textEl.setAttribute("y", "0");
    textEl.textContent = text;
    measureG.appendChild(textEl);
    bb = textEl.getBBox();
    return {
      width: bb.width > 0 ? bb.width : Math.max(1, text.length * fontSize * 0.55),
      bbox: { x: bb.x, y: bb.y, width: bb.width, height: bb.height },
    };
  }

  /**
   * Text cell matches SVG icon placement: height = area.height, y centered on cell midline.
   * @param {string} text
   * @param {number} maxHeight area.height (same value passed to buildLabelBarSvgSpec)
   * @param {number} bandTopY area.y (same origin as SVG image y)
   * @param {number} bandBottomY area.y + area.height
   * @returns {{ fontSize: number, width: number, height: number }}
   */
  function fitLabelBarTextMetrics(text, maxHeight, bandTopY, bandBottomY) {
    var cellH = Math.max(1, maxHeight * getLabelBarTextHeightRatio());
    var fontSize = cellH;
    var measured;

    if (!text) {
      return { fontSize: fontSize, width: cellH * 0.5, height: cellH };
    }

    measured = measureLabelBarTextAtCellSize(text, fontSize);

    return {
      fontSize: fontSize,
      width: measured.width,
      height: cellH,
    };
  }

  /**
   * @param {{ type: "svg" | "text", svgFile: string, text: string }[]} items
   * @param {number} barWidth
   * @param {number} segmentHeight
   * @returns {object[]}
   */
  function buildLabelBarItemSpecs(items, barWidth, segmentHeight, bandTopY, bandBottomY) {
    var specs = [];
    var i;
    var item;
    var label;
    var textMetrics;
    var topY =
      typeof bandTopY === "number"
        ? bandTopY
        : 0;
    var bottomY =
      typeof bandBottomY === "number"
        ? bandBottomY
        : segmentHeight;
    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (item.type === "text") {
        label = (item.text || "").trim();
        if (!label) continue;
        textMetrics = fitLabelBarTextMetrics(
          label,
          segmentHeight,
          topY,
          bottomY
        );
        specs.push({
          type: "text",
          text: label,
          width: textMetrics.width,
          height: textMetrics.height,
          fontSize: textMetrics.fontSize,
        });
      } else if (item.type === "svg" && item.svgFile) {
        var dims = getLabelBarSvgDimensions(item.svgFile);
        if (!dims || !dims.height) continue;
        var svgScale = segmentHeight / dims.height;
        specs.push({
          type: "svg",
          file: item.svgFile,
          width: dims.width * svgScale,
          height: segmentHeight,
          scale: svgScale,
        });
      }
    }
    return specs;
  }

  function getLabelBarHorizontalInsetPx() {
    return typeof LABEL_BAR_HORIZONTAL_INSET_PX !== "undefined"
      ? LABEL_BAR_HORIZONTAL_INSET_PX
      : 10;
  }

  function getLabelBarVerticalInsetPx() {
    return typeof LABEL_BAR_VERTICAL_INSET_PX !== "undefined"
      ? LABEL_BAR_VERTICAL_INSET_PX
      : 10;
  }

  function getLabelBarAdjacentRowContentGapPx() {
    return typeof LABEL_BAR_ADJACENT_ROW_CONTENT_GAP_PX !== "undefined"
      ? LABEL_BAR_ADJACENT_ROW_CONTENT_GAP_PX
      : 5;
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number }} bounds
   * @param {number} [topInsetOverride]
   * @param {number} [bottomInsetOverride]
   * @returns {{ x: number, y: number, width: number, height: number, innerWidth: number }}
   */
  function getLabelBarContentArea(bounds, topInsetOverride, bottomInsetOverride) {
    var hInset = getLabelBarHorizontalInsetPx();
    var vInset = getLabelBarVerticalInsetPx();
    var topInset =
      typeof topInsetOverride === "number" ? topInsetOverride : vInset;
    var bottomInset =
      typeof bottomInsetOverride === "number" ? bottomInsetOverride : vInset;
    return {
      x: bounds.x,
      y: bounds.y + topInset,
      width: bounds.width,
      height: Math.max(0, bounds.height - topInset - bottomInset),
      innerWidth: Math.max(0, bounds.width - hInset * 2),
      hInset: hInset,
      vInset: vInset,
    };
  }

  function getLabelBarItemGapPx() {
    return typeof LABEL_BAR_ITEM_GAP_PX !== "undefined"
      ? LABEL_BAR_ITEM_GAP_PX
      : 5;
  }

  function getLabelBarClusterInternalGapPx() {
    return typeof LABEL_BAR_CLUSTER_INTERNAL_GAP_PX !== "undefined"
      ? LABEL_BAR_CLUSTER_INTERNAL_GAP_PX
      : 10;
  }

  function getLabelBarSymbolSeparatorSizePx() {
    return typeof LABEL_BAR_SYMBOL_SEPARATOR_SIZE_PX !== "undefined"
      ? LABEL_BAR_SYMBOL_SEPARATOR_SIZE_PX
      : 5;
  }

  function getLabelBarSymbolSeparatorFill() {
    return getLabelBarContentColor();
  }

  function buildLabelBarSquareSepSpec() {
    var size = getLabelBarSymbolSeparatorSizePx();
    return {
      type: "square",
      width: size,
      height: size,
    };
  }

  function getLabelBarSquareSepY(area) {
    var size = getLabelBarSymbolSeparatorSizePx();
    return getLabelBarBandCenterY(area) - size / 2;
  }

  /**
   * Cluster = symbol + optional caption locked with a fixed internal gap (10px).
   * @param {({ spec: object, svgArea?: object, ageOverlayText?: string } | null)[]} parts
   * @returns {{ width: number, items: object[] } | null}
   */
  function buildLabelBarCluster(parts) {
    var pairGap = getLabelBarClusterInternalGapPx();
    var items = [];
    var width = 0;
    var i;
    var part;
    if (!parts) return null;
    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      if (!part || !part.spec) continue;
      if (items.length) width += pairGap;
      width += part.spec.width;
      items.push(part);
    }
    if (!items.length) return null;
    return { width: width, items: items };
  }

  /**
   * Row layout units: clusters (10px inside) and 5×5 squares only between clusters.
   * @param {({ width: number, items: object[] } | null)[]} clusters
   * @param {ReturnType<typeof getLabelBarContentArea>} defaultSvgArea
   * @returns {({ type: "cluster", width: number, items: object[] } | { type: "square", width: number, spec: object, svgArea: object })[]}
   */
  function buildLabelBarRowLayoutUnits(clusters, defaultSvgArea) {
    var units = [];
    var sepSpec = buildLabelBarSquareSepSpec();
    var hasGroup = false;
    var ci;
    var ji;
    var cluster;
    var item;
    var clusterItems;

    for (ci = 0; ci < clusters.length; ci++) {
      cluster = clusters[ci];
      if (!cluster) continue;
      clusterItems = [];
      for (ji = 0; ji < cluster.items.length; ji++) {
        item = cluster.items[ji];
        if (!item || !item.spec) continue;
        clusterItems.push({
          spec: item.spec,
          svgArea: item.svgArea || defaultSvgArea,
          ageOverlayText: item.ageOverlayText,
        });
      }
      if (!clusterItems.length) continue;

      if (hasGroup) {
        units.push({
          type: "square",
          width: sepSpec.width,
          spec: sepSpec,
          svgArea: defaultSvgArea,
        });
      }
      units.push({
        type: "cluster",
        width: cluster.width,
        items: clusterItems,
      });
      hasGroup = true;
    }
    return units;
  }

  /**
   * Spread groups across the full content span; 10px fixed gap inside each group.
   * @param {({ width: number, items: object[] } | null)[]} clusters
   * @param {number} spanStart
   * @param {number} spanEnd
   * @param {ReturnType<typeof getLabelBarContentArea>} defaultSvgArea
   * @returns {{ spec: object, x: number, mirror: boolean, svgArea?: object, ageOverlayText?: string }[]}
   */
  function layoutLabelBarRowClusters(clusters, spanStart, spanEnd, defaultSvgArea) {
    var units = buildLabelBarRowLayoutUnits(clusters, defaultSvgArea);
    var placements = [];
    var spreadSpecs = [];
    var positions;
    var internalGap = getLabelBarClusterInternalGapPx();
    var ui;
    var unit;
    var x;
    var ii;
    var rowItem;

    if (!units.length) return placements;

    for (ui = 0; ui < units.length; ui++) {
      spreadSpecs.push({ width: units[ui].width });
    }
    positions = layoutLabelBarSpreadInSpan(spreadSpecs, spanStart, spanEnd);

    for (ui = 0; ui < units.length; ui++) {
      unit = units[ui];
      x = positions[ui];
      if (unit.type === "square") {
        placements.push({
          spec: unit.spec,
          x: x,
          mirror: false,
          svgArea: unit.svgArea,
        });
        continue;
      }
      for (ii = 0; ii < unit.items.length; ii++) {
        rowItem = unit.items[ii];
        placements.push({
          spec: rowItem.spec,
          x: x,
          mirror: false,
          svgArea: rowItem.svgArea,
          ageOverlayText: rowItem.ageOverlayText,
        });
        if (ii < unit.items.length - 1) {
          x += rowItem.spec.width + internalGap;
        }
      }
    }
    return placements;
  }

  /**
   * Distribute specs across the full span width with equal gaps between each item.
   * @param {object[]} specs
   * @param {number} spanStart
   * @param {number} spanEnd
   * @returns {number[]}
   */
  function layoutLabelBarSpreadInSpan(specs, spanStart, spanEnd) {
    var n = specs.length;
    var positions = [];
    var contentWidth = 0;
    var spanWidth = spanEnd - spanStart;
    var gap = 0;
    var x;
    var i;

    if (!n) return positions;
    for (i = 0; i < n; i++) contentWidth += specs[i].width;
    if (n > 1) {
      gap = (spanWidth - contentWidth) / (n - 1);
      if (gap < 0) gap = 0;
    }
    x = spanStart;
    for (i = 0; i < n; i++) {
      positions.push(x);
      x += specs[i].width + gap;
    }
    return positions;
  }

  /**
   * Place specs left-to-right with a fixed gap, centered when they fit in the span.
   * @param {object[]} specs
   * @param {number} spanStart
   * @param {number} spanEnd
   * @returns {number[]}
   */
  function layoutLabelBarFixedGapInSpan(specs, spanStart, spanEnd) {
    var gap = getLabelBarItemGapPx();
    var n = specs.length;
    var positions = [];
    var clusterWidth = 0;
    var offset;
    var x;
    var i;

    if (!n) return positions;
    for (i = 0; i < n; i++) clusterWidth += specs[i].width;
    if (n > 1) clusterWidth += (n - 1) * gap;
    offset =
      clusterWidth < spanEnd - spanStart
        ? (spanEnd - spanStart - clusterWidth) / 2
        : 0;
    x = spanStart + offset;
    for (i = 0; i < n; i++) {
      positions.push(x);
      x += specs[i].width + gap;
    }
    return positions;
  }

  function getLabelBarEndCapSvgFile() {
    return typeof LABEL_BAR_END_CAP_SVG !== "undefined"
      ? LABEL_BAR_END_CAP_SVG
      : "lion.svg";
  }

  function getLabelBarLivingInIranSvgFile() {
    return typeof LABEL_BAR_LIVING_IN_IRAN_SVG !== "undefined"
      ? LABEL_BAR_LIVING_IN_IRAN_SVG
      : "IN IRAN.svg";
  }

  function getLabelBarLivingOutsideIranSvgFile() {
    return typeof LABEL_BAR_LIVING_OUTSIDE_IRAN_SVG !== "undefined"
      ? LABEL_BAR_LIVING_OUTSIDE_IRAN_SVG
      : "OUTSIDE IRAN.svg";
  }

  function getLabelBarFromSvgFile() {
    return typeof LABEL_BAR_FROM_SVG !== "undefined"
      ? LABEL_BAR_FROM_SVG
      : "from.svg";
  }

  function getLabelBarNowInSvgFile() {
    return typeof LABEL_BAR_NOW_IN_SVG !== "undefined"
      ? LABEL_BAR_NOW_IN_SVG
      : "now in.svg";
  }

  function getLabelBarBarcodeSvgFile() {
    return typeof LABEL_BAR_BARCODE_SVG !== "undefined"
      ? LABEL_BAR_BARCODE_SVG
      : "barcode.svg";
  }

  function getLabelBarLeftSvgFile() {
    return typeof LABEL_BAR_LEFT_SVG !== "undefined"
      ? LABEL_BAR_LEFT_SVG
      : "left.svg";
  }

  function getLabelBarWomenSvgFile() {
    return typeof LABEL_BAR_WOMEN_SVG !== "undefined"
      ? LABEL_BAR_WOMEN_SVG
      : "women.svg";
  }

  function getProfileFromText() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getFrom
    ) {
      return typeof LABEL_BAR_PROFILE_FROM_DEFAULT !== "undefined"
        ? LABEL_BAR_PROFILE_FROM_DEFAULT
        : "TEHERAN";
    }
    var value = String(window.IdentityControls.getFrom() || "").trim();
    return value;
  }

  function getProfileNowInText() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getNowIn
    ) {
      return typeof LABEL_BAR_PROFILE_NOW_IN_DEFAULT !== "undefined"
        ? LABEL_BAR_PROFILE_NOW_IN_DEFAULT
        : "MAINZ";
    }
    return String(window.IdentityControls.getNowIn() || "").trim();
  }

  /** Name on row 2 — between leaving year and women icon (mode from Profile → Name). */
  function getProfileNameText() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getNameLabelText
    ) {
      return "";
    }
    return String(window.IdentityControls.getNameLabelText() || "").trim();
  }

  /** Year of leaving — row 1, only when Profile “Have I lived in Iran?” is Yes. */
  function getProfileLeavingYearText() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getLivingInIran ||
      !window.IdentityControls.getLeavingYear
    ) {
      return "";
    }
    if (window.IdentityControls.getLivingInIran() !== true) return "";
    return String(window.IdentityControls.getLeavingYear() || "").trim();
  }

  function getLabelBarLeftLionInnerRow1SvgFile() {
    return typeof LABEL_BAR_LEFT_LION_INNER_ROW1_SVG !== "undefined"
      ? LABEL_BAR_LEFT_LION_INNER_ROW1_SVG
      : "undercover english.svg";
  }

  function getLabelBarLeftLionInnerRow1SunSvgFile() {
    return typeof LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG !== "undefined"
      ? LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG
      : "sun.svg";
  }

  function getLabelBarAgeSvgFile() {
    return typeof LABEL_BAR_AGE_SVG !== "undefined"
      ? LABEL_BAR_AGE_SVG
      : "age.svg";
  }

  /** Digits from Profile → Age input (shown inside the age icon circle). */
  function getProfileAgeText() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getAge
    ) {
      return "";
    }
    return String(window.IdentityControls.getAge() || "").trim();
  }

  function getLabelBarAgeOverlayFill() {
    return getLabelBarContentColor();
  }

  function getLabelBarAgeOverlayFontSizeRatio() {
    return typeof LABEL_BAR_AGE_OVERLAY_FONT_SIZE_RATIO !== "undefined"
      ? LABEL_BAR_AGE_OVERLAY_FONT_SIZE_RATIO
      : 0.58;
  }

  function getLabelBarAgeOverlayYOffsetPx() {
    return typeof LABEL_BAR_AGE_OVERLAY_Y_OFFSET_PX !== "undefined"
      ? LABEL_BAR_AGE_OVERLAY_Y_OFFSET_PX
      : 1;
  }

  /**
   * @param {{ spec: { width: number, height: number, scale: number }, x: number }} placement
   * @param {ReturnType<typeof getLabelBarContentArea>} contentArea
   * @returns {{ x: number, y: number, fontSize: number }}
   */
  function getLabelBarAgeOverlayTextMetrics(placement, contentArea) {
    var dims = getLabelBarSvgDimensions(getLabelBarAgeSvgFile());
    var spec = placement.spec;
    var cxRatio =
      dims && dims.width
        ? (typeof LABEL_BAR_AGE_CIRCLE_CX !== "undefined"
            ? LABEL_BAR_AGE_CIRCLE_CX
            : 30.5816) / dims.width
        : 0.5;
    var cyRatio =
      dims && dims.height
        ? (typeof LABEL_BAR_AGE_CIRCLE_CY !== "undefined"
            ? LABEL_BAR_AGE_CIRCLE_CY
            : 40.5816) / dims.height
        : 0.5;
    var rRatio =
      dims && dims.height
        ? (typeof LABEL_BAR_AGE_CIRCLE_R !== "undefined"
            ? LABEL_BAR_AGE_CIRCLE_R
            : 27.0816) / dims.height
        : 0.33;
    var circleR = spec.height * rRatio;
    return {
      x: placement.x + spec.width * cxRatio,
      y: contentArea.y + spec.height * cyRatio + getLabelBarAgeOverlayYOffsetPx(),
      fontSize: circleR * 2 * getLabelBarAgeOverlayFontSizeRatio(),
    };
  }

  function applyLabelBarAgeOverlayTextAttrs(text, fontSize) {
    text.setAttribute("fill", getLabelBarAgeOverlayFill());
    text.setAttribute("font-family", getBrownBarBannerFontFamily());
    text.setAttribute("font-weight", "700");
    text.setAttribute("font-size", String(fontSize));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("alignment-baseline", "middle");
  }

  function appendLabelBarAgeOverlayText(container, placement, contentArea) {
    var overlayText = placement.ageOverlayText;
    var metrics;
    var text;
    if (overlayText === undefined || !overlayText) return;
    metrics = getLabelBarAgeOverlayTextMetrics(placement, contentArea);
    text = elSvg("text");
    text.setAttribute("x", String(metrics.x));
    text.setAttribute("y", String(metrics.y));
    applyLabelBarAgeOverlayTextAttrs(text, metrics.fontSize);
    text.textContent = overlayText;
    container.appendChild(text);
  }

  function pushLabelBarAgeOverlayTextExport(edgeLines, placement, contentArea) {
    var overlayText = placement.ageOverlayText;
    var metrics;
    if (overlayText === undefined || !overlayText) return;
    metrics = getLabelBarAgeOverlayTextMetrics(placement, contentArea);
    edgeLines.push(
      '<text x="' +
        metrics.x +
        '" y="' +
        metrics.y +
        '" fill="' +
        getLabelBarAgeOverlayFill() +
        '" font-family="' +
        getBrownBarBannerFontFamily() +
        ', sans-serif" font-weight="700" font-size="' +
        metrics.fontSize +
        '" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle">' +
        overlayText +
        "</text>"
    );
  }

  function getLabelBarRightLionInnerRow2SvgFile() {
    return typeof LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG !== "undefined"
      ? LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG
      : "undercover english.svg";
  }

  function getLabelBarLostInnerSvgFile() {
    return typeof LABEL_BAR_LOST_INNER_SVG !== "undefined"
      ? LABEL_BAR_LOST_INNER_SVG
      : "LOST/man.svg";
  }

  function getLabelBarLostMiddleSvgFile() {
    return typeof LABEL_BAR_LOST_MIDDLE_SVG !== "undefined"
      ? LABEL_BAR_LOST_MIDDLE_SVG
      : "LOST/2 man.svg";
  }

  function getLabelBarLostDistantSvgFile() {
    return typeof LABEL_BAR_LOST_DISTANT_SVG !== "undefined"
      ? LABEL_BAR_LOST_DISTANT_SVG
      : "LOST/3 man.svg";
  }

  /** Icon from Profile Lost slider (Inner / middle / Distant circle). */
  function getLostLabelSvgFile() {
    var value = 1;
    if (
      typeof window.IdentityControls !== "undefined" &&
      window.IdentityControls.getLostCircle
    ) {
      value = window.IdentityControls.getLostCircle();
    }
    if (value === 2) return getLabelBarLostMiddleSvgFile();
    if (value === 3) return getLabelBarLostDistantSvgFile();
    return getLabelBarLostInnerSvgFile();
  }

  function getLabelBarLostSvgFiles() {
    return [
      getLabelBarLostInnerSvgFile(),
      getLabelBarLostMiddleSvgFile(),
      getLabelBarLostDistantSvgFile(),
    ];
  }

  /** Sign from Profile “Have I lived in Iran?” — only after Yes/No is chosen. */
  function getLivingIranLabelSvgFile() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getLivingInIran
    ) {
      return null;
    }
    var choice = window.IdentityControls.getLivingInIran();
    if (choice === true) return getLabelBarLivingInIranSvgFile();
    if (choice === false) return getLabelBarLivingOutsideIranSvgFile();
    return null;
  }

  function filterLabelBarCenterItems(items) {
    var cap = getLabelBarEndCapSvgFile();
    var inIran = getLabelBarLivingInIranSvgFile();
    var outsideIran = getLabelBarLivingOutsideIranSvgFile();
    var fromFile = getLabelBarFromSvgFile();
    var nowInFile = getLabelBarNowInSvgFile();
    var barcodeFile = getLabelBarBarcodeSvgFile();
    var leftSignFile = getLabelBarLeftSvgFile();
    var womenFile = getLabelBarWomenSvgFile();
    var leftWord = getLabelBarLeftLionInnerRow1SvgFile();
    var sunFile = getLabelBarLeftLionInnerRow1SunSvgFile();
    var ageFile = getLabelBarAgeSvgFile();
    var rightWord = getLabelBarRightLionInnerRow2SvgFile();
    var lostFiles = getLabelBarLostSvgFiles();
    return items.filter(function (item) {
      return !(
        item.type === "svg" &&
        (item.svgFile === cap ||
          item.svgFile === inIran ||
          item.svgFile === outsideIran ||
          item.svgFile === fromFile ||
          item.svgFile === nowInFile ||
          item.svgFile === barcodeFile ||
          item.svgFile === leftSignFile ||
          item.svgFile === womenFile ||
          item.svgFile === leftWord ||
          item.svgFile === sunFile ||
          item.svgFile === ageFile ||
          item.svgFile === rightWord ||
          lostFiles.indexOf(item.svgFile) >= 0)
      );
    });
  }

  function buildLabelBarSvgSpec(file, segmentHeight) {
    var dims = getLabelBarSvgDimensions(file);
    if (!dims || !dims.height) return null;
    var scale = segmentHeight / dims.height;
    return {
      type: "svg",
      file: file,
      width: dims.width * scale,
      height: segmentHeight,
      scale: scale,
    };
  }

  function getLabelBarLostLabelText() {
    return typeof LABEL_BAR_LOST_LABEL_TEXT !== "undefined"
      ? LABEL_BAR_LOST_LABEL_TEXT
      : "LOST";
  }

  function buildLabelBarLostLabelSpec(area) {
    var label = (getLabelBarLostLabelText() || "").trim();
    var textMetrics;
    if (!label) return null;
    textMetrics = fitLabelBarTextMetrics(
      label,
      area.height,
      area.y,
      area.y + area.height
    );
    return {
      type: "text",
      text: label,
      width: textMetrics.width,
      height: textMetrics.height,
      fontSize: textMetrics.fontSize,
    };
  }

  function getLabelBarAgeLabelText() {
    return typeof LABEL_BAR_AGE_LABEL_TEXT !== "undefined"
      ? LABEL_BAR_AGE_LABEL_TEXT
      : "AGE";
  }

  function buildLabelBarAgeLabelSpec(area) {
    var label = (getLabelBarAgeLabelText() || "").trim();
    var textMetrics;
    if (!label) return null;
    textMetrics = fitLabelBarTextMetrics(
      label,
      area.height,
      area.y,
      area.y + area.height
    );
    return {
      type: "text",
      text: label,
      width: textMetrics.width,
      height: textMetrics.height,
      fontSize: textMetrics.fontSize,
    };
  }

  function buildLabelBarProfileFieldTextSpec(text, contentArea) {
    var label = (text || "").trim();
    var textMetrics;
    if (!label) return null;
    textMetrics = fitLabelBarTextMetrics(
      label,
      contentArea.height,
      contentArea.y,
      contentArea.y + contentArea.height
    );
    return {
      type: "text",
      text: label,
      width: textMetrics.width,
      height: textMetrics.height,
      fontSize: textMetrics.fontSize,
    };
  }

  /**
   * @param {ReturnType<typeof getLabelBarContentArea>} area
   * @param {ReturnType<typeof getLabelBarContentArea>} endCapArea
   * @param {ReturnType<typeof getLabelBarContentArea>} row2Area
   * @param {{ type: "svg" | "text", svgFile: string, text: string }[]} items
   * @returns {{ spec: object, x: number, mirror: boolean, svgArea?: object }[]}
   */
  function computeLabelBarPlacements(area, endCapArea, row2Area, items) {
    var placements = [];
    var gap = getLabelBarItemGapPx();
    var lionSpec = buildLabelBarSvgSpec(
      getLabelBarEndCapSvgFile(),
      endCapArea.height
    );
    var leftWordSpec = buildLabelBarSvgSpec(
      getLabelBarLeftLionInnerRow1SvgFile(),
      area.height
    );
    var sunSpec = buildLabelBarSvgSpec(
      getLabelBarLeftLionInnerRow1SunSvgFile(),
      area.height
    );
    var ageSpec = buildLabelBarSvgSpec(getLabelBarAgeSvgFile(), area.height);
    var ageLabelSpec = ageSpec ? buildLabelBarAgeLabelSpec(area) : null;
    var rightWordSpec = buildLabelBarSvgSpec(
      getLabelBarRightLionInnerRow2SvgFile(),
      row2Area ? row2Area.height : area.height
    );
    var livingRowArea = row2Area || area;
    var livingFile = getLivingIranLabelSvgFile();
    var livingSpec = livingFile
      ? buildLabelBarSvgSpec(livingFile, livingRowArea.height)
      : null;
    var fromSpec = buildLabelBarSvgSpec(
      getLabelBarFromSvgFile(),
      livingRowArea.height
    );
    var fromTextSpec = buildLabelBarProfileFieldTextSpec(
      getProfileFromText(),
      livingRowArea
    );
    var nowInSpec = buildLabelBarSvgSpec(
      getLabelBarNowInSvgFile(),
      livingRowArea.height
    );
    var nowInTextSpec = buildLabelBarProfileFieldTextSpec(
      getProfileNowInText(),
      livingRowArea
    );
    var barcodeSpec = buildLabelBarSvgSpec(
      getLabelBarBarcodeSvgFile(),
      livingRowArea.height
    );
    var leftSignSpec = buildLabelBarSvgSpec(
      getLabelBarLeftSvgFile(),
      livingRowArea.height
    );
    var womenSpec = buildLabelBarSvgSpec(
      getLabelBarWomenSvgFile(),
      livingRowArea.height
    );
    var lostFile = getLostLabelSvgFile();
    var lostSpec = lostFile
      ? buildLabelBarSvgSpec(lostFile, area.height)
      : null;
    var lostLabelSpec = lostSpec ? buildLabelBarLostLabelSpec(area) : null;
    var centerSpecs = buildLabelBarItemSpecs(
      filterLabelBarCenterItems(items),
      area.width,
      area.height,
      area.y,
      area.y + area.height
    );
    var leftX;
    var rightX;
    var rowSpanStart;
    var rowSpanEnd;
    var row1Clusters;
    var row2Clusters;
    var centerCluster;
    var ci;

    if (!lionSpec) {
      if (!centerSpecs.length) return placements;
      rowSpanStart = area.x + area.hInset;
      rowSpanEnd = area.x + area.width - area.hInset;
      row1Clusters = [];
      for (ci = 0; ci < centerSpecs.length; ci++) {
        centerCluster = buildLabelBarCluster([{ spec: centerSpecs[ci] }]);
        if (centerCluster) row1Clusters.push(centerCluster);
      }
      return layoutLabelBarRowClusters(row1Clusters, rowSpanStart, rowSpanEnd, area);
    }

    leftX = area.x + area.hInset;
    rightX = area.x + area.width - area.hInset - lionSpec.width;
    rowSpanStart = leftX + lionSpec.width + gap;
    rowSpanEnd = rightX - gap;

    function pushRowCluster(list, cluster) {
      if (cluster) list.push(cluster);
    }

    row1Clusters = [];
    pushRowCluster(
      row1Clusters,
      buildLabelBarCluster([
        leftWordSpec ? { spec: leftWordSpec, svgArea: area } : null,
      ])
    );
    pushRowCluster(
      row1Clusters,
      buildLabelBarCluster([sunSpec ? { spec: sunSpec, svgArea: area } : null])
    );
    pushRowCluster(
      row1Clusters,
      buildLabelBarCluster([barcodeSpec ? { spec: barcodeSpec, svgArea: area } : null])
    );
    pushRowCluster(
      row1Clusters,
      buildLabelBarCluster([
        ageLabelSpec ? { spec: ageLabelSpec, svgArea: area } : null,
        ageSpec
          ? {
              spec: ageSpec,
              svgArea: area,
              ageOverlayText: getProfileAgeText(),
            }
          : null,
      ])
    );
    for (ci = 0; ci < centerSpecs.length; ci++) {
      pushRowCluster(
        row1Clusters,
        buildLabelBarCluster([{ spec: centerSpecs[ci] }])
      );
    }
    pushRowCluster(
      row1Clusters,
      buildLabelBarCluster([
        lostLabelSpec ? { spec: lostLabelSpec, svgArea: area } : null,
        lostSpec ? { spec: lostSpec, svgArea: area } : null,
      ])
    );

    row2Clusters = [];
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([{ spec: livingSpec, svgArea: livingRowArea }])
    );
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([
        fromSpec ? { spec: fromSpec, svgArea: livingRowArea } : null,
        fromTextSpec ? { spec: fromTextSpec, svgArea: livingRowArea } : null,
      ])
    );
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([
        nowInSpec ? { spec: nowInSpec, svgArea: livingRowArea } : null,
        nowInTextSpec ? { spec: nowInTextSpec, svgArea: livingRowArea } : null,
      ])
    );
    var leavingYearText = getProfileLeavingYearText();
    var leavingYearTextSpec = leavingYearText
      ? buildLabelBarProfileFieldTextSpec(leavingYearText, livingRowArea)
      : null;
    var showLeavingYearRow =
      typeof window.IdentityControls !== "undefined" &&
      window.IdentityControls.getLivingInIran &&
      window.IdentityControls.getLivingInIran() === true;
    if (showLeavingYearRow) {
      pushRowCluster(
        row2Clusters,
        buildLabelBarCluster([
          leftSignSpec ? { spec: leftSignSpec, svgArea: livingRowArea } : null,
          leavingYearTextSpec
            ? { spec: leavingYearTextSpec, svgArea: livingRowArea }
            : null,
        ])
      );
    }
    var nameText = getProfileNameText();
    var nameTextSpec = nameText
      ? buildLabelBarProfileFieldTextSpec(nameText, livingRowArea)
      : null;
    if (nameTextSpec) {
      pushRowCluster(
        row2Clusters,
        buildLabelBarCluster([{ spec: nameTextSpec, svgArea: livingRowArea }])
      );
    }
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([womenSpec ? { spec: womenSpec, svgArea: livingRowArea } : null])
    );
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([{ spec: rightWordSpec, svgArea: row2Area || area }])
    );

    placements.push({
      spec: lionSpec,
      x: leftX,
      mirror: false,
      svgArea: endCapArea,
    });
    placements = placements.concat(
      layoutLabelBarRowClusters(row1Clusters, rowSpanStart, rowSpanEnd, area)
    );
    placements = placements.concat(
      layoutLabelBarRowClusters(
        row2Clusters,
        rowSpanStart,
        rowSpanEnd,
        livingRowArea
      )
    );
    placements.push({
      spec: lionSpec,
      x: rightX,
      mirror: true,
      svgArea: endCapArea,
    });
    return placements;
  }

  function appendLabelBarSvgTintedGroup(container, placement, area, mirror) {
    var spec = placement.spec;
    var tintedMarkup = getLabelBarSvgTintedInnerMarkup(spec.file);
    var parser;
    var doc;
    var g;
    var child;
    var ix;
    var scaleX;
    if (!tintedMarkup) return false;

    ix = placement.x;
    scaleX = mirror ? -spec.scale : spec.scale;
    g = elSvg("g");
    g.setAttribute(
      "transform",
      "translate(" +
        (mirror ? ix + spec.width : ix) +
        "," +
        area.y +
        ") scale(" +
        scaleX +
        "," +
        spec.scale +
        ")"
    );
    parser = new DOMParser();
    doc = parser.parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg">' + tintedMarkup + "</svg>",
      "image/svg+xml"
    );
    while ((child = doc.documentElement.firstChild)) {
      g.appendChild(child);
    }
    container.appendChild(g);
    return true;
  }

  function appendLabelBarSvgPlacement(container, placement, area) {
    var spec = placement.spec;
    var ix = placement.x;
    var mirror = placement.mirror;
    var img;
    var wrap;

    if (
      !labelBarSvgUsesNativeColors(spec.file) &&
      appendLabelBarSvgTintedGroup(container, placement, area, mirror)
    ) {
      return;
    }

    if (mirror) {
      wrap = elSvg("g");
      wrap.setAttribute(
        "transform",
        "translate(" + (ix + spec.width) + "," + area.y + ") scale(-1, 1)"
      );
      img = elSvg("image");
      img.setAttribute("x", "0");
      img.setAttribute("y", "0");
    } else {
      wrap = container;
      img = elSvg("image");
      img.setAttribute("x", String(ix));
      img.setAttribute("y", String(area.y));
    }

    setSvgImageHref(img, getLabelBarSvgHref(spec.file));
    img.setAttribute("width", String(spec.width));
    img.setAttribute("height", String(spec.height));
    img.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (!labelBarSvgUsesNativeColors(spec.file)) {
      img.setAttribute("style", "filter:" + getLabelBarIconFilterStyle());
    }
    wrap.appendChild(img);
    if (mirror) container.appendChild(wrap);
  }

  function appendLabelBarPlacement(rowG, placement, defaultArea, flipVertical) {
    var spec = placement.spec;
    var contentArea = placement.svgArea || defaultArea;
    var itemG = elSvg("g");
    var text;
    var mount = itemG;

    itemG.setAttribute("class", "label-bar-item");
    if (spec.type === "text") {
      text = elSvg("text");
      text.setAttribute("x", String(placement.x));
      text.setAttribute("y", String(getLabelBarTextY(contentArea)));
      applyLabelBarTextAttrs(text, spec.fontSize);
      text.textContent = spec.text;
      itemG.appendChild(text);
    } else if (spec.type === "svg") {
      appendLabelBarSvgPlacement(itemG, placement, contentArea);
      appendLabelBarAgeOverlayText(itemG, placement, contentArea);
    } else if (spec.type === "square") {
      var square = elSvg("rect");
      square.setAttribute("x", String(placement.x));
      square.setAttribute("y", String(getLabelBarSquareSepY(contentArea)));
      square.setAttribute("width", String(spec.width));
      square.setAttribute("height", String(spec.height));
      square.setAttribute("fill", getLabelBarSymbolSeparatorFill());
      itemG.appendChild(square);
    }

    if (flipVertical) {
      mount = elSvg("g");
      mount.setAttribute("transform", getLabelBarVerticalFlipTransform(contentArea));
      mount.appendChild(itemG);
    }
    rowG.appendChild(mount);
  }

  function pushLabelBarSvgPlacementExport(edgeLines, placement, area) {
    var spec = placement.spec;
    var ix = placement.x;
    var mirror = placement.mirror;
    var whiteMarkup = getLabelBarSvgTintedInnerMarkup(spec.file);
    var scaleX = mirror ? -spec.scale : spec.scale;
    var filterStyle = labelBarSvgUsesNativeColors(spec.file)
      ? ""
      : ' style="filter:' + getLabelBarIconFilterStyle() + '"';

    if (whiteMarkup) {
      edgeLines.push(
        '<g transform="translate(' +
          (mirror ? ix + spec.width : ix) +
          " " +
          area.y +
          ") scale(" +
          scaleX +
          " " +
          spec.scale +
          ')">' +
          whiteMarkup +
          "</g>"
      );
      return;
    }

    if (mirror) {
      edgeLines.push(
        '<g transform="translate(' +
          (ix + spec.width) +
          "," +
          area.y +
          ') scale(-1,1)"><image href="' +
          getLabelBarSvgHref(spec.file) +
          '" x="0" y="0" width="' +
          spec.width +
          '" height="' +
          spec.height +
          '" preserveAspectRatio="xMidYMid meet"' +
          filterStyle +
          "/></g>"
      );
      return;
    }

    edgeLines.push(
      '<image href="' +
        getLabelBarSvgHref(spec.file) +
        '" x="' +
        ix +
        '" y="' +
        area.y +
        '" width="' +
        spec.width +
        '" height="' +
        spec.height +
        '" preserveAspectRatio="xMidYMid meet"' +
        filterStyle +
        "/>"
    );
  }

  /**
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @param {{ type: "svg" | "text", svgFile: string, text: string }[]} items
   * @returns {SVGElement | null}
   */
  function createLabelBarRowGroup(edge, layout, items) {
    var area = getLabelBarInnerSegmentContentArea(edge, layout, 0);
    var row2Area = getLabelBarInnerSegmentContentArea(edge, layout, 1);
    var endCapArea = getLabelBarEndCapContentArea(edge, layout);
    var placements = computeLabelBarPlacements(area, endCapArea, row2Area, items);
    var rowG;
    var pi;

    if (!placements.length) return null;

    rowG = elSvg("g");
    rowG.setAttribute("data-edge", edge);

    for (pi = 0; pi < placements.length; pi++) {
      appendLabelBarPlacement(
        rowG,
        placements[pi],
        area,
        labelBarEdgeContentFlippedVertically(edge)
      );
    }

    return rowG;
  }

  function appendLabelBarContent(g) {
    var items = getLabelBarItems();
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var bottomRow = createLabelBarRowGroup("bottom", bottomLayout, items);
    var topRow = createLabelBarRowGroup("top", topLayout, items);
    if (bottomRow) g.appendChild(bottomRow);
    if (topRow) g.appendChild(topRow);
  }

  function refreshLabelBarContent() {
    if (!designSvg) return;
    var group = designSvg.querySelector("#edge-brown-bar-label-content");
    if (!group) return;

    var render = function () {
      while (group.firstChild) group.removeChild(group.firstChild);
      appendLabelBarContent(group);
      if (typeof updateMagnifierViewBox === "function") {
        updateMagnifierViewBox();
      }
      preloadLabelBarSvgAssetsForExport().then(function () {
        if (!designSvg) return;
        var labelGroup = designSvg.querySelector("#edge-brown-bar-label-content");
        if (!labelGroup) return;
        while (labelGroup.firstChild) labelGroup.removeChild(labelGroup.firstChild);
        appendLabelBarContent(labelGroup);
        if (typeof updateMagnifierViewBox === "function") {
          updateMagnifierViewBox();
        }
      });
    };

    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(render);
    } else {
      render();
    }
  }

  function preloadLabelBarSvgAssetsForExport() {
    var items = getLabelBarItems();
    var files = [
      getLabelBarEndCapSvgFile(),
      getLabelBarLivingInIranSvgFile(),
      getLabelBarLivingOutsideIranSvgFile(),
      getLabelBarFromSvgFile(),
      getLabelBarNowInSvgFile(),
      getLabelBarBarcodeSvgFile(),
      getLabelBarLeftSvgFile(),
      getLabelBarWomenSvgFile(),
      getLabelBarLeftLionInnerRow1SvgFile(),
      getLabelBarLeftLionInnerRow1SunSvgFile(),
      getLabelBarAgeSvgFile(),
      getLabelBarRightLionInnerRow2SvgFile(),
      getLabelBarLostInnerSvgFile(),
      getLabelBarLostMiddleSvgFile(),
      getLabelBarLostDistantSvgFile(),
    ];
    var i;
    for (i = 0; i < items.length; i++) {
      if (
        items[i].type === "svg" &&
        items[i].svgFile &&
        files.indexOf(items[i].svgFile) < 0
      ) {
        files.push(items[i].svgFile);
      }
    }
    if (!files.length) return Promise.resolve();
    return Promise.all(
      files.map(function (name) {
        return ensureLabelBarSvgAsset(name);
      })
    ).catch(function () {
      return [];
    });
  }

  function refreshBrownBarBannerAfterMount() {
    refreshLabelBarContent();
  }

  function createBrownBarBannerTextGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "edge-brown-bar-label-content");
    appendLabelBarContent(g);
    return g;
  }

  /**
   * @param {number} innerRelY
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @returns {number}
   */
  function getBrownBarCanvasYFromInnerRel(innerRelY, edge, layout) {
    if (edge === "bottom") {
      return getBottomBrownBarCanvasY(innerRelY, layout);
    }
    return getTopBrownBarMirroredCanvasY(innerRelY, layout);
  }

  /**
   * @param {number} row 0 = top of grid band
   * @param {number} col 0..10
   * @returns {boolean}
   */
  function isOuterThirdGridCellBrownFill(row, col) {
    if (row === 1) {
      return col % 2 === 1;
    }
    return col % 2 === 0;
  }

  function getBrownBarOuterThirdGridInsetPx() {
    return typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_INSET_PX !== "undefined"
      ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_INSET_PX
      : 0;
  }

  function getBrownBarOuterThirdGridInsetTopPx() {
    return typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_INSET_TOP_PX !== "undefined"
      ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_INSET_TOP_PX
      : getBrownBarOuterThirdGridInsetPx();
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number }} bottomLayout
   * @returns {string}
   */
  function brownBarGridLayoutSignature(bottomLayout) {
    return [
      bottomLayout.x,
      bottomLayout.y,
      bottomLayout.width,
      bottomLayout.height,
      typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES
        : 10,
      typeof CANVAS_EDGE_BROWN_BAR_GRID_MIN_COL_WIDTH_PX !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_MIN_COL_WIDTH_PX
        : 10,
      typeof CANVAS_EDGE_BROWN_BAR_GRID_MAX_MIN_COL_FRACTION !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_MAX_MIN_COL_FRACTION
        : 0.2,
      typeof CANVAS_EDGE_BROWN_BAR_GRID_WIDTH_RANDOM_POWER !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_WIDTH_RANDOM_POWER
        : 3.2,
      typeof CANVAS_EDGE_BROWN_BAR_GRID_ROW_RATIOS !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_ROW_RATIOS.join(",")
        : "0.4,0.4,0.2",
      getBrownBarOuterThirdGridInsetPx(),
      getBrownBarOuterThirdGridInsetTopPx(),
    ].join("|");
  }

  /**
   * @param {number} total
   * @param {number[]} ratios
   * @returns {number[]}
   */
  function distributeLengthsByRatios(total, ratios) {
    var count = ratios.length;
    var sumR = 0;
    var lengths = [];
    var used = 0;
    var i;
    var len;
    for (i = 0; i < count; i++) {
      sumR += ratios[i];
    }
    for (i = 0; i < count; i++) {
      if (i === count - 1) {
        len = total - used;
      } else {
        len = Math.round((ratios[i] / sumR) * total);
      }
      lengths.push(len);
      used += len;
    }
    lengths[count - 1] += total - used;
    return lengths;
  }

  /**
   * @param {number} colCount
   * @param {number} pickCount
   * @returns {number[]}
   */
  function pickRandomBrownBarGridColumnIndices(colCount, pickCount) {
    var pool = [];
    var i;
    var j;
    var picked = [];
    for (i = 0; i < colCount; i++) pool.push(i);
    for (i = 0; i < pickCount; i++) {
      j = Math.floor(Math.random() * pool.length);
      picked.push(pool[j]);
      pool.splice(j, 1);
    }
    return picked;
  }

  /**
   * Split total width across count columns (each >= minEach) using skewed random weights.
   * @param {number} count
   * @param {number} total
   * @param {number} minEach
   * @param {number} widthPower
   * @returns {number[]}
   */
  function distributeSkewedColumnWidths(count, total, minEach, widthPower) {
    var remaining = total - minEach * count;
    var weights = [];
    var wSum = 0;
    var i;
    var widths = [];
    var extraUsed = 0;
    var extra;
    for (i = 0; i < count; i++) {
      weights.push(Math.pow(Math.random(), widthPower));
      wSum += weights[i];
    }
    for (i = 0; i < count; i++) {
      if (i === count - 1) {
        extra = remaining - extraUsed;
      } else {
        extra = Math.round((weights[i] / wSum) * remaining);
        extra = Math.max(0, Math.min(extra, remaining - extraUsed));
      }
      widths.push(minEach + extra);
      extraUsed += extra;
    }
    widths[count - 1] += remaining - extraUsed;
    return widths;
  }

  /**
   * Random column widths: min 10px; at most 1/5 of columns at minimum, rest wider.
   * @param {number} x0
   * @param {number} x1
   * @param {number} colCount
   * @returns {number[]}
   */
  function buildRandomBrownBarGridXBounds(x0, x1, colCount) {
    var totalW = x1 - x0;
    var minColW =
      typeof CANVAS_EDGE_BROWN_BAR_GRID_MIN_COL_WIDTH_PX !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_MIN_COL_WIDTH_PX
        : 10;
    var maxMinFraction =
      typeof CANVAS_EDGE_BROWN_BAR_GRID_MAX_MIN_COL_FRACTION !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_MAX_MIN_COL_FRACTION
        : 0.2;
    var widthPower =
      typeof CANVAS_EDGE_BROWN_BAR_GRID_WIDTH_RANDOM_POWER !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_WIDTH_RANDOM_POWER
        : 3.2;
    var maxMinCols = Math.max(0, Math.floor(colCount * maxMinFraction));
    var narrowCount = Math.floor(Math.random() * (maxMinCols + 1));
    var i;
    var flexCount;
    var flexTotal;

    while (
      narrowCount > 0 &&
      totalW - minColW * narrowCount < minColW * (colCount - narrowCount)
    ) {
      narrowCount--;
    }

    var widths = [];
    var flexIndices = [];
    var narrowSet = {};
    var narrowIndices = pickRandomBrownBarGridColumnIndices(colCount, narrowCount);
    var fi;
    var flexWidths;
    var usedW = 0;

    for (i = 0; i < colCount; i++) {
      widths.push(0);
    }
    for (i = 0; i < narrowIndices.length; i++) {
      narrowSet[narrowIndices[i]] = true;
    }
    for (i = 0; i < colCount; i++) {
      if (narrowSet[i]) {
        widths[i] = minColW;
        usedW += minColW;
      } else {
        flexIndices.push(i);
      }
    }

    flexCount = flexIndices.length;
    flexTotal = totalW - usedW;
    if (flexCount > 0) {
      var flexMin = minColW + 1;
      if (flexMin * flexCount > flexTotal) {
        flexMin = minColW;
      }
      flexWidths = distributeSkewedColumnWidths(
        flexCount,
        flexTotal,
        flexMin,
        widthPower
      );
      for (fi = 0; fi < flexCount; fi++) {
        widths[flexIndices[fi]] = flexWidths[fi];
        usedW += flexWidths[fi];
      }
    }

    widths[colCount - 1] += totalW - usedW;

    var xBounds = [x0];
    var x = x0;
    for (i = 0; i < colCount; i++) {
      x += widths[i];
      xBounds.push(x);
    }
    xBounds[colCount] = x1;
    return xBounds;
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number }} bottomLayout
   * @returns {number[]}
   */
  function ensureBrownBarGridXBounds(bottomLayout) {
    var sig = brownBarGridLayoutSignature(bottomLayout);
    if (cachedBrownBarGridXBounds && lastBrownBarGridLayoutSignature === sig) {
      return cachedBrownBarGridXBounds;
    }
    var vCount =
      typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES
        : 10;
    var inset = getBrownBarOuterThirdGridInsetPx();
    var x0 = Math.round(bottomLayout.x) + inset;
    var x1 = Math.round(bottomLayout.x + bottomLayout.width) - inset;
    cachedBrownBarGridXBounds = buildRandomBrownBarGridXBounds(
      x0,
      x1,
      vCount + 1
    );
    lastBrownBarGridLayoutSignature = sig;
    return cachedBrownBarGridXBounds;
  }

  /**
   * Pixel-snapped row edges; columns use random widths (shared on top/bottom bars).
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @returns {{ xBounds: number[], yBounds: number[] }}
   */
  function getOuterThirdGridAxisBounds(edge, layout) {
    var hCount =
      typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_HORIZONTAL_LINES !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_HORIZONTAL_LINES
        : 2;
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var xBounds = ensureBrownBarGridXBounds(bottomLayout);
    var section = getBrownBarOuterThirdInnerRelBounds(layout.height);
    var yStart = getBrownBarCanvasYFromInnerRel(section.start, edge, layout);
    var yEnd = getBrownBarCanvasYFromInnerRel(section.end, edge, layout);
    var insetOuter = getBrownBarOuterThirdGridInsetPx();
    var insetInner = getBrownBarOuterThirdGridInsetTopPx();
    var yInner =
      edge === "bottom"
        ? Math.round(Math.min(yStart, yEnd))
        : Math.round(Math.max(yStart, yEnd));
    var yOuter =
      edge === "bottom"
        ? Math.round(Math.max(yStart, yEnd))
        : Math.round(Math.min(yStart, yEnd));
    var yTop;
    var yBottom;
    if (edge === "bottom") {
      yTop = yInner + insetInner;
      yBottom = yOuter - insetOuter;
    } else {
      yTop = yOuter + insetOuter;
      yBottom = yInner - insetInner;
    }
    var totalH = Math.max(0, yBottom - yTop);
    var rowCount = hCount + 1;
    var defaultRowRatios = [0.4, 0.4, 0.2];
    var rowRatios =
      typeof CANVAS_EDGE_BROWN_BAR_GRID_ROW_RATIOS !== "undefined" &&
      CANVAS_EDGE_BROWN_BAR_GRID_ROW_RATIOS.length === rowCount
        ? CANVAS_EDGE_BROWN_BAR_GRID_ROW_RATIOS
        : defaultRowRatios;
    var rowHeights = distributeLengthsByRatios(totalH, rowRatios);
    var yBounds = [yTop];
    var r;
    var y = yTop;
    for (r = 0; r < rowCount; r++) {
      y += rowHeights[r];
      yBounds.push(y);
    }
    yBounds[rowCount] = yBottom;
    return { xBounds: xBounds, yBounds: yBounds };
  }

  function getOuterThirdGridCellRect(edge, layout, row, col) {
    var axis = getOuterThirdGridAxisBounds(edge, layout);
    return {
      x: axis.xBounds[col],
      y: axis.yBounds[row],
      width: axis.xBounds[col + 1] - axis.xBounds[col],
      height: axis.yBounds[row + 1] - axis.yBounds[row],
    };
  }

  /**
   * White + alternating brown cells in outer-third grid (bottom canonical, top mirrored).
   * @param {SVGElement} g
   */
  function appendCanvasEdgeBrownBarOuterThirdGridFills(g) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var vCount =
      typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES
        : 10;
    var hCount =
      typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_HORIZONTAL_LINES !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_HORIZONTAL_LINES
        : 2;
    var edges = ["bottom", "top"];
    var ei;
    var edge;
    var layout;
    var row;
    var col;
    var cell;
    var fill;

    for (ei = 0; ei < edges.length; ei++) {
      edge = edges[ei];
      layout = edge === "bottom" ? bottomLayout : topLayout;
      for (row = 0; row <= hCount; row++) {
        for (col = 0; col <= vCount; col++) {
          cell = getOuterThirdGridCellRect(edge, layout, row, col);
          fill = isOuterThirdGridCellBrownFill(row, col)
            ? getCheckerboardDarkColor()
            : getCheckerboardLightColor();
          appendBrownBarGridCellFillRect(g, cell, fill);
        }
      }
    }
  }

  function createCanvasEdgeBrownBarDivisionsGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "edge-brown-bar-divisions");
    var fills = elSvg("g");
    fills.setAttribute("id", "edge-brown-bar-grid-fills");
    fills.setAttribute("stroke", "none");
    appendCanvasEdgeBrownBarOuterThirdGridFills(fills);
    g.appendChild(fills);
    return g;
  }

  function populateEdgeBrownBarsLayer(g) {
    g.appendChild(createCanvasEdgeBrownBarRect("top"));
    g.appendChild(createCanvasEdgeBrownBarRect("bottom"));
    g.appendChild(createCanvasEdgeBrownBarDivisionsGroup());
  }

  function updateCanvasEdgeBrownBars() {
    if (!designSvg) return;
    var top = designSvg.querySelector("#top-brown-bar");
    var bottom = designSvg.querySelector("#bottom-brown-bar");
    if (top) applyCanvasEdgeBrownBarAttrs(top, "top");
    if (bottom) applyCanvasEdgeBrownBarAttrs(bottom, "bottom");
    var divGroup = designSvg.querySelector("#edge-brown-bar-divisions");
    if (divGroup) {
      while (divGroup.firstChild) divGroup.removeChild(divGroup.firstChild);
      var fills = elSvg("g");
      fills.setAttribute("id", "edge-brown-bar-grid-fills");
      fills.setAttribute("stroke", "none");
      appendCanvasEdgeBrownBarOuterThirdGridFills(fills);
      divGroup.appendChild(fills);
    }
    var bannerGroup = designSvg.querySelector("#edge-brown-bar-label-content");
    if (bannerGroup) {
      refreshLabelBarContent();
    }
    updateCanvasEdgeSerialLayer();
  }

  function pushCanvasEdgeBrownBarExportLines(lines) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");

    lines.push(
      '<rect id="bottom-brown-bar" x="' +
        bottomLayout.x +
        '" y="' +
        bottomLayout.y +
        '" width="' +
        bottomLayout.width +
        '" height="' +
        bottomLayout.height +
        '" fill="' +
        getLabelBarBackgroundColor() +
        '" stroke="none"/>'
    );
    lines.push(
      '<rect id="top-brown-bar" x="' +
        topLayout.x +
        '" y="' +
        topLayout.y +
        '" width="' +
        topLayout.width +
        '" height="' +
        topLayout.height +
        '" fill="' +
        getLabelBarBackgroundColor() +
        '" stroke="none"/>'
    );

    lines.push('<g id="edge-brown-bar-grid-fills" stroke="none">');
    pushCanvasEdgeBrownBarOuterThirdGridFillsExport(lines);
    lines.push("</g>");
    pushCanvasEdgeBrownBarBannerTextExport(lines);
  }

  function pushCanvasEdgeSerialDigitCirclesExport(
    lines,
    centerX,
    centerY,
    digit,
    r,
    gap,
    fill
  ) {
    var count = Math.max(0, Math.min(9, Math.floor(digit)));
    var step = 2 * r + gap;
    var totalWidth = count * 2 * r + (count - 1) * gap;
    var startX = centerX - totalWidth / 2 + r;
    var ci;

    for (ci = 0; ci < count; ci++) {
      lines.push(
        '<circle cx="' +
          (startX + ci * step) +
          '" cy="' +
          centerY +
          '" r="' +
          r +
          '" fill="' +
          fill +
          '" stroke="none"/>'
      );
    }
  }

  function pushCanvasEdgeSerialExport(lines) {
    var serial = ensureCanvasEdgeSerial();
    var strips = [
      getCanvasEdgeSerialStripLayout("top"),
      getCanvasEdgeSerialStripLayout("bottom"),
    ];
    var fill = getCanvasEdgeSerialFill();
    var si;
    var strip;
    var xs;
    var metrics;
    var centerY;
    var i;
    var digit;

    lines.push('<g id="layer-edge-serial" fill="' + fill + '" stroke="none">');
    for (si = 0; si < strips.length; si++) {
      strip = strips[si];
      if (strip.height <= 0) continue;
      xs = getCanvasEdgeSerialDigitXPositions(strip.width);
      metrics = getCanvasEdgeSerialCircleMetrics(strip);
      if (metrics.r <= 0) continue;
      centerY = strip.y + strip.height / 2;
      for (i = 0; i < serial.length && i < xs.length; i++) {
        digit = parseInt(serial.charAt(i), 10);
        if (isNaN(digit)) continue;
        pushCanvasEdgeSerialDigitCirclesExport(
          lines,
          strip.x + xs[i],
          centerY,
          digit,
          metrics.r,
          metrics.gap,
          fill
        );
      }
    }
    lines.push("</g>");
  }

  function pushCanvasEdgeBrownBarBannerTextExport(lines) {
    var items = getLabelBarItems();
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var edges = [
      ["bottom", bottomLayout],
      ["top", topLayout],
    ];
    var rowMarkup = [];
    var ei;
    var edge;
    var layout;
    var placements;
    var pi;
    var placement;
    var edgeLines;

    for (ei = 0; ei < edges.length; ei++) {
      edge = edges[ei][0];
      layout = edges[ei][1];
      var area = getLabelBarInnerSegmentContentArea(edge, layout, 0);
      var row2Area = getLabelBarInnerSegmentContentArea(edge, layout, 1);
      var endCapArea = getLabelBarEndCapContentArea(edge, layout);
      placements = computeLabelBarPlacements(area, endCapArea, row2Area, items);
      if (!placements.length) continue;
      edgeLines = ['<g data-edge="' + edge + '">'];
      for (pi = 0; pi < placements.length; pi++) {
        placement = placements[pi];
        var placementArea = placement.svgArea || area;
        var flipVertical = labelBarEdgeContentFlippedVertically(edge);
        if (flipVertical) {
          edgeLines.push(
            '<g transform="' + getLabelBarVerticalFlipTransform(placementArea) + '">'
          );
        }
        if (placement.spec.type === "text") {
          edgeLines.push(
            '<text x="' +
              placement.x +
              '" y="' +
              getLabelBarTextY(placementArea) +
              '" fill="' +
              getBrownBarBannerFill() +
              '" font-family="' +
              getBrownBarBannerFontFamily() +
              ', sans-serif" font-weight="700" font-size="' +
              placement.spec.fontSize +
              '" letter-spacing="' +
              getBrownBarBannerLetterSpacing() +
              '" text-anchor="start" dominant-baseline="middle" alignment-baseline="middle">' +
              placement.spec.text +
              "</text>"
          );
        } else if (placement.spec.type === "svg") {
          pushLabelBarSvgPlacementExport(
            edgeLines,
            placement,
            placementArea
          );
          pushLabelBarAgeOverlayTextExport(
            edgeLines,
            placement,
            placementArea
          );
        } else if (placement.spec.type === "square") {
          edgeLines.push(
            '<rect x="' +
              placement.x +
              '" y="' +
              getLabelBarSquareSepY(placementArea) +
              '" width="' +
              placement.spec.width +
              '" height="' +
              placement.spec.height +
              '" fill="' +
              getLabelBarSymbolSeparatorFill() +
              '"/>'
          );
        }
        if (flipVertical) {
          edgeLines.push("</g>");
        }
      }
      edgeLines.push("</g>");
      rowMarkup = rowMarkup.concat(edgeLines);
    }

    if (!rowMarkup.length) return;

    lines.push('<g id="edge-brown-bar-label-content">');
    lines.push.apply(lines, rowMarkup);
    lines.push("</g>");
  }

  function pushCanvasEdgeBrownBarOuterThirdGridFillsExport(lines) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var vCount =
      typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES
        : 10;
    var hCount =
      typeof CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_HORIZONTAL_LINES !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_HORIZONTAL_LINES
        : 2;
    var edges = ["bottom", "top"];
    var ei;
    var edge;
    var layout;
    var row;
    var col;
    var cell;
    var fill;

    for (ei = 0; ei < edges.length; ei++) {
      edge = edges[ei];
      layout = edge === "bottom" ? bottomLayout : topLayout;
      for (row = 0; row <= hCount; row++) {
        for (col = 0; col <= vCount; col++) {
          cell = getOuterThirdGridCellRect(edge, layout, row, col);
          fill = isOuterThirdGridCellBrownFill(row, col)
            ? getCheckerboardDarkColor()
            : getCheckerboardLightColor();
          lines.push(
            '<rect x="' +
              cell.x +
              '" y="' +
              cell.y +
              '" width="' +
              cell.width +
              '" height="' +
              cell.height +
              '" fill="' +
              fill +
              '" stroke="none" shape-rendering="crispEdges"/>'
          );
        }
      }
    }
  }

  function updateBorderDivisionLines() {
    if (!designSvg) return;
    syncBorderSideWhiteCells(false);
    ensureBorderSideWhiteInnerShadowDefs(designSvg.querySelector("defs"));
    var g = designSvg.querySelector("#layer-border-divisions");
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    appendBorderDivisionLayersToGroup(g);
  }

  /**
   * @param {string[]} lines
   */
  function pushBorderDivisionExportLines(lines) {
    var b = getCanvasBorderPx();
    var i;
    var y;

    syncBorderSideWhiteCells(false);

    lines.push(
      '<g id="layer-border-divisions" fill="none" stroke="' +
        getBorderDivisionStrokeColor() +
        '" stroke-width="' +
        BORDER_DIVISION_STROKE_WIDTH +
        '">'
    );

    var home = isBodyAutonomyHomeChecked();
    var outside = isBodyAutonomyOutsideChecked();
    var yBounds = getLeftRightBorderCellYBounds();
    var j;
    var yTop;
    var yBottom;
    var h;
    var cellType;
    var rightX = CANVAS_W - b;
    if (home || outside) {
      for (j = 0; j < yBounds.length - 1; j++) {
        yTop = yBounds[j];
        yBottom = yBounds[j + 1];
        h = yBottom - yTop;
        cellType = getBorderSideCellType(j);
        if (isBorderSideCellWhitened(0, j)) {
          var whiteFill = getCanvasBackgroundColor();
          lines.push(
            '<rect x="0" y="' +
              yTop +
              '" width="' +
              b +
              '" height="' +
              h +
              '" fill="' +
              whiteFill +
              '"/>'
          );
          lines.push(
            '<rect x="' +
              rightX +
              '" y="' +
              yTop +
              '" width="' +
              b +
              '" height="' +
              h +
              '" fill="' +
              whiteFill +
              '"/>'
          );
          pushBorderSideWhitenedCellInnerShadowAtXExport(lines, 0, b, yTop, yBottom);
          pushBorderSideWhitenedCellInnerShadowAtXExport(
            lines,
            rightX,
            b,
            yTop,
            yBottom
          );
          continue;
        }
        if (cellType === "outside") {
          if (!outside) continue;
          pushBorderSideBrownCellXPatternExport(lines, 0, b, yTop, yBottom);
          pushBorderSideBrownCellXPatternExport(lines, rightX, b, yTop, yBottom);
        } else if (cellType === "grey") {
          if (!home || !outside) continue;
          lines.push(
            '<rect x="0" y="' +
              yTop +
              '" width="' +
              b +
              '" height="' +
              h +
              '" fill="' +
              BORDER_SIDE_CELL_COLOR_GREY +
              '"/>'
          );
          lines.push(
            '<rect x="' +
              rightX +
              '" y="' +
              yTop +
              '" width="' +
              b +
              '" height="' +
              h +
              '" fill="' +
              BORDER_SIDE_CELL_COLOR_GREY +
              '"/>'
          );
        } else if (cellType === "beige") {
          if (!home || !outside) continue;
          var beigeFillExport =
            typeof BORDER_SIDE_CELL_COLOR_BEIGE !== "undefined"
              ? BORDER_SIDE_CELL_COLOR_BEIGE
              : BORDER_SIDE_X_FILL_RIGHT;
          lines.push(
            '<rect x="0" y="' +
              yTop +
              '" width="' +
              b +
              '" height="' +
              h +
              '" fill="' +
              beigeFillExport +
              '"/>'
          );
          lines.push(
            '<rect x="' +
              rightX +
              '" y="' +
              yTop +
              '" width="' +
              b +
              '" height="' +
              h +
              '" fill="' +
              beigeFillExport +
              '"/>'
          );
        } else {
          if (!home) continue;
          pushBorderSideBlueCellXPatternExport(lines, 0, b, yTop, yBottom);
          pushBorderSideBlueCellXPatternExport(lines, rightX, b, yTop, yBottom);
        }
      }
    }

    if (home && outside) {
      var rhombusFill;
      for (j = 0; j < yBounds.length - 1; j++) {
        cellType = getBorderSideCellType(j);
        if (!isBorderSideSolidColorOnlyCell(cellType, home, outside)) continue;
        if (isBorderSideCellWhitened(0, j)) continue;
        yTop = yBounds[j];
        yBottom = yBounds[j + 1];
        rhombusFill = getBorderSideRhombusFillForCellType(cellType);
        pushBorderSideCellRhombusExport(lines, 0, b, yTop, yBottom, rhombusFill);
        pushBorderSideCellRhombusExport(
          lines,
          rightX,
          b,
          yTop,
          yBottom,
          rhombusFill
        );
      }
    }

    var divY = getLeftRightBorderDivisionYBounds();
    lines.push(
      '<line x1="0" y1="' +
        divY.top +
        '" x2="' +
        b +
        '" y2="' +
        divY.top +
        '"/>'
    );
    lines.push(
      '<line x1="0" y1="' +
        divY.bottom +
        '" x2="' +
        b +
        '" y2="' +
        divY.bottom +
        '"/>'
    );
    lines.push(
      '<line x1="' +
        (CANVAS_W - b) +
        '" y1="' +
        divY.top +
        '" x2="' +
        CANVAS_W +
        '" y2="' +
        divY.top +
        '"/>'
    );
    lines.push(
      '<line x1="' +
        (CANVAS_W - b) +
        '" y1="' +
        divY.bottom +
        '" x2="' +
        CANVAS_W +
        '" y2="' +
        divY.bottom +
        '"/>'
    );

    var sideInteriorY = getLeftRightBorderInteriorYPositions();
    for (i = 0; i < sideInteriorY.length; i++) {
      y = sideInteriorY[i];
      lines.push(
        '<line x1="0" y1="' +
          y +
          '" x2="' +
          b +
          '" y2="' +
          y +
          '"/>'
      );
      lines.push(
        '<line x1="' +
          (CANVAS_W - b) +
          '" y1="' +
          y +
          '" x2="' +
          CANVAS_W +
          '" y2="' +
          y +
          '"/>'
      );
    }

    var outlineOnly = !home && !outside;
    if (outlineOnly || outside || getBorderSideWhiteFillTargetPercent() > 0) {
      for (j = 0; j < yBounds.length - 1; j++) {
        cellType = getBorderSideCellType(j);
        yTop = yBounds[j];
        yBottom = yBounds[j + 1];

        if (isBorderSideCellWhitened(0, j)) {
          pushBorderSideWhitenedCellOutlinesExport(
            lines,
            b,
            rightX,
            yTop,
            yBottom,
            cellType,
            home,
            outside,
            outlineOnly
          );
          continue;
        }

        if (cellType === "grey" || cellType === "beige") continue;
        if (!outlineOnly && cellType !== "outside") continue;
        lines.push(
          '<line x1="0" y1="' +
            yTop +
            '" x2="' +
            b +
            '" y2="' +
            yBottom +
            '"/>'
        );
        lines.push(
          '<line x1="' +
            b +
            '" y1="' +
            yTop +
            '" x2="0" y2="' +
            yBottom +
            '"/>'
        );
        lines.push(
          '<line x1="' +
            rightX +
            '" y1="' +
            yTop +
            '" x2="' +
            CANVAS_W +
            '" y2="' +
            yBottom +
            '"/>'
        );
        lines.push(
          '<line x1="' +
            CANVAS_W +
            '" y1="' +
            yTop +
            '" x2="' +
            rightX +
            '" y2="' +
            yBottom +
            '"/>'
        );
      }
    }

    pushLeftRightBorderColumnDividersExport(lines);

    lines.push("</g>");
  }

  function createInnerContentClipGroup(id) {
    var g = elSvg("g");
    g.setAttribute("id", id);
    g.setAttribute("clip-path", "url(#inner-content-clip)");
    return g;
  }

  function appendInnerContentClipPath(defs) {
    var innerClip = elSvg("clipPath");
    innerClip.setAttribute("id", "inner-content-clip");
    var innerClipRect = elSvg("rect");
    innerClipRect.setAttribute("x", "0");
    innerClipRect.setAttribute("y", "0");
    innerClipRect.setAttribute("width", String(CANVAS_W));
    innerClipRect.setAttribute("height", String(CANVAS_H));
    innerClip.appendChild(innerClipRect);
    defs.appendChild(innerClip);
  }

  function createDesignSvg() {
    var svg = elSvg("svg");
    designSvg = svg;
    svg.setAttribute("id", "design-svg");
    svg.setAttribute("viewBox", "0 0 " + CANVAS_W + " " + CANVAS_H);
    svg.setAttribute("xmlns", NS);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Octagon geometric grid");

    var defs = elSvg("defs");
    var clip = elSvg("clipPath");
    clip.setAttribute("id", "canvas-clip");
    var clipRect = elSvg("rect");
    clipRect.setAttribute("x", "0");
    clipRect.setAttribute("y", "0");
    clipRect.setAttribute("width", String(CANVAS_W));
    clipRect.setAttribute("height", String(CANVAS_H));
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    appendInnerContentClipPath(defs);
    ensureAutoMergeShadowFilter(defs);
    ensureBorderSideWhiteInnerShadowDefs(defs);
    svg.appendChild(defs);

    var borderFill = elSvg("rect");
    borderFill.setAttribute("id", "canvas-background-fill");
    borderFill.setAttribute("x", "0");
    borderFill.setAttribute("y", "0");
    borderFill.setAttribute("width", String(CANVAS_W));
    borderFill.setAttribute("height", String(CANVAS_H));
    borderFill.setAttribute("fill", getCanvasBackgroundColor());
    svg.appendChild(borderFill);

    svg.appendChild(createBorderDivisionLinesGroup());

    var innerContent = elSvg("g");
    innerContent.setAttribute("id", "inner-content");
    innerContent.setAttribute("transform", getInnerContentTransformAttr());

    var clippedBackground = createInnerContentClipGroup("inner-clipped-background");
    var background = elSvg("g");
    background.setAttribute("id", "layer-background");
    clippedBackground.appendChild(background);
    innerContent.appendChild(clippedBackground);

    var clippedStippleDots = createInnerContentClipGroup("inner-clipped-stipple-dots");
    var stippleDotsLayer = elSvg("g");
    stippleDotsLayer.setAttribute("id", "layer-stipple-dots");
    clippedStippleDots.appendChild(stippleDotsLayer);
    innerContent.appendChild(clippedStippleDots);

    var clippedGridMask = createInnerContentClipGroup("inner-clipped-grid-mask");
    var gridMaskLayer = elSvg("g");
    gridMaskLayer.setAttribute("id", "layer-grid-mask");
    clippedGridMask.appendChild(gridMaskLayer);
    innerContent.appendChild(clippedGridMask);

    applyMergeReveal();

    var clippedVertical = createInnerContentClipGroup("inner-clipped-vertical-grid");
    var verticalLayer = elSvg("g");
    verticalLayer.setAttribute("id", "layer-vertical-grid");
    verticalLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedVertical.appendChild(verticalLayer);
    innerContent.appendChild(clippedVertical);

    var clippedDiamonds = createInnerContentClipGroup("inner-clipped-diamond-fills");
    var diamondLayer = elSvg("g");
    diamondLayer.setAttribute("id", "layer-diamond-fills");
    diamondLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedDiamonds.appendChild(diamondLayer);
    innerContent.appendChild(clippedDiamonds);

    var clippedHollowDiamonds = createInnerContentClipGroup(
      "inner-clipped-hollow-diamond-fills"
    );
    var hollowDiamondLayer = elSvg("g");
    hollowDiamondLayer.setAttribute("id", "layer-hollow-diamond-fills");
    hollowDiamondLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedHollowDiamonds.appendChild(hollowDiamondLayer);
    innerContent.appendChild(clippedHollowDiamonds);

    innerContent.appendChild(createGridBoundaryRect());

    var clippedPattern = createInnerContentClipGroup("inner-clipped-pattern");
    var pattern = elSvg("g");
    pattern.setAttribute("id", "layer-pattern");
    pattern.setAttribute("clip-path", "url(#canvas-clip)");
    clippedPattern.appendChild(pattern);
    innerContent.appendChild(clippedPattern);

    var clippedVerticalOverlay = createInnerContentClipGroup(
      "inner-clipped-vertical-grid-overlay"
    );
    var verticalOverlayLayer = elSvg("g");
    verticalOverlayLayer.setAttribute("id", "layer-vertical-grid-overlay");
    verticalOverlayLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedVerticalOverlay.appendChild(verticalOverlayLayer);
    innerContent.appendChild(clippedVerticalOverlay);

    var clippedAutoMerge = createInnerContentClipGroup(
      "inner-clipped-auto-merge-fills"
    );
    var autoMergeLayer = elSvg("g");
    autoMergeLayer.setAttribute("id", "layer-auto-merge-fills");
    autoMergeLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedAutoMerge.appendChild(autoMergeLayer);
    innerContent.appendChild(clippedAutoMerge);

    var clippedHalfCircle = createInnerContentClipGroup("inner-clipped-half-circle");
    var halfCircleLayer = elSvg("g");
    halfCircleLayer.setAttribute("id", "layer-half-circle");
    halfCircleLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedHalfCircle.appendChild(halfCircleLayer);
    innerContent.appendChild(clippedHalfCircle);

    svg.appendChild(innerContent);

    svg.appendChild(createColorDivisionsLayer());

    // Overlays that cover grid content inward from the border (thickness control).
    svg.appendChild(createBorderDivisionOverlayGroup());

    var edgeBrownBars = elSvg("g");
    edgeBrownBars.setAttribute("id", "layer-edge-brown-bars");
    populateEdgeBrownBarsLayer(edgeBrownBars);
    svg.appendChild(edgeBrownBars);

    svg.appendChild(createBrownBarBannerTextGroup());

    svg.appendChild(createCanvasEdgeSerialGroup());

    svg.appendChild(createFrameInsetOverlayLayer());

    return svg;
  }

  function getHalfCircleVisible() {
    var toggle = document.getElementById("half-circle-toggle");
    return !toggle || toggle.checked;
  }

  function getHalfCircleBottomVisible() {
    var toggle = document.getElementById("half-circle-bottom-toggle");
    return !toggle || toggle.checked;
  }

  function getHalfCircleBottomFocalY() {
    return CANVAS_H - HALF_CIRCLE_FOCAL_Y;
  }

  function getHalfCircleVerticalMirrorTransform() {
    var axis = CANVAS_H / 2;
    return "translate(0 " + axis + ") scale(1 -1) translate(0 " + (-axis) + ")";
  }

  function getHalfCircleColor() {
    return sheetColor("D1");
  }

  function getHalfCircleRibCount() {
    return 34;
  }

  function getHalfCircleInset() {
    var input = document.getElementById("half-circle-inset");
    var raw = input ? Number(input.value) : 0.2;
    if (!Number.isFinite(raw)) raw = 0.2;
    return Math.max(0.1, Math.min(0.4, Math.round(raw * 100) / 100));
  }

  function getHalfCircleCuspGapPx() {
    var input = document.getElementById("half-circle-cusp-gap");
    var raw = input ? Number(input.value) : 22;
    if (!Number.isFinite(raw)) raw = 22;
    return Math.max(0, Math.min(40, Math.round(raw)));
  }

  function getHalfCircleMaxPetals() {
    return Math.max(0, getHalfCircleRibCount() - 1);
  }

  function getWearControlPetalCount(sliderId) {
    var input = document.getElementById(sliderId);
    var maxPetals = getHalfCircleMaxPetals();
    var raw = input ? Number(input.value) : 50;
    if (!Number.isFinite(raw)) raw = 50;
    var percent = Math.max(0, Math.min(100, Math.round(raw)));
    return Math.round((percent / 100) * maxPetals);
  }

  function getHalfCircleTopVisiblePetalCount() {
    return getWearControlPetalCount("wear-control-home");
  }

  function getHalfCircleBottomVisiblePetalCount() {
    return getWearControlPetalCount("wear-control-outside");
  }

  function getHalfCircleValleyCirclesVisible() {
    var el = document.getElementById("half-circle-valley-circles");
    return !el || el.checked;
  }

  function getHalfCircleInnerArcDiagonalsVisible() {
    var el = document.getElementById("half-circle-inner-arc-diagonals");
    return !el || el.checked;
  }

  function getHalfCircleValleyCircleSizeScale() {
    var input = document.getElementById("half-circle-valley-circle-size");
    var raw = input ? Number(input.value) : 100;
    if (!Number.isFinite(raw)) raw = 100;
    return Math.max(0, Math.min(100, Math.round(raw))) / 100;
  }

  function getHalfCircleStarInnerRadiusRatio() {
    var input = document.getElementById("half-circle-star-inner-radius");
    var raw = input ? Number(input.value) : 50;
    if (!Number.isFinite(raw)) raw = 50;
    return Math.max(50, Math.min(95, Math.round(raw))) / 100;
  }

  function getHalfCircleInnerArcRadiusRatio() {
    var input = document.getElementById("half-circle-inner-arc-position");
    var raw = input ? Number(input.value) : 50;
    if (!Number.isFinite(raw)) raw = 50;
    return Math.max(20, Math.min(80, Math.round(raw))) / 100;
  }

  function halfCircleCuspApexPoint(fx, fy, p0, p1, inward) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var chord = Math.sqrt(dx * dx + dy * dy);
    var rs = Math.max(0.01, chord * 0.55);
    var mx = (p0.x + p1.x) * 0.5;
    var my = (p0.y + p1.y) * 0.5;
    var halfChord = chord * 0.5;
    var sagitta = rs - Math.sqrt(Math.max(0, rs * rs - halfChord * halfChord));
    var toFocalX = fx - mx;
    var toFocalY = fy - my;
    var flen = Math.sqrt(toFocalX * toFocalX + toFocalY * toFocalY);
    if (flen < 1e-9) {
      return { x: mx, y: my };
    }
    var dirX = toFocalX / flen;
    var dirY = toFocalY / flen;
    var sign = inward ? 1 : -1;
    return {
      x: mx + sign * sagitta * dirX,
      y: my + sign * sagitta * dirY,
    };
  }

  function halfCircleInnerEndpointRadiusForGap(
    fx,
    fy,
    leftAngle,
    rightAngle,
    outerP0,
    outerP1,
    gap,
    maxRadius
  ) {
    var outerApex = halfCircleCuspApexPoint(fx, fy, outerP0, outerP1, true);

    function innerApexDistance(endpointRadius) {
      var pL = halfCirclePolarPoint(fx, fy, endpointRadius, leftAngle);
      var pR = halfCirclePolarPoint(fx, fy, endpointRadius, rightAngle);
      var innerApex = halfCircleCuspApexPoint(fx, fy, pL, pR, false);
      var dx = innerApex.x - outerApex.x;
      var dy = innerApex.y - outerApex.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    var hiLimit = typeof maxRadius === "number" ? maxRadius : 1;
    var tLo = 1;
    var tHi = hiLimit;
    var ti;
    for (ti = 0; ti < 48; ti++) {
      var m1 = tLo + (tHi - tLo) / 3;
      var m2 = tHi - (tHi - tLo) / 3;
      if (innerApexDistance(m1) < innerApexDistance(m2)) tHi = m2;
      else tLo = m1;
    }
    var rAtMin = (tLo + tHi) * 0.5;
    var minDist = innerApexDistance(rAtMin);

    if (gap <= minDist) return rAtMin;

    var lo = rAtMin;
    var hi = hiLimit;
    if (innerApexDistance(hi) < gap) return hi;

    var iter;
    for (iter = 0; iter < 48; iter++) {
      var mid = (lo + hi) * 0.5;
      if (innerApexDistance(mid) < gap) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  function halfCirclePolarPoint(cx, cy, radius, angle) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
    };
  }

  function buildHalfCircleFullEndpoints(cx, y, r, ribs) {
    var deltaTheta = ribs > 1 ? Math.PI / (ribs - 1) : 0;
    var endpoints = [];
    var i;
    for (i = 0; i < ribs; i++) {
      var a = Math.PI - i * deltaTheta;
      var pt = halfCirclePolarPoint(cx, y, r, a);
      endpoints.push({ x: pt.x, y: pt.y, a: a });
    }
    return { endpoints: endpoints, deltaTheta: deltaTheta };
  }

  function buildHalfCircleVisibleFanLayout(cx, y, r, ribs, visiblePetals, anchor) {
    var full = buildHalfCircleFullEndpoints(cx, y, r, ribs);
    var maxPetals = ribs - 1;
    if (visiblePetals <= 0 || maxPetals <= 0) {
      return {
        endpoints: [],
        deltaTheta: full.deltaTheta,
        startAngle: Math.PI,
        endAngle: Math.PI,
        visiblePetals: 0,
      };
    }

    var firstRib;
    var lastRib;
    if (anchor === "right") {
      // Right-anchored: keep the right edge fixed; petals fold away from the left.
      firstRib = maxPetals - visiblePetals;
      lastRib = maxPetals;
    } else {
      // Left-anchored: keep the left edge fixed; petals fold away from the right.
      firstRib = 0;
      lastRib = visiblePetals;
    }
    var visibleEndpoints = full.endpoints.slice(firstRib, lastRib + 1);

    return {
      endpoints: visibleEndpoints,
      deltaTheta: full.deltaTheta,
      startAngle: visibleEndpoints[0].a,
      endAngle: visibleEndpoints[visibleEndpoints.length - 1].a,
      visiblePetals: visiblePetals,
      firstRib: firstRib,
    };
  }

  function halfCircleSectorPath(cx, y, r, startAngle, endAngle) {
    // Travel from the larger angle to the smaller so sweep=1 follows the upper arc
    // (same direction as the original semicircle fill: left → right through the top).
    var arcFrom = startAngle;
    var arcTo = endAngle;
    if (arcFrom < arcTo) {
      var swap = arcFrom;
      arcFrom = arcTo;
      arcTo = swap;
    }
    var pStart = halfCirclePolarPoint(cx, y, r, arcFrom);
    var pEnd = halfCirclePolarPoint(cx, y, r, arcTo);
    var span = arcFrom - arcTo;
    var largeArc = span > Math.PI ? 1 : 0;
    return (
      "M " +
      cx +
      " " +
      y +
      " L " +
      pStart.x +
      " " +
      pStart.y +
      " A " +
      r +
      " " +
      r +
      " 0 " +
      largeArc +
      " 1 " +
      pEnd.x +
      " " +
      pEnd.y +
      " Z"
    );
  }

  function halfCircleFocalArcPath(cx, y, radius, startAngle, endAngle) {
    var arcFrom = startAngle;
    var arcTo = endAngle;
    if (arcFrom < arcTo) {
      var swap = arcFrom;
      arcFrom = arcTo;
      arcTo = swap;
    }
    var pStart = halfCirclePolarPoint(cx, y, radius, arcFrom);
    var pEnd = halfCirclePolarPoint(cx, y, radius, arcTo);
    var span = arcFrom - arcTo;
    var largeArc = span > Math.PI ? 1 : 0;
    return (
      "M " +
      pStart.x +
      " " +
      pStart.y +
      " A " +
      radius +
      " " +
      radius +
      " 0 " +
      largeArc +
      " 1 " +
      pEnd.x +
      " " +
      pEnd.y
    );
  }

  function halfCircleCircleStarTipPoint(circle) {
    return halfCirclePolarPoint(
      circle.cx,
      circle.cy,
      circle.r,
      circle.tipAngle
    );
  }

  function halfCircleValleyShelfRadius(fx, fy, circles) {
    if (!circles.length) return 0;
    var total = 0;
    var i;
    for (i = 0; i < circles.length; i++) {
      var tip = halfCircleCircleStarTipPoint(circles[i]);
      var dx = tip.x - fx;
      var dy = tip.y - fy;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total / circles.length;
  }

  function halfCirclePolarFromFocal(fx, fy, px, py) {
    var dx = px - fx;
    var dy = py - fy;
    return {
      angle: Math.atan2(-dy, dx),
      dist: Math.sqrt(dx * dx + dy * dy),
    };
  }

  function halfCircleValleyShelfArcSpec(fx, fy, circles) {
    if (!circles.length) return null;
    var leftCircle = circles[0];
    var rightCircle = circles[circles.length - 1];
    var leftTip = halfCircleCircleStarTipPoint(leftCircle);
    var rightTip = halfCircleCircleStarTipPoint(rightCircle);
    var leftPolar = halfCirclePolarFromFocal(fx, fy, leftTip.x, leftTip.y);
    var rightPolar = halfCirclePolarFromFocal(fx, fy, rightTip.x, rightTip.y);
    return {
      radius: halfCircleValleyShelfRadius(fx, fy, circles),
      startAngle: leftPolar.angle,
      endAngle: rightPolar.angle,
      startPoint: leftTip,
      endPoint: rightTip,
    };
  }

  function halfCircleValleyShelfArcPath(fx, fy, spec) {
    var arcFrom = spec.startAngle;
    var arcTo = spec.endAngle;
    if (arcFrom < arcTo) {
      var swap = arcFrom;
      arcFrom = arcTo;
      arcTo = swap;
    }
    var span = arcFrom - arcTo;
    var largeArc = span > Math.PI ? 1 : 0;
    return (
      "M " +
      spec.startPoint.x +
      " " +
      spec.startPoint.y +
      " A " +
      spec.radius +
      " " +
      spec.radius +
      " 0 " +
      largeArc +
      " 1 " +
      spec.endPoint.x +
      " " +
      spec.endPoint.y
    );
  }

  function halfCircleDistSqFromFocal(fx, fy, px, py) {
    var dx = px - fx;
    var dy = py - fy;
    return dx * dx + dy * dy;
  }

  function halfCircleAngleOnCircle(cx, cy, px, py) {
    return Math.atan2(-(py - cy), px - cx);
  }

  function halfCircleIntersectTwoCircles(c1x, c1y, r1, c2x, c2y, r2) {
    var dx = c2x - c1x;
    var dy = c2y - c1y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-9) return [];
    if (dist > r1 + r2 + 1e-6 || dist < Math.abs(r1 - r2) - 1e-6) return [];
    var a = (r1 * r1 - r2 * r2 + dist * dist) / (2 * dist);
    var h2 = r1 * r1 - a * a;
    if (h2 < -1e-6) return [];
    var h = Math.sqrt(Math.max(0, h2));
    var mx = c1x + (a * dx) / dist;
    var my = c1y + (a * dy) / dist;
    var perpX = -dy / dist;
    var perpY = dx / dist;
    if (h < 1e-6) return [{ x: mx, y: my }];
    return [
      { x: mx + h * perpX, y: my + h * perpY },
      { x: mx - h * perpX, y: my - h * perpY },
    ];
  }

  function halfCircleCirclePairClosestPoints(leftCircle, rightCircle) {
    var dx = rightCircle.cx - leftCircle.cx;
    var dy = rightCircle.cy - leftCircle.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-9) {
      var pt = { x: leftCircle.cx, y: leftCircle.cy };
      return { left: pt, right: pt };
    }
    return {
      left: {
        x: leftCircle.cx + (leftCircle.r * dx) / dist,
        y: leftCircle.cy + (leftCircle.r * dy) / dist,
      },
      right: {
        x: rightCircle.cx - (rightCircle.r * dx) / dist,
        y: rightCircle.cy - (rightCircle.r * dy) / dist,
      },
    };
  }

  function halfCircleCircleShelfGapCorner(
    fx,
    fy,
    shelfRadius,
    circle,
    neighborCx,
    neighborCy
  ) {
    var hits = halfCircleIntersectTwoCircles(
      fx,
      fy,
      shelfRadius,
      circle.cx,
      circle.cy,
      circle.r
    );
    var toNx = neighborCx - circle.cx;
    var toNy = neighborCy - circle.cy;
    var toLen = Math.sqrt(toNx * toNx + toNy * toNy);
    if (toLen < 1e-9) return null;

    var shelfDistSq = shelfRadius * shelfRadius;
    var centerDistSq = halfCircleDistSqFromFocal(fx, fy, circle.cx, circle.cy);
    var cuspPt = {
      x: circle.cx + (circle.r * toNx) / toLen,
      y: circle.cy + (circle.r * toNy) / toLen,
    };
    var cuspDistSq = halfCircleDistSqFromFocal(fx, fy, cuspPt.x, cuspPt.y);
    var aCusp = halfCircleAngleOnCircle(circle.cx, circle.cy, cuspPt.x, cuspPt.y);
    var aFocal = halfCircleAngleOnCircle(circle.cx, circle.cy, fx, fy);

    var bestHit = null;
    var bestHitDist = -Infinity;
    var hi;
    for (hi = 0; hi < hits.length; hi++) {
      var hit = hits[hi];
      var vx = hit.x - circle.cx;
      var vy = hit.y - circle.cy;
      if (vx * toNx + vy * toNy <= 1e-6) continue;
      var hitDist = halfCircleDistSqFromFocal(fx, fy, hit.x, hit.y);
      if (hitDist <= centerDistSq + 1 || hitDist <= cuspDistSq + 1) continue;
      if (hitDist > bestHitDist) {
        bestHitDist = hitDist;
        bestHit = hit;
      }
    }
    if (bestHit) return bestHit;

    var bestSample = null;
    var bestSampleDist = -Infinity;
    var sweep;
    for (sweep = 0; sweep <= 1; sweep++) {
      var si;
      for (si = 0; si <= 96; si++) {
        var t = si / 96;
        var delta = aFocal - aCusp;
        if (sweep === 0) {
          if (delta > 0) delta -= Math.PI * 2;
        } else if (delta < 0) {
          delta += Math.PI * 2;
        }
        var angle = aCusp + delta * t;
        var pt = halfCirclePolarPoint(circle.cx, circle.cy, circle.r, angle);
        var dot = (pt.x - circle.cx) * toNx + (pt.y - circle.cy) * toNy;
        if (dot <= 1e-6) continue;
        var ptDist = halfCircleDistSqFromFocal(fx, fy, pt.x, pt.y);
        if (ptDist <= centerDistSq + 1 || ptDist <= cuspDistSq + 1) continue;
        if (ptDist > shelfDistSq + 64) continue;
        if (ptDist > bestSampleDist) {
          bestSampleDist = ptDist;
          bestSample = pt;
        }
      }
    }
    return bestSample;
  }

  function halfCircleCircleArcMidAngle(a0, a1, sweep) {
    var delta = a1 - a0;
    if (sweep === 0) {
      if (delta > 0) delta -= Math.PI * 2;
    } else if (delta < 0) {
      delta += Math.PI * 2;
    }
    return a0 + delta * 0.5;
  }

  function halfCircleAppendCircleArcBetween(
    d,
    cx,
    cy,
    r,
    fromPt,
    toPt,
    fx,
    fy,
    neighborCx,
    neighborCy
  ) {
    var a0 = halfCircleAngleOnCircle(cx, cy, fromPt.x, fromPt.y);
    var a1 = halfCircleAngleOnCircle(cx, cy, toPt.x, toPt.y);
    var centerDist = halfCircleDistSqFromFocal(fx, fy, cx, cy);
    var toNx = neighborCx - cx;
    var toNy = neighborCy - cy;
    var bestSweep = 1;
    var bestDist = -Infinity;
    var sweep;
    for (sweep = 0; sweep <= 1; sweep++) {
      var midAngle = halfCircleCircleArcMidAngle(a0, a1, sweep);
      var mid = halfCirclePolarPoint(cx, cy, r, midAngle);
      var midDist = halfCircleDistSqFromFocal(fx, fy, mid.x, mid.y);
      if (midDist <= centerDist + 1) continue;
      var dot = (mid.x - cx) * toNx + (mid.y - cy) * toNy;
      if (dot <= 1e-6) continue;
      if (midDist > bestDist) {
        bestDist = midDist;
        bestSweep = sweep;
      }
    }
    if (bestDist < 0) return null;

    var delta = a1 - a0;
    if (bestSweep === 0) {
      if (delta > 0) delta -= Math.PI * 2;
    } else if (delta < 0) {
      delta += Math.PI * 2;
    }
    var largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
    return (
      d +
      " A " +
      r +
      " " +
      r +
      " 0 " +
      largeArc +
      " " +
      bestSweep +
      " " +
      toPt.x +
      " " +
      toPt.y
    );
  }

  function halfCircleAppendFocalArcBetween(d, fx, fy, radius, fromPt, toPt) {
    var a0 = halfCirclePolarFromFocal(fx, fy, fromPt.x, fromPt.y).angle;
    var a1 = halfCirclePolarFromFocal(fx, fy, toPt.x, toPt.y).angle;
    var arcFrom = a0;
    var arcTo = a1;
    if (arcFrom < arcTo) {
      var swap = arcFrom;
      arcFrom = arcTo;
      arcTo = swap;
    }
    var span = arcFrom - arcTo;
    var largeArc = span > Math.PI ? 1 : 0;
    return (
      d +
      " A " +
      radius +
      " " +
      radius +
      " 0 " +
      largeArc +
      " 1 " +
      toPt.x +
      " " +
      toPt.y
    );
  }

  function halfCircleProjectToFocalArc(fx, fy, radius, px, py) {
    var polar = halfCirclePolarFromFocal(fx, fy, px, py);
    return halfCirclePolarPoint(fx, fy, radius, polar.angle);
  }

  function halfCircleAppendCircleArcGapSide(
    d,
    cx,
    cy,
    r,
    fromPt,
    toPt,
    fx,
    fy,
    neighborCx,
    neighborCy
  ) {
    var a0 = halfCircleAngleOnCircle(cx, cy, fromPt.x, fromPt.y);
    var a1 = halfCircleAngleOnCircle(cx, cy, toPt.x, toPt.y);
    var toNx = neighborCx - cx;
    var toNy = neighborCy - cy;
    var centerDistSq = halfCircleDistSqFromFocal(fx, fy, cx, cy);
    var bestSweep = 1;
    var bestScore = -Infinity;
    var sweep;
    for (sweep = 0; sweep <= 1; sweep++) {
      var delta = a1 - a0;
      if (sweep === 0) {
        if (delta > 0) delta -= Math.PI * 2;
      } else if (delta < 0) {
        delta += Math.PI * 2;
      }
      if (Math.abs(delta) > Math.PI) continue;

      var midAngle = halfCircleCircleArcMidAngle(a0, a1, sweep);
      var mid = halfCirclePolarPoint(cx, cy, r, midAngle);
      var dot = (mid.x - cx) * toNx + (mid.y - cy) * toNy;
      if (dot <= 1e-6) continue;
      var midDist = halfCircleDistSqFromFocal(fx, fy, mid.x, mid.y);
      if (midDist <= centerDistSq + 1) continue;
      if (dot > bestScore) {
        bestScore = dot;
        bestSweep = sweep;
      }
    }
    if (bestScore < 0) return null;

    var deltaOut = a1 - a0;
    if (bestSweep === 0) {
      if (deltaOut > 0) deltaOut -= Math.PI * 2;
    } else if (deltaOut < 0) {
      deltaOut += Math.PI * 2;
    }
    var largeArc = Math.abs(deltaOut) > Math.PI ? 1 : 0;
    return (
      d +
      " A " +
      r +
      " " +
      r +
      " 0 " +
      largeArc +
      " " +
      bestSweep +
      " " +
      toPt.x +
      " " +
      toPt.y
    );
  }

  function halfCircleValleyGapFillPath(fx, fy, shelfRadius, leftCircle, rightCircle) {
    var cusp = halfCircleCirclePairClosestPoints(leftCircle, rightCircle);
    var hitL = halfCircleCircleShelfGapCorner(
      fx,
      fy,
      shelfRadius,
      leftCircle,
      rightCircle.cx,
      rightCircle.cy
    );
    var hitR = halfCircleCircleShelfGapCorner(
      fx,
      fy,
      shelfRadius,
      rightCircle,
      leftCircle.cx,
      leftCircle.cy
    );
    if (!hitL || !hitR) return null;

    var shelfL = halfCircleProjectToFocalArc(fx, fy, shelfRadius, hitL.x, hitL.y);
    var shelfR = halfCircleProjectToFocalArc(fx, fy, shelfRadius, hitR.x, hitR.y);

    var d = "M " + shelfL.x + " " + shelfL.y;
    d = halfCircleAppendFocalArcBetween(d, fx, fy, shelfRadius, shelfL, shelfR);
    if (!d) return null;

    d = halfCircleAppendCircleArcGapSide(
      d,
      rightCircle.cx,
      rightCircle.cy,
      rightCircle.r,
      hitR,
      cusp.right,
      fx,
      fy,
      leftCircle.cx,
      leftCircle.cy
    );
    if (!d) return null;

    var gapDx = cusp.right.x - cusp.left.x;
    var gapDy = cusp.right.y - cusp.left.y;
    if (gapDx * gapDx + gapDy * gapDy > 1e-4) {
      d += " L " + cusp.left.x + " " + cusp.left.y;
    }

    d = halfCircleAppendCircleArcGapSide(
      d,
      leftCircle.cx,
      leftCircle.cy,
      leftCircle.r,
      cusp.left,
      hitL,
      fx,
      fy,
      rightCircle.cx,
      rightCircle.cy
    );
    if (!d) return null;
    return d + " Z";
  }

  function halfCirclePointOnOutwardArc(spec, pt) {
    var angle = Math.atan2(-(pt.y - spec.cy), pt.x - spec.cx);
    return halfCircleAngleInOutwardArc(spec, angle);
  }

  function halfCirclePetalCirclePairClosestPoints(petal, circle, fx, fy) {
    var spec = halfCircleOutwardCuspArcSpec(fx, fy, petal.inLeft, petal.inRight);
    var petalPt = halfCircleClosestPointOnArc(spec, circle.cx, circle.cy);
    var dx = petalPt.x - circle.cx;
    var dy = petalPt.y - circle.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-9) {
      return {
        petal: petalPt,
        circle: { x: circle.cx, y: circle.cy },
      };
    }
    return {
      petal: petalPt,
      circle: {
        x: circle.cx + (circle.r * dx) / dist,
        y: circle.cy + (circle.r * dy) / dist,
      },
    };
  }

  function halfCirclePetalOuterCorner(petal, side) {
    return side === "right" ? petal.inRight : petal.inLeft;
  }

  function halfCirclePetalOuterShelfPoint(fx, fy, petal, neighborCx, neighborCy) {
    var spec = halfCircleOutwardCuspArcSpec(fx, fy, petal.inLeft, petal.inRight);
    var cuspPt = halfCircleClosestPointOnArc(spec, neighborCx, neighborCy);
    var toNx = neighborCx - cuspPt.x;
    var toNy = neighborCy - cuspPt.y;
    var cuspDistSq = halfCircleDistSqFromFocal(fx, fy, cuspPt.x, cuspPt.y);

    var bestSample = null;
    var bestSampleDist = -Infinity;
    var sweep;
    for (sweep = 0; sweep <= 1; sweep++) {
      var si;
      for (si = 0; si <= 96; si++) {
        var t = si / 96;
        var delta = spec.a1 - spec.a0;
        if (sweep === 0) {
          if (delta > 0) delta -= Math.PI * 2;
        } else if (delta < 0) {
          delta += Math.PI * 2;
        }
        var angle = spec.a0 + delta * t;
        if (!halfCircleAngleInOutwardArc(spec, angle)) continue;
        var pt = halfCirclePolarPoint(spec.cx, spec.cy, spec.r, angle);
        var dot = (pt.x - cuspPt.x) * toNx + (pt.y - cuspPt.y) * toNy;
        if (dot <= 1e-6) continue;
        var ptDist = halfCircleDistSqFromFocal(fx, fy, pt.x, pt.y);
        if (ptDist <= cuspDistSq + 1) continue;
        if (ptDist > bestSampleDist) {
          bestSampleDist = ptDist;
          bestSample = pt;
        }
      }
    }
    if (bestSample) return bestSample;

    var fallback = null;
    var fallbackDist = -Infinity;
    for (sweep = 0; sweep <= 1; sweep++) {
      var fj;
      for (fj = 0; fj <= 96; fj++) {
        var t2 = fj / 96;
        var delta2 = spec.a1 - spec.a0;
        if (sweep === 0) {
          if (delta2 > 0) delta2 -= Math.PI * 2;
        } else if (delta2 < 0) {
          delta2 += Math.PI * 2;
        }
        var angle2 = spec.a0 + delta2 * t2;
        if (!halfCircleAngleInOutwardArc(spec, angle2)) continue;
        var pt2 = halfCirclePolarPoint(spec.cx, spec.cy, spec.r, angle2);
        var ptDist2 = halfCircleDistSqFromFocal(fx, fy, pt2.x, pt2.y);
        if (ptDist2 > fallbackDist) {
          fallbackDist = ptDist2;
          fallback = pt2;
        }
      }
    }
    return fallback || cuspPt;
  }

  function halfCircleCircleOuterShelfPoint(fx, fy, shelfRadius, circle, neighborX, neighborY) {
    var hit = halfCircleCircleShelfGapCorner(
      fx,
      fy,
      shelfRadius,
      circle,
      neighborX,
      neighborY
    );
    if (hit) return hit;
    var dx = neighborX - circle.cx;
    var dy = neighborY - circle.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-9) return null;
    return {
      x: circle.cx + (circle.r * dx) / dist,
      y: circle.cy + (circle.r * dy) / dist,
    };
  }

  function halfCirclePetalCircleGapFillPath(fx, fy, shelfRadius, petal, circle) {
    var petalCorner = halfCirclePetalOuterCorner(petal, "right");
    var cusp = halfCirclePetalCirclePairClosestPoints(petal, circle, fx, fy);
    var petalTop =
      halfCirclePetalOuterShelfPoint(fx, fy, petal, circle.cx, circle.cy) ||
      cusp.petal ||
      petalCorner;
    var circleOuter = halfCircleCircleOuterShelfPoint(
      fx,
      fy,
      shelfRadius,
      circle,
      petalCorner.x,
      petalCorner.y
    );
    if (!circleOuter) return null;

    var shelfL = halfCircleProjectToFocalArc(fx, fy, shelfRadius, petalTop.x, petalTop.y);
    var shelfR = halfCircleProjectToFocalArc(
      fx,
      fy,
      shelfRadius,
      circleOuter.x,
      circleOuter.y
    );
    var innerTop = halfCircleProjectToFocalArc(fx, fy, petal.rInner, petalTop.x, petalTop.y);

    var d = "M " + shelfL.x + " " + shelfL.y;
    d = halfCircleAppendFocalArcBetween(d, fx, fy, shelfRadius, shelfL, shelfR);
    if (!d) {
      d = "M " + shelfL.x + " " + shelfL.y + " L " + shelfR.x + " " + shelfR.y;
    }

    var circleArc = halfCircleAppendCircleArcGapSide(
      d,
      circle.cx,
      circle.cy,
      circle.r,
      circleOuter,
      cusp.circle,
      fx,
      fy,
      petalCorner.x,
      petalCorner.y
    );
    d = circleArc || d + " L " + cusp.circle.x + " " + cusp.circle.y;

    d += " L " + petalCorner.x + " " + petalCorner.y;

    var innerArc = halfCircleAppendFocalArcBetween(
      d,
      fx,
      fy,
      petal.rInner,
      petalCorner,
      innerTop
    );
    d = innerArc || d + " L " + innerTop.x + " " + innerTop.y;
    d += " L " + petalTop.x + " " + petalTop.y;
    return d + " Z";
  }

  function halfCircleCirclePetalGapFillPath(fx, fy, shelfRadius, circle, petal) {
    var petalCorner = halfCirclePetalOuterCorner(petal, "left");
    var cusp = halfCirclePetalCirclePairClosestPoints(petal, circle, fx, fy);
    var petalTop =
      halfCirclePetalOuterShelfPoint(fx, fy, petal, circle.cx, circle.cy) ||
      cusp.petal ||
      petalCorner;
    var circleOuter = halfCircleCircleOuterShelfPoint(
      fx,
      fy,
      shelfRadius,
      circle,
      petalCorner.x,
      petalCorner.y
    );
    if (!circleOuter) return null;

    var shelfL = halfCircleProjectToFocalArc(
      fx,
      fy,
      shelfRadius,
      circleOuter.x,
      circleOuter.y
    );
    var shelfR = halfCircleProjectToFocalArc(fx, fy, shelfRadius, petalTop.x, petalTop.y);
    var innerTop = halfCircleProjectToFocalArc(fx, fy, petal.rInner, petalTop.x, petalTop.y);

    var d = "M " + shelfL.x + " " + shelfL.y;
    d = halfCircleAppendFocalArcBetween(d, fx, fy, shelfRadius, shelfL, shelfR);
    if (!d) {
      d = "M " + shelfL.x + " " + shelfL.y + " L " + shelfR.x + " " + shelfR.y;
    }

    d += " L " + petalTop.x + " " + petalTop.y;

    var innerArc = halfCircleAppendFocalArcBetween(
      d,
      fx,
      fy,
      petal.rInner,
      innerTop,
      petalCorner
    );
    d = innerArc || d + " L " + petalCorner.x + " " + petalCorner.y;

    d += " L " + cusp.circle.x + " " + cusp.circle.y;

    var circleArc = halfCircleAppendCircleArcGapSide(
      d,
      circle.cx,
      circle.cy,
      circle.r,
      cusp.circle,
      circleOuter,
      fx,
      fy,
      petalCorner.x,
      petalCorner.y
    );
    d = circleArc || d + " L " + circleOuter.x + " " + circleOuter.y;
    return d + " Z";
  }

  function halfCirclePetalShelfCuspCapPath(fx, fy, shelfRadius, petal) {
    var shelfL = halfCircleProjectToFocalArc(
      fx,
      fy,
      shelfRadius,
      petal.inLeft.x,
      petal.inLeft.y
    );
    var shelfR = halfCircleProjectToFocalArc(
      fx,
      fy,
      shelfRadius,
      petal.inRight.x,
      petal.inRight.y
    );
    var d = "M " + shelfL.x + " " + shelfL.y;
    d = halfCircleAppendFocalArcBetween(d, fx, fy, shelfRadius, shelfL, shelfR);
    if (!d) return null;
    d += " L " + petal.inRight.x + " " + petal.inRight.y;

    var dx = petal.inLeft.x - petal.inRight.x;
    var dy = petal.inLeft.y - petal.inRight.y;
    var chord = Math.sqrt(dx * dx + dy * dy);
    var rs = Math.max(0.01, chord * 0.55);
    var mx = (petal.inLeft.x + petal.inRight.x) * 0.5;
    var my = (petal.inLeft.y + petal.inRight.y) * 0.5;
    var sweep = halfCircleOutwardCuspSweep(fx, fy, petal.inRight, petal.inLeft);
    d +=
      " A " +
      rs +
      " " +
      rs +
      " 0 0 " +
      sweep +
      " " +
      petal.inLeft.x +
      " " +
      petal.inLeft.y;
    return d + " Z";
  }

  function halfCircleValleyGapClipPathD(sectorPath, circles) {
    var d = sectorPath + " Z";
    var ci;
    for (ci = 0; ci < circles.length; ci++) {
      var c = circles[ci];
      var left = c.cx - c.r;
      var right = c.cx + c.r;
      d +=
        " M " +
        left +
        " " +
        c.cy +
        " A " +
        c.r +
        " " +
        c.r +
        " 0 1 0 " +
        right +
        " " +
        c.cy +
        " A " +
        c.r +
        " " +
        c.r +
        " 0 1 0 " +
        left +
        " " +
        c.cy +
        " Z";
    }
    return d;
  }

  function halfCirclePetalFaceFillPath(fx, fy, outerP0, outerP1, inLeft, inRight) {
    var d = "M " + fx + " " + fy;
    d += " L " + outerP0.x + " " + outerP0.y;
    d = appendHalfCircleInwardCuspArc(d, outerP0, outerP1);
    d += " L " + fx + " " + fy + " Z";
    d += " M " + fx + " " + fy;
    d += " L " + inLeft.x + " " + inLeft.y;
    d = appendHalfCircleOutwardCuspArc(d, inLeft, inRight, fx, fy);
    d += " L " + fx + " " + fy + " Z";
    return d;
  }

  function halfCircleInnerArcBandCellPath(
    fx,
    fy,
    innerRadius,
    outerRadius,
    leftAngle,
    rightAngle
  ) {
    var pInnerL = halfCirclePolarPoint(fx, fy, innerRadius, leftAngle);
    var pInnerR = halfCirclePolarPoint(fx, fy, innerRadius, rightAngle);
    var pOuterR = halfCirclePolarPoint(fx, fy, outerRadius, rightAngle);
    var pOuterL = halfCirclePolarPoint(fx, fy, outerRadius, leftAngle);
    var d = "M " + pInnerL.x + " " + pInnerL.y;
    d = halfCircleAppendFocalArcBetween(d, fx, fy, innerRadius, pInnerL, pInnerR);
    d += " L " + pOuterR.x + " " + pOuterR.y;
    d = halfCircleAppendFocalArcBetween(d, fx, fy, outerRadius, pOuterR, pOuterL);
    return d + " Z";
  }

  function halfCircleRibStripFillPath(fx, fy, outerAngle, innerCorner, rInner, side) {
    var outerPt = halfCirclePolarPoint(fx, fy, rInner, outerAngle);
    var d = "M " + fx + " " + fy;
    if (side === "left") {
      d += " L " + outerPt.x + " " + outerPt.y;
      d = halfCircleAppendFocalArcBetween(d, fx, fy, rInner, outerPt, innerCorner);
    } else {
      d += " L " + innerCorner.x + " " + innerCorner.y;
      d = halfCircleAppendFocalArcBetween(d, fx, fy, rInner, innerCorner, outerPt);
    }
    return d + " Z";
  }

  function appendHalfCircleInwardCuspArc(d, p0, p1) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var chord = Math.sqrt(dx * dx + dy * dy);
    var rs = Math.max(0.01, chord * 0.55);
    return d + " A " + rs + " " + rs + " 0 0 1 " + p1.x + " " + p1.y;
  }

  function appendHalfCircleOutwardCuspArc(d, p0, p1, fx, fy) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var chord = Math.sqrt(dx * dx + dy * dy);
    var rs = Math.max(0.01, chord * 0.55);
    var sweep =
      typeof fx === "number" && typeof fy === "number"
        ? halfCircleOutwardCuspSweep(fx, fy, p0, p1)
        : 0;
    return d + " A " + rs + " " + rs + " 0 0 " + sweep + " " + p1.x + " " + p1.y;
  }

  function halfCircleAngleOnArcSpan(a0, a1, passAngle, angle) {
    var eps = 1e-9;
    function onShortArc(a) {
      if (a0 <= a1) {
        return a >= a0 - eps && a <= a1 + eps;
      }
      return a >= a0 - eps || a <= a1 + eps;
    }
    var passOnShort = onShortArc(passAngle);
    var onShort = onShortArc(angle);
    return passOnShort ? onShort : !onShort;
  }

  function halfCircleOutwardCuspArcSpec(fx, fy, p0, p1) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var chord = Math.sqrt(dx * dx + dy * dy);
    var rs = Math.max(0.01, chord * 0.55);
    var mx = (p0.x + p1.x) * 0.5;
    var my = (p0.y + p1.y) * 0.5;
    var halfChord = chord * 0.5;
    var apothem = Math.sqrt(Math.max(0, rs * rs - halfChord * halfChord));
    var toFocalX = fx - mx;
    var toFocalY = fy - my;
    var flen = Math.sqrt(toFocalX * toFocalX + toFocalY * toFocalY);
    var ccx = mx;
    var ccy = my;
    if (flen >= 1e-9) {
      ccx = mx - (apothem * toFocalX) / flen;
      ccy = my - (apothem * toFocalY) / flen;
    }
    var apex = halfCircleCuspApexPoint(fx, fy, p0, p1, false);
    return {
      cx: ccx,
      cy: ccy,
      r: rs,
      a0: Math.atan2(-(p0.y - ccy), p0.x - ccx),
      a1: Math.atan2(-(p1.y - ccy), p1.x - ccx),
      outwardApexAngle: Math.atan2(-(apex.y - ccy), apex.x - ccx),
      p0: p0,
      p1: p1,
    };
  }

  function halfCircleAngleInOutwardArc(spec, angle) {
    return halfCircleAngleOnArcSpan(
      spec.a0,
      spec.a1,
      spec.outwardApexAngle,
      angle
    );
  }

  function halfCircleOutwardCuspSweep(fx, fy, p0, p1) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var chord = Math.sqrt(dx * dx + dy * dy);
    if (chord < 1e-9) return 0;
    var rs = Math.max(0.01, chord * 0.55);
    var mx = (p0.x + p1.x) * 0.5;
    var my = (p0.y + p1.y) * 0.5;
    var halfChord = chord * 0.5;
    var apothem = Math.sqrt(Math.max(0, rs * rs - halfChord * halfChord));
    var nx = -dy / chord;
    var ny = dx / chord;
    var spec = halfCircleOutwardCuspArcSpec(fx, fy, p0, p1);
    var d0x = spec.cx - (mx - apothem * nx);
    var d0y = spec.cy - (my - apothem * ny);
    var d1x = spec.cx - (mx + apothem * nx);
    var d1y = spec.cy - (my + apothem * ny);
    return d0x * d0x + d0y * d0y <= d1x * d1x + d1y * d1y ? 0 : 1;
  }

  function halfCircleClosestPointOnArc(spec, tx, ty) {
    var dx = tx - spec.cx;
    var dy = ty - spec.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= 1e-9) {
      var angle = Math.atan2(-dy, dx);
      if (halfCircleAngleInOutwardArc(spec, angle)) {
        return {
          x: spec.cx + spec.r * Math.cos(angle),
          y: spec.cy - spec.r * Math.sin(angle),
        };
      }
    }
    var d0x = tx - spec.p0.x;
    var d0y = ty - spec.p0.y;
    var d1x = tx - spec.p1.x;
    var d1y = ty - spec.p1.y;
    var d0 = d0x * d0x + d0y * d0y;
    var d1 = d1x * d1x + d1y * d1y;
    return d0 <= d1 ? spec.p0 : spec.p1;
  }

  function halfCircleValleyCircleCenter(fx, fy, leftPetal, rightPetal, ribAngle, radius) {
    var avgRadius = (leftPetal.rInner + rightPetal.rInner) * 0.5;
    var valleyRef = halfCirclePolarPoint(fx, fy, avgRadius, ribAngle);
    var leftArc = halfCircleOutwardCuspArcSpec(
      fx,
      fy,
      leftPetal.inLeft,
      leftPetal.inRight
    );
    var rightArc = halfCircleOutwardCuspArcSpec(
      fx,
      fy,
      rightPetal.inLeft,
      rightPetal.inRight
    );
    var pLeft = halfCircleClosestPointOnArc(leftArc, valleyRef.x, valleyRef.y);
    var pRight = halfCircleClosestPointOnArc(rightArc, valleyRef.x, valleyRef.y);
    var b0x = (pLeft.x + pRight.x) * 0.5;
    var b0y = (pLeft.y + pRight.y) * 0.5;
    var toFocalX = b0x - fx;
    var toFocalY = b0y - fy;
    var flen = Math.sqrt(toFocalX * toFocalX + toFocalY * toFocalY);
    if (flen < 1e-9) {
      return { cx: b0x, cy: b0y };
    }
    var ux = toFocalX / flen;
    var uy = toFocalY / flen;
    return {
      cx: b0x + radius * ux,
      cy: b0y + radius * uy,
    };
  }

  function halfCircleStarSilhouettePath(cx, cy, outerRadius, tipAngle, innerRadius) {
    var n = 5;
    var innerR =
      typeof innerRadius === "number" && Number.isFinite(innerRadius)
        ? innerRadius
        : outerRadius * getHalfCircleStarInnerRadiusRatio();
    var d = "";
    var k;
    for (k = 0; k < n; k++) {
      var tip = halfCirclePolarPoint(
        cx,
        cy,
        outerRadius,
        tipAngle - k * 2 * Math.PI / n
      );
      var innerPt = halfCirclePolarPoint(
        cx,
        cy,
        innerR,
        tipAngle - ((2 * k + 1) * Math.PI) / n
      );
      if (k === 0) d = "M " + tip.x + " " + tip.y;
      else d += " L " + tip.x + " " + tip.y;
      d += " L " + innerPt.x + " " + innerPt.y;
    }
    return d + " Z";
  }

  function halfCircleStarInnerPentagonPath(cx, cy, innerConcaveRadius, tipAngle) {
    var n = 5;
    var d = "";
    var k;
    for (k = 0; k < n; k++) {
      var pt = halfCirclePolarPoint(
        cx,
        cy,
        innerConcaveRadius,
        tipAngle - ((2 * k + 1) * Math.PI) / n
      );
      if (k === 0) d = "M " + pt.x + " " + pt.y;
      else d += " L " + pt.x + " " + pt.y;
    }
    return d + " Z";
  }

  function halfCircleStarArmTrianglesPath(cx, cy, outerRadius, innerConcaveRadius, tipAngle) {
    var n = 5;
    var d = "";
    var k;
    for (k = 0; k < n; k++) {
      var tip = halfCirclePolarPoint(
        cx,
        cy,
        outerRadius,
        tipAngle - k * 2 * Math.PI / n
      );
      var rightBase = halfCirclePolarPoint(
        cx,
        cy,
        innerConcaveRadius,
        tipAngle - ((2 * k + 1) * Math.PI) / n
      );
      var leftK = (k - 1 + n) % n;
      var leftBase = halfCirclePolarPoint(
        cx,
        cy,
        innerConcaveRadius,
        tipAngle - ((2 * leftK + 1) * Math.PI) / n
      );
      d +=
        "M " +
        tip.x +
        " " +
        tip.y +
        " L " +
        rightBase.x +
        " " +
        rightBase.y +
        " L " +
        leftBase.x +
        " " +
        leftBase.y +
        " Z ";
    }
    return d.trim();
  }

  function computeHalfCircleValleyCircles(fx, fy, ribs, endpoints, petals) {
    var valleyCount = ribs - 2;
    if (valleyCount <= 0) return [];

    var valleys = [];
    var vi;
    for (vi = 1; vi < ribs - 1; vi++) {
      var leftPetal = petals[vi - 1];
      var rightPetal = petals[vi];
      if (!leftPetal || !rightPetal) continue;
      valleys.push({
        leftPetal: leftPetal,
        rightPetal: rightPetal,
        ribAngle: endpoints[vi].a,
        ribIndex: vi,
      });
    }
    if (!valleys.length) return [];

    function centersForRadius(radius) {
      var centers = [];
      var i;
      for (i = 0; i < valleys.length; i++) {
        centers.push(
          halfCircleValleyCircleCenter(
            fx,
            fy,
            valleys[i].leftPetal,
            valleys[i].rightPetal,
            valleys[i].ribAngle,
            radius
          )
        );
      }
      return centers;
    }

    function minNeighborHalfDist(centers) {
      var minHalf = Infinity;
      var i;
      for (i = 0; i < centers.length - 1; i++) {
        var dx = centers[i + 1].cx - centers[i].cx;
        var dy = centers[i + 1].cy - centers[i].cy;
        var halfDist = Math.sqrt(dx * dx + dy * dy) * 0.5;
        if (halfDist < minHalf) minHalf = halfDist;
      }
      return minHalf;
    }

    var lo = 0.5;
    var hi = 200;
    for (vi = 0; vi < 56; vi++) {
      var trial = (lo + hi) * 0.5;
      var trialCenters = centersForRadius(trial);
      if (minNeighborHalfDist(trialCenters) >= trial - 1e-4) lo = trial;
      else hi = trial;
    }

    var maxTangentRadius = lo;
    if (maxTangentRadius < 0.5) return [];

    var sizeScale = getHalfCircleValleyCircleSizeScale();
    var radius = maxTangentRadius * sizeScale;
    if (radius < 0.5) return [];

    var finalCenters = centersForRadius(radius);
    var circles = [];
    for (vi = 0; vi < valleys.length; vi++) {
      circles.push({
        cx: finalCenters[vi].cx,
        cy: finalCenters[vi].cy,
        r: radius,
        tipAngle: valleys[vi].ribAngle,
        ribIndex: valleys[vi].ribIndex,
        leftPetal: valleys[vi].leftPetal,
        rightPetal: valleys[vi].rightPetal,
      });
    }
    return circles;
  }

  function buildHalfCirclePetals(cx, y, ribs, inset, cuspGap, r, endpoints, deltaTheta) {
    var petals = [];
    var pj;
    for (pj = 0; pj < ribs - 1; pj++) {
      var tLeft = endpoints[pj].a;
      var tRight = endpoints[pj + 1].a;
      var leftInsetAngle;
      var rightInsetAngle;
      if (tLeft < tRight) {
        leftInsetAngle = tLeft + inset * deltaTheta;
        rightInsetAngle = tRight - inset * deltaTheta;
        if (leftInsetAngle >= rightInsetAngle) {
          petals.push(null);
          continue;
        }
      } else {
        leftInsetAngle = tLeft - inset * deltaTheta;
        rightInsetAngle = tRight + inset * deltaTheta;
        if (leftInsetAngle <= rightInsetAngle) {
          petals.push(null);
          continue;
        }
      }

      var rInner = halfCircleInnerEndpointRadiusForGap(
        cx,
        y,
        Math.min(leftInsetAngle, rightInsetAngle),
        Math.max(leftInsetAngle, rightInsetAngle),
        endpoints[pj],
        endpoints[pj + 1],
        cuspGap,
        r
      );

      var inLeft = halfCirclePolarPoint(cx, y, rInner, leftInsetAngle);
      var inRight = halfCirclePolarPoint(cx, y, rInner, rightInsetAngle);

      petals.push({
        inLeft: inLeft,
        inRight: inRight,
        rInner: rInner,
        inLeftAngle: leftInsetAngle,
        inRightAngle: rightInsetAngle,
      });
    }
    return petals;
  }

  function appendHalfCircleFan(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    r,
    ribs,
    visiblePetals,
    anchor
  ) {
    var layout = buildHalfCircleVisibleFanLayout(
      cx,
      focalY,
      r,
      ribs,
      visiblePetals,
      anchor || "left"
    );
    var endpoints = layout.endpoints;
    var visibleRibs = endpoints.length;
    var deltaTheta = layout.deltaTheta;
    var sectorPath = halfCircleSectorPath(
      cx,
      focalY,
      r,
      layout.startAngle,
      layout.endAngle
    );

    if (idPrefix === "top" && designSvg) {
      var defs = designSvg.querySelector("defs");
      if (defs) {
        var existingClip = defs.querySelector("#half-circle-clip");
        if (existingClip && existingClip.parentNode) {
          existingClip.parentNode.removeChild(existingClip);
        }

        var halfCircleClip = elSvg("clipPath");
        halfCircleClip.setAttribute("id", "half-circle-clip");
        var clipPath = elSvg("path");
        clipPath.setAttribute("d", sectorPath);
        halfCircleClip.appendChild(clipPath);
        defs.appendChild(halfCircleClip);
      }
    }

    var inset = getHalfCircleInset();
    var cuspGap = getHalfCircleCuspGapPx() * HALF_CIRCLE_RADIUS_SCALE;
    var firstRib = layout.firstRib;
    var valleyCircles = [];
    if (getHalfCircleValleyCirclesVisible()) {
      var fullFan = buildHalfCircleFullEndpoints(cx, focalY, r, ribs);
      var fullPetals = buildHalfCirclePetals(
        cx,
        focalY,
        ribs,
        inset,
        cuspGap,
        r,
        fullFan.endpoints,
        fullFan.deltaTheta
      );
      var allValleyCircles = computeHalfCircleValleyCircles(
        cx,
        focalY,
        ribs,
        fullFan.endpoints,
        fullPetals
      );
      var vci;
      for (vci = 0; vci < allValleyCircles.length; vci++) {
        var vcCandidate = allValleyCircles[vci];
        if (
          vcCandidate.ribIndex > firstRib &&
          vcCandidate.ribIndex < firstRib + visiblePetals
        ) {
          valleyCircles.push(vcCandidate);
        }
      }
    }

    var fanStrokeOuter = sheetColor("D1");
    var fanStrokeInnerArc = sheetColor("D2");
    var fanStrokeInnerRib = sheetColor("D3");
    var fanStrokeDiagonal = sheetColor("D4");
    var fanStrokeShelf = sheetColor("D5");
    var fanFillPetalFace = sheetColor("D6");
    var fanFillRibStrip = sheetColor("D7");
    var fanFillCuspCap = sheetColor("D8");
    var fanFillArcBand = sheetColor("D9");
    var fanFillCircleGap = sheetColor("D10");
    var fanFillCirclePetalGap = sheetColor("D11");
    var fanFillValleyCircle = sheetColor("E1");
    var fanStrokeValleyCircle = sheetColor("E2");
    var fanFillOuterStar = sheetColor("E3");
    var fanStrokeOuterStar = sheetColor("E4");
    var fanFillInnerStar = sheetColor("E5");
    var fanStrokeInnerStar = sheetColor("E6");
    var fanFillPentagon = sheetColor("E7");
    var fanStrokePentagon = sheetColor("E8");
    var fanFillStarArms = sheetColor("E9");
    var fanStrokeStarArms = sheetColor("E10");

    var bgFill = elSvg("path");
    bgFill.setAttribute("id", "half-circle-background-" + idPrefix);
    bgFill.setAttribute("d", sectorPath);
    bgFill.setAttribute("fill", sheetColor("A2"));
    bgFill.setAttribute("stroke", "none");
    parentGroup.appendChild(bgFill);

    var outer = elSvg("path");
    var pts = endpoints;
    var dOuter = "M " + pts[0].x + " " + pts[0].y;
    var k;
    for (k = 0; k < pts.length - 1; k++) {
      dOuter = appendHalfCircleInwardCuspArc(dOuter, pts[k], pts[k + 1]);
    }
    outer.setAttribute("d", dOuter);
    outer.setAttribute("fill", "none");
    outer.setAttribute("stroke", fanStrokeOuter);
    outer.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
    parentGroup.appendChild(outer);

    var leftBoundary = elSvg("line");
    leftBoundary.setAttribute("x1", String(cx));
    leftBoundary.setAttribute("y1", String(focalY));
    leftBoundary.setAttribute("x2", String(endpoints[0].x));
    leftBoundary.setAttribute("y2", String(endpoints[0].y));
    leftBoundary.setAttribute("stroke", fanStrokeOuter);
    leftBoundary.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
    parentGroup.appendChild(leftBoundary);

    var rightBoundary = elSvg("line");
    rightBoundary.setAttribute("x1", String(cx));
    rightBoundary.setAttribute("y1", String(focalY));
    rightBoundary.setAttribute("x2", String(endpoints[visibleRibs - 1].x));
    rightBoundary.setAttribute("y2", String(endpoints[visibleRibs - 1].y));
    rightBoundary.setAttribute("stroke", fanStrokeOuter);
    rightBoundary.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
    parentGroup.appendChild(rightBoundary);

    var innerArcRadius = r * getHalfCircleInnerArcRadiusRatio();
    var innerArcGap = HALF_CIRCLE_INNER_ARC_PAIR_GAP_PX * HALF_CIRCLE_RADIUS_SCALE;
    var outerArcRadius =
      innerArcRadius + innerArcGap + HALF_CIRCLE_FAN_STROKE_WIDTH;
    var innerArcPair = elSvg("g");
    innerArcPair.setAttribute("id", "half-circle-inner-arc-pair-" + idPrefix);

    var innerArc = elSvg("path");
    innerArc.setAttribute("id", "half-circle-inner-arc-" + idPrefix);
    innerArc.setAttribute(
      "d",
      halfCircleFocalArcPath(
        cx,
        focalY,
        innerArcRadius,
        layout.startAngle,
        layout.endAngle
      )
    );
    innerArc.setAttribute("fill", "none");
    innerArc.setAttribute("stroke", fanStrokeInnerArc);
    innerArc.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
    innerArcPair.appendChild(innerArc);

    var outerInnerArc = elSvg("path");
    outerInnerArc.setAttribute("id", "half-circle-inner-arc-outer-" + idPrefix);
    outerInnerArc.setAttribute(
      "d",
      halfCircleFocalArcPath(
        cx,
        focalY,
        outerArcRadius,
        layout.startAngle,
        layout.endAngle
      )
    );
    outerInnerArc.setAttribute("fill", "none");
    outerInnerArc.setAttribute("stroke", fanStrokeInnerArc);
    outerInnerArc.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
    innerArcPair.appendChild(outerInnerArc);

    parentGroup.appendChild(innerArcPair);

    var petals = buildHalfCirclePetals(
      cx,
      focalY,
      visibleRibs,
      inset,
      cuspGap,
      r,
      endpoints,
      deltaTheta
    );

    var petalFillsGroup = elSvg("g");
    petalFillsGroup.setAttribute("id", "half-circle-petal-fills-" + idPrefix);
    var pfi;
    for (pfi = 0; pfi < petals.length; pfi++) {
      var fillPetal = petals[pfi];
      if (!fillPetal) continue;

      var petalFace = elSvg("path");
      petalFace.setAttribute(
        "d",
        halfCirclePetalFaceFillPath(
          cx,
          focalY,
          endpoints[pfi],
          endpoints[pfi + 1],
          fillPetal.inLeft,
          fillPetal.inRight
        )
      );
      petalFace.setAttribute("fill", fanFillPetalFace);
      petalFace.setAttribute("fill-rule", "evenodd");
      petalFace.setAttribute("stroke", "none");
      petalFillsGroup.appendChild(petalFace);

      var bandCell = elSvg("path");
      bandCell.setAttribute(
        "d",
        halfCircleInnerArcBandCellPath(
          cx,
          focalY,
          innerArcRadius,
          outerArcRadius,
          fillPetal.inLeftAngle,
          fillPetal.inRightAngle
        )
      );
      bandCell.setAttribute("fill", fanFillArcBand);
      bandCell.setAttribute("stroke", "none");
      petalFillsGroup.appendChild(bandCell);
    }
    parentGroup.insertBefore(petalFillsGroup, outer);

    if (getHalfCircleInnerArcDiagonalsVisible()) {
      var diagonalGroup = elSvg("g");
      diagonalGroup.setAttribute("id", "half-circle-inner-arc-diagonals-" + idPrefix);
      var cellIndex = 0;
      var pi;
      for (pi = 0; pi < petals.length; pi++) {
        var diagonalPetal = petals[pi];
        if (!diagonalPetal) continue;

        var pointA = halfCirclePolarPoint(
          cx,
          focalY,
          innerArcRadius,
          diagonalPetal.inLeftAngle
        );
        var pointB = halfCirclePolarPoint(
          cx,
          focalY,
          innerArcRadius,
          diagonalPetal.inRightAngle
        );
        var pointC = halfCirclePolarPoint(
          cx,
          focalY,
          outerArcRadius,
          diagonalPetal.inLeftAngle
        );
        var pointD = halfCirclePolarPoint(
          cx,
          focalY,
          outerArcRadius,
          diagonalPetal.inRightAngle
        );

        var diagonal = elSvg("line");
        if (cellIndex % 2 === 0) {
          diagonal.setAttribute("x1", String(pointA.x));
          diagonal.setAttribute("y1", String(pointA.y));
          diagonal.setAttribute("x2", String(pointD.x));
          diagonal.setAttribute("y2", String(pointD.y));
        } else {
          diagonal.setAttribute("x1", String(pointB.x));
          diagonal.setAttribute("y1", String(pointB.y));
          diagonal.setAttribute("x2", String(pointC.x));
          diagonal.setAttribute("y2", String(pointC.y));
        }
        diagonal.setAttribute("fill", "none");
        diagonal.setAttribute("stroke", fanStrokeDiagonal);
        diagonal.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
        diagonalGroup.appendChild(diagonal);
        cellIndex++;
      }
      parentGroup.appendChild(diagonalGroup);
    }

    var innerGroup = elSvg("g");
    innerGroup.setAttribute("id", "half-circle-inner-petals-" + idPrefix);
    var pj;
    for (pj = 0; pj < petals.length; pj++) {
      var petal = petals[pj];
      if (!petal) continue;

      var inLeft = petal.inLeft;
      var inRight = petal.inRight;

      var leftStripFill = elSvg("path");
      leftStripFill.setAttribute(
        "d",
        halfCircleRibStripFillPath(
          cx,
          focalY,
          endpoints[pj].a,
          inLeft,
          petal.rInner,
          "left"
        )
      );
      leftStripFill.setAttribute("fill", fanFillRibStrip);
      leftStripFill.setAttribute("stroke", "none");
      innerGroup.appendChild(leftStripFill);

      var rightStripFill = elSvg("path");
      rightStripFill.setAttribute(
        "d",
        halfCircleRibStripFillPath(
          cx,
          focalY,
          endpoints[pj + 1].a,
          inRight,
          petal.rInner,
          "right"
        )
      );
      rightStripFill.setAttribute("fill", fanFillRibStrip);
      rightStripFill.setAttribute("stroke", "none");
      innerGroup.appendChild(rightStripFill);

      if (getHalfCircleValleyCirclesVisible() && valleyCircles.length > 0) {
        var capShelfRadius = halfCircleValleyShelfRadius(cx, focalY, valleyCircles);
        if (capShelfRadius > 0) {
          var petalCapPath = halfCirclePetalShelfCuspCapPath(
            cx,
            focalY,
            capShelfRadius,
            petal
          );
          if (petalCapPath) {
            var petalCapFill = elSvg("path");
            petalCapFill.setAttribute("d", petalCapPath);
            petalCapFill.setAttribute("fill", fanFillCuspCap);
            petalCapFill.setAttribute("stroke", "none");
            innerGroup.appendChild(petalCapFill);
          }
        }
      }

      var innerLeftRib = elSvg("line");
      innerLeftRib.setAttribute("x1", String(cx));
      innerLeftRib.setAttribute("y1", String(focalY));
      innerLeftRib.setAttribute("x2", String(inLeft.x));
      innerLeftRib.setAttribute("y2", String(inLeft.y));
      innerLeftRib.setAttribute("stroke", fanStrokeInnerRib);
      innerLeftRib.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
      innerGroup.appendChild(innerLeftRib);

      var innerRightRib = elSvg("line");
      innerRightRib.setAttribute("x1", String(cx));
      innerRightRib.setAttribute("y1", String(focalY));
      innerRightRib.setAttribute("x2", String(inRight.x));
      innerRightRib.setAttribute("y2", String(inRight.y));
      innerRightRib.setAttribute("stroke", fanStrokeInnerRib);
      innerRightRib.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
      innerGroup.appendChild(innerRightRib);

      var dInnerCusp = "M " + inLeft.x + " " + inLeft.y;
      dInnerCusp = appendHalfCircleOutwardCuspArc(
        dInnerCusp,
        inLeft,
        inRight,
        cx,
        focalY
      );
      var innerCusp = elSvg("path");
      innerCusp.setAttribute("d", dInnerCusp);
      innerCusp.setAttribute("fill", "none");
      innerCusp.setAttribute("stroke", fanStrokeInnerRib);
      innerCusp.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
      innerGroup.appendChild(innerCusp);
    }
    parentGroup.appendChild(innerGroup);

    if (valleyCircles.length > 0) {
      var shelfRadius = halfCircleValleyShelfRadius(cx, focalY, valleyCircles);
      var valleyGapGroup = null;
      if (shelfRadius > 0) {
        valleyGapGroup = elSvg("g");
        valleyGapGroup.setAttribute("id", "half-circle-valley-gaps-" + idPrefix);
        var gi;
        for (gi = 0; gi < valleyCircles.length - 1; gi++) {
          var gapPathD = halfCircleValleyGapFillPath(
            cx,
            focalY,
            shelfRadius,
            valleyCircles[gi],
            valleyCircles[gi + 1]
          );
          if (!gapPathD) continue;
          var gapFill = elSvg("path");
          gapFill.setAttribute("d", gapPathD);
          gapFill.setAttribute("fill", fanFillCircleGap);
          gapFill.setAttribute("stroke", "none");
          valleyGapGroup.appendChild(gapFill);
        }

        for (gi = 0; gi < valleyCircles.length; gi++) {
          var vcGap = valleyCircles[gi];
          if (vcGap.leftPetal) {
            var petalCircleGap = halfCirclePetalCircleGapFillPath(
              cx,
              focalY,
              shelfRadius,
              vcGap.leftPetal,
              vcGap
            );
            if (petalCircleGap) {
              var petalCircleFill = elSvg("path");
              petalCircleFill.setAttribute("d", petalCircleGap);
              petalCircleFill.setAttribute("fill", fanFillCirclePetalGap);
              petalCircleFill.setAttribute("stroke", "none");
              valleyGapGroup.appendChild(petalCircleFill);
            }
          }
          if (vcGap.rightPetal) {
            var circlePetalGap = halfCircleCirclePetalGapFillPath(
              cx,
              focalY,
              shelfRadius,
              vcGap,
              vcGap.rightPetal
            );
            if (circlePetalGap) {
              var circlePetalFill = elSvg("path");
              circlePetalFill.setAttribute("d", circlePetalGap);
              circlePetalFill.setAttribute("fill", fanFillCirclePetalGap);
              circlePetalFill.setAttribute("stroke", "none");
              valleyGapGroup.appendChild(circlePetalFill);
            }
          }
        }
        parentGroup.appendChild(valleyGapGroup);
      }

      var valleyGroup = elSvg("g");
      valleyGroup.setAttribute("id", "half-circle-valley-circles-" + idPrefix);
      var vc;
      for (vc = 0; vc < valleyCircles.length; vc++) {
        var valleyCircle = valleyCircles[vc];
        var circle = elSvg("circle");
        circle.setAttribute("cx", String(valleyCircle.cx));
        circle.setAttribute("cy", String(valleyCircle.cy));
        circle.setAttribute("r", String(valleyCircle.r));
        circle.setAttribute("fill", fanFillValleyCircle);
        circle.setAttribute("stroke", fanStrokeValleyCircle);
        circle.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
        valleyGroup.appendChild(circle);

        var starRatio = getHalfCircleStarInnerRadiusRatio();
        var outerStarInnerR = valleyCircle.r * starRatio;
        var innerStarTipAngle = valleyCircle.tipAngle - Math.PI / 5;

        var star = elSvg("path");
        star.setAttribute(
          "d",
          halfCircleStarSilhouettePath(
            valleyCircle.cx,
            valleyCircle.cy,
            valleyCircle.r,
            valleyCircle.tipAngle
          )
        );
        star.setAttribute("fill", fanFillOuterStar);
        star.setAttribute("stroke", fanStrokeOuterStar);
        star.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
        star.setAttribute("stroke-linejoin", "round");
        valleyGroup.appendChild(star);

        var innerStar = elSvg("path");
        innerStar.setAttribute(
          "d",
          halfCircleStarSilhouettePath(
            valleyCircle.cx,
            valleyCircle.cy,
            outerStarInnerR,
            innerStarTipAngle,
            outerStarInnerR * starRatio
          )
        );
        innerStar.setAttribute("fill", fanFillInnerStar);
        innerStar.setAttribute("stroke", fanStrokeInnerStar);
        innerStar.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
        innerStar.setAttribute("stroke-linejoin", "round");
        valleyGroup.appendChild(innerStar);

        var innerStarInnerR = outerStarInnerR * starRatio;
        var starArms = elSvg("path");
        starArms.setAttribute(
          "d",
          halfCircleStarArmTrianglesPath(
            valleyCircle.cx,
            valleyCircle.cy,
            outerStarInnerR,
            innerStarInnerR,
            innerStarTipAngle
          )
        );
        starArms.setAttribute("fill", fanFillStarArms);
        starArms.setAttribute("stroke", fanStrokeStarArms);
        starArms.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
        starArms.setAttribute("stroke-linejoin", "round");
        valleyGroup.appendChild(starArms);

        var pentagon = elSvg("path");
        pentagon.setAttribute(
          "d",
          halfCircleStarInnerPentagonPath(
            valleyCircle.cx,
            valleyCircle.cy,
            innerStarInnerR,
            innerStarTipAngle
          )
        );
        pentagon.setAttribute("fill", fanFillPentagon);
        pentagon.setAttribute("stroke", fanStrokePentagon);
        pentagon.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
        pentagon.setAttribute("stroke-linejoin", "round");
        valleyGroup.appendChild(pentagon);
      }

      parentGroup.appendChild(valleyGroup);

      if (valleyCircles.length > 0) {
        var shelfSpec = halfCircleValleyShelfArcSpec(cx, focalY, valleyCircles);
        if (shelfSpec && shelfSpec.radius > 0) {
          var shelfArc = elSvg("path");
          shelfArc.setAttribute("id", "half-circle-circle-shelf-arc-" + idPrefix);
          shelfArc.setAttribute(
            "d",
            halfCircleValleyShelfArcPath(cx, focalY, shelfSpec)
          );
          shelfArc.setAttribute("fill", "none");
          shelfArc.setAttribute("stroke", fanStrokeShelf);
          shelfArc.setAttribute("stroke-width", String(HALF_CIRCLE_FAN_STROKE_WIDTH));
          parentGroup.appendChild(shelfArc);
        }
      }
    }
  }

  function renderHalfCircleLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-half-circle");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    var showTop = getHalfCircleVisible();
    var showBottom = getHalfCircleBottomVisible();
    if (!showTop && !showBottom) return;

    var diameter = Math.max(0, CANVAS_W - 100);
    var r = (diameter / 2) * HALF_CIRCLE_RADIUS_SCALE;
    var cx = CANVAS_W / 2;
    var ribs = getHalfCircleRibCount();
    var topVisiblePetals = showTop ? getHalfCircleTopVisiblePetalCount() : 0;
    var bottomVisiblePetals = showBottom
      ? getHalfCircleBottomVisiblePetalCount()
      : 0;

    if (topVisiblePetals <= 0 && bottomVisiblePetals <= 0) {
      return;
    }

    if (showTop && topVisiblePetals > 0) {
      var topG = elSvg("g");
      topG.setAttribute("id", "half-circle-top");
      appendHalfCircleFan(
        topG,
        "top",
        cx,
        HALF_CIRCLE_FOCAL_Y,
        r,
        ribs,
        topVisiblePetals
      );
      layer.appendChild(topG);
    }

    if (showBottom && bottomVisiblePetals > 0) {
      var bottomG = elSvg("g");
      bottomG.setAttribute("id", "half-circle-bottom");
      bottomG.setAttribute("transform", getHalfCircleVerticalMirrorTransform());
      appendHalfCircleFan(
        bottomG,
        "bottom",
        cx,
        HALF_CIRCLE_FOCAL_Y,
        r,
        ribs,
        bottomVisiblePetals,
        "right"
      );
      layer.appendChild(bottomG);
    }
  }

  function shouldExportHalfCircleLayer() {
    if (!getHalfCircleVisible() && !getHalfCircleBottomVisible()) return false;
    if (getHalfCircleVisible() && getHalfCircleTopVisiblePetalCount() > 0) {
      return true;
    }
    if (getHalfCircleBottomVisible() && getHalfCircleBottomVisiblePetalCount() > 0) {
      return true;
    }
    return false;
  }

  function pushHalfCircleExportLines(lines) {
    if (!shouldExportHalfCircleLayer() || !designSvg) return;
    var layer = designSvg.querySelector("#layer-half-circle");
    if (!layer || !layer.firstChild) return;
    lines.push('<g id="layer-half-circle">');
    lines.push(layer.innerHTML);
    lines.push("</g>");
  }

  function isFrameInsetOverlayVisibleOnCanvas() {
    if (!designSvg) return frameInsetOverlayVisible;
    var layer = designSvg.querySelector("#layer-frame-inset-overlay");
    if (!layer) return frameInsetOverlayVisible;
    return layer.style.display !== "none";
  }

  function renderDiamondFillsLayer() {
    if (!designSvg) return;
    var diamondLayer = designSvg.querySelector("#layer-diamond-fills");
    if (!diamondLayer) return;

    while (diamondLayer.firstChild) diamondLayer.removeChild(diamondLayer.firstChild);

    var filled = getFilledDiamonds();
    if (filled.length) diamondLayer.appendChild(diamondsToGroup(filled));
  }

  function renderHollowDiamondFillsLayer() {
    if (!designSvg) return;
    var hollowLayer = designSvg.querySelector("#layer-hollow-diamond-fills");
    if (!hollowLayer) return;

    while (hollowLayer.firstChild) hollowLayer.removeChild(hollowLayer.firstChild);

    var filled = getFilledHollowDiamonds();
    if (filled.length) hollowLayer.appendChild(hollowDiamondsToGroup(filled));
  }

  function renderPatternLayer() {
    if (!designSvg) return;
    var patternLayer = designSvg.querySelector("#layer-pattern");
    if (!patternLayer) return;

    if (isStarGrid()) {
      renderDiamondFillsLayer();
      renderHollowDiamondFillsLayer();
      while (patternLayer.firstChild) {
        patternLayer.removeChild(patternLayer.firstChild);
      }
      if (cachedStarFills.length) {
        patternLayer.appendChild(starFillsToGroup(cachedStarFills));
      }
      patternLayer.appendChild(
        segmentsToGroup(getVisibleSegments(getAllSegmentsForTracing()))
      );
      var starHelplessnessMarks = getActiveHelplessnessMarks();
      if (starHelplessnessMarks.length) {
        patternLayer.appendChild(helplessnessToGroup(starHelplessnessMarks));
      }
      var starCircles = getActiveCircles();
      if (starCircles.length) {
        patternLayer.appendChild(circlesToGroup(starCircles));
      }
      var starLongingCircles = getActiveLongingCircles();
      if (starLongingCircles.length) {
        patternLayer.appendChild(longingCirclesToGroup(starLongingCircles));
      }
      var starGriefCircles = getActiveGriefCircles();
      if (starGriefCircles.length) {
        patternLayer.appendChild(griefCirclesToGroup(starGriefCircles));
      }
      return;
    }

    renderDiamondFillsLayer();
    renderHollowDiamondFillsLayer();
    while (patternLayer.firstChild) patternLayer.removeChild(patternLayer.firstChild);
    patternLayer.appendChild(
      segmentsToGroup(getVisibleSegments(cachedAllSegments))
    );
    var helplessnessMarks = getActiveHelplessnessMarks();
    if (helplessnessMarks.length) {
      patternLayer.appendChild(helplessnessToGroup(helplessnessMarks));
    }
    var circles = getActiveCircles();
    if (circles.length) {
      patternLayer.appendChild(circlesToGroup(circles));
    }
    var longingCircles = getActiveLongingCircles();
    if (longingCircles.length) {
      patternLayer.appendChild(longingCirclesToGroup(longingCircles));
    }
    var griefCircles = getActiveGriefCircles();
    if (griefCircles.length) {
      patternLayer.appendChild(griefCirclesToGroup(griefCircles));
    }
  }

  /**
   * Star grid: pattern, Hope stipple, merge mask, border, Anger lines, Pride auto-merge.
   */
  function renderStarGrid() {
    applyStarGridLayerVisibility();
    updateInnerContentTransformForGridType();

    var starLayout = getStarLayout();
    var slider = document.getElementById("octagons-n");
    if (slider) slider.value = String(starLayout.n);

    var outN = document.getElementById("octagons-n-out");
    if (outN) outN.textContent = String(starLayout.n);

    var actualT =
      typeof NestedStarOctagonsGeometry !== "undefined" &&
      NestedStarOctagonsGeometry.roundCoord
        ? NestedStarOctagonsGeometry.roundCoord(starLayout.tileSize)
        : Math.round(starLayout.tileSize * 100) / 100;

    var info = document.getElementById("tile-info");
    if (info) {
      info.textContent =
        starLayout.n +
        " complete/row · " +
        starLayout.m +
        " complete/col · " +
        actualT +
        " px tile";
    }

    var borderSideOut = document.getElementById("border-side-segments-out");
    if (borderSideOut) {
      borderSideOut.textContent = borderSideThicknessLabel(
        getBorderSideThicknessColumns()
      );
    }
    syncBorderSideWhiteFillOutput();

    var angerLengthOut = document.getElementById("anger-vertical-length-out");
    if (angerLengthOut) {
      angerLengthOut.textContent = String(getAngerVerticalLengthPercent()) + "%";
    }
    syncAnxietyVerticalStrokeOutput();

    var circleSig = buildCircleLayoutSignature();
    if (circleSig !== lastCircleLayoutSignature) {
      lastCircleLayoutSignature = circleSig;
      syncCircleSelection(true);
    }
    if (circleSig !== lastLongingCircleLayoutSignature) {
      lastLongingCircleLayoutSignature = circleSig;
      syncLongingCircleSelection(true);
    }
    if (circleSig !== lastGriefCircleLayoutSignature) {
      lastGriefCircleLayoutSignature = circleSig;
      syncGriefCircleSelection(true);
    }
    var helplessnessSig = buildHelplessnessLayoutSignature();
    if (helplessnessSig !== lastHelplessnessLayoutSignature) {
      lastHelplessnessLayoutSignature = helplessnessSig;
      syncHelplessnessSelection(true);
    }

    var diamondSig = buildDiamondLayoutSignature();
    if (diamondSig !== lastDiamondLayoutSignature) {
      lastDiamondLayoutSignature = diamondSig;
      syncDiamondFill(false);
      syncGuiltShameDiamondFill(false);
    }

    var densityOut = document.getElementById("circle-density-out");
    if (densityOut) densityOut.textContent = String(getCircleDensity()) + "%";

    var longingDensityOut = document.getElementById("longing-circle-density-out");
    if (longingDensityOut) {
      longingDensityOut.textContent = String(getLongingCircleDensity()) + "%";
    }

    var griefDensityOut = document.getElementById("grief-circle-density-out");
    if (griefDensityOut) {
      griefDensityOut.textContent = String(getGriefCircleDensity()) + "%";
    }

    var helplessnessOut = document.getElementById("helplessness-percent-out");
    if (helplessnessOut) {
      helplessnessOut.textContent = String(getHelplessnessPercent()) + "%";
    }

    var prideFillOut = document.getElementById("pride-fill-percent-out");
    if (prideFillOut) {
      prideFillOut.textContent = String(getPrideFillPercent()) + "%";
    }

    var guiltShameFillOut = document.getElementById("guilt-shame-fill-percent-out");
    if (guiltShameFillOut) {
      guiltShameFillOut.textContent = String(getGuiltShameFillPercent()) + "%";
    }

    var fill = designSvg.querySelector("#canvas-background-fill");
    if (fill) fill.setAttribute("fill", getCanvasBackgroundColor());

    updateAutoMergeIntensityOutput();

    refreshBorderFrameAndLabelBars();
    syncVerticalGridLines(false);
    renderVerticalGridLayer();
    renderBackgroundLayer();
    renderPatternLayer();
    renderHalfCircleLayer();
    renderGridMaskLayer("render");
    renderStippleDotsLayer();
    applyMergeReveal();
    renderAutoMergeFillsLayer();
    updateGridBoundaryRect();
    updateColorDivisionsLayer();
    layoutStage();
    updateResetButton();
  }

  function applySheetPaletteToDom() {
    if (!designSvg) return;
    updateCanvasBackgroundColor();
    invalidateLabelBarSvgTintCache();
    refreshHopeColoredExportDataUri();
    syncMagnifierBorderColor();
  }

  function render() {
    if (window.SheetPalettes) window.SheetPalettes.syncBorderGlobals();
    updateLayoutState();

    var outN = document.getElementById("octagons-n-out");
    if (outN) outN.textContent = String(lastOctagonsN);

    if (!designSvg) {
      designSvg = createDesignSvg();
      var wrap = document.getElementById("stage-wrap");
      if (wrap) wrap.appendChild(designSvg);
      refreshBrownBarBannerAfterMount();
    }

    cachedAllSegments = buildAllSegments();

    if (isStarGrid()) {
      renderStarGrid();
      return;
    }

    applyOctagonGridLayerVisibility();
    updateInnerContentTransformForGridType();

    var innerScale = getInnerScale();
    var outInner = document.getElementById("inner-scale-out");
    if (outInner) outInner.textContent = String(innerScale);

    var layout = TopkapiGeometry.computeLayout(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H
    );
    var info = document.getElementById("tile-info");
    if (info) {
      info.textContent =
        "Tile " +
        Math.round(layout.tileSize * 100) / 100 +
        " px · " +
        (lastOctagonsN + 1) +
        " across · " +
        (layout.m + 1) +
        " down (symmetric clip)";
    }

    var layoutSig = buildCircleLayoutSignature();
    if (layoutSig !== lastCircleLayoutSignature) {
      lastCircleLayoutSignature = layoutSig;
      syncCircleSelection(true);
    }
    if (layoutSig !== lastLongingCircleLayoutSignature) {
      lastLongingCircleLayoutSignature = layoutSig;
      syncLongingCircleSelection(true);
    }
    if (layoutSig !== lastGriefCircleLayoutSignature) {
      lastGriefCircleLayoutSignature = layoutSig;
      syncGriefCircleSelection(true);
    }
    var helplessnessSig = buildHelplessnessLayoutSignature();
    if (helplessnessSig !== lastHelplessnessLayoutSignature) {
      lastHelplessnessLayoutSignature = helplessnessSig;
      syncHelplessnessSelection(true);
    }

    var diamondSig = buildDiamondLayoutSignature();
    if (diamondSig !== lastDiamondLayoutSignature) {
      lastDiamondLayoutSignature = diamondSig;
      syncDiamondFill(false);
      syncGuiltShameDiamondFill(false);
    }

    var densityOut = document.getElementById("circle-density-out");
    if (densityOut) densityOut.textContent = String(getCircleDensity()) + "%";

    var longingDensityOut = document.getElementById("longing-circle-density-out");
    if (longingDensityOut) {
      longingDensityOut.textContent = String(getLongingCircleDensity()) + "%";
    }

    var griefDensityOut = document.getElementById("grief-circle-density-out");
    if (griefDensityOut) {
      griefDensityOut.textContent = String(getGriefCircleDensity()) + "%";
    }

    var helplessnessOut = document.getElementById("helplessness-percent-out");
    if (helplessnessOut) {
      helplessnessOut.textContent = String(getHelplessnessPercent()) + "%";
    }

    var prideFillOut = document.getElementById("pride-fill-percent-out");
    if (prideFillOut) {
      prideFillOut.textContent = String(getPrideFillPercent()) + "%";
    }

    var guiltShameFillOut = document.getElementById("guilt-shame-fill-percent-out");
    if (guiltShameFillOut) {
      guiltShameFillOut.textContent = String(getGuiltShameFillPercent()) + "%";
    }

    updateAutoMergeIntensityOutput();

    var angerLengthOut = document.getElementById("anger-vertical-length-out");
    if (angerLengthOut) {
      angerLengthOut.textContent = String(getAngerVerticalLengthPercent()) + "%";
    }
    syncAnxietyVerticalStrokeOutput();

    var borderSideOut = document.getElementById("border-side-segments-out");
    if (borderSideOut) {
      borderSideOut.textContent = borderSideThicknessLabel(
        getBorderSideThicknessColumns()
      );
    }
    syncBorderSideWhiteFillOutput();

    applySheetPaletteToDom();
    renderBackgroundLayer();
    renderGridMaskLayer("render");
    renderStippleDotsLayer();
    applyMergeReveal();
    syncVerticalGridLines(false);
    renderVerticalGridLayer();
    renderAutoMergeFillsLayer();
    updateGridBoundaryRect();
    updateBorderDivisionLines();
    updateColorDivisionsLayer();
    updateBorderDivisionOverlay();
    updateCanvasEdgeBrownBars();
    renderPatternLayer();
    renderHalfCircleLayer();
    updateFrameInsetOverlayLayer();
    layoutStage();
    updateResetButton();
  }

  function renderAfterSliderChange() {
    var hadAutoMerge = autoMergeEdgeKeys.size > 0;
    clearMergeState();
    clearAutoMergeState();
    render();
    if (hadAutoMerge) {
      runAutoMerge();
    }
  }

  function randomIntInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomSteppedValue(min, max, step) {
    var steps = Math.round((max - min) / step);
    var n = Math.floor(Math.random() * (steps + 1));
    var value = min + n * step;
    if (step < 1) {
      var decimals = String(step).indexOf(".") >= 0
        ? String(step).split(".")[1].length
        : 2;
      value = Number(value.toFixed(decimals));
    }
    return value;
  }

  function setSliderValue(id, value) {
    var slider = document.getElementById(id);
    if (!slider) return;
    slider.value = String(value);
  }

  function applyRandomPaletteColors() {
    if (window.SheetPalettes) window.SheetPalettes.pickRandomPalette();
  }

  function initSheetPaletteControls() {
    if (!window.SheetPalettes) return;

    var container = document.getElementById("sheet-palette-buttons");
    if (container) {
      var buttons = container.querySelectorAll("[data-palette-key]");
      var i;
      for (i = 0; i < buttons.length; i++) {
        (function (btn) {
          btn.addEventListener("click", function () {
            var key = btn.getAttribute("data-palette-key");
            if (key && window.SheetPalettes.setActivePalette(key)) {
              applySheetPaletteToDom();
              render();
            }
          });
        })(buttons[i]);
      }
    }

    var randomBtn = document.getElementById("sheet-palette-random-btn");
    if (randomBtn) {
      randomBtn.addEventListener("click", function () {
        window.SheetPalettes.pickRandomPalette();
        render();
      });
    }

    window.SheetPalettes.updatePaletteButtonStates();
  }

  function applyRandomPaletteColorsAndRender() {
    applyRandomPaletteColors();
    render();
  }

  function randomizeAllDesignControls() {
    applyRandomPaletteColors();
    setSliderValue("octagons-n", randomIntInRange(OCTAGONS_N_MIN, OCTAGONS_N_MAX));
    setSliderValue(
      "inner-scale",
      randomSteppedValue(INNER_SCALE_MIN, INNER_SCALE_MAX, 0.01)
    );
    setSliderValue(
      "border-side-segments",
      randomIntInRange(1, 3)
    );
    setSliderValue(
      "border-side-white-fill",
      randomIntInRange(
        BORDER_SIDE_WHITE_FILL_MIN,
        BORDER_SIDE_WHITE_FILL_MAX
      )
    );
    setSliderValue(
      "anger-vertical-length",
      randomIntInRange(ANGER_VERTICAL_LENGTH_MIN, ANGER_VERTICAL_LENGTH_MAX)
    );
    setSliderValue(
      "anxiety-vertical-stroke",
      randomIntInRange(ANXIETY_VERTICAL_STROKE_MIN, ANXIETY_VERTICAL_STROKE_MAX)
    );
    setSliderValue(
      "circle-density",
      randomIntInRange(CIRCLE_DENSITY_MIN, CIRCLE_DENSITY_MAX)
    );
    setSliderValue(
      "longing-circle-density",
      randomIntInRange(CIRCLE_DENSITY_MIN, CIRCLE_DENSITY_MAX)
    );
    setSliderValue(
      "grief-circle-density",
      randomIntInRange(CIRCLE_DENSITY_MIN, CIRCLE_DENSITY_MAX)
    );
    setSliderValue(
      "pride-fill-percent",
      randomIntInRange(PRIDE_FILL_PERCENT_MIN, PRIDE_FILL_PERCENT_MAX)
    );
    setSliderValue(
      "guilt-shame-fill-percent",
      randomIntInRange(GUILT_SHAME_FILL_PERCENT_MIN, GUILT_SHAME_FILL_PERCENT_MAX)
    );
    setSliderValue(
      "helplessness-percent",
      randomIntInRange(HELPLESSNESS_PERCENT_MIN, HELPLESSNESS_PERCENT_MAX)
    );

    regenerateBorderSideSegmentRatios();
    syncBorderSideWhiteCells(true);
    clearMergeState();
    syncCircleSelection(true);
    syncLongingCircleSelection(true);
    syncGriefCircleSelection(true);
    syncHelplessnessSelection(true);
    syncPrideShapes();
    syncGuiltShameShapes();
    render();
  }

  function layoutStage() {
    var wrap = document.getElementById("stage-wrap");
    var svg = document.getElementById("design-svg");
    if (!wrap || !svg) return;
    var rect = wrap.getBoundingClientRect();
    var availW = Math.max(60, rect.width - VIEW_MARGIN * 2);
    var availH = Math.max(60, rect.height - VIEW_MARGIN * 2);
    var scale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
    svg.style.width = CANVAS_W * scale + "px";
    svg.style.height = CANVAS_H * scale + "px";
  }

  function getMagnifierZoom() {
    var input = document.getElementById("magnifier-zoom");
    if (!input) return 4;
    var z = parseFloat(input.value);
    if (!isFinite(z)) return 4;
    return Math.min(15, Math.max(2, z));
  }

  function updateMagnifierZoomOutput() {
    var out = document.getElementById("magnifier-zoom-out");
    if (out) out.textContent = String(getMagnifierZoom()) + "×";
  }

  function syncMagnifierBorderColor() {
    var color = getPatternStrokeColor();
    document.documentElement.style.setProperty(
      "--magnifier-border-color",
      color
    );
  }

  function updateMagnifierViewBox() {
    var magnifierSvg = document.getElementById("magnifier-svg");
    if (!magnifierSvg) return;

    var zoom = getMagnifierZoom();
    var side = Math.min(CANVAS_W, CANVAS_H) / zoom;
    var x = magnifierCenterX - side / 2;
    var y = magnifierCenterY - side / 2;

    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + side > CANVAS_W) x = CANVAS_W - side;
    if (y + side > CANVAS_H) y = CANVAS_H - side;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    magnifierSvg.setAttribute(
      "viewBox",
      x + " " + y + " " + side + " " + side
    );
  }

  function syncMagnifierUseGeometry() {
    var useEl = document.getElementById("magnifier-use");
    if (!useEl) return;
    useEl.setAttribute("width", String(CANVAS_W));
    useEl.setAttribute("height", String(CANVAS_H));
  }

  function onMagnifierPointerMove(e) {
    if (!designSvg) return;
    var pt = clientToViewBox(designSvg, e.clientX, e.clientY);
    if (!pt) return;
    magnifierCenterX = pt.x;
    magnifierCenterY = pt.y;
    updateMagnifierViewBox();
  }

  function bindMagnifierPointerListeners() {
    if (!designSvg || magnifierListenersBound) return;
    designSvg.addEventListener("pointermove", onMagnifierPointerMove);
    magnifierListenersBound = true;
  }

  function initMagnifier() {
    syncMagnifierUseGeometry();
    syncMagnifierBorderColor();
    updateMagnifierZoomOutput();
    updateMagnifierViewBox();
    bindMagnifierPointerListeners();

    var zoomSlider = document.getElementById("magnifier-zoom");
    if (zoomSlider) {
      zoomSlider.addEventListener("input", function () {
        updateMagnifierZoomOutput();
        updateMagnifierViewBox();
      });
    }
  }

  function getExportFontFaceCss(fontDataUri) {
    var src = fontDataUri
      ? 'url("' + fontDataUri + '") format("truetype")'
      : 'url("../fonts/DIN%20Condensed%20Bold.ttf") format("truetype")';
    return (
      '@font-face{font-family:"DIN Condensed";src:' +
      src +
      ";font-weight:700;font-style:normal;}"
    );
  }

  function loadExportFontDataUri() {
    if (cachedExportFontDataUri) {
      return Promise.resolve(cachedExportFontDataUri);
    }
    return fetch("fonts/DIN%20Condensed%20Bold.ttf")
      .then(function (res) {
        if (!res.ok) throw new Error("font fetch failed");
        return res.arrayBuffer();
      })
      .then(function (buf) {
        var bytes = new Uint8Array(buf);
        var binary = "";
        var i;
        for (i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        cachedExportFontDataUri =
          "data:font/ttf;base64," + btoa(binary);
        return cachedExportFontDataUri;
      });
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @param {{ cx: number, cy: number, r: number }[]} circles
   * @param {string|null} fontDataUri
   * @returns {string}
   */
  function buildExportSvgString(
    segments,
    circles,
    diamonds,
    hollowDiamonds,
    fontDataUri,
    hopeDotsVectorLines
  ) {
    var lines = [];
    var gridBounds = getGridBoundaryDisplayBounds();
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      '<svg xmlns="' +
        NS +
        '" width="70cm" height="180cm" viewBox="0 0 ' +
        CANVAS_W +
        " " +
        CANVAS_H +
        '">'
    );
    lines.push("<defs>");
    lines.push(
      '<clipPath id="inner-content-clip"><rect x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '"/></clipPath>'
    );
    lines.push(
      "<style type=\"text/css\"><![CDATA[" +
        getExportFontFaceCss(fontDataUri) +
        "]]></style>"
    );
    if (autoMergeFillRegions && autoMergeFillRegions.length) {
      pushAutoMergeShadowFilterDefLines(lines);
    }
    pushBorderSideWhiteInnerShadowDefLines(lines);
    lines.push("</defs>");
    lines.push(
      '<rect x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '" fill="' +
        getCanvasBackgroundColor() +
        '"/>'
    );
    pushBorderDivisionExportLines(lines);
    lines.push('<g transform="' + getInnerContentTransformAttr() + '">');
    lines.push('<g clip-path="url(#inner-content-clip)">');
    pushBackgroundExportLines(lines);
    lines.push("</g>");

    pushGridMaskExportLines(lines);
    if (hopeDotsVectorLines && hopeDotsVectorLines.length) {
      for (var hd = 0; hd < hopeDotsVectorLines.length; hd++) {
        lines.push(hopeDotsVectorLines[hd]);
      }
    } else {
      pushStippleDotsExportLines(lines);
    }

    pushVerticalGridExportLines(lines);

    if (diamonds.length) {
      var fillColor = getDiamondFillColor();
      lines.push('<g clip-path="url(#inner-content-clip)">');
      lines.push('<g id="layer-diamond-fills">');
      for (var d = 0; d < diamonds.length; d++) {
        var dm = diamonds[d];
        var pts = dm.points;
        var pointsAttr = "";
        for (var p = 0; p < pts.length; p++) {
          if (p) pointsAttr += " ";
          pointsAttr += pts[p].x + "," + pts[p].y;
        }
        lines.push(
          '<polygon points="' +
            pointsAttr +
            '" fill="' +
            fillColor +
            '" stroke="none"/>'
        );
      }
      lines.push("</g>");
      lines.push("</g>");
    }

    if (hollowDiamonds.length) {
      var hollowFillColor = getGuiltShameDiamondFillColor();
      lines.push('<g clip-path="url(#inner-content-clip)">');
      lines.push('<g id="layer-hollow-diamond-fills">');
      for (var hd = 0; hd < hollowDiamonds.length; hd++) {
        var hdm = hollowDiamonds[hd];
        lines.push(
          '<path d="' +
            hollowDiamondPathD(hdm.points) +
            '" fill="' +
            hollowFillColor +
            '" fill-rule="evenodd" stroke="none"/>'
        );
      }
      lines.push("</g>");
      lines.push("</g>");
    }

    pushGridBoundaryExportLine(lines, gridBounds);
    var gridStroke = getGridStrokeWidth();
    var circleStroke = getCircleStrokeWidth();
    lines.push('<g clip-path="url(#inner-content-clip)">');

    lines.push(
      '<g fill="none" stroke="' +
        getPatternStrokeColor() +
        '" stroke-width="' +
        gridStroke +
        '" stroke-linecap="square" stroke-linejoin="miter">'
    );

    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      lines.push(
        '<line x1="' +
          s.x1 +
          '" y1="' +
          s.y1 +
          '" x2="' +
          s.x2 +
          '" y2="' +
          s.y2 +
          '"/>'
      );
    }

    lines.push("</g>");

    pushHelplessnessExportLines(lines);

    if (circles.length) {
      lines.push(
        '<g id="layer-circles" fill="' +
          getCircleFillColor() +
          '" stroke="' +
          getCircleStrokeColor() +
          '" stroke-width="' +
          circleStroke +
          '">'
      );
      var strokeInset = circleStroke / 2;
      for (var c = 0; c < circles.length; c++) {
        var circ = circles[c];
        var drawR = Math.max(0, circ.r - strokeInset);
        lines.push(
          '<circle cx="' +
            circ.cx +
            '" cy="' +
            circ.cy +
            '" r="' +
            drawR +
            '"/>'
        );
      }
      lines.push("</g>");
    }

    var longingCircles = getActiveLongingCircles();
    if (longingCircles.length) {
      var longingCircleStroke = getLongingCircleStrokeWidth();
      lines.push(
        '<g id="layer-longing-circles" fill="none" stroke="' +
          getPatternStrokeColor() +
          '" stroke-width="' +
          longingCircleStroke +
          '">'
      );
      var longingStrokeInset = longingCircleStroke / 2;
      for (var lc = 0; lc < longingCircles.length; lc++) {
        var longingCirc = longingCircles[lc];
        var longingDrawR = Math.max(0, longingCirc.r - longingStrokeInset);
        lines.push(
          '<circle cx="' +
            longingCirc.cx +
            '" cy="' +
            longingCirc.cy +
            '" r="' +
            longingDrawR +
            '"/>'
        );
      }
      lines.push("</g>");
    }

    var griefCircles = getActiveGriefCircles();
    if (griefCircles.length) {
      var griefCircleStroke = getGriefCircleStrokeWidth();
      lines.push(
        '<g id="layer-grief-circles" fill="none" stroke="' +
          getPatternStrokeColor() +
          '" stroke-width="' +
          griefCircleStroke +
          '">'
      );
      var griefStrokeInset = griefCircleStroke / 2;
      var griefInnerRadiusOffset = GRIEF_INNER_CIRCLE_DIAMETER_GAP_PX / 2;
      for (var gc = 0; gc < griefCircles.length; gc++) {
        var griefCirc = griefCircles[gc];
        var griefOuterDrawR = Math.max(0, griefCirc.r - griefStrokeInset);
        lines.push(
          '<circle cx="' +
            griefCirc.cx +
            '" cy="' +
            griefCirc.cy +
            '" r="' +
            griefOuterDrawR +
            '"/>'
        );
        var griefInnerDrawR = Math.max(0, griefOuterDrawR - griefInnerRadiusOffset);
        if (griefInnerDrawR > 0) {
          lines.push(
            '<circle cx="' +
              griefCirc.cx +
              '" cy="' +
              griefCirc.cy +
              '" r="' +
              griefInnerDrawR +
              '"/>'
          );
        }
      }
      lines.push("</g>");
    }

    pushAutoMergeFillExportLines(lines);

    pushHalfCircleExportLines(lines);

    lines.push("</g>");
    lines.push("</g>");
    pushColorDivisionsExportLines(lines);
    pushBorderDivisionOverlayExportLines(lines);
    lines.push('<g id="layer-edge-brown-bars">');
    pushCanvasEdgeBrownBarExportLines(lines);
    lines.push("</g>");
    pushCanvasEdgeSerialExport(lines);
    if (isFrameInsetOverlayVisibleOnCanvas()) {
      pushFrameInsetOverlayExportLines(lines);
    }
    lines.push("</svg>");
    return lines.join("\n");
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onExportSvg() {
    var btn = document.getElementById("export-svg-btn");
    if (btn) btn.disabled = true;

    var fontReady =
      typeof document !== "undefined" && document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve();

    Promise.all([
      fontReady,
      loadExportFontDataUri(),
      preloadLabelBarSvgAssetsForExport(),
      buildHopeDotsCirclesExportLines(),
    ])
      .then(function (results) {
        var fontDataUri = results[1];
        var hopeDotsVectorLines = results[3];
        try {
          syncVerticalGridLines(false);
          renderHalfCircleLayer();
          var markup = buildExportSvgString(
            getVisibleSegments(cachedAllSegments),
            getActiveCircles(),
            getFilledDiamonds(),
            getFilledHollowDiamonds(),
            fontDataUri,
            hopeDotsVectorLines
          );
          var blob = new Blob([markup], {
            type: "image/svg+xml;charset=utf-8",
          });
          downloadBlob(blob, "octagon-export-70x180cm.svg");
        } catch (e) {
          console.error(e);
          alert("SVG export failed.");
        } finally {
          if (btn) btn.disabled = false;
        }
      })
      .catch(function (err) {
        console.error(err);
        try {
          syncVerticalGridLines(false);
          renderHalfCircleLayer();
          var markup = buildExportSvgString(
            getVisibleSegments(cachedAllSegments),
            getActiveCircles(),
            getFilledDiamonds(),
            getFilledHollowDiamonds(),
            null,
            null
          );
          var blob = new Blob([markup], {
            type: "image/svg+xml;charset=utf-8",
          });
          downloadBlob(blob, "octagon-export-70x180cm.svg");
        } catch (e) {
          console.error(e);
          alert("SVG export failed.");
        } finally {
          if (btn) btn.disabled = false;
        }
      });
  }

  function clientToViewBox(svg, clientX, clientY) {
    var pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  /** Map screen/viewBox coords to untransformed content space (geometry). */
  function viewBoxToContentCoords(pt) {
    var off = getInnerContentOffset();
    var s = getInnerContentScale();
    return {
      x: (pt.x - off.x) / s,
      y: (pt.y - off.y) / s,
    };
  }

  function isInsideInnerContentViewBox(pt) {
    var b = getCanvasBorderPx();
    return (
      pt.x >= b &&
      pt.y >= b &&
      pt.x <= CANVAS_W - b &&
      pt.y <= CANVAS_H - b
    );
  }

  function getHitThreshold(svg) {
    var rect = svg.getBoundingClientRect();
    var scale = rect.width / CANVAS_W;
    if (!scale || scale <= 0) scale = 1;
    var contentScale = getInnerContentScale();
    return EDGE_HIT_THRESHOLD_PX / scale / contentScale;
  }

  function appendDragPoint(svg, clientX, clientY) {
    var viewPt = clientToViewBox(svg, clientX, clientY);
    if (!viewPt || !isInsideInnerContentViewBox(viewPt)) return;
    var pt = viewBoxToContentCoords(viewPt);
    var last = dragPath[dragPath.length - 1];
    if (last) {
      var dx = pt.x - last.x;
      var dy = pt.y - last.y;
      if (dx * dx + dy * dy < 1) return;
    }
    dragPath.push({ x: pt.x, y: pt.y });
  }

  function applyDanglingPrune() {
    if (isStarGrid()) return false;
    var changed = false;
    var pruneKeys = TopkapiGeometry.findDanglingPruneKeys(
      getSegmentsForMergeRegionDetection(),
      removedEdges,
      { bounds: getGridContentBounds() }
    );
    for (var j = 0; j < pruneKeys.length; j++) {
      var pk = pruneKeys[j];
      if (removedEdges.has(pk)) continue;
      removedEdges.add(pk);
      changed = true;
    }
    return changed;
  }

  function removeEdgesByKeys(keys) {
    var changed = false;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (removedEdges.has(key)) continue;
      removedEdges.add(key);
      changed = true;
    }

    if (applyDanglingPrune()) changed = true;

    if (changed) {
      renderPatternAndVerticalLayers();
      updateResetButton();
    }
  }

  function restoreEdgesByKeys(keys) {
    var validKeys = TopkapiGeometry.filterValidRestoreKeys(
      getAllSegmentsForTracing(),
      removedEdges,
      keys
    );
    var changed = false;
    for (var i = 0; i < validKeys.length; i++) {
      var key = validKeys[i];
      if (!removedEdges.has(key)) continue;
      removedEdges.delete(key);
      changed = true;
    }

    if (changed) {
      stickyMergedCutoutFaces = null;
      renderPatternAndVerticalLayers();
      updateResetButton();
    }
  }

  function processDragHitTest() {
    if (!designSvg || dragPath.length === 0) return;
    var threshold = getHitThreshold(designSvg);

    if (interactionMode === "merge") {
      var allSegments = getAllSegmentsForTracing();
      var visible = getVisibleSegments(allSegments);
      var keys = TopkapiGeometry.findSegmentsNearPolyline(
        visible,
        dragPath,
        threshold,
        removedEdges
      );
      removeEdgesByKeys(keys);
    } else if (interactionMode === "restore") {
      if (!removedEdges.size) return;
      var allSegments = getAllSegmentsForTracing();
      var visible = getVisibleSegments(allSegments);
      var restoreKeys = TopkapiGeometry.findRestoreCandidateKeys(
        allSegments,
        visible,
        removedEdges,
        dragPath,
        threshold
      );
      restoreEdgesByKeys(restoreKeys);
    }
  }

  function onPointerDown(e) {
    if (!isDragInteractionMode() || !designSvg) return;
    if (e.button !== 0) return;
    isDragging = true;
    dragPath = [];
    designSvg.setPointerCapture(e.pointerId);
    appendDragPoint(designSvg, e.clientX, e.clientY);
    processDragHitTest();
    var wrap = document.getElementById("stage-wrap");
    if (wrap) wrap.classList.add("is-dragging");
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging || !designSvg) return;
    appendDragPoint(designSvg, e.clientX, e.clientY);
    processDragHitTest();
    e.preventDefault();
  }

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    dragPath = [];
    if (designSvg && designSvg.hasPointerCapture(e.pointerId)) {
      designSvg.releasePointerCapture(e.pointerId);
    }
    var wrap = document.getElementById("stage-wrap");
    if (wrap) wrap.classList.remove("is-dragging");
  }

  function onPointerUp(e) {
    endDrag(e);
  }

  function onPointerCancel(e) {
    endDrag(e);
  }

  var interactionListenersBound = false;

  function bindInteractionPointerListeners() {
    if (!designSvg || interactionListenersBound) return;
    designSvg.addEventListener("pointerdown", onPointerDown);
    designSvg.addEventListener("pointermove", onPointerMove);
    designSvg.addEventListener("pointerup", onPointerUp);
    designSvg.addEventListener("pointercancel", onPointerCancel);
    interactionListenersBound = true;
  }

  function unbindInteractionPointerListeners() {
    if (!designSvg || !interactionListenersBound) return;
    designSvg.removeEventListener("pointerdown", onPointerDown);
    designSvg.removeEventListener("pointermove", onPointerMove);
    designSvg.removeEventListener("pointerup", onPointerUp);
    designSvg.removeEventListener("pointercancel", onPointerCancel);
    interactionListenersBound = false;
    isDragging = false;
    dragPath = [];
    var wrap = document.getElementById("stage-wrap");
    if (wrap) wrap.classList.remove("is-dragging");
  }

  function updateModeUi() {
    var viewBtn = document.getElementById("mode-view-btn");
    var mergeBtn = document.getElementById("mode-merge-btn");
    var restoreBtn = document.getElementById("mode-restore-btn");
    var mergeHint = document.getElementById("merge-hint");
    var restoreHint = document.getElementById("restore-hint");

    if (viewBtn) {
      viewBtn.classList.toggle("is-active", interactionMode === "view");
      viewBtn.setAttribute("aria-pressed", String(interactionMode === "view"));
    }
    if (mergeBtn) {
      mergeBtn.classList.toggle("is-active", interactionMode === "merge");
      mergeBtn.setAttribute("aria-pressed", String(interactionMode === "merge"));
    }
    if (restoreBtn) {
      restoreBtn.classList.toggle("is-active", interactionMode === "restore");
      restoreBtn.setAttribute(
        "aria-pressed",
        String(interactionMode === "restore")
      );
    }
    if (mergeHint) mergeHint.hidden = interactionMode !== "merge";
    if (restoreHint) restoreHint.hidden = interactionMode !== "restore";
    if (designSvg) {
      designSvg.classList.toggle("is-merge-mode", interactionMode === "merge");
      designSvg.classList.toggle(
        "is-restore-mode",
        interactionMode === "restore"
      );
    }
  }

  function setMode(mode) {
    if (mode !== "view" && mode !== "merge" && mode !== "restore") return;
    interactionMode = mode;
    updateModeUi();
    if (isDragInteractionMode()) {
      bindInteractionPointerListeners();
    } else {
      unbindInteractionPointerListeners();
    }
  }

  function onResetGrid() {
    clearMergeState();
    clearAutoMergeState();
    renderPatternAndVerticalLayers();
  }

  /** Dim sidebar sections except the one under the pointer (or nearest to viewport center when pointer is outside). */
  function initSidebarScrollFocus() {
    var scrollEl = document.querySelector(".sidebar__scroll");
    if (!scrollEl) return;

    var sections = scrollEl.querySelectorAll(".sidebar__section");
    if (!sections.length) return;

    var ticking = false;
    var pointerInsideSidebar = false;
    var pointerClientY = null;

    function getSectionAtClientY(clientY) {
      for (var i = 0; i < sections.length; i++) {
        var rect = sections[i].getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return sections[i];
        }
      }
      var nearest = sections[0];
      var minDistance = Infinity;
      for (var k = 0; k < sections.length; k++) {
        var sectionRect = sections[k].getBoundingClientRect();
        var sectionCenter = sectionRect.top + sectionRect.height / 2;
        var distance = Math.abs(clientY - sectionCenter);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = sections[k];
        }
      }
      return nearest;
    }

    function getActiveSectionFromViewportCenter() {
      var scrollRect = scrollEl.getBoundingClientRect();
      var viewportCenter = scrollRect.top + scrollRect.height / 2;
      return getSectionAtClientY(viewportCenter);
    }

    function updateSidebarSectionFocus() {
      ticking = false;
      var activeSection =
        pointerInsideSidebar && pointerClientY != null
          ? getSectionAtClientY(pointerClientY)
          : getActiveSectionFromViewportCenter();

      for (var j = 0; j < sections.length; j++) {
        sections[j].classList.toggle("is-dimmed", sections[j] !== activeSection);
      }
    }

    function scheduleSidebarSectionFocus() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateSidebarSectionFocus);
    }

    function onSidebarPointerMove(clientY) {
      pointerInsideSidebar = true;
      pointerClientY = clientY;
      scheduleSidebarSectionFocus();
    }

    function onSidebarPointerLeave() {
      pointerInsideSidebar = false;
      pointerClientY = null;
      scheduleSidebarSectionFocus();
    }

    scrollEl.addEventListener(
      "mousemove",
      function (e) {
        onSidebarPointerMove(e.clientY);
      },
      { passive: true }
    );
    scrollEl.addEventListener("mouseleave", onSidebarPointerLeave);
    scrollEl.addEventListener("scroll", scheduleSidebarSectionFocus, {
      passive: true,
    });
    window.addEventListener("resize", scheduleSidebarSectionFocus);
    updateSidebarSectionFocus();
  }

  async function init() {
    initGridTypeButtons();

    var slider = document.getElementById("octagons-n");
    if (slider) {
      slider.min = String(OCTAGONS_N_MIN);
      slider.max = String(OCTAGONS_N_MAX);
      slider.value = String(OCTAGONS_N_DEFAULT);
      slider.addEventListener("input", renderAfterSliderChange);
    }

    var innerSlider = document.getElementById("inner-scale");
    if (innerSlider) {
      innerSlider.min = String(INNER_SCALE_MIN);
      innerSlider.max = String(INNER_SCALE_MAX);
      innerSlider.value = String(INNER_SCALE_DEFAULT);
      innerSlider.addEventListener("input", renderAfterSliderChange);
    }

    var borderSideSegmentsSlider = document.getElementById("border-side-segments");
    if (borderSideSegmentsSlider) {
      borderSideSegmentsSlider.min = "1";
      borderSideSegmentsSlider.max = "3";
      borderSideSegmentsSlider.value = "1";
      borderSideSegmentsSlider.addEventListener("input", function () {
        var borderSideOut = document.getElementById("border-side-segments-out");
        if (borderSideOut) {
          borderSideOut.textContent = borderSideThicknessLabel(
            getBorderSideThicknessColumns()
          );
        }
        // Thickness affects both the border divisions layer AND the inner content bounds,
        // so we re-render to update transforms + dependent layers.
        render();
      });
    }

    var colorDivisionsSlider = document.getElementById("color-divisions");
    if (colorDivisionsSlider) {
      colorDivisionsSlider.min = String(
        typeof COLOR_DIVISIONS_MIN !== "undefined" ? COLOR_DIVISIONS_MIN : 1
      );
      colorDivisionsSlider.max = String(
        typeof COLOR_DIVISIONS_MAX !== "undefined" ? COLOR_DIVISIONS_MAX : 5
      );
      colorDivisionsSlider.value = String(
        typeof COLOR_DIVISIONS_DEFAULT !== "undefined"
          ? COLOR_DIVISIONS_DEFAULT
          : 1
      );
      syncColorDivisionsOutput();
      colorDivisionsSlider.addEventListener("input", function () {
        syncColorDivisionsOutput();
        updateColorDivisionsLayer();
      });
    }

    var colorDivisionsShuffleBtn = document.getElementById(
      "color-divisions-shuffle-btn"
    );
    if (colorDivisionsShuffleBtn) {
      colorDivisionsShuffleBtn.addEventListener("click", reshuffleColorDivisionRects);
    }

    var colorDivisionsMixAreasBtn = document.getElementById(
      "color-divisions-mix-areas-btn"
    );
    if (colorDivisionsMixAreasBtn) {
      colorDivisionsMixAreasBtn.addEventListener(
        "click",
        reshuffleColorDivisionAreaOrder
      );
    }

    var borderSideWhiteFillSlider = document.getElementById("border-side-white-fill");
    if (borderSideWhiteFillSlider) {
      borderSideWhiteFillSlider.min = String(
        typeof BORDER_SIDE_WHITE_FILL_MIN !== "undefined"
          ? BORDER_SIDE_WHITE_FILL_MIN
          : 0
      );
      borderSideWhiteFillSlider.max = String(
        typeof BORDER_SIDE_WHITE_FILL_MAX !== "undefined"
          ? BORDER_SIDE_WHITE_FILL_MAX
          : 100
      );
      borderSideWhiteFillSlider.value = String(
        typeof BORDER_SIDE_WHITE_FILL_DEFAULT !== "undefined"
          ? BORDER_SIDE_WHITE_FILL_DEFAULT
          : 0
      );
      syncBorderSideWhiteFillOutput();
      borderSideWhiteFillSlider.addEventListener("input", function () {
        syncBorderSideWhiteFillOutput();
        updateBorderDivisionLines();
        updateBorderDivisionOverlay();
      });
    }

    var halfCircleToggle = document.getElementById("half-circle-toggle");
    var halfCircleColor = document.getElementById("half-circle-color");
    if (halfCircleColor) halfCircleColor.value = PATTERN_STROKE_COLOR_DEFAULT;
    if (halfCircleToggle) {
      halfCircleToggle.checked = true;
      halfCircleToggle.addEventListener("change", function () {
        renderHalfCircleLayer();
      });
    }
    var halfCircleBottomToggle = document.getElementById("half-circle-bottom-toggle");
    if (halfCircleBottomToggle) {
      halfCircleBottomToggle.checked = true;
      halfCircleBottomToggle.addEventListener("change", function () {
        renderHalfCircleLayer();
      });
    }
    if (halfCircleColor) {
      halfCircleColor.addEventListener("input", function () {
        renderHalfCircleLayer();
      });
    }
    var wearControlHome = document.getElementById("wear-control-home");
    if (wearControlHome) {
      wearControlHome.addEventListener("input", function () {
        renderHalfCircleLayer();
      });
    }
    var wearControlOutside = document.getElementById("wear-control-outside");
    if (wearControlOutside) {
      wearControlOutside.addEventListener("input", function () {
        renderHalfCircleLayer();
      });
    }

    var halfCircleInnerArcPosition = document.getElementById(
      "half-circle-inner-arc-position"
    );
    if (halfCircleInnerArcPosition) {
      halfCircleInnerArcPosition.min = "20";
      halfCircleInnerArcPosition.max = "80";
      halfCircleInnerArcPosition.value = "50";
      var innerArcOut = document.getElementById("half-circle-inner-arc-position-out");
      if (innerArcOut) {
        innerArcOut.textContent =
          String(Math.round(getHalfCircleInnerArcRadiusRatio() * 100)) + "%";
      }
      halfCircleInnerArcPosition.addEventListener("input", function () {
        var out = document.getElementById("half-circle-inner-arc-position-out");
        if (out) {
          out.textContent =
            String(Math.round(getHalfCircleInnerArcRadiusRatio() * 100)) + "%";
        }
        renderHalfCircleLayer();
      });
    }

    var halfCircleInset = document.getElementById("half-circle-inset");
    if (halfCircleInset) {
      halfCircleInset.min = "0.1";
      halfCircleInset.max = "0.4";
      halfCircleInset.value = "0.2";
      halfCircleInset.step = "0.01";
      var insetOut = document.getElementById("half-circle-inset-out");
      if (insetOut) insetOut.textContent = String(getHalfCircleInset());
      halfCircleInset.addEventListener("input", function () {
        var out = document.getElementById("half-circle-inset-out");
        if (out) out.textContent = String(getHalfCircleInset());
        renderHalfCircleLayer();
      });
    }

    var halfCircleCuspGap = document.getElementById("half-circle-cusp-gap");
    if (halfCircleCuspGap) {
      halfCircleCuspGap.min = "0";
      halfCircleCuspGap.max = "40";
      halfCircleCuspGap.value = "22";
      var cuspGapOut = document.getElementById("half-circle-cusp-gap-out");
      if (cuspGapOut) {
        cuspGapOut.textContent = String(getHalfCircleCuspGapPx()) + "px";
      }
      halfCircleCuspGap.addEventListener("input", function () {
        var out = document.getElementById("half-circle-cusp-gap-out");
        if (out) out.textContent = String(getHalfCircleCuspGapPx()) + "px";
        renderHalfCircleLayer();
      });
    }

    var halfCircleInnerArcDiagonals = document.getElementById(
      "half-circle-inner-arc-diagonals"
    );
    if (halfCircleInnerArcDiagonals) {
      halfCircleInnerArcDiagonals.checked = true;
      halfCircleInnerArcDiagonals.addEventListener("change", function () {
        renderHalfCircleLayer();
      });
    }

    var halfCircleValleyCircles = document.getElementById("half-circle-valley-circles");
    if (halfCircleValleyCircles) {
      halfCircleValleyCircles.checked = true;
      halfCircleValleyCircles.addEventListener("change", function () {
        renderHalfCircleLayer();
      });
    }

    var halfCircleValleyCircleSize = document.getElementById("half-circle-valley-circle-size");
    if (halfCircleValleyCircleSize) {
      halfCircleValleyCircleSize.min = "0";
      halfCircleValleyCircleSize.max = "100";
      halfCircleValleyCircleSize.value = "100";
      var valleySizeOut = document.getElementById("half-circle-valley-circle-size-out");
      if (valleySizeOut) {
        valleySizeOut.textContent = String(Math.round(getHalfCircleValleyCircleSizeScale() * 100)) + "%";
      }
      halfCircleValleyCircleSize.addEventListener("input", function () {
        var out = document.getElementById("half-circle-valley-circle-size-out");
        if (out) {
          out.textContent = String(Math.round(getHalfCircleValleyCircleSizeScale() * 100)) + "%";
        }
        renderHalfCircleLayer();
      });
    }

    var halfCircleStarInnerRadius = document.getElementById("half-circle-star-inner-radius");
    if (halfCircleStarInnerRadius) {
      halfCircleStarInnerRadius.min = "50";
      halfCircleStarInnerRadius.max = "95";
      halfCircleStarInnerRadius.value = "50";
      var starInnerOut = document.getElementById("half-circle-star-inner-radius-out");
      if (starInnerOut) {
        starInnerOut.textContent =
          String(Math.round(getHalfCircleStarInnerRadiusRatio() * 100)) + "%";
      }
      halfCircleStarInnerRadius.addEventListener("input", function () {
        var out = document.getElementById("half-circle-star-inner-radius-out");
        if (out) {
          out.textContent =
            String(Math.round(getHalfCircleStarInnerRadiusRatio() * 100)) + "%";
        }
        renderHalfCircleLayer();
      });
    }

    var circleDensitySlider = document.getElementById("circle-density");
    if (circleDensitySlider) {
      circleDensitySlider.min = String(CIRCLE_DENSITY_MIN);
      circleDensitySlider.max = String(CIRCLE_DENSITY_MAX);
      circleDensitySlider.value = String(CIRCLE_DENSITY_DEFAULT);
      circleDensitySlider.addEventListener("input", function () {
        syncCircleSelection(true);
        var densityOut = document.getElementById("circle-density-out");
        if (densityOut) densityOut.textContent = String(getCircleDensity()) + "%";
        renderPatternLayer();
      });
    }

    var longingCircleDensitySlider = document.getElementById("longing-circle-density");
    if (longingCircleDensitySlider) {
      longingCircleDensitySlider.min = String(CIRCLE_DENSITY_MIN);
      longingCircleDensitySlider.max = String(CIRCLE_DENSITY_MAX);
      longingCircleDensitySlider.value = String(CIRCLE_DENSITY_DEFAULT);
      longingCircleDensitySlider.addEventListener("input", function () {
        syncLongingCircleSelection(true);
        var longingDensityOut = document.getElementById("longing-circle-density-out");
        if (longingDensityOut) {
          longingDensityOut.textContent = String(getLongingCircleDensity()) + "%";
        }
        renderPatternLayer();
      });
    }

    var griefCircleDensitySlider = document.getElementById("grief-circle-density");
    if (griefCircleDensitySlider) {
      griefCircleDensitySlider.min = String(CIRCLE_DENSITY_MIN);
      griefCircleDensitySlider.max = String(CIRCLE_DENSITY_MAX);
      griefCircleDensitySlider.value = String(CIRCLE_DENSITY_DEFAULT);
      griefCircleDensitySlider.addEventListener("input", function () {
        syncGriefCircleSelection(true);
        var griefDensityOut = document.getElementById("grief-circle-density-out");
        if (griefDensityOut) {
          griefDensityOut.textContent = String(getGriefCircleDensity()) + "%";
        }
        renderPatternLayer();
      });
    }

    var angerVerticalLengthSlider = document.getElementById("anger-vertical-length");
    if (angerVerticalLengthSlider) {
      angerVerticalLengthSlider.min = String(ANGER_VERTICAL_LENGTH_MIN);
      angerVerticalLengthSlider.max = String(ANGER_VERTICAL_LENGTH_MAX);
      angerVerticalLengthSlider.value = String(ANGER_VERTICAL_LENGTH_DEFAULT);
      angerVerticalLengthSlider.addEventListener("input", function () {
        var angerLengthOut = document.getElementById("anger-vertical-length-out");
        if (angerLengthOut) {
          angerLengthOut.textContent =
            String(getAngerVerticalLengthPercent()) + "%";
        }
        renderVerticalGridLayer();
      });
    }

    var anxietyVerticalStrokeSlider = document.getElementById("anxiety-vertical-stroke");
    if (anxietyVerticalStrokeSlider) {
      anxietyVerticalStrokeSlider.min = String(ANXIETY_VERTICAL_STROKE_MIN);
      anxietyVerticalStrokeSlider.max = String(ANXIETY_VERTICAL_STROKE_MAX);
      anxietyVerticalStrokeSlider.value = String(ANXIETY_VERTICAL_STROKE_DEFAULT);
      anxietyVerticalStrokeSlider.addEventListener("input", function () {
        syncAnxietyVerticalStrokeOutput();
        renderVerticalGridLayer();
      });
    }

    var randomizeAllControlsBtn = document.getElementById(
      "randomize-all-controls-btn"
    );
    if (randomizeAllControlsBtn) {
      randomizeAllControlsBtn.addEventListener("click", randomizeAllDesignControls);
    }

    var randomizeCirclesBtn = document.getElementById("randomize-circles-btn");
    if (randomizeCirclesBtn) {
      randomizeCirclesBtn.addEventListener("click", function () {
        syncCircleSelection(true);
        syncLongingCircleSelection(true);
        syncGriefCircleSelection(true);
        syncHelplessnessSelection(true);
        syncPrideShapes();
        syncGuiltShameShapes();
        renderPatternLayer();
      });
    }

    var prideFillPercentSlider = document.getElementById("pride-fill-percent");
    if (prideFillPercentSlider) {
      prideFillPercentSlider.min = String(PRIDE_FILL_PERCENT_MIN);
      prideFillPercentSlider.max = String(PRIDE_FILL_PERCENT_MAX);
      prideFillPercentSlider.value = String(PRIDE_FILL_PERCENT_DEFAULT);
      prideFillPercentSlider.addEventListener("input", function () {
        var prideFillOut = document.getElementById("pride-fill-percent-out");
        if (prideFillOut) {
          prideFillOut.textContent = String(getPrideFillPercent()) + "%";
        }
        syncPrideShapes();
        renderPatternLayer();
      });
    }

    var prideColorShapesBtn = document.getElementById("pride-color-shapes-btn");
    if (prideColorShapesBtn) {
      prideColorShapesBtn.addEventListener("click", function () {
        syncPrideShapes();
        renderPatternLayer();
      });
    }

    var guiltShameFillPercentSlider = document.getElementById(
      "guilt-shame-fill-percent"
    );
    if (guiltShameFillPercentSlider) {
      guiltShameFillPercentSlider.min = String(GUILT_SHAME_FILL_PERCENT_MIN);
      guiltShameFillPercentSlider.max = String(GUILT_SHAME_FILL_PERCENT_MAX);
      guiltShameFillPercentSlider.value = String(GUILT_SHAME_FILL_PERCENT_DEFAULT);
      guiltShameFillPercentSlider.addEventListener("input", function () {
        var guiltShameFillOut = document.getElementById(
          "guilt-shame-fill-percent-out"
        );
        if (guiltShameFillOut) {
          guiltShameFillOut.textContent =
            String(getGuiltShameFillPercent()) + "%";
        }
        syncGuiltShameShapes();
        renderPatternLayer();
      });
    }

    var guiltShameColorShapesBtn = document.getElementById(
      "guilt-shame-color-shapes-btn"
    );
    if (guiltShameColorShapesBtn) {
      guiltShameColorShapesBtn.addEventListener("click", function () {
        syncGuiltShameShapes();
        renderPatternLayer();
      });
    }

    var helplessnessPercentSlider = document.getElementById("helplessness-percent");
    if (helplessnessPercentSlider) {
      helplessnessPercentSlider.min = String(HELPLESSNESS_PERCENT_MIN);
      helplessnessPercentSlider.max = String(HELPLESSNESS_PERCENT_MAX);
      helplessnessPercentSlider.value = String(HELPLESSNESS_PERCENT_DEFAULT);
      helplessnessPercentSlider.addEventListener("input", function () {
        syncHelplessnessSelection(true);
        var helplessnessOut = document.getElementById("helplessness-percent-out");
        if (helplessnessOut) {
          helplessnessOut.textContent = String(getHelplessnessPercent()) + "%";
        }
        renderPatternLayer();
      });
    }

    var helplessnessLayerToggle = document.getElementById("helplessness-layer-toggle");
    if (helplessnessLayerToggle) {
      helplessnessLayerToggle.addEventListener("change", function () {
        renderPatternLayer();
      });
    }

    var frameOverlayToggle = document.getElementById("frame-overlay-toggle-btn");
    if (frameOverlayToggle) {
      frameOverlayToggle.addEventListener("click", toggleFrameInsetOverlay);
    }

    var exportBtn = document.getElementById("export-svg-btn");
    if (exportBtn) exportBtn.addEventListener("click", onExportSvg);

    var viewBtn = document.getElementById("mode-view-btn");
    if (viewBtn) viewBtn.addEventListener("click", function () {
      setMode("view");
    });

    var mergeBtn = document.getElementById("mode-merge-btn");
    if (mergeBtn) mergeBtn.addEventListener("click", function () {
      setMode("merge");
    });

    var restoreBtn = document.getElementById("mode-restore-btn");
    if (restoreBtn) restoreBtn.addEventListener("click", function () {
      setMode("restore");
    });

    var resetBtn = document.getElementById("reset-grid-btn");
    if (resetBtn) resetBtn.addEventListener("click", onResetGrid);

    var autoMergeIntensitySlider = document.getElementById("auto-merge-intensity");
    if (autoMergeIntensitySlider) {
      autoMergeIntensitySlider.min = String(
        typeof AUTO_MERGE_INTENSITY_MIN !== "undefined"
          ? AUTO_MERGE_INTENSITY_MIN
          : 0
      );
      autoMergeIntensitySlider.max = String(
        typeof AUTO_MERGE_INTENSITY_MAX !== "undefined"
          ? AUTO_MERGE_INTENSITY_MAX
          : 100
      );
      autoMergeIntensitySlider.value = String(
        typeof AUTO_MERGE_INTENSITY_DEFAULT !== "undefined"
          ? AUTO_MERGE_INTENSITY_DEFAULT
          : 50
      );
      function onAutoMergeIntensityInteract() {
        updateAutoMergeIntensityOutput();
        runAutoMerge();
      }
      autoMergeIntensitySlider.addEventListener("pointerdown", onAutoMergeIntensityInteract);
      autoMergeIntensitySlider.addEventListener("input", onAutoMergeIntensityInteract);
    }
    updateAutoMergeIntensityOutput();

    loadHopeStippleImage();

    if (window.SheetPalettes) {
      await window.SheetPalettes.loadSheetPalettes();
      window.SheetPalettes.pickRandomPalette();
      initSheetPaletteControls();
    }

    if (window.IdentityControls && window.IdentityControls.setOnLivingInIranChange) {
      window.IdentityControls.setOnLivingInIranChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnLeavingYearChange) {
      window.IdentityControls.setOnLeavingYearChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnLostCircleChange) {
      window.IdentityControls.setOnLostCircleChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnAgeChange) {
      window.IdentityControls.setOnAgeChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnFromChange) {
      window.IdentityControls.setOnFromChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnNowInChange) {
      window.IdentityControls.setOnNowInChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnNameChange) {
      window.IdentityControls.setOnNameChange(refreshLabelBarContent);
    }

    window.addEventListener("resize", layoutStage);
    initFeelingsCanvasToggles();
    lastCircleLayoutSignature = "";
    lastLongingCircleLayoutSignature = "";
    lastGriefCircleLayoutSignature = "";
    lastHelplessnessLayoutSignature = "";
    lastDiamondLayoutSignature = "";
    render();
    syncFrameOverlayToggleButton();
    initMagnifier();
    initSidebarScrollFocus();
    setMode("view");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

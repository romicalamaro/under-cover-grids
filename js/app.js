(function () {
  "use strict";

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
  var diamondFilledIds = new Set();
  var lastDiamondLayoutSignature = "";
  /** @type {{ dots: { cx: number, cy: number, r: number, fill: string }[], outW: number, outH: number } | null} */
  var stippleDotsCache = null;
  /** @type {HTMLImageElement | null} */
  var stippleSourceImage = null;
  var stippleSrcW = 0;
  var stippleSrcH = 0;
  var stippleColorMode = "bw";
  var stippleGenerationId = 0;
  /** Frame inset overlay (lines, caps, ellipses, diagonals); default hidden */
  var frameInsetOverlayVisible = false;

  /** Feelings On/Off toggles — which emotion layers are drawn on the canvas. */
  var emotionCanvasVisible = {
    anger: true,
    fear: true,
    hope: true,
    sadness: true,
    pride: true,
    happiness: true,
    pain: true,
  };

  var FEELINGS_CANVAS_KEYS = [
    "anger",
    "fear",
    "hope",
    "sadness",
    "pride",
    "happiness",
    "pain",
  ];

  /** Persist mask holes so continued merging cannot drop earlier cutouts. */
  var stickyMergedCutoutFaces = null;
  /** Random column edges for brown-bar outer-third grid (regenerated on layout change). */
  var cachedBrownBarGridXBounds = null;
  var lastBrownBarGridLayoutSignature = "";
  /** Random height ratios for left/right margin rows (regenerated on slider input). */
  var cachedBorderSideSegmentRatios = null;
  /** One random 8-digit serial per page load (top + bottom white strips). */
  var canvasEdgeSerial = null;
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

  function syncFeelingsCanvasToggleButtons(key) {
    var onBtn = document.getElementById("feelings-" + key + "-canvas-on");
    var offBtn = document.getElementById("feelings-" + key + "-canvas-off");
    if (!onBtn || !offBtn) return;
    var visible = isEmotionCanvasVisible(key);
    onBtn.classList.toggle("is-active", visible);
    offBtn.classList.toggle("is-active", !visible);
    onBtn.setAttribute("aria-pressed", String(visible));
    offBtn.setAttribute("aria-pressed", String(!visible));
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
    renderPatternLayer();
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

  /** Star grid: deferred until later integration steps (gradient, emotions, etc.). */
  var STAR_GRID_DEFERRED_LAYER_SELECTORS = [
    "#inner-clipped-background",
    "#inner-clipped-stipple-dots",
    "#inner-clipped-grid-mask",
    "#inner-clipped-auto-merge-fills",
    "#layer-frame-inset-overlay",
  ];

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

  function getAngerVerticalLengthPercent() {
    var slider = document.getElementById("anger-vertical-length");
    var v = slider ? Number(slider.value) : ANGER_VERTICAL_LENGTH_DEFAULT;
    return Math.min(
      ANGER_VERTICAL_LENGTH_MAX,
      Math.max(ANGER_VERTICAL_LENGTH_MIN, Math.round(v))
    );
  }

  function getPrideFillPercent() {
    var slider = document.getElementById("pride-fill-percent");
    var v = slider ? Number(slider.value) : PRIDE_FILL_PERCENT_DEFAULT;
    return Math.min(
      PRIDE_FILL_PERCENT_MAX,
      Math.max(PRIDE_FILL_PERCENT_MIN, Math.round(v))
    );
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
    var slider = document.getElementById("grid-stroke-width");
    var v = slider ? Number(slider.value) : GRID_STROKE_WIDTH_DEFAULT;
    return Math.min(
      GRID_STROKE_WIDTH_MAX,
      Math.max(GRID_STROKE_WIDTH_MIN, Math.round(v))
    );
  }

  function getBorderLeftRightSegments() {
    var slider = document.getElementById("border-side-segments");
    var v = slider ? Number(slider.value) : BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT;
    return Math.min(
      BORDER_LEFT_RIGHT_SEGMENTS_MAX,
      Math.max(BORDER_LEFT_RIGHT_SEGMENTS_MIN, Math.round(v))
    );
  }

  function getCircleStrokeWidth() {
    return getGridStrokeWidth() * 2;
  }

  function getPatternStrokeColor() {
    var input = document.getElementById("pattern-stroke-color");
    return normalizeHexColor(
      input ? input.value : null,
      PATTERN_STROKE_COLOR_DEFAULT
    );
  }

  function getCanvasBackgroundColor() {
    var input = document.getElementById("canvas-background-color");
    return normalizeHexColor(
      input ? input.value : null,
      typeof CANVAS_BACKGROUND_COLOR_DEFAULT !== "undefined"
        ? CANVAS_BACKGROUND_COLOR_DEFAULT
        : BG_COLOR
    );
  }

  function getCircleFillColor() {
    var input = document.getElementById("circle-fill-color");
    return normalizeHexColor(
      input ? input.value : null,
      typeof CIRCLE_FILL_COLOR_DEFAULT !== "undefined"
        ? CIRCLE_FILL_COLOR_DEFAULT
        : "#ffffff"
    );
  }

  function getDiamondFillColor() {
    var input = document.getElementById("diamond-fill-color");
    return normalizeHexColor(
      input ? input.value : null,
      DIAMOND_FILL_COLOR_DEFAULT
    );
  }

  function getLabelBarBackgroundColor() {
    var input = document.getElementById("label-bar-background-color");
    return normalizeHexColor(
      input ? input.value : null,
      typeof LABEL_BAR_BACKGROUND_COLOR_DEFAULT !== "undefined"
        ? LABEL_BAR_BACKGROUND_COLOR_DEFAULT
        : CANVAS_EDGE_BROWN_BAR_COLOR
    );
  }

  function getLabelBarContentColor() {
    var input = document.getElementById("label-bar-content-color");
    return normalizeHexColor(
      input ? input.value : null,
      typeof LABEL_BAR_CONTENT_COLOR_DEFAULT !== "undefined"
        ? LABEL_BAR_CONTENT_COLOR_DEFAULT
        : "#ffffff"
    );
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
      updateBorderDivisionLines();
      return;
    }
    renderBackgroundLayer();
    renderGridMaskLayer("canvas-background-color");
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
    return removedEdges.size > 0;
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
   * @param {{ points: { x: number, y: number }[] }} face
   * @returns {string}
   */
  function cutoutFaceKey(face) {
    var pts = face.points;
    if (!pts.length) return "";
    var area = 0;
    for (var i = 0; i < pts.length; i++) {
      var j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return (
      pts.length +
      "|" +
      Math.round(pts[0].x * 100) +
      "," +
      Math.round(pts[0].y * 100) +
      "|" +
      Math.round(Math.abs(area / 2))
    );
  }

  /**
   * Keep prior holes and add newly detected regions (never shrink on merge).
   * @param {{ points: { x: number, y: number }[] }[]} sticky
   * @param {{ points: { x: number, y: number }[] }[]} fresh
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function mergeStickyCutouts(sticky, fresh) {
    var keys = {};
    var out = [];
    var i;
    for (i = 0; i < sticky.length; i++) {
      var k = cutoutFaceKey(sticky[i]);
      if (!k || keys[k]) continue;
      keys[k] = true;
      out.push(sticky[i]);
    }
    for (i = 0; i < fresh.length; i++) {
      var fk = cutoutFaceKey(fresh[i]);
      if (!fk || keys[fk]) continue;
      keys[fk] = true;
      out.push(fresh[i]);
    }
    return out;
  }

  function renderGridMaskLayer(trigger) {
    if (!designSvg) return;
    var defs = designSvg.querySelector("defs");
    var layer = designSvg.querySelector("#layer-grid-mask");
    if (!defs || !layer) return;

    var bounds = getGridContentBounds();
    var freshRegions = TopkapiGeometry.getMergedPolygonRegions(
      cachedAllSegments,
      removedEdges
    );
    var mergedRegions;
    if (!removedEdges.size) {
      stickyMergedCutoutFaces = null;
      mergedRegions = freshRegions;
    } else if (trigger === "restore" || interactionMode === "restore") {
      stickyMergedCutoutFaces = freshRegions;
      mergedRegions = freshRegions;
    } else if (!stickyMergedCutoutFaces) {
      stickyMergedCutoutFaces = freshRegions;
      mergedRegions = freshRegions;
    } else {
      stickyMergedCutoutFaces = mergeStickyCutouts(
        stickyMergedCutoutFaces,
        freshRegions
      );
      mergedRegions = stickyMergedCutoutFaces;
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
    if (maskClipped) {
      maskClipped.style.display = active ? "" : "none";
    }

    if (!active || !showHope) {
      if (dotsClipped) dotsClipped.style.display = "none";
      if (dotsLayer) dotsLayer.removeAttribute("clip-path");
      return;
    }

    if (dotsClipped) dotsClipped.style.display = "";
    if (dotsLayer && defs && defs.querySelector("#" + MERGE_REGIONS_CLIP_ID)) {
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
    var freshRegions = TopkapiGeometry.getMergedPolygonRegions(
      cachedAllSegments,
      removedEdges
    );
    if (!removedEdges.size) return freshRegions;
    if (stickyMergedCutoutFaces) return stickyMergedCutoutFaces;
    return freshRegions;
  }

  /**
   * @param {string[]} lines
   */
  function getAutoMergeOutlineColor() {
    return typeof AUTO_MERGE_OUTLINE_COLOR !== "undefined"
      ? AUTO_MERGE_OUTLINE_COLOR
      : "#B2FF00";
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
      shadowColor:
        typeof AUTO_MERGE_SHADOW_COLOR !== "undefined"
          ? AUTO_MERGE_SHADOW_COLOR
          : "#685450",
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

    var fillColor = getPatternStrokeColor();
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

  /**
   * Fit uploaded image into canvas at resolution percent.
   * @param {number} resolutionPct
   * @returns {{ outW: number, outH: number }}
   */
  function getStippleOutputSize(resolutionPct) {
    if (!stippleSrcW || !stippleSrcH) {
      return { outW: CANVAS_W, outH: CANVAS_H };
    }
    var pct = resolutionPct / 100;
    var fit = Math.min(CANVAS_W / stippleSrcW, CANVAS_H / stippleSrcH) * pct;
    return {
      outW: Math.max(1, Math.round(stippleSrcW * fit)),
      outH: Math.max(1, Math.round(stippleSrcH * fit)),
    };
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
      !stippleDotsCache ||
      !stippleDotsCache.dots.length
    ) {
      applyMergeReveal();
      return;
    }

    if (defs && defs.querySelector("#" + MERGE_REGIONS_CLIP_ID)) {
      layer.setAttribute("clip-path", "url(#" + MERGE_REGIONS_CLIP_ID + ")");
    }

    var cache = stippleDotsCache;
    var scale = Math.min(CANVAS_W / cache.outW, CANVAS_H / cache.outH);
    var offsetX = (CANVAS_W - cache.outW * scale) / 2;
    var offsetY = (CANVAS_H - cache.outH * scale) / 2;
    var dots = cache.dots;
    var i;
    var d;
    var circle;

    for (i = 0; i < dots.length; i++) {
      d = dots[i];
      circle = elSvg("circle");
      circle.setAttribute("cx", String(offsetX + d.cx * scale));
      circle.setAttribute("cy", String(offsetY + d.cy * scale));
      circle.setAttribute("r", String(d.r * scale));
      circle.setAttribute("fill", d.fill);
      circle.setAttribute("stroke", "none");
      layer.appendChild(circle);
    }
  }

  /**
   * @param {string[]} lines
   */
  function pushStippleDotsExportLines(lines) {
    if (
      !isEmotionCanvasVisible("hope") ||
      !hasActiveMergeCutouts() ||
      !stippleDotsCache ||
      !stippleDotsCache.dots.length
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

    var cache = stippleDotsCache;
    var scale = Math.min(CANVAS_W / cache.outW, CANVAS_H / cache.outH);
    var offsetX = (CANVAS_W - cache.outW * scale) / 2;
    var offsetY = (CANVAS_H - cache.outH * scale) / 2;
    var dots = cache.dots;
    var i;
    var d;

    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push(
      '<g id="layer-stipple-dots" clip-path="url(#' +
        MERGE_REGIONS_CLIP_ID +
        ')">'
    );
    for (i = 0; i < dots.length; i++) {
      d = dots[i];
      lines.push(
        '<circle cx="' +
          (offsetX + d.cx * scale) +
          '" cy="' +
          (offsetY + d.cy * scale) +
          '" r="' +
          d.r * scale +
          '" fill="' +
          d.fill +
          '" stroke="none"/>'
      );
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  function buildLayoutSignature() {
    return lastOctagonsN + "|" + CANVAS_W + "|" + CANVAS_H;
  }

  function getUprightSquareCatalog() {
    return TopkapiGeometry.buildUprightSquareCatalog(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H
    );
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
    var fillColor = getPatternStrokeColor();
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
   * @param {{ cx: number, cy: number, r: number }[]} circles
   * @returns {SVGElement}
   */
  function circlesToGroup(circles) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-circles");
    g.setAttribute("fill", getCircleFillColor());
    var circleStroke = getCircleStrokeWidth();
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
      cachedAllSegments,
      combined
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
    if (!cachedAllSegments.length) return;

    clearAutoMergeState();

    var bounds = getGridContentBounds();
    var manualVisible = getVisibleSegmentsManualOnly(cachedAllSegments);
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
        cachedAllSegments,
        baselineFaces,
        clusters[ci].faceIndices,
        clusters[ci].edgeKeys,
        autoMergeEdgeKeys
      );
      if (fillRegion) fillRegions.push(fillRegion);
    }

    fillRegions = TopkapiGeometry.appendOrphanAutoMergeFillRegions(
      fillRegions,
      cachedAllSegments,
      baselineFaces,
      autoMergeEdgeKeys
    );

    autoMergeFillRegions = TopkapiGeometry.filterAutoMergeFillRegions(
      fillRegions,
      baselineFaces
    );

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
      p.setAttribute("fill", BG_COLOR);
      p.setAttribute("fill-rule", "nonzero");
      p.setAttribute("stroke", getPatternStrokeColor());
      p.setAttribute("stroke-width", String(getGridStrokeWidth()));
      p.setAttribute("stroke-linejoin", "miter");
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

  function getVerticalGridStrokeWidth() {
    return getGridStrokeWidth() * 3;
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
    var yTop = bounds.y;
    var yBottom = bounds.y + bounds.height;
    var minDist = getVerticalLineMinDistance();
    var lines = [];
    var lastPlacedX = null;
    var i;
    var line;

    for (i = 0; i < xs.length; i++) {
      if (!isVerticalLineXInGridBounds(xs[i], bounds)) continue;
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
    layer.setAttribute("stroke", getPatternStrokeColor());
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
        getPatternStrokeColor() +
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
    renderPatternLayer();
    renderGridMaskLayer("renderPatternAndVerticalLayers");
    renderAutoMergeFillsLayer();
  }

  function applyGridBoundaryAttrs(rect, bounds) {
    rect.setAttribute("x", String(bounds.x));
    rect.setAttribute("y", String(bounds.y));
    rect.setAttribute("width", String(bounds.width));
    rect.setAttribute("height", String(bounds.height));
  }

  function applyGridBoundaryStyle(rect) {
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", getPatternStrokeColor());
    rect.setAttribute("stroke-width", String(GRID_BOUNDARY_STROKE_WIDTH));
    rect.setAttribute("vector-effect", "non-scaling-stroke");
  }

  function createGridBoundaryRect() {
    var rect = elSvg("rect");
    rect.setAttribute("id", "grid-boundary");
    applyGridBoundaryAttrs(rect, getGridContentBounds());
    applyGridBoundaryStyle(rect);
    return rect;
  }

  function updateGridBoundaryRect() {
    if (!designSvg) return;
    var rect = designSvg.querySelector("#grid-boundary");
    if (!rect) return;
    applyGridBoundaryAttrs(rect, getGridContentBounds());
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
        getPatternStrokeColor() +
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

  function isBodyAutonomyHomeChecked() {
    var el = document.getElementById("body-autonomy-home");
    return el ? el.checked : false;
  }

  function isBodyAutonomyOutsideChecked() {
    var el = document.getElementById("body-autonomy-outside");
    return el ? el.checked : false;
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
    if (cellType === "grey") {
      return typeof BORDER_SIDE_CELL_COLOR_BEIGE !== "undefined"
        ? BORDER_SIDE_CELL_COLOR_BEIGE
        : BORDER_SIDE_X_FILL_RIGHT;
    }
    return BORDER_SIDE_CELL_COLOR_GREY;
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
  function appendBorderSideCellDiagonals(g, b, rightX, yTop, yBottom) {
    appendBorderDivisionLine(g, 0, yTop, b, yBottom);
    appendBorderDivisionLine(g, b, yTop, 0, yBottom);
    appendBorderDivisionLine(g, rightX, yTop, CANVAS_W, yBottom);
    appendBorderDivisionLine(g, CANVAS_W, yTop, rightX, yBottom);
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
    if (!outlineOnly && !outside) return;

    var b = getCanvasBorderPx();
    var yBounds = getLeftRightBorderCellYBounds();
    var j;
    var yTop;
    var yBottom;
    var cellType;
    var rightX = CANVAS_W - b;

    for (j = 0; j < yBounds.length - 1; j++) {
      cellType = getBorderSideCellType(j);
      if (cellType === "grey" || cellType === "beige") continue;
      if (!outlineOnly && cellType !== "outside") continue;
      yTop = yBounds[j];
      yBottom = yBounds[j + 1];
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
   * Side-cell fills, then margin division ticks + X diagonals on #layer-border-divisions.
   * @param {SVGElement} g
   */
  function appendBorderDivisionLayersToGroup(g) {
    appendLeftRightBorderCellFillsToGroup(g);
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getPatternStrokeColor());
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
    return typeof CANVAS_EDGE_SERIAL_FILL !== "undefined"
      ? CANVAS_EDGE_SERIAL_FILL
      : getPatternStrokeColor();
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
    if (window.LabelBarControls && window.LabelBarControls.getItems) {
      return window.LabelBarControls.getItems();
    }
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
    text.setAttribute("fill", getBrownBarBannerFill());
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
      : "undercover arabic.svg";
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
      preloadLabelBarSvgAssetsForExport();
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
            ? getLabelBarBackgroundColor()
            : getLabelBarContentColor();
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
            ? getLabelBarBackgroundColor()
            : getLabelBarContentColor();
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

    lines.push(
      '<g id="layer-border-divisions" fill="none" stroke="' +
        getPatternStrokeColor() +
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
    if (outlineOnly || outside) {
      for (j = 0; j < yBounds.length - 1; j++) {
        cellType = getBorderSideCellType(j);
        if (cellType === "grey" || cellType === "beige") continue;
        if (!outlineOnly && cellType !== "outside") continue;
        yTop = yBounds[j];
        yBottom = yBounds[j + 1];
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
    svg.setAttribute("aria-label", "Topkapi geometric grid");

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

    svg.appendChild(innerContent);

    var edgeBrownBars = elSvg("g");
    edgeBrownBars.setAttribute("id", "layer-edge-brown-bars");
    populateEdgeBrownBarsLayer(edgeBrownBars);
    svg.appendChild(edgeBrownBars);

    svg.appendChild(createBrownBarBannerTextGroup());

    svg.appendChild(createCanvasEdgeSerialGroup());

    svg.appendChild(createFrameInsetOverlayLayer());

    return svg;
  }

  function renderDiamondFillsLayer() {
    if (!designSvg) return;
    var diamondLayer = designSvg.querySelector("#layer-diamond-fills");
    if (!diamondLayer) return;

    while (diamondLayer.firstChild) diamondLayer.removeChild(diamondLayer.firstChild);

    var filled = getFilledDiamonds();
    if (filled.length) diamondLayer.appendChild(diamondsToGroup(filled));
  }

  function renderPatternLayer() {
    if (!designSvg) return;
    var patternLayer = designSvg.querySelector("#layer-pattern");
    if (!patternLayer) return;

    if (isStarGrid()) {
      renderDiamondFillsLayer();
      while (patternLayer.firstChild) {
        patternLayer.removeChild(patternLayer.firstChild);
      }
      if (cachedStarFills.length) {
        patternLayer.appendChild(starFillsToGroup(cachedStarFills));
      }
      patternLayer.appendChild(segmentsToGroup(cachedAllSegments));
      return;
    }

    renderDiamondFillsLayer();
    while (patternLayer.firstChild) patternLayer.removeChild(patternLayer.firstChild);
    patternLayer.appendChild(
      segmentsToGroup(getVisibleSegments(cachedAllSegments))
    );
    var circles = getActiveCircles();
    if (circles.length) {
      patternLayer.appendChild(circlesToGroup(circles));
    }
  }

  /**
   * Star grid: pattern, border frame, label bars, Anger vertical lines.
   * (Other emotion layers remain deferred until later steps.)
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

    var strokeOut = document.getElementById("grid-stroke-width-out");
    if (strokeOut) strokeOut.textContent = String(getGridStrokeWidth()) + " px";

    var borderSideOut = document.getElementById("border-side-segments-out");
    if (borderSideOut) {
      borderSideOut.textContent = String(getBorderLeftRightSegments());
    }

    var angerLengthOut = document.getElementById("anger-vertical-length-out");
    if (angerLengthOut) {
      angerLengthOut.textContent = String(getAngerVerticalLengthPercent()) + "%";
    }

    var diamondSig = buildDiamondLayoutSignature();
    if (diamondSig !== lastDiamondLayoutSignature) {
      lastDiamondLayoutSignature = diamondSig;
      syncDiamondFill(false);
    }

    var prideFillOut = document.getElementById("pride-fill-percent-out");
    if (prideFillOut) {
      prideFillOut.textContent = String(getPrideFillPercent()) + "%";
    }

    var fill = designSvg.querySelector("#canvas-background-fill");
    if (fill) fill.setAttribute("fill", getCanvasBackgroundColor());

    refreshBorderFrameAndLabelBars();
    syncVerticalGridLines(false);
    renderVerticalGridLayer();
    renderPatternLayer();
    layoutStage();
    updateResetButton();
  }

  function render() {
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

    var layoutSig = buildLayoutSignature();
    if (layoutSig !== lastCircleLayoutSignature) {
      lastCircleLayoutSignature = layoutSig;
      syncCircleSelection(true);
    }

    var diamondSig = buildDiamondLayoutSignature();
    if (diamondSig !== lastDiamondLayoutSignature) {
      lastDiamondLayoutSignature = diamondSig;
      syncDiamondFill(false);
    }

    var densityOut = document.getElementById("circle-density-out");
    if (densityOut) densityOut.textContent = String(getCircleDensity()) + "%";

    var prideFillOut = document.getElementById("pride-fill-percent-out");
    if (prideFillOut) {
      prideFillOut.textContent = String(getPrideFillPercent()) + "%";
    }

    updateAutoMergeIntensityOutput();

    var angerLengthOut = document.getElementById("anger-vertical-length-out");
    if (angerLengthOut) {
      angerLengthOut.textContent = String(getAngerVerticalLengthPercent()) + "%";
    }

    var strokeOut = document.getElementById("grid-stroke-width-out");
    if (strokeOut) strokeOut.textContent = String(getGridStrokeWidth()) + " px";

    var borderSideOut = document.getElementById("border-side-segments-out");
    if (borderSideOut) {
      borderSideOut.textContent = String(getBorderLeftRightSegments());
    }

    renderBackgroundLayer();
    renderGridMaskLayer("render");
    renderStippleDotsLayer();
    applyMergeReveal();
    syncVerticalGridLines(false);
    renderVerticalGridLayer();
    renderAutoMergeFillsLayer();
    updateGridBoundaryRect();
    updateBorderDivisionLines();
    updateCanvasEdgeBrownBars();
    renderPatternLayer();
    updateFrameInsetOverlayLayer();
    layoutStage();
    updateResetButton();
  }

  function renderAfterSliderChange() {
    var hadAutoMerge = autoMergeEdgeKeys.size > 0;
    clearMergeState();
    clearAutoMergeState();
    render();
    if (hadAutoMerge && isOctagonGrid()) {
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

  function randomizeAllDesignControls() {
    setSliderValue("octagons-n", randomIntInRange(OCTAGONS_N_MIN, OCTAGONS_N_MAX));
    setSliderValue(
      "inner-scale",
      randomSteppedValue(INNER_SCALE_MIN, INNER_SCALE_MAX, 0.01)
    );
    setSliderValue(
      "grid-stroke-width",
      randomIntInRange(GRID_STROKE_WIDTH_MIN, GRID_STROKE_WIDTH_MAX)
    );
    setSliderValue(
      "border-side-segments",
      randomIntInRange(
        BORDER_LEFT_RIGHT_SEGMENTS_MIN,
        BORDER_LEFT_RIGHT_SEGMENTS_MAX
      )
    );
    setSliderValue(
      "anger-vertical-length",
      randomIntInRange(ANGER_VERTICAL_LENGTH_MIN, ANGER_VERTICAL_LENGTH_MAX)
    );
    setSliderValue(
      "circle-density",
      randomIntInRange(CIRCLE_DENSITY_MIN, CIRCLE_DENSITY_MAX)
    );
    setSliderValue(
      "pride-fill-percent",
      randomIntInRange(PRIDE_FILL_PERCENT_MIN, PRIDE_FILL_PERCENT_MAX)
    );

    var homeCb = document.getElementById("body-autonomy-home");
    var outsideCb = document.getElementById("body-autonomy-outside");
    if (homeCb) homeCb.checked = Math.random() < 0.5;
    if (outsideCb) outsideCb.checked = Math.random() < 0.5;

    regenerateBorderSideSegmentRatios();
    clearMergeState();
    syncCircleSelection(true);
    syncPrideShapes();
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
  function buildExportSvgString(segments, circles, diamonds, fontDataUri) {
    var lines = [];
    var gridBounds = getGridContentBounds();
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
    pushStippleDotsExportLines(lines);

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

    if (circles.length) {
      lines.push(
        '<g id="layer-circles" fill="' +
          getCircleFillColor() +
          '" stroke="' +
          getPatternStrokeColor() +
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

    pushAutoMergeFillExportLines(lines);

    lines.push("</g>");
    lines.push("</g>");
    lines.push('<g id="layer-edge-brown-bars">');
    pushCanvasEdgeBrownBarExportLines(lines);
    lines.push("</g>");
    pushCanvasEdgeSerialExport(lines);
    if (frameInsetOverlayVisible) {
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

    Promise.all([fontReady, loadExportFontDataUri(), preloadLabelBarSvgAssetsForExport()])
      .then(function (results) {
        var fontDataUri = results[1];
        try {
          syncVerticalGridLines(false);
          var markup = buildExportSvgString(
            getVisibleSegments(cachedAllSegments),
            getActiveCircles(),
            getFilledDiamonds(),
            fontDataUri
          );
          var blob = new Blob([markup], {
            type: "image/svg+xml;charset=utf-8",
          });
          downloadBlob(blob, "topkapi-export-70x180cm.svg");
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
          var markup = buildExportSvgString(
            getVisibleSegments(cachedAllSegments),
            getActiveCircles(),
            getFilledDiamonds(),
            null
          );
          var blob = new Blob([markup], {
            type: "image/svg+xml;charset=utf-8",
          });
          downloadBlob(blob, "topkapi-export-70x180cm.svg");
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
    var changed = false;
    var pruneKeys = TopkapiGeometry.findDanglingPruneKeys(
      cachedAllSegments,
      removedEdges
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
      cachedAllSegments,
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
      var visible = getVisibleSegments(cachedAllSegments);
      var keys = TopkapiGeometry.findSegmentsNearPolyline(
        visible,
        dragPath,
        threshold,
        removedEdges
      );
      removeEdgesByKeys(keys);
    } else if (interactionMode === "restore") {
      if (!removedEdges.size) return;
      var visible = getVisibleSegments(cachedAllSegments);
      var restoreKeys = TopkapiGeometry.findRestoreCandidateKeys(
        cachedAllSegments,
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
    if (isStarGrid() && mode !== "view") return;
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

  function init() {
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

    var canvasBackgroundColorInput = document.getElementById(
      "canvas-background-color"
    );
    if (canvasBackgroundColorInput) {
      canvasBackgroundColorInput.value =
        typeof CANVAS_BACKGROUND_COLOR_DEFAULT !== "undefined"
          ? CANVAS_BACKGROUND_COLOR_DEFAULT
          : BG_COLOR;
      canvasBackgroundColorInput.addEventListener("input", function () {
        updateCanvasBackgroundColor();
      });
    }

    var patternColorInput = document.getElementById("pattern-stroke-color");
    if (patternColorInput) {
      patternColorInput.value = PATTERN_STROKE_COLOR_DEFAULT;
      patternColorInput.addEventListener("input", function () {
        updateGridBoundaryRect();
        updateBorderDivisionLines();
        renderPatternLayer();
        renderVerticalGridLayer();
        if (!isStarGrid()) {
          renderAutoMergeFillsLayer();
          updateFrameInsetOverlayLayer();
        }
        syncMagnifierBorderColor();
      });
    }

    var circleFillColorInput = document.getElementById("circle-fill-color");
    if (circleFillColorInput) {
      circleFillColorInput.value =
        typeof CIRCLE_FILL_COLOR_DEFAULT !== "undefined"
          ? CIRCLE_FILL_COLOR_DEFAULT
          : "#ffffff";
      circleFillColorInput.addEventListener("input", function () {
        renderPatternLayer();
      });
    }

    var diamondFillColorInput = document.getElementById("diamond-fill-color");
    if (diamondFillColorInput) {
      diamondFillColorInput.value = DIAMOND_FILL_COLOR_DEFAULT;
      diamondFillColorInput.addEventListener("input", function () {
        renderDiamondFillsLayer();
      });
    }

    function onLabelBarColorChange() {
      if (isStarGrid()) render();
      else updateCanvasEdgeBrownBars();
    }

    var labelBarBackgroundColorInput = document.getElementById(
      "label-bar-background-color"
    );
    if (labelBarBackgroundColorInput) {
      labelBarBackgroundColorInput.value =
        typeof LABEL_BAR_BACKGROUND_COLOR_DEFAULT !== "undefined"
          ? LABEL_BAR_BACKGROUND_COLOR_DEFAULT
          : CANVAS_EDGE_BROWN_BAR_COLOR;
      labelBarBackgroundColorInput.addEventListener("input", onLabelBarColorChange);
    }

    var labelBarContentColorInput = document.getElementById("label-bar-content-color");
    if (labelBarContentColorInput) {
      labelBarContentColorInput.value =
        typeof LABEL_BAR_CONTENT_COLOR_DEFAULT !== "undefined"
          ? LABEL_BAR_CONTENT_COLOR_DEFAULT
          : "#ffffff";
      labelBarContentColorInput.addEventListener("input", onLabelBarColorChange);
    }

    var borderSideSegmentsSlider = document.getElementById("border-side-segments");
    if (borderSideSegmentsSlider) {
      borderSideSegmentsSlider.min = String(BORDER_LEFT_RIGHT_SEGMENTS_MIN);
      borderSideSegmentsSlider.max = String(BORDER_LEFT_RIGHT_SEGMENTS_MAX);
      borderSideSegmentsSlider.value = String(BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT);
      borderSideSegmentsSlider.addEventListener("input", function () {
        regenerateBorderSideSegmentRatios();
        var borderSideOut = document.getElementById("border-side-segments-out");
        if (borderSideOut) {
          borderSideOut.textContent = String(getBorderLeftRightSegments());
        }
        if (isStarGrid()) {
          render();
        } else {
          updateBorderDivisionLines();
        }
      });
    }

    ["body-autonomy-home", "body-autonomy-outside"].forEach(function (id) {
      var cb = document.getElementById(id);
      if (cb) {
        cb.addEventListener("change", function () {
          if (isStarGrid()) render();
          else updateBorderDivisionLines();
        });
      }
    });

    var gridStrokeSlider = document.getElementById("grid-stroke-width");
    if (gridStrokeSlider) {
      gridStrokeSlider.min = String(GRID_STROKE_WIDTH_MIN);
      gridStrokeSlider.max = String(GRID_STROKE_WIDTH_MAX);
      gridStrokeSlider.value = String(GRID_STROKE_WIDTH_DEFAULT);
      gridStrokeSlider.addEventListener("input", function () {
        var strokeOut = document.getElementById("grid-stroke-width-out");
        if (strokeOut) strokeOut.textContent = String(getGridStrokeWidth()) + " px";
        updateGridBoundaryRect();
        renderPatternLayer();
        renderVerticalGridLayer();
        if (!isStarGrid()) {
          renderAutoMergeFillsLayer();
        }
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
        syncPrideShapes();
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

    var dotsFileInput = document.getElementById("bg-dots-file-input");
    var dotsFileMeta = document.getElementById("bg-dots-file-meta");
    var dotsResolution = document.getElementById("bg-dots-resolution");
    var dotsResolutionOut = document.getElementById("bg-dots-resolution-out");
    var dotsDotSize = document.getElementById("bg-dots-dot-size");
    var dotsDotSizeOut = document.getElementById("bg-dots-dot-size-out");
    var dotsDotSpacing = document.getElementById("bg-dots-dot-spacing");
    var dotsDotSpacingOut = document.getElementById("bg-dots-dot-spacing-out");
    var dotsModeBw = document.getElementById("bg-dots-mode-bw-btn");
    var dotsModeColor = document.getElementById("bg-dots-mode-color-btn");
    var dotsGenerateBtn = document.getElementById("bg-dots-generate-btn");
    var dotsProgressLabel = document.getElementById("bg-dots-progress-label");

    function updateStippleSliderOutputs() {
      if (dotsResolutionOut && dotsResolution) {
        dotsResolutionOut.textContent = dotsResolution.value + "%";
      }
      if (dotsDotSizeOut && dotsDotSize) {
        dotsDotSizeOut.textContent = dotsDotSize.value + "px";
      }
      if (dotsDotSpacingOut && dotsDotSpacing) {
        dotsDotSpacingOut.textContent = dotsDotSpacing.value + "px";
      }
    }

    function updateStippleFileMeta() {
      if (!dotsFileMeta) return;
      if (!stippleSourceImage) {
        dotsFileMeta.textContent = "No image loaded";
        return;
      }
      var size = getStippleOutputSize(
        dotsResolution ? Number(dotsResolution.value) : 100
      );
      dotsFileMeta.textContent =
        stippleSrcW +
        "×" +
        stippleSrcH +
        " → " +
        size.outW +
        "×" +
        size.outH +
        " at current resolution";
    }

    function loadStippleImageFromFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          stippleSourceImage = img;
          stippleSrcW = img.naturalWidth;
          stippleSrcH = img.naturalHeight;
          updateStippleFileMeta();
          if (dotsGenerateBtn) dotsGenerateBtn.disabled = false;
        };
        img.onerror = function () {
          alert("Could not load this image. Try another JPG or PNG.");
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    function runStippleGeneration() {
      if (!stippleSourceImage || typeof StippleEngine === "undefined") return;

      var size = getStippleOutputSize(
        dotsResolution ? Number(dotsResolution.value) : 100
      );
      var jobId = ++stippleGenerationId;

      if (dotsGenerateBtn) dotsGenerateBtn.disabled = true;
      if (dotsProgressLabel) {
        dotsProgressLabel.hidden = false;
        dotsProgressLabel.textContent = "Processing… 0%";
      }

      StippleEngine.generate(
        {
          sourceImage: stippleSourceImage,
          outW: size.outW,
          outH: size.outH,
          dotSize: dotsDotSize ? Number(dotsDotSize.value) : 2,
          dotSpacing: dotsDotSpacing ? Number(dotsDotSpacing.value) : 1,
          colorMode: stippleColorMode,
          jobId: jobId,
          getJobId: function () {
            return stippleGenerationId;
          },
        },
        {
          onProgress: function (done, total) {
            if (dotsProgressLabel) {
              var pct = total > 0 ? Math.round((done / total) * 100) : 0;
              dotsProgressLabel.textContent = "Processing… " + pct + "%";
            }
          },
          onComplete: function (result) {
            if (result.jobId !== stippleGenerationId) return;
            stippleDotsCache = {
              dots: result.dots,
              outW: result.outW,
              outH: result.outH,
            };
            renderStippleDotsLayer();
            applyMergeReveal();
            if (dotsProgressLabel) dotsProgressLabel.hidden = true;
            if (dotsGenerateBtn) dotsGenerateBtn.disabled = !stippleSourceImage;
            updateStippleFileMeta();
          },
          onError: function (msg) {
            alert(msg);
            if (dotsProgressLabel) dotsProgressLabel.hidden = true;
            if (dotsGenerateBtn) dotsGenerateBtn.disabled = !stippleSourceImage;
          },
          onCancel: function () {
            if (dotsProgressLabel) dotsProgressLabel.hidden = true;
            if (dotsGenerateBtn) dotsGenerateBtn.disabled = !stippleSourceImage;
          },
        }
      );
    }

    if (dotsFileInput) {
      dotsFileInput.addEventListener("change", function () {
        var file = dotsFileInput.files && dotsFileInput.files[0];
        if (file) loadStippleImageFromFile(file);
      });
    }

    if (dotsResolution) {
      dotsResolution.addEventListener("input", function () {
        updateStippleSliderOutputs();
        updateStippleFileMeta();
      });
    }
    if (dotsDotSize) {
      dotsDotSize.addEventListener("input", updateStippleSliderOutputs);
    }
    if (dotsDotSpacing) {
      dotsDotSpacing.addEventListener("input", updateStippleSliderOutputs);
    }

    if (dotsModeBw) {
      dotsModeBw.addEventListener("click", function () {
        stippleColorMode = "bw";
        dotsModeBw.classList.add("is-active");
        dotsModeBw.setAttribute("aria-pressed", "true");
        if (dotsModeColor) {
          dotsModeColor.classList.remove("is-active");
          dotsModeColor.setAttribute("aria-pressed", "false");
        }
      });
    }
    if (dotsModeColor) {
      dotsModeColor.addEventListener("click", function () {
        stippleColorMode = "color";
        dotsModeColor.classList.add("is-active");
        dotsModeColor.setAttribute("aria-pressed", "true");
        if (dotsModeBw) {
          dotsModeBw.classList.remove("is-active");
          dotsModeBw.setAttribute("aria-pressed", "false");
        }
      });
    }

    if (dotsGenerateBtn) {
      dotsGenerateBtn.addEventListener("click", function () {
        stippleGenerationId++;
        runStippleGeneration();
      });
    }

    updateStippleSliderOutputs();

    if (window.LabelBarControls && window.LabelBarControls.init) {
      window.LabelBarControls.init(refreshLabelBarContent);
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
    lastDiamondLayoutSignature = "";
    render();
    syncFrameOverlayToggleButton();
    initMagnifier();
    setMode("view");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var designSvg = null;
  var cachedExportFontDataUri = null;
  var lastOctagonsN = OCTAGONS_N_DEFAULT;
  var lastTileSize = CANVAS_W / (OCTAGONS_N_DEFAULT + 1);
  var cachedAllSegments = [];
  var cachedVerticalGridLines = [];
  var lastVerticalGridLayoutSignature = "";

  var interactionMode = "view";
  var removedEdges = new Set();
  var dragPath = [];
  var isDragging = false;

  var circleSelectedIds = new Set();
  var lastCircleLayoutSignature = "";
  var diamondFilledIds = new Set();
  var lastDiamondLayoutSignature = "";
  var cachedLetterMarkerAnchor = null;
  var lastLetterMarkerLayoutSignature = "";
  var letterMarkerWord =
    typeof LETTER_MARKER_WORD_DEFAULT !== "undefined"
      ? LETTER_MARKER_WORD_DEFAULT
      : "";
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

  /** Persist mask holes so continued merging cannot drop earlier cutouts. */
  var stickyMergedCutoutFaces = null;
  /** Random column edges for brown-bar outer-third grid (regenerated on layout change). */
  var cachedBrownBarGridXBounds = null;
  var lastBrownBarGridLayoutSignature = "";

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

  function getOctagonsN() {
    var slider = document.getElementById("octagons-n");
    var v = slider ? Number(slider.value) : OCTAGONS_N_DEFAULT;
    return Math.min(OCTAGONS_N_MAX, Math.max(OCTAGONS_N_MIN, Math.round(v)));
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

  function getDiamondFillPercent() {
    var slider = document.getElementById("diamond-fill-percent");
    var v = slider ? Number(slider.value) : DIAMOND_FILL_PERCENT_DEFAULT;
    return Math.min(
      DIAMOND_FILL_PERCENT_MAX,
      Math.max(DIAMOND_FILL_PERCENT_MIN, Math.round(v))
    );
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

  function getDiamondFillColor() {
    var input = document.getElementById("diamond-fill-color");
    return normalizeHexColor(
      input ? input.value : null,
      DIAMOND_FILL_COLOR_DEFAULT
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
        BG_COLOR +
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
    whiteRect.setAttribute("fill", BG_COLOR);
    layer.appendChild(whiteRect);
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
    maskRect.setAttribute("fill", BG_COLOR);
    maskRect.setAttribute("mask", "url(#" + GRID_WHITE_MASK_ID + ")");
    layer.appendChild(maskRect);

    applyMergeReveal();
  }

  function applyMergeReveal() {
    if (!designSvg) return;

    var active = hasActiveMergeCutouts();
    var maskClipped = designSvg.querySelector("#inner-clipped-grid-mask");
    var dotsClipped = designSvg.querySelector("#inner-clipped-stipple-dots");
    var dotsLayer = designSvg.querySelector("#layer-stipple-dots");
    var defs = designSvg.querySelector("defs");
    if (maskClipped) {
      maskClipped.style.display = active ? "" : "none";
    }

    if (!active) {
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
        BG_COLOR +
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

    if (!hasActiveMergeCutouts() || !stippleDotsCache || !stippleDotsCache.dots.length) {
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
    if (!hasActiveMergeCutouts() || !stippleDotsCache || !stippleDotsCache.dots.length) {
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
    return TopkapiGeometry.buildDiamondCatalog(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H,
      getInnerScale()
    );
  }

  function buildDiamondLayoutSignature() {
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
    }

    var target = Math.round((catalog.length * getDiamondFillPercent()) / 100);
    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    if (forceReshuffle || diamondFilledIds.size !== target) {
      diamondFilledIds.clear();
      var picked = shufflePickIds(catalog, target);
      for (var p = 0; p < picked.length; p++) {
        diamondFilledIds.add(picked[p]);
      }
    }
  }

  /**
   * @returns {{ id: string, points: { x: number, y: number }[] }[]}
   */
  function getFilledDiamonds() {
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
   * @returns {{ cx: number, cy: number, r: number }[]}
   */
  function getActiveCircles() {
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
    g.setAttribute("fill", "none");
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

  function getLetterMarkerWord() {
    var input = document.getElementById("letter-marker-word");
    if (input && typeof input.value === "string") {
      return input.value;
    }
    return letterMarkerWord;
  }

  /**
   * Words split on spaces; index 0 = rightmost column.
   * @returns {string[]}
   */
  function getLetterMarkerWords() {
    var text = getLetterMarkerWord().trim();
    if (!text) return [];
    var parts = text.split(/\s+/);
    var words = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].length) words.push(parts[i]);
    }
    var maxColumns =
      typeof LETTER_MARKER_MAX_COLUMNS !== "undefined"
        ? LETTER_MARKER_MAX_COLUMNS
        : 12;
    if (words.length > maxColumns) {
      words = words.slice(0, maxColumns);
    }
    return words;
  }

  function getLetterMarkerLayout() {
    return TopkapiGeometry.computeLayout(lastOctagonsN, CANVAS_W, CANVAS_H);
  }

  /**
   * @param {boolean} [forceRepick]
   */
  function ensureLetterMarkerAnchor(forceRepick) {
    var words = getLetterMarkerWords();
    if (!words.length) {
      cachedLetterMarkerAnchor = null;
      return;
    }

    var layout = getLetterMarkerLayout();
    var lengths = TopkapiGeometry.letterMarkerWordLengths(words);

    if (
      !forceRepick &&
      cachedLetterMarkerAnchor &&
      TopkapiGeometry.isLetterMarkerAnchorValid(
        layout,
        cachedLetterMarkerAnchor,
        lengths
      )
    ) {
      return;
    }

    cachedLetterMarkerAnchor = TopkapiGeometry.pickRandomLetterMarkerAnchor(
      layout,
      lengths
    );
  }

  /** New random anchor on page refresh or octagon count change. */
  function syncLetterOctagonMarkers() {
    cachedLetterMarkerAnchor = null;
    ensureLetterMarkerAnchor(true);
  }

  /**
   * @returns {{ columns: { markers: { cx: number, cy: number, r: number, char: string }[] }[] } | null}
   */
  function buildLetterMarkerBundle() {
    var words = getLetterMarkerWords();
    if (!words.length || !cachedLetterMarkerAnchor) return null;

    return TopkapiGeometry.buildLetterMarkerColumns(
      getLetterMarkerLayout(),
      cachedLetterMarkerAnchor,
      words
    );
  }

  /**
   * @param {{ markers: { cx: number, cy: number, r: number, char: string }[] }[]} columns
   * @param {SVGElement} g
   * @param {string} strokeColor
   */
  function appendLetterMarkerColumn(g, column, strokeColor) {
    var markers = column.markers;
    if (!markers.length) return;

    var top = markers[0];
    var bottom = markers[markers.length - 1];
    var connector = elSvg("line");
    connector.setAttribute("x1", String(top.cx));
    connector.setAttribute("y1", String(top.cy));
    connector.setAttribute("x2", String(bottom.cx));
    connector.setAttribute("y2", String(bottom.cy));
    connector.setAttribute("stroke", strokeColor);
    connector.setAttribute("stroke-width", String(getCircleStrokeWidth()));
    connector.setAttribute("fill", "none");
    g.appendChild(connector);

    var i;
    for (i = 0; i < markers.length; i++) {
      var m = markers[i];
      var circle = elSvg("circle");
      circle.setAttribute("cx", String(m.cx));
      circle.setAttribute("cy", String(m.cy));
      circle.setAttribute("r", String(m.r));
      circle.setAttribute("fill", strokeColor);
      circle.setAttribute("stroke", "none");
      g.appendChild(circle);
    }

    for (i = 0; i < markers.length; i++) {
      var mk = markers[i];
      var text = elSvg("text");
      text.setAttribute("x", String(mk.cx));
      text.setAttribute("y", String(mk.cy));
      text.setAttribute("fill", "#ffffff");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("font-family", "Helvetica, Arial, sans-serif");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute(
        "font-size",
        String(2 * mk.r * LETTER_MARKER_FONT_SIZE_RATIO)
      );
      text.textContent = mk.char || "";
      g.appendChild(text);
    }
  }

  /**
   * @param {{ columns: { markers: object[] }[] }} bundle
   * @returns {SVGElement}
   */
  function letterMarkersToGroup(bundle) {
    var g = elSvg("g");
    var strokeColor = getPatternStrokeColor();
    var columns = bundle.columns;
    var c;
    for (c = 0; c < columns.length; c++) {
      appendLetterMarkerColumn(g, columns[c], strokeColor);
    }
    return g;
  }

  function renderLetterMarkersLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-letter-markers");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    ensureLetterMarkerAnchor(false);
    var bundle = buildLetterMarkerBundle();
    if (bundle && bundle.columns.length) {
      layer.appendChild(letterMarkersToGroup(bundle));
    }
  }

  function updateLayoutState() {
    lastOctagonsN = getOctagonsN();
    lastTileSize = TopkapiGeometry.tileSizeFromN(lastOctagonsN, CANVAS_W);
  }

  function buildAllSegments() {
    return TopkapiGeometry.buildPatternSegments(
      lastTileSize,
      CANVAS_W,
      CANVAS_H,
      lastOctagonsN,
      getInnerScale()
    );
  }

  function getVisibleSegments(segments) {
    var visible = [];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!removedEdges.has(key)) visible.push(s);
    }
    return visible;
  }

  function isDragInteractionMode() {
    return interactionMode === "merge" || interactionMode === "restore";
  }

  function clearMergeState() {
    removedEdges.clear();
    stickyMergedCutoutFaces = null;
    updateResetButton();
  }

  function updateResetButton() {
    var resetBtn = document.getElementById("reset-grid-btn");
    if (resetBtn) resetBtn.disabled = removedEdges.size === 0;
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

  function getGridContentBounds() {
    return TopkapiGeometry.getGridContentBounds(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H
    );
  }

  function getVerticalGridStrokeWidth() {
    return getGridStrokeWidth() * 2;
  }

  /** Geometry only — merge/erase state must not invalidate vertical lines. */
  function buildVerticalGridLayoutSignature() {
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
   * @param {number} x
   * @param {number} yTop
   * @param {number} yBottom
   * @returns {{ x: number, y1: number, y2: number } | null}
   */
  function buildRandomizedVerticalLine(x, yTop, yBottom) {
    var mode = pickVerticalShortenMode();
    var y1 = yTop;
    var y2 = yBottom;

    if (mode === "top" || mode === "both") {
      y1 = yTop + randomVerticalTrimAmount();
    }
    if (mode === "bottom" || mode === "both") {
      y2 = yBottom - randomVerticalTrimAmount();
    }

    y1 = Math.max(yTop, Math.min(y1, yBottom));
    y2 = Math.max(yTop, Math.min(y2, yBottom));
    if (y2 <= y1) return null;

    return { x: x, y1: y1, y2: y2 };
  }

  /**
   * Left third of the grid content area (inner frame), inclusive.
   * @param {number} x
   * @param {{ x: number, width: number }} bounds
   * @returns {boolean}
   */
  function isVerticalLineXInLeftThird(x, bounds) {
    var left = bounds.x;
    var right = bounds.x + bounds.width / 3;
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

    var xs = TopkapiGeometry.collectUniqueGridXCoords(cachedAllSegments);
    var bounds = getGridContentBounds();
    var yTop = bounds.y;
    var yBottom = bounds.y + bounds.height;
    var minDist = getVerticalLineMinDistance();
    var lines = [];
    var lastPlacedX = null;
    var i;
    var line;

    for (i = 0; i < xs.length; i++) {
      if (!isVerticalLineXInLeftThird(xs[i], bounds)) continue;
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

  function renderVerticalGridLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-vertical-grid");
    if (!layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    layer.setAttribute("fill", "none");
    layer.setAttribute("stroke", getPatternStrokeColor());
    layer.setAttribute("stroke-width", String(getVerticalGridStrokeWidth()));
    for (var i = 0; i < cachedVerticalGridLines.length; i++) {
      var vl = cachedVerticalGridLines[i];
      var line = elSvg("line");
      line.setAttribute("x1", String(vl.x));
      line.setAttribute("y1", String(vl.y1));
      line.setAttribute("x2", String(vl.x));
      line.setAttribute("y2", String(vl.y2));
      layer.appendChild(line);
    }
  }

  /**
   * @param {string[]} lines
   */
  function pushVerticalGridExportLines(lines) {
    if (!cachedVerticalGridLines.length) return;
    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push(
      '<g id="layer-vertical-grid" fill="none" stroke="' +
        getPatternStrokeColor() +
        '" stroke-width="' +
        getVerticalGridStrokeWidth() +
        '">'
    );
    for (var i = 0; i < cachedVerticalGridLines.length; i++) {
      var vl = cachedVerticalGridLines[i];
      lines.push(
        '<line x1="' +
          vl.x +
          '" y1="' +
          vl.y1 +
          '" x2="' +
          vl.x +
          '" y2="' +
          vl.y2 +
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
  var BORDER_TOP_BOTTOM_SEGMENTS = 8;

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

  /**
   * Interior horizontal divider Y in left/right strips, evenly spaced inside inset bounds.
   * @returns {number[]}
   */
  function getLeftRightBorderInteriorYPositions() {
    var divY = getLeftRightBorderDivisionYBounds();
    var segments = getBorderLeftRightSegments();
    var span = divY.bottom - divY.top;
    var ys = [];
    var i;
    for (i = 1; i < segments; i++) {
      ys.push(divY.top + (span * i) / segments);
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
   * @param {number} cellIndex 0-based row in left/right strip (0 = top)
   * @returns {boolean}
   */
  function isBorderSideBrownCell(cellIndex) {
    return cellIndex % 2 === 0;
  }

  /**
   * 0-based index among blue-pattern rows (cellIndex must be odd).
   * @param {number} cellIndex
   * @returns {number}
   */
  function getBorderSideBlueCellSequenceIndex(cellIndex) {
    return (cellIndex - 1) / 2;
  }

  /**
   * Every second blue-pattern row → solid #d9d9d9 (2nd, 4th, 6th… blue row).
   * @param {number} cellIndex
   * @returns {boolean}
   */
  function isBorderSideGreySolidCell(cellIndex) {
    if (isBorderSideBrownCell(cellIndex)) return false;
    return getBorderSideBlueCellSequenceIndex(cellIndex) % 2 === 1;
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
   * Alternating fills for left/right margin cells (brown / blue X / grey solid).
   * @param {SVGElement} g
   */
  function appendLeftRightBorderCellFillsToGroup(g) {
    var b = getCanvasBorderPx();
    var yBounds = getLeftRightBorderCellYBounds();
    var rightX = CANVAS_W - b;
    var j;
    var yTop;
    var yBottom;
    var h;

    for (j = 0; j < yBounds.length - 1; j++) {
      yTop = yBounds[j];
      yBottom = yBounds[j + 1];
      h = yBottom - yTop;

      if (isBorderSideBrownCell(j)) {
        appendBorderSideBrownCellXPatternFills(g, 0, b, yTop, yBottom);
        appendBorderSideBrownCellXPatternFills(g, rightX, b, yTop, yBottom);
      } else if (isBorderSideGreySolidCell(j)) {
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
      } else {
        appendBorderSideBlueCellXPatternFills(g, 0, b, yTop, yBottom);
        appendBorderSideBlueCellXPatternFills(g, rightX, b, yTop, yBottom);
      }
    }
  }

  /**
   * Corner-to-corner X strokes in brown left/right strip cells only.
   * @param {SVGElement} g
   */
  function appendLeftRightBorderCellDiagonalsToGroup(g) {
    var b = getCanvasBorderPx();
    var yBounds = getLeftRightBorderCellYBounds();
    var j;
    var yTop;
    var yBottom;
    var rightX = CANVAS_W - b;

    for (j = 0; j < yBounds.length - 1; j++) {
      if (!isBorderSideBrownCell(j)) continue;
      yTop = yBounds[j];
      yBottom = yBounds[j + 1];
      appendBorderDivisionLine(g, 0, yTop, b, yBottom);
      appendBorderDivisionLine(g, b, yTop, 0, yBottom);
      appendBorderDivisionLine(g, rightX, yTop, CANVAS_W, yBottom);
      appendBorderDivisionLine(g, CANVAS_W, yTop, rightX, yBottom);
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
    var frameY = getBorderDivisionFrameY();
    var i;
    var y;
    var x;

    appendLeftRightBorderFrameEdgeLines(g);

    var sideInteriorY = getLeftRightBorderInteriorYPositions();
    for (i = 0; i < sideInteriorY.length; i++) {
      y = sideInteriorY[i];
      appendBorderDivisionLine(g, 0, y, b, y);
      appendBorderDivisionLine(g, CANVAS_W - b, y, CANVAS_W, y);
    }

    for (i = 1; i < BORDER_TOP_BOTTOM_SEGMENTS; i++) {
      x = (CANVAS_W * i) / BORDER_TOP_BOTTOM_SEGMENTS;
      if (x <= b || x >= CANVAS_W - b) continue;
      appendBorderDivisionLine(g, x, 0, x, frameY.top);
      appendBorderDivisionLine(g, x, frameY.bottom, x, CANVAS_H);
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

  function applyCanvasEdgeBrownBarAttrs(rect, edge) {
    var layout = getCanvasEdgeBrownBarLayout(edge);
    rect.setAttribute("x", String(layout.x));
    rect.setAttribute("y", String(layout.y));
    rect.setAttribute("width", String(layout.width));
    rect.setAttribute("height", String(layout.height));
    rect.setAttribute("fill", CANVAS_EDGE_BROWN_BAR_COLOR);
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
   * Run a callback for bottom + vertically mirrored top (use for new brown-bar decorations).
   * @param {number} innerRelY 0 at grid-facing edge, grows toward canvas outer edge
   * @param {(
   *   edge: "top" | "bottom",
   *   layout: { x: number, y: number, width: number, height: number },
   *   canvasY: number
   * ) => void} fn
   */
  function withMirroredBrownBarCanvasY(innerRelY, fn) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    fn(
      "bottom",
      bottomLayout,
      getBottomBrownBarCanvasY(innerRelY, bottomLayout)
    );
    fn("top", topLayout, getTopBrownBarMirroredCanvasY(innerRelY, topLayout));
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
   * Innermost segment (grid-facing band) inside each top/bottom brown bar.
   * @param {number} barHeight
   * @returns {{ start: number, end: number, height: number }}
   */
  function getBrownBarFirstSegmentInnerRelBounds(barHeight) {
    var segments =
      typeof CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS
        : 3;
    var segmentH = barHeight / segments;
    return { start: 0, end: segmentH, height: segmentH };
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
      : "FREE.IRANIAN.WOMEN";
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
    return typeof BROWN_BAR_BANNER_FILL !== "undefined"
      ? BROWN_BAR_BANNER_FILL
      : "#ffffff";
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
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    g.appendChild(createBrownBarBannerLabelGroup("bottom", bottomLayout));
    g.appendChild(createBrownBarBannerLabelGroup("top", topLayout));
  }

  function refreshBrownBarBannerAfterMount() {
    if (!designSvg) return;
    var bannerG = designSvg.querySelector("#edge-brown-bar-banner-text");
    if (!bannerG) return;
    while (bannerG.firstChild) bannerG.removeChild(bannerG.firstChild);
    appendBrownBarBannerText(bannerG);
  }

  function createBrownBarBannerTextGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "edge-brown-bar-banner-text");
    appendBrownBarBannerText(g);
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
        : "0.4,0.2,0.4",
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
    var x0 = Math.round(bottomLayout.x);
    var x1 = x0 + Math.round(bottomLayout.width);
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
    var yTop = Math.round(Math.min(yStart, yEnd));
    var yBottom = Math.round(Math.max(yStart, yEnd));
    var totalH = yBottom - yTop;
    var rowCount = hCount + 1;
    var defaultRowRatios = [0.4, 0.2, 0.4];
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
    var baseFill =
      typeof CANVAS_EDGE_BROWN_BAR_GRID_CELL_BASE_FILL !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_CELL_BASE_FILL
        : BG_COLOR;
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
            ? CANVAS_EDGE_BROWN_BAR_COLOR
            : baseFill;
          appendBrownBarGridCellFillRect(g, cell, fill);
        }
      }
    }
  }

  /**
   * @param {SVGElement} g
   */
  function appendCanvasEdgeBrownBarDivisionLines(g) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var innerRelYs = getCanvasEdgeBrownBarInnerRelativeYOffsets(bottomLayout.height);
    var yi;
    var innerRelY;
    var yBottom;
    var yTop;

    for (yi = 0; yi < innerRelYs.length; yi++) {
      innerRelY = innerRelYs[yi];
      yBottom = getBottomBrownBarCanvasY(innerRelY, bottomLayout);
      yTop = getTopBrownBarMirroredCanvasY(innerRelY, topLayout);
      appendBorderDivisionLine(
        g,
        bottomLayout.x,
        yBottom,
        bottomLayout.x + bottomLayout.width,
        yBottom
      );
      appendBorderDivisionLine(
        g,
        topLayout.x,
        yTop,
        topLayout.x + topLayout.width,
        yTop
      );
    }
  }

  function createCanvasEdgeBrownBarDivisionsGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "edge-brown-bar-divisions");
    var lines = elSvg("g");
    lines.setAttribute("id", "edge-brown-bar-section-lines");
    lines.setAttribute("fill", "none");
    lines.setAttribute("stroke", CANVAS_EDGE_BROWN_BAR_DIVISION_STROKE);
    lines.setAttribute("stroke-width", String(BORDER_DIVISION_STROKE_WIDTH));
    lines.setAttribute("stroke-linecap", "butt");
    lines.setAttribute("stroke-linejoin", "miter");
    appendCanvasEdgeBrownBarDivisionLines(lines);
    g.appendChild(lines);
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
    g.appendChild(createBrownBarBannerTextGroup());
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
      var lines = elSvg("g");
      lines.setAttribute("id", "edge-brown-bar-section-lines");
      lines.setAttribute("fill", "none");
      lines.setAttribute("stroke", CANVAS_EDGE_BROWN_BAR_DIVISION_STROKE);
      lines.setAttribute("stroke-width", String(BORDER_DIVISION_STROKE_WIDTH));
      lines.setAttribute("stroke-linecap", "butt");
      lines.setAttribute("stroke-linejoin", "miter");
      appendCanvasEdgeBrownBarDivisionLines(lines);
      divGroup.appendChild(lines);
      var fills = elSvg("g");
      fills.setAttribute("id", "edge-brown-bar-grid-fills");
      fills.setAttribute("stroke", "none");
      appendCanvasEdgeBrownBarOuterThirdGridFills(fills);
      divGroup.appendChild(fills);
    }
    var bannerGroup = designSvg.querySelector("#edge-brown-bar-banner-text");
    if (bannerGroup) {
      while (bannerGroup.firstChild) bannerGroup.removeChild(bannerGroup.firstChild);
      appendBrownBarBannerText(bannerGroup);
    }
  }

  function pushCanvasEdgeBrownBarExportSegmentLine(
    lines,
    x1,
    y1,
    x2,
    y2,
    stroke,
    strokeWidth
  ) {
    lines.push(
      '<line x1="' +
        x1 +
        '" y1="' +
        y1 +
        '" x2="' +
        x2 +
        '" y2="' +
        y2 +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        strokeWidth +
        '"/>'
    );
  }

  function pushCanvasEdgeBrownBarExportLine(
    lines,
    layout,
    y,
    stroke,
    strokeWidth
  ) {
    lines.push(
      '<line x1="' +
        layout.x +
        '" y1="' +
        y +
        '" x2="' +
        (layout.x + layout.width) +
        '" y2="' +
        y +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        strokeWidth +
        '"/>'
    );
  }

  function pushCanvasEdgeBrownBarExportLines(lines) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var innerRelYs = getCanvasEdgeBrownBarInnerRelativeYOffsets(bottomLayout.height);
    var yi;
    var innerRelY;
    var divStroke = CANVAS_EDGE_BROWN_BAR_DIVISION_STROKE;
    var divWidth = BORDER_DIVISION_STROKE_WIDTH;

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
        CANVAS_EDGE_BROWN_BAR_COLOR +
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
        CANVAS_EDGE_BROWN_BAR_COLOR +
        '" stroke="none"/>'
    );

    lines.push(
      '<g id="edge-brown-bar-section-lines" fill="none" stroke="' +
        divStroke +
        '" stroke-width="' +
        divWidth +
        '" stroke-linecap="butt" stroke-linejoin="miter">'
    );
    for (yi = 0; yi < innerRelYs.length; yi++) {
      innerRelY = innerRelYs[yi];
      pushCanvasEdgeBrownBarExportLine(
        lines,
        bottomLayout,
        getBottomBrownBarCanvasY(innerRelY, bottomLayout),
        divStroke,
        divWidth
      );
      pushCanvasEdgeBrownBarExportLine(
        lines,
        topLayout,
        getTopBrownBarMirroredCanvasY(innerRelY, topLayout),
        divStroke,
        divWidth
      );
    }
    lines.push("</g>");
    lines.push('<g id="edge-brown-bar-grid-fills" stroke="none">');
    pushCanvasEdgeBrownBarOuterThirdGridFillsExport(lines);
    lines.push("</g>");
    pushCanvasEdgeBrownBarBannerTextExport(lines);
  }

  function pushCanvasEdgeBrownBarBannerTextExport(lines) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var fontFamily = getBrownBarBannerFontFamily();
    var fill = getBrownBarBannerFill();
    var label = getBrownBarBannerDisplayText();
    var edges = [
      ["bottom", bottomLayout],
      ["top", topLayout],
    ];
    var ei;
    var edge;
    var layout;
    var metrics;
    var canvasY;
    var strike;

    lines.push('<g id="edge-brown-bar-banner-text">');
    for (ei = 0; ei < edges.length; ei++) {
      edge = edges[ei][0];
      layout = edges[ei][1];
      metrics = getBrownBarBannerTextMetrics(layout);
      canvasY =
        edge === "bottom"
          ? getBottomBrownBarCanvasY(metrics.centerInnerRelY, layout)
          : getTopBrownBarMirroredCanvasY(metrics.centerInnerRelY, layout);
      strike = getBrownBarBannerStrikeLineGeometry(metrics, canvasY);
      lines.push(
        '<text x="' +
          metrics.x +
          '" y="' +
          canvasY +
          '" fill="' +
          fill +
          '" font-family="' +
          fontFamily +
          ', sans-serif" font-weight="700" font-size="' +
          metrics.fontSize +
          '" letter-spacing="' +
          getBrownBarBannerLetterSpacing() +
          '" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle" dy="' +
          metrics.opticalDy +
          '">' +
          label +
          "</text>"
      );
      lines.push(
        '<line x1="' +
          strike.x1 +
          '" y1="' +
          strike.y1 +
          '" x2="' +
          strike.x2 +
          '" y2="' +
          strike.y2 +
          '" stroke="' +
          fill +
          '" stroke-width="' +
          strike.strokeWidth +
          '" stroke-linecap="butt"/>'
      );
    }
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
    var baseFill =
      typeof CANVAS_EDGE_BROWN_BAR_GRID_CELL_BASE_FILL !== "undefined"
        ? CANVAS_EDGE_BROWN_BAR_GRID_CELL_BASE_FILL
        : BG_COLOR;
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
            ? CANVAS_EDGE_BROWN_BAR_COLOR
            : baseFill;
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
    var frameY = getBorderDivisionFrameY();
    var i;
    var y;
    var x;

    lines.push(
      '<g id="layer-border-divisions" fill="none" stroke="' +
        getPatternStrokeColor() +
        '" stroke-width="' +
        BORDER_DIVISION_STROKE_WIDTH +
        '">'
    );

    var yBounds = getLeftRightBorderCellYBounds();
    var j;
    var yTop;
    var yBottom;
    var h;
    var rightX = CANVAS_W - b;
    for (j = 0; j < yBounds.length - 1; j++) {
      yTop = yBounds[j];
      yBottom = yBounds[j + 1];
      h = yBottom - yTop;
      if (isBorderSideBrownCell(j)) {
        pushBorderSideBrownCellXPatternExport(lines, 0, b, yTop, yBottom);
        pushBorderSideBrownCellXPatternExport(lines, rightX, b, yTop, yBottom);
      } else if (isBorderSideGreySolidCell(j)) {
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
      } else {
        pushBorderSideBlueCellXPatternExport(lines, 0, b, yTop, yBottom);
        pushBorderSideBlueCellXPatternExport(lines, rightX, b, yTop, yBottom);
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

    for (i = 1; i < BORDER_TOP_BOTTOM_SEGMENTS; i++) {
      x = (CANVAS_W * i) / BORDER_TOP_BOTTOM_SEGMENTS;
      if (x <= b || x >= CANVAS_W - b) continue;
      lines.push(
        '<line x1="' +
          x +
          '" y1="0" x2="' +
          x +
          '" y2="' +
          frameY.top +
          '"/>'
      );
      lines.push(
        '<line x1="' +
          x +
          '" y1="' +
          frameY.bottom +
          '" x2="' +
          x +
          '" y2="' +
          CANVAS_H +
          '"/>'
      );
    }

    for (j = 0; j < yBounds.length - 1; j++) {
      if (!isBorderSideBrownCell(j)) continue;
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
    svg.appendChild(defs);

    var borderFill = elSvg("rect");
    borderFill.setAttribute("x", "0");
    borderFill.setAttribute("y", "0");
    borderFill.setAttribute("width", String(CANVAS_W));
    borderFill.setAttribute("height", String(CANVAS_H));
    borderFill.setAttribute("fill", BG_COLOR);
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

    var clippedLetters = createInnerContentClipGroup("inner-clipped-letter-markers");
    var letterLayer = elSvg("g");
    letterLayer.setAttribute("id", "layer-letter-markers");
    letterLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedLetters.appendChild(letterLayer);
    innerContent.appendChild(clippedLetters);

    svg.appendChild(innerContent);

    var edgeBrownBars = elSvg("g");
    edgeBrownBars.setAttribute("id", "layer-edge-brown-bars");
    populateEdgeBrownBarsLayer(edgeBrownBars);
    svg.appendChild(edgeBrownBars);

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

    renderDiamondFillsLayer();
    while (patternLayer.firstChild) patternLayer.removeChild(patternLayer.firstChild);
    patternLayer.appendChild(segmentsToGroup(getVisibleSegments(cachedAllSegments)));
    patternLayer.appendChild(circlesToGroup(getActiveCircles()));
  }

  function render() {
    updateLayoutState();

    var outN = document.getElementById("octagons-n-out");
    if (outN) outN.textContent = String(lastOctagonsN);

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

    if (!designSvg) {
      designSvg = createDesignSvg();
      var wrap = document.getElementById("stage-wrap");
      if (wrap) wrap.appendChild(designSvg);
      refreshBrownBarBannerAfterMount();
    }

    cachedAllSegments = buildAllSegments();

    var layoutSig = buildLayoutSignature();
    if (layoutSig !== lastCircleLayoutSignature) {
      lastCircleLayoutSignature = layoutSig;
      syncCircleSelection(true);
    }

    if (layoutSig !== lastLetterMarkerLayoutSignature) {
      lastLetterMarkerLayoutSignature = layoutSig;
      syncLetterOctagonMarkers();
    }

    var diamondSig = buildDiamondLayoutSignature();
    if (diamondSig !== lastDiamondLayoutSignature) {
      lastDiamondLayoutSignature = diamondSig;
      syncDiamondFill(true);
    }

    var densityOut = document.getElementById("circle-density-out");
    if (densityOut) densityOut.textContent = String(getCircleDensity()) + "%";

    var diamondPercentOut = document.getElementById("diamond-fill-percent-out");
    if (diamondPercentOut) {
      diamondPercentOut.textContent = String(getDiamondFillPercent()) + "%";
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
    updateGridBoundaryRect();
    updateBorderDivisionLines();
    updateCanvasEdgeBrownBars();
    renderPatternLayer();
    renderLetterMarkersLayer();
    updateFrameInsetOverlayLayer();
    layoutStage();
    updateResetButton();
  }

  function renderAfterSliderChange() {
    clearMergeState();
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

  /**
   * @param {string[]} lines
   * @param {{ markers: { cx: number, cy: number, r: number, char: string }[] }} column
   * @param {string} strokeColor
   */
  function pushLetterMarkerColumnExport(lines, column, strokeColor) {
    var markers = column.markers;
    if (!markers.length) return;

    var top = markers[0];
    var bottom = markers[markers.length - 1];
    lines.push(
      '<line x1="' +
        top.cx +
        '" y1="' +
        top.cy +
        '" x2="' +
        bottom.cx +
        '" y2="' +
        bottom.cy +
        '" stroke="' +
        strokeColor +
        '" stroke-width="' +
        getCircleStrokeWidth() +
        '" fill="none"/>'
    );

    var i;
    for (i = 0; i < markers.length; i++) {
      var m = markers[i];
      lines.push(
        '<circle cx="' +
          m.cx +
          '" cy="' +
          m.cy +
          '" r="' +
          m.r +
          '" fill="' +
          strokeColor +
          '" stroke="none"/>'
      );
    }

    for (i = 0; i < markers.length; i++) {
      var mk = markers[i];
      var fontSize = 2 * mk.r * LETTER_MARKER_FONT_SIZE_RATIO;
      var char = mk.char || "";
      lines.push(
        '<text x="' +
          mk.cx +
          '" y="' +
          mk.cy +
          '" fill="#ffffff" font-weight="bold" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" dominant-baseline="central" font-size="' +
          fontSize +
          '">' +
          char +
          "</text>"
      );
    }
  }

  function pushLetterMarkersExportLines(lines) {
    ensureLetterMarkerAnchor(false);
    var bundle = buildLetterMarkerBundle();
    if (!bundle || !bundle.columns.length) return;

    var strokeColor = getPatternStrokeColor();
    lines.push('<g id="layer-letter-markers">');
    var c;
    for (c = 0; c < bundle.columns.length; c++) {
      pushLetterMarkerColumnExport(lines, bundle.columns[c], strokeColor);
    }
    lines.push("</g>");
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
    lines.push("</defs>");
    lines.push(
      '<rect x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '" fill="' +
        BG_COLOR +
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
        '<g id="layer-circles" fill="none" stroke="' +
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

    pushLetterMarkersExportLines(lines);

    lines.push("</g>");
    lines.push("</g>");
    lines.push('<g id="layer-edge-brown-bars">');
    pushCanvasEdgeBrownBarExportLines(lines);
    lines.push("</g>");
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

    Promise.all([fontReady, loadExportFontDataUri()])
      .then(function (results) {
        var fontDataUri = results[1];
        try {
          syncVerticalGridLines(false);
          var segments = getVisibleSegments(cachedAllSegments);
          var markup = buildExportSvgString(
            segments,
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
          var segments = getVisibleSegments(cachedAllSegments);
          var markup = buildExportSvgString(
            segments,
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
    renderPatternAndVerticalLayers();
  }

  function init() {
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

    var patternColorInput = document.getElementById("pattern-stroke-color");
    if (patternColorInput) {
      patternColorInput.value = PATTERN_STROKE_COLOR_DEFAULT;
      patternColorInput.addEventListener("input", function () {
        updateGridBoundaryRect();
        renderVerticalGridLayer();
        renderPatternLayer();
        renderLetterMarkersLayer();
        updateFrameInsetOverlayLayer();
        var borderDivisions =
          designSvg && designSvg.querySelector("#layer-border-divisions");
        if (borderDivisions) {
          borderDivisions.setAttribute("stroke", getPatternStrokeColor());
        }
        syncMagnifierBorderColor();
      });
    }

    var diamondFillColorInput = document.getElementById("diamond-fill-color");
    if (diamondFillColorInput) {
      diamondFillColorInput.value = DIAMOND_FILL_COLOR_DEFAULT;
      diamondFillColorInput.addEventListener("input", renderDiamondFillsLayer);
    }

    var borderSideSegmentsSlider = document.getElementById("border-side-segments");
    if (borderSideSegmentsSlider) {
      borderSideSegmentsSlider.min = String(BORDER_LEFT_RIGHT_SEGMENTS_MIN);
      borderSideSegmentsSlider.max = String(BORDER_LEFT_RIGHT_SEGMENTS_MAX);
      borderSideSegmentsSlider.value = String(BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT);
      borderSideSegmentsSlider.addEventListener("input", function () {
        var borderSideOut = document.getElementById("border-side-segments-out");
        if (borderSideOut) {
          borderSideOut.textContent = String(getBorderLeftRightSegments());
        }
        updateBorderDivisionLines();
      });
    }

    var gridStrokeSlider = document.getElementById("grid-stroke-width");
    if (gridStrokeSlider) {
      gridStrokeSlider.min = String(GRID_STROKE_WIDTH_MIN);
      gridStrokeSlider.max = String(GRID_STROKE_WIDTH_MAX);
      gridStrokeSlider.value = String(GRID_STROKE_WIDTH_DEFAULT);
      gridStrokeSlider.addEventListener("input", function () {
        var strokeOut = document.getElementById("grid-stroke-width-out");
        if (strokeOut) strokeOut.textContent = String(getGridStrokeWidth()) + " px";
        renderVerticalGridLayer();
        renderPatternLayer();
        renderLetterMarkersLayer();
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

    var diamondFillPercentSlider = document.getElementById("diamond-fill-percent");
    if (diamondFillPercentSlider) {
      diamondFillPercentSlider.min = String(DIAMOND_FILL_PERCENT_MIN);
      diamondFillPercentSlider.max = String(DIAMOND_FILL_PERCENT_MAX);
      diamondFillPercentSlider.value = String(DIAMOND_FILL_PERCENT_DEFAULT);
      diamondFillPercentSlider.addEventListener("input", function () {
        syncDiamondFill(true);
        var diamondPercentOut = document.getElementById("diamond-fill-percent-out");
        if (diamondPercentOut) {
          diamondPercentOut.textContent = String(getDiamondFillPercent()) + "%";
        }
        renderDiamondFillsLayer();
      });
    }

    var letterMarkerWordInput = document.getElementById("letter-marker-word");
    if (letterMarkerWordInput) {
      letterMarkerWordInput.value = letterMarkerWord;
      letterMarkerWordInput.addEventListener("input", function () {
        letterMarkerWord = letterMarkerWordInput.value;
        ensureLetterMarkerAnchor(false);
        renderLetterMarkersLayer();
      });
    }

    var randomizeCirclesBtn = document.getElementById("randomize-circles-btn");
    if (randomizeCirclesBtn) {
      randomizeCirclesBtn.addEventListener("click", function () {
        syncCircleSelection(true);
        syncDiamondFill(true);
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

    window.addEventListener("resize", layoutStage);
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

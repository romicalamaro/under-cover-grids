(function () {
  "use strict";

  var HALF_CIRCLE_RADIUS_SCALE = 0.9;
  var HALF_CIRCLE_INNER_ARC_PAIR_GAP_PX = 20;
  var HALF_CIRCLE_FAN_STROKE_WIDTH = 1;
  var HALF_CIRCLE_FOCAL_Y = 450;
  var NS = "http://www.w3.org/2000/svg";
  var designSvg = null;
  /** H1–H5 pipette picks override sheet palette until palette button / sheet reload clears them */
  var blendAreaColorOverrides = {};
  var cachedExportFontDataUri = null;
  var cachedExportOpentypeFont = null;
  var lastOctagonsN = OCTAGONS_N_DEFAULT;
  var lastTileSize = CANVAS_W / (OCTAGONS_N_DEFAULT + 1);
  var gridType = GRID_TYPE_OCTAGON;
  var starValidLayouts = [];
  var cachedAllSegments = [];
  /** @type {{ outline: {x:number,y:number}[] }[]} */
  var cachedStarFills = [];
  /** @type {{ outline: {x:number,y:number}[] }[]} */
  var cachedStarRhombusFills = [];
  /** @type {{ id: string, cx: number, cy: number, r: number }[]} */
  var cachedStructuralCircles = [];
  /** Chord keys for structural ellipse outlines (Circles grid merge hit-test). */
  var cachedCirclesGridEllipseChordKeySet = null;
  var cachedCirclesGridChordKeyToCircleId = {};
  /** Pride outline arcs: tessellation-scale ellipses (may differ from display inner scale). */
  var cachedPrideOutlineStructuralCircles = [];
  var lastPrideOutlineCirclesSig = "";
  var cachedVerticalGridLines = [];
  var lastVerticalGridLayoutSignature = "";

  var hopeInteractionMode = "view";
  var removedEdges = new Set();
  /** Edges removed by Auto Merge (separate from manual merge mask/dots). */
  var autoMergeEdgeKeys = new Set();
  /** @type {{ points: { x: number, y: number }[] }[] | null} */
  var autoMergeFillRegions = null;
  var dragPath = [];
  var isDragging = false;
  /** Hope merge drag: rAF-throttled grid-line preview only (full render on pointer up). */
  var hopeMergeDragRenderScheduled = false;
  var hopeMergeDragHadEdgeChanges = false;
  /** Main grid sliders: rAF-throttled preview during drag; light commit on change. */
  var sliderRenderScheduled = false;
  var sliderRenderPending = false;
  var sliderRenderGeneration = 0;
  var sliderPreviewRendered = false;
  var hopeMergeStateVersion = 0;
  /** @type {{ points: { x: number, y: number }[] }[] | null} */
  var hopeMergeRegionsRenderCache = null;
  var hopeMergeRegionsCacheVersion = -1;

  var circleSelectedIds = new Set();
  var lastCircleLayoutSignature = "";
  var longingCircleSelectedIds = new Set();
  var lastLongingCircleLayoutSignature = "";
  var griefCircleSelectedIds = new Set();
  var strengthSelectedIds = new Set();
  var lastGriefCircleLayoutSignature = "";
  var lastStrengthCircleLayoutSignature = "";
  var helplessnessSelectedIds = new Set();
  var lastHelplessnessLayoutSignature = "";
  var GRIEF_INNER_CIRCLE_DIAMETER_GAP_PX = 18;
  var diamondFilledIds = new Set();
  var angerTriangleDiamondIds = new Set();
  var lastDiamondLayoutSignature = "";
  var guiltShameFilledIds = new Set();
  var HOPE_STIPPLE_IMAGE = "stipple-1780673179311.png";
  var HOPE_STIPPLE_EXPORT_SVG = "stipple-1780673179311.svg";
  var HOPE_DOTS_MASK_ID = "hope-dots-mask";
  var HOPE_DOTS_MASK_INVERT_FILTER_ID = "hope-dots-mask-invert-filter";
  var hopeStippleImageReady = false;
  var hopeStippleImageElement = null;
  var hopeStippleSvgText = null;
  var hopeStippleExportDataUri = null;
  var hopeStippleRawExportDataUri = null;
  var hopeStippleExportDataLoadPromise = null;
  /** Lazy-load stipple assets (PNG first; ~3MB embed only when export needs it). */
  var hopeStippleReadyPromise = null;
  /** Skip palette onLoaded → render() during startup (single consolidated render). */
  var appStartupBootstrapping = true;
  var deferredAutoMergeScheduled = false;
  /** Frame inset overlay (lines, caps, ellipses, diagonals); default hidden */
  var frameInsetOverlayVisible = false;

  /** Whether an emotion layer is drawn (slider > 0, or always on for layers without sliders). */
  function isEmotionLayerActive(key) {
    switch (key) {
      case "sadness":
        return getCircleDensity() > 0;
      case "longing":
        return getLongingCircleDensity() > 0;
      case "grief":
        return getGriefCircleDensity() > 0;
      case "strength":
        return getStrengthDensity() > 0;
      case "pain":
        return getPrideFillPercent() > 0;
      case "guiltShame":
        return getGuiltShameFillPercent() > 0;
      case "fear":
        return getAngerVerticalLengthPercent() > 0;
      case "anger":
        return getAngerTriangleDensity() > 0;
      case "pride":
        return getAutoMergeIntensity() > 0;
      default:
        return true;
    }
  }

  /** Persist mask holes so continued merging cannot drop earlier cutouts. */
  var stickyMergedCutoutFaces = null;

  /** Random column edges for brown-bar outer-third grid (regenerated on layout change). */
  var cachedBrownBarGridXBounds = null;
  var lastBrownBarGridLayoutSignature = "";
  /** Random height ratios for left/right margin rows (regenerated on slider input). */
  var cachedBorderSideSegmentRatios = null;
  /** Shuffled row order for color-fade (outer column picks first; inner cols use offsets). */
  var cachedBorderSideWhiteRowOrder = null;
  /** Per thickness-column row offset along the margin strip (col 0 = 0). */
  var cachedBorderSideWhiteColRowOffsets = null;
  var cachedBorderSideWhiteRowCount = 0;
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
  /** @type {null | function(): number} */
  var colorDivisionGenerationRng = null;
  /** Cached inline SVG assets for the dynamic label bar. */
  var labelBarSvgCache = {};
  var labelBarSvgLoadPromises = {};
  /** End-cap tag SVG — advances one step in svg/tag/ pool on each page load. */
  var labelBarEndCapSvgFile = null;

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

  /** Fear verticals — slot F1 from the active sheet palette. */
  function getFearVerticalStrokeColor() {
    return sheetColor("F1");
  }

  function getGridBoundaryStrokeColor() {
    return sheetColor("B2");
  }

  function getBorderDivisionStrokeColor() {
    return sheetColor("C9");
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
    return sheetColor("F8");
  }

  function getHopeMergeFillColor() {
    return sheetColor("F9");
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

  function ensureHopeStippleExportDataLoaded() {
    if (
      typeof window !== "undefined" &&
      (window.HOPE_STIPPLE_EXPORT_SVG_TEXT ||
        window.HOPE_STIPPLE_EXPORT_PNG_DATA_URI)
    ) {
      return Promise.resolve(true);
    }
    if (hopeStippleExportDataLoadPromise) {
      return hopeStippleExportDataLoadPromise;
    }
    hopeStippleExportDataLoadPromise = new Promise(function (resolve) {
      var script = document.createElement("script");
      script.src = "js/hopeStippleExportData.js";
      script.onload = function () {
        resolve(true);
      };
      script.onerror = function () {
        hopeStippleExportDataLoadPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    });
    return hopeStippleExportDataLoadPromise;
  }

  function getHopeStippleSvgTextForExport() {
    if (
      typeof window !== "undefined" &&
      window.HOPE_STIPPLE_EXPORT_SVG_TEXT
    ) {
      return Promise.resolve(window.HOPE_STIPPLE_EXPORT_SVG_TEXT);
    }
    return fetch(HOPE_STIPPLE_EXPORT_SVG)
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.text();
      })
      .catch(function () {
        return null;
      });
  }

  function ensureHopeStippleExportDataUriFromEmbed() {
    if (hopeStippleExportDataUri) {
      return Promise.resolve(hopeStippleExportDataUri);
    }
    var embedded =
      typeof window !== "undefined" &&
      window.HOPE_STIPPLE_EXPORT_PNG_DATA_URI;
    if (!embedded) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        hopeStippleExportDataUri = bakeHopeColoredStippleDataUri(
          img,
          getHopeDotsColor()
        );
        hopeStippleRawExportDataUri = embedded;
        resolve(hopeStippleExportDataUri);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = embedded;
    });
  }

  function loadHopeStippleImageElementForExport() {
    var embedded =
      typeof window !== "undefined" &&
      window.HOPE_STIPPLE_EXPORT_PNG_DATA_URI;
    if (embedded) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          resolve(img);
        };
        img.onerror = function () {
          resolve(hopeStippleImageElement);
        };
        img.src = embedded;
      });
    }
    return Promise.resolve(hopeStippleImageElement);
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

  /**
   * Uniform scale + center so stipple dots stay circular (no non-uniform stretch).
   * @param {number} sourceW
   * @param {number} sourceH
   * @param {number} [sourceMinX]
   * @param {number} [sourceMinY]
   * @returns {{ scale: number, offsetX: number, offsetY: number, drawW: number, drawH: number }}
   */
  function getHopeStippleUniformLayout(
    sourceW,
    sourceH,
    sourceMinX,
    sourceMinY
  ) {
    var minX = typeof sourceMinX === "number" ? sourceMinX : 0;
    var minY = typeof sourceMinY === "number" ? sourceMinY : 0;
    var scale = Math.min(CANVAS_W / sourceW, CANVAS_H / sourceH);
    var drawW = sourceW * scale;
    var drawH = sourceH * scale;
    return {
      scale: scale,
      offsetX: (CANVAS_W - drawW) / 2 - minX * scale,
      offsetY: (CANVAS_H - drawH) / 2 - minY * scale,
      drawW: drawW,
      drawH: drawH,
    };
  }

  function prepareHopeStippleSvgContent(svgText, dotColor) {
    var viewBoxMatch = svgText.match(/viewBox="([^"]+)"/i);
    var viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 " + CANVAS_W + " " + CANVAS_H;
    var innerMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    var inner = innerMatch ? innerMatch[1] : svgText;
    inner = inner.replace(/fill="#000000"/gi, 'fill="' + dotColor + '"');
    inner = inner.replace(/fill="#000"/gi, 'fill="' + dotColor + '"');
    inner = inner.replace(
      /<circle\b(?![^>]*\bfill=)/gi,
      '<circle fill="' + dotColor + '" '
    );
    inner = inner.replace(
      /<rect[^>]*fill="(?:#ffffff|#fff|white)"[^>]*\/?>/gi,
      ""
    );
    var vbParts = viewBox.trim().split(/[\s,]+/).map(function (v) {
      return parseFloat(v);
    });
    var vbMinX = isFinite(vbParts[0]) ? vbParts[0] : 0;
    var vbMinY = isFinite(vbParts[1]) ? vbParts[1] : 0;
    var vbW = isFinite(vbParts[2]) && vbParts[2] > 0 ? vbParts[2] : CANVAS_W;
    var vbH = isFinite(vbParts[3]) && vbParts[3] > 0 ? vbParts[3] : CANVAS_H;
    var layout = getHopeStippleUniformLayout(vbW, vbH, vbMinX, vbMinY);
    return {
      inner: inner,
      transform:
        "translate(" +
        layout.offsetX +
        "," +
        layout.offsetY +
        ") scale(" +
        layout.scale +
        ")",
    };
  }

  function appendHopeStippleSvgToLayer(layer, svgText, dotColor) {
    var prepared = prepareHopeStippleSvgContent(svgText, dotColor);
    var wrap = elSvg("g");
    wrap.setAttribute("transform", prepared.transform);
    var doc = new DOMParser().parseFromString(
      '<svg xmlns="' + NS + '">' + prepared.inner + "</svg>",
      "image/svg+xml"
    );
    var srcSvg = doc.documentElement;
    var node = srcSvg.firstChild;
    while (node) {
      var next = node.nextSibling;
      wrap.appendChild(document.importNode(node, true));
      node = next;
    }
    layer.appendChild(wrap);
  }

  function buildHopeStippleSvgExportLines() {
    if (!isEmotionLayerActive("hope") || !hasActiveMergeCutouts()) {
      return Promise.resolve(null);
    }

    return getHopeStippleSvgTextForExport().then(function (svgText) {
        if (!svgText) return null;

        var mergedRegions = getMergedRegionsForMask();
        if (!mergedRegions || !mergedRegions.length) return null;

        var prepared = prepareHopeStippleSvgContent(svgText, getHopeDotsColor());

        var lines = [];
        lines.push("<defs>");
        lines.push('<clipPath id="' + MERGE_REGIONS_CLIP_ID + '">');
        var i;
        var pts;
        var p;
        var pointsAttr;
        for (i = 0; i < mergedRegions.length; i++) {
          pts = mergedRegions[i].points;
          if (!pts || !pts.length) continue;
          pointsAttr = "";
          for (p = 0; p < pts.length; p++) {
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
        lines.push('<g transform="' + prepared.transform + '">');
        lines.push(prepared.inner);
        lines.push("</g>");
        lines.push("</g>");
        lines.push("</g>");
        return lines;
      })
      .catch(function () {
        return null;
      });
  }

  function buildHopeStippleExportLines() {
    return ensureHopeStippleExportDataLoaded()
      .then(function () {
        return getHopeStippleSvgTextForExport();
      })
      .then(function (svgText) {
        if (svgText && !hopeStippleSvgText) hopeStippleSvgText = svgText;
        return buildHopeStippleSvgExportLines();
      });
  }

  function pushHopeStippleSvgExportLines(lines) {
    if (
      !isEmotionLayerActive("hope") ||
      !hasActiveMergeCutouts() ||
      !hopeStippleSvgText
    ) {
      return false;
    }

    var mergedRegions = getMergedRegionsForMask();
    if (!mergedRegions || !mergedRegions.length) return false;

    var prepared = prepareHopeStippleSvgContent(
      hopeStippleSvgText,
      getHopeDotsColor()
    );

    lines.push("<defs>");
    lines.push('<clipPath id="' + MERGE_REGIONS_CLIP_ID + '">');
    var i;
    var pts;
    var p;
    var pointsAttr;
    for (i = 0; i < mergedRegions.length; i++) {
      pts = mergedRegions[i].points;
      if (!pts || !pts.length) continue;
      pointsAttr = "";
      for (p = 0; p < pts.length; p++) {
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
    lines.push('<g transform="' + prepared.transform + '">');
    lines.push(prepared.inner);
    lines.push("</g>");
    lines.push("</g>");
    lines.push("</g>");
    return true;
  }

  function buildHopeDotsCirclesExportLines() {
    if (!isEmotionLayerActive("hope") || !hasActiveMergeCutouts()) {
      return Promise.resolve(null);
    }

    return loadHopeStippleImageElementForExport().then(function (exportImg) {
      if (!exportImg) return null;

      return new Promise(function (resolve) {
      try {
        var mergedRegions = getMergedRegionsForMask();
        if (!mergedRegions || !mergedRegions.length) return resolve(null);

        var canvas = document.createElement("canvas");
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        var ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        var imgLayout = getHopeStippleUniformLayout(
          exportImg.naturalWidth,
          exportImg.naturalHeight
        );
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(
          exportImg,
          imgLayout.offsetX,
          imgLayout.offsetY,
          imgLayout.drawW,
          imgLayout.drawH
        );
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
    });
  }

  function getHopeStippleMaskImageHref() {
    if (hopeStippleRawExportDataUri) return hopeStippleRawExportDataUri;
    if (
      typeof window !== "undefined" &&
      window.HOPE_STIPPLE_EXPORT_PNG_DATA_URI
    ) {
      return window.HOPE_STIPPLE_EXPORT_PNG_DATA_URI;
    }
    return HOPE_STIPPLE_IMAGE;
  }

  function refreshHopeColoredExportDataUri() {
    if (!hopeStippleImageReady) return;
    var layer =
      designSvg && designSvg.querySelector("#layer-stipple-dots");
    var rect = layer && layer.querySelector("[data-hope-dots-rect]");
    if (rect) {
      rect.setAttribute("fill", getHopeDotsColor());
      return;
    }
    renderStippleDotsLayer();
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
        "-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
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

    // Opaque black base: feColorMatrix turns transparent mask pixels white (show-all bug).
    var maskBg = mask.querySelector("[data-hope-dots-mask-bg]");
    if (!maskBg) {
      maskBg = elSvg("rect");
      maskBg.setAttribute("data-hope-dots-mask-bg", "1");
      mask.insertBefore(maskBg, mask.firstChild);
    }
    maskBg.setAttribute("x", "0");
    maskBg.setAttribute("y", "0");
    maskBg.setAttribute("width", String(CANVAS_W));
    maskBg.setAttribute("height", String(CANVAS_H));
    maskBg.setAttribute("fill", "black");

    var maskHref = getHopeStippleMaskImageHref();
    var maskImg = mask.querySelector("image");
    if (!maskImg) {
      maskImg = elSvg("image");
      maskImg.setAttribute("filter", "url(#" + HOPE_DOTS_MASK_INVERT_FILTER_ID + ")");
      mask.appendChild(maskImg);
    }
    maskImg.setAttribute("x", "0");
    maskImg.setAttribute("y", "0");
    maskImg.setAttribute("width", String(CANVAS_W));
    maskImg.setAttribute("height", String(CANVAS_H));
    // PNG is rasterized at full canvas size with opaque white letterbox baked in.
    maskImg.setAttribute("preserveAspectRatio", "none");
    maskImg.setAttribute("href", maskHref);
  }

  function loadHopeStippleSvg() {
    return ensureHopeStippleReady();
  }

  /**
   * Load stipple mask for Hope merge dots. Fast path: PNG file only (~770KB).
   * The ~3MB hopeStippleExportData.js embed loads only for SVG export.
   * @returns {Promise<boolean>}
   */
  function ensureHopeStippleReady() {
    if (hopeStippleImageReady) return Promise.resolve(true);
    if (hopeStippleReadyPromise) return hopeStippleReadyPromise;

    hopeStippleReadyPromise = ensureHopeStippleRawExportDataUri()
      .then(function (rawUri) {
        if (rawUri) {
          hopeStippleImageReady = true;
          applyMergeReveal();
          return true;
        }
        return ensureHopeStippleExportDataLoaded().then(function () {
          return Promise.all([
            getHopeStippleSvgTextForExport(),
            ensureHopeStippleRawExportDataUri(),
          ]);
        }).then(function (results) {
          var svgText = results[0];
          if (svgText) hopeStippleSvgText = svgText;
          hopeStippleImageReady = !!(
            hopeStippleRawExportDataUri || hopeStippleSvgText
          );
          if (hopeStippleImageReady) applyMergeReveal();
          return hopeStippleImageReady;
        });
      })
      .catch(function () {
        hopeStippleSvgText = null;
        hopeStippleImageElement = null;
        hopeStippleImageReady = false;
        hopeStippleExportDataUri = null;
        hopeStippleRawExportDataUri = null;
        hopeStippleReadyPromise = null;
        return false;
      });

    return hopeStippleReadyPromise;
  }

  function scheduleDeferredAutoMerge() {
    if (deferredAutoMergeScheduled) return;
    if (getAutoMergeIntensity() <= 0) return;
    if (hasActivePrideAutoMergeRegions()) return;
    deferredAutoMergeScheduled = true;
    var run = function () {
      deferredAutoMergeScheduled = false;
      if (getAutoMergeIntensity() > 0 && !hasActivePrideAutoMergeRegions()) {
        runAutoMerge();
      }
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }

  function getStarGridOctagonsNMax() {
    return typeof STAR_GRID_OCTAGONS_N_MAX !== "undefined"
      ? STAR_GRID_OCTAGONS_N_MAX
      : OCTAGONS_N_MAX;
  }

  function getOctagonsNMaxForActiveGrid() {
    if (isStarGrid()) return getStarGridOctagonsNMax();
    return OCTAGONS_N_MAX;
  }

  function getOctagonsNSteps() {
    return typeof OCTAGONS_N_STEPS !== "undefined" ? OCTAGONS_N_STEPS : 10;
  }

  function getOctagonsNStepFromSlider() {
    var slider = document.getElementById("octagons-n");
    var steps = getOctagonsNSteps();
    var step = slider
      ? Math.round(Number(slider.value))
      : octagonsNStepFromValue(OCTAGONS_N_DEFAULT);
    return Math.max(1, Math.min(steps, step));
  }

  function getOctagonsNStepDisplay() {
    return getOctagonsNStepFromSlider();
  }

  function getOctagonsNValueForActiveGrid(step) {
    if (isStarGrid()) {
      return octagonsNValueFromStepTable(
        step,
        typeof OCTAGONS_N_BY_STEP_STAR !== "undefined"
          ? OCTAGONS_N_BY_STEP_STAR
          : null
      );
    }
    if (isCirclesLikeGrid()) {
      return octagonsNValueFromStepTable(
        step,
        typeof OCTAGONS_N_BY_STEP_CIRCLES !== "undefined"
          ? OCTAGONS_N_BY_STEP_CIRCLES
          : null
      );
    }
    return octagonsNValueFromStep(step);
  }

  function getOctagonsN() {
    var v = getOctagonsNValueForActiveGrid(getOctagonsNStepFromSlider());
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().snapCirclesGridN(v);
    }
    if (isStarGrid()) {
      var starMin =
        typeof OCTAGONS_N_BY_STEP_STAR !== "undefined" &&
        OCTAGONS_N_BY_STEP_STAR.length
          ? OCTAGONS_N_BY_STEP_STAR[0]
          : OCTAGONS_N_MIN;
      return Math.min(
        getOctagonsNMaxForActiveGrid(),
        Math.max(starMin, Math.round(v))
      );
    }
    return Math.min(
      OCTAGONS_N_MAX,
      Math.max(OCTAGONS_N_MIN, Math.round(v))
    );
  }

  function isStarGrid() {
    return gridType === GRID_TYPE_STAR;
  }

  function isCirclesGrid() {
    return gridType === GRID_TYPE_CIRCLES;
  }

  function isDiamondsGrid() {
    return gridType === GRID_TYPE_DIAMONDS;
  }

  /** Circles + diamonds grids share the same 2×2-block tessellation and emotion semantics. */
  function isCirclesLikeGrid() {
    return isCirclesGrid() || isDiamondsGrid();
  }

  function getCirclesLikeGridGeometry() {
    if (
      isDiamondsGrid() &&
      typeof DiamondsGridGeometry !== "undefined"
    ) {
      return DiamondsGridGeometry;
    }
    return CirclesGridGeometry;
  }

  function isOctagonGrid() {
    return gridType === GRID_TYPE_OCTAGON;
  }

  /** Octagon + star + circles + diamonds grids share junction-diamond catalog semantics. */
  function supportsAngerDiamondTriangles() {
    return isOctagonGrid() || isStarGrid() || isCirclesLikeGrid();
  }

  function getAngerTriangleDensityMaxForActiveGrid() {
    if (
      isCirclesLikeGrid() &&
      typeof CIRCLES_GRID_ANGER_TRIANGLE_DENSITY_MAX !== "undefined"
    ) {
      return CIRCLES_GRID_ANGER_TRIANGLE_DENSITY_MAX;
    }
    return typeof ANGER_TRIANGLE_DENSITY_MAX !== "undefined"
      ? ANGER_TRIANGLE_DENSITY_MAX
      : 30;
  }

  function getPrideFillPercentMaxForActiveGrid() {
    if (
      isCirclesLikeGrid() &&
      typeof CIRCLES_GRID_PRIDE_FILL_PERCENT_MAX !== "undefined"
    ) {
      return CIRCLES_GRID_PRIDE_FILL_PERCENT_MAX;
    }
    return typeof PRIDE_FILL_PERCENT_MAX !== "undefined"
      ? PRIDE_FILL_PERCENT_MAX
      : 30;
  }

  function getGuiltShameFillPercentMaxForActiveGrid() {
    if (
      isCirclesLikeGrid() &&
      typeof CIRCLES_GRID_GUILT_SHAME_FILL_PERCENT_MAX !== "undefined"
    ) {
      return CIRCLES_GRID_GUILT_SHAME_FILL_PERCENT_MAX;
    }
    return typeof GUILT_SHAME_FILL_PERCENT_MAX !== "undefined"
      ? GUILT_SHAME_FILL_PERCENT_MAX
      : 30;
  }

  function getJunctionEmotionDensityMaxForActiveGrid() {
    if (
      isCirclesLikeGrid() &&
      typeof CIRCLES_GRID_JUNCTION_EMOTION_DENSITY_MAX !== "undefined"
    ) {
      return CIRCLES_GRID_JUNCTION_EMOTION_DENSITY_MAX;
    }
    return typeof CIRCLE_DENSITY_MAX !== "undefined" ? CIRCLE_DENSITY_MAX : 30;
  }

  function getHelplessnessPercentMaxForActiveGrid() {
    if (
      isCirclesLikeGrid() &&
      typeof CIRCLES_GRID_JUNCTION_EMOTION_DENSITY_MAX !== "undefined"
    ) {
      return CIRCLES_GRID_JUNCTION_EMOTION_DENSITY_MAX;
    }
    return typeof HELPLESSNESS_PERCENT_MAX !== "undefined"
      ? HELPLESSNESS_PERCENT_MAX
      : 30;
  }

  /** Grid-aware min/max when applying handkerchief combo CSV steps. */
  function getFeelingsSliderBoundsForCombo(key) {
    switch (key) {
      case "longingCircleDensity":
      case "griefCircleDensity":
      case "strengthDensity":
        return {
          min:
            typeof CIRCLE_DENSITY_MIN !== "undefined" ? CIRCLE_DENSITY_MIN : 0,
          max: getJunctionEmotionDensityMaxForActiveGrid(),
        };
      case "helplessnessPercent":
        return {
          min:
            typeof HELPLESSNESS_PERCENT_MIN !== "undefined"
              ? HELPLESSNESS_PERCENT_MIN
              : 0,
          max: getHelplessnessPercentMaxForActiveGrid(),
        };
      case "angerTriangleDensity":
        return {
          min:
            typeof ANGER_TRIANGLE_DENSITY_MIN !== "undefined"
              ? ANGER_TRIANGLE_DENSITY_MIN
              : 0,
          max: getAngerTriangleDensityMaxForActiveGrid(),
        };
      case "prideFillPercent":
        return {
          min: PRIDE_FILL_PERCENT_MIN,
          max: getPrideFillPercentMaxForActiveGrid(),
        };
      case "guiltShameFillPercent":
        return {
          min:
            typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
              ? GUILT_SHAME_FILL_PERCENT_MIN
              : 0,
          max: getGuiltShameFillPercentMaxForActiveGrid(),
        };
      default:
        return null;
    }
  }

  function syncFeelingsSteppedSliderRange(sliderId, min, max) {
    var slider = document.getElementById(sliderId);
    if (!slider) return;
    var steps = getFeelingsSliderSteps();
    var stepSize = steps < 2 ? 1 : (max - min) / (steps - 1);
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(stepSize);
    var snapped = snapFeelingsSliderValue(Number(slider.value), min, max);
    if (Number(slider.value) !== snapped) {
      slider.value = String(snapped);
    }
  }

  function syncAngerPainGuiltSliderRangesForGridType() {
    syncFeelingsSteppedSliderRange(
      "anger-triangle-density",
      typeof ANGER_TRIANGLE_DENSITY_MIN !== "undefined"
        ? ANGER_TRIANGLE_DENSITY_MIN
        : 0,
      getAngerTriangleDensityMaxForActiveGrid()
    );
    syncFeelingsSteppedSliderRange(
      "pride-fill-percent",
      PRIDE_FILL_PERCENT_MIN,
      getPrideFillPercentMaxForActiveGrid()
    );
    syncFeelingsSteppedSliderRange(
      "guilt-shame-fill-percent",
      typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_MIN
        : 0,
      getGuiltShameFillPercentMaxForActiveGrid()
    );
  }

  function syncJunctionEmotionSliderRangesForGridType() {
    var circleMax = getJunctionEmotionDensityMaxForActiveGrid();
    syncFeelingsSteppedSliderRange(
      "longing-circle-density",
      CIRCLE_DENSITY_MIN,
      circleMax
    );
    syncFeelingsSteppedSliderRange(
      "grief-circle-density",
      CIRCLE_DENSITY_MIN,
      circleMax
    );
    syncFeelingsSteppedSliderRange(
      "strength-density",
      typeof STRENGTH_DENSITY_MIN !== "undefined"
        ? STRENGTH_DENSITY_MIN
        : CIRCLE_DENSITY_MIN,
      circleMax
    );
    syncFeelingsSteppedSliderRange(
      "helplessness-percent",
      typeof HELPLESSNESS_PERCENT_MIN !== "undefined"
        ? HELPLESSNESS_PERCENT_MIN
        : 0,
      getHelplessnessPercentMaxForActiveGrid()
    );
  }

  function isAlternateGrid() {
    return isStarGrid();
  }

  function hidesInnerScaleSliderForGridType() {
    return isStarGrid();
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
    if (
      typeof OCTAGONS_N_BY_STEP_STAR !== "undefined" &&
      NestedStarOctagonsGeometry.computeLayoutFromN
    ) {
      var starNSeen = {};
      var li;
      for (li = 0; li < starValidLayouts.length; li++) {
        starNSeen[starValidLayouts[li].n] = true;
      }
      for (li = 0; li < OCTAGONS_N_BY_STEP_STAR.length; li++) {
        var reqStarN = OCTAGONS_N_BY_STEP_STAR[li];
        if (reqStarN > starMaxN || starNSeen[reqStarN]) continue;
        starValidLayouts.push(
          NestedStarOctagonsGeometry.computeLayoutFromN(
            reqStarN,
            CANVAS_W,
            CANVAS_H
          )
        );
        starNSeen[reqStarN] = true;
      }
      starValidLayouts.sort(function (a, b) {
        return a.n - b.n;
      });
    }
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
    var steps = getOctagonsNSteps();
    slider.min = "1";
    slider.max = String(steps);
    slider.step = "1";
    var step = getOctagonsNStepFromSlider();
    if (Number(slider.value) !== step) {
      slider.value = String(step);
    }
  }

  function syncGridTypeButtons() {
    var octBtn = document.getElementById("grid-choose-octagon-btn");
    var starBtn = document.getElementById("grid-choose-star-btn");
    var circlesBtn = document.getElementById("grid-choose-circles-btn");
    var diamondsBtn = document.getElementById("grid-choose-diamonds-btn");
    if (octBtn) {
      octBtn.classList.toggle("is-active", isOctagonGrid());
      octBtn.setAttribute("aria-pressed", String(isOctagonGrid()));
    }
    if (starBtn) {
      starBtn.classList.toggle("is-active", isStarGrid());
      starBtn.setAttribute("aria-pressed", String(isStarGrid()));
    }
    if (circlesBtn) {
      circlesBtn.classList.toggle("is-active", isCirclesGrid());
      circlesBtn.setAttribute("aria-pressed", String(isCirclesGrid()));
    }
    if (diamondsBtn) {
      diamondsBtn.classList.toggle("is-active", isDiamondsGrid());
      diamondsBtn.setAttribute("aria-pressed", String(isDiamondsGrid()));
    }
  }

  function syncGridSlidersForGridType() {
    var innerScaleWrap = document.querySelector(
      "#inner-scale"
    );
    innerScaleWrap =
      innerScaleWrap &&
      innerScaleWrap.closest(".sidebar__grid-density");
    if (innerScaleWrap) innerScaleWrap.hidden = hidesInnerScaleSliderForGridType();
  }

  /** Star grid: layers not used yet (gradient overlay, etc.). */
  var STAR_GRID_DEFERRED_LAYER_SELECTORS = ["#layer-frame-inset-overlay"];

  function setSvgSubtreeVisible(selector, visible) {
    if (!designSvg) return;
    var el = designSvg.querySelector(selector);
    if (el) el.style.display = visible ? "" : "none";
  }

  function applyAlternateGridLayerVisibility() {
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
    var transformAttr = getInnerContentTransformAttr();
    var inner = designSvg.querySelector("#inner-content");
    if (inner) inner.setAttribute("transform", transformAttr);
    var fearVerticalRoot = designSvg.querySelector("#fear-vertical-grid-root");
    if (fearVerticalRoot) {
      fearVerticalRoot.setAttribute("transform", transformAttr);
    }
    var prideRoot = designSvg.querySelector("#pride-auto-merge-root");
    if (prideRoot) {
      prideRoot.setAttribute("transform", transformAttr);
    }
    var fanRoot = designSvg.querySelector("#fan-half-circle-root");
    if (fanRoot) {
      fanRoot.setAttribute("transform", transformAttr);
    }
    ensurePrideAutoMergeMounted();
    ensureFanLayerMounted();
  }

  function refreshBorderFrameAndLabelBars() {
    updateGridBoundaryRect();
    ensureGridBoundaryLayerOnTop();
    updateBorderDivisionLines();
    updateBorderDivisionOverlay();
    updateCanvasEdgeBrownBars();
  }

  function setGridType(nextType) {
    if (
      nextType !== GRID_TYPE_OCTAGON &&
      nextType !== GRID_TYPE_STAR &&
      nextType !== GRID_TYPE_CIRCLES &&
      nextType !== GRID_TYPE_DIAMONDS
    ) {
      return;
    }
    if (gridType === nextType) return;
    gridType = nextType;
    clearMergeState();
    clearAutoMergeState();
    if (isStarGrid()) {
      ensureStarValidLayouts();
      syncOctagonDensitySliderRange();
      setHopeInteractionMode("view");
    } else {
      syncOctagonDensitySliderRange();
    }
    syncGridTypeButtons();
    syncGridSlidersForGridType();
    syncAngerPainGuiltSliderRangesForGridType();
    syncJunctionEmotionSliderRangesForGridType();
    syncFeelingsSliderOutputs();
    syncLongingCircleSelection(false);
    syncGriefCircleSelection(false);
    syncStrengthSelection(false);
    syncHelplessnessSelection(false);
    if (supportsAngerDiamondTriangles()) {
      syncAngerTriangleSelection(false);
    }
    syncDiamondFill(false);
    syncGuiltShameDiamondFill(false);
    render();
  }

  function initGridTypeButtons() {
    var octBtn = document.getElementById("grid-choose-octagon-btn");
    var starBtn = document.getElementById("grid-choose-star-btn");
    var circlesBtn = document.getElementById("grid-choose-circles-btn");
    var diamondsBtn = document.getElementById("grid-choose-diamonds-btn");
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
    if (circlesBtn) {
      circlesBtn.addEventListener("click", function () {
        setGridType(GRID_TYPE_CIRCLES);
      });
    }
    if (diamondsBtn) {
      diamondsBtn.addEventListener("click", function () {
        setGridType(GRID_TYPE_DIAMONDS);
      });
    }
    syncGridTypeButtons();
    syncGridSlidersForGridType();
  }

  function getInnerScaleSteps() {
    return typeof INNER_SCALE_STEPS !== "undefined" ? INNER_SCALE_STEPS : 10;
  }

  function getInnerScaleStepFromSlider() {
    var slider = document.getElementById("inner-scale");
    var steps = getInnerScaleSteps();
    var step = slider
      ? Math.round(Number(slider.value))
      : innerScaleStepFromValue(INNER_SCALE_DEFAULT);
    return Math.max(1, Math.min(steps, step));
  }

  function getInnerScale() {
    return innerScaleValueFromStep(getInnerScaleStepFromSlider());
  }

  function getInnerScaleStepDisplay() {
    return getInnerScaleStepFromSlider();
  }

  /**
   * Snap raw slider value to one of `steps` evenly spaced positions between min and max.
   * @param {number} raw
   * @param {number} min
   * @param {number} max
   * @param {number} steps
   * @returns {number}
   */
  function snapSteppedSliderValue(raw, min, max, steps) {
    if (steps < 2) {
      return Math.min(max, Math.max(min, Math.round(raw)));
    }
    var stepSize = (max - min) / (steps - 1);
    var idx = Math.round((raw - min) / stepSize);
    if (idx < 0) idx = 0;
    if (idx > steps - 1) idx = steps - 1;
    return min + idx * stepSize;
  }

  function getFeelingsSliderSteps() {
    return typeof FEELINGS_SLIDER_STEPS !== "undefined" ? FEELINGS_SLIDER_STEPS : 5;
  }

  function snapFeelingsSliderValue(raw, min, max) {
    return snapSteppedSliderValue(raw, min, max, getFeelingsSliderSteps());
  }

  function setFeelingsStepOutputById(outputId, internalValue, min, max) {
    var out = document.getElementById(outputId);
    if (!out) return;
    out.textContent = String(feelingsStepFromValue(internalValue, min, max));
  }

  /** @returns {number} */
  function randomFeelingsStepValue(min, max) {
    var steps = getFeelingsSliderSteps();
    var stepIndex = randomIntInRange(0, Math.max(0, steps - 1));
    var stepSize = steps < 2 ? 0 : (max - min) / (steps - 1);
    return min + stepIndex * stepSize;
  }

  /**
   * @param {string} sliderId
   * @param {number} min
   * @param {number} max
   * @param {number} defaultValue
   * @param {() => void} onInput
   */
  function initFeelingsSteppedSlider(sliderId, min, max, defaultValue, onInput) {
    var slider = document.getElementById(sliderId);
    if (!slider) return;

    var steps = getFeelingsSliderSteps();
    var stepSize = steps < 2 ? 1 : (max - min) / (steps - 1);
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(stepSize);
    slider.value = String(snapFeelingsSliderValue(defaultValue, min, max));

    slider.addEventListener("input", function () {
      var snapped = snapFeelingsSliderValue(
        Number(slider.value),
        Number(slider.min),
        Number(slider.max)
      );
      if (Number(slider.value) !== snapped) {
        slider.value = String(snapped);
      }
      onInput();
    });
  }

  /** Star grid: slider min → max pinwheel; slider max → symmetric middle star. */
  function getStarMiddlePinwheelFactor() {
    var span = INNER_SCALE_MAX - INNER_SCALE_MIN;
    if (span < 1e-9) return 0;
    var t = (getInnerScale() - INNER_SCALE_MIN) / span;
    return Math.max(0, Math.min(1, 1 - t));
  }

  function getCircleDensity() {
    var slider = document.getElementById("circle-density");
    var v = slider ? Number(slider.value) : CIRCLE_DENSITY_DEFAULT;
    return Math.round(
      snapFeelingsSliderValue(v, CIRCLE_DENSITY_MIN, CIRCLE_DENSITY_MAX)
    );
  }

  function getLongingCircleDensity() {
    var slider = document.getElementById("longing-circle-density");
    var v = slider ? Number(slider.value) : CIRCLE_DENSITY_DEFAULT;
    return Math.round(
      snapFeelingsSliderValue(
        v,
        CIRCLE_DENSITY_MIN,
        getJunctionEmotionDensityMaxForActiveGrid()
      )
    );
  }

  function getGriefCircleDensity() {
    var slider = document.getElementById("grief-circle-density");
    var v = slider ? Number(slider.value) : CIRCLE_DENSITY_DEFAULT;
    return Math.round(
      snapFeelingsSliderValue(
        v,
        CIRCLE_DENSITY_MIN,
        getJunctionEmotionDensityMaxForActiveGrid()
      )
    );
  }

  function getStrengthDensity() {
    var slider = document.getElementById("strength-density");
    var def =
      typeof STRENGTH_DENSITY_DEFAULT !== "undefined"
        ? STRENGTH_DENSITY_DEFAULT
        : CIRCLE_DENSITY_DEFAULT;
    var min =
      typeof STRENGTH_DENSITY_MIN !== "undefined"
        ? STRENGTH_DENSITY_MIN
        : CIRCLE_DENSITY_MIN;
    var max = getJunctionEmotionDensityMaxForActiveGrid();
    var v = slider ? Number(slider.value) : def;
    return Math.round(snapFeelingsSliderValue(v, min, max));
  }

  function getHelplessnessPercent() {
    var slider = document.getElementById("helplessness-percent");
    var def =
      typeof HELPLESSNESS_PERCENT_DEFAULT !== "undefined"
        ? HELPLESSNESS_PERCENT_DEFAULT
        : 0;
    var min =
      typeof HELPLESSNESS_PERCENT_MIN !== "undefined"
        ? HELPLESSNESS_PERCENT_MIN
        : 0;
    var max = getHelplessnessPercentMaxForActiveGrid();
    var v = slider ? Number(slider.value) : def;
    return Math.round(snapFeelingsSliderValue(v, min, max));
  }

  function isHelplessnessLayerVisible() {
    return getHelplessnessPercent() > 0;
  }

  function getAngerVerticalLengthPercent() {
    var slider = document.getElementById("anger-vertical-length");
    var v = slider ? Number(slider.value) : ANGER_VERTICAL_LENGTH_DEFAULT;
    return Math.round(
      snapFeelingsSliderValue(
        v,
        ANGER_VERTICAL_LENGTH_MIN,
        ANGER_VERTICAL_LENGTH_MAX
      )
    );
  }

  function getAnxietyVerticalStrokePercent() {
    var slider = document.getElementById("anxiety-vertical-stroke");
    var def =
      typeof ANXIETY_VERTICAL_STROKE_DEFAULT !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_DEFAULT
        : 0;
    var min =
      typeof ANXIETY_VERTICAL_STROKE_MIN !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_MIN
        : 0;
    var max =
      typeof ANXIETY_VERTICAL_STROKE_MAX !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_MAX
        : 100;
    var v = slider ? Number(slider.value) : def;
    return Math.round(snapFeelingsSliderValue(v, min, max));
  }

  function getPrideFillPercent() {
    var slider = document.getElementById("pride-fill-percent");
    var v = slider ? Number(slider.value) : PRIDE_FILL_PERCENT_DEFAULT;
    return Math.round(
      snapFeelingsSliderValue(
        v,
        PRIDE_FILL_PERCENT_MIN,
        getPrideFillPercentMaxForActiveGrid()
      )
    );
  }

  function getAngerTriangleDensity() {
    var slider = document.getElementById("anger-triangle-density");
    var def =
      typeof ANGER_TRIANGLE_DENSITY_DEFAULT !== "undefined"
        ? ANGER_TRIANGLE_DENSITY_DEFAULT
        : 0;
    var min =
      typeof ANGER_TRIANGLE_DENSITY_MIN !== "undefined"
        ? ANGER_TRIANGLE_DENSITY_MIN
        : 0;
    var v = slider ? Number(slider.value) : def;
    return Math.round(
      snapFeelingsSliderValue(v, min, getAngerTriangleDensityMaxForActiveGrid())
    );
  }

  function getGuiltShameFillPercent() {
    var slider = document.getElementById("guilt-shame-fill-percent");
    var def =
      typeof GUILT_SHAME_FILL_PERCENT_DEFAULT !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_DEFAULT
        : 0;
    var min =
      typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_MIN
        : 0;
    var v = slider ? Number(slider.value) : def;
    return Math.round(
      snapFeelingsSliderValue(v, min, getGuiltShameFillPercentMaxForActiveGrid())
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
        : 7;
    var def =
      typeof AUTO_MERGE_INTENSITY_DEFAULT !== "undefined"
        ? AUTO_MERGE_INTENSITY_DEFAULT
        : 0;
    var v = slider ? Number(slider.value) : def;
    return Math.round(snapFeelingsSliderValue(v, min, max));
  }

  /** Tile size at reference density — baseline for Pride area compensation. */
  function getPrideAutoMergeReferenceTileSize() {
    if (isStarGrid()) {
      ensureStarValidLayouts();
      if (
        typeof NestedStarOctagonsGeometry !== "undefined" &&
        NestedStarOctagonsGeometry.snapLayoutToN
      ) {
        return NestedStarOctagonsGeometry.snapLayoutToN(
          OCTAGONS_N_DEFAULT,
          starValidLayouts,
          CANVAS_W,
          CANVAS_H
        ).tileSize;
      }
    }
    if (isCirclesLikeGrid()) {
      var circlesRefN =
        typeof CIRCLES_GRID_PRIDE_REFERENCE_N !== "undefined"
          ? CIRCLES_GRID_PRIDE_REFERENCE_N
          : typeof CIRCLES_GRID_N_MIN !== "undefined"
            ? CIRCLES_GRID_N_MIN
            : OCTAGONS_N_DEFAULT;
      return getCirclesLikeGridGeometry().tileSizeFromN(circlesRefN, CANVAS_W);
    }
    var octRefN =
      typeof PRIDE_AUTO_MERGE_REFERENCE_N_OCTAGON !== "undefined"
        ? PRIDE_AUTO_MERGE_REFERENCE_N_OCTAGON
        : OCTAGONS_N_DEFAULT;
    return TopkapiGeometry.tileSizeFromN(octRefN, CANVAS_W);
  }

  /** refTile / currentTile — 1 at reference density, >1 when grid is denser. */
  function getPrideAutoMergeDensityRatio() {
    updateLayoutState();
    var currentTile = lastTileSize;
    if (!currentTile || currentTile <= 0) return 1;
    var refTile = getPrideAutoMergeReferenceTileSize();
    if (!refTile || refTile <= 0) return 1;
    return refTile / currentTile;
  }

  /**
   * Denser grid → higher edge budget so Pride clusters cover the same px² as at reference density.
   * @returns {number} scale in [1, max]
   */
  function getPrideAutoMergeDensityAreaScale() {
    var densityRatio = getPrideAutoMergeDensityRatio();
    if (densityRatio <= 1) return 1;

    var exponent =
      typeof PRIDE_AUTO_MERGE_DENSITY_AREA_EXPONENT !== "undefined"
        ? PRIDE_AUTO_MERGE_DENSITY_AREA_EXPONENT
        : 2;
    var maxScale =
      typeof PRIDE_AUTO_MERGE_DENSITY_AREA_SCALE_MAX !== "undefined"
        ? PRIDE_AUTO_MERGE_DENSITY_AREA_SCALE_MAX
        : 8;
    return Math.min(maxScale, Math.pow(densityRatio, exponent));
  }

  /** Fast Pride path: skip dangling prune, orphan fills, midpoint segment tests. */
  function shouldUseSimplePrideAutoMergeMode() {
    // Circles/diamonds/octagon need full merge passes for consistent canvas fill area.
    if (isCirclesLikeGrid() || isOctagonGrid()) return false;
    var threshold =
      typeof PRIDE_AUTO_MERGE_SIMPLE_MODE_DENSITY_RATIO !== "undefined"
        ? PRIDE_AUTO_MERGE_SIMPLE_MODE_DENSITY_RATIO
        : 3;
    return getPrideAutoMergeDensityRatio() >= threshold;
  }

  /**
   * Map discrete step 0–7 to area count (0 = off, 1–7 → 2–8 areas) and edge budget.
   * @returns {{ areaCountMin: number, areaCountMax: number, edgesPerAreaMin: number, edgesPerAreaMax: number, boundsInset: number }}
   */
  function getAutoMergePlanOptions() {
    var step = getAutoMergeIntensity();
    var areasAtMin =
      typeof AUTO_MERGE_AREA_COUNT_AT_MIN !== "undefined"
        ? AUTO_MERGE_AREA_COUNT_AT_MIN
        : 2;
    var areasAtMax =
      typeof AUTO_MERGE_AREA_COUNT_AT_MAX !== "undefined"
        ? AUTO_MERGE_AREA_COUNT_AT_MAX
        : 8;
    var edgeMinAtMin =
      typeof AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MIN !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MIN
        : 4;
    var edgeMaxAtMin =
      typeof AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MIN !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MIN
        : 7;
    var edgeMinAtMax =
      typeof AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MAX !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MAX
        : 7;
    var edgeMaxAtMax =
      typeof AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MAX !== "undefined"
        ? AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MAX
        : 16;

    var activeSteps = Math.max(1, areasAtMax - areasAtMin + 1);
    var areaCount = 0;
    var t = 0;
    if (step > 0) {
      var clampedStep = Math.min(step, activeSteps);
      areaCount = areasAtMin + clampedStep - 1;
      if (areaCount > areasAtMax) areaCount = areasAtMax;
      t = activeSteps > 1 ? (clampedStep - 1) / (activeSteps - 1) : 1;
    }

    var edgesPerAreaMin = Math.round(edgeMinAtMin + t * (edgeMinAtMax - edgeMinAtMin));
    var edgesPerAreaMax = Math.round(edgeMaxAtMin + t * (edgeMaxAtMax - edgeMinAtMin));
    if (edgesPerAreaMax < edgesPerAreaMin) edgesPerAreaMax = edgesPerAreaMin;

    if (isStarGrid()) {
      var edgeMult =
        typeof STAR_GRID_AUTO_MERGE_EDGE_MULTIPLIER !== "undefined"
          ? STAR_GRID_AUTO_MERGE_EDGE_MULTIPLIER
          : 1.7;
      edgesPerAreaMin = Math.round(edgesPerAreaMin * edgeMult);
      edgesPerAreaMax = Math.round(edgesPerAreaMax * edgeMult);
      if (edgesPerAreaMax < edgesPerAreaMin) edgesPerAreaMax = edgesPerAreaMin;
    }

    var densityAreaScale = getPrideAutoMergeDensityAreaScale();
    if (densityAreaScale > 1) {
      edgesPerAreaMin = Math.max(2, Math.round(edgesPerAreaMin * densityAreaScale));
      edgesPerAreaMax = Math.max(
        edgesPerAreaMin,
        Math.round(edgesPerAreaMax * densityAreaScale)
      );
    }

    return {
      areaCountMin: areaCount,
      areaCountMax: areaCount,
      edgesPerAreaMin: edgesPerAreaMin,
      edgesPerAreaMax: edgesPerAreaMax,
      boundsInset:
        typeof AUTO_MERGE_SEED_BOUNDS_INSET_PX !== "undefined"
          ? AUTO_MERGE_SEED_BOUNDS_INSET_PX
          : 40,
    };
  }

  function updateAutoMergeIntensityOutput() {
    var min =
      typeof AUTO_MERGE_INTENSITY_MIN !== "undefined"
        ? AUTO_MERGE_INTENSITY_MIN
        : 0;
    var max =
      typeof AUTO_MERGE_INTENSITY_MAX !== "undefined"
        ? AUTO_MERGE_INTENSITY_MAX
        : 7;
    setFeelingsStepOutputById(
      "auto-merge-intensity-out",
      getAutoMergeIntensity(),
      min,
      max
    );
  }

  function getGridStrokeWidth() {
    return GRID_STROKE_WIDTH_DEFAULT;
  }

  /**
   * Frame horizontal division count: 3-step slider (1 = low, 2 = default, 3 = high).
   * @returns {1|2|3}
   */
  function getBorderFrameDivisionsStep() {
    var slider = document.getElementById("border-frame-divisions");
    var v = slider ? Number(slider.value) : 2;
    var clamped = Math.min(3, Math.max(1, Math.round(v)));
    return /** @type {1|2|3} */ (clamped);
  }

  function getBorderLeftRightSegments() {
    var step = getBorderFrameDivisionsStep();
    if (step === 1) {
      return typeof BORDER_LEFT_RIGHT_SEGMENTS_LOW !== "undefined"
        ? BORDER_LEFT_RIGHT_SEGMENTS_LOW
        : 8;
    }
    if (step === 3) {
      return typeof BORDER_LEFT_RIGHT_SEGMENTS_HIGH !== "undefined"
        ? BORDER_LEFT_RIGHT_SEGMENTS_HIGH
        : 18;
    }
    return typeof BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT !== "undefined"
      ? BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT
      : 12;
  }

  /**
   * @param {1|2|3} step
   * @returns {"Minimum"|"Medium"|"Maximum"}
   */
  function borderFrameDivisionsLabel(step) {
    if (step === 1) return "Minimum";
    if (step === 3) return "Maximum";
    return "Medium";
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

  /**
   * Snap raw slider value to one of BORDER_SIDE_WHITE_FILL_STEPS positions (min … max).
   * @param {number} raw
   * @returns {number}
   */
  function snapBorderSideWhiteFillSliderValue(raw) {
    var min =
      typeof BORDER_SIDE_WHITE_FILL_MIN !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_MIN
        : 0;
    var max =
      typeof BORDER_SIDE_WHITE_FILL_MAX !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_MAX
        : 100;
    var steps =
      typeof BORDER_SIDE_WHITE_FILL_STEPS !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_STEPS
        : 5;
    return snapSteppedSliderValue(raw, min, max, steps);
  }

  function getBorderSideWhiteFillSliderValue() {
    var slider = document.getElementById("border-side-white-fill");
    var fallback =
      typeof BORDER_SIDE_WHITE_FILL_DEFAULT !== "undefined"
        ? BORDER_SIDE_WHITE_FILL_DEFAULT
        : 0;
    var v = slider ? Number(slider.value) : fallback;
    return snapBorderSideWhiteFillSliderValue(v);
  }

  /**
   * Effective share of margin division cells painted white (0 … cap).
   * @returns {number}
   */
  function getBorderSideWhiteFillTargetPercent() {
    var cap =
      typeof BORDER_SIDE_WHITE_CAP_PERCENT !== "undefined"
        ? BORDER_SIDE_WHITE_CAP_PERCENT
        : 50;
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
   * @param {string[]|null} cachedOrder
   * @param {string[]} validIds
   * @param {boolean} forceReshuffle
   * @returns {string[]}
   */
  function syncBorderSideWhiteColumnOrder(cachedOrder, validIds, forceReshuffle) {
    var validSet = new Set(validIds);
    if (forceReshuffle || !cachedOrder) {
      return shufflePickIds(
        validIds.map(function (id) {
          return { id: id };
        }),
        validIds.length
      );
    }
    var order = cachedOrder.filter(function (id) {
      return validSet.has(id);
    });
    var existing = new Set(order);
    var newcomers = [];
    var i;
    for (i = 0; i < validIds.length; i++) {
      if (!existing.has(validIds[i])) newcomers.push(validIds[i]);
    }
    if (newcomers.length) {
      for (i = newcomers.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = newcomers[i];
        newcomers[i] = newcomers[j];
        newcomers[j] = tmp;
      }
      order = order.concat(newcomers);
    }
    return order;
  }

  /**
   * Staggered row offsets so middle/inner columns whiten at different strip positions
   * than the outer column (same slider share per column, not aligned on one row).
   * @param {number} rowCount
   * @param {number} cols
   * @param {boolean} randomize
   * @returns {number[]}
   */
  function buildBorderSideWhiteColRowOffsets(rowCount, cols, randomize) {
    var offsets = [0];
    if (cols < 2 || rowCount < 2) return offsets;

    var span = Math.max(1, rowCount - 1);
    var jitter = function () {
      if (!randomize || rowCount < 4) return 0;
      return Math.floor(Math.random() * Math.max(1, Math.floor(rowCount / 5)));
    };

    var o1 = (Math.max(1, Math.round(span / 3)) + jitter()) % rowCount;
    if (o1 === 0) o1 = 1;
    offsets.push(o1);

    if (cols < 3) return offsets;

    var o2 = (Math.max(2, Math.round((2 * span) / 3)) + jitter()) % rowCount;
    if (o2 === 0) o2 = Math.min(rowCount - 1, 2);
    if (o2 === o1) o2 = (o2 + Math.max(1, Math.floor(rowCount / 4))) % rowCount;
    if (o2 === 0) o2 = Math.min(rowCount - 1, o1 + 1);
    offsets.push(o2);
    return offsets;
  }

  /**
   * True if whitening (col, row) would put a third column on the same strip row (cols === 3).
   * @param {Object.<number, Set<number>>} colsByRow
   * @param {number} cols
   * @param {number} colIndex
   * @param {number} rowIndex
   * @returns {boolean}
   */
  function canBorderSideWhiteCellAtRow(colsByRow, cols, colIndex, rowIndex) {
    if (cols < 3) return true;
    var atRow = colsByRow[rowIndex];
    if (!atRow || atRow.size < 2) return true;
    return atRow.has(colIndex);
  }

  /**
   * @param {Object.<number, Set<number>>} colsByRow
   * @param {number} colIndex
   * @param {number} rowIndex
   */
  function markBorderSideWhiteCellAtRow(colsByRow, colIndex, rowIndex) {
    if (!colsByRow[rowIndex]) colsByRow[rowIndex] = new Set();
    colsByRow[rowIndex].add(colIndex);
    borderSideWhiteCellIds.add(
      String(colIndex) + "-" + String(rowIndex)
    );
  }

  /**
   * Color fade: same whitened-row share in every thickness column, staggered along the strip.
   * Never whitens all three thickness columns on the same strip row.
   * @param {boolean} forceReshuffle
   */
  function syncBorderSideWhiteCells(forceReshuffle) {
    var cols = getBorderSideThicknessColumns();
    var rowCount = getLeftRightBorderCellYBounds().length - 1;
    var targetPercent = getBorderSideWhiteFillTargetPercent();
    var perColTarget = Math.round((rowCount * targetPercent) / 100);
    if (perColTarget < 0) perColTarget = 0;
    if (perColTarget > rowCount) perColTarget = rowCount;

    var rowIds = [];
    var r;
    for (r = 0; r < rowCount; r++) {
      rowIds.push(String(r));
    }

    var layoutChanged = cachedBorderSideWhiteRowCount !== rowCount;
    if (
      forceReshuffle ||
      layoutChanged ||
      !cachedBorderSideWhiteRowOrder
    ) {
      cachedBorderSideWhiteRowOrder = syncBorderSideWhiteColumnOrder(
        cachedBorderSideWhiteRowOrder,
        rowIds,
        forceReshuffle || layoutChanged
      );
      cachedBorderSideWhiteColRowOffsets = buildBorderSideWhiteColRowOffsets(
        rowCount,
        cols,
        forceReshuffle || layoutChanged
      );
      cachedBorderSideWhiteRowCount = rowCount;
    } else if (
      !cachedBorderSideWhiteColRowOffsets ||
      cachedBorderSideWhiteColRowOffsets.length < cols
    ) {
      cachedBorderSideWhiteColRowOffsets = buildBorderSideWhiteColRowOffsets(
        rowCount,
        cols,
        false
      );
    }

    borderSideWhiteCellIds.clear();

    if (!perColTarget || !rowCount) return;

    var c;
    var k;
    var order = cachedBorderSideWhiteRowOrder;
    var offsets = cachedBorderSideWhiteColRowOffsets;
    var colsByRow = {};
    var usedRowsByCol = [];
    var candidateRows;
    var rowIndex;
    var assigned;
    var r;

    for (c = 0; c < cols; c++) {
      usedRowsByCol[c] = new Set();
      assigned = 0;
      candidateRows = [];
      for (r = 0; r < order.length; r++) {
        candidateRows.push(
          (Number(order[r]) + (offsets[c] || 0)) % rowCount
        );
      }
      for (r = 0; r < candidateRows.length && assigned < perColTarget; r++) {
        rowIndex = candidateRows[r];
        if (usedRowsByCol[c].has(rowIndex)) continue;
        if (
          !canBorderSideWhiteCellAtRow(colsByRow, cols, c, rowIndex)
        ) {
          continue;
        }
        usedRowsByCol[c].add(rowIndex);
        markBorderSideWhiteCellAtRow(colsByRow, c, rowIndex);
        assigned++;
      }
      if (assigned >= perColTarget) continue;
      for (k = 0; k < rowCount && assigned < perColTarget; k++) {
        rowIndex = k;
        if (usedRowsByCol[c].has(rowIndex)) continue;
        if (
          !canBorderSideWhiteCellAtRow(colsByRow, cols, c, rowIndex)
        ) {
          continue;
        }
        usedRowsByCol[c].add(rowIndex);
        markBorderSideWhiteCellAtRow(colsByRow, c, rowIndex);
        assigned++;
      }
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

  /** Color fade: fill for margin cells that lost their pattern color (sheet C10). */
  function getBorderSideColorFadeFillColor() {
    return sheetColor("C10");
  }

  function getBorderSideEmptyCellStippleDotRadius() {
    var dotSize =
      typeof BORDER_FRAME_EMPTY_CELL_DOT_SIZE !== "undefined"
        ? BORDER_FRAME_EMPTY_CELL_DOT_SIZE
        : typeof RADIAL_FAN_MIDDLE_BAND_DOT_SIZE !== "undefined"
          ? RADIAL_FAN_MIDDLE_BAND_DOT_SIZE
          : 2;
    return dotSize / 2;
  }

  function getBorderSideEmptyCellStippleMinDotDistance() {
    var dotSize =
      typeof BORDER_FRAME_EMPTY_CELL_DOT_SIZE !== "undefined"
        ? BORDER_FRAME_EMPTY_CELL_DOT_SIZE
        : typeof RADIAL_FAN_MIDDLE_BAND_DOT_SIZE !== "undefined"
          ? RADIAL_FAN_MIDDLE_BAND_DOT_SIZE
          : 2;
    var spacing =
      typeof BORDER_FRAME_EMPTY_CELL_DOT_SPACING !== "undefined"
        ? BORDER_FRAME_EMPTY_CELL_DOT_SPACING
        : typeof RADIAL_FAN_MIDDLE_BAND_DOT_SPACING !== "undefined"
          ? RADIAL_FAN_MIDDLE_BAND_DOT_SPACING
          : 2;
    return dotSize + spacing;
  }

  function getBorderSideEmptyCellStippleColor() {
    return getBorderDivisionStrokeColor();
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
    return sheetColor("F10");
  }

  function getStrengthSquareFillColor() {
    return sheetColor("F11");
  }

  function getStrengthCircleFillColor() {
    return sheetColor("F12");
  }

  function getStrengthStrokeColor() {
    return sheetColor("F13");
  }

  function getHelplessnessStrokeColor() {
    return sheetColor("F14");
  }

  function getAngerTriangleFillColor() {
    return sheetColor("F15");
  }

  function getLongingCircleStrokeColor() {
    return sheetColor("F16");
  }

  function getGriefCircleStrokeColor() {
    return sheetColor("F17");
  }

  function getLabelBarBackgroundColor() {
    return sheetColor("G1");
  }

  function getLabelBarContentColor() {
    return normalizeHexColor(
      sheetColor("G4"),
      typeof LABEL_BAR_CONTENT_COLOR_DEFAULT !== "undefined"
        ? LABEL_BAR_CONTENT_COLOR_DEFAULT
        : "#ffffff"
    );
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
    return getMergedRegionsForMask().length > 0;
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
    } else if (isAlternateGrid()) {
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
    var showHope = isEmotionLayerActive("hope");
    var maskClipped = designSvg.querySelector("#inner-clipped-grid-mask");
    var hopeFillClipped = designSvg.querySelector("#inner-clipped-hope-merge-fill");
    var dotsClipped = designSvg.querySelector("#inner-clipped-stipple-dots");
    var hopeFillLayer = designSvg.querySelector("#layer-hope-merge-fill");
    var dotsLayer = designSvg.querySelector("#layer-stipple-dots");
    var defs = designSvg.querySelector("defs");
    var hasClipDef = !!(
      defs && defs.querySelector("#" + MERGE_REGIONS_CLIP_ID)
    );
    if (maskClipped) {
      maskClipped.style.display = active && showHope ? "" : "none";
    }

    if (!active || !showHope) {
      if (hopeFillClipped) hopeFillClipped.style.display = "none";
      if (dotsClipped) dotsClipped.style.display = "none";
      if (hopeFillLayer) hopeFillLayer.removeAttribute("clip-path");
      if (dotsLayer) dotsLayer.removeAttribute("clip-path");
      renderStippleDotsLayer();
      return;
    }

    if (hopeFillClipped) hopeFillClipped.style.display = "";
    if (dotsClipped) dotsClipped.style.display = "";
    if (hopeFillLayer && hasClipDef) {
      hopeFillLayer.setAttribute("clip-path", "url(#" + MERGE_REGIONS_CLIP_ID + ")");
    } else if (hopeFillLayer) {
      hopeFillLayer.removeAttribute("clip-path");
    }
    if (dotsLayer && hasClipDef) {
      dotsLayer.setAttribute("clip-path", "url(#" + MERGE_REGIONS_CLIP_ID + ")");
    } else if (dotsLayer) {
      dotsLayer.removeAttribute("clip-path");
    }

    renderHopeMergeFillLayer();
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

  function getAutoMergeShadowColor() {
    return sheetColor("F7");
  }

  function getAutoMergeOutlineWidth() {
    var mult =
      typeof AUTO_MERGE_OUTLINE_WIDTH_GRID_MULTIPLIER !== "undefined"
        ? AUTO_MERGE_OUTLINE_WIDTH_GRID_MULTIPLIER
        : 3;
    return getGridStrokeWidth() * mult;
  }

  function hasActivePrideAutoMergeRegions() {
    return (
      getAutoMergeIntensity() > 0 &&
      autoMergeFillRegions &&
      autoMergeFillRegions.length > 0
    );
  }

  function getAutoMergeShadowFilterParams() {
    return {
      shadowColor: getAutoMergeShadowColor(),
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
   * SVG 1.1–compatible cast shadow (feDropShadow is often dropped in export apps).
   * @returns {string}
   */
  function getAutoMergeShadowFilterDefMarkup() {
    var filterId = getAutoMergeShadowFilterId();
    var shadow = getAutoMergeShadowFilterParams();
    return (
      '<filter id="' +
      filterId +
      '" filterUnits="objectBoundingBox" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="' +
      shadow.blur +
      '" result="auto-merge-shadow-blur"/>' +
      '<feOffset in="auto-merge-shadow-blur" dx="' +
      shadow.offsetX +
      '" dy="' +
      shadow.offsetY +
      '" result="auto-merge-shadow-offset"/>' +
      '<feFlood flood-color="' +
      shadow.shadowColor +
      '" flood-opacity="' +
      shadow.opacity +
      '" result="auto-merge-shadow-flood"/>' +
      '<feComposite in="auto-merge-shadow-flood" in2="auto-merge-shadow-offset" operator="in" result="auto-merge-shadow-shape"/>' +
      '<feMerge>' +
      '<feMergeNode in="auto-merge-shadow-shape"/>' +
      "</feMerge>" +
      "</filter>"
    );
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
    filter.setAttribute("filterUnits", "objectBoundingBox");
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    var blur = elSvg("feGaussianBlur");
    blur.setAttribute("in", "SourceAlpha");
    blur.setAttribute("stdDeviation", String(shadow.blur));
    blur.setAttribute("result", "auto-merge-shadow-blur");

    var offset = elSvg("feOffset");
    offset.setAttribute("in", "auto-merge-shadow-blur");
    offset.setAttribute("dx", String(shadow.offsetX));
    offset.setAttribute("dy", String(shadow.offsetY));
    offset.setAttribute("result", "auto-merge-shadow-offset");

    var flood = elSvg("feFlood");
    flood.setAttribute("flood-color", shadow.shadowColor);
    flood.setAttribute("flood-opacity", String(shadow.opacity));
    flood.setAttribute("result", "auto-merge-shadow-flood");

    var composite = elSvg("feComposite");
    composite.setAttribute("in", "auto-merge-shadow-flood");
    composite.setAttribute("in2", "auto-merge-shadow-offset");
    composite.setAttribute("operator", "in");
    composite.setAttribute("result", "auto-merge-shadow-shape");

    var merge = elSvg("feMerge");
    var mergeShadow = elSvg("feMergeNode");
    mergeShadow.setAttribute("in", "auto-merge-shadow-shape");
    merge.appendChild(mergeShadow);

    filter.appendChild(blur);
    filter.appendChild(offset);
    filter.appendChild(flood);
    filter.appendChild(composite);
    filter.appendChild(merge);
    defs.appendChild(filter);
  }

  /**
   * @param {string[]} lines
   */
  function pushAutoMergeShadowFilterDefLines(lines) {
    lines.push(getAutoMergeShadowFilterDefMarkup());
  }

  /**
   * @param {{ x: number, y: number }[]} pts
   * @returns {string}
   */
  function polygonPointsToAttr(pts) {
    var pointsAttr = "";
    var p;
    for (p = 0; p < pts.length; p++) {
      if (p) pointsAttr += " ";
      pointsAttr += pts[p].x + "," + pts[p].y;
    }
    return pointsAttr;
  }

  /**
   * @param {SVGElement} parent
   * @param {{ x: number, y: number }[]} pts
   */
  function appendAutoMergeFilteredShadowPolygon(parent, pts) {
    var poly = elSvg("polygon");
    poly.setAttribute("points", polygonPointsToAttr(pts));
    poly.setAttribute("fill", "#000");
    poly.setAttribute("stroke", "none");
    poly.setAttribute("filter", getAutoMergeShadowFilterUrl());
    parent.appendChild(poly);
  }

  /**
   * @param {string} pointsAttr
   * @returns {string}
   */
  function getAutoMergeShadowPolygonExportMarkup(pointsAttr) {
    return (
      '<polygon points="' +
      pointsAttr +
      '" fill="#000" stroke="none" filter="' +
      getAutoMergeShadowFilterUrl() +
      '"/>'
    );
  }

  function getAutoMergeRegionFillExportMarkup(pointsAttr, fillColor) {
    return (
      '<polygon points="' +
      pointsAttr +
      '" fill="' +
      fillColor +
      '" stroke="' +
      getAutoMergeOutlineColor() +
      '" stroke-width="' +
      getAutoMergeOutlineWidth() +
      '" stroke-linejoin="round"/>'
    );
  }

  function getAutoMergeRegionFillPathExportMarkup(pathD, fillColor) {
    return (
      '<path d="' +
      pathD +
      '" fill="' +
      fillColor +
      '" stroke="' +
      getAutoMergeOutlineColor() +
      '" stroke-width="' +
      getAutoMergeOutlineWidth() +
      '" stroke-linejoin="round" stroke-linecap="round"/>'
    );
  }

  /** Effective inner scale for Pride tessellation (never full 1 — corner cells required). */
  function getCirclesGridPrideTessellationInnerScale() {
    var innerMin =
      typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
    var innerMax =
      typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    var prideMax =
      typeof CIRCLES_GRID_PRIDE_TESSELLATION_INNER_SCALE_MAX !== "undefined"
        ? CIRCLES_GRID_PRIDE_TESSELLATION_INNER_SCALE_MAX
        : 0.92;
    var inner = getInnerScale();
    inner = Math.min(innerMax, Math.max(innerMin, inner));
    return Math.min(inner, prideMax);
  }

  /** Corner quarter-circle radius for circles-grid Pride outlines (matches corner cell width). */
  function getCirclesGridPrideCornerArcRadius() {
    var tile = lastTileSize;
    if (!tile || tile <= 0) return 0;
    var inner = getCirclesGridPrideTessellationInnerScale();
    return tile * (1 - inner);
  }

  function prideOutlineCoord(v) {
    return Math.round(v * 100) / 100;
  }

  function pridePointNearEllipse(x, y, circle, eps) {
    if (!circle || !circle.rx || !circle.ry) return false;
    var dx = x - circle.cx;
    var dy = y - circle.cy;
    var dist =
      (dx * dx) / (circle.rx * circle.rx) + (dy * dy) / (circle.ry * circle.ry);
    return Math.abs(dist - 1) <= eps;
  }

  function getPrideOutlineStructuralCircles() {
    if (!isCirclesGrid()) return [];
    var sig =
      lastOctagonsN +
      "|" +
      getCirclesGridPrideTessellationInnerScale() +
      "|" +
      CANVAS_W +
      "|" +
      CANVAS_H;
    if (
      sig !== lastPrideOutlineCirclesSig ||
      !cachedPrideOutlineStructuralCircles.length
    ) {
      cachedPrideOutlineStructuralCircles =
        CirclesGridGeometry.buildStructuralCircles(
          lastOctagonsN,
          CANVAS_W,
          CANVAS_H,
          getCirclesGridPrideTessellationInnerScale()
        );
      lastPrideOutlineCirclesSig = sig;
    }
    return cachedPrideOutlineStructuralCircles;
  }

  function getStructuralCircleForPrideEdge(p1, p2) {
    var circles = getPrideOutlineStructuralCircles();
    if (!circles.length) return null;
    var eps =
      typeof CIRCLES_GRID_PRIDE_ELLIPSE_EDGE_EPS !== "undefined"
        ? CIRCLES_GRID_PRIDE_ELLIPSE_EDGE_EPS
        : 0.12;
    var i;
    var c;
    for (i = 0; i < circles.length; i++) {
      c = circles[i];
      if (
        pridePointNearEllipse(p1.x, p1.y, c, eps) &&
        pridePointNearEllipse(p2.x, p2.y, c, eps)
      ) {
        return c;
      }
    }
    return null;
  }

  function structuralCirclesMatch(c1, c2) {
    if (!c1 || !c2) return false;
    if (c1.id && c2.id) return c1.id === c2.id;
    return (
      c1.cx === c2.cx &&
      c1.cy === c2.cy &&
      c1.rx === c2.rx &&
      c1.ry === c2.ry
    );
  }

  function prideEllipseSweepFlag(circle, from, to) {
    var v1x = from.x - circle.cx;
    var v1y = from.y - circle.cy;
    var v2x = to.x - circle.cx;
    var v2y = to.y - circle.cy;
    var cross = v1x * v2y - v1y * v2x;
    return cross < 0 ? 1 : 0;
  }

  function prideEllipseArcFlags(circle, from, to) {
    var a1 = Math.atan2(
      (from.y - circle.cy) / circle.ry,
      (from.x - circle.cx) / circle.rx
    );
    var a2 = Math.atan2(
      (to.y - circle.cy) / circle.ry,
      (to.x - circle.cx) / circle.rx
    );
    var sweep = prideEllipseSweepFlag(circle, from, to);
    var da = a2 - a1;
    if (sweep === 1) {
      if (da < 0) da += Math.PI * 2;
    } else if (da > 0) {
      da -= Math.PI * 2;
    }
    return {
      sweep: sweep,
      largeArc: Math.abs(da) > Math.PI ? 1 : 0,
    };
  }

  function sampleEllipseArcPoints(circle, from, to, steps) {
    var a1 = Math.atan2(
      (from.y - circle.cy) / circle.ry,
      (from.x - circle.cx) / circle.rx
    );
    var a2 = Math.atan2(
      (to.y - circle.cy) / circle.ry,
      (to.x - circle.cx) / circle.rx
    );
    var sweep = prideEllipseSweepFlag(circle, from, to);
    var da = a2 - a1;
    if (sweep === 1) {
      if (da < 0) da += Math.PI * 2;
    } else if (da > 0) {
      da -= Math.PI * 2;
    }
    var pts = [];
    var si;
    var t;
    var ang;
    for (si = 1; si <= steps; si++) {
      t = si / steps;
      ang = a1 + da * t;
      pts.push({
        x: circle.cx + circle.rx * Math.cos(ang),
        y: circle.cy + circle.ry * Math.sin(ang),
      });
    }
    return pts;
  }

  function sampleCornerArcPoints(p1, p2, r, steps, acx, acy) {
    var a1 = Math.atan2(p1.y - acy, p1.x - acx);
    var a2 = Math.atan2(p2.y - acy, p2.x - acx);
    var da = a2 - a1;
    if (da < 0) da += Math.PI * 2;
    var pts = [];
    var si;
    var t;
    for (si = 1; si <= steps; si++) {
      t = si / steps;
      pts.push({
        x: acx + r * Math.cos(a1 + da * t),
        y: acy + r * Math.sin(a1 + da * t),
      });
    }
    return pts;
  }

  /**
   * @param {{ x: number, y: number }} prev
   * @param {{ x: number, y: number }} corner
   * @param {{ x: number, y: number }} next
   * @param {number} arcRadius
   * @returns {{ p1: {x:number,y:number}, p2: {x:number,y:number}, r: number } | null}
   */
  function getPrideCornerArcTrim(prev, corner, next, arcRadius) {
    var dx1 = corner.x - prev.x;
    var dy1 = corner.y - prev.y;
    var dx2 = next.x - corner.x;
    var dy2 = next.y - corner.y;
    var len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    var len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len1 < 1e-6 || len2 < 1e-6) return null;

    var aligned =
      (Math.abs(dx1) < 1e-4 && Math.abs(dy2) < 1e-4) ||
      (Math.abs(dy1) < 1e-4 && Math.abs(dx2) < 1e-4);
    var cross = dx1 * dy2 - dy1 * dx2;
    if (!aligned || Math.abs(Math.abs(cross) - len1 * len2) > len1 * len2 * 0.2) {
      return null;
    }
    if (cross <= 0) return null;

    var r = Math.min(arcRadius, len1 * 0.49, len2 * 0.49);
    if (r < 0.5) return null;

    var ux1 = dx1 / len1;
    var uy1 = dy1 / len1;
    var ux2 = dx2 / len2;
    var uy2 = dy2 / len2;
    var trimStart = { x: corner.x - ux1 * r, y: corner.y - uy1 * r };
    var trimEnd = { x: corner.x + ux2 * r, y: corner.y + uy2 * r };
    return {
      p1: trimStart,
      p2: trimEnd,
      r: r,
      acx: trimStart.x + ux2 * r,
      acy: trimStart.y + uy2 * r,
    };
  }

  /**
   * Smooth SVG path for circles-grid Pride: elliptical arcs + rounded corners.
   * @param {{ x: number, y: number }[]} points
   * @returns {{ pathD: string, shadowPoints: { x: number, y: number }[] }}
   */
  function buildCirclesGridPrideOutline(points) {
    if (!points || points.length < 3) {
      return { pathD: "", shadowPoints: points ? points.slice() : [] };
    }

    var n = points.length;
    var pathParts = [];
    var shadowPts = [{ x: points[0].x, y: points[0].y }];
    var cornerRadius = getCirclesGridPrideCornerArcRadius();
    var shadowSteps =
      typeof CIRCLES_GRID_PRIDE_SHADOW_ARC_STEPS !== "undefined"
        ? CIRCLES_GRID_PRIDE_SHADOW_ARC_STEPS
        : 10;
    var cornerShadowSteps =
      typeof CIRCLES_GRID_PRIDE_CORNER_ARC_STEPS !== "undefined"
        ? CIRCLES_GRID_PRIDE_CORNER_ARC_STEPS
        : 6;
    var edgeIdx = 0;

    pathParts.push(
      "M" + prideOutlineCoord(points[0].x) + "," + prideOutlineCoord(points[0].y)
    );

    while (edgeIdx < n) {
      var from = points[edgeIdx];
      var toIdx = (edgeIdx + 1) % n;
      var to = points[toIdx];
      var circle = getStructuralCircleForPrideEdge(from, to);

      if (circle) {
        var endIdx = toIdx;
        var chainGuard = 0;
        while (chainGuard < n) {
          chainGuard++;
          var nextEnd = (endIdx + 1) % n;
          if (
            !structuralCirclesMatch(
              circle,
              getStructuralCircleForPrideEdge(points[endIdx], points[nextEnd])
            )
          ) {
            break;
          }
          endIdx = nextEnd;
          if (endIdx === edgeIdx) break;
        }
        var arcTo = points[endIdx];
        var arcFlags = prideEllipseArcFlags(circle, from, arcTo);
        pathParts.push(
          "A" +
            prideOutlineCoord(circle.rx) +
            "," +
            prideOutlineCoord(circle.ry) +
            " 0 " +
            arcFlags.largeArc +
            " " +
            arcFlags.sweep +
            " " +
            prideOutlineCoord(arcTo.x) +
            "," +
            prideOutlineCoord(arcTo.y)
        );
        shadowPts = shadowPts.concat(
          sampleEllipseArcPoints(circle, from, arcTo, shadowSteps)
        );
        edgeIdx = endIdx;
        if (edgeIdx === 0) break;
        continue;
      }

      var afterIdx = (toIdx + 1) % n;
      var cornerArc = getPrideCornerArcTrim(
        from,
        to,
        points[afterIdx],
        cornerRadius
      );
      if (cornerArc) {
        pathParts.push(
          "L" +
            prideOutlineCoord(cornerArc.p1.x) +
            "," +
            prideOutlineCoord(cornerArc.p1.y)
        );
        var cornerSweep =
          prideEllipseSweepFlag(
            { cx: cornerArc.acx, cy: cornerArc.acy, rx: 1, ry: 1 },
            cornerArc.p1,
            cornerArc.p2
          );
        pathParts.push(
          "A" +
            prideOutlineCoord(cornerArc.r) +
            "," +
            prideOutlineCoord(cornerArc.r) +
            " 0 0 " +
            cornerSweep +
            " " +
            prideOutlineCoord(cornerArc.p2.x) +
            "," +
            prideOutlineCoord(cornerArc.p2.y)
        );
        shadowPts.push({ x: cornerArc.p1.x, y: cornerArc.p1.y });
        shadowPts = shadowPts.concat(
          sampleCornerArcPoints(
            cornerArc.p1,
            cornerArc.p2,
            cornerArc.r,
            cornerShadowSteps,
            cornerArc.acx,
            cornerArc.acy
          )
        );
      } else {
        pathParts.push(
          "L" + prideOutlineCoord(to.x) + "," + prideOutlineCoord(to.y)
        );
        shadowPts.push({ x: to.x, y: to.y });
      }

      edgeIdx = toIdx;
      if (edgeIdx === 0) break;
    }

    pathParts.push("Z");
    return { pathD: pathParts.join(" "), shadowPoints: shadowPts };
  }

  /**
   * @param {{ x: number, y: number }[]} pts
   * @param {string} fillColor
   * @returns {SVGElement}
   */
  function createAutoMergeRegionGroup(pts, fillColor) {
    var g = elSvg("g");

    if (isCirclesGrid()) {
      var outline = buildCirclesGridPrideOutline(pts);
      if (!outline.pathD) return g;
      appendAutoMergeFilteredShadowPolygon(g, outline.shadowPoints);
      var smoothPath = elSvg("path");
      smoothPath.setAttribute("d", outline.pathD);
      smoothPath.setAttribute("fill", fillColor);
      smoothPath.setAttribute("stroke", getAutoMergeOutlineColor());
      smoothPath.setAttribute("stroke-width", String(getAutoMergeOutlineWidth()));
      smoothPath.setAttribute("stroke-linejoin", "round");
      smoothPath.setAttribute("stroke-linecap", "round");
      g.appendChild(smoothPath);
      return g;
    }

    var pointsAttr = polygonPointsToAttr(pts);
    appendAutoMergeFilteredShadowPolygon(g, pts);
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
  function pushAutoMergeShadowExportLines(lines) {
    if (!hasActivePrideAutoMergeRegions()) {
      return;
    }

    var i;
    var pts;

    lines.push('<g id="layer-auto-merge-fills-shadows">');
    for (i = 0; i < autoMergeFillRegions.length; i++) {
      pts = autoMergeFillRegions[i].points;
      if (!pts.length) continue;
      if (isCirclesGrid()) {
        lines.push(
          getAutoMergeShadowPolygonExportMarkup(
            polygonPointsToAttr(buildCirclesGridPrideOutline(pts).shadowPoints)
          )
        );
      } else {
        lines.push(
          getAutoMergeShadowPolygonExportMarkup(polygonPointsToAttr(pts))
        );
      }
    }
    lines.push("</g>");
  }

  function pushAutoMergeFillOnlyExportLines(lines) {
    if (!hasActivePrideAutoMergeRegions()) {
      return;
    }

    var fillColor = getAutoMergeFillColor();
    var i;
    var pts;
    var p;
    var pointsAttr;

    lines.push('<g id="layer-auto-merge-fills">');
    for (i = 0; i < autoMergeFillRegions.length; i++) {
      pts = autoMergeFillRegions[i].points;
      if (!pts.length) continue;
      if (isCirclesGrid()) {
        lines.push(
          getAutoMergeRegionFillPathExportMarkup(
            buildCirclesGridPrideOutline(pts).pathD,
            fillColor
          )
        );
        continue;
      }
      pointsAttr = "";
      for (p = 0; p < pts.length; p++) {
        if (p) pointsAttr += " ";
        pointsAttr += pts[p].x + "," + pts[p].y;
      }
      lines.push(getAutoMergeRegionFillExportMarkup(pointsAttr, fillColor));
    }
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

  function pushHopeMergeFillExportLines(lines) {
    if (!isEmotionLayerActive("hope") || !hasActiveMergeCutouts()) return;

    var mergedRegions = getMergedRegionsForMask();
    if (!mergedRegions.length) return;

    var fillColor = getHopeMergeFillColor();
    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push('<g id="layer-hope-merge-fill">');
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
      lines.push(
        '<polygon points="' + pointsAttr + '" fill="' + fillColor + '" stroke="none"/>'
      );
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  function renderHopeMergeFillLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-hope-merge-fill");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    if (!isEmotionLayerActive("hope") || !hasActiveMergeCutouts()) return;

    var mergedRegions = getMergedRegionsForMask();
    if (!mergedRegions.length) return;

    var fillColor = getHopeMergeFillColor();
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
      poly.setAttribute("fill", fillColor);
      poly.setAttribute("stroke", "none");
      layer.appendChild(poly);
    }
  }

  function renderStippleDotsLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-stipple-dots");
    var defs = designSvg.querySelector("defs");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    if (
      !isEmotionLayerActive("hope") ||
      !hasActiveMergeCutouts() ||
      !hopeStippleImageReady
    ) {
      layer.removeAttribute("clip-path");
      return;
    }

    var hasMergeClip = !!(
      defs && defs.querySelector("#" + MERGE_REGIONS_CLIP_ID)
    );
    if (!hasMergeClip) {
      layer.removeAttribute("clip-path");
      return;
    }

    layer.setAttribute("clip-path", "url(#" + MERGE_REGIONS_CLIP_ID + ")");
    ensureHopeDotsMaskDef(defs);
    var rect = elSvg("rect");
    rect.setAttribute("data-hope-dots-rect", "1");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", String(CANVAS_W));
    rect.setAttribute("height", String(CANVAS_H));
    rect.setAttribute("fill", getHopeDotsColor());
    rect.setAttribute("mask", "url(#" + HOPE_DOTS_MASK_ID + ")");
    layer.appendChild(rect);
  }

  /**
   * @param {string[]} lines
   */
  function pushStippleDotsExportLines(lines) {
    pushHopeStippleSvgExportLines(lines);
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
        CANVAS_H,
        1
      );
    }
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().buildJunctionCircleCatalog(
        lastOctagonsN,
        CANVAS_W,
        CANVAS_H
      );
    }
    // Junction positions only; halfSide is for Strength marks — not tied to inner-scale slider.
    return TopkapiGeometry.buildUprightSquareCatalog(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H,
      1
    );
  }

  /** Circles/diamonds grid: Sadness uses two-block junction crosses only. */
  function getSadnessCircleCatalog() {
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().buildAdjacentCircleJunctionCatalog(
        lastOctagonsN,
        CANVAS_W,
        CANVAS_H
      );
    }
    return getUprightSquareCatalog();
  }

  function syncSadnessCircleLayoutOnSignatureChange() {
    var sig = isCirclesLikeGrid()
      ? "circles-sadness-adjacent|" +
        lastOctagonsN +
        "|" +
        CANVAS_W +
        "|" +
        CANVAS_H
      : buildCircleLayoutSignature();
    if (sig !== lastCircleLayoutSignature) {
      lastCircleLayoutSignature = sig;
      syncCircleSelection(true);
    }
  }

  /** Combo apply: grid layout may be unchanged while slider values differ. */
  function resetFeelingsLayoutSignatures() {
    lastCircleLayoutSignature = "";
    lastLongingCircleLayoutSignature = "";
    lastGriefCircleLayoutSignature = "";
    lastStrengthCircleLayoutSignature = "";
    lastHelplessnessLayoutSignature = "";
    lastDiamondLayoutSignature = "";
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
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().buildHelplessnessCatalog(
        lastOctagonsN,
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
    if (isCirclesLikeGrid()) {
      return (
        "circles-hp|" +
        lastOctagonsN +
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
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().buildJunctionDiamondCatalog(
        lastOctagonsN,
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
        CANVAS_H +
        "|" +
        getInnerScale()
      );
    }
    if (isCirclesLikeGrid()) {
      return (
        "circles-quad-junction|" +
        lastOctagonsN +
        "|" +
        CANVAS_W +
        "|" +
        CANVAS_H
      );
    }
    return lastOctagonsN + "|" + CANVAS_W + "|" + CANVAS_H;
  }

  /**
   * Shared junction key for octagon/star diamond + upright-square catalogs (col-row).
   * @param {string} id
   * @returns {string|null}
   */
  function junctionKeyFromCatalogId(id) {
    var m = id.match(/^(?:star-)?(?:dm|sq)-(\d+)-(\d+)$/);
    if (m) return m[1] + "-" + m[2];
    return null;
  }

  /**
   * @param {{ id: string }[]} catalog
   * @returns {Map<string, string>}
   */
  function buildCatalogJunctionKeyMap(catalog) {
    var map = new Map();
    for (var i = 0; i < catalog.length; i++) {
      var item = catalog[i];
      var key = junctionKeyFromCatalogId(item.id);
      if (key) map.set(item.id, key);
    }
    return map;
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
   * @param {{ id: string }[]} catalog
   * @param {number} count
   * @param {Set<string>} excludedKeys junction keys to skip
   * @returns {string[]}
   */
  function shufflePickIdsExcluding(catalog, count, excludedKeys) {
    var available = [];
    var i;
    var item;
    var key;
    for (i = 0; i < catalog.length; i++) {
      item = catalog[i];
      key = junctionKeyFromCatalogId(item.id);
      if (key && excludedKeys.has(key)) continue;
      available.push(item);
    }
    var pickCount = count;
    if (pickCount > available.length) pickCount = available.length;
    if (pickCount < 0) pickCount = 0;
    return shufflePickIds(available, pickCount);
  }

  /**
   * Grow/shrink selectedIds to target; full reshuffle only when forceReshuffle is true.
   * Incremental mode: LIFO remove, random add from remaining catalog slots.
   * @param {Set<string>} selectedIds
   * @param {{ id: string }[]} catalog
   * @param {number} target
   * @param {{ forceReshuffle?: boolean, excludeJunctionKeys?: Set<string>, pickFn?: function({ id: string }[], number, Set<string>): string[] }} [options]
   */
  function adjustCatalogSelection(selectedIds, catalog, target, options) {
    options = options || {};
    var forceReshuffle = options.forceReshuffle === true;
    var excludedKeys = options.excludeJunctionKeys || new Set();
    var pickFn = options.pickFn;

    if (target < 0) target = 0;
    if (target > catalog.length) target = catalog.length;

    var validIds = new Set();
    var vi;
    for (vi = 0; vi < catalog.length; vi++) {
      validIds.add(catalog[vi].id);
    }

    function pickFromCatalog(cat, count) {
      if (pickFn) return pickFn(cat, count, excludedKeys);
      if (excludedKeys.size) return shufflePickIdsExcluding(cat, count, excludedKeys);
      return shufflePickIds(cat, count);
    }

    if (forceReshuffle) {
      selectedIds.clear();
      var fullPicked = pickFromCatalog(catalog, target);
      for (var fp = 0; fp < fullPicked.length; fp++) {
        selectedIds.add(fullPicked[fp]);
      }
      return;
    }

    selectedIds.forEach(function (id) {
      if (!validIds.has(id)) selectedIds.delete(id);
    });

    while (selectedIds.size > target) {
      var order = Array.from(selectedIds);
      selectedIds.delete(order[order.length - 1]);
    }

    if (selectedIds.size < target) {
      var need = target - selectedIds.size;
      var available = [];
      var item;
      var key;
      var ai;
      for (ai = 0; ai < catalog.length; ai++) {
        item = catalog[ai];
        if (selectedIds.has(item.id)) continue;
        key = junctionKeyFromCatalogId(item.id);
        if (key && excludedKeys.has(key)) continue;
        available.push(item);
      }
      var added = pickFromCatalog(available, need);
      for (var ad = 0; ad < added.length; ad++) {
        selectedIds.add(added[ad]);
      }
    }
  }

  /**
   * Junction keys occupied by active circle emotions (Sadness, Longing, Grief, Strength).
   * @returns {Set<string>}
   */
  function getActiveCircleJunctionKeys() {
    var catalog = getUprightSquareCatalog();
    var idToKey = buildCatalogJunctionKeyMap(catalog);
    var keys = new Set();
    var key;

    if (isEmotionLayerActive("sadness")) {
      circleSelectedIds.forEach(function (id) {
        key = junctionKeyFromCatalogId(id);
        if (key) keys.add(key);
      });
    }
    if (isEmotionLayerActive("longing")) {
      longingCircleSelectedIds.forEach(function (id) {
        key = idToKey.get(id);
        if (key) keys.add(key);
      });
    }
    if (isEmotionLayerActive("grief")) {
      griefCircleSelectedIds.forEach(function (id) {
        key = idToKey.get(id);
        if (key) keys.add(key);
      });
    }
    if (isEmotionLayerActive("strength")) {
      strengthSelectedIds.forEach(function (id) {
        key = idToKey.get(id);
        if (key) keys.add(key);
      });
    }
    return keys;
  }

  /**
   * Junction keys occupied by active anger triangles.
   * @returns {Set<string>}
   */
  function getActiveTriangleJunctionKeys() {
    if (!supportsAngerDiamondTriangles() || !isEmotionLayerActive("anger")) {
      return new Set();
    }
    var catalog = getDiamondCatalog();
    var idToKey = buildCatalogJunctionKeyMap(catalog);
    var keys = new Set();
    var key;
    angerTriangleDiamondIds.forEach(function (id) {
      key = idToKey.get(id);
      if (key) keys.add(key);
    });
    return keys;
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
   * @param {boolean} [useRandomShuffle] when true, pick positions with Math.random (Randomize button)
   */
  function syncHelplessnessSelection(forceReshuffle, useRandomShuffle) {
    var catalog = getHelplessnessJunctionCatalog();
    var target = Math.round((catalog.length * getHelplessnessPercent()) / 100);
    var pickFn = forceReshuffle
      ? function (cat, count) {
          return useRandomShuffle
            ? shufflePickIds(cat, count)
            : seededShufflePickIds(cat, count, getHelplessnessShuffleSeed());
        }
      : undefined;
    adjustCatalogSelection(helplessnessSelectedIds, catalog, target, {
      forceReshuffle: forceReshuffle,
      pickFn: pickFn,
    });
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncCircleSelection(forceReshuffle) {
    var catalog = getSadnessCircleCatalog();
    var target = Math.round((catalog.length * getCircleDensity()) / 100);
    adjustCatalogSelection(circleSelectedIds, catalog, target, {
      forceReshuffle: forceReshuffle,
      excludeJunctionKeys: getActiveTriangleJunctionKeys(),
    });
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncLongingCircleSelection(forceReshuffle) {
    var catalog = getUprightSquareCatalog();
    var target = Math.round((catalog.length * getLongingCircleDensity()) / 100);
    adjustCatalogSelection(longingCircleSelectedIds, catalog, target, {
      forceReshuffle: forceReshuffle,
      excludeJunctionKeys: getActiveTriangleJunctionKeys(),
    });
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncGriefCircleSelection(forceReshuffle) {
    var catalog = getUprightSquareCatalog();
    var target = Math.round((catalog.length * getGriefCircleDensity()) / 100);
    adjustCatalogSelection(griefCircleSelectedIds, catalog, target, {
      forceReshuffle: forceReshuffle,
      excludeJunctionKeys: getActiveTriangleJunctionKeys(),
    });
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncStrengthSelection(forceReshuffle) {
    var catalog = getUprightSquareCatalog();
    var target = Math.round((catalog.length * getStrengthDensity()) / 100);
    adjustCatalogSelection(strengthSelectedIds, catalog, target, {
      forceReshuffle: forceReshuffle,
      excludeJunctionKeys: getActiveTriangleJunctionKeys(),
    });
  }

  /**
   * @param {boolean} forceReshuffle
   */
  function syncDiamondFill(forceReshuffle) {
    var catalog = getDiamondCatalog();
    var target = Math.round((catalog.length * getPrideFillPercent()) / 100);
    adjustCatalogSelection(diamondFilledIds, catalog, target, {
      forceReshuffle: forceReshuffle,
    });
  }

  /** Random-fill inner diamonds (Pain slider / Randomize). */
  function syncPrideShapes() {
    syncDiamondFill(true);
  }

  function syncAngerTriangleSelection(forceReshuffle) {
    if (!supportsAngerDiamondTriangles()) {
      angerTriangleDiamondIds.clear();
      return;
    }
    var catalog = getDiamondCatalog();
    var target = Math.round((catalog.length * getAngerTriangleDensity()) / 100);
    adjustCatalogSelection(angerTriangleDiamondIds, catalog, target, {
      forceReshuffle: forceReshuffle,
      excludeJunctionKeys: getActiveCircleJunctionKeys(),
    });
  }

  function syncAngerShapes() {
    syncAngerTriangleSelection(true);
  }

  function syncGuiltShameDiamondFill(forceReshuffle) {
    var catalog = getDiamondCatalog();
    var target = Math.round((catalog.length * getGuiltShameFillPercent()) / 100);
    adjustCatalogSelection(guiltShameFilledIds, catalog, target, {
      forceReshuffle: forceReshuffle,
    });
  }

  function syncGuiltShameShapes() {
    syncGuiltShameDiamondFill(true);
  }

  /**
   * @returns {{ id: string, points: { x: number, y: number }[] }[]}
   */
  function getFilledHollowDiamonds() {
    if (!isEmotionLayerActive("guiltShame")) return [];
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
    if (!isEmotionLayerActive("pain")) return [];
    var catalog = getDiamondCatalog();
    var filled = [];
    for (var i = 0; i < catalog.length; i++) {
      var dm = catalog[i];
      if (diamondFilledIds.has(dm.id)) filled.push(dm);
    }
    return filled;
  }

  /**
   * @returns {{ id: string, points: { x: number, y: number }[] }[]}
   */
  function getAngerTriangleDiamonds() {
    if (!supportsAngerDiamondTriangles() || !isEmotionLayerActive("anger")) {
      return [];
    }
    var catalog = getDiamondCatalog();
    var filled = [];
    for (var i = 0; i < catalog.length; i++) {
      var dm = catalog[i];
      if (angerTriangleDiamondIds.has(dm.id)) filled.push(dm);
    }
    return filled;
  }

  /**
   * Upper-half isosceles triangle: left, right, top vertices of the junction diamond.
   * @param {{ x: number, y: number }[]} points top, right, bottom, left
   * @returns {string}
   */
  function angerTrianglePointsAttr(points) {
    var left = points[3];
    var top = points[0];
    var right = points[1];
    return (
      left.x +
      "," +
      left.y +
      " " +
      right.x +
      "," +
      right.y +
      " " +
      top.x +
      "," +
      top.y
    );
  }

  /**
   * @param {{ id: string, points: { x: number, y: number }[] }[]} diamonds
   * @returns {SVGElement}
   */
  function angerTrianglesToGroup(diamonds) {
    var g = elSvg("g");
    var fillColor = getAngerTriangleFillColor();
    for (var i = 0; i < diamonds.length; i++) {
      var dm = diamonds[i];
      var poly = elSvg("polygon");
      poly.setAttribute("points", angerTrianglePointsAttr(dm.points));
      poly.setAttribute("fill", fillColor);
      poly.setAttribute("stroke", "none");
      g.appendChild(poly);
    }
    return g;
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
    ensurePrideAutoMergeMounted();
    var layer = designSvg.querySelector("#layer-auto-merge-fills");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    if (hasActivePrideAutoMergeRegions()) {
      var defs = designSvg.querySelector("defs");
      if (defs) ensureAutoMergeShadowFilter(defs);
      layer.appendChild(autoMergeFillsToGroup(autoMergeFillRegions));
    }
  }

  /**
   * @returns {{ cx: number, cy: number, r: number }[]}
   */
  function getActiveCircles() {
    if (!isEmotionLayerActive("sadness")) return [];
    var catalog = getSadnessCircleCatalog();
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
    if (!isEmotionLayerActive("longing")) return [];
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
    if (!isEmotionLayerActive("grief")) return [];
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
   * @returns {{ cx: number, cy: number, r: number, halfSide: number }[]}
   */
  function getActiveStrengthMarks() {
    if (!isEmotionLayerActive("strength")) return [];
    var catalog = getUprightSquareCatalog();
    var marks = [];
    for (var i = 0; i < catalog.length; i++) {
      var sq = catalog[i];
      if (strengthSelectedIds.has(sq.id)) {
        var halfSide =
          typeof sq.halfSide === "number" ? sq.halfSide : sq.r;
        marks.push({
          cx: sq.cx,
          cy: sq.cy,
          r: halfSide,
          halfSide: halfSide,
        });
      }
    }
    return marks;
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
    g.setAttribute("stroke", getHelplessnessStrokeColor());
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
   * Structural pattern ellipses (Circles grid only) — outline, same stroke as grid lines.
   * @param {{ cx: number, cy: number, rx: number, ry: number, r?: number }[]} circles
   * @returns {SVGElement}
   */
  function structuralCirclesToGroup(circles) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-structural-circles");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getPatternStrokeColor());
    g.setAttribute("stroke-width", String(getGridStrokeWidth()));
    var i;
    var c;
    var shape;
    for (i = 0; i < circles.length; i++) {
      c = circles[i];
      if (typeof c.rx === "number" && typeof c.ry === "number") {
        shape = elSvg("ellipse");
        shape.setAttribute("cx", String(c.cx));
        shape.setAttribute("cy", String(c.cy));
        shape.setAttribute("rx", String(c.rx));
        shape.setAttribute("ry", String(c.ry));
      } else {
        shape = elSvg("circle");
        shape.setAttribute("cx", String(c.cx));
        shape.setAttribute("cy", String(c.cy));
        shape.setAttribute("r", String(c.r));
      }
      g.appendChild(shape);
    }
    return g;
  }

  /**
   * Structural pattern diamonds (Diamonds grid only) — outline, same stroke as grid lines.
   * @param {{ cx: number, cy: number, rx: number, ry: number }[]} diamonds
   * @returns {SVGElement}
   */
  function structuralDiamondsToGroup(diamonds) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-structural-diamonds");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", getPatternStrokeColor());
    g.setAttribute("stroke-width", String(getGridStrokeWidth()));
    g.setAttribute("stroke-linejoin", "miter");
    var i;
    var d;
    var poly;
    for (i = 0; i < diamonds.length; i++) {
      d = diamonds[i];
      poly = elSvg("polygon");
      poly.setAttribute(
        "points",
        d.cx +
          "," +
          (d.cy - d.ry) +
          " " +
          (d.cx + d.rx) +
          "," +
          d.cy +
          " " +
          d.cx +
          "," +
          (d.cy + d.ry) +
          " " +
          (d.cx - d.rx) +
          "," +
          d.cy
      );
      g.appendChild(poly);
    }
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
    g.setAttribute("stroke", getLongingCircleStrokeColor());
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
    g.setAttribute("stroke", getGriefCircleStrokeColor());
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

  /**
   * @param {{ cx: number, cy: number, r: number, halfSide: number }[]} marks
   * @returns {SVGElement}
   */
  function strengthMarksToGroup(marks) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-strength");
    var squareFill = getStrengthSquareFillColor();
    var circleFill = getStrengthCircleFillColor();
    var strokeColor = getStrengthStrokeColor();
    var stroke = getCircleStrokeWidth();
    var strokeInset = stroke / 2;

    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      var halfSide = m.halfSide;
      var side = halfSide * 2;
      var rect = elSvg("rect");
      rect.setAttribute("x", String(m.cx - halfSide));
      rect.setAttribute("y", String(m.cy - halfSide));
      rect.setAttribute("width", String(side));
      rect.setAttribute("height", String(side));
      rect.setAttribute("fill", squareFill);
      rect.setAttribute("stroke", strokeColor);
      rect.setAttribute("stroke-width", String(stroke));
      rect.setAttribute("paint-order", "stroke fill");
      g.appendChild(rect);

      var circle = elSvg("circle");
      circle.setAttribute("cx", String(m.cx));
      circle.setAttribute("cy", String(m.cy));
      circle.setAttribute("r", String(Math.max(0, m.r - strokeInset)));
      circle.setAttribute("fill", circleFill);
      circle.setAttribute("stroke", strokeColor);
      circle.setAttribute("stroke-width", String(stroke));
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
    } else if (isCirclesLikeGrid()) {
      lastTileSize = getCirclesLikeGridGeometry().tileSizeFromN(
        lastOctagonsN,
        CANVAS_W
      );
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
        cachedStarRhombusFills = [];
        cachedStructuralCircles = [];
        return [];
      }
      var pattern = NestedStarOctagonsGeometry.buildPattern(
        layout,
        getStarMiddlePinwheelFactor()
      );
      cachedStarFills = pattern.starFills || [];
      cachedStarRhombusFills = pattern.starRhombusFills || [];
      cachedStructuralCircles = [];
      return pattern.segments;
    }
    cachedStarFills = [];
    cachedStarRhombusFills = [];
    if (isCirclesLikeGrid()) {
      var circlesInnerScale = getInnerScale();
      var circlesLikeGeometry = getCirclesLikeGridGeometry();
      cachedStructuralCircles = circlesLikeGeometry.buildStructuralCircles(
        lastOctagonsN,
        CANVAS_W,
        CANVAS_H,
        circlesInnerScale
      );
      rebuildCirclesGridEllipseChordKeyCache();
      return circlesLikeGeometry.buildPatternSegments(
        lastTileSize,
        CANVAS_W,
        CANVAS_H,
        lastOctagonsN,
        circlesInnerScale
      );
    }
    cachedCirclesGridEllipseChordKeySet = null;
    cachedCirclesGridChordKeyToCircleId = {};
    cachedStructuralCircles = [];
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

  function getStarGridFillOutlines() {
    return cachedStarFills.concat(cachedStarRhombusFills);
  }

  /** True when a Pride region overlaps a structural circle (center, arc, or corner cells). */
  function structuralCircleOverlapsMergeRegion(circle, regionPoints) {
    if (!regionPoints || !regionPoints.length) return false;
    if (hopePointInPolygon(circle.cx, circle.cy, regionPoints)) return true;

    var ri;
    var dx;
    var dy;
    for (ri = 0; ri < regionPoints.length; ri++) {
      dx = regionPoints[ri].x - circle.cx;
      dy = regionPoints[ri].y - circle.cy;
      if (
        (dx * dx) / (circle.rx * circle.rx) +
          (dy * dy) / (circle.ry * circle.ry) <=
        1.08
      ) {
        return true;
      }
    }

    var samples = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    var px;
    var py;
    for (ri = 0; ri < samples.length; ri++) {
      px = circle.cx + circle.rx * Math.cos(samples[ri]);
      py = circle.cy + circle.ry * Math.sin(samples[ri]);
      if (hopePointInPolygon(px, py, regionPoints)) return true;
    }

    return false;
  }

  /** How many structural circle blocks overlap a Pride auto-merge region. */
  function countStructuralCirclesInsideMergeRegion(region) {
    if (!cachedStructuralCircles.length || !region.points.length) return 0;
    var count = 0;
    var i;
    for (i = 0; i < cachedStructuralCircles.length; i++) {
      if (
        structuralCircleOverlapsMergeRegion(
          cachedStructuralCircles[i],
          region.points
        )
      ) {
        count++;
      }
    }
    return count;
  }

  /** Circles/diamonds grid: Pride adds fills only — never remove grid lines or structural shapes. */
  function shouldPreserveCirclesGridPatternUnderPride() {
    return isCirclesLikeGrid();
  }

  /** Hide structural circles under Pride auto-merge (solid red replaces them). */
  function getVisibleStructuralCirclesForPattern() {
    if (!cachedStructuralCircles.length) return [];
    if (shouldPreserveCirclesGridPatternUnderPride()) {
      return cachedStructuralCircles;
    }
    if (
      !isEmotionLayerActive("pride") ||
      !autoMergeFillRegions ||
      !autoMergeFillRegions.length
    ) {
      return cachedStructuralCircles;
    }
    var out = [];
    var i;
    var ri;
    for (i = 0; i < cachedStructuralCircles.length; i++) {
      for (ri = 0; ri < autoMergeFillRegions.length; ri++) {
        if (
          structuralCircleOverlapsMergeRegion(
            cachedStructuralCircles[i],
            autoMergeFillRegions[ri].points
          )
        ) {
          break;
        }
      }
      if (ri >= autoMergeFillRegions.length) out.push(cachedStructuralCircles[i]);
    }
    return out;
  }

  /** Hide star cell fills under Pride auto-merge (solid red replaces them). */
  function getVisibleStarFillsForPattern() {
    if (!cachedStarFills.length) return [];
    if (
      !isEmotionLayerActive("pride") ||
      !autoMergeFillRegions ||
      !autoMergeFillRegions.length
    ) {
      return cachedStarFills;
    }
    var out = [];
    var i;
    var ri;
    var c;
    for (i = 0; i < cachedStarFills.length; i++) {
      c = getStarFillCentroid(cachedStarFills[i].outline);
      for (ri = 0; ri < autoMergeFillRegions.length; ri++) {
        if (hopePointInPolygon(c.x, c.y, autoMergeFillRegions[ri].points)) {
          break;
        }
      }
      if (ri >= autoMergeFillRegions.length) out.push(cachedStarFills[i]);
    }
    return out;
  }

  function rebuildCirclesGridEllipseChordKeyCache() {
    cachedCirclesGridEllipseChordKeySet = new Set();
    cachedCirclesGridChordKeyToCircleId = {};
    if (!cachedStructuralCircles.length) return;
    var ci;
    var circle;
    var chords;
    var i;
    var key;
    for (ci = 0; ci < cachedStructuralCircles.length; ci++) {
      circle = cachedStructuralCircles[ci];
      chords = getCirclesLikeGridGeometry().buildEllipseBoundarySegments([circle]);
      for (i = 0; i < chords.length; i++) {
        key = TopkapiGeometry.segmentKey(
          chords[i].x1,
          chords[i].y1,
          chords[i].x2,
          chords[i].y2
        );
        cachedCirclesGridEllipseChordKeySet.add(key);
        cachedCirclesGridChordKeyToCircleId[key] = circle.id;
      }
    }
  }

  function isCirclesGridEllipseChordKey(key) {
    return !!(
      cachedCirclesGridEllipseChordKeySet &&
      cachedCirclesGridEllipseChordKeySet.has(key)
    );
  }

  function getStructuralCircleById(circleId) {
    var i;
    for (i = 0; i < cachedStructuralCircles.length; i++) {
      if (cachedStructuralCircles[i].id === circleId) {
        return cachedStructuralCircles[i];
      }
    }
    return null;
  }

  /** True when every ellipse chord is still visible (smooth outline, not broken). */
  function isStructuralCircleOutlineIntact(circle) {
    if (!circle) return false;
    var chords = getCirclesLikeGridGeometry().buildEllipseBoundarySegments([circle]);
    var hopeMergeRegions = getHopeMergeCutoutRegionsForRendering();
    var i;
    var s;
    var key;
    for (i = 0; i < chords.length; i++) {
      s = chords[i];
      key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (isSegmentRemoved(key, s, hopeMergeRegions)) return false;
    }
    return true;
  }

  function getIntactStructuralCirclesForPattern() {
    if (!cachedStructuralCircles.length) return [];
    var out = [];
    var i;
    for (i = 0; i < cachedStructuralCircles.length; i++) {
      if (isStructuralCircleOutlineIntact(cachedStructuralCircles[i])) {
        out.push(cachedStructuralCircles[i]);
      }
    }
    return out;
  }

  /**
   * Circles grid: four ellipse × side-grid crossings per intact structural circle
   * (top / right / bottom / left on the circle outline).
   * @returns {{ cx: number, cy: number }[]}
   */
  function collectCirclesGridFrameJunctionPoints() {
    if (!isCirclesLikeGrid()) return [];
    var circles = getIntactStructuralCirclesForPattern();
    var points = [];
    var seen = {};
    var i;
    var c;

    function add(px, py) {
      var key = px.toFixed(3) + "," + py.toFixed(3);
      if (seen[key]) return;
      seen[key] = true;
      points.push({ cx: px, cy: py });
    }

    for (i = 0; i < circles.length; i++) {
      c = circles[i];
      if (typeof c.rx !== "number" || typeof c.ry !== "number") continue;
      add(c.cx, c.cy - c.ry);
      add(c.cx + c.rx, c.cy);
      add(c.cx, c.cy + c.ry);
      add(c.cx - c.rx, c.cy);
    }
    return points;
  }

  function getCirclesGridFrameJunctionDotRadius() {
    var diameter =
      typeof CIRCLES_GRID_FRAME_JUNCTION_DOT_DIAMETER_PX !== "undefined"
        ? CIRCLES_GRID_FRAME_JUNCTION_DOT_DIAMETER_PX
        : 5;
    return diameter / 2;
  }

  /**
   * @param {SVGElement} g
   */
  function appendCirclesGridFrameJunctionDots(g) {
    if (!isCirclesLikeGrid()) return;
    var points = collectCirclesGridFrameJunctionPoints();
    if (!points.length) return;

    var fill = getPatternStrokeColor();
    var r = getCirclesGridFrameJunctionDotRadius();
    var dotG = elSvg("g");
    dotG.setAttribute("class", "circles-grid-frame-junction-dots");
    dotG.setAttribute("fill", fill);
    dotG.setAttribute("stroke", "none");

    for (var i = 0; i < points.length; i++) {
      var circle = elSvg("circle");
      circle.setAttribute("cx", String(points[i].cx));
      circle.setAttribute("cy", String(points[i].cy));
      circle.setAttribute("r", String(r));
      dotG.appendChild(circle);
    }
    g.appendChild(dotG);
  }

  /**
   * @param {string[]} lines
   */
  function pushCirclesGridFrameJunctionDotsExport(lines) {
    if (!isCirclesLikeGrid()) return;
    var points = collectCirclesGridFrameJunctionPoints();
    if (!points.length) return;

    var fill = getPatternStrokeColor();
    var r = getCirclesGridFrameJunctionDotRadius();
    var i;
    lines.push(
      '<g class="circles-grid-frame-junction-dots" fill="' +
        fill +
        '" stroke="none">'
    );
    for (i = 0; i < points.length; i++) {
      lines.push(
        '<circle cx="' +
          points[i].cx +
          '" cy="' +
          points[i].cy +
          '" r="' +
          r +
          '"/>'
      );
    }
    lines.push("</g>");
  }

  /**
   * Circles grid display: grid lines + broken ellipse chords (intact → smooth SVG).
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getVisibleCirclesGridPatternSegments() {
    var hopeMergeRegions = getHopeMergeCutoutRegionsForRendering();
    var tracing = getAllSegmentsForTracing();
    var visible = [];
    var i;
    var s;
    var key;
    var circle;
    for (i = 0; i < tracing.length; i++) {
      s = tracing[i];
      key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (isSegmentRemoved(key, s, hopeMergeRegions)) continue;
      if (isCirclesGridEllipseChordKey(key)) {
        circle = getStructuralCircleById(
          cachedCirclesGridChordKeyToCircleId[key]
        );
        if (isStructuralCircleOutlineIntact(circle)) continue;
      }
      visible.push(s);
    }
    return visible;
  }

  /**
   * Structural ellipse outlines as chord segments (Circles grid tracing / merge).
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getCirclesGridEllipseOutlineSegments() {
    if (!cachedStructuralCircles.length) return [];
    return getCirclesLikeGridGeometry().buildEllipseBoundarySegments(
      cachedStructuralCircles
    );
  }

  /** Line network for face tracing / merge (star fills; circles ellipse arcs). */
  function getAllSegmentsForTracing() {
    var seen = new Set();
    var out = [];
    var i;
    var s;
    var key;

    function pushSegment(segment) {
      key = TopkapiGeometry.segmentKey(
        segment.x1,
        segment.y1,
        segment.x2,
        segment.y2
      );
      if (seen.has(key)) return;
      seen.add(key);
      out.push(segment);
    }

    for (i = 0; i < cachedAllSegments.length; i++) {
      pushSegment(cachedAllSegments[i]);
    }

    if (
      isStarGrid() &&
      (cachedStarFills.length || cachedStarRhombusFills.length)
    ) {
      var extra = starFillOutlineSegments(getStarGridFillOutlines());
      for (i = 0; i < extra.length; i++) {
        pushSegment(extra[i]);
      }
      return out;
    }

    if (isCirclesLikeGrid()) {
      var ellipseSegments = getCirclesGridEllipseOutlineSegments();
      for (i = 0; i < ellipseSegments.length; i++) {
        pushSegment(ellipseSegments[i]);
      }
    }

    return out;
  }

  /** Visible pattern line segments for render + export (grid + merge-hidden arcs). */
  function getVisiblePatternSegments() {
    if (isCirclesLikeGrid()) return getVisibleCirclesGridPatternSegments();
    return getVisibleSegments(getAllSegmentsForTracing());
  }

  /**
   * Hope merge hit-test + dangling prune: full drawn line network so removed edge
   * keys match rendered segments and inner structure can break apart.
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getSegmentsForHopeMerge() {
    return getAllSegmentsForTracing();
  }

  /**
   * Merge cutout detection: full line network (inner diamonds included) so Hope
   * holes follow intricate grid geometry; micro-faces filtered per grid type.
   * Circles grid uses tessellation mesh (grid + structural ellipse arcs).
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getSegmentsForMergeRegionDetection() {
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().buildHopeMergeTessellationSegments(
        lastOctagonsN,
        CANVAS_W,
        CANVAS_H,
        getInnerScale()
      );
    }
    return getAllSegmentsForTracing();
  }

  /**
   * Pride auto-merge: coarse octagon + square mesh (no inner diamonds / star micro-faces).
   * Dense grids always use this simpler network for speed; octagon grid switches at
   * simple-mode density, star grid always uses its coarse mesh here.
   * Circles grid uses inner-scale grid + structural ellipse arcs.
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getSegmentsForPrideAutoMerge() {
    if (isOctagonGrid()) {
      if (shouldUseSimplePrideAutoMergeMode()) {
        return TopkapiGeometry.buildCoarseCellBoundarySegments(
          lastTileSize,
          CANVAS_W,
          CANVAS_H,
          lastOctagonsN
        );
      }
      return getAllSegmentsForTracing();
    }
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().buildPrideCircleTessellationSegments(
        lastOctagonsN,
        CANVAS_W,
        CANVAS_H,
        getCirclesGridPrideTessellationInnerScale()
      );
    }
    if (!isStarGrid()) return getAllSegmentsForTracing();
    var layout = getStarLayout();
    var coarseInner =
      typeof STAR_GRID_PRIDE_COARSE_INNER_SCALE !== "undefined"
        ? STAR_GRID_PRIDE_COARSE_INNER_SCALE
        : 1;
    return TopkapiGeometry.buildPatternSegments(
      layout.tileSize,
      CANVAS_W,
      CANVAS_H,
      layout.n,
      coarseInner
    );
  }

  function isSegmentMidpointInsidePrideFill(s) {
    if (shouldPreserveCirclesGridPatternUnderPride()) return false;
    if (shouldUseSimplePrideAutoMergeMode()) return false;
    if (!isStarGrid() || !isEmotionLayerActive("pride")) {
      return false;
    }
    if (!autoMergeFillRegions || !autoMergeFillRegions.length) return false;
    var mx = (s.x1 + s.x2) * 0.5;
    var my = (s.y1 + s.y2) * 0.5;
    var ri;
    for (ri = 0; ri < autoMergeFillRegions.length; ri++) {
      if (hopePointInPolygon(mx, my, autoMergeFillRegions[ri].points)) {
        return true;
      }
    }
    return false;
  }

  function isSegmentMidpointInsideHopeMergeCutout(s, mergeRegions) {
    if (!mergeRegions || !mergeRegions.length) return false;
    var mx = (s.x1 + s.x2) * 0.5;
    var my = (s.y1 + s.y2) * 0.5;
    var ri;
    for (ri = 0; ri < mergeRegions.length; ri++) {
      if (hopePointInPolygon(mx, my, mergeRegions[ri].points)) {
        return true;
      }
    }
    return false;
  }

  function bumpHopeMergeState() {
    hopeMergeStateVersion++;
    hopeMergeRegionsRenderCache = null;
    hopeMergeRegionsCacheVersion = -1;
  }

  function getHopeMergeCutoutRegionsForRendering() {
    if (!removedEdges.size) return null;
    if (
      hopeMergeRegionsRenderCache !== null &&
      hopeMergeRegionsCacheVersion === hopeMergeStateVersion
    ) {
      return hopeMergeRegionsRenderCache;
    }
    var regions = getMergedRegionsForMask();
    hopeMergeRegionsRenderCache =
      regions && regions.length ? regions : null;
    hopeMergeRegionsCacheVersion = hopeMergeStateVersion;
    return hopeMergeRegionsRenderCache;
  }

  function isHopeMergeDragActive() {
    return isDragging && hopeInteractionMode === "merge";
  }

  /** Fast path while dragging: removed edge keys only (no traceFaces / cutout tests). */
  function getVisibleSegmentsFast(segments) {
    var visible = [];
    var i;
    var s;
    var key;
    for (i = 0; i < segments.length; i++) {
      s = segments[i];
      key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (removedEdges.has(key)) continue;
      if (isEmotionLayerActive("pride") && autoMergeEdgeKeys.has(key)) continue;
      if (isSegmentMidpointInsidePrideFill(s)) continue;
      visible.push(s);
    }
    return visible;
  }

  function updatePatternGridLinesOnly() {
    if (!designSvg) return;
    var patternLayer = designSvg.querySelector("#layer-pattern");
    if (!patternLayer) return;
    var oldGroup = patternLayer.querySelector('[data-layer="grid-segments"]');
    if (!oldGroup) {
      renderPatternLayer();
      return;
    }
    var visible;
    if (isCirclesLikeGrid()) {
      visible = getVisibleCirclesGridPatternSegments();
    } else {
      var segments = isStarGrid()
        ? getAllSegmentsForTracing()
        : cachedAllSegments;
      visible = getVisibleSegmentsFast(segments);
    }
    patternLayer.replaceChild(segmentsToGroup(visible), oldGroup);
    if (isCirclesLikeGrid()) {
      if (isCirclesGrid()) {
        var oldCircles = patternLayer.querySelector("#layer-structural-circles");
        var intactCircles = getIntactStructuralCirclesForPattern();
        if (!intactCircles.length) {
          if (oldCircles) patternLayer.removeChild(oldCircles);
        } else if (oldCircles) {
          patternLayer.replaceChild(
            structuralCirclesToGroup(intactCircles),
            oldCircles
          );
        } else {
          patternLayer.appendChild(structuralCirclesToGroup(intactCircles));
        }
      } else {
        var oldDiamonds = patternLayer.querySelector("#layer-structural-diamonds");
        var intactDiamonds = getIntactStructuralCirclesForPattern();
        if (!intactDiamonds.length) {
          if (oldDiamonds) patternLayer.removeChild(oldDiamonds);
        } else if (oldDiamonds) {
          patternLayer.replaceChild(
            structuralDiamondsToGroup(intactDiamonds),
            oldDiamonds
          );
        } else {
          patternLayer.appendChild(structuralDiamondsToGroup(intactDiamonds));
        }
      }
      var oldDots = patternLayer.querySelector(".circles-grid-frame-junction-dots");
      if (oldDots) patternLayer.removeChild(oldDots);
      appendCirclesGridFrameJunctionDots(patternLayer);
    }
  }

  function scheduleHopeMergeDragPreview() {
    if (hopeMergeDragRenderScheduled) return;
    hopeMergeDragRenderScheduled = true;
    requestAnimationFrame(function () {
      hopeMergeDragRenderScheduled = false;
      if (!isHopeMergeDragActive()) return;
      updatePatternGridLinesOnly();
    });
  }

  function finalizeHopeMergeDrag() {
    bumpHopeMergeState();
    if (applyDanglingPrune()) bumpHopeMergeState();
    renderPatternAndVerticalLayers();
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

  function hopePointInsideOrNearPolygonEdge(px, py, points, tolerancePx) {
    if (hopePointInPolygon(px, py, points)) return true;
    var tol = typeof tolerancePx === "number" ? tolerancePx : 2;
    var i;
    var j;
    var dx;
    var dy;
    var len;
    var t;
    var closestX;
    var closestY;
    var dist;
    for (i = 0; i < points.length; i++) {
      j = (i + 1) % points.length;
      dx = points[j].x - points[i].x;
      dy = points[j].y - points[i].y;
      len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-6) continue;
      t = ((px - points[i].x) * dx + (py - points[i].y) * dy) / (len * len);
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      closestX = points[i].x + t * dx;
      closestY = points[i].y + t * dy;
      dist = Math.sqrt(
        (px - closestX) * (px - closestX) + (py - closestY) * (py - closestY)
      );
      if (dist <= tol) return true;
    }
    return false;
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

  function getOctagonHopeMergeMinAreaPx() {
    var tile = lastTileSize;
    if (!tile || tile <= 0) {
      tile = TopkapiGeometry.tileSizeFromN(lastOctagonsN, CANVAS_W, CANVAS_H);
    }
    var frac =
      typeof OCTAGON_HOPE_MERGE_MIN_AREA_TILE_FRACTION !== "undefined"
        ? OCTAGON_HOPE_MERGE_MIN_AREA_TILE_FRACTION
        : 0.18;
    return tile * tile * frac;
  }

  function getCirclesGridHopeMergeMinAreaPx() {
    var tile = lastTileSize;
    if (!tile || tile <= 0) {
      tile = getCirclesLikeGridGeometry().tileSizeFromN(lastOctagonsN, CANVAS_W);
    }
    var frac =
      typeof CIRCLES_GRID_HOPE_MERGE_MIN_AREA_TILE_FRACTION !== "undefined"
        ? CIRCLES_GRID_HOPE_MERGE_MIN_AREA_TILE_FRACTION
        : 0.45;
    return tile * tile * frac;
  }

  function hopeBaselineFaceIsOctagonUnit(face) {
    var n = face.points ? face.points.length : 0;
    return n >= 8;
  }

  /** True when merged cutout encloses at least one octagon cell (not square-only orphan). */
  function hopeMergedRegionEnclosesOctagonUnit(region, baselineFaces) {
    var i;
    var c;
    for (i = 0; i < baselineFaces.length; i++) {
      if (!hopeBaselineFaceIsOctagonUnit(baselineFaces[i])) continue;
      c = getStarFillCentroid(baselineFaces[i].points);
      if (hopePointInPolygon(c.x, c.y, region.points)) return true;
    }
    return false;
  }

  /**
   * Low inner-scale: drop square-cell orphan holes; keep real octagon-area merges.
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function filterHopeOctagonRegionsLowInnerScale(regions) {
    if (!regions.length) return regions;
    var baselineFaces = TopkapiGeometry.traceFaces(
      getSegmentsForMergeRegionDetection()
    );
    var tile = lastTileSize;
    if (!tile || tile <= 0) {
      tile = TopkapiGeometry.tileSizeFromN(lastOctagonsN, CANVAS_W, CANVAS_H);
    }
    var frac =
      typeof HOPE_LOW_INNER_SCALE_MIN_AREA_TILE_FRACTION !== "undefined"
        ? HOPE_LOW_INNER_SCALE_MIN_AREA_TILE_FRACTION
        : 1.5;
    var minArea = tile * tile * frac;
    var out = [];
    var i;
    for (i = 0; i < regions.length; i++) {
      if (!hopeMergedRegionEnclosesOctagonUnit(regions[i], baselineFaces)) continue;
      if (polygonAreaAbs(regions[i].points) < minArea) continue;
      out.push(regions[i]);
    }
    return out;
  }

  /**
   * Circles/diamonds tessellation creates many global false merge faces when one edge
   * is removed; keep only regions that contain a removed edge midpoint.
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function filterMergeRegionsTouchingRemovedEdges(regions) {
    if (!regions.length || !removedEdges.size) return regions;

    var midpoints = [];
    var segments = getSegmentsForHopeMerge();
    var si;
    var s;
    var key;
    for (si = 0; si < segments.length; si++) {
      s = segments[si];
      key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!removedEdges.has(key)) continue;
      midpoints.push({ x: (s.x1 + s.x2) * 0.5, y: (s.y1 + s.y2) * 0.5 });
    }
    if (!midpoints.length) return regions;

    var out = [];
    var ri;
    var mi;
    for (ri = 0; ri < regions.length; ri++) {
      for (mi = 0; mi < midpoints.length; mi++) {
        if (
          hopePointInsideOrNearPolygonEdge(
            midpoints[mi].x,
            midpoints[mi].y,
            regions[ri].points,
            2
          )
        ) {
          out.push(regions[ri]);
          break;
        }
      }
    }
    return out;
  }

  /**
   * Octagon: grow seed holes (touching removed edges) into larger connected merges.
   * @param {{ points: { x: number, y: number }[] }[]} allRegions
   * @param {{ points: { x: number, y: number }[] }[]} seedRegions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function expandHopeMergeRegionsFromSeeds(allRegions, seedRegions) {
    if (!seedRegions.length || !allRegions.length) return seedRegions;

    var out = seedRegions.slice();
    var ri;
    var si;
    var c;
    var found;
    for (ri = 0; ri < allRegions.length; ri++) {
      if (out.indexOf(allRegions[ri]) >= 0) continue;
      found = false;
      for (si = 0; si < seedRegions.length; si++) {
        if (isMergeRegionContainedIn(seedRegions[si], allRegions[ri])) {
          found = true;
          break;
        }
        c = getMergeRegionCentroid(seedRegions[si].points);
        if (hopePointInPolygon(c.x, c.y, allRegions[ri].points)) {
          found = true;
          break;
        }
      }
      if (found) out.push(allRegions[ri]);
    }
    return dedupeContainedMergeRegions(out);
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

    if (isCirclesLikeGrid()) {
      regions = filterMergeRegionsTouchingRemovedEdges(regions);
      if (!regions.length) return regions;

      var circlesBounds = getGridContentBounds();
      var circlesMaxHoleArea =
        circlesBounds.width * circlesBounds.height * 0.4;
      var circlesMinArea = getCirclesGridHopeMergeMinAreaPx();
      var circlesTile = lastTileSize;
      if (!circlesTile || circlesTile <= 0) {
        circlesTile = getCirclesLikeGridGeometry().tileSizeFromN(
          lastOctagonsN,
          CANVAS_W
        );
      }
      var singleBlockMaxFrac =
        typeof CIRCLES_GRID_HOPE_SINGLE_BLOCK_MAX_AREA_TILE_FRACTION !==
        "undefined"
          ? CIRCLES_GRID_HOPE_SINGLE_BLOCK_MAX_AREA_TILE_FRACTION
          : 0.75;
      var singleBlockMaxArea = circlesTile * circlesTile * singleBlockMaxFrac;
      var partialMaxArea = singleBlockMaxArea * 0.9;
      var singleBlockBandMax = singleBlockMaxArea * 1.25;
      var circlesOut = [];
      var ci;
      var circlesInside;
      for (ci = 0; ci < regions.length; ci++) {
        var circlesArea = polygonAreaAbs(regions[ci].points);
        if (circlesArea < circlesMinArea) continue;
        if (circlesArea > circlesMaxHoleArea) continue;
        if (circlesArea <= singleBlockBandMax) {
          circlesInside = countStructuralCirclesInsideMergeRegion(regions[ci]);
          if (circlesInside === 1 && circlesArea < partialMaxArea) {
            circlesOut.push(regions[ci]);
          }
          continue;
        }
        circlesOut.push(regions[ci]);
      }
      return circlesOut;
    }

    var octagonRaw = regions;
    var octagonSeeds = filterMergeRegionsTouchingRemovedEdges(octagonRaw);
    regions = expandHopeMergeRegionsFromSeeds(octagonRaw, octagonSeeds);
    if (!regions.length) return regions;

    var bounds = getGridContentBounds();
    var maxHoleArea = bounds.width * bounds.height * 0.4;
    var minArea = getOctagonHopeMergeMinAreaPx();
    var octOut = [];
    var oi;
    for (oi = 0; oi < regions.length; oi++) {
      var area = polygonAreaAbs(regions[oi].points);
      if (area < minArea) continue;
      if (area > maxHoleArea) continue;
      octOut.push(regions[oi]);
    }
    if (shouldLimitPrideAutoMergeAtLowInnerScale()) {
      octOut = filterHopeOctagonRegionsLowInnerScale(octOut);
    }
    return octOut;
  }

  /**
   * Pride star grid: keep multi-star coarse merges only (Hope uses the same rule).
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function filterStarGridPrideAutoMergeRegions(regions) {
    if (!isStarGrid() || !regions.length) return regions;
    var baseMinStars =
      typeof STAR_GRID_PRIDE_MIN_STARS_INSIDE !== "undefined"
        ? STAR_GRID_PRIDE_MIN_STARS_INSIDE
        : 2;
    var minStars = Math.max(
      baseMinStars,
      Math.round(baseMinStars * getPrideAutoMergeDensityAreaScale())
    );

    var out = [];
    for (var i = 0; i < regions.length; i++) {
      var region = regions[i];
      var pts = region.points || [];
      if (pts.length < 3) continue;

      if (countStarFillsInsideMergeRegion(region) < minStars) continue;
      out.push(region);
    }
    return out;
  }

  /**
   * Pride circles grid: keep multi-circle block merges only.
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function filterCirclesGridPrideAutoMergeRegions(regions) {
    if (!isCirclesLikeGrid() || !regions.length) return regions;
    var baseMinCircles =
      typeof CIRCLES_GRID_PRIDE_MIN_CIRCLES_INSIDE !== "undefined"
        ? CIRCLES_GRID_PRIDE_MIN_CIRCLES_INSIDE
        : 2;
    var minCircles = Math.max(
      baseMinCircles,
      Math.round(baseMinCircles * getPrideAutoMergeDensityAreaScale())
    );

    var out = [];
    for (var i = 0; i < regions.length; i++) {
      var region = regions[i];
      var pts = region.points || [];
      if (pts.length < 3) continue;

      if (countStructuralCirclesInsideMergeRegion(region) < minCircles) continue;
      out.push(region);
    }
    return out;
  }

  /**
   * Pride octagon grid: drop single square-cell orphan fills (4-vertex quads
   * that read as scattered red diamonds on the canvas).
   * @param {{ points: { x: number, y: number }[] }[]} regions
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function filterOctagonGridPrideAutoMergeRegions(regions) {
    if (!isOctagonGrid() || !regions.length) return regions;
    var minArea = getOctagonHopeMergeMinAreaPx();
    var out = [];
    var i;
    for (i = 0; i < regions.length; i++) {
      var pts = regions[i].points || [];
      if (pts.length < 5) continue;
      if (polygonAreaAbs(pts) < minArea) continue;
      out.push(regions[i]);
    }
    return out;
  }

  function isSegmentRemoved(key, segment, hopeMergeRegions) {
    if (removedEdges.has(key)) return true;
    if (
      !shouldPreserveCirclesGridPatternUnderPride() &&
      isEmotionLayerActive("pride") &&
      autoMergeEdgeKeys.has(key)
    ) {
      return true;
    }
    if (segment && isSegmentMidpointInsidePrideFill(segment)) return true;
    if (
      segment &&
      hopeMergeRegions &&
      isSegmentMidpointInsideHopeMergeCutout(segment, hopeMergeRegions)
    ) {
      return true;
    }
    return false;
  }

  function getVisibleSegments(segments) {
    var hopeMergeRegions = getHopeMergeCutoutRegionsForRendering();
    var visible = [];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!isSegmentRemoved(key, s, hopeMergeRegions)) visible.push(s);
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

  function isHopeDragInteractionMode() {
    return hopeInteractionMode === "merge";
  }

  function clearMergeState() {
    removedEdges.clear();
    stickyMergedCutoutFaces = null;
    hopeMergeDragHadEdgeChanges = false;
    bumpHopeMergeState();
    updateHopeResetButton();
  }

  function clearAutoMergeState() {
    autoMergeEdgeKeys.clear();
    autoMergeFillRegions = null;
    updateHopeResetButton();
    renderAutoMergeFillsLayer();
  }

  function updateHopeResetButton() {
    var resetBtn = document.getElementById("hope-reset-grid-btn");
    if (resetBtn) {
      resetBtn.disabled =
        removedEdges.size === 0 && autoMergeEdgeKeys.size === 0;
    }
  }

  function applyAutoMergeDanglingPrune(segmentNetwork) {
    var changed = false;
    var combined = getCombinedRemovedEdgeSet();
    var segments =
      segmentNetwork && segmentNetwork.length
        ? segmentNetwork
        : getAllSegmentsForTracing();
    var pruneKeys = TopkapiGeometry.findDanglingPruneKeys(
      segments,
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

  /**
   * Small inner diamond: dangling prune + orphan fills assign one red region per square cell.
   * @returns {boolean}
   */
  function shouldLimitPrideAutoMergeAtLowInnerScale() {
    if (isCirclesLikeGrid()) return false;
    var threshold =
      typeof PRIDE_LOW_INNER_SCALE_AUTO_MERGE_THRESHOLD !== "undefined"
        ? PRIDE_LOW_INNER_SCALE_AUTO_MERGE_THRESHOLD
        : 0.45;
    return getInnerScale() < threshold;
  }

  function runAutoMerge() {
    var prideSegments = getSegmentsForPrideAutoMerge();
    if (!prideSegments.length) return;

    clearAutoMergeState();

    if (getAutoMergeIntensity() <= 0) {
      renderPatternAndVerticalLayers();
      renderAutoMergeFillsLayer();
      updateHopeResetButton();
      return;
    }

    var limitLowInnerScale =
      shouldLimitPrideAutoMergeAtLowInnerScale() ||
      shouldUseSimplePrideAutoMergeMode();

    var bounds = getGridContentBounds();
    var manualVisible = getVisibleSegmentsManualOnly(prideSegments);
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

    if (!limitLowInnerScale) {
      while (applyAutoMergeDanglingPrune(prideSegments)) {
        /* prune waves until stable */
      }
    }

    var fillRegions = [];
    var clusters = plan.clusters || [];
    var ci;
    var fillRegion;

    var circlesPrideFillOptions = isCirclesLikeGrid()
      ? { skipOctagonSquareChecks: true }
      : null;

    for (ci = 0; ci < clusters.length; ci++) {
      fillRegion = TopkapiGeometry.getClusterFillRegion(
        prideSegments,
        baselineFaces,
        clusters[ci].faceIndices,
        clusters[ci].edgeKeys,
        autoMergeEdgeKeys,
        circlesPrideFillOptions
      );
      if (fillRegion) fillRegions.push(fillRegion);
    }

    // Star + octagon: square fills between octagons (coarse mesh).
    if (!limitLowInnerScale) {
      fillRegions = TopkapiGeometry.appendOrphanAutoMergeFillRegions(
        fillRegions,
        prideSegments,
        baselineFaces,
        autoMergeEdgeKeys,
        circlesPrideFillOptions
      );
    }

    if (isCirclesLikeGrid()) {
      autoMergeFillRegions = filterCirclesGridPrideAutoMergeRegions(fillRegions);
    } else {
      autoMergeFillRegions = TopkapiGeometry.filterAutoMergeFillRegions(
        fillRegions,
        baselineFaces
      );
      if (isOctagonGrid()) {
        autoMergeFillRegions = filterOctagonGridPrideAutoMergeRegions(
          autoMergeFillRegions
        );
      } else {
        autoMergeFillRegions = filterStarGridPrideAutoMergeRegions(
          autoMergeFillRegions
        );
      }
    }

    renderPatternAndVerticalLayers();
    renderAutoMergeFillsLayer();
    updateHopeResetButton();
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {SVGElement}
   */
  function segmentsToGroup(segments) {
    var g = elSvg("g");
    g.setAttribute("data-layer", "grid-segments");
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
   * @param {string} [fillColor]
   * @param {string} [groupId]
   * @returns {SVGElement}
   */
  function starFillsToGroup(starFills, fillColor, groupId) {
    var g = elSvg("g");
    g.setAttribute("id", groupId || "layer-star-fills");
    var fill = fillColor || getCanvasBackgroundColor();
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
      p.setAttribute("fill", fill);
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
    if (isCirclesLikeGrid()) {
      return getCirclesLikeGridGeometry().getGridContentBounds(
        lastOctagonsN,
        CANVAS_W,
        CANVAS_H
      );
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
   * Grid-boundary frame in canvas (viewBox) coordinates — same space as margin cells.
   * Each bar's outer edge sits on the frame inner boundary; thickness grows inward only
   * (filled rects, not centered SVG stroke).
   * @returns {{ inset: number, sw: number, y: number, h: number, left: number, right: number }}
   */
  function getGridBoundaryCanvasLayout() {
    var bounds = getGridContentBounds();
    var inset = getBorderStripInnerEdgePx();
    var sw = GRID_BOUNDARY_STROKE_WIDTH;
    var off = getInnerContentOffset();
    var s = getInnerContentScale();
    var y = off.y + bounds.y * s;
    var h = bounds.height * s;
    return {
      inset: inset,
      sw: sw,
      y: y,
      h: h,
      left: inset,
      right: CANVAS_W - inset,
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
    var v = getColorDivisionsSliderValue();
    if (v <= 1) return 0;
    var maxRegions =
      typeof COLOR_DIVISIONS_REGION_COUNT !== "undefined"
        ? COLOR_DIVISIONS_REGION_COUNT
        : 5;
    var sliderMax =
      typeof COLOR_DIVISIONS_MAX !== "undefined" ? COLOR_DIVISIONS_MAX : 5;
    if (v >= sliderMax) return maxRegions;
    return Math.min(maxRegions, v - 1);
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
      : "#303030";
  }

  var BLEND_AREA_COLOR_SLOTS_ORDER = ["H1", "H2", "H3", "H4", "H5"];

  function clearBlendAreaColorOverrides() {
    blendAreaColorOverrides = {};
  }

  function getBlendAreaFillColor(slotId) {
    if (
      slotId &&
      blendAreaColorOverrides[slotId] &&
      normalizeHexColor(blendAreaColorOverrides[slotId], "")
    ) {
      return blendAreaColorOverrides[slotId];
    }
    return sheetColor(slotId);
  }

  function getColorDivisionsFillColor(index) {
    var slot = BLEND_AREA_COLOR_SLOTS_ORDER[index] || "H5";
    return getBlendAreaFillColor(slot);
  }

  function getBlendAreaSlotFallbackHex(slotId) {
    var slots = ["H1", "H2", "H3", "H4", "H5"];
    var index = slots.indexOf(slotId);
    if (index < 0) return "#000000";
    if (
      typeof COLOR_DIVISIONS_FILL_DEFAULTS !== "undefined" &&
      COLOR_DIVISIONS_FILL_DEFAULTS[index]
    ) {
      return COLOR_DIVISIONS_FILL_DEFAULTS[index];
    }
    return typeof COLOR_DIVISIONS_FILL_DEFAULT !== "undefined"
      ? COLOR_DIVISIONS_FILL_DEFAULT
      : "#000000";
  }

  function applyBlendAreaColorFromPipette(slot, hex) {
    if (!slot) return;
    var normalized = normalizeHexColor(hex, getBlendAreaSlotFallbackHex(slot));
    blendAreaColorOverrides[slot] = normalized;
    if (window.SheetPalettes && window.SheetPalettes.setSlotColor) {
      window.SheetPalettes.setSlotColor(slot, normalized);
    }
    var input = document.getElementById("blend-color-" + slot);
    if (input) input.value = normalized;
    updateColorDivisionsLayer();
  }

  function syncBlendAreaSwatchInputs() {
    var inputs = document.querySelectorAll(
      ".sidebar__blend-swatch-input[data-slot]"
    );
    var i;
    for (i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var slot = input.getAttribute("data-slot");
      if (!slot) continue;
      input.value = normalizeHexColor(
        getBlendAreaFillColor(slot),
        getBlendAreaSlotFallbackHex(slot)
      );
    }
  }

  function onBlendAreaSwatchInput(input) {
    var slot = input.getAttribute("data-slot");
    if (!slot) return;
    applyBlendAreaColorFromPipette(slot, input.value);
  }

  function initBlendAreaColorSwatches() {
    syncBlendAreaSwatchInputs();
    var inputs = document.querySelectorAll(
      ".sidebar__blend-swatch-input[data-slot]"
    );
    var i;
    for (i = 0; i < inputs.length; i++) {
      (function (input) {
        if (input.__blendSwatchBound) return;
        input.__blendSwatchBound = true;
        input.addEventListener("input", function () {
          onBlendAreaSwatchInput(input);
        });
        input.addEventListener("change", function () {
          onBlendAreaSwatchInput(input);
        });
      })(inputs[i]);
    }
  }

  function syncColorDivisionsOutput() {
    var out = document.getElementById("color-divisions-out");
    if (out) out.textContent = String(getColorDivisionsSliderValue());
  }

  function rectArea(r) {
    return r.width * r.height;
  }

  function beginColorDivisionGeneration() {
    colorDivisionGenerationRng = createSeededRandom(colorDivisionShuffleSeed >>> 0);
  }

  function colorDivisionRand() {
    if (colorDivisionGenerationRng) return colorDivisionGenerationRng();
    return Math.random();
  }

  function pickWeightedRectIndex(rects) {
    var total = 0;
    var i;
    for (i = 0; i < rects.length; i++) {
      total += rectArea(rects[i]);
    }
    if (total <= 0) return 0;
    var pick = colorDivisionRand() * total;
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
      return colorDivisionRand() < 0.7 ? "vertical" : "horizontal";
    }
    if (aspect < 0.75) {
      return colorDivisionRand() < 0.7 ? "horizontal" : "vertical";
    }
    return colorDivisionRand() < 0.5 ? "vertical" : "horizontal";
  }

  function splitColorDivisionRect(rect, orientation) {
    var ratio = 0.2 + colorDivisionRand() * 0.6;
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
    beginColorDivisionGeneration();
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
    return typeof COLOR_DIVISIONS_REGION_COUNT !== "undefined"
      ? COLOR_DIVISIONS_REGION_COUNT
      : 5;
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
      var pick = candidates[Math.floor(colorDivisionRand() * candidates.length)];
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
        var oj = Math.floor(colorDivisionRand() * (oi + 1));
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

  function getColorDivisionsBlendMode(areaIndex) {
    if (areaIndex === 4) {
      return typeof COLOR_DIVISIONS_BLEND_MODE_H5 !== "undefined"
        ? COLOR_DIVISIONS_BLEND_MODE_H5
        : "color-dodge";
    }
    return typeof COLOR_DIVISIONS_BLEND_MODE !== "undefined"
      ? COLOR_DIVISIONS_BLEND_MODE
      : "exclusion";
  }

  function applyColorDivisionRectPresentation(rect, areaIndex) {
    rect.setAttribute("opacity", "1");
    var isH5 = areaIndex === 4;
    rect.setAttribute(
      "class",
      "color-division-tile" + (isH5 ? " color-division-tile--h5" : "")
    );
    rect.setAttribute(
      "style",
      "mix-blend-mode:" + getColorDivisionsBlendMode(areaIndex)
    );
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
      applyColorDivisionRectPresentation(rect, i);
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
          '" opacity="1" class="color-division-tile' +
          (i === 4 ? " color-division-tile--h5" : "") +
          '" style="mix-blend-mode:' +
          getColorDivisionsBlendMode(i) +
          '"/>'
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
    var min =
      typeof ANXIETY_VERTICAL_STROKE_MIN !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_MIN
        : 0;
    var max =
      typeof ANXIETY_VERTICAL_STROKE_MAX !== "undefined"
        ? ANXIETY_VERTICAL_STROKE_MAX
        : 100;
    setFeelingsStepOutputById(
      "anxiety-vertical-stroke-out",
      getAnxietyVerticalStrokePercent(),
      min,
      max
    );
  }

  /** Geometry only — merge/erase state must not invalidate vertical lines. */
  function buildVerticalGridLayoutSignature() {
    if (isStarGrid()) {
      return (
        "star|" +
        lastOctagonsN +
        "|" +
        CANVAS_W +
        "|" +
        CANVAS_H +
        "|" +
        gridType +
        "|" +
        getInnerScale()
      );
    }
    if (isCirclesLikeGrid()) {
      return (
        (isDiamondsGrid() ? "diamonds|" : "circles|") +
        lastOctagonsN +
        "|" +
        CANVAS_W +
        "|" +
        CANVAS_H
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
    if (getAngerVerticalLengthPercent() === 0) return null;

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
   * Circles grid only: one extra Fear vertical halfway between each adjacent pair.
   * @param {{ x: number, yTop: number, yBottom: number, topTrim: number, bottomTrim: number }[]} lines
   * @param {number} yTop
   * @param {number} yBottom
   * @returns {typeof lines}
   */
  function insertCirclesGridFearMidpointLines(lines, yTop, yBottom) {
    if (lines.length < 2) return lines;
    var result = [];
    var i;
    var midLine;
    var midX;

    for (i = 0; i < lines.length; i++) {
      result.push(lines[i]);
      if (i + 1 < lines.length) {
        midX = Math.round(((lines[i].x + lines[i + 1].x) / 2) * 10000) / 10000;
        midLine = buildRandomizedVerticalLine(midX, yTop, yBottom);
        if (midLine) result.push(midLine);
      }
    }
    return result;
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
      : isCirclesLikeGrid()
        ? getCirclesLikeGridGeometry().buildUniformVerticalLineXs(
            lastOctagonsN,
            CANVAS_W,
            CANVAS_H
          )
        : TopkapiGeometry.collectUniqueGridXCoords(cachedAllSegments);
    var bounds = getGridContentBounds();
    // Fear verticals (anger-vertical-length slider under Fear heading).
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

    if (isCirclesLikeGrid()) {
      lines = insertCirclesGridFearMidpointLines(lines, yTop, yBottom);
    }

    cachedVerticalGridLines = lines;
  }

  function getActiveVerticalGridLayer() {
    if (!designSvg) return null;
    var layerId = isAlternateGrid()
      ? "layer-vertical-grid-overlay"
      : "layer-vertical-grid";
    return designSvg.querySelector("#" + layerId);
  }

  function clearInactiveVerticalGridLayer() {
    if (!designSvg) return;
    var inactiveId = isAlternateGrid()
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
    var fearColor = getFearVerticalStrokeColor();
    var strokeW = getVerticalGridStrokeWidth();
    layer.setAttribute("fill", "none");
    layer.setAttribute("stroke", "none");
    layer.setAttribute("style", "mix-blend-mode:normal");
    for (var i = 0; i < cachedVerticalGridLines.length; i++) {
      var draw = resolveVerticalLineDrawCoords(cachedVerticalGridLines[i]);
      if (!draw) continue;
      var bar = elSvg("rect");
      bar.setAttribute("x", String(draw.x - strokeW / 2));
      bar.setAttribute("y", String(draw.y1));
      bar.setAttribute("width", String(strokeW));
      bar.setAttribute("height", String(Math.max(0, draw.y2 - draw.y1)));
      bar.setAttribute("fill", fearColor);
      bar.setAttribute("stroke", "none");
      bar.setAttribute("style", "mix-blend-mode:normal");
      layer.appendChild(bar);
    }
  }

  function renderVerticalGridLayer() {
    if (!designSvg) return;
    ensureFearVerticalGridMounted();
    clearInactiveVerticalGridLayer();
    var layer = getActiveVerticalGridLayer();
    if (!layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (!isEmotionLayerActive("fear")) return;
    appendVerticalGridLinesToLayer(layer);
  }

  /**
   * @param {string[]} lines
   */
  function pushStructuralCirclesExportLines(lines) {
    if (!isCirclesLikeGrid()) return;
    var shapes = getIntactStructuralCirclesForPattern();
    if (!shapes.length) return;
    if (isDiamondsGrid()) {
      lines.push(
        '<g id="layer-structural-diamonds" fill="none" stroke="' +
          getPatternStrokeColor() +
          '" stroke-width="' +
          getGridStrokeWidth() +
          '" stroke-linejoin="miter">'
      );
      var di;
      var d;
      for (di = 0; di < shapes.length; di++) {
        d = shapes[di];
        lines.push(
          '<polygon points="' +
            d.cx +
            "," +
            (d.cy - d.ry) +
            " " +
            (d.cx + d.rx) +
            "," +
            d.cy +
            " " +
            d.cx +
            "," +
            (d.cy + d.ry) +
            " " +
            (d.cx - d.rx) +
            "," +
            d.cy +
            '"/>'
        );
      }
      lines.push("</g>");
      return;
    }
    lines.push(
      '<g id="layer-structural-circles" fill="none" stroke="' +
        getPatternStrokeColor() +
        '" stroke-width="' +
        getGridStrokeWidth() +
        '">'
    );
    var i;
    var c;
    for (i = 0; i < shapes.length; i++) {
      c = shapes[i];
      lines.push(
        '<ellipse cx="' +
          c.cx +
          '" cy="' +
          c.cy +
          '" rx="' +
          c.rx +
          '" ry="' +
          c.ry +
          '"/>'
      );
    }
    lines.push("</g>");
  }

  /**
   * @param {string[]} lines
   */
  function pushVerticalGridExportLines(lines) {
    if (!isEmotionLayerActive("fear") || !cachedVerticalGridLines.length) {
      return;
    }
    lines.push('<g clip-path="url(#inner-content-clip)">');
    var fearColor = getFearVerticalStrokeColor();
    var strokeW = getVerticalGridStrokeWidth();
    lines.push(
      '<g id="' +
        (isAlternateGrid() ? "layer-vertical-grid-overlay" : "layer-vertical-grid") +
        '" fill="none" stroke="none" style="mix-blend-mode:normal">'
    );
    for (var i = 0; i < cachedVerticalGridLines.length; i++) {
      var draw = resolveVerticalLineDrawCoords(cachedVerticalGridLines[i]);
      if (!draw) continue;
      lines.push(
        '<rect x="' +
          (draw.x - strokeW / 2) +
          '" y="' +
          draw.y1 +
          '" width="' +
          strokeW +
          '" height="' +
          Math.max(0, draw.y2 - draw.y1) +
          '" fill="' +
          fearColor +
          '" stroke="none" style="mix-blend-mode:normal"/>'
      );
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  /**
   * @param {string[]} lines
   */
  function pushAngerTriangleExportLines(lines) {
    if (!supportsAngerDiamondTriangles()) return;
    var triangles = getAngerTriangleDiamonds();
    if (!triangles.length) return;
    var fillColor = getAngerTriangleFillColor();
    lines.push('<g clip-path="url(#inner-content-clip)">');
    lines.push('<g id="layer-anger-diamond-triangles">');
    for (var i = 0; i < triangles.length; i++) {
      var dm = triangles[i];
      lines.push(
        '<polygon points="' +
          angerTrianglePointsAttr(dm.points) +
          '" fill="' +
          fillColor +
          '" stroke="none"/>'
      );
    }
    lines.push("</g>");
    lines.push("</g>");
  }

  function renderPatternAndVerticalLayers() {
    syncVerticalGridLines(false);
    if (isAlternateGrid()) {
      renderBackgroundLayer();
    }
    renderVerticalGridLayer();
    renderPatternLayer();
    renderGridMaskLayer("renderPatternAndVerticalLayers");
    renderAutoMergeFillsLayer();
    applyMergeReveal();
  }

  /**
   * @param {SVGElement} g
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} fill
   */
  function appendGridBoundaryBar(g, x, y, w, h, fill) {
    var rect = elSvg("rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(w));
    rect.setAttribute("height", String(h));
    rect.setAttribute("fill", fill);
    rect.setAttribute("stroke", "none");
    rect.setAttribute("shape-rendering", "crispEdges");
    g.appendChild(rect);
  }

  function gridBoundaryToGroup() {
    var L = getGridBoundaryCanvasLayout();
    var g = elSvg("g");
    var sw = L.sw;
    var fill = getGridBoundaryStrokeColor();
    var innerW = L.right - L.left - 2 * sw;
    g.setAttribute("id", "grid-boundary");
    appendGridBoundaryBar(g, L.left, L.y, sw, L.h, fill);
    appendGridBoundaryBar(g, L.right - sw, L.y, sw, L.h, fill);
    if (innerW > 0) {
      appendGridBoundaryBar(g, L.left + sw, L.y, innerW, sw, fill);
      appendGridBoundaryBar(g, L.left + sw, L.y + L.h - sw, innerW, sw, fill);
    }
    return g;
  }

  function createGridBoundaryLayer() {
    var layer = elSvg("g");
    layer.setAttribute("id", "layer-grid-boundary");
    layer.appendChild(gridBoundaryToGroup());
    return layer;
  }

  function updateGridBoundaryRect() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-grid-boundary");
    if (!layer) return;
    var existing = layer.querySelector("#grid-boundary");
    if (existing) layer.removeChild(existing);
    layer.appendChild(gridBoundaryToGroup());
  }

  function ensureGridBoundaryLayerOnTop() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-grid-boundary");
    if (!layer) return;
    var blendRoot = designSvg.querySelector("#color-divisions-blend-root");
    var overlay = designSvg.querySelector("#layer-border-divisions-overlay");
    if (blendRoot && overlay && overlay.parentNode === blendRoot) {
      blendRoot.insertBefore(layer, overlay);
    }
    var anchor = designSvg.querySelector("#layer-edge-brown-bars");
    if (anchor && anchor.parentNode === designSvg && layer.parentNode === designSvg) {
      designSvg.insertBefore(layer, anchor);
    }
  }

  /**
   * @param {string[]} lines
   * @param {{ inset: number, sw: number, y: number, h: number, left: number, right: number }} layout
   */
  function pushGridBoundaryExportBars(lines, layout) {
    var sw = layout.sw;
    var fill = getGridBoundaryStrokeColor();
    var innerW = layout.right - layout.left - 2 * sw;

    function pushBar(x, y, w, h) {
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
          fill +
          '" stroke="none" shape-rendering="crispEdges"/>'
      );
    }

    pushBar(layout.left, layout.y, sw, layout.h);
    pushBar(layout.right - sw, layout.y, sw, layout.h);
    if (innerW > 0) {
      pushBar(layout.left + sw, layout.y, innerW, sw);
      pushBar(layout.left + sw, layout.y + layout.h - sw, innerW, sw);
    }
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
    layer.appendChild(frameInsetOverlayToGroup());
    applyFrameInsetOverlayVisibility();
    return layer;
  }

  function updateFrameInsetOverlayLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-frame-inset-overlay");
    if (!layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    layer.appendChild(frameInsetOverlayToGroup());
    applyFrameInsetOverlayVisibility();
  }

  function pushFrameInsetOverlayExportLines(lines, options) {
    var nestedInInnerContent =
      options && options.nestedInInnerContent === true;
    var segments = getGridFrameInsetOverlaySegments();
    var rects = getGridFrameInsetOverlayCapRects();
    var ellipses = getGridFrameInsetOverlayCapEllipses();
    var stroke = getPatternStrokeColor();
    if (nestedInInnerContent) {
      lines.push('<g id="layer-frame-inset-overlay">');
    } else {
      lines.push(
        '<g id="layer-frame-inset-overlay" transform="' +
          getInnerContentTransformAttr() +
          '">'
      );
    }
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
    return true;
  }

  function isBodyAutonomyOutsideChecked() {
    return true;
  }

  /**
   * ViewBox Y of the grid-boundary outer edge on top and bottom.
   * @returns {{ top: number, bottom: number }}
   */
  function getBorderDivisionFrameY() {
    var bounds = getGridContentBounds();
    var off = getInnerContentOffset();
    var s = getInnerContentScale();
    return {
      top: off.y + bounds.y * s,
      bottom: off.y + (bounds.y + bounds.height) * s,
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
   * Horizontal division Y in left/right margin strips (frame + interior rows).
   * @returns {number[]}
   */
  function getBorderDivisionHorizontalYPositions() {
    var divY = getLeftRightBorderDivisionYBounds();
    var ys = [divY.top, divY.bottom];
    var interior = getLeftRightBorderInteriorYPositions();
    var i;
    for (i = 0; i < interior.length; i++) ys.push(interior[i]);
    return ys;
  }

  /**
   * Interior column-divider × horizontal crossings (col 1↔2, 2↔3, …).
   * Uses frame column dividers at x = c·b (c = 1 … cols−1) on both sides.
   * @returns {{ cx: number, cy: number }[]}
   */
  function collectBorderFrameGridJunctionPoints() {
    var b = getCanvasBorderPx();
    var cols = getBorderSideThicknessColumns();
    if (cols < 2) return [];

    var extra = Math.max(0, cols - 1);
    var ys = getBorderDivisionHorizontalYPositions();
    var points = [];
    var seen = {};
    var j;
    var c;
    var t;
    var x;

    function add(px, py) {
      var key = px.toFixed(3) + "," + py.toFixed(3);
      if (seen[key]) return;
      seen[key] = true;
      points.push({ cx: px, cy: py });
    }

    for (c = 1; c < cols; c++) {
      x = c * b;
      for (j = 0; j < ys.length; j++) {
        add(x, ys[j]);
        add(CANVAS_W - x, ys[j]);
      }
    }

    if (extra > 0) {
      for (c = 1; c < cols; c++) {
        x = c * b;
        for (t = 1; t <= extra; t++) {
          var bandYs = [
            t * b,
            (t + 1) * b,
            CANVAS_H - (t + 1) * b,
            CANVAS_H - t * b,
          ];
          for (j = 0; j < bandYs.length; j++) {
            add(x, bandYs[j]);
            add(CANVAS_W - x, bandYs[j]);
          }
        }
      }
    }

    return points;
  }

  function getBorderDivisionJunctionCircleRadius() {
    var diameter =
      typeof BORDER_DIVISION_JUNCTION_CIRCLE_DIAMETER_PX !== "undefined"
        ? BORDER_DIVISION_JUNCTION_CIRCLE_DIAMETER_PX
        : 5;
    return diameter / 2;
  }

  /**
   * @param {SVGElement} g
   */
  function appendBorderDivisionJunctionCircles(g) {
    var points = collectBorderFrameGridJunctionPoints();
    if (!points.length) return;

    var fill = getPatternStrokeColor();
    var r = getBorderDivisionJunctionCircleRadius();
    var dotG = elSvg("g");
    dotG.setAttribute("class", "border-division-junction-dots");
    dotG.setAttribute("fill", fill);
    dotG.setAttribute("stroke", "none");

    for (var i = 0; i < points.length; i++) {
      var circle = elSvg("circle");
      circle.setAttribute("cx", String(points[i].cx));
      circle.setAttribute("cy", String(points[i].cy));
      circle.setAttribute("r", String(r));
      dotG.appendChild(circle);
    }
    g.appendChild(dotG);
  }

  /**
   * @param {string[]} lines
   */
  function pushBorderDivisionJunctionCirclesExport(lines) {
    var points = collectBorderFrameGridJunctionPoints();
    if (!points.length) return;

    var fill = getPatternStrokeColor();
    var r = getBorderDivisionJunctionCircleRadius();
    var i;
    lines.push(
      '<g class="border-division-junction-dots" fill="' +
        fill +
        '" stroke="none">'
    );
    for (i = 0; i < points.length; i++) {
      lines.push(
        '<circle cx="' +
          points[i].cx +
          '" cy="' +
          points[i].cy +
          '" r="' +
          r +
          '"/>'
      );
    }
    lines.push("</g>");
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
   * Rhombus fill above cell background — C7 (grey row), C8 (beige row) in palette sheet.
   * @param {"grey"|"beige"} cellType
   * @returns {string}
   */
  function getBorderSideRhombusFillForCellType(cellType) {
    return sheetColor(cellType === "beige" ? "C8" : "C7");
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
   * Seeded random dots inside a margin cell (same Poisson-style spacing as fan triangles).
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} seed
   * @returns {{ dots: { x: number, y: number }[], radius: number }}
   */
  function generateSeededStippleDotsInRect(x, y, w, h, seed) {
    var radius = getBorderSideEmptyCellStippleDotRadius();
    var minDist = getBorderSideEmptyCellStippleMinDotDistance();
    var minDistSq = minDist * minDist;
    var padding = radius + 1;
    var area = Math.max(1, w * h);
    var targetCount = Math.max(2, Math.round(area / (minDist * minDist * 0.65)));
    var rng = createSeededRandom(seed);
    var dots = [];
    var maxAttempts = targetCount * 50;
    var attempts = 0;
    var dotX;
    var dotY;
    var ok;
    var di;
    var dx;
    var dy;

    while (dots.length < targetCount && attempts < maxAttempts) {
      attempts++;
      dotX = x - padding + rng() * (w + padding * 2);
      dotY = y - padding + rng() * (h + padding * 2);
      ok = true;
      for (di = 0; di < dots.length; di++) {
        dx = dotX - dots[di].x;
        dy = dotY - dots[di].y;
        if (dx * dx + dy * dy < minDistSq) {
          ok = false;
          break;
        }
      }
      if (ok) dots.push({ x: dotX, y: dotY });
    }

    return { dots: dots, radius: radius };
  }

  /**
   * @param {number} colIndex
   * @param {number} rowIndex
   * @param {number} x
   * @returns {number}
   */
  function borderSideEmptyCellStippleSeed(colIndex, rowIndex, x) {
    return hashFanMiddleBandSeed(
      "border-empty-" + colIndex + "-" + rowIndex + "-" + x
    );
  }

  /**
   * Stipple dots in one whitened margin cell (color-fade empty cells only).
   * @param {SVGElement} g
   * @param {number} x
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   * @param {number} colIndex
   * @param {number} rowIndex
   */
  function appendBorderSideEmptyCellStippleAtX(
    g,
    x,
    cellW,
    yTop,
    yBottom,
    colIndex,
    rowIndex
  ) {
    if (!isBorderSideCellWhitened(colIndex, rowIndex)) return;

    var h = yBottom - yTop;
    var clipId =
      "border-empty-stipple-clip-" + colIndex + "-" + rowIndex + "-" + x;
    var clip = elSvg("clipPath");
    clip.setAttribute("id", clipId);
    var clipRect = elSvg("rect");
    clipRect.setAttribute("x", String(x));
    clipRect.setAttribute("y", String(yTop));
    clipRect.setAttribute("width", String(cellW));
    clipRect.setAttribute("height", String(h));
    clip.appendChild(clipRect);
    g.appendChild(clip);

    var seed = borderSideEmptyCellStippleSeed(colIndex, rowIndex, x);
    var stipple = generateSeededStippleDotsInRect(x, yTop, cellW, h, seed);
    var dotColor = getBorderSideEmptyCellStippleColor();
    var dotGroup = elSvg("g");
    dotGroup.setAttribute("class", "border-empty-cell-stipple");
    dotGroup.setAttribute("clip-path", "url(#" + clipId + ")");
    dotGroup.setAttribute("fill", dotColor);
    dotGroup.setAttribute("stroke", "none");

    var ci;
    for (ci = 0; ci < stipple.dots.length; ci++) {
      var circle = elSvg("circle");
      circle.setAttribute("cx", String(stipple.dots[ci].x));
      circle.setAttribute("cy", String(stipple.dots[ci].y));
      circle.setAttribute("r", String(stipple.radius));
      dotGroup.appendChild(circle);
    }
    g.appendChild(dotGroup);
  }

  /**
   * @param {string[]} lines
   * @param {number} x
   * @param {number} cellW
   * @param {number} yTop
   * @param {number} yBottom
   * @param {number} colIndex
   * @param {number} rowIndex
   */
  function pushBorderSideEmptyCellStippleAtXExport(
    lines,
    x,
    cellW,
    yTop,
    yBottom,
    colIndex,
    rowIndex
  ) {
    if (!isBorderSideCellWhitened(colIndex, rowIndex)) return;

    var h = yBottom - yTop;
    var clipId =
      "border-empty-stipple-clip-" +
      colIndex +
      "-" +
      rowIndex +
      "-" +
      x +
      "-export";
    var dotColor = getBorderSideEmptyCellStippleColor();
    var seed = borderSideEmptyCellStippleSeed(colIndex, rowIndex, x);
    var stipple = generateSeededStippleDotsInRect(x, yTop, cellW, h, seed);
    var ci;

    lines.push('<clipPath id="' + clipId + '">');
    lines.push(
      '<rect x="' +
        x +
        '" y="' +
        yTop +
        '" width="' +
        cellW +
        '" height="' +
        h +
        '"/>'
    );
    lines.push("</clipPath>");
    lines.push(
      '<g class="border-empty-cell-stipple" clip-path="url(#' +
        clipId +
        ')" fill="' +
        dotColor +
        '" stroke="none">'
    );
    for (ci = 0; ci < stipple.dots.length; ci++) {
      lines.push(
        '<circle cx="' +
          stipple.dots[ci].x +
          '" cy="' +
          stipple.dots[ci].y +
          '" r="' +
          stipple.radius +
          '"/>'
      );
    }
    lines.push("</g>");
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
    var stroke = getHelplessnessStrokeColor();
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
    var stroke = getHelplessnessStrokeColor();
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
    rect.setAttribute("stroke", "none");
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
    poly.setAttribute("stroke", "none");
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
        '<polygon points="' +
          attr.join(" ") +
          '" fill="' +
          fill +
          '" stroke="none"/>'
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
          getBorderSideColorFadeFillColor()
        );
        appendBorderSideSolidCellRect(
          g,
          rightX,
          yTop,
          b,
          h,
          getBorderSideColorFadeFillColor()
        );
        appendBorderSideEmptyCellStippleAtX(g, 0, b, yTop, yBottom, 0, j);
        appendBorderSideEmptyCellStippleAtX(
          g,
          rightX,
          b,
          yTop,
          yBottom,
          0,
          j
        );
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
   * Internal X / rhombus strokes: whitened cells always; otherwise only when no fills (outline-only mode).
   * Colored cells keep division lines between rows but no inner triangle/rhombus outlines.
   * @param {SVGElement} g
   */
  function appendLeftRightBorderCellDiagonalsToGroup(g) {
    var home = isBodyAutonomyHomeChecked();
    var outside = isBodyAutonomyOutsideChecked();
    var outlineOnly = !home && !outside;
    if (!outlineOnly && getBorderSideWhiteFillTargetPercent() <= 0) return;

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

      if (outlineOnly) {
        if (cellType === "grey" || cellType === "beige") continue;
        appendBorderSideCellDiagonals(g, b, rightX, yTop, yBottom);
      }
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

    function appendOverlayCellBase(x, y, w, h, fill) {
      __overlayBaseRects++;
      var rect = elSvg("rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", String(h));
      rect.setAttribute(
        "fill",
        fill || getCanvasBackgroundColor()
      );
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

        // Ensure overlay cells match the margin background (no grid bleed-through).
        var overlayBaseFill = isBorderSideCellWhitened(c, j)
          ? getBorderSideColorFadeFillColor()
          : getCanvasBackgroundColor();
        appendOverlayCellBase(leftX, yTop, b, h, overlayBaseFill);
        appendOverlayCellBase(rightX, yTop, b, h, overlayBaseFill);

        if (isBorderSideCellWhitened(c, j)) {
          appendBorderSideEmptyCellStippleAtX(
            g,
            leftX,
            b,
            yTop,
            yBottom,
            c,
            j
          );
          appendBorderSideEmptyCellStippleAtX(
            g,
            rightX,
            b,
            yTop,
            yBottom,
            c,
            j
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
          if (outlineOnly) {
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
            if (outlineOnly) appendBorderSideCellDiagonalsAtX(g, x, b, y0, y1);
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
    appendBorderDivisionJunctionCircles(g);
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
    var canvasFill = getCanvasBackgroundColor();
    var colorFadeFill = getBorderSideColorFadeFillColor();
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

    function pushOverlayCellBase(x, y, w, h, fill) {
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
          (fill || canvasFill) +
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

        var overlayBaseFillExport = isBorderSideCellWhitened(c, j)
          ? colorFadeFill
          : canvasFill;
        pushOverlayCellBase(leftX, yTop, b, h, overlayBaseFillExport);
        pushOverlayCellBase(rightX, yTop, b, h, overlayBaseFillExport);

        if (isBorderSideCellWhitened(c, j)) {
          pushBorderSideEmptyCellStippleAtXExport(
            lines,
            leftX,
            b,
            yTop,
            yBottom,
            c,
            j
          );
          pushBorderSideEmptyCellStippleAtXExport(
            lines,
            rightX,
            b,
            yTop,
            yBottom,
            c,
            j
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
            if (outlineOnly) {
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

    pushBorderDivisionJunctionCirclesExport(lines);
    lines.push("</g>");
  }

  function createBorderDivisionOverlayGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "layer-border-divisions-overlay");
    appendBorderDivisionOverlayLayersToGroup(g);
    return g;
  }

  function ensureBorderDivisionOverlayOnTop() {
    if (!designSvg) return;
    var overlay = designSvg.querySelector("#layer-border-divisions-overlay");
    var blendRoot = designSvg.querySelector("#color-divisions-blend-root");
    if (!overlay || !blendRoot) return;
    blendRoot.appendChild(overlay);
  }

  function updateBorderDivisionOverlay() {
    if (!designSvg) return;
    syncBorderSideWhiteCells(false);
    var g = designSvg.querySelector("#layer-border-divisions-overlay");
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    appendBorderDivisionOverlayLayersToGroup(g);
    ensureBorderDivisionOverlayOnTop();
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
    if (getBorderSideThicknessColumns() <= 1) {
      appendBorderDivisionJunctionCircles(g);
    }
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
    return normalizeHexColor(
      sheetColor("G5"),
      typeof CANVAS_EDGE_SERIAL_FILL !== "undefined"
        ? CANVAS_EDGE_SERIAL_FILL
        : "#3c06a7"
    );
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

  /** Map tag/ paths and other aliases to LABEL_BAR_SVG_EMBEDDED keys. */
  function resolveLabelBarSvgEmbeddedKey(filename) {
    var embedded =
      typeof window !== "undefined" ? window.LABEL_BAR_SVG_EMBEDDED : null;
    if (!filename || !embedded) return null;
    if (embedded[filename]) return filename;
    var tagAliases = {
      "tag/lion.svg": "lion.svg",
      "tag/tag01.2.svg": "tag01.2.svg",
      "tag/tag02.svg": "tag02.svg",
      "tag/tag03.svg": "tag03.svg",
      "tag/tag04.svg": "tag04.svg",
      "tag/tag05.2.svg": "tag05.2.svg",
      "tag/reshet.svg": "reshet.svg",
    };
    if (tagAliases[filename] && embedded[tagAliases[filename]]) {
      return tagAliases[filename];
    }
    var slash = filename.lastIndexOf("/");
    if (slash >= 0) {
      var dir = filename.slice(0, slash);
      var base = filename.slice(slash + 1);
      // home/ icons are distinct from root svg/ assets — do not alias by basename.
      if (dir !== "home" && embedded[base]) return base;
    }
    return null;
  }

  function primeLabelBarSvgCacheFromEmbedded(filename) {
    if (!filename) return false;
    if (labelBarSvgCache[filename]) return true;
    var embeddedKey = resolveLabelBarSvgEmbeddedKey(filename);
    if (!embeddedKey) return false;
    var embedded =
      typeof window !== "undefined" &&
      window.LABEL_BAR_SVG_EMBEDDED &&
      window.LABEL_BAR_SVG_EMBEDDED[embeddedKey];
    if (!embedded) return false;
    cacheLabelBarSvgAsset(
      filename,
      parseLabelBarSvgMarkup(
        '<svg xmlns="http://www.w3.org/2000/svg">' + embedded + "</svg>"
      )
    );
    return true;
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

  function getLabelBarIconTintFilterId() {
    return typeof LABEL_BAR_ICON_TINT_FILTER_ID !== "undefined"
      ? LABEL_BAR_ICON_TINT_FILTER_ID
      : "label-bar-icon-tint-filter";
  }

  function getLabelBarIconTintFilterRef() {
    return "url(#" + getLabelBarIconTintFilterId() + ")";
  }

  /**
   * Exact G4 tint for white SVG icons loaded via <image> (replaces CSS filter approximation).
   * @param {SVGElement} defs
   */
  function ensureLabelBarIconTintFilter(defs) {
    var filterId;
    var existing;
    var filter;
    var flood;
    var composite;
    var merge;
    var mergeNode;
    if (!defs) return;
    filterId = getLabelBarIconTintFilterId();
    existing = defs.querySelector("#" + filterId);
    if (existing) defs.removeChild(existing);

    filter = elSvg("filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.setAttribute("x", "-20%");
    filter.setAttribute("y", "-20%");
    filter.setAttribute("width", "140%");
    filter.setAttribute("height", "140%");

    flood = elSvg("feFlood");
    flood.setAttribute("flood-color", getLabelBarContentColor());
    flood.setAttribute("result", "flood");

    composite = elSvg("feComposite");
    composite.setAttribute("in", "flood");
    composite.setAttribute("in2", "SourceAlpha");
    composite.setAttribute("operator", "in");
    composite.setAttribute("result", "color");

    merge = elSvg("feMerge");
    mergeNode = elSvg("feMergeNode");
    mergeNode.setAttribute("in", "color");
    merge.appendChild(mergeNode);

    filter.appendChild(flood);
    filter.appendChild(composite);
    filter.appendChild(merge);
    defs.appendChild(filter);
  }

  /**
   * @param {string[]} lines
   */
  function pushLabelBarIconTintFilterDefExport(lines) {
    lines.push(
      '<filter id="' +
        getLabelBarIconTintFilterId() +
        '" color-interpolation-filters="sRGB">' +
        '<feFlood flood-color="' +
        getLabelBarContentColor() +
        '" result="flood"/>' +
        '<feComposite in="flood" in2="SourceAlpha" operator="in" result="color"/>' +
        '<feMerge><feMergeNode in="color"/></feMerge>' +
        "</filter>"
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
    var fillLower;
    var iconFill = normalizeHexColor(
      tintColor || getLabelBarContentColor(),
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
      fillLower = fill ? fill.trim().toLowerCase() : "";
      if (fillLower !== "none" && fillLower !== "transparent") {
        shapes[i].setAttribute("fill", iconFill);
      } else if (shapes[i].hasAttribute("class")) {
        shapes[i].setAttribute("fill", iconFill);
      }
      if (stroke && stroke !== "none" && stroke !== "transparent") {
        shapes[i].setAttribute("stroke", iconFill);
      }
    }
  }

  function buildLabelBarSvgTintedInnerMarkupFromEmbedded(file) {
    if (labelBarSvgUsesNativeColors(file)) return "";
    var embeddedKey = resolveLabelBarSvgEmbeddedKey(file);
    if (!embeddedKey) return "";
    var embedded =
      typeof window !== "undefined" &&
      window.LABEL_BAR_SVG_EMBEDDED &&
      window.LABEL_BAR_SVG_EMBEDDED[embeddedKey];
    if (!embedded) return "";
    var tintColor = getLabelBarContentColor();
    var parser = new DOMParser();
    var doc = parser.parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg">' + embedded + "</svg>",
      "image/svg+xml"
    );
    applyLabelBarSvgTintFill(doc.documentElement, tintColor);
    return doc.documentElement.innerHTML;
  }

  function getLabelBarSvgTintedInnerMarkup(file) {
    if (labelBarSvgUsesNativeColors(file)) return "";
    primeLabelBarSvgCacheFromEmbedded(file);
    var cached = labelBarSvgCache[file];
    if (!cached) return buildLabelBarSvgTintedInnerMarkupFromEmbedded(file);
    var tintColor = getLabelBarContentColor();
    if (
      cached.tintedInnerMarkup &&
      normalizeHexColor(cached.tintedColor, "") === tintColor
    ) {
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
   * @param {string} href
   * @returns {Promise<string>}
   */
  function fetchLabelBarSvgMarkup(href) {
    return fetch(href)
      .then(function (res) {
        if (!res.ok) throw new Error("svg fetch failed");
        return res.text();
      })
      .catch(function () {
        return new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", href, true);
          xhr.onload = function () {
            if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
              resolve(xhr.responseText);
              return;
            }
            reject(new Error("xhr failed"));
          };
          xhr.onerror = function () {
            reject(new Error("xhr error"));
          };
          xhr.send();
        });
      });
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
    labelBarSvgLoadPromises[filename] = fetchLabelBarSvgMarkup(
      getLabelBarSvgHref(filename)
    )
      .then(function (markup) {
        return cacheLabelBarSvgAsset(filename, parseLabelBarSvgMarkup(markup));
      })
      .catch(function () {
        delete labelBarSvgLoadPromises[filename];
        if (primeLabelBarSvgCacheFromEmbedded(filename)) {
          return labelBarSvgCache[filename];
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
      y: getBottomBrownBarCanvasY(segment.start, layout),
      width: layout.width,
      height: segment.height,
    };
  }

  /**
   * Copy bottom-bar content bounds onto the top bar (same relative position on the bar).
   * @param {ReturnType<typeof getLabelBarContentArea>} bottomArea
   * @param {{ x: number, y: number, width: number, height: number }} bottomLayout
   * @param {{ x: number, y: number, width: number, height: number }} topLayout
   * @returns {ReturnType<typeof getLabelBarContentArea>}
   */
  function translateLabelBarContentAreaFromBottom(bottomArea, bottomLayout, topLayout) {
    var relY = bottomArea.y - bottomLayout.y;
    return {
      x: bottomArea.x,
      y: topLayout.y + relY,
      width: bottomArea.width,
      height: bottomArea.height,
      innerWidth: bottomArea.innerWidth,
      hInset: bottomArea.hInset,
      vInset: bottomArea.vInset,
    };
  }

  /**
   * Canonical row content area on the bottom label bar.
   * @param {{ x: number, y: number, width: number, height: number }} bottomLayout
   * @param {number} segmentIndex
   * @returns {ReturnType<typeof getLabelBarContentArea>}
   */
  function getLabelBarBottomInnerSegmentContentArea(bottomLayout, segmentIndex) {
    var vInset = getLabelBarVerticalInsetPx();
    var halfGap = getLabelBarAdjacentRowContentGapPx() / 2;
    var shift = getLabelBarContentShiftTowardGridPx();
    var topInset = vInset;
    var bottomInset = vInset;

    if (segmentIndex === 0) {
      topInset = vInset + shift;
      bottomInset = halfGap - shift;
    } else if (segmentIndex === 1) {
      topInset = halfGap + shift;
      bottomInset = vInset - shift;
    }

    return getLabelBarContentArea(
      getLabelBarSegmentCanvasBounds("bottom", bottomLayout, segmentIndex),
      topInset,
      bottomInset
    );
  }

  /**
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @param {number} segmentIndex
   * @returns {ReturnType<typeof getLabelBarContentArea>}
   */
  function getLabelBarInnerSegmentContentArea(edge, layout, segmentIndex) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var bottomArea = getLabelBarBottomInnerSegmentContentArea(
      bottomLayout,
      segmentIndex
    );
    if (edge === "bottom") {
      return bottomArea;
    }
    return translateLabelBarContentAreaFromBottom(bottomArea, bottomLayout, layout);
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
      y: getBottomBrownBarCanvasY(span.start, layout),
      width: layout.width,
      height: span.height,
    };
  }

  /**
   * Lion end-cap canvas bounds (2 row segments); render band is aligned to row visual span.
   * @param {"top"|"bottom"} edge
   * @param {{ x: number, y: number, width: number, height: number }} layout
   * @returns {ReturnType<typeof getLabelBarContentArea>}
   */
  function getLabelBarEndCapContentArea(edge, layout) {
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var bottomArea = getLabelBarContentArea(
      getLabelBarEndCapCanvasBounds("bottom", bottomLayout)
    );
    if (edge === "bottom") {
      return bottomArea;
    }
    return translateLabelBarContentAreaFromBottom(bottomArea, bottomLayout, layout);
  }

  function getLabelBarContentScale() {
    return typeof LABEL_BAR_CONTENT_SCALE !== "undefined"
      ? LABEL_BAR_CONTENT_SCALE
      : 1;
  }

  function getLabelBarTextHeightRatio() {
    return typeof LABEL_BAR_TEXT_FONT_HEIGHT_RATIO !== "undefined"
      ? LABEL_BAR_TEXT_FONT_HEIGHT_RATIO
      : 1;
  }

  function getLabelBarTextTouchOverscale() {
    return typeof LABEL_BAR_TEXT_TOUCH_OVERSCALE !== "undefined"
      ? LABEL_BAR_TEXT_TOUCH_OVERSCALE
      : 1;
  }

  function getLabelBarSvgLegacyVerticalInsetPx() {
    return typeof LABEL_BAR_SVG_LEGACY_VERTICAL_INSET_PX !== "undefined"
      ? LABEL_BAR_SVG_LEGACY_VERTICAL_INSET_PX
      : 10;
  }

  function getLabelBarSvgRowTargetHeight(contentAreaHeight) {
    return Math.max(
      1,
      (contentAreaHeight - getLabelBarSvgLegacyVerticalInsetPx()) *
        getLabelBarContentScale()
    );
  }

  function getLabelBarSvgEndCapTargetHeight(contentAreaHeight) {
    return Math.max(
      1,
      (contentAreaHeight - getLabelBarSvgLegacyVerticalInsetPx() * 2) *
        getLabelBarContentScale()
    );
  }

  /**
   * Vertical envelope of row SVG symbols only (row1 top → row2 bottom).
   * Text may overscale slightly; end caps follow the symbol bands to stay inside rows.
   * @param {ReturnType<typeof getLabelBarContentArea>} row1Area
   * @param {ReturnType<typeof getLabelBarContentArea>} row2Area
   * @returns {{ top: number, bottom: number, height: number }}
   */
  function getLabelBarTwoRowVisualSpan(row1Area, row2Area) {
    var row1SvgH = getLabelBarSvgRowTargetHeight(row1Area.height);
    var row2SvgH = getLabelBarSvgRowTargetHeight(row2Area.height);
    var top = getLabelBarSvgPlacementY(row1Area, row1SvgH);
    var bottom = getLabelBarSvgPlacementY(row2Area, row2SvgH) + row2SvgH;
    return {
      top: top,
      bottom: bottom,
      height: Math.max(1, bottom - top),
    };
  }

  function getLabelBarEndCapRenderArea(endCapArea, row1Area, row2Area) {
    var span = getLabelBarTwoRowVisualSpan(row1Area, row2Area);
    return {
      x: endCapArea.x,
      y: span.top,
      width: endCapArea.width,
      height: span.height,
      innerWidth: endCapArea.innerWidth,
      hInset: endCapArea.hInset,
      vInset: endCapArea.vInset,
    };
  }

  function getLabelBarSvgPlacementY(area, specHeight) {
    return area.y + (area.height - specHeight) / 2;
  }

  function applyLabelBarTextAttrs(text, fontSize) {
    text.setAttribute("fill", getLabelBarContentColor());
    text.setAttribute("font-family", getBrownBarBannerFontFamily());
    text.setAttribute("font-weight", "700");
    text.setAttribute("font-size", String(fontSize));
    text.setAttribute("letter-spacing", String(getBrownBarBannerLetterSpacing()));
    text.setAttribute("text-anchor", "start");
    /** Middle baseline; y is set so glyph bbox center matches the row midline. */
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

  function getLabelBarTextY(area, flipVertical) {
    var offset = getLabelBarTextYOffsetPx();
    if (flipVertical) {
      offset = -offset;
    }
    return getLabelBarBandCenterY(area) + offset;
  }

  /** Top bar: entire label group is rotated 180° (see createLabelBarRowGroup). */
  function labelBarEdgeUsesGroupRotate180(edge) {
    return edge === "top";
  }

  function getLabelBarLayoutRotate180Center(layout) {
    return {
      cx: layout.x + layout.width / 2,
      cy: layout.y + layout.height / 2,
    };
  }

  /**
   * @param {{ spec: object, x: number }} placement
   * @param {ReturnType<typeof getLabelBarContentArea>} contentArea
   * @returns {{ cx: number, cy: number }}
   */
  function getLabelBarPlacementRotate180Center(placement, contentArea, flipVertical) {
    var spec = placement.spec;
    var cx = placement.x + spec.width / 2;
    var cy;
    if (spec.type === "text") {
      cy = getLabelBarBandCenterY(contentArea);
    } else if (spec.type === "coordinatesBadge") {
      cy = spec.rectY + spec.height / 2;
    } else if (spec.type === "square") {
      cy = getLabelBarSquareSepY(contentArea) + spec.height / 2;
    } else {
      cy =
        getLabelBarSvgPlacementY(contentArea, spec.height) + spec.height / 2;
    }
    return { cx: cx, cy: cy };
  }

  /**
   * SVG transform: 180° rotation around a point (position unchanged).
   * @param {number} cx
   * @param {number} cy
   * @returns {string}
   */
  function getLabelBarRotate180Transform(cx, cy) {
    return (
      "translate(" + cx + "," + cy + ") scale(-1,-1) translate(" + -cx + "," + -cy + ")"
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
   * Scale label text large, then center its glyph bbox on the row midline (matches SVG icons).
   * @param {string} text
   * @param {number} maxHeight area.height (same value passed to buildLabelBarSvgSpec)
   * @param {number} bandTopY area.y (same origin as SVG image y)
   * @param {number} bandBottomY area.y + area.height
   * @returns {{ fontSize: number, width: number, height: number, textY: number }}
   */
  function fitLabelBarTextMetrics(text, maxHeight, bandTopY, bandBottomY) {
    var cellH = Math.max(1, maxHeight);
    var bandHeight =
      typeof bandTopY === "number" && typeof bandBottomY === "number"
        ? Math.max(1, bandBottomY - bandTopY)
        : cellH;
    var targetH = Math.max(1, bandHeight * getLabelBarContentScale());
    var topY = typeof bandTopY === "number" ? bandTopY : 0;
    var bandCenterY = topY + bandHeight / 2;
    var ratio = getLabelBarTextHeightRatio();
    var fontSize = Math.max(1, targetH * ratio);
    var measured;
    var bbox;
    var textY = bandCenterY;

    if (!text) {
      return {
        fontSize: fontSize,
        width: cellH * 0.5,
        height: targetH,
        textY: textY,
      };
    }

    measured = measureLabelBarTextAtCellSize(text, fontSize);
    bbox = measured.bbox;
    if (bbox && bbox.height > 0) {
      fontSize = Math.max(1, (fontSize * targetH) / bbox.height);
      fontSize = Math.max(1, fontSize * getLabelBarTextTouchOverscale());
      measured = measureLabelBarTextAtCellSize(text, fontSize);
      bbox = measured.bbox;
    }
    if (bbox) {
      textY = bandCenterY - (bbox.y + bbox.height / 2);
    }

    return {
      fontSize: fontSize,
      width: measured.width,
      height: targetH,
      textY: textY,
    };
  }

  function getLabelBarKnockoutBadgeTextYOffsetPx() {
    return typeof LABEL_BAR_KNOCKOUT_BADGE_TEXT_Y_OFFSET_PX !== "undefined"
      ? LABEL_BAR_KNOCKOUT_BADGE_TEXT_Y_OFFSET_PX
      : 1;
  }

  function getLabelBarTextPlacementY(placement, contentArea, flipVertical) {
    var spec = placement && placement.spec;
    var offset;
    var badgeOffset;
    if (
      spec &&
      (spec.type === "text" || spec.type === "coordinatesBadge") &&
      typeof spec.textY === "number"
    ) {
      offset = getLabelBarTextYOffsetPx();
      if (flipVertical) {
        offset = -offset;
      }
      if (spec.type === "coordinatesBadge") {
        badgeOffset = getLabelBarKnockoutBadgeTextYOffsetPx();
        if (flipVertical) {
          badgeOffset = -badgeOffset;
        }
        return spec.textY + offset + badgeOffset;
      }
      return spec.textY + offset;
    }
    return getLabelBarTextY(contentArea, flipVertical);
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
          textY: textMetrics.textY,
        });
      } else if (item.type === "svg" && item.svgFile) {
        var dims = getLabelBarSvgDimensions(item.svgFile);
        var svgTargetH;
        if (!dims || !dims.height) continue;
        svgTargetH = getLabelBarSvgRowTargetHeight(segmentHeight);
        var svgScale = svgTargetH / dims.height;
        specs.push({
          type: "svg",
          file: item.svgFile,
          width: dims.width * svgScale,
          height: svgTargetH,
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

  function getLabelBarContentShiftTowardGridPx() {
    var shift =
      typeof LABEL_BAR_CONTENT_SHIFT_TOWARD_GRID_PX !== "undefined"
        ? LABEL_BAR_CONTENT_SHIFT_TOWARD_GRID_PX
        : 0;
    var vInset = getLabelBarVerticalInsetPx();
    var halfGap = getLabelBarAdjacentRowContentGapPx() / 2;
    return Math.max(0, Math.min(shift, vInset, halfGap));
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
      : 8;
  }

  function getLabelBarClusterInternalGapPx() {
    return typeof LABEL_BAR_CLUSTER_INTERNAL_GAP_PX !== "undefined"
      ? LABEL_BAR_CLUSTER_INTERNAL_GAP_PX
      : 7;
  }

  function getLabelBarSymbolSeparatorSizePx() {
    return typeof LABEL_BAR_SYMBOL_SEPARATOR_SIZE_PX !== "undefined"
      ? LABEL_BAR_SYMBOL_SEPARATOR_SIZE_PX
      : 5;
  }

  function getLabelBarSymbolSeparatorFill() {
    return getLabelBarContentColor();
  }

  function getLabelBarScaledSymbolSeparatorSizePx() {
    return Math.max(
      1,
      getLabelBarSymbolSeparatorSizePx() * getLabelBarContentScale()
    );
  }

  function buildLabelBarSquareSepSpec() {
    var size = getLabelBarScaledSymbolSeparatorSizePx();
    return {
      type: "square",
      width: size,
      height: size,
    };
  }

  function getLabelBarSquareSepY(area) {
    var size = getLabelBarScaledSymbolSeparatorSizePx();
    return getLabelBarBandCenterY(area) - size / 2;
  }

  /**
   * Sum cluster width from laid-out items (fixed internal gap + each spec width).
   * @param {{ spec: object }[]} items
   * @returns {number}
   */
  function measureLabelBarClusterItemsWidth(items) {
    var pairGap = getLabelBarClusterInternalGapPx();
    var width = 0;
    var i;
    var item;
    if (!items || !items.length) return 0;
    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (!item || !item.spec) continue;
      if (width > 0) width += pairGap;
      width += item.spec.width;
    }
    return width;
  }

  /**
   * Cluster = symbol + optional caption locked with a fixed internal gap.
   * @param {({ spec: object, svgArea?: object, ageOverlayText?: string } | null)[]} parts
   * @returns {{ width: number, items: object[] } | null}
   */
  function buildLabelBarCluster(parts) {
    var items = [];
    var i;
    var part;
    if (!parts) return null;
    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      if (!part || !part.spec) continue;
      items.push(part);
    }
    if (!items.length) return null;
    return { width: measureLabelBarClusterItemsWidth(items), items: items };
  }

  /**
   * Row layout units: clusters (fixed internal gap) and square separators only between clusters.
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
          mirror: item.mirror,
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
        width: measureLabelBarClusterItemsWidth(clusterItems),
        items: clusterItems,
      });
      hasGroup = true;
    }
    return units;
  }

  /**
   * Spread groups across the full content span; fixed internal gap inside each group.
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
          mirror: !!rowItem.mirror,
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

  function getLabelBarTagSvgPool() {
    if (typeof LABEL_BAR_TAG_SVGS !== "undefined" && LABEL_BAR_TAG_SVGS.length) {
      return LABEL_BAR_TAG_SVGS.slice();
    }
    return [
      typeof LABEL_BAR_END_CAP_SVG !== "undefined"
        ? LABEL_BAR_END_CAP_SVG
        : "tag/lion.svg",
    ];
  }

  function getLabelBarTagStorageKey() {
    return typeof LABEL_BAR_TAG_ROTATION_STORAGE_KEY !== "undefined"
      ? LABEL_BAR_TAG_ROTATION_STORAGE_KEY
      : "undercover.labelBarTagIndex";
  }

  function getLabelBarTagDisplayLabel(svgFile) {
    var base;
    if (!svgFile) return "—";
    base = svgFile.replace(/^tag\//, "").replace(/\.svg$/i, "");
    if (base === "lion") return "Lion";
    if (base === "reshet") return "Reshet";
    if (/^tag0?(\d+(?:\.\d+)?)$/i.test(base)) {
      return "Tag " + base.replace(/^tag0?/i, "");
    }
    return base;
  }

  function getSavedLabelBarTagIndex() {
    var pool = getLabelBarTagSvgPool();
    var index = 0;
    try {
      index = parseInt(localStorage.getItem(getLabelBarTagStorageKey()), 10);
      if (isNaN(index) || index < 0) index = 0;
    } catch (e) {}
    return index % pool.length;
  }

  function saveLabelBarTagIndex(index) {
    try {
      localStorage.setItem(getLabelBarTagStorageKey(), String(index));
    } catch (e) {}
  }

  function loadLabelBarEndCapSvgFile() {
    var pool = getLabelBarTagSvgPool();
    var index = 0;
    var raw;
    if (!pool.length) return null;
    try {
      raw = localStorage.getItem(getLabelBarTagStorageKey());
      if (raw === null) {
        index = 0;
      } else {
        index = ((parseInt(raw, 10) || 0) + 1) % pool.length;
      }
    } catch (e) {
      index = 0;
    }
    saveLabelBarTagIndex(index);
    return pool[index];
  }

  function setLabelBarEndCapSvgByIndex(index) {
    var pool = getLabelBarTagSvgPool();
    var normalized;
    if (!pool.length) return null;
    normalized = ((index % pool.length) + pool.length) % pool.length;
    labelBarEndCapSvgFile = pool[normalized];
    saveLabelBarTagIndex(normalized);
    updateLabelBarTagControlLabel();
    refreshLabelBarContent();
    return labelBarEndCapSvgFile;
  }

  function toggleLabelBarEndCapTag() {
    var pool = getLabelBarTagSvgPool();
    if (pool.length < 2) return getLabelBarEndCapSvgFile();
    return setLabelBarEndCapSvgByIndex(getSavedLabelBarTagIndex() + 1);
  }

  function updateLabelBarTagControlLabel() {
    var label = document.getElementById("label-bar-tag-active-label");
    if (!label) return;
    label.textContent = getLabelBarTagDisplayLabel(getLabelBarEndCapSvgFile());
  }

  function initLabelBarTagControls() {
    var btn = document.getElementById("label-bar-tag-toggle-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        toggleLabelBarEndCapTag();
      });
    }
    updateLabelBarTagControlLabel();
  }

  function getLabelBarEndCapSvgFile() {
    if (labelBarEndCapSvgFile === null) {
      labelBarEndCapSvgFile = loadLabelBarEndCapSvgFile();
    }
    return labelBarEndCapSvgFile;
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

  function getLabelBarLivingNeverInIranSvgFile() {
    return typeof LABEL_BAR_LIVING_NEVER_IN_IRAN_SVG !== "undefined"
      ? LABEL_BAR_LIVING_NEVER_IN_IRAN_SVG
      : "Did you ever live in Iran?/no.svg";
  }

  function getLabelBarLivingDurationSvgFiles() {
    var map =
      typeof LABEL_BAR_LIVING_DURATION_SVGS !== "undefined"
        ? LABEL_BAR_LIVING_DURATION_SVGS
        : {
            smallPart: "Did you ever live in Iran?/small part of my life.svg",
            partOfLife: "Did you ever live in Iran?/part of my life.svg",
            mostAll: "Did you ever live in Iran?/Yes, most : all of my life.svg",
          };
    return [map.smallPart, map.partOfLife, map.mostAll];
  }

  function getLabelBarHomeAtSvgFiles() {
    if (typeof LABEL_BAR_HOME_AT_SVGS === "undefined") {
      return ["home/IN IRAN home.svg", "home/WHERE I LIVE.svg", "home/NOWHERE.svg"];
    }
    return [
      LABEL_BAR_HOME_AT_SVGS.inIran,
      LABEL_BAR_HOME_AT_SVGS.whereILive,
      LABEL_BAR_HOME_AT_SVGS.nowhere,
    ];
  }

  /** Sign from Profile “where do you feel at home?” */
  function getHomeAtLabelSvgFile() {
    var choice;
    var map;
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getHomeAt
    ) {
      return null;
    }
    choice = window.IdentityControls.getHomeAt();
    map =
      typeof LABEL_BAR_HOME_AT_SVGS !== "undefined"
        ? LABEL_BAR_HOME_AT_SVGS
        : {
            inIran: "home/IN IRAN home.svg",
            whereILive: "home/WHERE I LIVE.svg",
            nowhere: "home/NOWHERE.svg",
          };
    if (choice === "inIran") return map.inIran;
    if (choice === "whereILive") return map.whereILive;
    if (choice === "nowhere") return map.nowhere;
    return map.inIran;
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

  function getLabelBarCircleSvgFile() {
    return typeof LABEL_BAR_CIRCLE_SVG !== "undefined"
      ? LABEL_BAR_CIRCLE_SVG
      : "reshetsmall.svg";
  }

  function getLabelBarUnionSvgFile() {
    return typeof LABEL_BAR_UNION_SVG !== "undefined"
      ? LABEL_BAR_UNION_SVG
      : "Union.svg";
  }

  function getLabelBarUnionSmallSvgFile() {
    return typeof LABEL_BAR_UNION_SMALL_SVG !== "undefined"
      ? LABEL_BAR_UNION_SMALL_SVG
      : "Unionsmall.svg";
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

  /** Row 1: coordinates from Profile → “most at home” + Now in (replaces Union.svg). */
  function getProfileCoordinatesText() {
    if (
      typeof window.LocationCoordinates === "undefined" ||
      !window.LocationCoordinates.getFormatted
    ) {
      return "";
    }
    return String(window.LocationCoordinates.getFormatted() || "").trim();
  }

  function getLocationCoordinatesContext() {
    var homeAt = "inIran";
    var nowIn = "";
    if (typeof window.IdentityControls !== "undefined") {
      if (window.IdentityControls.getHomeAt) {
        homeAt = window.IdentityControls.getHomeAt();
      }
      if (window.IdentityControls.getNowIn) {
        nowIn = window.IdentityControls.getNowIn();
      }
    }
    return { homeAt: homeAt, nowIn: nowIn };
  }

  function refreshLocationCoordinates() {
    if (
      typeof window.LocationCoordinates === "undefined" ||
      !window.LocationCoordinates.updateFromContext
    ) {
      return;
    }
    window.LocationCoordinates.updateFromContext(getLocationCoordinatesContext());
  }

  function scheduleLocationCoordinates() {
    if (
      typeof window.LocationCoordinates === "undefined" ||
      !window.LocationCoordinates.scheduleUpdateFromContext
    ) {
      return;
    }
    window.LocationCoordinates.scheduleUpdateFromContext(
      getLocationCoordinatesContext()
    );
  }

  /** Name on row 2 — between sun sign and undercover english (mode from Profile → Name). */
  function getProfileNameText() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getNameLabelText
    ) {
      return "";
    }
    return String(window.IdentityControls.getNameLabelText() || "").trim();
  }

  /** Year of leaving — top row, between logo wordmark and home icon (Iran = Yes). */
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
    if (
      typeof LABEL_BAR_LEFT_LION_INNER_ROW1_SVG !== "undefined" &&
      LABEL_BAR_LEFT_LION_INNER_ROW1_SVG
    ) {
      return LABEL_BAR_LEFT_LION_INNER_ROW1_SVG;
    }
    return "";
  }

  function getLabelBarLeftLionInnerRow1SunSvgFile() {
    return typeof LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG !== "undefined"
      ? LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG
      : "reshetsmall.svg";
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
  function getLabelBarAgeOverlayTextMetrics(placement, contentArea, flipVertical) {
    var dims = getLabelBarSvgDimensions(getLabelBarAgeSvgFile());
    var spec = placement.spec;
    var yOffset = getLabelBarAgeOverlayYOffsetPx();
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
    if (flipVertical) {
      yOffset = -yOffset;
    }
    var svgY = getLabelBarSvgPlacementY(contentArea, spec.height);
    return {
      x: placement.x + spec.width * cxRatio,
      y: svgY + spec.height * cyRatio + yOffset,
      fontSize: circleR * 2 * getLabelBarAgeOverlayFontSizeRatio(),
    };
  }

  function applyLabelBarAgeOverlayTextAttrs(text, fontSize) {
    text.setAttribute("fill", getLabelBarAgeOverlayFill());
    text.setAttribute("font-family", getBrownBarBannerFontFamily());
    text.setAttribute("font-weight", "700");
    text.setAttribute("font-size", String(fontSize));
    text.setAttribute("letter-spacing", String(getBrownBarBannerLetterSpacing()));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("alignment-baseline", "middle");
  }

  function appendLabelBarAgeOverlayText(container, placement, contentArea, flipVertical) {
    var overlayText = placement.ageOverlayText;
    var metrics;
    var text;
    if (overlayText === undefined || !overlayText) return;
    metrics = getLabelBarAgeOverlayTextMetrics(placement, contentArea, flipVertical);
    text = elSvg("text");
    text.setAttribute("x", String(metrics.x));
    text.setAttribute("y", String(metrics.y));
    applyLabelBarAgeOverlayTextAttrs(text, metrics.fontSize);
    text.textContent = overlayText;
    container.appendChild(text);
  }

  function parseExportFontDataUriToArrayBuffer(dataUri) {
    var base64;
    var binary;
    var bytes;
    var i;
    if (!dataUri) return null;
    base64 = dataUri.replace(/^data:[^;]+;base64,/, "");
    binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function loadExportOpentypeFont(fontDataUri) {
    var buf;
    if (cachedExportOpentypeFont) {
      return Promise.resolve(cachedExportOpentypeFont);
    }
    if (typeof opentype === "undefined") {
      return Promise.resolve(null);
    }
    buf = parseExportFontDataUriToArrayBuffer(
      fontDataUri || getEmbeddedExportFontDataUri()
    );
    if (!buf) return Promise.resolve(null);
    try {
      cachedExportOpentypeFont = opentype.parse(buf);
      return Promise.resolve(cachedExportOpentypeFont);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function getBaselineYMatchingSvgText(textEl, font, fontSize) {
    var y = parseFloat(textEl.getAttribute("y") || "0");
    var content = textEl.textContent || "Hg";
    var measureG = getLabelBarMeasureGroup();
    var probe;
    var attrs = textEl.attributes;
    var ai;
    var bb;
    var path;
    var pb;
    var textCenter;
    var pathCenter;
    if (!measureG || !font) return y;
    probe = elSvg("text");
    for (ai = 0; ai < attrs.length; ai++) {
      probe.setAttribute(attrs[ai].name, attrs[ai].value);
    }
    probe.textContent = content;
    measureG.appendChild(probe);
    bb = probe.getBBox();
    measureG.removeChild(probe);
    path = font.getPath(content, 0, y, fontSize);
    pb = path.getBoundingBox();
    textCenter = bb.y + bb.height / 2;
    pathCenter = (pb.y1 + pb.y2) / 2;
    return y + (textCenter - pathCenter);
  }

  function buildOutlinedPathDataForSvgText(
    font,
    text,
    x,
    baselineY,
    fontSize,
    letterSpacing,
    anchor
  ) {
    var chars = String(text || "").split("");
    var advances = [];
    var totalWidth = 0;
    var startX = x;
    var pathParts = [];
    var cursorX;
    var i;
    if (!font || !chars.length) return "";
    for (i = 0; i < chars.length; i++) {
      advances[i] = font.getAdvanceWidth(chars[i], fontSize);
      totalWidth += advances[i];
      if (i < chars.length - 1) totalWidth += letterSpacing;
    }
    if (anchor === "middle") startX = x - totalWidth / 2;
    else if (anchor === "end") startX = x - totalWidth;
    cursorX = startX;
    for (i = 0; i < chars.length; i++) {
      pathParts.push(font.getPath(chars[i], cursorX, baselineY, fontSize).toPathData(3));
      cursorX += advances[i];
      if (i < chars.length - 1) cursorX += letterSpacing;
    }
    return pathParts.join(" ");
  }

  function convertSvgTextElementToPath(textEl, font) {
    var fontSize = parseFloat(textEl.getAttribute("font-size") || "12");
    var fill = textEl.getAttribute("fill") || getLabelBarContentColor();
    var letterSpacing = parseFloat(textEl.getAttribute("letter-spacing") || "0");
    var anchor = textEl.getAttribute("text-anchor") || "start";
    var content = textEl.textContent || "";
    var x = parseFloat(textEl.getAttribute("x") || "0");
    var baselineY;
    var d;
    var pathEl;
    if (!content || !font) return null;
    baselineY = getBaselineYMatchingSvgText(textEl, font, fontSize);
    d = buildOutlinedPathDataForSvgText(
      font,
      content,
      x,
      baselineY,
      fontSize,
      letterSpacing,
      anchor
    );
    if (!d) return null;
    pathEl = elSvg("path");
    pathEl.setAttribute("d", d);
    pathEl.setAttribute("fill", fill);
    return pathEl;
  }

  function serializeSvgElement(el) {
    return new XMLSerializer().serializeToString(el);
  }

  function pushLabelBarTextPlacementExport(
    edgeLines,
    placement,
    contentArea,
    flipVertical
  ) {
    var spec = placement.spec;
    var textEl;
    var pathEl;
    var textY = getLabelBarTextPlacementY(placement, contentArea, flipVertical);
    if (!spec || !spec.text) return;
    textEl = elSvg("text");
    textEl.setAttribute("x", String(placement.x));
    textEl.setAttribute("y", String(textY));
    applyLabelBarTextAttrs(textEl, spec.fontSize);
    textEl.textContent = spec.text;
    if (cachedExportOpentypeFont) {
      pathEl = convertSvgTextElementToPath(textEl, cachedExportOpentypeFont);
      if (pathEl) {
        edgeLines.push(serializeSvgElement(pathEl));
        return;
      }
    }
    edgeLines.push(
      '<text x="' +
        placement.x +
        '" y="' +
        textY +
        '" fill="' +
        getBrownBarBannerFill() +
        '" font-family="' +
        getBrownBarBannerFontFamily() +
        '" font-weight="700" font-size="' +
        spec.fontSize +
        '" letter-spacing="' +
        getBrownBarBannerLetterSpacing() +
        '" text-anchor="start" dominant-baseline="middle" alignment-baseline="middle">' +
        spec.text +
        "</text>"
    );
  }

  function pushLabelBarCoordinatesBadgeExport(
    edgeLines,
    placement,
    contentArea,
    flipVertical
  ) {
    var spec = placement.spec;
    var badgeX = placement.x;
    var badgeY = spec.rectY;
    var textX = badgeX + spec.padX;
    var textY = getLabelBarTextPlacementY(placement, contentArea, flipVertical);
    var maskId = nextLabelBarCoordsMaskId();
    var textEl;
    var pathEl;
    if (!spec || !spec.text) return;

    edgeLines.push(
      '<mask id="' +
        maskId +
        '" maskUnits="userSpaceOnUse" x="' +
        badgeX +
        '" y="' +
        badgeY +
        '" width="' +
        spec.width +
        '" height="' +
        spec.height +
        '">'
    );
    edgeLines.push(
      '<rect x="' +
        badgeX +
        '" y="' +
        badgeY +
        '" width="' +
        spec.width +
        '" height="' +
        spec.height +
        '" fill="#ffffff"/>'
    );

    textEl = elSvg("text");
    textEl.setAttribute("x", String(textX));
    textEl.setAttribute("y", String(textY));
    applyLabelBarTextAttrs(textEl, spec.fontSize);
    textEl.setAttribute("fill", "#000000");
    textEl.textContent = spec.text;
    if (cachedExportOpentypeFont) {
      pathEl = convertSvgTextElementToPath(textEl, cachedExportOpentypeFont);
      if (pathEl) {
        pathEl.setAttribute("fill", "#000000");
        edgeLines.push(serializeSvgElement(pathEl));
      } else {
        edgeLines.push(serializeSvgElement(textEl));
      }
    } else {
      edgeLines.push(
        '<text x="' +
          textX +
          '" y="' +
          textY +
          '" fill="#000000" font-family="' +
          getBrownBarBannerFontFamily() +
          '" font-weight="700" font-size="' +
          spec.fontSize +
          '" letter-spacing="' +
          getBrownBarBannerLetterSpacing() +
          '" text-anchor="start" dominant-baseline="middle" alignment-baseline="middle">' +
          spec.text +
          "</text>"
      );
    }
    edgeLines.push("</mask>");
    edgeLines.push(
      '<rect x="' +
        badgeX +
        '" y="' +
        badgeY +
        '" width="' +
        spec.width +
        '" height="' +
        spec.height +
        '" fill="' +
        getLabelBarContentColor() +
        '" mask="url(#' +
        maskId +
        ')"/>'
    );
  }

  function pushLabelBarAgeOverlayTextExport(
    edgeLines,
    placement,
    contentArea,
    flipVertical
  ) {
    var overlayText = placement.ageOverlayText;
    var metrics;
    var textEl;
    var pathEl;
    if (overlayText === undefined || !overlayText) return;
    metrics = getLabelBarAgeOverlayTextMetrics(placement, contentArea, flipVertical);
    textEl = elSvg("text");
    textEl.setAttribute("x", String(metrics.x));
    textEl.setAttribute("y", String(metrics.y));
    applyLabelBarAgeOverlayTextAttrs(textEl, metrics.fontSize);
    textEl.textContent = overlayText;
    if (cachedExportOpentypeFont) {
      pathEl = convertSvgTextElementToPath(textEl, cachedExportOpentypeFont);
      if (pathEl) {
        edgeLines.push(serializeSvgElement(pathEl));
        return;
      }
    }
    edgeLines.push(
      '<text x="' +
        metrics.x +
        '" y="' +
        metrics.y +
        '" fill="' +
        getLabelBarAgeOverlayFill() +
        '" font-family="' +
        getBrownBarBannerFontFamily() +
        '" font-weight="700" font-size="' +
        metrics.fontSize +
        '" letter-spacing="' +
        getBrownBarBannerLetterSpacing() +
        '" text-anchor="middle" dominant-baseline="middle" alignment-baseline="middle">' +
        overlayText +
        "</text>"
    );
  }

  function getLabelBarRightLionInnerRow2SvgFile() {
    if (
      typeof LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG !== "undefined" &&
      LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG
    ) {
      return LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG;
    }
    return "";
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

  /** Icon for Lost profile field — always Inner Circle (1/1). */
  function getLostLabelSvgFile() {
    return getLabelBarLostInnerSvgFile();
  }

  function getLabelBarLostSvgFiles() {
    return [
      getLabelBarLostInnerSvgFile(),
      getLabelBarLostMiddleSvgFile(),
      getLabelBarLostDistantSvgFile(),
    ];
  }

  /** Sign from Profile “Did you ever live in Iran?” — placed right of profile name (row 2). */
  function getLivingDurationLabelSvgFile() {
    var choice;
    var duration;
    var map;
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.getLivingInIran
    ) {
      return getLabelBarLivingNeverInIranSvgFile();
    }
    choice = window.IdentityControls.getLivingInIran();
    if (choice !== true) {
      return getLabelBarLivingNeverInIranSvgFile();
    }
    duration =
      window.IdentityControls.getLivingDuration &&
      window.IdentityControls.getLivingDuration();
    map =
      typeof LABEL_BAR_LIVING_DURATION_SVGS !== "undefined"
        ? LABEL_BAR_LIVING_DURATION_SVGS
        : {
            smallPart: "Did you ever live in Iran?/small part of my life.svg",
            partOfLife: "Did you ever live in Iran?/part of my life.svg",
            mostAll: "Did you ever live in Iran?/Yes, most : all of my life.svg",
          };
    if (duration === "smallPart") return map.smallPart;
    if (duration === "mostAll") return map.mostAll;
    return map.partOfLife;
  }

  function filterLabelBarCenterItems(items) {
    var cap = getLabelBarEndCapSvgFile();
    var inIran = getLabelBarLivingInIranSvgFile();
    var outsideIran = getLabelBarLivingOutsideIranSvgFile();
    var fromFile = getLabelBarFromSvgFile();
    var nowInFile = getLabelBarNowInSvgFile();
    var circleFile = getLabelBarCircleSvgFile();
    var unionFile = getLabelBarUnionSvgFile();
    var unionSmallFile = getLabelBarUnionSmallSvgFile();
    var leftSignFile = getLabelBarLeftSvgFile();
    var womenFile = getLabelBarWomenSvgFile();
    var leftWord = getLabelBarLeftLionInnerRow1SvgFile();
    var sunFile = getLabelBarLeftLionInnerRow1SunSvgFile();
    var ageFile = getLabelBarAgeSvgFile();
    var rightWord = getLabelBarRightLionInnerRow2SvgFile();
    var lostFiles = getLabelBarLostSvgFiles();
    var homeAtFiles = getLabelBarHomeAtSvgFiles();
    var livingDurationFiles = getLabelBarLivingDurationSvgFiles();
    var livingNeverFile = getLabelBarLivingNeverInIranSvgFile();
    return items.filter(function (item) {
      return !(
        item.type === "svg" &&
        (item.svgFile === cap ||
          item.svgFile === inIran ||
          item.svgFile === outsideIran ||
          item.svgFile === livingNeverFile ||
          item.svgFile === fromFile ||
          item.svgFile === nowInFile ||
          item.svgFile === circleFile ||
          item.svgFile === unionFile ||
          item.svgFile === unionSmallFile ||
          item.svgFile === leftSignFile ||
          item.svgFile === womenFile ||
          item.svgFile === leftWord ||
          item.svgFile === sunFile ||
          item.svgFile === ageFile ||
          item.svgFile === rightWord ||
          lostFiles.indexOf(item.svgFile) >= 0 ||
          homeAtFiles.indexOf(item.svgFile) >= 0 ||
          livingDurationFiles.indexOf(item.svgFile) >= 0)
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
      : "1/1";
  }

  function buildLabelBarLostLabelSpec(area) {
    return buildLabelBarCoordinatesBadgeSpec(getLabelBarLostLabelText(), area);
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
      textY: textMetrics.textY,
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
      textY: textMetrics.textY,
    };
  }

  function getLabelBarCoordinatesBadgePadXPx() {
    return typeof LABEL_BAR_COORDINATES_BADGE_PAD_X_PX !== "undefined"
      ? LABEL_BAR_COORDINATES_BADGE_PAD_X_PX
      : 7;
  }

  function getLabelBarCoordinatesBadgePadYPx() {
    return typeof LABEL_BAR_COORDINATES_BADGE_PAD_Y_PX !== "undefined"
      ? LABEL_BAR_COORDINATES_BADGE_PAD_Y_PX
      : 3;
  }

  function buildLabelBarCoordinatesBadgeSpec(text, contentArea) {
    var label = (text || "").trim();
    var textMetrics;
    var padX = getLabelBarCoordinatesBadgePadXPx();
    var padY = getLabelBarCoordinatesBadgePadYPx();
    var badgeHeight;
    var rectY;
    if (!label) return null;
    textMetrics = fitLabelBarTextMetrics(
      label,
      contentArea.height,
      contentArea.y,
      contentArea.y + contentArea.height
    );
    badgeHeight = Math.min(
      contentArea.height,
      Math.max(1, textMetrics.height + padY * 2)
    );
    rectY = contentArea.y + (contentArea.height - badgeHeight) / 2;
    return {
      type: "coordinatesBadge",
      text: label,
      width: textMetrics.width + padX * 2,
      height: badgeHeight,
      fontSize: textMetrics.fontSize,
      textY: textMetrics.textY,
      padX: padX,
      rectY: rectY,
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
    var livingRowArea = row2Area || area;
    var endCapSpan = getLabelBarTwoRowVisualSpan(area, livingRowArea);
    var endCapRenderArea = getLabelBarEndCapRenderArea(
      endCapArea,
      area,
      livingRowArea
    );
    var lionSpec = buildLabelBarSvgSpec(
      getLabelBarEndCapSvgFile(),
      endCapSpan.height
    );
    var leftWordSpec = buildLabelBarSvgSpec(
      getLabelBarLeftLionInnerRow1SvgFile(),
      getLabelBarSvgRowTargetHeight(area.height)
    );
    var ageSpec = buildLabelBarSvgSpec(
      getLabelBarAgeSvgFile(),
      getLabelBarSvgRowTargetHeight(area.height)
    );
    var ageLabelSpec = ageSpec ? buildLabelBarAgeLabelSpec(area) : null;
    var rightWordSpec = buildLabelBarSvgSpec(
      getLabelBarRightLionInnerRow2SvgFile(),
      getLabelBarSvgRowTargetHeight(row2Area ? row2Area.height : area.height)
    );
    var livingSpec = buildLabelBarSvgSpec(
      getLabelBarLivingOutsideIranSvgFile(),
      getLabelBarSvgRowTargetHeight(livingRowArea.height)
    );
    var livingDurationFile = getLivingDurationLabelSvgFile();
    var livingDurationSpec = livingDurationFile
      ? buildLabelBarSvgSpec(
          livingDurationFile,
          getLabelBarSvgRowTargetHeight(livingRowArea.height)
        )
      : null;
    var fromSpec = buildLabelBarSvgSpec(
      getLabelBarFromSvgFile(),
      getLabelBarSvgRowTargetHeight(livingRowArea.height)
    );
    var fromTextSpec = buildLabelBarProfileFieldTextSpec(
      getProfileFromText(),
      livingRowArea
    );
    var nowInTextSpec = buildLabelBarProfileFieldTextSpec(
      getProfileNowInText(),
      livingRowArea
    );
    var circleSpec = buildLabelBarSvgSpec(
      getLabelBarCircleSvgFile(),
      getLabelBarSvgRowTargetHeight(livingRowArea.height)
    );
    var unionCoordinatesSpec = buildLabelBarCoordinatesBadgeSpec(
      getProfileCoordinatesText(),
      area
    );
    var unionSmallRow1Spec = buildLabelBarSvgSpec(
      getLabelBarUnionSmallSvgFile(),
      getLabelBarSvgRowTargetHeight(area.height)
    );
    var unionSmallRow2Spec = buildLabelBarSvgSpec(
      getLabelBarUnionSmallSvgFile(),
      getLabelBarSvgRowTargetHeight(livingRowArea.height)
    );
    var leftSignSpec = buildLabelBarSvgSpec(
      getLabelBarLeftSvgFile(),
      getLabelBarSvgRowTargetHeight(area.height)
    );
    var womenSpec = buildLabelBarSvgSpec(
      getLabelBarWomenSvgFile(),
      getLabelBarSvgRowTargetHeight(livingRowArea.height)
    );
    var lostFile = getLostLabelSvgFile();
    var lostSpec = lostFile
      ? buildLabelBarSvgSpec(
          lostFile,
          getLabelBarSvgRowTargetHeight(area.height)
        )
      : null;
    var lostLabelSpec = lostSpec ? buildLabelBarLostLabelSpec(area) : null;
    var homeAtFile = getHomeAtLabelSvgFile();
    var homeAtSpec = homeAtFile
      ? buildLabelBarSvgSpec(
          homeAtFile,
          getLabelBarSvgRowTargetHeight(area.height)
        )
      : null;
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

    var leavingYearText = getProfileLeavingYearText();
    var leavingYearTextSpec = leavingYearText
      ? buildLabelBarProfileFieldTextSpec(leavingYearText, area)
      : null;
    var showLeavingYear =
      typeof window.IdentityControls !== "undefined" &&
      window.IdentityControls.getLivingInIran &&
      window.IdentityControls.getLivingInIran() === true;

    row1Clusters = [];
    pushRowCluster(
      row1Clusters,
      buildLabelBarCluster([
        leftWordSpec ? { spec: leftWordSpec, svgArea: area } : null,
      ])
    );
    if (showLeavingYear) {
      pushRowCluster(
        row1Clusters,
        buildLabelBarCluster([
          leftSignSpec ? { spec: leftSignSpec, svgArea: area } : null,
          leavingYearTextSpec
            ? { spec: leavingYearTextSpec, svgArea: area }
            : null,
        ])
      );
    }
    pushRowCluster(
      row1Clusters,
      buildLabelBarCluster([
        homeAtSpec ? { spec: homeAtSpec, svgArea: area } : null,
        unionCoordinatesSpec
          ? { spec: unionCoordinatesSpec, svgArea: area }
          : null,
      ])
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
    if (unionSmallRow1Spec) {
      row1Clusters.unshift(
        buildLabelBarCluster([{ spec: unionSmallRow1Spec, svgArea: area }])
      );
    }

    row2Clusters = [];
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([circleSpec ? { spec: circleSpec, svgArea: livingRowArea } : null])
    );
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([
        livingDurationSpec
          ? { spec: livingDurationSpec, svgArea: livingRowArea }
          : null,
        fromTextSpec ? { spec: fromTextSpec, svgArea: livingRowArea } : null,
        fromSpec ? { spec: fromSpec, svgArea: livingRowArea } : null,
        nowInTextSpec ? { spec: nowInTextSpec, svgArea: livingRowArea } : null,
      ])
    );
    var nameText = getProfileNameText();
    var nameTextSpec = nameText
      ? buildLabelBarProfileFieldTextSpec(nameText, livingRowArea)
      : null;
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([
        womenSpec ? { spec: womenSpec, svgArea: livingRowArea } : null,
      ])
    );
    if (nameTextSpec) {
      pushRowCluster(
        row2Clusters,
        buildLabelBarCluster([{ spec: nameTextSpec, svgArea: livingRowArea }])
      );
    }
    pushRowCluster(
      row2Clusters,
      buildLabelBarCluster([
        livingSpec ? { spec: livingSpec, svgArea: livingRowArea } : null,
      ])
    );
    if (rightWordSpec) {
      pushRowCluster(
        row2Clusters,
        buildLabelBarCluster([
          { spec: rightWordSpec, svgArea: row2Area || area, mirror: true },
        ])
      );
    }
    if (unionSmallRow2Spec) {
      pushRowCluster(
        row2Clusters,
        buildLabelBarCluster([
          { spec: unionSmallRow2Spec, svgArea: livingRowArea },
        ])
      );
    }

    placements.push({
      spec: lionSpec,
      x: leftX,
      mirror: false,
      svgArea: endCapRenderArea,
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
      svgArea: endCapRenderArea,
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
    var svgY;
    if (!tintedMarkup) return false;

    ix = placement.x;
    svgY = getLabelBarSvgPlacementY(area, spec.height);
    scaleX = mirror ? -spec.scale : spec.scale;
    g = elSvg("g");
    g.setAttribute(
      "transform",
      "translate(" +
        (mirror ? ix + spec.width : ix) +
        "," +
        svgY +
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
    var svgY = getLabelBarSvgPlacementY(area, spec.height);
    var img;
    var wrap;

    if (labelBarSvgUsesNativeColors(spec.file)) {
      if (mirror) {
        wrap = elSvg("g");
        wrap.setAttribute(
          "transform",
          "translate(" + (ix + spec.width) + "," + svgY + ") scale(-1, 1)"
        );
        img = elSvg("image");
        img.setAttribute("x", "0");
        img.setAttribute("y", "0");
      } else {
        wrap = container;
        img = elSvg("image");
        img.setAttribute("x", String(ix));
        img.setAttribute("y", String(svgY));
      }
      setSvgImageHref(img, getLabelBarSvgHref(spec.file));
      img.setAttribute("width", String(spec.width));
      img.setAttribute("height", String(spec.height));
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      wrap.appendChild(img);
      if (mirror) container.appendChild(wrap);
      return;
    }

    if (appendLabelBarSvgTintedGroup(container, placement, area, mirror)) {
      return;
    }

    if (mirror) {
      wrap = elSvg("g");
      wrap.setAttribute(
        "transform",
        "translate(" + (ix + spec.width) + "," + svgY + ") scale(-1, 1)"
      );
      img = elSvg("image");
      img.setAttribute("x", "0");
      img.setAttribute("y", "0");
    } else {
      wrap = container;
      img = elSvg("image");
      img.setAttribute("x", String(ix));
      img.setAttribute("y", String(svgY));
    }

    setSvgImageHref(img, getLabelBarSvgHref(spec.file));
    img.setAttribute("width", String(spec.width));
    img.setAttribute("height", String(spec.height));
    img.setAttribute("preserveAspectRatio", "xMidYMid meet");
    img.setAttribute("filter", getLabelBarIconTintFilterRef());
    wrap.appendChild(img);
    if (mirror) container.appendChild(wrap);
  }

  var labelBarCoordsMaskId = 0;

  function nextLabelBarCoordsMaskId() {
    labelBarCoordsMaskId += 1;
    return "label-bar-coords-mask-" + labelBarCoordsMaskId;
  }

  function createLabelBarCoordinatesMaskTextEl(
    spec,
    textX,
    textY,
    forKnockout
  ) {
    var text = elSvg("text");
    text.setAttribute("x", String(textX));
    text.setAttribute("y", String(textY));
    applyLabelBarTextAttrs(text, spec.fontSize);
    if (forKnockout) {
      text.setAttribute("fill", "#000000");
    }
    text.textContent = spec.text;
    return text;
  }

  function appendLabelBarCoordinatesBadgePlacement(
    container,
    placement,
    contentArea,
    flipVertical
  ) {
    var spec = placement.spec;
    var badgeX = placement.x;
    var badgeY = spec.rectY;
    var textX = badgeX + spec.padX;
    var textY = getLabelBarTextPlacementY(placement, contentArea, flipVertical);
    var maskId = nextLabelBarCoordsMaskId();
    var mask = elSvg("mask");
    var maskRect;
    var maskText;
    var fillRect;

    mask.setAttribute("id", maskId);
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    mask.setAttribute("x", String(badgeX));
    mask.setAttribute("y", String(badgeY));
    mask.setAttribute("width", String(spec.width));
    mask.setAttribute("height", String(spec.height));

    maskRect = elSvg("rect");
    maskRect.setAttribute("x", String(badgeX));
    maskRect.setAttribute("y", String(badgeY));
    maskRect.setAttribute("width", String(spec.width));
    maskRect.setAttribute("height", String(spec.height));
    maskRect.setAttribute("fill", "#ffffff");
    mask.appendChild(maskRect);

    maskText = createLabelBarCoordinatesMaskTextEl(
      spec,
      textX,
      textY,
      true
    );
    mask.appendChild(maskText);
    container.appendChild(mask);

    fillRect = elSvg("rect");
    fillRect.setAttribute("x", String(badgeX));
    fillRect.setAttribute("y", String(badgeY));
    fillRect.setAttribute("width", String(spec.width));
    fillRect.setAttribute("height", String(spec.height));
    fillRect.setAttribute("fill", getLabelBarContentColor());
    fillRect.setAttribute("mask", "url(#" + maskId + ")");
    container.appendChild(fillRect);
  }

  function appendLabelBarPlacement(rowG, placement, defaultArea, flipVertical) {
    var spec = placement.spec;
    var contentArea = placement.svgArea || defaultArea;
    var itemG = elSvg("g");
    var text;
    var mount = itemG;

    itemG.setAttribute("class", "label-bar-item");
    if (spec.type === "coordinatesBadge") {
      appendLabelBarCoordinatesBadgePlacement(
        itemG,
        placement,
        contentArea,
        flipVertical
      );
    } else if (spec.type === "text") {
      text = elSvg("text");
      text.setAttribute("x", String(placement.x));
      text.setAttribute(
        "y",
        String(getLabelBarTextPlacementY(placement, contentArea, flipVertical))
      );
      applyLabelBarTextAttrs(text, spec.fontSize);
      text.textContent = spec.text;
      itemG.appendChild(text);
    } else if (spec.type === "svg") {
      appendLabelBarSvgPlacement(itemG, placement, contentArea);
      appendLabelBarAgeOverlayText(itemG, placement, contentArea, flipVertical);
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
      var rotCenter = getLabelBarPlacementRotate180Center(
        placement,
        contentArea,
        flipVertical
      );
      mount = elSvg("g");
      mount.setAttribute(
        "transform",
        getLabelBarRotate180Transform(rotCenter.cx, rotCenter.cy)
      );
      mount.appendChild(itemG);
    }
    rowG.appendChild(mount);
  }

  function pushLabelBarSvgPlacementExport(edgeLines, placement, area) {
    var spec = placement.spec;
    var ix = placement.x;
    var mirror = placement.mirror;
    var svgY = getLabelBarSvgPlacementY(area, spec.height);
    primeLabelBarSvgCacheFromEmbedded(spec.file);
    var whiteMarkup =
      getLabelBarSvgTintedInnerMarkup(spec.file) ||
      buildLabelBarSvgTintedInnerMarkupFromEmbedded(spec.file);
    var scaleX = mirror ? -spec.scale : spec.scale;
    var tintFilterAttr = labelBarSvgUsesNativeColors(spec.file)
      ? ""
      : ' filter="' + getLabelBarIconTintFilterRef() + '"';

    if (whiteMarkup) {
      edgeLines.push(
        '<g transform="translate(' +
          (mirror ? ix + spec.width : ix) +
          " " +
          svgY +
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

    if (labelBarSvgUsesNativeColors(spec.file)) {
      if (mirror) {
        edgeLines.push(
          '<g transform="translate(' +
            (ix + spec.width) +
            "," +
            svgY +
            ') scale(-1,1)"><image href="' +
            getLabelBarSvgHref(spec.file) +
            '" x="0" y="0" width="' +
            spec.width +
            '" height="' +
            spec.height +
            '" preserveAspectRatio="xMidYMid meet"/></g>'
        );
        return;
      }

      edgeLines.push(
        '<image href="' +
          getLabelBarSvgHref(spec.file) +
          '" x="' +
          ix +
          '" y="' +
          svgY +
          '" width="' +
          spec.width +
          '" height="' +
          spec.height +
          '" preserveAspectRatio="xMidYMid meet"/>'
      );
      return;
    }

    if (mirror) {
      edgeLines.push(
        '<g transform="translate(' +
          (ix + spec.width) +
          "," +
          svgY +
          ') scale(-1,1)"><image href="' +
          getLabelBarSvgHref(spec.file) +
          '" x="0" y="0" width="' +
          spec.width +
          '" height="' +
          spec.height +
          '" preserveAspectRatio="xMidYMid meet"' +
          tintFilterAttr +
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
        svgY +
        '" width="' +
        spec.width +
        '" height="' +
        spec.height +
        '" preserveAspectRatio="xMidYMid meet"' +
        tintFilterAttr +
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
      appendLabelBarPlacement(rowG, placements[pi], area, false);
    }

    if (labelBarEdgeUsesGroupRotate180(edge)) {
      var rotCenter = getLabelBarLayoutRotate180Center(layout);
      var wrapper = elSvg("g");
      wrapper.setAttribute("data-edge", edge);
      wrapper.setAttribute(
        "transform",
        getLabelBarRotate180Transform(rotCenter.cx, rotCenter.cy)
      );
      wrapper.appendChild(rowG);
      rowG.removeAttribute("data-edge");
      return wrapper;
    }

    return rowG;
  }

  function appendLabelBarContent(g) {
    var items = getLabelBarItems();
    var bottomLayout = getCanvasEdgeBrownBarLayout("bottom");
    var topLayout = getCanvasEdgeBrownBarLayout("top");
    var bottomRow;
    var topRow;
    labelBarCoordsMaskId = 0;
    bottomRow = createLabelBarRowGroup("bottom", bottomLayout, items);
    topRow = createLabelBarRowGroup("top", topLayout, items);
    if (bottomRow) g.appendChild(bottomRow);
    if (topRow) g.appendChild(topRow);
  }

  var labelBarContentRenderToken = 0;
  var labelBarContentHasRendered = false;

  function waitForLabelBarFontsReady() {
    if (typeof document === "undefined" || !document.fonts) {
      return Promise.resolve();
    }
    var family = getBrownBarBannerFontFamily();
    return document.fonts.ready
      .then(function () {
        if (!document.fonts.load) return;
        return document.fonts.load('700 16px "' + family + '"');
      })
      .catch(function () {});
  }

  function waitForLabelBarLayoutReady() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function refreshLabelBarContent() {
    if (!designSvg) return;
    var group = designSvg.querySelector("#edge-brown-bar-label-content");
    if (!group) return;

    var token = ++labelBarContentRenderToken;
    if (!labelBarContentHasRendered) {
      group.setAttribute("visibility", "hidden");
    }

    return waitForLabelBarFontsReady()
      .then(function () {
        return preloadLabelBarSvgAssetsForExport();
      })
      .then(waitForLabelBarLayoutReady)
      .then(function () {
        if (!designSvg || token !== labelBarContentRenderToken) return;
        while (group.firstChild) group.removeChild(group.firstChild);
        appendLabelBarContent(group);
        group.removeAttribute("visibility");
        labelBarContentHasRendered = true;
        if (typeof updateMagnifierViewBox === "function") {
          updateMagnifierViewBox();
        }
      });
  }

  function preloadLabelBarSvgAssetsForExport() {
    var items = getLabelBarItems();
    var files = [
      getLabelBarEndCapSvgFile(),
      getLabelBarLivingOutsideIranSvgFile(),
      getLivingDurationLabelSvgFile(),
      getLabelBarLivingNeverInIranSvgFile(),
      getLabelBarLivingDurationSvgFiles()[0],
      getLabelBarLivingDurationSvgFiles()[1],
      getLabelBarLivingDurationSvgFiles()[2],
      getLabelBarFromSvgFile(),
      getLabelBarNowInSvgFile(),
      getLabelBarCircleSvgFile(),
      getLabelBarUnionSmallSvgFile(),
      getLabelBarLeftSvgFile(),
      getLabelBarWomenSvgFile(),
      getLabelBarLeftLionInnerRow1SvgFile(),
      getHomeAtLabelSvgFile(),
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
    var fi;
    var loadFiles = [];
    for (fi = 0; fi < files.length; fi++) {
      if (!files[fi]) continue;
      loadFiles.push(files[fi]);
      primeLabelBarSvgCacheFromEmbedded(files[fi]);
    }
    if (!loadFiles.length) return Promise.resolve();
    return Promise.allSettled(
      loadFiles.map(function (name) {
        return ensureLabelBarSvgAsset(name).catch(function () {
          return null;
        });
      })
    ).then(function () {
      for (fi = 0; fi < files.length; fi++) {
        primeLabelBarSvgCacheFromEmbedded(files[fi]);
      }
    });
  }

  function refreshBrownBarBannerAfterMount() {
    var run = function () {
      refreshLabelBarContent();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 0);
    }
  }

  function createBrownBarBannerTextGroup() {
    var g = elSvg("g");
    g.setAttribute("id", "edge-brown-bar-label-content");
    g.setAttribute("visibility", "hidden");
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
    labelBarCoordsMaskId = 0;
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
      if (labelBarEdgeUsesGroupRotate180(edge)) {
        var layoutRotCenter = getLabelBarLayoutRotate180Center(layout);
        edgeLines.push(
          '<g transform="' +
            getLabelBarRotate180Transform(
              layoutRotCenter.cx,
              layoutRotCenter.cy
            ) +
            '">'
        );
      }
      for (pi = 0; pi < placements.length; pi++) {
        placement = placements[pi];
        var placementArea = placement.svgArea || area;
        if (placement.spec.type === "text") {
          pushLabelBarTextPlacementExport(
            edgeLines,
            placement,
            placementArea,
            false
          );
        } else if (placement.spec.type === "coordinatesBadge") {
          pushLabelBarCoordinatesBadgeExport(
            edgeLines,
            placement,
            placementArea,
            false
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
            placementArea,
            false
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
      }
      if (labelBarEdgeUsesGroupRotate180(edge)) {
        edgeLines.push("</g>");
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
          var colorFadeFillExport = getBorderSideColorFadeFillColor();
          lines.push(
            '<rect x="0" y="' +
              yTop +
              '" width="' +
              b +
              '" height="' +
              h +
              '" fill="' +
              colorFadeFillExport +
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
              colorFadeFillExport +
              '"/>'
          );
          pushBorderSideEmptyCellStippleAtXExport(
            lines,
            0,
            b,
            yTop,
            yBottom,
            0,
            j
          );
          pushBorderSideEmptyCellStippleAtXExport(
            lines,
            rightX,
            b,
            yTop,
            yBottom,
            0,
            j
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
    if (outlineOnly || getBorderSideWhiteFillTargetPercent() > 0) {
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

        if (!outlineOnly) continue;
        if (cellType === "grey" || cellType === "beige") continue;
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

    if (getBorderSideThicknessColumns() <= 1) {
      pushBorderDivisionJunctionCirclesExport(lines);
    }

    lines.push("</g>");
  }

  function createInnerContentClipGroup(id) {
    var g = elSvg("g");
    g.setAttribute("id", id);
    g.setAttribute("clip-path", "url(#inner-content-clip)");
    return g;
  }

  /** Keep Fear (F1) outside the color-division isolation group (no exclusion tint). */
  function ensureFearVerticalGridMounted() {
    if (!designSvg) return;
    var fearRoot = designSvg.querySelector("#fear-vertical-grid-root");
    if (!fearRoot) return;
    var blendRoot = designSvg.querySelector("#color-divisions-blend-root");
    if (!blendRoot || fearRoot.parentNode === blendRoot) {
      var anchor = designSvg.querySelector("#layer-edge-brown-bars");
      if (anchor && anchor.parentNode === designSvg) {
        designSvg.insertBefore(fearRoot, anchor);
      } else if (fearRoot.parentNode !== designSvg) {
        designSvg.appendChild(fearRoot);
      }
    }
    fearRoot.setAttribute("style", "mix-blend-mode:normal");
  }

  /**
   * Pride auto-merge (P1) renders above all other emotion markers, including Fear verticals.
   */
  function createPrideAutoMergeBranch() {
    var root = elSvg("g");
    root.setAttribute("id", "pride-auto-merge-root");
    root.setAttribute("transform", getInnerContentTransformAttr());
    root.setAttribute("style", "mix-blend-mode:normal");

    var clippedAutoMerge = createInnerContentClipGroup(
      "inner-clipped-auto-merge-fills"
    );
    var autoMergeLayer = elSvg("g");
    autoMergeLayer.setAttribute("id", "layer-auto-merge-fills");
    autoMergeLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedAutoMerge.appendChild(autoMergeLayer);
    root.appendChild(clippedAutoMerge);

    return root;
  }

  /** Keep Pride above Fear verticals and below the fan overlay. */
  function ensurePrideAutoMergeMounted() {
    if (!designSvg) return;
    var prideRoot = designSvg.querySelector("#pride-auto-merge-root");
    if (!prideRoot) return;
    var fearRoot = designSvg.querySelector("#fear-vertical-grid-root");
    var fanRoot = designSvg.querySelector("#fan-half-circle-root");
    var chromeAnchor = designSvg.querySelector("#layer-edge-brown-bars");
    var insertBeforeNode =
      fanRoot && fanRoot.parentNode === designSvg
        ? fanRoot
        : chromeAnchor;

    if (fearRoot && fearRoot.parentNode === designSvg) {
      if (prideRoot.previousSibling !== fearRoot) {
        designSvg.insertBefore(prideRoot, fearRoot.nextSibling);
      }
    } else if (insertBeforeNode && insertBeforeNode.parentNode === designSvg) {
      if (prideRoot.nextSibling !== insertBeforeNode) {
        designSvg.insertBefore(prideRoot, insertBeforeNode);
      }
    } else if (prideRoot.parentNode !== designSvg) {
      designSvg.appendChild(prideRoot);
    }
  }

  /**
   * Radial fan (half-circle) renders above all emotion markers and Pride.
   */
  function createFanHalfCircleBranch() {
    var root = elSvg("g");
    root.setAttribute("id", "fan-half-circle-root");
    root.setAttribute("transform", getInnerContentTransformAttr());
    root.setAttribute("style", "mix-blend-mode:normal");

    var clippedHalfCircle = createInnerContentClipGroup("inner-clipped-half-circle");
    var halfCircleLayer = elSvg("g");
    halfCircleLayer.setAttribute("id", "layer-half-circle");
    halfCircleLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedHalfCircle.appendChild(halfCircleLayer);
    root.appendChild(clippedHalfCircle);

    return root;
  }

  /** Keep the fan above Pride and below brown-bar chrome. */
  function ensureFanLayerMounted() {
    if (!designSvg) return;
    var fanRoot = designSvg.querySelector("#fan-half-circle-root");
    if (!fanRoot) return;
    var prideRoot = designSvg.querySelector("#pride-auto-merge-root");
    var anchor = designSvg.querySelector("#layer-edge-brown-bars");
    if (prideRoot && prideRoot.parentNode === designSvg) {
      if (fanRoot.parentNode !== designSvg) {
        designSvg.insertBefore(fanRoot, prideRoot.nextSibling);
      } else if (fanRoot.previousSibling !== prideRoot) {
        designSvg.insertBefore(fanRoot, prideRoot.nextSibling);
      }
      return;
    }
    if (anchor && anchor.parentNode === designSvg) {
      designSvg.insertBefore(fanRoot, anchor);
    } else if (fanRoot.parentNode !== designSvg) {
      designSvg.appendChild(fanRoot);
    }
  }

  /**
   * Fear verticals (F1) render above color-division blend tiles.
   */
  function createFearVerticalGridBranch() {
    var root = elSvg("g");
    root.setAttribute("id", "fear-vertical-grid-root");
    root.setAttribute("transform", getInnerContentTransformAttr());
    root.setAttribute("style", "mix-blend-mode:normal");

    var clippedVertical = createInnerContentClipGroup("inner-clipped-vertical-grid");
    var verticalLayer = elSvg("g");
    verticalLayer.setAttribute("id", "layer-vertical-grid");
    verticalLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedVertical.appendChild(verticalLayer);
    root.appendChild(clippedVertical);

    var clippedVerticalOverlay = createInnerContentClipGroup(
      "inner-clipped-vertical-grid-overlay"
    );
    var verticalOverlayLayer = elSvg("g");
    verticalOverlayLayer.setAttribute("id", "layer-vertical-grid-overlay");
    verticalOverlayLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedVerticalOverlay.appendChild(verticalOverlayLayer);
    root.appendChild(clippedVerticalOverlay);

    return root;
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
    ensureLabelBarIconTintFilter(defs);
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

    var clippedHopeMergeFill = createInnerContentClipGroup(
      "inner-clipped-hope-merge-fill"
    );
    var hopeMergeFillLayer = elSvg("g");
    hopeMergeFillLayer.setAttribute("id", "layer-hope-merge-fill");
    clippedHopeMergeFill.appendChild(hopeMergeFillLayer);
    innerContent.appendChild(clippedHopeMergeFill);

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

    var clippedPattern = createInnerContentClipGroup("inner-clipped-pattern");
    var pattern = elSvg("g");
    pattern.setAttribute("id", "layer-pattern");
    pattern.setAttribute("clip-path", "url(#canvas-clip)");
    clippedPattern.appendChild(pattern);
    innerContent.appendChild(clippedPattern);

    var clippedAngerTriangles = createInnerContentClipGroup(
      "inner-clipped-anger-diamond-triangles"
    );
    var angerTriangleLayer = elSvg("g");
    angerTriangleLayer.setAttribute("id", "layer-anger-diamond-triangles");
    angerTriangleLayer.setAttribute("clip-path", "url(#canvas-clip)");
    clippedAngerTriangles.appendChild(angerTriangleLayer);
    innerContent.appendChild(clippedAngerTriangles);

    innerContent.appendChild(createFrameInsetOverlayLayer());

    var colorDivisionsBlendRoot = elSvg("g");
    colorDivisionsBlendRoot.setAttribute("id", "color-divisions-blend-root");
    colorDivisionsBlendRoot.setAttribute("style", "isolation:isolate");
    colorDivisionsBlendRoot.appendChild(innerContent);
    colorDivisionsBlendRoot.appendChild(createColorDivisionsLayer());
    colorDivisionsBlendRoot.appendChild(createGridBoundaryLayer());
    // Medium/Thick margin columns paint over grid + boundary at shared edges.
    colorDivisionsBlendRoot.appendChild(createBorderDivisionOverlayGroup());
    svg.appendChild(colorDivisionsBlendRoot);
    svg.appendChild(createFearVerticalGridBranch());
    svg.appendChild(createPrideAutoMergeBranch());
    svg.appendChild(createFanHalfCircleBranch());

    var edgeBrownBars = elSvg("g");
    edgeBrownBars.setAttribute("id", "layer-edge-brown-bars");
    populateEdgeBrownBarsLayer(edgeBrownBars);
    svg.appendChild(edgeBrownBars);

    svg.appendChild(createBrownBarBannerTextGroup());

    svg.appendChild(createCanvasEdgeSerialGroup());

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
    return 21;
  }

  function getRadialFanRibCount() {
    return typeof RADIAL_FAN_RIB_COUNT !== "undefined"
      ? RADIAL_FAN_RIB_COUNT
      : 25;
  }

  function getFanInnerLeafSizeRatio() {
    var min =
      typeof FAN_LEAF_SIZE_MIN !== "undefined" ? FAN_LEAF_SIZE_MIN : 0;
    var max =
      typeof FAN_LEAF_SIZE_MAX !== "undefined" ? FAN_LEAF_SIZE_MAX : 100;
    var defaultPct =
      typeof FAN_LEAF_SIZE_DEFAULT !== "undefined" ? FAN_LEAF_SIZE_DEFAULT : 90;
    if (max <= min) return 0;
    return (defaultPct - min) / (max - min);
  }

  function fanLeafSizeLerp(atMin, atMax) {
    var ratio = getFanInnerLeafSizeRatio();
    return atMin + (atMax - atMin) * ratio;
  }

  function getHalfCircleInset() {
    var devInput = document.getElementById("half-circle-inset");
    if (devInput) {
      var devRaw = Number(devInput.value);
      if (Number.isFinite(devRaw)) {
        return Math.max(0.02, Math.min(0.4, Math.round(devRaw * 100) / 100));
      }
    }
    var insetMin =
      typeof FAN_LEAF_INSET_AT_MIN !== "undefined" ? FAN_LEAF_INSET_AT_MIN : 0.28;
    var insetMax =
      typeof FAN_LEAF_INSET_AT_MAX !== "undefined" ? FAN_LEAF_INSET_AT_MAX : 0.02;
    return fanLeafSizeLerp(insetMin, insetMax);
  }

  function getHalfCircleInnerTipArcChordFactor() {
    var arcMin =
      typeof FAN_LEAF_TIP_ARC_AT_MIN !== "undefined"
        ? FAN_LEAF_TIP_ARC_AT_MIN
        : 0.48;
    var arcMax =
      typeof FAN_LEAF_TIP_ARC_AT_MAX !== "undefined"
        ? FAN_LEAF_TIP_ARC_AT_MAX
        : 0.85;
    return fanLeafSizeLerp(arcMin, arcMax);
  }

  function getFanInnerLeafLengthScale() {
    var scaleMin =
      typeof FAN_LEAF_LENGTH_SCALE_AT_MIN !== "undefined"
        ? FAN_LEAF_LENGTH_SCALE_AT_MIN
        : 0.58;
    var scaleMax =
      typeof FAN_LEAF_LENGTH_SCALE_AT_MAX !== "undefined"
        ? FAN_LEAF_LENGTH_SCALE_AT_MAX
        : 1;
    return fanLeafSizeLerp(scaleMin, scaleMax);
  }

  function getHalfCircleCuspGapPx() {
    var input = document.getElementById("half-circle-cusp-gap");
    var raw = input ? Number(input.value) : 0;
    if (!Number.isFinite(raw)) raw = 0;
    return Math.max(0, Math.min(40, Math.round(raw)));
  }

  function getHalfCircleMaxPetals() {
    return Math.max(0, getRadialFanRibCount() - 1);
  }

  /** Petals actually drawn when fully open (end sectors trimmed from rib geometry). */
  function getFanEffectiveMaxPetals() {
    var trim = getFanEndSectorTrimCount();
    return Math.max(0, getHalfCircleMaxPetals() - 2 * trim);
  }

  /** Petals shown at slider step max − 1 (4 drawable ribs ⇒ 3 petals). */
  function getFanClosingMinPetals() {
    var minRibs =
      typeof FAN_CLOSING_MIN_RIBS !== "undefined" ? FAN_CLOSING_MIN_RIBS : 4;
    return Math.max(1, minRibs - 1);
  }

  var FAN_SHARED_LEAVES_ID = "fan-leaves";

  function getRadialFanOuterArcScale() {
    return typeof RADIAL_FAN_OUTER_ARC_SCALE_DEFAULT !== "undefined"
      ? RADIAL_FAN_OUTER_ARC_SCALE_DEFAULT
      : 1;
  }

  /** @param {"top" | "bottom"} idPrefix */
  function getFanSliderIds(idPrefix) {
    return {
      leaves: FAN_SHARED_LEAVES_ID,
    };
  }

  function getFanLeavesOpeningStep(sliderId) {
    var input = document.getElementById(sliderId);
    var maxStep =
      typeof WEAR_CONTROL_OPENING_STEP_MAX !== "undefined"
        ? WEAR_CONTROL_OPENING_STEP_MAX
        : 10;
    var defaultStep = 0;
    var raw = input ? Number(input.value) : defaultStep;
    if (!Number.isFinite(raw)) raw = defaultStep;
    return Math.max(0, Math.min(maxStep, Math.round(raw)));
  }

  function getFanLeavesPetalCount(sliderId) {
    var maxPetals = getFanEffectiveMaxPetals();
    var minPetals = getFanClosingMinPetals();
    var step = getFanLeavesOpeningStep(sliderId);
    var maxStep =
      typeof WEAR_CONTROL_OPENING_STEP_MAX !== "undefined"
        ? WEAR_CONTROL_OPENING_STEP_MAX
        : 10;
    if (maxPetals <= 0 || step >= maxStep) return 0;
    if (step <= 0) return maxPetals;
    if (step >= maxStep - 1) return minPetals;
    var openFraction = (maxStep - step - 1) / (maxStep - 1);
    var petals = minPetals + (maxPetals - minPetals) * openFraction;
    return Math.max(minPetals, Math.round(petals));
  }

  /** @param {"top" | "bottom"} idPrefix */
  function getFanInnerArcRadiusRatio(idPrefix) {
    var defaultPct =
      typeof FAN_INNER_ARC_PERCENT_DEFAULT !== "undefined"
        ? FAN_INNER_ARC_PERCENT_DEFAULT
        : 50;
    return defaultPct / 100;
  }

  function getFanOutsideExtraArcGapPx() {
    return typeof FAN_OUTSIDE_EXTRA_ARC_GAP_DEFAULT !== "undefined"
      ? FAN_OUTSIDE_EXTRA_ARC_GAP_DEFAULT
      : 24;
  }

  function snapFanLeavesSlider(slider) {
    if (!slider) return;
    var maxStep =
      typeof WEAR_CONTROL_OPENING_STEP_MAX !== "undefined"
        ? WEAR_CONTROL_OPENING_STEP_MAX
        : 10;
    var step = Math.max(0, Math.min(maxStep, Math.round(Number(slider.value))));
    if (Number(slider.value) !== step) slider.value = String(step);
  }

  function snapFanPercentSlider(slider, min, max) {
    if (!slider) return;
    var value = Math.max(min, Math.min(max, Math.round(Number(slider.value))));
    if (Number(slider.value) !== value) slider.value = String(value);
  }

  function bindFanTuningSlider(slider, options) {
    if (!slider) return;
    var snap = options && options.snap;
    if (snap === "leaves") {
      snapFanLeavesSlider(slider);
    } else if (snap === "percent" && options.min != null && options.max != null) {
      snapFanPercentSlider(slider, options.min, options.max);
    }
    slider.addEventListener("input", function () {
      if (snap === "leaves") snapFanLeavesSlider(slider);
      else if (snap === "percent" && options.min != null && options.max != null) {
        snapFanPercentSlider(slider, options.min, options.max);
      }
      renderHalfCircleLayer();
    });
    slider.addEventListener("change", function () {
      if (snap === "leaves") snapFanLeavesSlider(slider);
      else if (snap === "percent" && options.min != null && options.max != null) {
        snapFanPercentSlider(slider, options.min, options.max);
      }
      renderHalfCircleLayer();
    });
  }

  function bindFanTuningSliders() {
    bindFanTuningSlider(document.getElementById(FAN_SHARED_LEAVES_ID), {
      snap: "leaves",
    });
  }

  function getHalfCircleTopVisiblePetalCount() {
    return getFanLeavesPetalCount(getFanSliderIds("top").leaves);
  }

  function getHalfCircleBottomVisiblePetalCount() {
    return getFanLeavesPetalCount(getFanSliderIds("bottom").leaves);
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
    var arcFactor = inward ? 0.55 : getHalfCircleInnerTipArcChordFactor();
    var rs = Math.max(0.01, chord * arcFactor);
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

    if (gap <= 0 || gap <= minDist) return hiLimit;

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

  /** Circle hit along ray origin → through, beyond the through point. */
  function halfCircleRayCircleHitBeyond(
    circleCx,
    circleCy,
    circleRadius,
    originX,
    originY,
    throughX,
    throughY
  ) {
    var dirX = throughX - originX;
    var dirY = throughY - originY;
    var dirLen = Math.hypot(dirX, dirY);
    if (dirLen < 1e-9) return null;

    var ux = dirX / dirLen;
    var uy = dirY / dirLen;
    var tRing = dirLen;
    var relX = originX - circleCx;
    var relY = originY - circleCy;
    var b = 2 * (relX * ux + relY * uy);
    var c = relX * relX + relY * relY - circleRadius * circleRadius;
    var disc = b * b - 4 * c;
    if (disc < 0) return null;

    var sqrtDisc = Math.sqrt(disc);
    var t1 = (-b - sqrtDisc) * 0.5;
    var t2 = (-b + sqrtDisc) * 0.5;
    var tHit = -1;

    if (t1 > tRing + 1e-6) tHit = Math.max(tHit, t1);
    if (t2 > tRing + 1e-6) tHit = Math.max(tHit, t2);
    if (tHit < 0) {
      if (t1 > 1e-6) tHit = Math.max(tHit, t1);
      if (t2 > 1e-6) tHit = Math.max(tHit, t2);
    }
    if (tHit < 0) return null;

    return { x: originX + tHit * ux, y: originY + tHit * uy };
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
    var trim = getFanEndSectorTrimCount();
    var drawableMax = maxPetals - 2 * trim;
    if (visiblePetals <= 0 || maxPetals <= 0 || drawableMax <= 0) {
      return {
        endpoints: [],
        deltaTheta: full.deltaTheta,
        startAngle: Math.PI,
        endAngle: Math.PI,
        visiblePetals: 0,
      };
    }

    var petalCount = Math.min(visiblePetals, drawableMax);
    var firstRib;
    var lastRib;
    if (anchor === "right") {
      firstRib = maxPetals - trim - petalCount;
      lastRib = maxPetals - trim;
    } else {
      firstRib = trim;
      lastRib = trim + petalCount;
    }
    var visibleEndpoints = full.endpoints.slice(firstRib, lastRib + 1);

    return {
      endpoints: visibleEndpoints,
      deltaTheta: full.deltaTheta,
      startAngle: visibleEndpoints[0].a,
      endAngle: visibleEndpoints[visibleEndpoints.length - 1].a,
      visiblePetals: petalCount,
      firstRib: firstRib,
    };
  }

  /** All rib endpoints (0…maxPetals) for static fan geometry; trim applied later via getFanDrawAngles. */
  function buildHalfCircleFullRibLayout(cx, y, r, ribs, anchor) {
    var full = buildHalfCircleFullEndpoints(cx, y, r, ribs);
    var maxPetals = ribs - 1;
    if (maxPetals <= 0) {
      return {
        endpoints: [],
        deltaTheta: full.deltaTheta,
        startAngle: Math.PI,
        endAngle: Math.PI,
        visiblePetals: 0,
      };
    }

    return {
      endpoints: full.endpoints,
      deltaTheta: full.deltaTheta,
      startAngle: full.endpoints[0].a,
      endAngle: full.endpoints[maxPetals].a,
      visiblePetals: maxPetals,
      firstRib: 0,
    };
  }

  /** Clip layout follows the leaves slider; full layout keeps all fan geometry static. */
  function buildHalfCircleFanClipAndFullLayouts(
    cx,
    y,
    r,
    ribs,
    visiblePetals,
    anchor
  ) {
    var resolvedAnchor = anchor || "left";
    var clipLayout = buildHalfCircleVisibleFanLayout(
      cx,
      y,
      r,
      ribs,
      visiblePetals,
      resolvedAnchor
    );
    var fullLayout = buildHalfCircleFullRibLayout(cx, y, r, ribs, resolvedAnchor);
    return {
      clipLayout: clipLayout,
      fullLayout: fullLayout,
      clipDrawAngles: {
        startAngle: clipLayout.startAngle,
        endAngle: clipLayout.endAngle,
        trimCount: 0,
      },
      fullDrawAngles: getFanDrawAngles(fullLayout),
    };
  }

  function getFanEndSectorTrimCount() {
    return typeof FAN_END_SECTOR_TRIM_COUNT !== "undefined"
      ? FAN_END_SECTOR_TRIM_COUNT
      : 0;
  }

  /** Fill/clip/arc bounds after trimming end sectors (rib 1–2 and last pair). */
  function getFanDrawAngles(layout) {
    var trim = getFanEndSectorTrimCount();
    var endpoints = layout.endpoints;
    if (trim <= 0 || !endpoints || endpoints.length < 2 + trim * 2) {
      return {
        startAngle: layout.startAngle,
        endAngle: layout.endAngle,
        trimCount: 0,
      };
    }
    return {
      startAngle: endpoints[trim].a,
      endAngle: endpoints[endpoints.length - 1 - trim].a,
      trimCount: trim,
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

  /** Base corners stay at baseRadius; outer arc uses outerArcRadius (≤ baseRadius). */
  function halfCircleRadialFanSectorPath(
    cx,
    y,
    baseRadius,
    outerArcRadius,
    startAngle,
    endAngle
  ) {
    if (outerArcRadius >= baseRadius - 0.001) {
      return halfCircleSectorPath(cx, y, baseRadius, startAngle, endAngle);
    }

    var leftBase = halfCirclePolarPoint(cx, y, baseRadius, startAngle);
    var rightBase = halfCirclePolarPoint(cx, y, baseRadius, endAngle);
    var arcFrom = startAngle;
    var arcTo = endAngle;
    if (arcFrom < arcTo) {
      var swap = arcFrom;
      arcFrom = arcTo;
      arcTo = swap;
    }
    var leftArc = halfCirclePolarPoint(cx, y, outerArcRadius, arcFrom);
    var rightArc = halfCirclePolarPoint(cx, y, outerArcRadius, arcTo);
    var span = arcFrom - arcTo;
    var largeArc = span > Math.PI ? 1 : 0;
    return (
      "M " +
      cx +
      " " +
      y +
      " L " +
      leftBase.x +
      " " +
      leftBase.y +
      " L " +
      leftArc.x +
      " " +
      leftArc.y +
      " A " +
      outerArcRadius +
      " " +
      outerArcRadius +
      " 0 " +
      largeArc +
      " 1 " +
      rightArc.x +
      " " +
      rightArc.y +
      " L " +
      rightBase.x +
      " " +
      rightBase.y +
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

  function appendHalfCircleInnerPetalTipArc(d, fx, fy, rInner, p0, p1) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var chord = Math.sqrt(dx * dx + dy * dy);
    var rs = Math.max(0.01, chord * getHalfCircleInnerTipArcChordFactor());
    var sweep = halfCircleOutwardCuspSweep(fx, fy, p0, p1);
    return d + " A " + rs + " " + rs + " 0 0 " + (1 - sweep) + " " + p1.x + " " + p1.y;
  }

  function halfCircleInnerPetalTopCapPath(fx, fy, rInner, inLeft, inRight) {
    var d = "M " + inLeft.x + " " + inLeft.y;
    d = appendHalfCircleInnerPetalTipArc(d, fx, fy, rInner, inLeft, inRight);
    var focalArc = halfCircleAppendFocalArcBetween(d, fx, fy, rInner, inRight, inLeft);
    return (focalArc || d + " L " + inLeft.x + " " + inLeft.y) + " Z";
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
    d = appendHalfCircleInnerPetalTipArc(
      d,
      fx,
      fy,
      petal.rInner,
      petal.inRight,
      petal.inLeft
    );
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

  function halfCirclePetalFaceFillPath(
    fx,
    fy,
    outerP0,
    outerP1,
    inLeft,
    inRight,
    rInner
  ) {
    var d = "M " + fx + " " + fy;
    d += " L " + outerP0.x + " " + outerP0.y;
    d = appendHalfCircleInwardCuspArc(d, outerP0, outerP1);
    d += " L " + fx + " " + fy + " Z";
    d += " M " + fx + " " + fy;
    d += " L " + inLeft.x + " " + inLeft.y;
    d = appendHalfCircleInnerPetalTipArc(d, fx, fy, rInner, inLeft, inRight);
    d += " L " + fx + " " + fy + " Z";
    return d;
  }

  function getHalfCircleArcPairOuterRadius(innerRadius) {
    var gap = HALF_CIRCLE_INNER_ARC_PAIR_GAP_PX * HALF_CIRCLE_RADIUS_SCALE;
    return innerRadius + gap + HALF_CIRCLE_FAN_STROKE_WIDTH;
  }

  /**
   * @returns {{ inner: number, outer: number } | null}
   */
  function getFanOutsideExtraArcPair(outerArcRadius, fanRadius) {
    var offsetPx = getFanOutsideExtraArcGapPx();
    if (offsetPx <= 0) return null;
    var offset = offsetPx * HALF_CIRCLE_RADIUS_SCALE;
    var innerRadius =
      outerArcRadius + offset + HALF_CIRCLE_FAN_STROKE_WIDTH;
    var outerRadius = getHalfCircleArcPairOuterRadius(innerRadius);
    if (innerRadius <= outerArcRadius || outerRadius >= fanRadius - 0.5) {
      return null;
    }
    return { inner: innerRadius, outer: outerRadius };
  }

  function appendHalfCircleFocalArcStroke(
    parent,
    id,
    cx,
    focalY,
    radius,
    startAngle,
    endAngle,
    stroke,
    strokeWidth
  ) {
    var arc = elSvg("path");
    arc.setAttribute("id", id);
    arc.setAttribute(
      "d",
      halfCircleFocalArcPath(cx, focalY, radius, startAngle, endAngle)
    );
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", stroke);
    arc.setAttribute("stroke-width", String(strokeWidth));
    parent.appendChild(arc);
  }

  function appendHalfCircleInnerArcPairStrokes(
    parent,
    idPrefix,
    idSuffix,
    cx,
    focalY,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    stroke,
    strokeWidth
  ) {
    appendHalfCircleFocalArcStroke(
      parent,
      "half-circle-inner-arc-" + idPrefix + idSuffix,
      cx,
      focalY,
      innerRadius,
      startAngle,
      endAngle,
      stroke,
      strokeWidth
    );
    appendHalfCircleFocalArcStroke(
      parent,
      "half-circle-inner-arc-outer-" + idPrefix + idSuffix,
      cx,
      focalY,
      outerRadius,
      startAngle,
      endAngle,
      stroke,
      strokeWidth
    );
  }

  /**
   * @returns {number} next cell index for alternating diagonals
   */
  function appendHalfCircleInnerArcBandDiagonals(
    parentGroup,
    cx,
    focalY,
    innerRadius,
    outerRadius,
    petals,
    stroke,
    strokeWidth,
    startCellIndex
  ) {
    var cellIndex = startCellIndex;
    var pi;
    for (pi = 0; pi < petals.length; pi++) {
      var diagonalPetal = petals[pi];
      if (!diagonalPetal) continue;

      var pointA = halfCirclePolarPoint(
        cx,
        focalY,
        innerRadius,
        diagonalPetal.inLeftAngle
      );
      var pointB = halfCirclePolarPoint(
        cx,
        focalY,
        innerRadius,
        diagonalPetal.inRightAngle
      );
      var pointC = halfCirclePolarPoint(
        cx,
        focalY,
        outerRadius,
        diagonalPetal.inLeftAngle
      );
      var pointD = halfCirclePolarPoint(
        cx,
        focalY,
        outerRadius,
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
      diagonal.setAttribute("stroke", stroke);
      diagonal.setAttribute("stroke-width", String(strokeWidth));
      parentGroup.appendChild(diagonal);
      cellIndex++;
    }
    return cellIndex;
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
    var rs = Math.max(0.01, chord * getHalfCircleInnerTipArcChordFactor());
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
    var rs = Math.max(0.01, chord * getHalfCircleInnerTipArcChordFactor());
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

  function halfCircleStarSilhouettePath(
    cx,
    cy,
    outerRadius,
    tipAngle,
    innerRadius,
    pointCount
  ) {
    var n =
      typeof pointCount === "number" && pointCount >= 3
        ? Math.round(pointCount)
        : 5;
    var innerR =
      typeof innerRadius === "number" && Number.isFinite(innerRadius)
        ? innerRadius
        : outerRadius * 0.75;
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

  /** Outer tips only — for stroke without crossing the star interior. */
  function halfCircleStarTipsOutlinePath(cx, cy, outerRadius, tipAngle, pointCount) {
    var n =
      typeof pointCount === "number" && pointCount >= 3
        ? Math.round(pointCount)
        : 5;
    var d = "";
    var k;
    for (k = 0; k < n; k++) {
      var tip = halfCirclePolarPoint(
        cx,
        cy,
        outerRadius,
        tipAngle - k * 2 * Math.PI / n
      );
      if (k === 0) d = "M " + tip.x + " " + tip.y;
      else d += " L " + tip.x + " " + tip.y;
    }
    return d + " Z";
  }

  function halfCircleStarInnerPentagonPath(
    cx,
    cy,
    innerConcaveRadius,
    tipAngle,
    pointCount
  ) {
    var n =
      typeof pointCount === "number" && pointCount >= 3
        ? Math.round(pointCount)
        : 5;
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

  function halfCircleStarArmTrianglesPath(
    cx,
    cy,
    outerRadius,
    innerConcaveRadius,
    tipAngle,
    pointCount
  ) {
    var n =
      typeof pointCount === "number" && pointCount >= 3
        ? Math.round(pointCount)
        : 5;
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

  function computeHalfCircleValleyCircles(fx, fy, ribs, endpoints, petals, idPrefix) {
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

  function getRadialFanStrokeWidth() {
    return typeof RADIAL_FAN_STROKE_WIDTH !== "undefined"
      ? RADIAL_FAN_STROKE_WIDTH
      : 2;
  }

  /** @param {"top" | "bottom"} idPrefix @returns {number[]} */
  function getRadialFanEvenInnerArcRadii(idPrefix, fanRadius) {
    var count =
      typeof RADIAL_FAN_INNER_ARC_COUNT !== "undefined"
        ? RADIAL_FAN_INNER_ARC_COUNT
        : 6;
    if (count < 1) return [];

    var inwardScale =
      typeof RADIAL_FAN_INNER_ARC_INWARD_SCALE !== "undefined"
        ? RADIAL_FAN_INNER_ARC_INWARD_SCALE
        : 0.38;
    var stepPx =
      typeof RADIAL_FAN_INNER_ARC_STEP_PX !== "undefined"
        ? RADIAL_FAN_INNER_ARC_STEP_PX
        : 11;
    var step = stepPx * HALF_CIRCLE_RADIUS_SCALE;
    var frameInset = getRadialFanStrokeWidth();
    var rStart =
      fanRadius * getFanInnerArcRadiusRatio(idPrefix) * inwardScale;
    var radii = [];
    var i;
    for (i = 0; i < count; i++) {
      var radius = rStart + i * step;
      if (radius >= fanRadius - frameInset) break;
      radii.push(radius);
    }

    var addFrameAdjacent =
      typeof RADIAL_FAN_FRAME_ADJACENT_INNER_ARC !== "undefined"
        ? RADIAL_FAN_FRAME_ADJACENT_INNER_ARC
        : true;
    if (addFrameAdjacent && step > 0) {
      var frameAdjacentRadius = fanRadius - step;
      var innermost = radii.length ? radii[radii.length - 1] : 0;
      if (
        frameAdjacentRadius > innermost + 0.5 &&
        frameAdjacentRadius < fanRadius - frameInset
      ) {
        radii.push(frameAdjacentRadius);

        var addFrameInward =
          typeof RADIAL_FAN_FRAME_INWARD_ARC !== "undefined"
            ? RADIAL_FAN_FRAME_INWARD_ARC
            : true;
        var inwardMultiplier =
          typeof RADIAL_FAN_FRAME_INWARD_ARC_STEP_MULTIPLIER !== "undefined"
            ? RADIAL_FAN_FRAME_INWARD_ARC_STEP_MULTIPLIER
            : 2;
        if (addFrameInward && inwardMultiplier > 0) {
          var frameInwardRadius =
            frameAdjacentRadius - inwardMultiplier * step;
          if (
            frameInwardRadius > innermost + 0.5 &&
            frameInwardRadius > 0
          ) {
            radii.push(frameInwardRadius);
          }
        }
      }
    }
    return radii;
  }

  /** Standalone middle arc + almost-outer frame arc (not part of the tight inner group). */
  function getRadialFanFrameArcRadii(innerArcRadii) {
    if (!innerArcRadii || !innerArcRadii.length) {
      return { middleStandalone: 0, almostOuter: 0 };
    }

    var addFrameAdjacent =
      typeof RADIAL_FAN_FRAME_ADJACENT_INNER_ARC !== "undefined"
        ? RADIAL_FAN_FRAME_ADJACENT_INNER_ARC
        : true;
    var addFrameInward =
      typeof RADIAL_FAN_FRAME_INWARD_ARC !== "undefined"
        ? RADIAL_FAN_FRAME_INWARD_ARC
        : true;
    var almostOuter = 0;
    var middleStandalone = 0;

    if (addFrameInward && innerArcRadii.length >= 1) {
      middleStandalone = innerArcRadii[innerArcRadii.length - 1];
    }
    if (addFrameAdjacent && innerArcRadii.length >= 1) {
      almostOuter =
        addFrameInward && innerArcRadii.length >= 2
          ? innerArcRadii[innerArcRadii.length - 2]
          : innerArcRadii[innerArcRadii.length - 1];
    }

    return { middleStandalone: middleStandalone, almostOuter: almostOuter };
  }

  /** Lowest valid radius for the middle standalone arc (between inner group and almost-outer). */
  function getRadialFanMiddleStandaloneArcBounds(innerArcRadii) {
    if (!innerArcRadii || innerArcRadii.length < 2) {
      return { minRadius: 0, maxRadius: 0 };
    }

    var inwardIdx = innerArcRadii.length - 1;
    var adjacentIdx = inwardIdx - 1;
    var almostOuter = innerArcRadii[adjacentIdx];
    var innerMax = 0;
    var i;
    for (i = 0; i < adjacentIdx; i++) {
      if (innerArcRadii[i] > innerMax) innerMax = innerArcRadii[i];
    }

    return {
      minRadius: innerMax + 0.51,
      maxRadius: almostOuter - 0.51,
    };
  }

  /** Lower the middle standalone arc to pass through elevated-ring centers. */
  function setRadialFanMiddleStandaloneArcRadius(innerArcRadii, radius) {
    if (!innerArcRadii || innerArcRadii.length < 3 || radius <= 0) return;

    var addFrameInward =
      typeof RADIAL_FAN_FRAME_INWARD_ARC !== "undefined"
        ? RADIAL_FAN_FRAME_INWARD_ARC
        : true;
    if (!addFrameInward) return;

    var bounds = getRadialFanMiddleStandaloneArcBounds(innerArcRadii);
    if (radius <= bounds.minRadius || radius >= bounds.maxRadius) return;

    innerArcRadii[innerArcRadii.length - 1] = radius;
  }

  /** Middle standalone arc passes through elevated-ring centers (rib-based seat). */
  function syncRadialFanMiddleStandaloneArcWithElevatedRings(
    innerArcRadii,
    endpoints,
    almostOuterArcRadius
  ) {
    if (!innerArcRadii || !endpoints || endpoints.length < 5) return;
    if (almostOuterArcRadius <= 0) return;

    var outerRibFromEnd =
      typeof RADIAL_FAN_ELEVATED_RING_OUTER_RIB_FROM_END !== "undefined"
        ? RADIAL_FAN_ELEVATED_RING_OUTER_RIB_FROM_END
        : 4;
    var innerRibFromEnd =
      typeof RADIAL_FAN_ELEVATED_RING_INNER_RIB_FROM_END !== "undefined"
        ? RADIAL_FAN_ELEVATED_RING_INNER_RIB_FROM_END
        : 7;
    var ribAngles = getRadialFanElevatedRingRibAngles(
      endpoints,
      outerRibFromEnd,
      innerRibFromEnd,
      true
    );
    if (!ribAngles || ribAngles.halfAngleSpan <= 0) return;

    var seat = getRadialFanElevatedRingSeatOnAlmostOuterArc(
      almostOuterArcRadius,
      ribAngles.halfAngleSpan
    );
    if (seat.centerDist <= 0) return;

    setRadialFanMiddleStandaloneArcRadius(innerArcRadii, seat.centerDist);
  }

  /** Valid radius range for the 6th inner arc (largest in the tight inner group). */
  function getRadialFanSixthInnerArcBounds(innerArcRadii) {
    var sixthIndex =
      typeof RADIAL_FAN_SIXTH_ARC_DIAGONAL_ARC_INDEX !== "undefined"
        ? RADIAL_FAN_SIXTH_ARC_DIAGONAL_ARC_INDEX
        : (typeof RADIAL_FAN_INNER_ARC_COUNT !== "undefined"
            ? RADIAL_FAN_INNER_ARC_COUNT
            : 6) - 1;
    if (!innerArcRadii || innerArcRadii.length <= sixthIndex) {
      return { minRadius: 0, maxRadius: 0, sixthIndex: sixthIndex };
    }

    var innerCount =
      typeof RADIAL_FAN_INNER_ARC_COUNT !== "undefined"
        ? RADIAL_FAN_INNER_ARC_COUNT
        : 6;
    var prevIdx = sixthIndex - 1;
    var nextIdx = innerCount;
    var minRadius = prevIdx >= 0 ? innerArcRadii[prevIdx] + 0.51 : 0;
    var maxRadius =
      innerArcRadii.length > nextIdx
        ? innerArcRadii[nextIdx] - 0.51
        : innerArcRadii[sixthIndex] + 1e6;

    return { minRadius: minRadius, maxRadius: maxRadius, sixthIndex: sixthIndex };
  }

  /** Move the 6th inner arc so it passes through base-row ring centers. */
  function setRadialFanSixthInnerArcRadius(innerArcRadii, radius) {
    if (!innerArcRadii || radius <= 0) return;

    var bounds = getRadialFanSixthInnerArcBounds(innerArcRadii);
    if (
      bounds.sixthIndex < 0 ||
      bounds.sixthIndex >= innerArcRadii.length ||
      radius <= bounds.minRadius ||
      radius >= bounds.maxRadius
    ) {
      return;
    }

    innerArcRadii[bounds.sixthIndex] = radius;
  }

  /** 6th inner arc passes through every base-row ring center (3rd-arc seat + ring radius). */
  function syncRadialFanSixthInnerArcWithBaseRowRings(innerArcRadii, endpoints) {
    if (!innerArcRadii || !endpoints || endpoints.length < 5) return;

    var thirdArcIndex =
      typeof RADIAL_FAN_THIRD_ARC_RING_ARC_INDEX !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_ARC_INDEX
        : 2;
    if (innerArcRadii.length <= thirdArcIndex) return;

    var ringCount =
      typeof RADIAL_FAN_THIRD_ARC_RING_COUNT !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_COUNT
        : 5;
    var thirdArcRadius = innerArcRadii[thirdArcIndex];
    var baseLayout = getRadialFanBaseRowRingLayout(
      endpoints,
      thirdArcRadius,
      ringCount
    );
    if (!baseLayout || baseLayout.ringRadius <= 0) return;

    setRadialFanSixthInnerArcRadius(
      innerArcRadii,
      thirdArcRadius + baseLayout.ringRadius
    );
  }

  function getRadialFanMiddleBandDotRadius() {
    var dotSize =
      typeof RADIAL_FAN_MIDDLE_BAND_DOT_SIZE !== "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_DOT_SIZE
        : 2;
    return dotSize / 2;
  }

  function getRadialFanMiddleBandMinDotDistance() {
    var dotSize =
      typeof RADIAL_FAN_MIDDLE_BAND_DOT_SIZE !== "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_DOT_SIZE
        : 2;
    var spacing =
      typeof RADIAL_FAN_MIDDLE_BAND_DOT_SPACING !== "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_DOT_SPACING
        : 2;
    return dotSize + spacing;
  }

  function hashFanMiddleBandSeed(str) {
    var h = 2166136261;
    var i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function getRadialFanMiddleBandTriangleBbox(points) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var i;
    for (i = 0; i < points.length; i++) {
      var p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /** Random dots clipped to one middle-band triangle (seeded for stable re-renders). */
  function appendRadialFanMiddleBandTriangleStipple(
    parentGroup,
    triangleId,
    pathD,
    bboxPoints,
    dotColor,
    seed
  ) {
    var clipId = "radial-fan-middle-band-clip-" + triangleId;
    var clip = elSvg("clipPath");
    clip.setAttribute("id", clipId);
    var clipPath = elSvg("path");
    clipPath.setAttribute("d", pathD);
    clip.appendChild(clipPath);
    parentGroup.appendChild(clip);

    var bbox = getRadialFanMiddleBandTriangleBbox(bboxPoints);
    var radius = getRadialFanMiddleBandDotRadius();
    var minDist = getRadialFanMiddleBandMinDotDistance();
    var minDistSq = minDist * minDist;
    var padding = radius + 1;
    var area = Math.max(1, bbox.width * bbox.height);
    var targetCount = Math.max(2, Math.round(area / (minDist * minDist * 0.65)));
    var rng = createSeededRandom(seed);
    var dots = [];
    var maxAttempts = targetCount * 50;
    var attempts = 0;

    while (dots.length < targetCount && attempts < maxAttempts) {
      attempts++;
      var x = bbox.minX - padding + rng() * (bbox.width + padding * 2);
      var y = bbox.minY - padding + rng() * (bbox.height + padding * 2);
      var ok = true;
      var di;
      for (di = 0; di < dots.length; di++) {
        var dx = x - dots[di].x;
        var dy = y - dots[di].y;
        if (dx * dx + dy * dy < minDistSq) {
          ok = false;
          break;
        }
      }
      if (ok) dots.push({ x: x, y: y });
    }

    var dotGroup = elSvg("g");
    dotGroup.setAttribute("id", "radial-fan-middle-band-dots-" + triangleId);
    dotGroup.setAttribute("clip-path", "url(#" + clipId + ")");
    dotGroup.setAttribute("fill", dotColor);
    dotGroup.setAttribute("stroke", "none");

    var ci;
    for (ci = 0; ci < dots.length; ci++) {
      var circle = elSvg("circle");
      circle.setAttribute("cx", String(dots[ci].x));
      circle.setAttribute("cy", String(dots[ci].y));
      circle.setAttribute("r", String(radius));
      dotGroup.appendChild(circle);
    }
    parentGroup.appendChild(dotGroup);
  }

  function getRadialFanMiddleRibIndex(endpoints) {
    if (!endpoints || endpoints.length < 3) return -1;
    return Math.floor((endpoints.length - 1) * 0.5);
  }

  /** Rib endpoint index counted from a fan end (same convention as elevated rings). */
  function getRadialFanRibIndexFromFanEnd(endpoints, offsetFromEnd, fromLeftEnd) {
    if (!endpoints || offsetFromEnd < 0) return -1;
    var endpointCount = endpoints.length;
    var idx = fromLeftEnd
      ? offsetFromEnd
      : endpointCount - 1 - offsetFromEnd;
    return idx >= 0 && idx < endpointCount ? idx : -1;
  }

  /**
   * Lower right-angle triangle: curved base on the middle standalone arc,
   * radial leg on the outer rib, diagonal as the third edge.
   */
  function radialFanMiddleRibLowerTriangleFillPath(
    cx,
    focalY,
    innerRadius,
    innerAtLeftRib,
    innerAtRightRib,
    outerAtOuterRib
  ) {
    var d = "M " + innerAtLeftRib.x + " " + innerAtLeftRib.y;
    d = halfCircleAppendFocalArcBetween(
      d,
      cx,
      focalY,
      innerRadius,
      innerAtLeftRib,
      innerAtRightRib
    );
    d += " L " + outerAtOuterRib.x + " " + outerAtOuterRib.y;
    return d + " L " + innerAtLeftRib.x + " " + innerAtLeftRib.y + " Z";
  }

  /** First cell index of each facing triangle-pair along the middle band. */
  function getRadialFanMiddleBandFillPairStarts(midIdx, cellCount) {
    var gapCells =
      typeof RADIAL_FAN_MIDDLE_BAND_FILL_GAP_CELLS !== "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_FILL_GAP_CELLS
        : 1;
    var pairCells = 2;
    var step = pairCells + gapCells;
    var starts = [];
    var gi;

    if (midIdx - 1 >= 0 && midIdx < cellCount) {
      starts.push(midIdx - 1);
    }

    for (gi = midIdx + 1 + gapCells; gi + pairCells - 1 < cellCount; gi += step) {
      starts.push(gi);
    }

    for (gi = midIdx - 1 - gapCells - pairCells; gi >= 0; gi -= step) {
      starts.push(gi);
    }

    return trimRadialFanMiddleBandPairStarts(starts, midIdx);
  }

  function trimRadialFanMiddleBandPairStarts(starts, midIdx) {
    var trimFromStart =
      typeof RADIAL_FAN_MIDDLE_BAND_TRIM_SECOND_PAIR_FROM_START !== "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_TRIM_SECOND_PAIR_FROM_START
        : false;
    var trimFromEnd =
      typeof RADIAL_FAN_MIDDLE_BAND_TRIM_SECOND_PAIR_FROM_END !== "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_TRIM_SECOND_PAIR_FROM_END
        : false;
    if (!trimFromStart && !trimFromEnd) return starts;

    var centerStart = midIdx - 1;
    var left = [];
    var right = [];
    var center = [];
    var i;

    for (i = 0; i < starts.length; i++) {
      if (starts[i] === centerStart) center.push(starts[i]);
      else if (starts[i] < centerStart) left.push(starts[i]);
      else right.push(starts[i]);
    }

    left.sort(function (a, b) {
      return a - b;
    });
    right.sort(function (a, b) {
      return a - b;
    });

    if (trimFromStart && left.length >= 2) {
      left.splice(1, 1);
    }
    if (trimFromEnd && right.length >= 2) {
      right.splice(right.length - 2, 1);
    }

    return center.concat(left, right);
  }

  /** Two lower triangles + diagonals meeting at the shared rib on the middle arc. */
  function appendRadialFanMiddleBandFacingPair(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    innerRadius,
    outerRadius,
    endpoints,
    pairStartCell,
    dotColor,
    stroke,
    strokeWidth
  ) {
    var leftCell = pairStartCell;
    var sharedRib = leftCell + 1;
    var rightCell = leftCell + 1;
    if (sharedRib + 1 >= endpoints.length) return;

    var innerAtLeft = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[leftCell].a
    );
    var innerAtShared = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[sharedRib].a
    );
    var innerAtRight = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[sharedRib + 1].a
    );
    var outerAtLeft = halfCirclePolarPoint(
      cx,
      focalY,
      outerRadius,
      endpoints[leftCell].a
    );
    var outerAtRight = halfCirclePolarPoint(
      cx,
      focalY,
      outerRadius,
      endpoints[sharedRib + 1].a
    );

    var leftTriangleId = idPrefix + "-" + leftCell;
    var leftPath = radialFanMiddleRibLowerTriangleFillPath(
      cx,
      focalY,
      innerRadius,
      innerAtLeft,
      innerAtShared,
      outerAtLeft
    );
    var leftFill = elSvg("path");
    leftFill.setAttribute(
      "id",
      "radial-fan-middle-band-fill-" + leftTriangleId
    );
    leftFill.setAttribute("d", leftPath);
    leftFill.setAttribute("fill", dotColor);
    leftFill.setAttribute("stroke", "none");
    parentGroup.appendChild(leftFill);

    var rightTriangleId = idPrefix + "-" + rightCell;
    var rightPath = radialFanMiddleRibLowerTriangleFillPath(
      cx,
      focalY,
      innerRadius,
      innerAtShared,
      innerAtRight,
      outerAtRight
    );
    var rightFill = elSvg("path");
    rightFill.setAttribute(
      "id",
      "radial-fan-middle-band-fill-" + rightTriangleId
    );
    rightFill.setAttribute("d", rightPath);
    rightFill.setAttribute("fill", dotColor);
    rightFill.setAttribute("stroke", "none");
    parentGroup.appendChild(rightFill);

    var leftDiag = elSvg("line");
    leftDiag.setAttribute(
      "id",
      "radial-fan-middle-band-diagonal-" + idPrefix + "-" + leftCell
    );
    leftDiag.setAttribute("x1", String(outerAtLeft.x));
    leftDiag.setAttribute("y1", String(outerAtLeft.y));
    leftDiag.setAttribute("x2", String(innerAtShared.x));
    leftDiag.setAttribute("y2", String(innerAtShared.y));
    leftDiag.setAttribute("stroke", stroke);
    leftDiag.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(leftDiag);

    var rightDiag = elSvg("line");
    rightDiag.setAttribute(
      "id",
      "radial-fan-middle-band-diagonal-" + idPrefix + "-" + rightCell
    );
    rightDiag.setAttribute("x1", String(innerAtShared.x));
    rightDiag.setAttribute("y1", String(innerAtShared.y));
    rightDiag.setAttribute("x2", String(outerAtRight.x));
    rightDiag.setAttribute("y2", String(outerAtRight.y));
    rightDiag.setAttribute("stroke", stroke);
    rightDiag.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(rightDiag);
  }

  /** One stippled end-cap triangle + diagonal in the middle band. */
  function appendRadialFanMiddleBandEndCapTriangle(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    innerRadius,
    outerRadius,
    endpoints,
    outerFromEnd,
    innerFromEnd,
    fromLeftEnd,
    capSuffix,
    fillColor,
    stroke,
    strokeWidth,
    flipDiagonal
  ) {
    var outerRibIdx = getRadialFanRibIndexFromFanEnd(
      endpoints,
      outerFromEnd,
      fromLeftEnd
    );
    var innerRibIdx = getRadialFanRibIndexFromFanEnd(
      endpoints,
      innerFromEnd,
      fromLeftEnd
    );
    if (outerRibIdx < 0 || innerRibIdx < 0 || outerRibIdx === innerRibIdx) {
      return;
    }

    var arcLeftIdx = Math.min(outerRibIdx, innerRibIdx);
    var arcRightIdx = Math.max(outerRibIdx, innerRibIdx);
    var innerAtLeft = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[arcLeftIdx].a
    );
    var innerAtRight = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[arcRightIdx].a
    );

    var diagTopRibIdx = flipDiagonal ? innerRibIdx : outerRibIdx;
    var diagBottomRibIdx = flipDiagonal ? outerRibIdx : innerRibIdx;
    var outerAtStart = halfCirclePolarPoint(
      cx,
      focalY,
      outerRadius,
      endpoints[diagTopRibIdx].a
    );
    var innerAtEnd = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[diagBottomRibIdx].a
    );

    var sideSuffix = fromLeftEnd ? "start" : "end";
    var idSuffix = capSuffix ? sideSuffix + "-" + capSuffix : sideSuffix;
    var fillPath = radialFanMiddleRibLowerTriangleFillPath(
      cx,
      focalY,
      innerRadius,
      innerAtLeft,
      innerAtRight,
      outerAtStart
    );
    var endCapTriangleId = idPrefix + "-" + idSuffix;
    appendRadialFanMiddleBandTriangleStipple(
      parentGroup,
      endCapTriangleId,
      fillPath,
      [innerAtLeft, innerAtRight, outerAtStart],
      fillColor,
      hashFanMiddleBandSeed("middle-band-end-cap-" + endCapTriangleId)
    );

    var diagonal = elSvg("line");
    diagonal.setAttribute(
      "id",
      "radial-fan-middle-band-end-cap-diagonal-" + idPrefix + "-" + idSuffix
    );
    diagonal.setAttribute("x1", String(outerAtStart.x));
    diagonal.setAttribute("y1", String(outerAtStart.y));
    diagonal.setAttribute("x2", String(innerAtEnd.x));
    diagonal.setAttribute("y2", String(innerAtEnd.y));
    diagonal.setAttribute("stroke", stroke);
    diagonal.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(diagonal);
  }

  /**
   * End-cap diagonals + stippled right triangles at each fan end
   * (inner pair + outermost last/first rib pair).
   */
  function appendRadialFanMiddleBandEndCapDiagonals(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    innerArcRadii,
    endpoints,
    stroke,
    strokeWidth
  ) {
    var frameArcs = getRadialFanFrameArcRadii(innerArcRadii);
    var innerRadius = frameArcs.middleStandalone;
    var outerRadius = frameArcs.almostOuter;
    if (
      innerRadius <= 0 ||
      outerRadius <= 0 ||
      innerRadius >= outerRadius - 0.5 ||
      !endpoints ||
      endpoints.length < 4
    ) {
      return;
    }

    var innerCapOuterFromEnd =
      typeof RADIAL_FAN_MIDDLE_BAND_END_CAP_DIAG_OUTER_RIB_FROM_END !==
      "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_END_CAP_DIAG_OUTER_RIB_FROM_END
        : 8;
    var innerCapInnerFromEnd =
      typeof RADIAL_FAN_MIDDLE_BAND_END_CAP_DIAG_INNER_RIB_FROM_END !==
      "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_END_CAP_DIAG_INNER_RIB_FROM_END
        : 7;
    var outermostCapOuterFromEnd =
      typeof RADIAL_FAN_MIDDLE_BAND_OUTERMOST_CAP_DIAG_OUTER_RIB_FROM_END !==
      "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_OUTERMOST_CAP_DIAG_OUTER_RIB_FROM_END
        : Math.max(1, getFanEndSectorTrimCount());
    var outermostCapInnerFromEnd =
      typeof RADIAL_FAN_MIDDLE_BAND_OUTERMOST_CAP_DIAG_INNER_RIB_FROM_END !==
      "undefined"
        ? RADIAL_FAN_MIDDLE_BAND_OUTERMOST_CAP_DIAG_INNER_RIB_FROM_END
        : outermostCapOuterFromEnd + 1;
    var fillColor = stroke;
    var endSpecs = [{ fromLeftEnd: true }, { fromLeftEnd: false }];
    var capPairs = [
      {
        outerFromEnd: innerCapOuterFromEnd,
        innerFromEnd: innerCapInnerFromEnd,
        capSuffix: "",
        flipDiagonal: false,
      },
      {
        outerFromEnd: outermostCapOuterFromEnd,
        innerFromEnd: outermostCapInnerFromEnd,
        capSuffix: "outermost",
        flipDiagonal: true,
      },
    ];
    var si;
    var ci;

    for (si = 0; si < endSpecs.length; si++) {
      for (ci = 0; ci < capPairs.length; ci++) {
        appendRadialFanMiddleBandEndCapTriangle(
          parentGroup,
          idPrefix,
          cx,
          focalY,
          innerRadius,
          outerRadius,
          endpoints,
          capPairs[ci].outerFromEnd,
          capPairs[ci].innerFromEnd,
          endSpecs[si].fromLeftEnd,
          capPairs[ci].capSuffix,
          fillColor,
          stroke,
          strokeWidth,
          capPairs[ci].flipDiagonal
        );
      }
    }
  }

  /**
   * Solid-filled lower triangles + diagonals on the band between the middle standalone arc
   * and the almost-outer arc — center pair plus mirrored pairs every 2+gap cells.
   */
  function appendRadialFanMiddleRibAdjacentDiagonals(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    innerArcRadii,
    endpoints,
    stroke,
    strokeWidth
  ) {
    var frameArcs = getRadialFanFrameArcRadii(innerArcRadii);
    var innerRadius = frameArcs.middleStandalone;
    var outerRadius = frameArcs.almostOuter;
    if (
      innerRadius <= 0 ||
      outerRadius <= 0 ||
      innerRadius >= outerRadius - 0.5 ||
      !endpoints ||
      endpoints.length < 4
    ) {
      return;
    }

    var midIdx = getRadialFanMiddleRibIndex(endpoints);
    var cellCount = endpoints.length - 1;
    if (midIdx < 1 || midIdx >= cellCount) return;

    var dotColor = stroke;
    var pairStarts = getRadialFanMiddleBandFillPairStarts(midIdx, cellCount);
    var pi;
    for (pi = 0; pi < pairStarts.length; pi++) {
      appendRadialFanMiddleBandFacingPair(
        parentGroup,
        idPrefix,
        cx,
        focalY,
        innerRadius,
        outerRadius,
        endpoints,
        pairStarts[pi],
        dotColor,
        stroke,
        strokeWidth
      );
    }
  }

  /**
   * Mirrored center diagonals: almost-outer arc top → inner-arc bottom one rib toward center.
   * Left: two ribs left of middle → one rib left; right: two ribs right → one rib right.
   */
  function appendRadialFanMiddleRibCenterDiagonals(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    outerRadius,
    innerArcRadii,
    endpoints,
    stroke,
    strokeWidth
  ) {
    if (!endpoints || endpoints.length < 4 || !innerArcRadii) return;

    var frameArcs = getRadialFanFrameArcRadii(innerArcRadii);
    var innerRadius = frameArcs.middleStandalone;
    var startRadius = frameArcs.almostOuter;
    if (
      innerRadius <= 0 ||
      startRadius <= 0 ||
      startRadius <= innerRadius
    ) {
      return;
    }

    var midIdx = getRadialFanMiddleRibIndex(endpoints);
    var diag1StartOffset =
      typeof RADIAL_FAN_CENTER_DIAG_1_START_RIB_OFFSET !== "undefined"
        ? RADIAL_FAN_CENTER_DIAG_1_START_RIB_OFFSET
        : 2;
    var diag1EndOffset =
      typeof RADIAL_FAN_CENTER_DIAG_1_END_RIB_OFFSET !== "undefined"
        ? RADIAL_FAN_CENTER_DIAG_1_END_RIB_OFFSET
        : 1;
    var diag2StartOffset =
      typeof RADIAL_FAN_CENTER_DIAG_2_START_RIB_OFFSET !== "undefined"
        ? RADIAL_FAN_CENTER_DIAG_2_START_RIB_OFFSET
        : -2;
    var diag2EndOffset =
      typeof RADIAL_FAN_CENTER_DIAG_2_END_RIB_OFFSET !== "undefined"
        ? RADIAL_FAN_CENTER_DIAG_2_END_RIB_OFFSET
        : -1;

    var diag1StartIdx = midIdx + diag1StartOffset;
    var diag1EndIdx = midIdx + diag1EndOffset;
    var diag2StartIdx = midIdx + diag2StartOffset;
    var diag2EndIdx = midIdx + diag2EndOffset;

    if (
      diag1StartIdx < 0 ||
      diag1StartIdx >= endpoints.length ||
      diag1EndIdx < 0 ||
      diag1EndIdx >= endpoints.length ||
      diag2StartIdx < 0 ||
      diag2StartIdx >= endpoints.length ||
      diag2EndIdx < 0 ||
      diag2EndIdx >= endpoints.length
    ) {
      return;
    }

    var diag1Start = halfCirclePolarPoint(
      cx,
      focalY,
      startRadius,
      endpoints[diag1StartIdx].a
    );
    var diag1End = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[diag1EndIdx].a
    );
    var diag2Start = halfCirclePolarPoint(
      cx,
      focalY,
      startRadius,
      endpoints[diag2StartIdx].a
    );
    var diag2End = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[diag2EndIdx].a
    );

    var innerAtDiag1Start = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[diag1StartIdx].a
    );
    var innerAtDiag2Start = halfCirclePolarPoint(
      cx,
      focalY,
      innerRadius,
      endpoints[diag2StartIdx].a
    );
    var fillColor = stroke;

    var rightTriangleId = idPrefix + "-center-right";
    var rightPath = radialFanMiddleRibLowerTriangleFillPath(
      cx,
      focalY,
      innerRadius,
      diag1End,
      innerAtDiag1Start,
      diag1Start
    );
    appendRadialFanMiddleBandTriangleStipple(
      parentGroup,
      rightTriangleId,
      rightPath,
      [diag1End, innerAtDiag1Start, diag1Start],
      fillColor,
      hashFanMiddleBandSeed("middle-band-" + rightTriangleId)
    );

    var leftTriangleId = idPrefix + "-center-left";
    var leftPath = radialFanMiddleRibLowerTriangleFillPath(
      cx,
      focalY,
      innerRadius,
      diag2End,
      innerAtDiag2Start,
      diag2Start
    );
    appendRadialFanMiddleBandTriangleStipple(
      parentGroup,
      leftTriangleId,
      leftPath,
      [diag2End, innerAtDiag2Start, diag2Start],
      fillColor,
      hashFanMiddleBandSeed("middle-band-" + leftTriangleId)
    );

    var diagonal1 = elSvg("line");
    diagonal1.setAttribute(
      "id",
      "radial-fan-center-diagonal-" + idPrefix + "-1"
    );
    diagonal1.setAttribute("x1", String(diag1Start.x));
    diagonal1.setAttribute("y1", String(diag1Start.y));
    diagonal1.setAttribute("x2", String(diag1End.x));
    diagonal1.setAttribute("y2", String(diag1End.y));
    diagonal1.setAttribute("stroke", stroke);
    diagonal1.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(diagonal1);

    var diagonal2 = elSvg("line");
    diagonal2.setAttribute(
      "id",
      "radial-fan-center-diagonal-" + idPrefix + "-2"
    );
    diagonal2.setAttribute("x1", String(diag2Start.x));
    diagonal2.setAttribute("y1", String(diag2Start.y));
    diagonal2.setAttribute("x2", String(diag2End.x));
    diagonal2.setAttribute("y2", String(diag2End.y));
    diagonal2.setAttribute("stroke", stroke);
    diagonal2.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(diagonal2);
  }

  /**
   * Angles along the arc where ring bottoms stay inside the fan sector
   * (clear of base line and left/right boundary rays).
   * @returns {number[]}
   */
  function getRadialFanThirdArcRingAngles(
    arcRadius,
    ringRadius,
    startAngle,
    endAngle,
    ringCount
  ) {
    if (ringCount < 1 || ringRadius <= 0) return [];

    var centerDist = arcRadius + ringRadius;
    var lateralInset = Math.atan2(ringRadius, centerDist);
    var baseInset = Math.asin(Math.min(1, ringRadius / centerDist));

    var arcFrom = startAngle;
    var arcTo = endAngle;
    var thetaLow = arcTo + lateralInset;
    var thetaHigh = arcFrom - lateralInset;
    thetaLow = Math.max(thetaLow, baseInset);
    thetaHigh = Math.min(thetaHigh, Math.PI - baseInset);

    if (thetaLow >= thetaHigh) {
      return [Math.max(thetaLow, Math.min(thetaHigh, Math.PI / 2))];
    }

    var span = thetaHigh - thetaLow;
    if (ringCount === 1) {
      return [(thetaLow + thetaHigh) * 0.5];
    }

    // Min center-to-center angle so ring circles do not overlap on the arc.
    var minGap = 2 * Math.asin(Math.min(1, ringRadius / centerDist));
    var gapMargin =
      typeof RADIAL_FAN_THIRD_ARC_RING_GAP_MARGIN !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_GAP_MARGIN
        : 1.2;
    var minRingGap = minGap * gapMargin;
    var edgeMarginRatio =
      typeof RADIAL_FAN_THIRD_ARC_RING_EDGE_MARGIN_RATIO !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_EDGE_MARGIN_RATIO
        : 0.08;
    var edgeMargin = span * edgeMarginRatio;

    var innerLow = thetaLow + edgeMargin;
    var innerHigh = thetaHigh - edgeMargin;
    var innerSpan = innerHigh - innerLow;
    if (innerSpan <= 0) {
      return [(thetaLow + thetaHigh) * 0.5];
    }

    var ringGap = innerSpan / (ringCount - 1);
    var rowSpan = ringGap * (ringCount - 1);
    var firstAngle = innerLow;

    if (ringGap < minRingGap) {
      ringGap = minRingGap;
      rowSpan = ringGap * (ringCount - 1);
      firstAngle = innerLow + (innerSpan - rowSpan) * 0.5;
    }

    var angles = [];
    var ri;
    for (ri = 0; ri < ringCount; ri++) {
      angles.push(firstAngle + ri * ringGap);
    }
    return angles;
  }

  function getRadialFanRibSpanFromIndices(endpoints, outerIdx, innerIdx) {
    if (
      !endpoints ||
      outerIdx < 0 ||
      innerIdx < 0 ||
      outerIdx >= endpoints.length ||
      innerIdx >= endpoints.length
    ) {
      return null;
    }

    var angleHigh = Math.max(endpoints[outerIdx].a, endpoints[innerIdx].a);
    var angleLow = Math.min(endpoints[outerIdx].a, endpoints[innerIdx].a);
    return {
      midAngle: (angleHigh + angleLow) * 0.5,
      halfAngleSpan: (angleHigh - angleLow) * 0.5,
    };
  }

  /** Ring radius for a circle seated on arcRadius with sides tangent to rib rays. */
  function getRadialFanArcSeatedRingRadius(arcRadius, halfAngleSpan) {
    var sinBeta = Math.sin(Math.max(0, halfAngleSpan));
    if (sinBeta >= 1 - 1e-9) return 0;
    return (arcRadius * sinBeta) / (1 - sinBeta);
  }

  /**
   * Base row: all 5 rings each span 5 ribs; rings 2 and 4 flank the center ring.
   * @returns {{ angles: number[], ringRadius: number } | null}
   */
  function getRadialFanBaseRowRingLayout(endpoints, arcRadius, ringCount) {
    if (!endpoints || endpoints.length < 5 || ringCount !== 5 || arcRadius <= 0) {
      return null;
    }

    var midIdx = getRadialFanMiddleRibIndex(endpoints);
    var endpointCount = endpoints.length;
    var endOuterFromEnd =
      typeof RADIAL_FAN_BASE_ROW_END_OUTER_RIB_FROM_END !== "undefined"
        ? RADIAL_FAN_BASE_ROW_END_OUTER_RIB_FROM_END
        : 1;
    var endInnerFromEnd =
      typeof RADIAL_FAN_BASE_ROW_END_INNER_RIB_FROM_END !== "undefined"
        ? RADIAL_FAN_BASE_ROW_END_INNER_RIB_FROM_END
        : 5;
    var startOuter =
      typeof RADIAL_FAN_BASE_ROW_START_OUTER_RIB !== "undefined"
        ? RADIAL_FAN_BASE_ROW_START_OUTER_RIB
        : 1;
    var startInner =
      typeof RADIAL_FAN_BASE_ROW_START_INNER_RIB !== "undefined"
        ? RADIAL_FAN_BASE_ROW_START_INNER_RIB
        : 5;
    var midOffsetOuter =
      typeof RADIAL_FAN_BASE_ROW_MIDDLE_RIB_OFFSET_OUTER !== "undefined"
        ? RADIAL_FAN_BASE_ROW_MIDDLE_RIB_OFFSET_OUTER
        : 2;
    var midOffsetInner =
      typeof RADIAL_FAN_BASE_ROW_MIDDLE_RIB_OFFSET_INNER !== "undefined"
        ? RADIAL_FAN_BASE_ROW_MIDDLE_RIB_OFFSET_INNER
        : 2;
    var leftInnerOffsetOuter =
      typeof RADIAL_FAN_BASE_ROW_LEFT_INNER_RIB_OFFSET_OUTER !== "undefined"
        ? RADIAL_FAN_BASE_ROW_LEFT_INNER_RIB_OFFSET_OUTER
        : 6;
    var leftInnerOffsetInner =
      typeof RADIAL_FAN_BASE_ROW_LEFT_INNER_RIB_OFFSET_INNER !== "undefined"
        ? RADIAL_FAN_BASE_ROW_LEFT_INNER_RIB_OFFSET_INNER
        : 2;
    var rightInnerOffsetOuter =
      typeof RADIAL_FAN_BASE_ROW_RIGHT_INNER_RIB_OFFSET_OUTER !== "undefined"
        ? RADIAL_FAN_BASE_ROW_RIGHT_INNER_RIB_OFFSET_OUTER
        : 2;
    var rightInnerOffsetInner =
      typeof RADIAL_FAN_BASE_ROW_RIGHT_INNER_RIB_OFFSET_INNER !== "undefined"
        ? RADIAL_FAN_BASE_ROW_RIGHT_INNER_RIB_OFFSET_INNER
        : 6;

    var spans = [
      getRadialFanRibSpanFromIndices(endpoints, startOuter, startInner),
      getRadialFanRibSpanFromIndices(
        endpoints,
        midIdx - leftInnerOffsetOuter,
        midIdx - leftInnerOffsetInner
      ),
      getRadialFanRibSpanFromIndices(
        endpoints,
        midIdx - midOffsetOuter,
        midIdx + midOffsetInner
      ),
      getRadialFanRibSpanFromIndices(
        endpoints,
        midIdx + rightInnerOffsetOuter,
        midIdx + rightInnerOffsetInner
      ),
      getRadialFanRibSpanFromIndices(
        endpoints,
        endpointCount - 1 - endOuterFromEnd,
        endpointCount - 1 - endInnerFromEnd
      ),
    ];

    var si;
    for (si = 0; si < spans.length; si++) {
      if (!spans[si]) return null;
    }

    var maxHalfSpan = spans[0].halfAngleSpan;
    for (si = 1; si < spans.length; si++) {
      maxHalfSpan = Math.max(maxHalfSpan, spans[si].halfAngleSpan);
    }
    var ringRadius = getRadialFanArcSeatedRingRadius(arcRadius, maxHalfSpan);
    if (ringRadius <= 0) return null;

    var angles = [];
    for (si = 0; si < spans.length; si++) {
      angles.push(spans[si].midAngle);
    }

    return { angles: angles, ringRadius: ringRadius };
  }

  /** @returns {number[]} radii small → large, equal gaps from center to outer */
  function getRadialFanNestedRingRadii(outerRingRadius, nestedCount, spacingCount) {
    if (nestedCount < 1 || outerRingRadius <= 0) return [];
    var fullCount =
      spacingCount != null && spacingCount >= nestedCount ? spacingCount : nestedCount;
    var gap = outerRingRadius / fullCount;
    var startIndex = fullCount - nestedCount + 1;
    var radii = [];
    var ni;
    for (ni = startIndex; ni <= fullCount; ni++) {
      radii.push(gap * ni);
    }
    return radii;
  }

  function appendRadialFanRingSliceLines(
    parentGroup,
    idPrefix,
    setIndex,
    centerX,
    centerY,
    outerRadius,
    sliceCount,
    stroke,
    strokeWidth
  ) {
    if (sliceCount < 2 || outerRadius <= 0) return;

    var slicesGroup = elSvg("g");
    slicesGroup.setAttribute(
      "id",
      "radial-fan-third-arc-ring-slices-" + idPrefix + "-" + setIndex
    );
    var si;
    for (si = 0; si < sliceCount; si++) {
      var angle = (si * 2 * Math.PI) / sliceCount;
      var endX = centerX + outerRadius * Math.cos(angle);
      var endY = centerY + outerRadius * Math.sin(angle);

      var slice = elSvg("line");
      slice.setAttribute(
        "id",
        "radial-fan-third-arc-ring-slice-" + idPrefix + "-" + setIndex + "-" + si
      );
      slice.setAttribute("x1", String(centerX));
      slice.setAttribute("y1", String(centerY));
      slice.setAttribute("x2", String(endX));
      slice.setAttribute("y2", String(endY));
      slice.setAttribute("stroke", stroke);
      slice.setAttribute("stroke-width", String(strokeWidth));
      slicesGroup.appendChild(slice);
    }
    parentGroup.appendChild(slicesGroup);
  }

  function appendRadialFanRingSet(
    parentGroup,
    idPrefix,
    setId,
    centerX,
    centerY,
    outerRingRadius,
    stroke,
    strokeWidth,
    nestedCountOverride
  ) {
    if (outerRingRadius <= 0) return;

    var spacingCount =
      typeof RADIAL_FAN_THIRD_ARC_NESTED_RING_COUNT !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_NESTED_RING_COUNT
        : 3;
    var nestedCount =
      nestedCountOverride != null ? nestedCountOverride : spacingCount;
    var nestedRadii = getRadialFanNestedRingRadii(
      outerRingRadius,
      nestedCount,
      spacingCount
    );
    var sliceCount =
      typeof RADIAL_FAN_THIRD_ARC_RING_SLICE_COUNT !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_SLICE_COUNT
        : 16;

    var nestGroup = elSvg("g");
    nestGroup.setAttribute("id", "radial-fan-ring-set-" + idPrefix + "-" + setId);
    var nj;
    for (nj = 0; nj < nestedRadii.length; nj++) {
      var ring = elSvg("circle");
      ring.setAttribute(
        "id",
        "radial-fan-ring-" + idPrefix + "-" + setId + "-" + nj
      );
      ring.setAttribute("cx", String(centerX));
      ring.setAttribute("cy", String(centerY));
      ring.setAttribute("r", String(nestedRadii[nj]));
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", stroke);
      ring.setAttribute("stroke-width", String(strokeWidth));
      nestGroup.appendChild(ring);
    }
    appendRadialFanRingSliceLines(
      nestGroup,
      idPrefix,
      setId,
      centerX,
      centerY,
      outerRingRadius,
      sliceCount,
      stroke,
      strokeWidth
    );
    parentGroup.appendChild(nestGroup);
  }

  /** Angular placement for an elevated ring bounded by two fan ribs (counted from an end). */
  function getRadialFanElevatedRingRibAngles(endpoints, outerRibFromEnd, innerRibFromEnd, fromLeftEnd) {
    if (!endpoints || endpoints.length < 3) return null;

    var endpointCount = endpoints.length;
    var outerIdx = fromLeftEnd
      ? outerRibFromEnd
      : endpointCount - 1 - outerRibFromEnd;
    var innerIdx = fromLeftEnd
      ? innerRibFromEnd
      : endpointCount - 1 - innerRibFromEnd;

    if (
      outerIdx < 0 ||
      innerIdx < 0 ||
      outerIdx >= endpointCount ||
      innerIdx >= endpointCount
    ) {
      return null;
    }

    var angleHigh = Math.max(endpoints[outerIdx].a, endpoints[innerIdx].a);
    var angleLow = Math.min(endpoints[outerIdx].a, endpoints[innerIdx].a);
    return {
      midAngle: (angleHigh + angleLow) * 0.5,
      halfAngleSpan: (angleHigh - angleLow) * 0.5,
    };
  }

  /** Outer radius so circle edges meet the bounding rib rays from the focal center. */
  function getRadialFanElevatedRingOuterRadius(centerDist, halfAngleSpan) {
    return centerDist * Math.sin(Math.max(0, halfAngleSpan));
  }

  /**
   * Elevated ring sized by rib span; outer top edge on the almost-outer arc.
   * centerDist + outerRadius === almostOuterArcRadius along the ring bisector.
   */
  function getRadialFanElevatedRingSeatOnAlmostOuterArc(
    almostOuterArcRadius,
    halfAngleSpan
  ) {
    if (almostOuterArcRadius <= 0) {
      return { centerDist: 0, elevatedRadius: 0 };
    }

    var sinBeta = Math.sin(Math.max(0, halfAngleSpan));
    var centerDist = almostOuterArcRadius / (1 + sinBeta);
    var elevatedRadius = getRadialFanElevatedRingOuterRadius(
      centerDist,
      halfAngleSpan
    );
    return { centerDist: centerDist, elevatedRadius: elevatedRadius };
  }

  function appendRadialFanElevatedRings(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    almostOuterArcRadius,
    ringAngles,
    endpoints,
    stroke,
    strokeWidth
  ) {
    if (
      !ringAngles ||
      ringAngles.length < 5 ||
      almostOuterArcRadius <= 0 ||
      !endpoints
    ) {
      return;
    }

    var outerRibFromEnd =
      typeof RADIAL_FAN_ELEVATED_RING_OUTER_RIB_FROM_END !== "undefined"
        ? RADIAL_FAN_ELEVATED_RING_OUTER_RIB_FROM_END
        : 4;
    var innerRibFromEnd =
      typeof RADIAL_FAN_ELEVATED_RING_INNER_RIB_FROM_END !== "undefined"
        ? RADIAL_FAN_ELEVATED_RING_INNER_RIB_FROM_END
        : 7;
    var elevatedSpecs = [
      {
        fromLeftEnd: true,
      },
      {
        fromLeftEnd: false,
      },
    ];
    var pi;

    for (pi = 0; pi < elevatedSpecs.length; pi++) {
      var spec = elevatedSpecs[pi];
      var ribAngles = getRadialFanElevatedRingRibAngles(
        endpoints,
        outerRibFromEnd,
        innerRibFromEnd,
        spec.fromLeftEnd
      );
      if (!ribAngles || ribAngles.halfAngleSpan <= 0) continue;

      var seat = getRadialFanElevatedRingSeatOnAlmostOuterArc(
        almostOuterArcRadius,
        ribAngles.halfAngleSpan
      );
      if (seat.elevatedRadius <= 0 || seat.centerDist <= 0) continue;

      var center = halfCirclePolarPoint(
        cx,
        focalY,
        seat.centerDist,
        ribAngles.midAngle
      );
      var elevatedNestedCount =
        typeof RADIAL_FAN_ELEVATED_NESTED_RING_COUNT !== "undefined"
          ? RADIAL_FAN_ELEVATED_NESTED_RING_COUNT
          : 2;
      appendRadialFanRingSet(
        parentGroup,
        idPrefix,
        "elevated-" + pi,
        center.x,
        center.y,
        seat.elevatedRadius,
        stroke,
        strokeWidth,
        elevatedNestedCount
      );
    }
  }

  /** Center of the middle ring set on the 3rd inner arc (used by base diagonals). */
  function getRadialFanMiddleThirdArcRingCenter(
    cx,
    focalY,
    innerArcRadii,
    startAngle,
    endAngle,
    endpoints
  ) {
    var thirdArcIndex =
      typeof RADIAL_FAN_THIRD_ARC_RING_ARC_INDEX !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_ARC_INDEX
        : 2;
    if (!innerArcRadii || innerArcRadii.length <= thirdArcIndex) return null;

    var arcRadius = innerArcRadii[thirdArcIndex];
    var ringCount =
      typeof RADIAL_FAN_THIRD_ARC_RING_COUNT !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_COUNT
        : 5;
    var fallbackRadius =
      typeof RADIAL_FAN_THIRD_ARC_RING_RADIUS !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_RADIUS
        : 44;
    if (ringCount < 1 || fallbackRadius <= 0) return null;

    var baseLayout =
      endpoints && endpoints.length >= 5
        ? getRadialFanBaseRowRingLayout(endpoints, arcRadius, ringCount)
        : null;
    var ringAngles;
    var ringRadius;

    if (baseLayout) {
      ringAngles = baseLayout.angles;
      ringRadius = baseLayout.ringRadius;
    } else {
      ringAngles = getRadialFanThirdArcRingAngles(
        arcRadius,
        fallbackRadius,
        startAngle,
        endAngle,
        ringCount
      );
      ringRadius = fallbackRadius;
    }

    if (!ringAngles.length) return null;

    var middleIndex = Math.floor((ringAngles.length - 1) * 0.5);
    return halfCirclePolarPoint(
      cx,
      focalY,
      arcRadius + ringRadius,
      ringAngles[middleIndex]
    );
  }

  function appendRadialFanThirdArcRings(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    arcRadius,
    startAngle,
    endAngle,
    ringCount,
    ringRadius,
    endpoints,
    almostOuterArcRadius,
    stroke,
    strokeWidth
  ) {
    if (ringCount < 1) return;

    var baseLayout =
      endpoints && endpoints.length >= 5
        ? getRadialFanBaseRowRingLayout(endpoints, arcRadius, ringCount)
        : null;
    var ringAngles;
    var effectiveRingRadius;

    if (baseLayout && baseLayout.ringRadius > 0) {
      ringAngles = baseLayout.angles;
      effectiveRingRadius = baseLayout.ringRadius;
    } else if (ringRadius > 0) {
      ringAngles = getRadialFanThirdArcRingAngles(
        arcRadius,
        ringRadius,
        startAngle,
        endAngle,
        ringCount
      );
      effectiveRingRadius = ringRadius;
    } else {
      return;
    }

    var ri;
    for (ri = 0; ri < ringAngles.length; ri++) {
      var center = halfCirclePolarPoint(
        cx,
        focalY,
        arcRadius + effectiveRingRadius,
        ringAngles[ri]
      );
      appendRadialFanRingSet(
        parentGroup,
        idPrefix,
        String(ri),
        center.x,
        center.y,
        effectiveRingRadius,
        stroke,
        strokeWidth
      );
    }

    appendRadialFanElevatedRings(
      parentGroup,
      idPrefix,
      cx,
      focalY,
      almostOuterArcRadius,
      ringAngles,
      endpoints,
      stroke,
      strokeWidth
    );
  }

  /** Intersection of segments (ax,ay)-(bx,by) and (cx,cy)-(dx,dy), or null if parallel. */
  function segmentLinesIntersectPoint(ax, ay, bx, by, cx, cy, dx, dy) {
    var denom = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx);
    if (Math.abs(denom) < 1e-9) return null;
    var t =
      ((ax - cx) * (cy - dy) - (ay - cy) * (cx - dx)) / denom;
    return {
      x: ax + t * (bx - ax),
      y: ay + t * (by - ay),
    };
  }

  /**
   * Top or bottom triangle inside one inner-arc-band X cell
   * (curved edge on inner or outer arc, other two edges meet at the X center).
   */
  function radialFanInnerArcBandHorizontalTrianglePath(
    cx,
    focalY,
    innerRadius,
    outerRadius,
    leftAngle,
    rightAngle,
    which
  ) {
    var pointA = halfCirclePolarPoint(cx, focalY, innerRadius, leftAngle);
    var pointB = halfCirclePolarPoint(cx, focalY, innerRadius, rightAngle);
    var pointC = halfCirclePolarPoint(cx, focalY, outerRadius, rightAngle);
    var pointD = halfCirclePolarPoint(cx, focalY, outerRadius, leftAngle);
    var mid = segmentLinesIntersectPoint(
      pointA.x,
      pointA.y,
      pointC.x,
      pointC.y,
      pointB.x,
      pointB.y,
      pointD.x,
      pointD.y
    );
    if (!mid) return null;

    // Use endpoint angles (not atan2 from points) so the left fan-edge cell
    // does not wrap PI/-PI into a near-full-circle arc.
    if (which === "top") {
      return (
        halfCircleFocalArcPath(
          cx,
          focalY,
          innerRadius,
          leftAngle,
          rightAngle
        ) +
        " L " +
        mid.x +
        " " +
        mid.y +
        " Z"
      );
    }

    return (
      halfCircleFocalArcPath(
        cx,
        focalY,
        outerRadius,
        leftAngle,
        rightAngle
      ) +
      " L " +
      mid.x +
      " " +
      mid.y +
      " Z"
    );
  }

  /** Fill the two horizontal triangles (inner-arc + outer-arc) in each X cell. */
  function appendRadialFanInnerArcBandHorizontalTriangleFills(
    parentGroup,
    idPrefix,
    bandSuffix,
    cx,
    focalY,
    innerRadius,
    outerRadius,
    endpoints,
    fillColor
  ) {
    if (!endpoints || endpoints.length < 2) return;
    if (innerRadius <= 0 || outerRadius <= innerRadius + 0.5) return;

    var gi;
    for (gi = 0; gi < endpoints.length - 1; gi++) {
      var leftAngle = endpoints[gi].a;
      var rightAngle = endpoints[gi + 1].a;
      var topPath = radialFanInnerArcBandHorizontalTrianglePath(
        cx,
        focalY,
        innerRadius,
        outerRadius,
        leftAngle,
        rightAngle,
        "top"
      );
      var bottomPath = radialFanInnerArcBandHorizontalTrianglePath(
        cx,
        focalY,
        innerRadius,
        outerRadius,
        leftAngle,
        rightAngle,
        "bottom"
      );

      if (topPath) {
        var topFill = elSvg("path");
        topFill.setAttribute(
          "id",
          "radial-fan-arc-band-h-fill-top-" +
            idPrefix +
            "-" +
            bandSuffix +
            "-" +
            gi
        );
        topFill.setAttribute("d", topPath);
        topFill.setAttribute("fill", fillColor);
        topFill.setAttribute("stroke", "none");
        parentGroup.appendChild(topFill);
      }

      if (bottomPath) {
        var bottomFill = elSvg("path");
        bottomFill.setAttribute(
          "id",
          "radial-fan-arc-band-h-fill-bottom-" +
            idPrefix +
            "-" +
            bandSuffix +
            "-" +
            gi
        );
        bottomFill.setAttribute("d", bottomPath);
        bottomFill.setAttribute("fill", fillColor);
        bottomFill.setAttribute("stroke", "none");
        parentGroup.appendChild(bottomFill);
      }
    }
  }

  function appendRadialFanInnerArcBandXMarks(
    parentGroup,
    cx,
    focalY,
    innerRadius,
    outerRadius,
    endpoints,
    stroke,
    strokeWidth
  ) {
    if (!endpoints || endpoints.length < 2) return;

    var gi;
    for (gi = 0; gi < endpoints.length - 1; gi++) {
      var leftAngle = endpoints[gi].a;
      var rightAngle = endpoints[gi + 1].a;
      var pointA = halfCirclePolarPoint(cx, focalY, innerRadius, leftAngle);
      var pointB = halfCirclePolarPoint(cx, focalY, innerRadius, rightAngle);
      var pointC = halfCirclePolarPoint(cx, focalY, outerRadius, rightAngle);
      var pointD = halfCirclePolarPoint(cx, focalY, outerRadius, leftAngle);

      var diag1 = elSvg("line");
      diag1.setAttribute("x1", String(pointA.x));
      diag1.setAttribute("y1", String(pointA.y));
      diag1.setAttribute("x2", String(pointC.x));
      diag1.setAttribute("y2", String(pointC.y));
      diag1.setAttribute("stroke", stroke);
      diag1.setAttribute("stroke-width", String(strokeWidth));
      parentGroup.appendChild(diag1);

      var diag2 = elSvg("line");
      diag2.setAttribute("x1", String(pointB.x));
      diag2.setAttribute("y1", String(pointB.y));
      diag2.setAttribute("x2", String(pointD.x));
      diag2.setAttribute("y2", String(pointD.y));
      diag2.setAttribute("stroke", stroke);
      diag2.setAttribute("stroke-width", String(strokeWidth));
      parentGroup.appendChild(diag2);
    }
  }

  function appendRadialFanSixthArcDiagonalLine(
    parentGroup,
    idPrefix,
    sideSuffix,
    cx,
    focalY,
    fanRadius,
    innerRadius,
    startAngle,
    endAngle,
    stroke,
    strokeWidth
  ) {
    var startPoint = halfCirclePolarPoint(cx, focalY, innerRadius, startAngle);
    var endPoint = halfCirclePolarPoint(cx, focalY, fanRadius, endAngle);
    var diagonal = elSvg("line");
    diagonal.setAttribute(
      "id",
      "radial-fan-sixth-arc-diagonal-" + idPrefix + sideSuffix
    );
    diagonal.setAttribute("x1", String(startPoint.x));
    diagonal.setAttribute("y1", String(startPoint.y));
    diagonal.setAttribute("x2", String(endPoint.x));
    diagonal.setAttribute("y2", String(endPoint.y));
    diagonal.setAttribute("stroke", stroke);
    diagonal.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(diagonal);
  }

  /**
   * Mirrored pair on 6th inner arc: start corner fixed at 2nd rib cell edge,
   * outer end at 3rd rib from each side.
   */
  /** Left base corner → outer arc, passing through the middle third-arc ring center. */
  function appendRadialFanBaseLeftDiagonal(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    fanRadius,
    endpoints,
    ringCenter,
    stroke,
    strokeWidth
  ) {
    if (!endpoints || !endpoints.length || !ringCenter) return;

    var trim = getFanEndSectorTrimCount();
    var startPoint = endpoints[trim > 0 ? trim : 0];
    var endPoint = halfCircleRayCircleHitBeyond(
      cx,
      focalY,
      fanRadius,
      startPoint.x,
      startPoint.y,
      ringCenter.x,
      ringCenter.y
    );
    if (!endPoint) return;

    var diagonal = elSvg("line");
    diagonal.setAttribute("id", "radial-fan-base-left-diagonal-" + idPrefix);
    diagonal.setAttribute("x1", String(startPoint.x));
    diagonal.setAttribute("y1", String(startPoint.y));
    diagonal.setAttribute("x2", String(endPoint.x));
    diagonal.setAttribute("y2", String(endPoint.y));
    diagonal.setAttribute("stroke", stroke);
    diagonal.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(diagonal);
  }

  /** Right base corner → outer arc, passing through the middle third-arc ring center. */
  function appendRadialFanBaseRightDiagonal(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    fanRadius,
    endpoints,
    ringCenter,
    stroke,
    strokeWidth
  ) {
    if (!endpoints || !endpoints.length || !ringCenter) return;

    var trim = getFanEndSectorTrimCount();
    var startPoint =
      endpoints[trim > 0 ? endpoints.length - 1 - trim : endpoints.length - 1];
    var endPoint = halfCircleRayCircleHitBeyond(
      cx,
      focalY,
      fanRadius,
      startPoint.x,
      startPoint.y,
      ringCenter.x,
      ringCenter.y
    );
    if (!endPoint) return;

    var diagonal = elSvg("line");
    diagonal.setAttribute("id", "radial-fan-base-right-diagonal-" + idPrefix);
    diagonal.setAttribute("x1", String(startPoint.x));
    diagonal.setAttribute("y1", String(startPoint.y));
    diagonal.setAttribute("x2", String(endPoint.x));
    diagonal.setAttribute("y2", String(endPoint.y));
    diagonal.setAttribute("stroke", stroke);
    diagonal.setAttribute("stroke-width", String(strokeWidth));
    parentGroup.appendChild(diagonal);
  }

  function appendRadialFanSixthArcDiagonals(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    fanRadius,
    innerArcRadii,
    endpoints,
    stroke,
    strokeWidth
  ) {
    var arcIndex =
      typeof RADIAL_FAN_SIXTH_ARC_DIAGONAL_ARC_INDEX !== "undefined"
        ? RADIAL_FAN_SIXTH_ARC_DIAGONAL_ARC_INDEX
        : 5;
    var startCornerRibIndex =
      typeof RADIAL_FAN_SIXTH_ARC_DIAGONAL_START_CORNER_RIB_INDEX !==
      "undefined"
        ? RADIAL_FAN_SIXTH_ARC_DIAGONAL_START_CORNER_RIB_INDEX
        : typeof RADIAL_FAN_SIXTH_ARC_DIAGONAL_RIB_INDEX !== "undefined"
          ? RADIAL_FAN_SIXTH_ARC_DIAGONAL_RIB_INDEX
          : 1;
    var endRibIndex =
      typeof RADIAL_FAN_SIXTH_ARC_DIAGONAL_END_RIB_INDEX !== "undefined"
        ? RADIAL_FAN_SIXTH_ARC_DIAGONAL_END_RIB_INDEX
        : 2;
    if (
      !innerArcRadii ||
      arcIndex < 0 ||
      arcIndex >= innerArcRadii.length ||
      !endpoints ||
      startCornerRibIndex < 1 ||
      endRibIndex < 1
    ) {
      return;
    }

    var innerRadius = innerArcRadii[arcIndex];
    var endpointCount = endpoints.length;

    if (startCornerRibIndex < endpointCount && endRibIndex < endpointCount) {
      appendRadialFanSixthArcDiagonalLine(
        parentGroup,
        idPrefix,
        "-start",
        cx,
        focalY,
        fanRadius,
        innerRadius,
        endpoints[startCornerRibIndex - 1].a,
        endpoints[endRibIndex].a,
        stroke,
        strokeWidth
      );
    }

    if (
      endpointCount - startCornerRibIndex >= 0 &&
      endpointCount - 1 - endRibIndex >= 0
    ) {
      appendRadialFanSixthArcDiagonalLine(
        parentGroup,
        idPrefix,
        "-end",
        cx,
        focalY,
        fanRadius,
        innerRadius,
        endpoints[endpointCount - startCornerRibIndex].a,
        endpoints[endpointCount - 1 - endRibIndex].a,
        stroke,
        strokeWidth
      );
    }
  }

  /** Clip path in the same fan group so top/bottom mirror transforms stay aligned. */
  function appendRadialFanSectorClipPath(parentGroup, idPrefix, sectorPath) {
    var clipId = "radial-fan-sector-clip-" + idPrefix;
    var clip = elSvg("clipPath");
    clip.setAttribute("id", clipId);
    var path = elSvg("path");
    path.setAttribute("d", sectorPath);
    clip.appendChild(path);
    parentGroup.appendChild(clip);
    return clipId;
  }

  function isRadialFanDrawBoundaryAngle(angle, drawAngles) {
    return (
      Math.abs(angle - drawAngles.startAngle) < 1e-9 ||
      Math.abs(angle - drawAngles.endAngle) < 1e-9
    );
  }

  /** Left/right sector boundary ribs — drawn outside the clip so stroke is not halved. */
  function appendRadialFanBoundaryRibs(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    outerArcRadius,
    drawAngles,
    stroke,
    strokeWidth
  ) {
    var sides = [
      { side: "left", angle: drawAngles.startAngle },
      { side: "right", angle: drawAngles.endAngle },
    ];
    var si;
    for (si = 0; si < sides.length; si++) {
      var ribEnd = halfCirclePolarPoint(
        cx,
        focalY,
        outerArcRadius,
        sides[si].angle
      );
      var rib = elSvg("line");
      rib.setAttribute(
        "id",
        "radial-fan-boundary-rib-" + idPrefix + "-" + sides[si].side
      );
      rib.setAttribute("x1", String(cx));
      rib.setAttribute("y1", String(focalY));
      rib.setAttribute("x2", String(ribEnd.x));
      rib.setAttribute("y2", String(ribEnd.y));
      rib.setAttribute("stroke", stroke);
      rib.setAttribute("stroke-width", String(strokeWidth));
      parentGroup.appendChild(rib);
    }
  }

  function appendRadialBaseFan(
    parentGroup,
    idPrefix,
    cx,
    focalY,
    r,
    ribs,
    visiblePetals,
    anchor
  ) {
    var radialRibs = getRadialFanRibCount();
    var fanLayouts = buildHalfCircleFanClipAndFullLayouts(
      cx,
      focalY,
      r,
      radialRibs,
      visiblePetals,
      anchor
    );
    if (!fanLayouts.clipLayout.endpoints.length) return;

    var endpoints = fanLayouts.fullLayout.endpoints;
    var drawAngles = fanLayouts.fullDrawAngles;
    var fullLayout = fanLayouts.fullLayout;
    var fullDrawAngles = fanLayouts.fullDrawAngles;
    var outerArcRadius = r * getRadialFanOuterArcScale();
    var sectorPath = halfCircleRadialFanSectorPath(
      cx,
      focalY,
      r,
      outerArcRadius,
      fanLayouts.clipDrawAngles.startAngle,
      fanLayouts.clipDrawAngles.endAngle
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

    var fanStroke = sheetColor("D1");
    var strokeWidth = getRadialFanStrokeWidth();

    var bgFill = elSvg("path");
    bgFill.setAttribute("id", "radial-fan-background-" + idPrefix);
    bgFill.setAttribute("d", sectorPath);
    bgFill.setAttribute("fill", sheetColor("A2"));
    bgFill.setAttribute("stroke", "none");
    parentGroup.appendChild(bgFill);

    var sectorClipId = appendRadialFanSectorClipPath(
      parentGroup,
      idPrefix,
      sectorPath
    );
    var strokesGroup = elSvg("g");
    strokesGroup.setAttribute("id", "radial-fan-strokes-" + idPrefix);
    strokesGroup.setAttribute("clip-path", "url(#" + sectorClipId + ")");
    parentGroup.appendChild(strokesGroup);

    var arcFrame = elSvg("path");
    arcFrame.setAttribute("id", "radial-fan-arc-" + idPrefix);
    arcFrame.setAttribute(
      "d",
      halfCircleFocalArcPath(
        cx,
        focalY,
        outerArcRadius,
        drawAngles.startAngle,
        drawAngles.endAngle
      )
    );
    arcFrame.setAttribute("fill", "none");
    arcFrame.setAttribute("stroke", fanStroke);
    arcFrame.setAttribute("stroke-width", String(strokeWidth));
    strokesGroup.appendChild(arcFrame);

    var innerArcRadii = getRadialFanEvenInnerArcRadii(idPrefix, outerArcRadius);
    var frameArcsForSync = getRadialFanFrameArcRadii(innerArcRadii);
    syncRadialFanMiddleStandaloneArcWithElevatedRings(
      innerArcRadii,
      fullLayout.endpoints,
      frameArcsForSync.almostOuter
    );
    syncRadialFanSixthInnerArcWithBaseRowRings(
      innerArcRadii,
      fullLayout.endpoints
    );
    var innerArcsGroup = elSvg("g");
    innerArcsGroup.setAttribute("id", "radial-fan-inner-arcs-" + idPrefix);
    var ai;
    for (ai = 0; ai < innerArcRadii.length; ai++) {
      appendHalfCircleFocalArcStroke(
        innerArcsGroup,
        "radial-fan-inner-arc-" + idPrefix + "-" + ai,
        cx,
        focalY,
        innerArcRadii[ai],
        drawAngles.startAngle,
        drawAngles.endAngle,
        fanStroke,
        strokeWidth
      );
    }
    strokesGroup.appendChild(innerArcsGroup);

    var ribsGroup = elSvg("g");
    ribsGroup.setAttribute("id", "radial-fan-ribs-" + idPrefix);
    var i;
    for (i = 0; i < endpoints.length; i++) {
      var ribEnd = halfCirclePolarPoint(
        cx,
        focalY,
        outerArcRadius,
        endpoints[i].a
      );
      var rib = elSvg("line");
      rib.setAttribute("x1", String(cx));
      rib.setAttribute("y1", String(focalY));
      rib.setAttribute("x2", String(ribEnd.x));
      rib.setAttribute("y2", String(ribEnd.y));
      rib.setAttribute("stroke", fanStroke);
      rib.setAttribute("stroke-width", String(strokeWidth));
      ribsGroup.appendChild(rib);
    }
    strokesGroup.appendChild(ribsGroup);

    appendRadialFanSixthArcDiagonals(
      strokesGroup,
      idPrefix,
      cx,
      focalY,
      outerArcRadius,
      innerArcRadii,
      endpoints,
      fanStroke,
      strokeWidth
    );

    appendRadialFanMiddleRibAdjacentDiagonals(
      strokesGroup,
      idPrefix,
      cx,
      focalY,
      innerArcRadii,
      endpoints,
      fanStroke,
      strokeWidth
    );

    appendRadialFanMiddleBandEndCapDiagonals(
      strokesGroup,
      idPrefix,
      cx,
      focalY,
      innerArcRadii,
      endpoints,
      fanStroke,
      strokeWidth
    );

    appendRadialFanMiddleRibCenterDiagonals(
      strokesGroup,
      idPrefix,
      cx,
      focalY,
      outerArcRadius,
      innerArcRadii,
      endpoints,
      fanStroke,
      strokeWidth
    );

    var middleRingCenter = getRadialFanMiddleThirdArcRingCenter(
      cx,
      focalY,
      innerArcRadii,
      fullDrawAngles.startAngle,
      fullDrawAngles.endAngle,
      fullLayout.endpoints
    );

    appendRadialFanBaseLeftDiagonal(
      strokesGroup,
      idPrefix,
      cx,
      focalY,
      outerArcRadius,
      endpoints,
      middleRingCenter,
      fanStroke,
      strokeWidth
    );

    appendRadialFanBaseRightDiagonal(
      strokesGroup,
      idPrefix,
      cx,
      focalY,
      outerArcRadius,
      endpoints,
      middleRingCenter,
      fanStroke,
      strokeWidth
    );

    if (innerArcRadii.length >= 2) {
      var innerBandFillsGroup = elSvg("g");
      innerBandFillsGroup.setAttribute(
        "id",
        "radial-fan-inner-band-horizontal-fills-" + idPrefix
      );
      appendRadialFanInnerArcBandHorizontalTriangleFills(
        innerBandFillsGroup,
        idPrefix,
        "inner",
        cx,
        focalY,
        innerArcRadii[0],
        innerArcRadii[1],
        endpoints,
        fanStroke
      );
      strokesGroup.insertBefore(innerBandFillsGroup, strokesGroup.firstChild);

      var xMarksGroup = elSvg("g");
      xMarksGroup.setAttribute("id", "radial-fan-inner-arc-x-marks-" + idPrefix);
      appendRadialFanInnerArcBandXMarks(
        xMarksGroup,
        cx,
        focalY,
        innerArcRadii[0],
        innerArcRadii[1],
        endpoints,
        fanStroke,
        strokeWidth
      );
      strokesGroup.appendChild(xMarksGroup);
    }

    if (innerArcRadii.length >= 1) {
      var frameAdjacentRadius = Math.max.apply(null, innerArcRadii);
      if (frameAdjacentRadius < outerArcRadius - 0.5) {
        var outerBandFillsGroup = elSvg("g");
        outerBandFillsGroup.setAttribute(
          "id",
          "radial-fan-outer-band-horizontal-fills-" + idPrefix
        );
        appendRadialFanInnerArcBandHorizontalTriangleFills(
          outerBandFillsGroup,
          idPrefix,
          "outer",
          cx,
          focalY,
          frameAdjacentRadius,
          outerArcRadius,
          endpoints,
          fanStroke
        );
        strokesGroup.insertBefore(
          outerBandFillsGroup,
          strokesGroup.firstChild
        );

        var outerXMarksGroup = elSvg("g");
        outerXMarksGroup.setAttribute(
          "id",
          "radial-fan-outer-arc-x-marks-" + idPrefix
        );
        appendRadialFanInnerArcBandXMarks(
          outerXMarksGroup,
          cx,
          focalY,
          frameAdjacentRadius,
          outerArcRadius,
          endpoints,
          fanStroke,
          strokeWidth
        );
        strokesGroup.appendChild(outerXMarksGroup);
      }
    }

    var thirdArcIndex =
      typeof RADIAL_FAN_THIRD_ARC_RING_ARC_INDEX !== "undefined"
        ? RADIAL_FAN_THIRD_ARC_RING_ARC_INDEX
        : 2;
    if (innerArcRadii.length > thirdArcIndex) {
      var ringCount =
        typeof RADIAL_FAN_THIRD_ARC_RING_COUNT !== "undefined"
          ? RADIAL_FAN_THIRD_ARC_RING_COUNT
          : 3;
      var ringRadius =
        typeof RADIAL_FAN_THIRD_ARC_RING_RADIUS !== "undefined"
          ? RADIAL_FAN_THIRD_ARC_RING_RADIUS
          : 20;
      var ringsGroup = elSvg("g");
      ringsGroup.setAttribute("id", "radial-fan-third-arc-rings-" + idPrefix);
      var frameArcs = getRadialFanFrameArcRadii(innerArcRadii);
      appendRadialFanThirdArcRings(
        ringsGroup,
        idPrefix,
        cx,
        focalY,
        innerArcRadii[thirdArcIndex],
        fullDrawAngles.startAngle,
        fullDrawAngles.endAngle,
        ringCount,
        ringRadius,
        fullLayout.endpoints,
        frameArcs.almostOuter,
        fanStroke,
        strokeWidth
      );
      strokesGroup.appendChild(ringsGroup);
    }
  }

  function renderHalfCircleLayer() {
    if (!designSvg) return;
    ensureFanLayerMounted();
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
      appendRadialBaseFan(
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
      appendRadialBaseFan(
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

  function renderAngerDiamondTrianglesLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-anger-diamond-triangles");
    if (!layer) return;

    while (layer.firstChild) layer.removeChild(layer.firstChild);

    if (!supportsAngerDiamondTriangles()) return;

    var triangles = getAngerTriangleDiamonds();
    if (triangles.length) layer.appendChild(angerTrianglesToGroup(triangles));
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
      // Fills under lines so inner-star edges keep full grid stroke (fill was covering strokes).
      var visibleStarFills = getVisibleStarFillsForPattern();
      if (visibleStarFills.length) {
        patternLayer.appendChild(starFillsToGroup(visibleStarFills));
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
      var starStrengthMarks = getActiveStrengthMarks();
      if (starStrengthMarks.length) {
        patternLayer.appendChild(strengthMarksToGroup(starStrengthMarks));
      }
      renderAngerDiamondTrianglesLayer();
      return;
    }

    renderDiamondFillsLayer();
    renderHollowDiamondFillsLayer();
    while (patternLayer.firstChild) patternLayer.removeChild(patternLayer.firstChild);
    patternLayer.appendChild(segmentsToGroup(getVisiblePatternSegments()));
    if (isCirclesGrid()) {
      var intactStructuralCircles = getIntactStructuralCirclesForPattern();
      if (intactStructuralCircles.length) {
        patternLayer.appendChild(
          structuralCirclesToGroup(intactStructuralCircles)
        );
      }
      appendCirclesGridFrameJunctionDots(patternLayer);
    } else if (isDiamondsGrid()) {
      var intactStructuralDiamonds = getIntactStructuralCirclesForPattern();
      if (intactStructuralDiamonds.length) {
        patternLayer.appendChild(
          structuralDiamondsToGroup(intactStructuralDiamonds)
        );
      }
      appendCirclesGridFrameJunctionDots(patternLayer);
    }
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
    var strengthMarks = getActiveStrengthMarks();
    if (strengthMarks.length) {
      patternLayer.appendChild(strengthMarksToGroup(strengthMarks));
    }
    renderAngerDiamondTrianglesLayer();
  }

  /**
   * Star grid: pattern, Hope stipple, merge mask, border, Anger lines, Pride auto-merge.
   */
  function syncStrengthCircleLayoutOnSignatureChange(circleSig) {
    if (circleSig !== lastStrengthCircleLayoutSignature) {
      lastStrengthCircleLayoutSignature = circleSig;
      syncStrengthSelection(true);
    }
  }

  function updateStrengthDensityOutput() {
    var min =
      typeof STRENGTH_DENSITY_MIN !== "undefined"
        ? STRENGTH_DENSITY_MIN
        : CIRCLE_DENSITY_MIN;
    setFeelingsStepOutputById(
      "strength-density-out",
      getStrengthDensity(),
      min,
      getJunctionEmotionDensityMaxForActiveGrid()
    );
  }

  function syncAllFeelingsSliderOutputs() {
    var junctionMax = getJunctionEmotionDensityMaxForActiveGrid();
    setFeelingsStepOutputById(
      "circle-density-out",
      getCircleDensity(),
      CIRCLE_DENSITY_MIN,
      CIRCLE_DENSITY_MAX
    );
    setFeelingsStepOutputById(
      "longing-circle-density-out",
      getLongingCircleDensity(),
      CIRCLE_DENSITY_MIN,
      junctionMax
    );
    setFeelingsStepOutputById(
      "grief-circle-density-out",
      getGriefCircleDensity(),
      CIRCLE_DENSITY_MIN,
      junctionMax
    );
    updateStrengthDensityOutput();
    setFeelingsStepOutputById(
      "helplessness-percent-out",
      getHelplessnessPercent(),
      typeof HELPLESSNESS_PERCENT_MIN !== "undefined"
        ? HELPLESSNESS_PERCENT_MIN
        : 0,
      getHelplessnessPercentMaxForActiveGrid()
    );
    setFeelingsStepOutputById(
      "pride-fill-percent-out",
      getPrideFillPercent(),
      PRIDE_FILL_PERCENT_MIN,
      getPrideFillPercentMaxForActiveGrid()
    );
    setFeelingsStepOutputById(
      "guilt-shame-fill-percent-out",
      getGuiltShameFillPercent(),
      typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_MIN
        : 0,
      getGuiltShameFillPercentMaxForActiveGrid()
    );
    setFeelingsStepOutputById(
      "anger-triangle-density-out",
      getAngerTriangleDensity(),
      typeof ANGER_TRIANGLE_DENSITY_MIN !== "undefined"
        ? ANGER_TRIANGLE_DENSITY_MIN
        : 0,
      getAngerTriangleDensityMaxForActiveGrid()
    );
    updateAutoMergeIntensityOutput();
    setFeelingsStepOutputById(
      "anger-vertical-length-out",
      getAngerVerticalLengthPercent(),
      ANGER_VERTICAL_LENGTH_MIN,
      ANGER_VERTICAL_LENGTH_MAX
    );
    syncAnxietyVerticalStrokeOutput();
  }

  function renderCirclesLikeGrid(gridLabel) {
    applyOctagonGridLayerVisibility();
    updateInnerContentTransformForGridType();

    var innerScale = getInnerScale();
    var outInner = document.getElementById("inner-scale-out");
    if (outInner) outInner.textContent = String(getInnerScaleStepDisplay());

    var layout = getCirclesLikeGridGeometry().computeLayout(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H
    );
    var info = document.getElementById("tile-info");
    if (info) {
      info.textContent =
        "Cell " +
        Math.round(layout.tileSize * 100) / 100 +
        " px · " +
        (lastOctagonsN + 1) +
        " across · " +
        (layout.m + 1) +
        " down (" +
        gridLabel +
        ")";
    }

    var layoutSig = buildCircleLayoutSignature();
    syncSadnessCircleLayoutOnSignatureChange();
    if (layoutSig !== lastLongingCircleLayoutSignature) {
      lastLongingCircleLayoutSignature = layoutSig;
      syncLongingCircleSelection(true);
    }
    if (layoutSig !== lastGriefCircleLayoutSignature) {
      lastGriefCircleLayoutSignature = layoutSig;
      syncGriefCircleSelection(true);
    }
    syncStrengthCircleLayoutOnSignatureChange(layoutSig);
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
      syncAngerTriangleSelection(false);
    }

    syncAllFeelingsSliderOutputs();

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
    applyMergeReveal();
    syncVerticalGridLines(false);
    renderVerticalGridLayer();
    updateGridBoundaryRect();
    updateBorderDivisionLines();
    updateColorDivisionsLayer();
    updateBorderDivisionOverlay();
    updateCanvasEdgeBrownBars();
    renderPatternLayer();
    renderHalfCircleLayer();
    renderAutoMergeFillsLayer();
    updateFrameInsetOverlayLayer();
    layoutStage();
    updateHopeResetButton();

    if (getAutoMergeIntensity() > 0 && !hasActivePrideAutoMergeRegions()) {
      runAutoMerge();
    }
  }

  function renderCirclesGrid() {
    renderCirclesLikeGrid("circles grid");
  }

  function renderDiamondsGrid() {
    renderCirclesLikeGrid("diamonds grid");
  }

  function renderStarGrid() {
    applyAlternateGridLayerVisibility();
    updateInnerContentTransformForGridType();

    var outInner = document.getElementById("inner-scale-out");
    if (outInner) outInner.textContent = String(getInnerScaleStepDisplay());

    var starLayout = getStarLayout();

    var outN = document.getElementById("octagons-n-out");
    if (outN) outN.textContent = String(getOctagonsNStepDisplay());

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

    var circleSig = buildCircleLayoutSignature();
    syncSadnessCircleLayoutOnSignatureChange();
    if (circleSig !== lastLongingCircleLayoutSignature) {
      lastLongingCircleLayoutSignature = circleSig;
      syncLongingCircleSelection(true);
    }
    if (circleSig !== lastGriefCircleLayoutSignature) {
      lastGriefCircleLayoutSignature = circleSig;
      syncGriefCircleSelection(true);
    }
    syncStrengthCircleLayoutOnSignatureChange(circleSig);
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
      syncAngerTriangleSelection(false);
    }

    syncAllFeelingsSliderOutputs();

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
    applyMergeReveal();
    renderAutoMergeFillsLayer();
    updateGridBoundaryRect();
    updateColorDivisionsLayer();
    layoutStage();
    updateHopeResetButton();

    if (getAutoMergeIntensity() > 0 && !hasActivePrideAutoMergeRegions()) {
      scheduleDeferredAutoMerge();
    }
  }

  function applySheetPaletteToDom() {
    if (!designSvg) return;
    updateCanvasBackgroundColor();
    invalidateLabelBarSvgTintCache();
    ensureLabelBarIconTintFilter(designSvg.querySelector("defs"));
    refreshHopeColoredExportDataUri();
    renderHopeMergeFillLayer();
    syncMagnifierBorderColor();
  }

  function render() {
    if (window.SheetPalettes) window.SheetPalettes.syncBorderGlobals();
    updateLayoutState();

    var outN = document.getElementById("octagons-n-out");
    if (outN) outN.textContent = String(getOctagonsNStepDisplay());

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

    if (isCirclesGrid()) {
      renderCirclesGrid();
      return;
    }

    if (isDiamondsGrid()) {
      renderDiamondsGrid();
      return;
    }

    applyOctagonGridLayerVisibility();
    updateInnerContentTransformForGridType();

    var innerScale = getInnerScale();
    var outInner = document.getElementById("inner-scale-out");
    if (outInner) outInner.textContent = String(getInnerScaleStepDisplay());

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
    syncSadnessCircleLayoutOnSignatureChange();
    if (layoutSig !== lastLongingCircleLayoutSignature) {
      lastLongingCircleLayoutSignature = layoutSig;
      syncLongingCircleSelection(true);
    }
    if (layoutSig !== lastGriefCircleLayoutSignature) {
      lastGriefCircleLayoutSignature = layoutSig;
      syncGriefCircleSelection(true);
    }
    syncStrengthCircleLayoutOnSignatureChange(layoutSig);
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
      syncAngerTriangleSelection(false);
    }

    syncAllFeelingsSliderOutputs();

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
    updateHopeResetButton();

    if (getAutoMergeIntensity() > 0 && !hasActivePrideAutoMergeRegions()) {
      if (appStartupBootstrapping) {
        scheduleDeferredAutoMerge();
      } else {
        runAutoMerge();
      }
    }
  }

  function commitSliderRelease(hadPreview, previewWasInFlight) {
    sliderPreviewRendered = false;
    var hadAutoMerge = autoMergeEdgeKeys.size > 0;
    clearMergeState();
    clearAutoMergeState();
    // During drag, preview already ran full render() (markers + grid). On release,
    // only refresh merge-dependent layers unless preview never painted final value.
    if (hadPreview && !previewWasInFlight) {
      renderPatternAndVerticalLayers();
    } else {
      render();
    }
    updateHopeResetButton();
    if (hadAutoMerge) {
      requestAnimationFrame(function () {
        runAutoMerge();
      });
    }
  }

  /** Throttled preview while dragging octagons-n / inner-scale (no merge reset). */
  function scheduleSliderRender() {
    sliderRenderPending = true;
    if (sliderRenderScheduled) return;
    sliderRenderScheduled = true;
    var gen = sliderRenderGeneration;
    requestAnimationFrame(function () {
      sliderRenderScheduled = false;
      if (gen !== sliderRenderGeneration || !sliderRenderPending) return;
      sliderRenderPending = false;
      render();
      sliderPreviewRendered = true;
    });
  }

  /** Final commit when the user releases a main grid slider. */
  function renderAfterSliderRelease() {
    sliderRenderGeneration++;
    var hadPreview = sliderPreviewRendered;
    var previewWasInFlight = sliderRenderPending || sliderRenderScheduled;
    sliderRenderPending = false;
    if (previewWasInFlight && !hadPreview) {
      requestAnimationFrame(function () {
        commitSliderRelease(hadPreview, previewWasInFlight);
      });
      return;
    }
    commitSliderRelease(hadPreview, previewWasInFlight);
  }

  function renderAfterSliderChange() {
    renderAfterSliderRelease();
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
              clearBlendAreaColorOverrides();
              syncBlendAreaSwatchInputs();
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
        if (window.SheetPalettes.toggleSheetPalette) {
          window.SheetPalettes.toggleSheetPalette();
        } else {
          window.SheetPalettes.pickRandomPalette();
        }
        clearBlendAreaColorOverrides();
        syncBlendAreaSwatchInputs();
        applySheetPaletteToDom();
        render();
      });
    }

    window.SheetPalettes.updatePaletteButtonStates();
  }

  /** Re-apply every layer that reads palette slots (after sheet load / reload). */
  function refreshUiFromSheetPalettes() {
    if (!window.SheetPalettes) return;
    clearBlendAreaColorOverrides();
    window.SheetPalettes.syncBorderGlobals();
    syncBlendAreaSwatchInputs();
    if (appStartupBootstrapping) return;
    applySheetPaletteToDom();
    render();
  }

  var sheetPaletteInitComplete = false;
  var sheetPaletteReloadTimer = null;
  var sheetPaletteWasHidden = false;

  function scheduleSheetPaletteReload() {
    if (!window.SheetPalettes || !sheetPaletteInitComplete) return;
    clearTimeout(sheetPaletteReloadTimer);
    sheetPaletteReloadTimer = setTimeout(function () {
      if (window.SheetPalettes.refreshSheetPalettesIfChanged) {
        window.SheetPalettes.refreshSheetPalettesIfChanged();
      } else {
        window.SheetPalettes.loadSheetPalettes();
      }
    }, 200);
  }

  function initSheetPaletteAutoRefresh() {
    initBlendAreaColorSwatches();
    if (!window.SheetPalettes || !window.SheetPalettes.onPalettesLoaded) return;
    window.SheetPalettes.onPalettesLoaded(function (_palettes, source) {
      if (typeof console !== "undefined" && console.info) {
        console.info(
          "SheetPalettes: UI refresh (" + (source || "unknown") + ")."
        );
      }
      refreshUiFromSheetPalettes();
    });
  }

  function applyRandomPaletteColorsAndRender() {
    applyRandomPaletteColors();
    render();
  }

  function syncFeelingsSliderOutputs() {
    syncAllFeelingsSliderOutputs();
  }

  function applyFeelingsControlState(options) {
    options = options || {};
    var randomHelplessness = options.randomHelplessness === true;

    syncCircleSelection(true);
    syncLongingCircleSelection(true);
    syncGriefCircleSelection(true);
    syncStrengthSelection(true);
    syncHelplessnessSelection(true, randomHelplessness);
    syncPrideShapes();
    syncGuiltShameShapes();
    syncAngerShapes();

    if (getAutoMergeIntensity() > 0) {
      if (options.skipRender) {
        /* deferred until after startup render or idle callback */
      } else {
        runAutoMerge();
        return;
      }
    } else {
      clearAutoMergeState();
    }

    if (options.skipRender) return;

    syncVerticalGridLines(false);
    renderVerticalGridLayer();
    renderPatternLayer();
    applyMergeReveal();
    renderAutoMergeFillsLayer();
    if (isAlternateGrid()) {
      renderGridMaskLayer("applyFeelingsControlState");
    }
  }

  /** Randomize mark placement on canvas; slider values stay unchanged. */
  function randomizeFeelingsPlacement() {
    applyFeelingsControlState({ randomHelplessness: true });
  }

  function randomizeFeelingsControls() {
    setSliderValue(
      "anger-vertical-length",
      randomFeelingsStepValue(ANGER_VERTICAL_LENGTH_MIN, ANGER_VERTICAL_LENGTH_MAX)
    );
    setSliderValue(
      "anxiety-vertical-stroke",
      randomFeelingsStepValue(ANXIETY_VERTICAL_STROKE_MIN, ANXIETY_VERTICAL_STROKE_MAX)
    );
    setSliderValue(
      "circle-density",
      randomFeelingsStepValue(CIRCLE_DENSITY_MIN, CIRCLE_DENSITY_MAX)
    );
    setSliderValue(
      "longing-circle-density",
      randomFeelingsStepValue(
        CIRCLE_DENSITY_MIN,
        getJunctionEmotionDensityMaxForActiveGrid()
      )
    );
    setSliderValue(
      "grief-circle-density",
      randomFeelingsStepValue(
        CIRCLE_DENSITY_MIN,
        getJunctionEmotionDensityMaxForActiveGrid()
      )
    );
    setSliderValue(
      "strength-density",
      randomFeelingsStepValue(
        typeof STRENGTH_DENSITY_MIN !== "undefined"
          ? STRENGTH_DENSITY_MIN
          : CIRCLE_DENSITY_MIN,
        getJunctionEmotionDensityMaxForActiveGrid()
      )
    );
    setSliderValue(
      "auto-merge-intensity",
      randomFeelingsStepValue(
        typeof AUTO_MERGE_INTENSITY_MIN !== "undefined"
          ? AUTO_MERGE_INTENSITY_MIN
          : 0,
        typeof AUTO_MERGE_INTENSITY_MAX !== "undefined"
          ? AUTO_MERGE_INTENSITY_MAX
          : 7
      )
    );
    setSliderValue(
      "pride-fill-percent",
      randomFeelingsStepValue(
        PRIDE_FILL_PERCENT_MIN,
        getPrideFillPercentMaxForActiveGrid()
      )
    );
    setSliderValue(
      "guilt-shame-fill-percent",
      randomFeelingsStepValue(
        typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
          ? GUILT_SHAME_FILL_PERCENT_MIN
          : 0,
        getGuiltShameFillPercentMaxForActiveGrid()
      )
    );
    setSliderValue(
      "anger-triangle-density",
      randomFeelingsStepValue(
        typeof ANGER_TRIANGLE_DENSITY_MIN !== "undefined"
          ? ANGER_TRIANGLE_DENSITY_MIN
          : 0,
        getAngerTriangleDensityMaxForActiveGrid()
      )
    );
    setSliderValue(
      "helplessness-percent",
      randomFeelingsStepValue(
        HELPLESSNESS_PERCENT_MIN,
        getHelplessnessPercentMaxForActiveGrid()
      )
    );

    syncFeelingsSliderOutputs();
    applyFeelingsControlState();
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

  function getEmbeddedExportFontDataUri() {
    return typeof window !== "undefined" &&
      typeof window.DIN_CONDENSED_EXPORT_FONT_DATA_URI === "string" &&
      window.DIN_CONDENSED_EXPORT_FONT_DATA_URI
      ? window.DIN_CONDENSED_EXPORT_FONT_DATA_URI
      : null;
  }

  function getExportFontFaceCss(fontDataUri) {
    var resolvedUri = fontDataUri || getEmbeddedExportFontDataUri();
    var src = resolvedUri
      ? 'url("' + resolvedUri + '") format("truetype")'
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
    var embedded = getEmbeddedExportFontDataUri();
    if (embedded) {
      cachedExportFontDataUri = embedded;
      return Promise.resolve(embedded);
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
    var gridBoundaryLayout = getGridBoundaryCanvasLayout();
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      '<svg xmlns="' +
        NS +
        '" width="68cm" height="180cm" viewBox="0 0 ' +
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
    pushLabelBarIconTintFilterDefExport(lines);
    if (hasActivePrideAutoMergeRegions()) {
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
    lines.push(
      '<g id="color-divisions-blend-root" style="isolation:isolate">'
    );
    lines.push('<g transform="' + getInnerContentTransformAttr() + '">');
    lines.push('<g clip-path="url(#inner-content-clip)">');
    pushBackgroundExportLines(lines);
    lines.push("</g>");

    pushGridMaskExportLines(lines);
    pushHopeMergeFillExportLines(lines);
    if (hopeDotsVectorLines && hopeDotsVectorLines.length) {
      for (var hd = 0; hd < hopeDotsVectorLines.length; hd++) {
        lines.push(hopeDotsVectorLines[hd]);
      }
    } else {
      pushStippleDotsExportLines(lines);
    }

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

    pushStructuralCirclesExportLines(lines);
    pushCirclesGridFrameJunctionDotsExport(lines);

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
          getLongingCircleStrokeColor() +
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
          getGriefCircleStrokeColor() +
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

    var strengthMarks = getActiveStrengthMarks();
    if (strengthMarks.length) {
      var strengthStroke = getCircleStrokeWidth();
      var strengthSquareFill = getStrengthSquareFillColor();
      var strengthCircleFill = getStrengthCircleFillColor();
      var strengthStrokeColor = getStrengthStrokeColor();
      lines.push('<g id="layer-strength">');
      var strengthStrokeInset = strengthStroke / 2;
      for (var sm = 0; sm < strengthMarks.length; sm++) {
        var strengthMark = strengthMarks[sm];
        var strengthHalf = strengthMark.halfSide;
        var strengthSide = strengthHalf * 2;
        lines.push(
          '<rect x="' +
            (strengthMark.cx - strengthHalf) +
            '" y="' +
            (strengthMark.cy - strengthHalf) +
            '" width="' +
            strengthSide +
            '" height="' +
            strengthSide +
            '" fill="' +
            strengthSquareFill +
            '" stroke="' +
            strengthStrokeColor +
            '" stroke-width="' +
            strengthStroke +
            '" paint-order="stroke fill"/>'
        );
        var strengthDrawR = Math.max(0, strengthMark.r - strengthStrokeInset);
        lines.push(
          '<circle cx="' +
            strengthMark.cx +
            '" cy="' +
            strengthMark.cy +
            '" r="' +
            strengthDrawR +
            '" fill="' +
            strengthCircleFill +
            '" stroke="' +
            strengthStrokeColor +
            '" stroke-width="' +
            strengthStroke +
            '"/>'
        );
      }
      lines.push("</g>");
    }

    pushAngerTriangleExportLines(lines);

    if (isFrameInsetOverlayVisibleOnCanvas()) {
      pushFrameInsetOverlayExportLines(lines, { nestedInInnerContent: true });
    }

    lines.push("</g>");
    lines.push("</g>");
    pushColorDivisionsExportLines(lines);
    lines.push('<g id="layer-grid-boundary">');
    pushGridBoundaryExportBars(lines, gridBoundaryLayout);
    lines.push("</g>");
    pushBorderDivisionOverlayExportLines(lines);
    lines.push("</g>");
    lines.push('<g transform="' + getInnerContentTransformAttr() + '" style="mix-blend-mode:normal">');
    pushVerticalGridExportLines(lines);
    lines.push("</g>");
    lines.push('<g transform="' + getInnerContentTransformAttr() + '" style="mix-blend-mode:normal">');
    lines.push('<g clip-path="url(#inner-content-clip)">');
    pushAutoMergeShadowExportLines(lines);
    pushAutoMergeFillOnlyExportLines(lines);
    lines.push("</g>");
    lines.push("</g>");
    lines.push('<g transform="' + getInnerContentTransformAttr() + '" style="mix-blend-mode:normal">');
    lines.push('<g clip-path="url(#inner-content-clip)">');
    pushHalfCircleExportLines(lines);
    lines.push("</g>");
    lines.push("</g>");
    lines.push('<g id="layer-edge-brown-bars">');
    pushCanvasEdgeBrownBarExportLines(lines);
    lines.push("</g>");
    pushCanvasEdgeSerialExport(lines);
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
      loadExportFontDataUri().then(function (fontDataUri) {
        return loadExportOpentypeFont(fontDataUri).then(function () {
          return fontDataUri;
        });
      }),
      preloadLabelBarSvgAssetsForExport(),
      buildHopeStippleExportLines(),
    ])
      .then(function (results) {
        var fontDataUri = results[1];
        var hopeDotsVectorLines = results[3];
        try {
          syncVerticalGridLines(false);
          renderHalfCircleLayer();
          var markup = buildExportSvgString(
            getVisiblePatternSegments(),
            getActiveCircles(),
            getFilledDiamonds(),
            getFilledHollowDiamonds(),
            fontDataUri,
            hopeDotsVectorLines
          );
          var blob = new Blob([markup], {
            type: "image/svg+xml;charset=utf-8",
          });
          downloadBlob(blob, "octagon-export-68x180cm.svg");
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
            getVisiblePatternSegments(),
            getActiveCircles(),
            getFilledDiamonds(),
            getFilledHollowDiamonds(),
            getEmbeddedExportFontDataUri(),
            null
          );
          var blob = new Blob([markup], {
            type: "image/svg+xml;charset=utf-8",
          });
          downloadBlob(blob, "octagon-export-68x180cm.svg");
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
    if (isAlternateGrid()) return false;
    // Circles/diamonds tessellation: dangling prune cascades across shape chords → false merge holes.
    if (isCirclesLikeGrid()) return false;
    var changed = false;
    var pruneKeys = TopkapiGeometry.findDanglingPruneKeys(
      getSegmentsForHopeMerge(),
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
      if (isHopeMergeDragActive()) {
        hopeMergeDragHadEdgeChanges = true;
        scheduleHopeMergeDragPreview();
      } else {
        renderPatternAndVerticalLayers();
      }
      updateHopeResetButton();
    }
  }

  function processDragHitTest() {
    if (!designSvg || dragPath.length === 0) return;
    if (hopeInteractionMode !== "merge") return;
    var threshold = getHitThreshold(designSvg);
    var mergeSegments = getSegmentsForHopeMerge();
    var visible = getVisibleSegmentsFast(mergeSegments);
    var keys = TopkapiGeometry.findSegmentsNearPolyline(
      visible,
      dragPath,
      threshold,
      removedEdges
    );
    removeEdgesByKeys(keys);
  }

  function onPointerDown(e) {
    if (!isHopeDragInteractionMode() || !designSvg) return;
    if (e.button !== 0) return;
    isDragging = true;
    hopeMergeDragHadEdgeChanges = false;
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
    var wasHopeMergeDrag = hopeInteractionMode === "merge";
    var hadHopeChanges = hopeMergeDragHadEdgeChanges;
    isDragging = false;
    dragPath = [];
    if (designSvg && designSvg.hasPointerCapture(e.pointerId)) {
      designSvg.releasePointerCapture(e.pointerId);
    }
    var wrap = document.getElementById("stage-wrap");
    if (wrap) wrap.classList.remove("is-dragging");
    if (wasHopeMergeDrag && hadHopeChanges) {
      finalizeHopeMergeDrag();
    }
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

  function updateHopeInteractionModeUi() {
    var viewBtn = document.getElementById("hope-mode-view-btn");
    var mergeBtn = document.getElementById("hope-mode-merge-btn");
    var mergeHint = document.getElementById("hope-merge-hint");

    if (viewBtn) {
      viewBtn.classList.toggle("is-active", hopeInteractionMode === "view");
      viewBtn.setAttribute("aria-pressed", String(hopeInteractionMode === "view"));
    }
    if (mergeBtn) {
      mergeBtn.classList.toggle("is-active", hopeInteractionMode === "merge");
      mergeBtn.setAttribute("aria-pressed", String(hopeInteractionMode === "merge"));
    }
    if (mergeHint) mergeHint.hidden = hopeInteractionMode !== "merge";
    if (designSvg) {
      designSvg.classList.toggle(
        "is-hope-merge-mode",
        hopeInteractionMode === "merge"
      );
    }
  }

  function setHopeInteractionMode(mode) {
    if (mode !== "view" && mode !== "merge") return;
    hopeInteractionMode = mode;
    updateHopeInteractionModeUi();
    if (isHopeDragInteractionMode()) {
      ensureHopeStippleReady();
      bindInteractionPointerListeners();
    } else {
      unbindInteractionPointerListeners();
    }
  }

  function onHopeResetGrid() {
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
      var octSteps = getOctagonsNSteps();
      slider.min = "1";
      slider.max = String(octSteps);
      slider.step = "1";
      slider.value = String(octagonsNStepFromValue(OCTAGONS_N_DEFAULT));
      slider.addEventListener("input", scheduleSliderRender);
      slider.addEventListener("change", renderAfterSliderRelease);
    }

    var innerSlider = document.getElementById("inner-scale");
    if (innerSlider) {
      var innerSteps = getInnerScaleSteps();
      innerSlider.min = "1";
      innerSlider.max = String(innerSteps);
      innerSlider.step = "1";
      innerSlider.value = String(innerScaleStepFromValue(INNER_SCALE_DEFAULT));
      innerSlider.addEventListener("input", scheduleSliderRender);
      innerSlider.addEventListener("change", renderAfterSliderRelease);
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
        scheduleSliderRender();
      });
    }

    var borderFrameDivisionsSlider = document.getElementById(
      "border-frame-divisions"
    );
    if (borderFrameDivisionsSlider) {
      borderFrameDivisionsSlider.min = "1";
      borderFrameDivisionsSlider.max = "3";
      borderFrameDivisionsSlider.value = "2";
      borderFrameDivisionsSlider.addEventListener("input", function () {
        var frameDivisionsOut = document.getElementById(
          "border-frame-divisions-out"
        );
        if (frameDivisionsOut) {
          frameDivisionsOut.textContent = borderFrameDivisionsLabel(
            getBorderFrameDivisionsStep()
          );
        }
        cachedBorderSideSegmentRatios = null;
        refreshBorderFrameAndLabelBars();
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
      var whiteFillMin =
        typeof BORDER_SIDE_WHITE_FILL_MIN !== "undefined"
          ? BORDER_SIDE_WHITE_FILL_MIN
          : 0;
      var whiteFillMax =
        typeof BORDER_SIDE_WHITE_FILL_MAX !== "undefined"
          ? BORDER_SIDE_WHITE_FILL_MAX
          : 100;
      var whiteFillSteps =
        typeof BORDER_SIDE_WHITE_FILL_STEPS !== "undefined"
          ? BORDER_SIDE_WHITE_FILL_STEPS
          : 5;
      var whiteFillStepSize =
        whiteFillSteps < 2 ? 1 : (whiteFillMax - whiteFillMin) / (whiteFillSteps - 1);
      borderSideWhiteFillSlider.min = String(whiteFillMin);
      borderSideWhiteFillSlider.max = String(whiteFillMax);
      borderSideWhiteFillSlider.step = String(whiteFillStepSize);
      borderSideWhiteFillSlider.value = String(
        snapBorderSideWhiteFillSliderValue(
          typeof BORDER_SIDE_WHITE_FILL_DEFAULT !== "undefined"
            ? BORDER_SIDE_WHITE_FILL_DEFAULT
            : 0
        )
      );
      syncBorderSideWhiteFillOutput();
      borderSideWhiteFillSlider.addEventListener("input", function () {
        var snapped = snapBorderSideWhiteFillSliderValue(
          Number(borderSideWhiteFillSlider.value)
        );
        if (Number(borderSideWhiteFillSlider.value) !== snapped) {
          borderSideWhiteFillSlider.value = String(snapped);
        }
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
    bindFanTuningSliders();

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
      halfCircleInset.min = "0.02";
      halfCircleInset.max = "0.4";
      halfCircleInset.value = "0.03";
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
      halfCircleCuspGap.value = "0";
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

    initFeelingsSteppedSlider(
      "circle-density",
      CIRCLE_DENSITY_MIN,
      CIRCLE_DENSITY_MAX,
      CIRCLE_DENSITY_DEFAULT,
      function () {
        syncCircleSelection(false);
        syncAllFeelingsSliderOutputs();
        renderPatternLayer();
      }
    );

    initFeelingsSteppedSlider(
      "longing-circle-density",
      CIRCLE_DENSITY_MIN,
      getJunctionEmotionDensityMaxForActiveGrid(),
      CIRCLE_DENSITY_DEFAULT,
      function () {
        syncLongingCircleSelection(false);
        syncAllFeelingsSliderOutputs();
        renderPatternLayer();
      }
    );

    initFeelingsSteppedSlider(
      "grief-circle-density",
      CIRCLE_DENSITY_MIN,
      getJunctionEmotionDensityMaxForActiveGrid(),
      CIRCLE_DENSITY_DEFAULT,
      function () {
        syncGriefCircleSelection(false);
        syncAllFeelingsSliderOutputs();
        renderPatternLayer();
      }
    );

    initFeelingsSteppedSlider(
      "strength-density",
      typeof STRENGTH_DENSITY_MIN !== "undefined"
        ? STRENGTH_DENSITY_MIN
        : CIRCLE_DENSITY_MIN,
      getJunctionEmotionDensityMaxForActiveGrid(),
      typeof STRENGTH_DENSITY_DEFAULT !== "undefined"
        ? STRENGTH_DENSITY_DEFAULT
        : CIRCLE_DENSITY_DEFAULT,
      function () {
        syncStrengthSelection(false);
        syncAllFeelingsSliderOutputs();
        renderPatternLayer();
      }
    );

    initFeelingsSteppedSlider(
      "anger-vertical-length",
      ANGER_VERTICAL_LENGTH_MIN,
      ANGER_VERTICAL_LENGTH_MAX,
      ANGER_VERTICAL_LENGTH_DEFAULT,
      function () {
        syncAllFeelingsSliderOutputs();
        renderVerticalGridLayer();
      }
    );

    initFeelingsSteppedSlider(
      "anxiety-vertical-stroke",
      ANXIETY_VERTICAL_STROKE_MIN,
      ANXIETY_VERTICAL_STROKE_MAX,
      ANXIETY_VERTICAL_STROKE_DEFAULT,
      function () {
        syncAllFeelingsSliderOutputs();
        renderVerticalGridLayer();
      }
    );

    var randomizeCirclesBtn = document.getElementById("randomize-circles-btn");
    if (randomizeCirclesBtn) {
      randomizeCirclesBtn.addEventListener("click", randomizeFeelingsPlacement);
    }

    initFeelingsSteppedSlider(
      "pride-fill-percent",
      PRIDE_FILL_PERCENT_MIN,
      getPrideFillPercentMaxForActiveGrid(),
      PRIDE_FILL_PERCENT_DEFAULT,
      function () {
        syncAllFeelingsSliderOutputs();
        syncDiamondFill(false);
        renderPatternLayer();
      }
    );

    initFeelingsSteppedSlider(
      "guilt-shame-fill-percent",
      typeof GUILT_SHAME_FILL_PERCENT_MIN !== "undefined"
        ? GUILT_SHAME_FILL_PERCENT_MIN
        : 0,
      getGuiltShameFillPercentMaxForActiveGrid(),
      GUILT_SHAME_FILL_PERCENT_DEFAULT,
      function () {
        syncAllFeelingsSliderOutputs();
        syncGuiltShameDiamondFill(false);
        renderPatternLayer();
      }
    );

    initFeelingsSteppedSlider(
      "anger-triangle-density",
      typeof ANGER_TRIANGLE_DENSITY_MIN !== "undefined"
        ? ANGER_TRIANGLE_DENSITY_MIN
        : 0,
      getAngerTriangleDensityMaxForActiveGrid(),
      ANGER_TRIANGLE_DENSITY_DEFAULT,
      function () {
        syncAllFeelingsSliderOutputs();
        syncAngerTriangleSelection(false);
        renderPatternLayer();
      }
    );

    initFeelingsSteppedSlider(
      "helplessness-percent",
      HELPLESSNESS_PERCENT_MIN,
      getHelplessnessPercentMaxForActiveGrid(),
      HELPLESSNESS_PERCENT_DEFAULT,
      function () {
        syncHelplessnessSelection(false);
        syncAllFeelingsSliderOutputs();
        renderPatternLayer();
      }
    );

    var frameOverlayToggle = document.getElementById("frame-overlay-toggle-btn");
    if (frameOverlayToggle) {
      frameOverlayToggle.addEventListener("click", toggleFrameInsetOverlay);
    }

    var exportBtn = document.getElementById("export-svg-btn");
    if (exportBtn) exportBtn.addEventListener("click", onExportSvg);

    var hopeViewBtn = document.getElementById("hope-mode-view-btn");
    if (hopeViewBtn) hopeViewBtn.addEventListener("click", function () {
      setHopeInteractionMode("view");
    });

    var hopeMergeBtn = document.getElementById("hope-mode-merge-btn");
    if (hopeMergeBtn) hopeMergeBtn.addEventListener("click", function () {
      setHopeInteractionMode("merge");
    });

    var hopeResetBtn = document.getElementById("hope-reset-grid-btn");
    if (hopeResetBtn) hopeResetBtn.addEventListener("click", onHopeResetGrid);

    (function () {
      var autoMergeMin =
        typeof AUTO_MERGE_INTENSITY_MIN !== "undefined"
          ? AUTO_MERGE_INTENSITY_MIN
          : 0;
      var autoMergeMax =
        typeof AUTO_MERGE_INTENSITY_MAX !== "undefined"
          ? AUTO_MERGE_INTENSITY_MAX
          : 7;
      var autoMergeDefault =
        typeof AUTO_MERGE_INTENSITY_DEFAULT !== "undefined"
          ? AUTO_MERGE_INTENSITY_DEFAULT
          : 0;
      function onAutoMergeIntensityInteract() {
        syncAllFeelingsSliderOutputs();
        runAutoMerge();
      }
      initFeelingsSteppedSlider(
        "auto-merge-intensity",
        autoMergeMin,
        autoMergeMax,
        autoMergeDefault,
        onAutoMergeIntensityInteract
      );
      var autoMergeIntensitySlider = document.getElementById("auto-merge-intensity");
      if (autoMergeIntensitySlider) {
        autoMergeIntensitySlider.addEventListener(
          "pointerdown",
          onAutoMergeIntensityInteract
        );
      }
    })();
    syncAllFeelingsSliderOutputs();

    initSheetPaletteAutoRefresh();

    if (window.SheetPalettes) {
      if (window.SheetPalettes.loadEmbeddedPalettesFast) {
        await window.SheetPalettes.loadEmbeddedPalettesFast();
      } else {
        await window.SheetPalettes.loadSheetPalettes();
      }
      var restoredPalette =
        window.SheetPalettes.getRememberedActivePalette &&
        window.SheetPalettes.getRememberedActivePalette();
      window.SheetPalettes.setActivePalette(restoredPalette || "palette1");
      initSheetPaletteControls();
    }

    sheetPaletteInitComplete = true;

    window.UnderCoverComboBridge = {
      applyColorDivisionLayout: function (seed, areaOrderStr) {
        var parsedSeed = parseInt(String(seed), 10);
        colorDivisionShuffleSeed = isFinite(parsedSeed) ? parsedSeed : 0;
        lastColorDivisionLayoutSignature = "";
        cachedColorDivisionNormalizedRects = null;
        cachedColorDivisionRectOrder = null;
        ensureColorDivisionRects(true);
        if (areaOrderStr && String(areaOrderStr).trim()) {
          var parts = String(areaOrderStr)
            .split(",")
            .map(function (s) {
              return parseInt(s.trim(), 10);
            })
            .filter(function (n) {
              return isFinite(n);
            });
          if (parts.length === 5) {
            cachedColorDivisionRectOrder = parts;
          }
        }
        updateColorDivisionsLayer();
      },
      setHopeMode: setHopeInteractionMode,
      setLabelBarTagIndex: setLabelBarEndCapSvgByIndex,
      resetHopeMergeState: function () {
        removedEdges.clear();
        updateHopeInteractionModeUi();
      },
      getFeelingsSliderBounds: getFeelingsSliderBoundsForCombo,
      finalizeApplySilent: function () {
        syncColorDivisionsOutput();
        syncBorderSideWhiteFillOutput();
        syncJunctionEmotionSliderRangesForGridType();
        syncAngerPainGuiltSliderRangesForGridType();
        resetFeelingsLayoutSignatures();
        applyFeelingsControlState({ skipRender: true });
        refreshLocationCoordinates();
      },
      finalizeApply: function () {
        syncColorDivisionsOutput();
        syncBorderSideWhiteFillOutput();
        syncJunctionEmotionSliderRangesForGridType();
        syncAngerPainGuiltSliderRangesForGridType();
        resetFeelingsLayoutSignatures();
        applyFeelingsControlState();
        refreshLocationCoordinates();
        refreshLabelBarContent();
        render();
      },
      applyPrideLayers: function () {
        syncAllFeelingsSliderOutputs();
        if (getAutoMergeIntensity() > 0) {
          runAutoMerge();
        } else {
          clearAutoMergeState();
          renderAutoMergeFillsLayer();
        }
        syncDiamondFill(false);
        renderPatternLayer();
      },
    };

    if (
      window.HandkerchiefCombinations &&
      window.HandkerchiefCombinations.init
    ) {
      window.HandkerchiefCombinations.init();
    }
    if (
      window.HandkerchiefCombinations &&
      window.HandkerchiefCombinations.loadAndApplyInitialCombo
    ) {
      await window.HandkerchiefCombinations.loadAndApplyInitialCombo();
    }

    if (window.SheetPalettes && window.SheetPalettes.startLiveSync) {
      window.SheetPalettes.startLiveSync(3000);
    }

    if (window.SheetPalettes && window.SheetPalettes.refreshSheetPalettesIfChanged) {
      window.SheetPalettes.refreshSheetPalettesIfChanged().catch(function () {
        /* background Google sync; embedded palette already applied */
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        sheetPaletteWasHidden = true;
        return;
      }
      if (sheetPaletteWasHidden) {
        sheetPaletteWasHidden = false;
        scheduleSheetPaletteReload();
      }
    });

    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted) scheduleSheetPaletteReload();
    });

    if (window.IdentityControls && window.IdentityControls.setOnLivingInIranChange) {
      window.IdentityControls.setOnLivingInIranChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnLivingDurationChange) {
      window.IdentityControls.setOnLivingDurationChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnLeavingYearChange) {
      window.IdentityControls.setOnLeavingYearChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnAgeChange) {
      window.IdentityControls.setOnAgeChange(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnFromChange) {
      window.IdentityControls.setOnFromChange(refreshLabelBarContent);
    }
    if (window.LocationCoordinates && window.LocationCoordinates.setOnUpdate) {
      window.LocationCoordinates.setOnUpdate(refreshLabelBarContent);
    }
    if (window.IdentityControls && window.IdentityControls.setOnNowInChange) {
      window.IdentityControls.setOnNowInChange(function () {
        scheduleLocationCoordinates();
        refreshLabelBarContent();
      });
    }
    if (window.IdentityControls && window.IdentityControls.setOnHomeAtChange) {
      window.IdentityControls.setOnHomeAtChange(function () {
        scheduleLocationCoordinates();
        refreshLabelBarContent();
      });
    }
    refreshLocationCoordinates();
    if (window.IdentityControls && window.IdentityControls.setOnNameChange) {
      window.IdentityControls.setOnNameChange(refreshLabelBarContent);
    }

    initLabelBarTagControls();

    window.addEventListener("resize", layoutStage);
    lastCircleLayoutSignature = "";
    lastLongingCircleLayoutSignature = "";
    lastGriefCircleLayoutSignature = "";
    lastStrengthCircleLayoutSignature = "";
    lastHelplessnessLayoutSignature = "";
    lastDiamondLayoutSignature = "";
    render();
    appStartupBootstrapping = false;
    syncFrameOverlayToggleButton();
    initMagnifier();
    initSidebarScrollFocus();
    setHopeInteractionMode("view");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

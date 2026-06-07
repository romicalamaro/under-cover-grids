/**
 * Hex grid ("hearts" tessellation).
 *
 * Lattice: flat-top hexagonal honeycomb. Each hexagon stacks directly above and
 * below its column neighbour (sharing the horizontal top/bottom edge line), and
 * adjacent columns are offset vertically by half a hexagon height.
 *
 * Motif ("heart"): a flat-top hexagon whose top edge is pushed inward into a V
 * notch and whose bottom edge is pulled outward into a matching downward apex.
 * Because the apex of the hexagon below exactly fills the notch of the hexagon
 * above, the modified shape still tiles the plane perfectly — that interlock is
 * what reads as rows of hearts.
 *
 * Ribbons: the visible blue "double line" is not the raw skeleton. We draw each
 * heart inset (offset inward by a constant width). The ribbon you see is the gap
 * between two neighbouring insets, and the small star junctions appear naturally
 * where three insets meet.
 *
 * Output is the same line-segment shape as the other grids: { x1, y1, x2, y2 }[].
 */
(function (global) {
  var DEFAULT_NOTCH_RATIO =
    typeof HEX_GRID_NOTCH_RATIO !== "undefined" ? HEX_GRID_NOTCH_RATIO : 0.6;
  var DEFAULT_RIBBON_RATIO =
    typeof HEX_GRID_RIBBON_RATIO !== "undefined" ? HEX_GRID_RIBBON_RATIO : 0.16;
  var SQRT3 = Math.sqrt(3);

  function roundCoord(v) {
    return Math.round(v * 10000) / 10000;
  }

  function clampInnerScale(innerScale) {
    var min = typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
    var max = typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    if (typeof innerScale !== "number") {
      innerScale = max;
    }
    return Math.min(max, Math.max(min, innerScale));
  }

  /**
   * Ribbon half-width as a fraction of the hex radius R.
   * The inner-scale slider (identity at centre) thickens the ribbon: at slider
   * max (1) ribbons are thin and the white hearts are large; at the slider min
   * the ribbons are thickest. An explicit ribbonRatio override wins (preview).
   * @param {number} innerScale
   * @param {number} [ribbonRatioOverride]
   * @returns {number}
   */
  function ribbonRatioFromInnerScale(innerScale, ribbonRatioOverride) {
    if (typeof ribbonRatioOverride === "number") {
      return ribbonRatioOverride;
    }
    var s = clampInnerScale(innerScale);
    var min = typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
    var max = typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    var t = max > min ? (s - min) / (max - min) : 1;
    // t = 1 → thin ribbon (DEFAULT_RIBBON_RATIO); t = 0 → ~2.2× thicker.
    return DEFAULT_RIBBON_RATIO * (2.2 - 1.2 * t);
  }

  /**
   * Hex radius R (centre to left/right vertex) from the density n.
   * Columns are spaced 1.5·R apart, so n columns roughly span the canvas width.
   * @param {number} n hearts (hex columns) per row
   * @param {number} canvasW
   * @returns {number}
   */
  function hexRadiusFromN(n, canvasW) {
    n = Math.max(1, Math.round(n));
    return canvasW / (1.5 * n + 0.5);
  }

  /**
   * The other grids expose tileSizeFromN; here we report the heart width (2·R)
   * so the "tile info" readout stays meaningful.
   * @param {number} n
   * @param {number} canvasW
   * @returns {number}
   */
  function tileSizeFromN(n, canvasW) {
    return 2 * hexRadiusFromN(n, canvasW);
  }

  /**
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ R: number, H: number, colSpacing: number, rowSpacing: number,
   *   cols: number, rows: number, offsetY: number, tileSize: number, m: number }}
   */
  function computeLayout(n, canvasW, canvasH) {
    n = Math.max(1, Math.round(n));
    var R = hexRadiusFromN(n, canvasW);
    var H = (R * SQRT3) / 2;
    var colSpacing = 1.5 * R;
    var rowSpacing = 2 * H;
    var cols = n;
    // Enough stacked hexagons to cover the (tall) canvas with one row of bleed.
    var rows = Math.max(1, Math.ceil(canvasH / rowSpacing) + 1);
    var gridHeight = rows * rowSpacing;
    var offsetY = (canvasH - gridHeight) / 2;
    return {
      R: R,
      H: H,
      colSpacing: colSpacing,
      rowSpacing: rowSpacing,
      cols: cols,
      rows: rows,
      offsetY: offsetY,
      tileSize: 2 * R,
      m: Math.max(0, rows - 1),
    };
  }

  /**
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function getGridContentBounds(n, canvasW, canvasH) {
    return { x: 0, y: 0, width: canvasW, height: canvasH };
  }

  /**
   * One heart polygon (flat-top hexagon with notched top + apex bottom).
   * Points are listed clockwise starting at the upper-left peak.
   * @param {number} cx
   * @param {number} cy
   * @param {number} R
   * @param {number} H
   * @param {number} notchDepth
   * @returns {{ x: number, y: number }[]}
   */
  function buildHeartPolygon(cx, cy, R, H, notchDepth) {
    return [
      { x: cx - R / 2, y: cy - H }, // upper-left peak
      { x: cx, y: cy - H + notchDepth }, // top notch (dips toward centre)
      { x: cx + R / 2, y: cy - H }, // upper-right peak
      { x: cx + R, y: cy }, // right vertex
      { x: cx + R / 2, y: cy + H }, // lower-right
      { x: cx, y: cy + H + notchDepth }, // bottom apex (matches notch below)
      { x: cx - R / 2, y: cy + H }, // lower-left
      { x: cx - R, y: cy }, // left vertex
    ];
  }

  /**
   * Centres of every hex/heart needed to cover the canvas (with bleed).
   * Columns are spaced colSpacing; odd columns are shifted down by H so the
   * honeycomb interlocks.
   * @param {object} layout
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ cx: number, cy: number, col: number, row: number }[]}
   */
  function buildHexCenters(layout, canvasW, canvasH) {
    var centers = [];
    var col;
    var row;
    var cx;
    var cy;
    var colStart = -1;
    var colEnd = layout.cols + 1;
    var rowStart = -1;
    var rowEnd = layout.rows + 1;

    for (col = colStart; col <= colEnd; col++) {
      for (row = rowStart; row <= rowEnd; row++) {
        cx = col * layout.colSpacing;
        cy = layout.offsetY + row * layout.rowSpacing + (col & 1 ? layout.H : 0);
        centers.push({ cx: cx, cy: cy, col: col, row: row });
      }
    }
    return centers;
  }

  function polygonCentroid(points) {
    var sx = 0;
    var sy = 0;
    var i;
    for (i = 0; i < points.length; i++) {
      sx += points[i].x;
      sy += points[i].y;
    }
    return { x: sx / points.length, y: sy / points.length };
  }

  /**
   * Inset a simple polygon inward by a constant distance w.
   * Each edge is shifted toward the centroid by w, then consecutive shifted
   * edges are intersected to find the new vertices. Robust enough for the
   * near-convex heart (the single concave notch behaves for moderate w).
   * @param {{ x: number, y: number }[]} points
   * @param {number} w
   * @returns {{ x: number, y: number }[]}
   */
  function insetPolygon(points, w) {
    var n = points.length;
    var c = polygonCentroid(points);
    var lines = [];
    var i;
    var a;
    var b;
    var dx;
    var dy;
    var len;
    var nx;
    var ny;
    var mx;
    var my;

    for (i = 0; i < n; i++) {
      a = points[i];
      b = points[(i + 1) % n];
      dx = b.x - a.x;
      dy = b.y - a.y;
      len = Math.hypot(dx, dy) || 1;
      // Unit normal (two choices); pick the one pointing toward the centroid.
      nx = -dy / len;
      ny = dx / len;
      mx = (a.x + b.x) / 2;
      my = (a.y + b.y) / 2;
      if ((c.x - mx) * nx + (c.y - my) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      lines.push({
        px: a.x + nx * w,
        py: a.y + ny * w,
        dx: dx,
        dy: dy,
      });
    }

    function intersect(l1, l2) {
      var denom = l1.dx * l2.dy - l1.dy * l2.dx;
      if (Math.abs(denom) < 1e-9) {
        return { x: l2.px, y: l2.py };
      }
      var t =
        ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / denom;
      return { x: l1.px + t * l1.dx, y: l1.py + t * l1.dy };
    }

    var out = [];
    for (i = 0; i < n; i++) {
      out.push(intersect(lines[(i - 1 + n) % n], lines[i]));
    }
    return out;
  }

  /**
   * Resolve the geometric knobs from the slider value plus optional overrides.
   * @param {object} layout
   * @param {number} innerScale
   * @param {{ notchRatio?: number, ribbonRatio?: number }} [opts]
   */
  function resolveParams(layout, innerScale, opts) {
    opts = opts || {};
    var notchRatio =
      typeof opts.notchRatio === "number" ? opts.notchRatio : DEFAULT_NOTCH_RATIO;
    var ribbonRatio = ribbonRatioFromInnerScale(innerScale, opts.ribbonRatio);
    return {
      notchDepth: layout.H * notchRatio,
      ribbonWidth: layout.R * ribbonRatio,
    };
  }

  function polygonToSegments(points, out) {
    var i;
    var a;
    var b;
    for (i = 0; i < points.length; i++) {
      a = points[i];
      b = points[(i + 1) % points.length];
      out.push({
        x1: roundCoord(a.x),
        y1: roundCoord(a.y),
        x2: roundCoord(b.x),
        y2: roundCoord(b.y),
      });
    }
  }

  /**
   * Inset heart outlines for every tile — the visible pattern.
   * @param {number} tileSize unused (kept for signature parity with other grids)
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} n
   * @param {number} innerScale
   * @param {{ notchRatio?: number, ribbonRatio?: number }} [opts]
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildPatternSegments(tileSize, canvasW, canvasH, n, innerScale, opts) {
    var layout = computeLayout(n, canvasW, canvasH);
    var params = resolveParams(layout, innerScale, opts);
    var centers = buildHexCenters(layout, canvasW, canvasH);
    var out = [];
    var i;
    var heart;
    var inset;

    for (i = 0; i < centers.length; i++) {
      heart = buildHeartPolygon(
        centers[i].cx,
        centers[i].cy,
        layout.R,
        layout.H,
        params.notchDepth
      );
      inset = insetPolygon(heart, params.ribbonWidth);
      polygonToSegments(inset, out);
    }
    return out;
  }

  /**
   * Skeleton heart outlines (no inset) — handy for catalogs/merges later.
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {{ notchRatio?: number }} [opts]
   * @returns {{ id: string, cx: number, cy: number, points: { x: number, y: number }[] }[]}
   */
  function buildHeartCatalog(n, canvasW, canvasH, opts) {
    var layout = computeLayout(n, canvasW, canvasH);
    var notchRatio =
      opts && typeof opts.notchRatio === "number"
        ? opts.notchRatio
        : DEFAULT_NOTCH_RATIO;
    var notchDepth = layout.H * notchRatio;
    var centers = buildHexCenters(layout, canvasW, canvasH);
    var catalog = [];
    var i;

    for (i = 0; i < centers.length; i++) {
      catalog.push({
        id: "ht-" + centers[i].col + "-" + centers[i].row,
        cx: roundCoord(centers[i].cx),
        cy: roundCoord(centers[i].cy),
        points: buildHeartPolygon(
          centers[i].cx,
          centers[i].cy,
          layout.R,
          layout.H,
          notchDepth
        ).map(function (p) {
          return { x: roundCoord(p.x), y: roundCoord(p.y) };
        }),
      });
    }
    return catalog;
  }

  global.HexGridGeometry = {
    tileSizeFromN: tileSizeFromN,
    computeLayout: computeLayout,
    getGridContentBounds: getGridContentBounds,
    buildHeartPolygon: buildHeartPolygon,
    buildHexCenters: buildHexCenters,
    insetPolygon: insetPolygon,
    buildPatternSegments: buildPatternSegments,
    buildHeartCatalog: buildHeartCatalog,
  };
})(typeof window !== "undefined" ? window : this);

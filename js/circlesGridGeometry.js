/**
 * Circles grid: simple square tessellation with structural circles centered in 2×2 cell blocks.
 */
(function (global) {
  var DIAMOND_HALF_RATIO =
    typeof CIRCLES_GRID_CELL_DIAMOND_HALF_RATIO !== "undefined"
      ? CIRCLES_GRID_CELL_DIAMOND_HALF_RATIO
      : 0.35;
  var HELPLESS_HALF_RATIO =
    typeof CIRCLES_GRID_HELPLESS_HALF_RATIO !== "undefined"
      ? CIRCLES_GRID_HELPLESS_HALF_RATIO
      : 0.3;

  function roundCoord(v) {
    return Math.round(v * 10000) / 10000;
  }

  function clampInnerScale(innerScale) {
    var min =
      typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
    var max =
      typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    if (typeof innerScale !== "number") {
      innerScale = max;
    }
    return Math.min(max, Math.max(min, innerScale));
  }

  /**
   * Half-width from static center line to each side line in a 2-column circle block.
   * innerScale min → side lines closest to center; max (1) → side lines at block edges.
   * @param {number} S cell size
   * @param {number} innerScale
   * @returns {number}
   */
  function sideHalfWidthFromInnerScale(S, innerScale) {
    return S * clampInnerScale(innerScale);
  }

  /**
   * Three vertical lines per circle block: side left, static center, side right.
   * @param {{ tileSize: number, cols: number, rows: number, offsetY: number }} layout
   * @param {number} innerScale
   * @returns {number[]}
   */
  function buildVerticalLineXs(layout, innerScale) {
    var S = layout.tileSize;
    var sideHalf = sideHalfWidthFromInnerScale(S, innerScale);
    var blockCount = layout.cols / 2;
    var xs = [];
    var seen = {};
    var b;
    var center;

    function add(x) {
      x = roundCoord(x);
      var key = String(x);
      if (seen[key]) return;
      seen[key] = true;
      xs.push(x);
    }

    for (b = 0; b < blockCount; b++) {
      center = (2 * b + 1) * S;
      add(center - sideHalf);
      add(center);
      add(center + sideHalf);
    }
    // Extend existing lines to canvas edges only — no extra interior positions.
    add(0);
    add(layout.cols * S);
    xs.sort(function (a, b) {
      return a - b;
    });
    return xs;
  }

  /**
   * Three horizontal lines per circle block: side top, static center, side bottom.
   * @param {{ tileSize: number, rows: number, offsetY: number }} layout
   * @param {number} innerScale
   * @returns {number[]}
   */
  function buildHorizontalLineYs(layout, innerScale) {
    var S = layout.tileSize;
    var sideHalf = sideHalfWidthFromInnerScale(S, innerScale);
    var blockCount = layout.rows / 2;
    var ys = [];
    var seen = {};
    var b;
    var center;

    function add(y) {
      y = roundCoord(y);
      var key = String(y);
      if (seen[key]) return;
      seen[key] = true;
      ys.push(y);
    }

    for (b = 0; b < blockCount; b++) {
      center = layout.offsetY + (2 * b + 1) * S;
      add(center - sideHalf);
      add(center);
      add(center + sideHalf);
    }
    add(layout.offsetY);
    add(layout.offsetY + layout.rows * S);
    ys.sort(function (a, b) {
      return a - b;
    });
    return ys;
  }

  /**
   * Uniform grid for emotion-marker catalogs (not affected by inner-scale slider).
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ layout: object, verticalXs: number[], horizontalYs: number[] }}
   */
  function buildUniformLineLayout(n, canvasW, canvasH) {
    var layout = computeLayout(n, canvasW, canvasH);
    var S = layout.tileSize;
    var verticalXs = [];
    var horizontalYs = [];
    var col;
    var row;

    for (col = 0; col <= layout.cols; col++) {
      verticalXs.push(roundCoord(col * S));
    }
    for (row = 0; row <= layout.rows; row++) {
      horizontalYs.push(roundCoord(layout.offsetY + row * S));
    }

    return {
      layout: layout,
      verticalXs: verticalXs,
      horizontalYs: horizontalYs,
    };
  }

  /**
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {number[]}
   */
  function buildUniformVerticalLineXs(n, canvasW, canvasH) {
    return buildUniformLineLayout(n, canvasW, canvasH).verticalXs;
  }

  /**
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} innerScale
   * @returns {{ layout: object, verticalXs: number[], horizontalYs: number[], sideHalfWidth: number }}
   */
  function buildLineLayout(n, canvasW, canvasH, innerScale) {
    var layout = computeLayout(n, canvasW, canvasH);
    return {
      layout: layout,
      verticalXs: buildVerticalLineXs(layout, innerScale),
      horizontalYs: buildHorizontalLineYs(layout, innerScale),
      sideHalfWidth: sideHalfWidthFromInnerScale(layout.tileSize, innerScale),
    };
  }

  /**
   * Circles need an even cell-column count so 2×2 blocks tile the full width.
   * n is snapped to odd values (cols = n + 1 stays even).
   * @param {number} n
   * @returns {number}
   */
  function snapCirclesGridN(n) {
    var min =
      typeof CIRCLES_GRID_N_MIN !== "undefined"
        ? CIRCLES_GRID_N_MIN
        : typeof OCTAGONS_N_MIN !== "undefined"
          ? OCTAGONS_N_MIN
          : 7;
    var max =
      typeof CIRCLES_GRID_N_MAX !== "undefined"
        ? CIRCLES_GRID_N_MAX
        : typeof OCTAGONS_N_MAX !== "undefined"
          ? OCTAGONS_N_MAX
          : 13;
    if (min % 2 === 0) min += 1;
    if (max % 2 === 0) max -= 1;
    n = Math.round(n);
    if (n < min) n = min;
    if (n > max) n = max;
    if (n % 2 === 0) {
      n = n + 1 <= max ? n + 1 : n - 1;
    }
    return n;
  }

  /**
   * @param {number} n fine cells per row (snapped to odd for full 2×2 circle blocks)
   * @param {number} canvasW
   * @returns {number}
   */
  function tileSizeFromN(n, canvasW) {
    return canvasW / (snapCirclesGridN(n) + 1);
  }

  /**
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ tileSize: number, cols: number, rows: number, offsetY: number, m: number }}
   */
  function computeLayout(n, canvasW, canvasH) {
    n = snapCirclesGridN(n);
    var tileSize = canvasW / (n + 1);
    var cols = n + 1;
    var rows = Math.max(2, Math.ceil(canvasH / tileSize));
    if (rows % 2 !== 0) rows += 1;
    var m = Math.max(0, rows - 1);
    var gridHeight = rows * tileSize;
    var offsetY = (canvasH - gridHeight) / 2;
    return {
      tileSize: tileSize,
      cols: cols,
      rows: rows,
      offsetY: offsetY,
      m: m,
    };
  }

  /**
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function getGridContentBounds(n, canvasW, canvasH) {
    var layout = computeLayout(n, canvasW, canvasH);
    var gridH = layout.rows * layout.tileSize;
    var y0 = Math.max(0, layout.offsetY);
    var y1 = Math.min(canvasH, layout.offsetY + gridH);
    return {
      x: 0,
      y: y0,
      width: canvasW,
      height: y1 - y0,
    };
  }

  /**
   * Split axis-aligned grid lines into unit segments at every crossing.
   * @param {number[]} verticalXs
   * @param {number[]} horizontalYs
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildSplitGridSegments(verticalXs, horizontalYs) {
    var segments = [];
    var seen = {};
    var i;
    var j;

    function segmentKey(x1, y1, x2, y2) {
      x1 = roundCoord(x1);
      y1 = roundCoord(y1);
      x2 = roundCoord(x2);
      y2 = roundCoord(y2);
      if (x1 > x2 || (x1 === x2 && y1 > y2)) {
        return x2 + "," + y2 + "," + x1 + "," + y1;
      }
      return x1 + "," + y1 + "," + x2 + "," + y2;
    }

    function addSegment(x1, y1, x2, y2) {
      var key = segmentKey(x1, y1, x2, y2);
      if (seen[key]) return;
      seen[key] = true;
      segments.push({
        x1: roundCoord(x1),
        y1: roundCoord(y1),
        x2: roundCoord(x2),
        y2: roundCoord(y2),
      });
    }

    for (i = 0; i < verticalXs.length; i++) {
      for (j = 0; j < horizontalYs.length - 1; j++) {
        addSegment(verticalXs[i], horizontalYs[j], verticalXs[i], horizontalYs[j + 1]);
      }
    }
    for (j = 0; j < horizontalYs.length; j++) {
      for (i = 0; i < verticalXs.length - 1; i++) {
        addSegment(verticalXs[i], horizontalYs[j], verticalXs[i + 1], horizontalYs[j]);
      }
    }

    return segments;
  }

  /**
   * Structural ellipse outlines as chord segments for planar tracing.
   * @param {{ cx: number, cy: number, rx: number, ry: number }[]} circles
   * @param {number} [steps]
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildEllipseBoundarySegments(circles, steps) {
    steps =
      typeof steps === "number"
        ? steps
        : typeof CIRCLES_GRID_PRIDE_ELLIPSE_ARC_STEPS !== "undefined"
          ? CIRCLES_GRID_PRIDE_ELLIPSE_ARC_STEPS
          : 16;
    var segments = [];
    var ci;
    var i;
    var a0;
    var a1;
    var c;

    for (ci = 0; ci < circles.length; ci++) {
      c = circles[ci];
      for (i = 0; i < steps; i++) {
        a0 = (2 * Math.PI * i) / steps;
        a1 = (2 * Math.PI * (i + 1)) / steps;
        segments.push({
          x1: roundCoord(c.cx + c.rx * Math.cos(a0)),
          y1: roundCoord(c.cy + c.ry * Math.sin(a0)),
          x2: roundCoord(c.cx + c.rx * Math.cos(a1)),
          y2: roundCoord(c.cy + c.ry * Math.sin(a1)),
        });
      }
    }

    return segments;
  }

  /**
   * Pride tessellation: inner-scale grid + structural ellipse arcs.
   * Corner/edge cells and quarter-circle sectors become mergeable faces.
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} innerScale
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildPrideCircleTessellationSegments(n, canvasW, canvasH, innerScale) {
    var lineLayout = buildLineLayout(n, canvasW, canvasH, innerScale);
    var segments = buildSplitGridSegments(
      lineLayout.verticalXs,
      lineLayout.horizontalYs
    );
    var circles = buildStructuralCircles(n, canvasW, canvasH, innerScale);
    return segments.concat(buildEllipseBoundarySegments(circles));
  }

  /**
   * Interior intersection between two line segments (open interval, excludes endpoints).
   * @returns {{ t1: number, t2: number, x: number, y: number } | null}
   */
  function segmentInteriorIntersection(s1, s2) {
    var x1 = s1.x1;
    var y1 = s1.y1;
    var x2 = s1.x2;
    var y2 = s1.y2;
    var x3 = s2.x1;
    var y3 = s2.y1;
    var x4 = s2.x2;
    var y4 = s2.y2;
    var denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-12) return null;
    var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    var u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denom;
    var eps = 1e-7;
    if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
    return {
      t1: t,
      t2: u,
      x: roundCoord(x1 + t * (x2 - x1)),
      y: roundCoord(y1 + t * (y2 - y1)),
    };
  }

  /**
   * @param {{ x1: number, y1: number, x2: number, y2: number }} seg
   * @param {number[]} ts values in (0, 1)
   * @param {{ x1: number, y1: number, x2: number, y2: number }[]} out
   * @param {Object<string, boolean>} seen
   */
  function pushSplitSubsegments(seg, ts, out, seen) {
    if (!ts.length) {
      var key0 =
        roundCoord(seg.x1) +
        "," +
        roundCoord(seg.y1) +
        "," +
        roundCoord(seg.x2) +
        "," +
        roundCoord(seg.y2);
      if (seg.x1 > seg.x2 || (seg.x1 === seg.x2 && seg.y1 > seg.y2)) {
        key0 =
          roundCoord(seg.x2) +
          "," +
          roundCoord(seg.y2) +
          "," +
          roundCoord(seg.x1) +
          "," +
          roundCoord(seg.y1);
      }
      if (!seen[key0]) {
        seen[key0] = true;
        out.push({
          x1: roundCoord(seg.x1),
          y1: roundCoord(seg.y1),
          x2: roundCoord(seg.x2),
          y2: roundCoord(seg.y2),
        });
      }
      return;
    }

    ts.sort(function (a, b) {
      return a - b;
    });
    var unique = [];
    var i;
    for (i = 0; i < ts.length; i++) {
      if (!unique.length || Math.abs(ts[i] - unique[unique.length - 1]) > 1e-7) {
        unique.push(ts[i]);
      }
    }

    var dx = seg.x2 - seg.x1;
    var dy = seg.y2 - seg.y1;
    var pts = [{ x: seg.x1, y: seg.y1 }];
    for (i = 0; i < unique.length; i++) {
      pts.push({
        x: roundCoord(seg.x1 + unique[i] * dx),
        y: roundCoord(seg.y1 + unique[i] * dy),
      });
    }
    pts.push({ x: seg.x2, y: seg.y2 });

    for (i = 0; i < pts.length - 1; i++) {
      var ax = pts[i].x;
      var ay = pts[i].y;
      var bx = pts[i + 1].x;
      var by = pts[i + 1].y;
      if (Math.hypot(bx - ax, by - ay) < 1e-7) continue;
      var key =
        ax <= bx || (ax === bx && ay <= by)
          ? ax + "," + ay + "," + bx + "," + by
          : bx + "," + by + "," + ax + "," + ay;
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ x1: ax, y1: ay, x2: bx, y2: by });
    }
  }

  /**
   * Hope merge tessellation: grid + ellipse chords split at every crossing so
   * traceFaces can detect quarter/half sectors correctly.
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} innerScale
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildHopeMergeTessellationSegments(n, canvasW, canvasH, innerScale) {
    var lineLayout = buildLineLayout(n, canvasW, canvasH, innerScale);
    var gridSegments = buildSplitGridSegments(
      lineLayout.verticalXs,
      lineLayout.horizontalYs
    );
    var circles = buildStructuralCircles(n, canvasW, canvasH, innerScale);
    var ellipseSegments = buildEllipseBoundarySegments(circles);
    var gridSplitTs = [];
    var ellipseSplitTs = [];
    var gi;
    var ei;
    var hit;

    for (gi = 0; gi < gridSegments.length; gi++) {
      gridSplitTs.push([]);
    }
    for (ei = 0; ei < ellipseSegments.length; ei++) {
      ellipseSplitTs.push([]);
    }

    for (gi = 0; gi < gridSegments.length; gi++) {
      for (ei = 0; ei < ellipseSegments.length; ei++) {
        hit = segmentInteriorIntersection(gridSegments[gi], ellipseSegments[ei]);
        if (!hit) continue;
        gridSplitTs[gi].push(hit.t1);
        ellipseSplitTs[ei].push(hit.t2);
      }
    }

    var out = [];
    var seen = {};
    for (gi = 0; gi < gridSegments.length; gi++) {
      pushSplitSubsegments(gridSegments[gi], gridSplitTs[gi], out, seen);
    }
    for (ei = 0; ei < ellipseSegments.length; ei++) {
      pushSplitSubsegments(ellipseSegments[ei], ellipseSplitTs[ei], out, seen);
    }
    return out;
  }

  /**
   * Coarse 2×2 circle-block mesh for Pride auto-merge (block outer boundaries only).
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildCoarseCircleBlockBoundarySegments(n, canvasW, canvasH) {
    var layout = computeLayout(n, canvasW, canvasH);
    var S = layout.tileSize;
    var verticalXs = [];
    var horizontalYs = [];
    var segments = [];
    var seen = {};
    var col;
    var row;
    var i;
    var j;
    var x;
    var y;

    function segmentKey(x1, y1, x2, y2) {
      x1 = roundCoord(x1);
      y1 = roundCoord(y1);
      x2 = roundCoord(x2);
      y2 = roundCoord(y2);
      if (x1 > x2 || (x1 === x2 && y1 > y2)) {
        return x2 + "," + y2 + "," + x1 + "," + y1;
      }
      return x1 + "," + y1 + "," + x2 + "," + y2;
    }

    function addSegment(x1, y1, x2, y2) {
      var key = segmentKey(x1, y1, x2, y2);
      if (seen[key]) return;
      seen[key] = true;
      segments.push({
        x1: roundCoord(x1),
        y1: roundCoord(y1),
        x2: roundCoord(x2),
        y2: roundCoord(y2),
      });
    }

    for (col = 0; col <= layout.cols; col += 2) {
      verticalXs.push(roundCoord(col * S));
    }
    for (row = 0; row <= layout.rows; row += 2) {
      horizontalYs.push(roundCoord(layout.offsetY + row * S));
    }

    // Split at every crossing so traceFaces can walk enclosed block cells.
    for (i = 0; i < verticalXs.length; i++) {
      x = verticalXs[i];
      for (j = 0; j < horizontalYs.length - 1; j++) {
        addSegment(x, horizontalYs[j], x, horizontalYs[j + 1]);
      }
    }
    for (j = 0; j < horizontalYs.length; j++) {
      y = horizontalYs[j];
      for (i = 0; i < verticalXs.length - 1; i++) {
        addSegment(verticalXs[i], y, verticalXs[i + 1], y);
      }
    }

    return segments;
  }

  /**
   * @param {number} tileSize
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} n
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildPatternSegments(tileSize, canvasW, canvasH, n, innerScale) {
    var lineLayout = buildLineLayout(n, canvasW, canvasH, innerScale);
    return buildSplitGridSegments(
      lineLayout.verticalXs,
      lineLayout.horizontalYs
    );
  }

  /**
   * Structural pattern ellipses: one per 2×2 cell block (outline, not emotion layer).
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} innerScale
   * @returns {{ id: string, cx: number, cy: number, rx: number, ry: number }[]}
   */
  function buildStructuralCircles(n, canvasW, canvasH, innerScale) {
    var lineLayout = buildLineLayout(n, canvasW, canvasH, innerScale);
    var layout = lineLayout.layout;
    var S = layout.tileSize;
    var offsetY = layout.offsetY;
    var rx = lineLayout.sideHalfWidth;
    var ry = lineLayout.sideHalfWidth;
    var circles = [];
    var col;
    var row;

    for (row = 0; row + 1 < layout.rows; row += 2) {
      for (col = 0; col + 1 < layout.cols; col += 2) {
        circles.push({
          id: "sc-" + col + "-" + row,
          cx: roundCoord((col + 1) * S),
          cy: roundCoord(offsetY + (row + 1) * S),
          rx: roundCoord(rx),
          ry: roundCoord(ry),
        });
      }
    }

    return circles;
  }

  /**
   * Junction catalog for Longing / Grief / Strength — fixed uniform grid.
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ id: string, cx: number, cy: number, r: number, halfSide: number }[]}
   */
  function buildJunctionCircleCatalog(n, canvasW, canvasH) {
    var uniform = buildUniformLineLayout(n, canvasW, canvasH);
    var S = uniform.layout.tileSize;
    var r = S / 2;
    var halfSide = S / 2;
    var catalog = [];
    var col;
    var row;

    for (row = 0; row <= uniform.layout.rows; row++) {
      for (col = 0; col <= uniform.layout.cols; col++) {
        catalog.push({
          id: "sq-" + col + "-" + row,
          cx: roundCoord(col * S),
          cy: roundCoord(uniform.layout.offsetY + row * S),
          r: roundCoord(r),
          halfSide: roundCoord(halfSide),
        });
      }
    }

    return catalog;
  }

  /**
   * Two-circle junction catalog for Sadness — crosses on shared edges between
   * horizontally or vertically adjacent circle blocks (not circle centers or
   * four-way junctions).
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ id: string, cx: number, cy: number, r: number, halfSide: number }[]}
   */
  function buildAdjacentCircleJunctionCatalog(n, canvasW, canvasH) {
    var uniform = buildUniformLineLayout(n, canvasW, canvasH);
    var S = uniform.layout.tileSize;
    var r = S / 2;
    var halfSide = S / 2;
    var catalog = [];
    var col;
    var row;
    var cx;
    var cy;
    var maxCol = uniform.layout.cols;
    var maxRow = uniform.layout.rows;

    function addJunction(junctionCol, junctionRow) {
      cx = junctionCol * S;
      cy = uniform.layout.offsetY + junctionRow * S;
      if (
        cx + r <= 0 ||
        cx - r >= canvasW ||
        cy + r <= 0 ||
        cy - r >= canvasH
      ) {
        return;
      }
      catalog.push({
        id: "sq-" + junctionCol + "-" + junctionRow,
        cx: roundCoord(cx),
        cy: roundCoord(cy),
        r: roundCoord(r),
        halfSide: roundCoord(halfSide),
      });
    }

    for (row = 1; row <= maxRow - 1; row += 2) {
      for (col = 2; col <= maxCol - 2; col += 2) {
        addJunction(col, row);
      }
    }

    for (row = 2; row <= maxRow - 2; row += 2) {
      for (col = 1; col <= maxCol - 1; col += 2) {
        addJunction(col, row);
      }
    }

    return catalog;
  }

  /**
   * Rotated diamonds at four-way junctions between circle blocks only
   * (even–even grid crosses in the negative space outside circles).
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ id: string, points: { x: number, y: number }[] }[]}
   */
  function buildJunctionDiamondCatalog(n, canvasW, canvasH) {
    var uniform = buildUniformLineLayout(n, canvasW, canvasH);
    var S = uniform.layout.tileSize;
    var h = S * DIAMOND_HALF_RATIO;
    var catalog = [];
    var col;
    var row;
    var cx;
    var cy;

    var maxCol = uniform.layout.cols - 2;
    var maxRow = uniform.layout.rows - 2;

    for (row = 2; row <= maxRow; row += 2) {
      for (col = 2; col <= maxCol; col += 2) {
        cx = col * S;
        cy = uniform.layout.offsetY + row * S;
        if (
          cx + h <= 0 ||
          cx - h >= canvasW ||
          cy + h <= 0 ||
          cy - h >= canvasH
        ) {
          continue;
        }
        catalog.push({
          id: "dm-" + col + "-" + row,
          points: [
            { x: roundCoord(cx), y: roundCoord(cy - h) },
            { x: roundCoord(cx + h), y: roundCoord(cy) },
            { x: roundCoord(cx), y: roundCoord(cy + h) },
            { x: roundCoord(cx - h), y: roundCoord(cy) },
          ],
        });
      }
    }

    return catalog;
  }

  /**
   * Helplessness X marks at grid cross-junctions (line intersections) — fixed uniform grid.
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ id: string, cx: number, cy: number, halfW: number, halfH: number }[]}
   */
  function buildHelplessnessCatalog(n, canvasW, canvasH) {
    var uniform = buildUniformLineLayout(n, canvasW, canvasH);
    var S = uniform.layout.tileSize;
    var half = S * HELPLESS_HALF_RATIO;
    var catalog = [];
    var col;
    var row;

    for (row = 0; row <= uniform.layout.rows; row++) {
      for (col = 0; col <= uniform.layout.cols; col++) {
        catalog.push({
          id: "hp-" + col + "-" + row,
          cx: roundCoord(col * S),
          cy: roundCoord(uniform.layout.offsetY + row * S),
          halfW: roundCoord(half),
          halfH: roundCoord(half),
        });
      }
    }

    return catalog;
  }

  global.CirclesGridGeometry = {
    snapCirclesGridN: snapCirclesGridN,
    tileSizeFromN: tileSizeFromN,
    computeLayout: computeLayout,
    getGridContentBounds: getGridContentBounds,
    buildLineLayout: buildLineLayout,
    buildUniformLineLayout: buildUniformLineLayout,
    buildUniformVerticalLineXs: buildUniformVerticalLineXs,
    buildSplitGridSegments: buildSplitGridSegments,
    buildEllipseBoundarySegments: buildEllipseBoundarySegments,
    buildPrideCircleTessellationSegments: buildPrideCircleTessellationSegments,
    buildHopeMergeTessellationSegments: buildHopeMergeTessellationSegments,
    buildCoarseCircleBlockBoundarySegments: buildCoarseCircleBlockBoundarySegments,
    buildPatternSegments: buildPatternSegments,
    buildStructuralCircles: buildStructuralCircles,
    buildJunctionCircleCatalog: buildJunctionCircleCatalog,
    buildAdjacentCircleJunctionCatalog: buildAdjacentCircleJunctionCatalog,
    buildJunctionDiamondCatalog: buildJunctionDiamondCatalog,
    buildHelplessnessCatalog: buildHelplessnessCatalog,
  };
})(typeof window !== "undefined" ? window : this);

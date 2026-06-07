/**
 * Diamonds grid: same square tessellation as circles grid, with structural diamonds
 * centered in 2×2 cell blocks (same centers and half-extents as structural circles).
 */
(function (global) {
  var Circles = global.CirclesGridGeometry;

  function roundCoord(v) {
    return Math.round(v * 10000) / 10000;
  }

  /**
   * @param {{ cx: number, cy: number, rx: number, ry: number }[]} diamonds
   * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
   */
  function buildDiamondBoundarySegments(diamonds) {
    var segments = [];
    var i;
    var d;
    var top;
    var right;
    var bottom;
    var left;

    for (i = 0; i < diamonds.length; i++) {
      d = diamonds[i];
      top = { x: roundCoord(d.cx), y: roundCoord(d.cy - d.ry) };
      right = { x: roundCoord(d.cx + d.rx), y: roundCoord(d.cy) };
      bottom = { x: roundCoord(d.cx), y: roundCoord(d.cy + d.ry) };
      left = { x: roundCoord(d.cx - d.rx), y: roundCoord(d.cy) };
      segments.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
      segments.push({ x1: right.x, y1: right.y, x2: bottom.x, y2: bottom.y });
      segments.push({ x1: bottom.x, y1: bottom.y, x2: left.x, y2: left.y });
      segments.push({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
    }

    return segments;
  }

  function buildStructuralDiamonds(n, canvasW, canvasH, innerScale) {
    return Circles.buildStructuralCircles(n, canvasW, canvasH, innerScale);
  }

  function buildPrideDiamondTessellationSegments(n, canvasW, canvasH, innerScale) {
    var lineLayout = Circles.buildLineLayout(n, canvasW, canvasH, innerScale);
    var segments = Circles.buildSplitGridSegments(
      lineLayout.verticalXs,
      lineLayout.horizontalYs
    );
    var diamonds = buildStructuralDiamonds(n, canvasW, canvasH, innerScale);
    return segments.concat(buildDiamondBoundarySegments(diamonds));
  }

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

  function buildHopeMergeTessellationSegments(n, canvasW, canvasH, innerScale) {
    var lineLayout = Circles.buildLineLayout(n, canvasW, canvasH, innerScale);
    var gridSegments = Circles.buildSplitGridSegments(
      lineLayout.verticalXs,
      lineLayout.horizontalYs
    );
    var diamonds = buildStructuralDiamonds(n, canvasW, canvasH, innerScale);
    var diamondSegments = buildDiamondBoundarySegments(diamonds);
    var gridSplitTs = [];
    var diamondSplitTs = [];
    var gi;
    var di;
    var hit;

    for (gi = 0; gi < gridSegments.length; gi++) {
      gridSplitTs.push([]);
    }
    for (di = 0; di < diamondSegments.length; di++) {
      diamondSplitTs.push([]);
    }

    for (gi = 0; gi < gridSegments.length; gi++) {
      for (di = 0; di < diamondSegments.length; di++) {
        hit = segmentInteriorIntersection(gridSegments[gi], diamondSegments[di]);
        if (!hit) continue;
        gridSplitTs[gi].push(hit.t1);
        diamondSplitTs[di].push(hit.t2);
      }
    }

    var out = [];
    var seen = {};
    for (gi = 0; gi < gridSegments.length; gi++) {
      pushSplitSubsegments(gridSegments[gi], gridSplitTs[gi], out, seen);
    }
    for (di = 0; di < diamondSegments.length; di++) {
      pushSplitSubsegments(diamondSegments[di], diamondSplitTs[di], out, seen);
    }
    return out;
  }

  global.DiamondsGridGeometry = {
    snapCirclesGridN: Circles.snapCirclesGridN,
    tileSizeFromN: Circles.tileSizeFromN,
    computeLayout: Circles.computeLayout,
    getGridContentBounds: Circles.getGridContentBounds,
    buildLineLayout: Circles.buildLineLayout,
    buildUniformLineLayout: Circles.buildUniformLineLayout,
    buildUniformVerticalLineXs: Circles.buildUniformVerticalLineXs,
    buildSplitGridSegments: Circles.buildSplitGridSegments,
    buildCoarseCircleBlockBoundarySegments:
      Circles.buildCoarseCircleBlockBoundarySegments,
    buildPatternSegments: Circles.buildPatternSegments,
    buildJunctionCircleCatalog: Circles.buildJunctionCircleCatalog,
    buildAdjacentCircleJunctionCatalog: Circles.buildAdjacentCircleJunctionCatalog,
    buildJunctionDiamondCatalog: Circles.buildJunctionDiamondCatalog,
    buildHelplessnessCatalog: Circles.buildHelplessnessCatalog,
    buildStructuralDiamonds: buildStructuralDiamonds,
    buildDiamondBoundarySegments: buildDiamondBoundarySegments,
    buildPrideDiamondTessellationSegments: buildPrideDiamondTessellationSegments,
    buildHopeMergeTessellationSegments: buildHopeMergeTessellationSegments,
    buildStructuralCircles: buildStructuralDiamonds,
    buildEllipseBoundarySegments: buildDiamondBoundarySegments,
    buildPrideCircleTessellationSegments: buildPrideDiamondTessellationSegments,
  };
})(typeof window !== "undefined" ? window : this);

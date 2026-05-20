/**
 * 8-fold Topkapi tessellation: octagon + square + kite per unit cell.
 * Octagon from square side T with corner cuts t = T / (2 + sqrt(2)).
 */
(function (global) {
  var CUT = typeof CUT_RATIO !== "undefined" ? CUT_RATIO : 1 / (2 + Math.SQRT2);

  function roundCoord(v) {
    return Math.round(v * 10000) / 10000;
  }

  /**
   * @param {number} n full octagons per row/column (half-octagon on each edge)
   * @param {number} canvasW
   * @returns {number} tile size T = canvasW / (n + 1)
   */
  function tileSizeFromN(n, canvasW) {
    return canvasW / (n + 1);
  }

  /**
   * Layout: (n+1) tile widths across, (m+1) tile rows down.
   * Horizontal span is exact at x=0; vertical grid is centered so top/bottom
   * clip the same amount (symmetric partial shapes, no white gaps).
   * @param {number} n
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ tileSize: number, cols: number, rows: number, offsetY: number, m: number }}
   */
  function computeLayout(n, canvasW, canvasH) {
    var tileSize = tileSizeFromN(n, canvasW);
    var cols = n + 1;
    // ceil so grid height >= canvas; center vertically for symmetric clip
    var rows = Math.max(1, Math.ceil(canvasH / tileSize));
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
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {string}
   */
  function segmentKey(x1, y1, x2, y2) {
    var ax = roundCoord(x1);
    var ay = roundCoord(y1);
    var bx = roundCoord(x2);
    var by = roundCoord(y2);
    if (ax > bx || (ax === bx && ay > by)) {
      return bx + "," + by + "," + ax + "," + ay;
    }
    return ax + "," + ay + "," + bx + "," + by;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} out
   * @param {Set<string>} seen
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  function pushSegment(out, seen, x1, y1, x2, y2) {
    if (x1 === x2 && y1 === y2) return;
    var key = segmentKey(x1, y1, x2, y2);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x1: x1, y1: y1, x2: x2, y2: y2 });
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {number} px
   * @param {number} py
   * @param {number} s
   * @returns {{ x: number, y: number }}
   */
  function scalePoint(cx, cy, px, py, s) {
    return { x: cx + s * (px - cx), y: cy + s * (py - cy) };
  }

  /**
   * Octagon edges in local cell coords [0, T] × [0, T].
   * @param {number} T
   * @param {number} cut
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getOctagonEdges(T, cut) {
    return [
      { x1: cut, y1: 0, x2: T - cut, y2: 0 },
      { x1: T - cut, y1: 0, x2: T, y2: cut },
      { x1: T, y1: cut, x2: T, y2: T - cut },
      { x1: T, y1: T - cut, x2: T - cut, y2: T },
      { x1: T - cut, y1: T, x2: cut, y2: T },
      { x1: cut, y1: T, x2: 0, y2: T - cut },
      { x1: 0, y1: T - cut, x2: 0, y2: cut },
      { x1: 0, y1: cut, x2: cut, y2: 0 },
    ];
  }

  /**
   * Smallest positive u where origin + u*dir hits a segment, or null.
   * @param {number} ox
   * @param {number} oy
   * @param {number} dx
   * @param {number} dy
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {{ x: number, y: number } | null}
   */
  function intersectRayWithSegments(ox, oy, dx, dy, segments) {
    if (dx === 0 && dy === 0) return null;
    var bestU = Infinity;
    var hitX = 0;
    var hitY = 0;
    var found = false;

    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var sx = seg.x2 - seg.x1;
      var sy = seg.y2 - seg.y1;
      var denom = dx * sy - dy * sx;
      if (Math.abs(denom) < 1e-12) continue;

      var qx = seg.x1 - ox;
      var qy = seg.y1 - oy;
      var u = (qx * sy - qy * sx) / denom;
      var v = (qx * dy - qy * dx) / denom;

      if (u > 1e-9 && v >= -1e-9 && v <= 1 + 1e-9 && u < bestU) {
        bestU = u;
        hitX = ox + u * dx;
        hitY = oy + u * dy;
        found = true;
      }
    }

    return found ? { x: hitX, y: hitY } : null;
  }

  /**
   * @param {number} T
   * @param {number} cut
   * @param {number} innerScale scales diamond + connectors together from cell center
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} octagonEdges
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} out
   * @param {Set<string>} seen
   */
  function addInnerUnitSegments(T, cut, innerScale, octagonEdges, out, seen) {
    var cx = T / 2;
    var cy = T / 2;
    var s = innerScale;

    function scaled(px, py) {
      return scalePoint(cx, cy, px, py, s);
    }

    // Diamond diagonals (scale with inner unit)
    var d1 = scaled(cut, T - cut);
    var d2 = scaled(T - cut, cut);
    var d3 = scaled(T - cut, T - cut);
    var d4 = scaled(cut, cut);
    pushSegment(out, seen, d1.x, d1.y, d2.x, d2.y);
    pushSegment(out, seen, d3.x, d3.y, d4.x, d4.y);

    // Connectors: inner vertex → octagon edge along fixed direction
    var connectors = [
      { inX: cut, inY: cut, outX: 0, outY: cut },
      { inX: cut, inY: cut, outX: cut, outY: 0 },
      { inX: T - cut, inY: cut, outX: T, outY: cut },
      { inX: T - cut, inY: cut, outX: T - cut, outY: 0 },
      { inX: T - cut, inY: T - cut, outX: T, outY: T - cut },
      { inX: T - cut, inY: T - cut, outX: T - cut, outY: T },
      { inX: cut, inY: T - cut, outX: 0, outY: T - cut },
      { inX: cut, inY: T - cut, outX: cut, outY: T },
    ];

    for (var c = 0; c < connectors.length; c++) {
      var conn = connectors[c];
      var start = scaled(conn.inX, conn.inY);
      var dx = conn.outX - conn.inX;
      var dy = conn.outY - conn.inY;
      var hit = intersectRayWithSegments(
        start.x,
        start.y,
        dx,
        dy,
        octagonEdges
      );
      if (hit) {
        pushSegment(out, seen, start.x, start.y, hit.x, hit.y);
      }
    }
  }

  /**
   * All line segments for one unit cell in local coords [0, T] × [0, T].
   * @param {number} T tile size
   * @param {number} [innerScale] 0.3–1.0, scales diamond + connectors from center
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} out
   * @param {Set<string>} seen
   */
  function addUnitCellSegments(T, innerScale, out, seen) {
    if (typeof innerScale !== "number") {
      innerScale = 1;
    }
    var cut = T * CUT;
    var octagonEdges = getOctagonEdges(T, cut);

    // Regular octagon (corner-cut square side T) — fixed
    for (var e = 0; e < octagonEdges.length; e++) {
      var edge = octagonEdges[e];
      pushSegment(out, seen, edge.x1, edge.y1, edge.x2, edge.y2);
    }

    addInnerUnitSegments(T, cut, innerScale, octagonEdges, out, seen);
  }

  /**
   * Build deduplicated pattern segments for the full canvas.
   * @param {number} tileSize
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} [octagonsN] if set, tileSize is derived from n (overrides tileSize arg)
   * @param {number} [innerScale] 0.3–1.0 for inner diamond + connectors
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function buildPatternSegments(
    tileSize,
    canvasW,
    canvasH,
    octagonsN,
    innerScale
  ) {
    if (typeof innerScale !== "number") {
      innerScale = 1;
    }
    var layout;
    if (typeof octagonsN === "number" && octagonsN >= 1) {
      layout = computeLayout(octagonsN, canvasW, canvasH);
    } else {
      var T = Math.max(8, tileSize);
      var cols = Math.ceil(canvasW / T) + 1;
      var rows = Math.ceil(canvasH / T) + 1;
      layout = {
        tileSize: T,
        cols: cols,
        rows: rows,
        offsetY: 0,
      };
    }

    var T = layout.tileSize;
    var out = [];
    var seen = new Set();

    for (var row = 0; row < layout.rows; row++) {
      for (var col = 0; col < layout.cols; col++) {
        var ox = col * T;
        var oy = layout.offsetY + row * T;
        var cellOut = [];
        var cellSeen = new Set();
        addUnitCellSegments(T, innerScale, cellOut, cellSeen);
        for (var i = 0; i < cellOut.length; i++) {
          var s = cellOut[i];
          pushSegment(
            out,
            seen,
            s.x1 + ox,
            s.y1 + oy,
            s.x2 + ox,
            s.y2 + oy
          );
        }
      }
    }

    return out;
  }

  /**
   * Squared distance from point (px, py) to segment (x1,y1)-(x2,y2).
   * @returns {number}
   */
  function distancePointToSegmentSq(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      var ox = px - x1;
      var oy = py - y1;
      return ox * ox + oy * oy;
    }
    var t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    var qx = x1 + t * dx;
    var qy = y1 + t * dy;
    var ex = px - qx;
    var ey = py - qy;
    return ex * ex + ey * ey;
  }

  /**
   * Segment keys for edges within threshold of any point on the polyline.
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @param {{x:number,y:number}[]} pathPoints
   * @param {number} threshold viewBox units
   * @param {Set<string>} [alreadyRemoved]
   * @returns {string[]}
   */
  function findSegmentsNearPolyline(
    segments,
    pathPoints,
    threshold,
    alreadyRemoved
  ) {
    if (!pathPoints.length) return [];
    var threshSq = threshold * threshold;
    var removed = alreadyRemoved || new Set();
    var hits = [];
    var hitSet = new Set();

    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var key = segmentKey(seg.x1, seg.y1, seg.x2, seg.y2);
      if (removed.has(key) || hitSet.has(key)) continue;

      for (var p = 0; p < pathPoints.length; p++) {
        var pt = pathPoints[p];
        if (
          distancePointToSegmentSq(
            pt.x,
            pt.y,
            seg.x1,
            seg.y1,
            seg.x2,
            seg.y2
          ) <= threshSq
        ) {
          hitSet.add(key);
          hits.push(key);
          break;
        }
      }
    }

    return hits;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {string}
   */
  function vertexKey(x, y) {
    return roundCoord(x) + "," + roundCoord(y);
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {Object<string, string[]>}
   */
  function buildVertexIncidence(segments) {
    var incidence = {};
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var sk = segmentKey(s.x1, s.y1, s.x2, s.y2);
      var v1 = vertexKey(s.x1, s.y1);
      var v2 = vertexKey(s.x2, s.y2);
      if (!incidence[v1]) incidence[v1] = [];
      if (!incidence[v2]) incidence[v2] = [];
      incidence[v1].push(sk);
      incidence[v2].push(sk);
    }
    return incidence;
  }

  /**
   * Segment keys where at least one endpoint is incident to only that segment.
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {string[]}
   */
  function findDanglingSegmentKeys(segments) {
    var incidence = buildVertexIncidence(segments);
    var dangling = [];
    var seen = new Set();

    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var sk = segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (seen.has(sk)) continue;
      seen.add(sk);

      var v1 = vertexKey(s.x1, s.y1);
      var v2 = vertexKey(s.x2, s.y2);
      var c1 = incidence[v1] ? incidence[v1].length : 0;
      var c2 = incidence[v2] ? incidence[v2].length : 0;
      if (c1 === 1 || c2 === 1) dangling.push(sk);
    }

    return dangling;
  }

  /**
   * Recursively find dangling edges to remove after user deletions.
   * Does not mutate removedSet.
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {Set<string>} removedSet
   * @returns {string[]} keys in removal order (each prune wave)
   */
  function findDanglingPruneKeys(allSegments, removedSet) {
    var ordered = [];
    var removed = new Set(removedSet);

    while (true) {
      var visible = [];
      for (var i = 0; i < allSegments.length; i++) {
        var s = allSegments[i];
        var k = segmentKey(s.x1, s.y1, s.x2, s.y2);
        if (!removed.has(k)) visible.push(s);
      }

      var dangling = findDanglingSegmentKeys(visible);
      if (!dangling.length) break;

      var wave = false;
      for (var j = 0; j < dangling.length; j++) {
        var dk = dangling[j];
        if (!removed.has(dk)) {
          removed.add(dk);
          ordered.push(dk);
          wave = true;
        }
      }
      if (!wave) break;
    }

    return ordered;
  }

  /**
   * True if at least one endpoint shares a vertex with another visible segment.
   * @param {{x1:number,y1:number,x2:number,y2:number}} seg
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} visibleSegments
   * @returns {boolean}
   */
  function segmentTouchesVisibleGrid(seg, visibleSegments) {
    if (!visibleSegments.length) return false;
    var incidence = buildVertexIncidence(visibleSegments);
    var v1 = vertexKey(seg.x1, seg.y1);
    var v2 = vertexKey(seg.x2, seg.y2);
    var c1 = incidence[v1] ? incidence[v1].length : 0;
    var c2 = incidence[v2] ? incidence[v2].length : 0;
    return c1 > 0 || c2 > 0;
  }

  /**
   * Restore keys that connect to existing grid and won't be dangling after batch restore.
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {Set<string>} removedSet
   * @param {string[]} keysToRestore
   * @returns {string[]}
   */
  function filterValidRestoreKeys(allSegments, removedSet, keysToRestore) {
    if (!keysToRestore.length) return [];

    var visibleNow = [];
    for (var i = 0; i < allSegments.length; i++) {
      var s = allSegments[i];
      var k = segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!removedSet.has(k)) visibleNow.push(s);
    }

    if (!visibleNow.length) return [];

    var restored = new Set(removedSet);
    for (var r = 0; r < keysToRestore.length; r++) {
      restored.delete(keysToRestore[r]);
    }

    var visibleAfter = [];
    for (var j = 0; j < allSegments.length; j++) {
      var s2 = allSegments[j];
      var k2 = segmentKey(s2.x1, s2.y1, s2.x2, s2.y2);
      if (!restored.has(k2)) visibleAfter.push(s2);
    }

    var danglingSet = new Set(findDanglingSegmentKeys(visibleAfter));
    var valid = [];

    for (var m = 0; m < keysToRestore.length; m++) {
      var key = keysToRestore[m];
      if (!removedSet.has(key) || danglingSet.has(key)) continue;

      for (var n = 0; n < allSegments.length; n++) {
        var seg = allSegments[n];
        if (segmentKey(seg.x1, seg.y1, seg.x2, seg.y2) !== key) continue;
        if (segmentTouchesVisibleGrid(seg, visibleNow)) valid.push(key);
        break;
      }
    }

    return valid;
  }

  global.TopkapiGeometry = {
    buildPatternSegments: buildPatternSegments,
    addUnitCellSegments: addUnitCellSegments,
    computeLayout: computeLayout,
    tileSizeFromN: tileSizeFromN,
    segmentKey: segmentKey,
    vertexKey: vertexKey,
    distancePointToSegmentSq: distancePointToSegmentSq,
    findSegmentsNearPolyline: findSegmentsNearPolyline,
    findDanglingSegmentKeys: findDanglingSegmentKeys,
    findDanglingPruneKeys: findDanglingPruneKeys,
    filterValidRestoreKeys: filterValidRestoreKeys,
  };
})(typeof window !== "undefined" ? window : this);

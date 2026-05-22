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
   * Visible grid extent in content coordinates (matches tessellation clip).
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
   * Densify drag path so fast strokes still hit edges between mouse samples.
   * @param {{x:number,y:number}[]} pathPoints
   * @param {number} spacing viewBox units between samples
   * @returns {{x:number,y:number}[]}
   */
  function densifyPolyline(pathPoints, spacing) {
    if (!pathPoints.length) return [];
    if (pathPoints.length === 1) return [pathPoints[0]];
    var out = [pathPoints[0]];
    for (var i = 1; i < pathPoints.length; i++) {
      var a = pathPoints[i - 1];
      var b = pathPoints[i];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len <= spacing) {
        out.push(b);
        continue;
      }
      var steps = Math.ceil(len / spacing);
      for (var s = 1; s <= steps; s++) {
        var t = s / steps;
        out.push({ x: a.x + dx * t, y: a.y + dy * t });
      }
    }
    return out;
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
    var sampled = densifyPolyline(pathPoints, Math.max(threshold * 0.5, 1));
    var threshSq = threshold * threshold;
    var removed = alreadyRemoved || new Set();
    var hits = [];
    var hitSet = new Set();

    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var key = segmentKey(seg.x1, seg.y1, seg.x2, seg.y2);
      if (removed.has(key) || hitSet.has(key)) continue;

      for (var p = 0; p < sampled.length; p++) {
        var pt = sampled[p];
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
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {Set<string>} removedSet
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function getVisibleSegmentsFromRemoved(allSegments, removedSet) {
    var visible = [];
    for (var i = 0; i < allSegments.length; i++) {
      var s = allSegments[i];
      var k = segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!removedSet.has(k)) visible.push(s);
    }
    return visible;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {string} key
   * @returns {{x1:number,y1:number,x2:number,y2:number} | null}
   */
  function segmentForKey(allSegments, key) {
    for (var i = 0; i < allSegments.length; i++) {
      var s = allSegments[i];
      if (segmentKey(s.x1, s.y1, s.x2, s.y2) === key) return s;
    }
    return null;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {string[]} keys
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function segmentsForKeys(allSegments, keys) {
    var segs = [];
    for (var i = 0; i < keys.length; i++) {
      var seg = segmentForKey(allSegments, keys[i]);
      if (seg) segs.push(seg);
    }
    return segs;
  }

  /**
   * Keys of removed segments near the drag path, plus removed segments sharing
   * a vertex with visible segments the path touches (easier brush UX).
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} visibleSegments
   * @param {Set<string>} removedSet
   * @param {{x:number,y:number}[]} pathPoints
   * @param {number} threshold
   * @returns {string[]}
   */
  function findRestoreCandidateKeys(
    allSegments,
    visibleSegments,
    removedSet,
    pathPoints,
    threshold
  ) {
    if (!pathPoints.length || !removedSet.size) return [];

    var removedSegs = [];
    for (var i = 0; i < allSegments.length; i++) {
      var s = allSegments[i];
      var k = segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (removedSet.has(k)) removedSegs.push(s);
    }
    if (!removedSegs.length) return [];

    var hitSet = new Set();
    var direct = findSegmentsNearPolyline(
      removedSegs,
      pathPoints,
      threshold,
      null
    );
    for (var d = 0; d < direct.length; d++) hitSet.add(direct[d]);

    if (visibleSegments.length) {
      var visHits = findSegmentsNearPolyline(
        visibleSegments,
        pathPoints,
        threshold,
        null
      );
      if (visHits.length) {
        var anchorVerts = new Set();
        for (var v = 0; v < visHits.length; v++) {
          var visSeg = segmentForKey(allSegments, visHits[v]);
          if (!visSeg) continue;
          anchorVerts.add(vertexKey(visSeg.x1, visSeg.y1));
          anchorVerts.add(vertexKey(visSeg.x2, visSeg.y2));
        }
        for (var r = 0; r < removedSegs.length; r++) {
          var rs = removedSegs[r];
          var rk = segmentKey(rs.x1, rs.y1, rs.x2, rs.y2);
          if (hitSet.has(rk)) continue;
          var rv1 = vertexKey(rs.x1, rs.y1);
          var rv2 = vertexKey(rs.x2, rs.y2);
          if (anchorVerts.has(rv1) || anchorVerts.has(rv2)) hitSet.add(rk);
        }
      }
    }

    var hits = [];
    hitSet.forEach(function (key) {
      hits.push(key);
    });
    return hits;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {string[]} allowedKeys
   * @param {string[]} seedKeys
   * @returns {Set<string>}
   */
  function expandKeysBySharedVertices(allSegments, allowedKeys, seedKeys) {
    var pool = new Set();
    for (var i = 0; i < seedKeys.length; i++) pool.add(seedKeys[i]);
    var changed = true;
    while (changed) {
      changed = false;
      var verts = new Set();
      pool.forEach(function (k) {
        var seg = segmentForKey(allSegments, k);
        if (seg) {
          verts.add(vertexKey(seg.x1, seg.y1));
          verts.add(vertexKey(seg.x2, seg.y2));
        }
      });
      for (var a = 0; a < allowedKeys.length; a++) {
        var key = allowedKeys[a];
        if (pool.has(key)) continue;
        var seg = segmentForKey(allSegments, key);
        if (!seg) continue;
        if (
          verts.has(vertexKey(seg.x1, seg.y1)) ||
          verts.has(vertexKey(seg.x2, seg.y2))
        ) {
          pool.add(key);
          changed = true;
        }
      }
    }
    return pool;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {Set<string>} keySet
   * @returns {string[][]}
   */
  function partitionKeysByConnectivity(allSegments, keySet) {
    var keys = [];
    keySet.forEach(function (k) {
      keys.push(k);
    });
    if (!keys.length) return [];

    var verticesToKeys = {};
    for (var i = 0; i < keys.length; i++) {
      var seg = segmentForKey(allSegments, keys[i]);
      if (!seg) continue;
      var v1 = vertexKey(seg.x1, seg.y1);
      var v2 = vertexKey(seg.x2, seg.y2);
      if (!verticesToKeys[v1]) verticesToKeys[v1] = [];
      if (!verticesToKeys[v2]) verticesToKeys[v2] = [];
      verticesToKeys[v1].push(keys[i]);
      verticesToKeys[v2].push(keys[i]);
    }

    var visited = new Set();
    var components = [];

    for (var start = 0; start < keys.length; start++) {
      var startKey = keys[start];
      if (visited.has(startKey)) continue;
      var stack = [startKey];
      var component = [];
      visited.add(startKey);
      while (stack.length) {
        var key = stack.pop();
        component.push(key);
        var seg = segmentForKey(allSegments, key);
        if (!seg) continue;
        var verts = [vertexKey(seg.x1, seg.y1), vertexKey(seg.x2, seg.y2)];
        for (var vi = 0; vi < verts.length; vi++) {
          var adj = verticesToKeys[verts[vi]] || [];
          for (var ai = 0; ai < adj.length; ai++) {
            var nk = adj[ai];
            if (!visited.has(nk)) {
              visited.add(nk);
              stack.push(nk);
            }
          }
        }
      }
      components.push(component);
    }

    return components;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {string[]} componentKeys
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} visibleSegments
   * @returns {boolean}
   */
  function componentRestoreIsValid(allSegments, componentKeys, visibleSegments) {
    var testSegs = visibleSegments.concat(
      segmentsForKeys(allSegments, componentKeys)
    );
    var dangling = findDanglingSegmentKeys(testSegs);
    var compSet = new Set(componentKeys);
    for (var j = 0; j < dangling.length; j++) {
      if (compSet.has(dangling[j])) return false;
    }
    return true;
  }

  /**
   * Largest non-dangling subset (order-independent multi-pass).
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {string[]} componentKeys
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} visibleSegments
   * @returns {string[]}
   */
  function maximalValidRestoreSubset(
    allSegments,
    componentKeys,
    visibleSegments
  ) {
    var accepted = [];
    var changed = true;
    var guard = 0;
    while (changed && guard < componentKeys.length + 2) {
      guard += 1;
      changed = false;
      for (var i = 0; i < componentKeys.length; i++) {
        var k = componentKeys[i];
        if (accepted.indexOf(k) >= 0) continue;
        var trial = accepted.concat([k]);
        if (componentRestoreIsValid(allSegments, trial, visibleSegments)) {
          accepted = trial;
          changed = true;
        }
      }
    }
    return accepted;
  }

  /**
   * Restore a component in waves from the visible grid inward (simulated).
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {string[]} componentKeys
   * @param {Set<string>} removedSet
   * @returns {string[]}
   */
  function restoreWavesInComponent(allSegments, componentKeys, removedSet) {
    var simRemoved = new Set(removedSet);
    var accepted = [];
    var remaining = componentKeys.slice();
    var guard = 0;

    while (remaining.length && guard < componentKeys.length + 2) {
      guard += 1;
      var visibleBase = getVisibleSegmentsFromRemoved(allSegments, simRemoved);
      var waveSeeds = [];
      for (var i = 0; i < remaining.length; i++) {
        var seg = segmentForKey(allSegments, remaining[i]);
        if (seg && segmentTouchesVisibleGrid(seg, visibleBase)) {
          waveSeeds.push(remaining[i]);
        }
      }
      if (!waveSeeds.length) break;

      var wavePool = expandKeysBySharedVertices(
        allSegments,
        remaining,
        waveSeeds
      );
      var waveList = [];
      wavePool.forEach(function (k) {
        waveList.push(k);
      });
      var wave = maximalValidRestoreSubset(allSegments, waveList, visibleBase);
      if (!wave.length) break;

      for (var w = 0; w < wave.length; w++) {
        simRemoved.delete(wave[w]);
        accepted.push(wave[w]);
      }

      var nextRemaining = [];
      for (var r = 0; r < remaining.length; r++) {
        if (simRemoved.has(remaining[r])) nextRemaining.push(remaining[r]);
      }
      remaining = nextRemaining;
    }

    return accepted;
  }

  /**
   * Restore connected groups from the visible grid inward. Validates each
   * connected component as a whole (segments may need each other to avoid
   * dangling ends).
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {Set<string>} removedSet
   * @param {string[]} keysToRestore
   * @returns {string[]}
   */
  function filterValidRestoreKeys(allSegments, removedSet, keysToRestore) {
    if (!keysToRestore.length) return [];

    var visibleNow = getVisibleSegmentsFromRemoved(allSegments, removedSet);
    if (!visibleNow.length) return [];

    var allowed = [];
    var allowedSeen = new Set();
    for (var m = 0; m < keysToRestore.length; m++) {
      var key = keysToRestore[m];
      if (!removedSet.has(key) || allowedSeen.has(key)) continue;
      allowed.push(key);
      allowedSeen.add(key);
    }
    if (!allowed.length) return [];

    var seeds = [];
    for (var s = 0; s < allowed.length; s++) {
      var sk = allowed[s];
      var seedSeg = segmentForKey(allSegments, sk);
      if (seedSeg && segmentTouchesVisibleGrid(seedSeg, visibleNow)) {
        seeds.push(sk);
      }
    }
    if (!seeds.length) return [];

    var expanded = expandKeysBySharedVertices(allSegments, allowed, seeds);
    var components = partitionKeysByConnectivity(allSegments, expanded);

    var valid = [];
    var validSeen = new Set();
    for (var c = 0; c < components.length; c++) {
      var comp = components[c];
      var touchesVisible = false;
      for (var t = 0; t < comp.length; t++) {
        var compSeg = segmentForKey(allSegments, comp[t]);
        if (compSeg && segmentTouchesVisibleGrid(compSeg, visibleNow)) {
          touchesVisible = true;
          break;
        }
      }
      if (!touchesVisible) continue;

      var toAdd = comp;
      if (!componentRestoreIsValid(allSegments, comp, visibleNow)) {
        toAdd = restoreWavesInComponent(allSegments, comp, removedSet);
        if (!toAdd.length) continue;
      }

      for (var v = 0; v < toAdd.length; v++) {
        var ck = toAdd[v];
        if (!validSeen.has(ck)) {
          validSeen.add(ck);
          valid.push(ck);
        }
      }
    }

    return valid;
  }

  /**
   * Inscribed circle radius for the inner diamond inside an upright square at a
   * cell junction (diamond corners on midpoints of the square; side = cut·√2).
   * @param {number} T tile size
   * @returns {number}
   */
  function uprightSquareInscribedRadius(T) {
    var cut = T * CUT;
    return (cut * Math.SQRT2) / 2;
  }

  /**
   * Rotated square inside each upright square at a junction (corners N/S/E/W on
   * the upright square’s side midpoints — not the axis-aligned square itself).
   * @param {number} octagonsN
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} innerScale shrinks diamond from junction center (matches grid)
   * @returns {{ id: string, points: { x: number, y: number }[] }[]}
   */
  function buildDiamondCatalog(octagonsN, canvasW, canvasH, innerScale) {
    if (typeof innerScale !== "number") {
      innerScale = 1;
    }
    var layout = computeLayout(octagonsN, canvasW, canvasH);
    var T = layout.tileSize;
    var cut = T * CUT;
    var h = cut * innerScale;
    var catalog = [];

    for (var row = 0; row <= layout.rows; row++) {
      for (var col = 0; col <= layout.cols; col++) {
        var cx = col * T;
        var cy = layout.offsetY + row * T;
        catalog.push({
          id: "dm-" + col + "-" + row,
          points: [
            { x: cx, y: cy - h },
            { x: cx + h, y: cy },
            { x: cx, y: cy + h },
            { x: cx - h, y: cy },
          ],
        });
      }
    }

    return catalog;
  }

  /**
   * Inner diamonds at cell junctions (upright square midpoints between octagons).
   * @param {number} octagonsN
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ id: string, cx: number, cy: number, r: number }[]}
   */
  function buildUprightSquareCatalog(octagonsN, canvasW, canvasH) {
    var layout = computeLayout(octagonsN, canvasW, canvasH);
    var T = layout.tileSize;
    var r = uprightSquareInscribedRadius(T);
    var catalog = [];

    for (var row = 0; row <= layout.rows; row++) {
      for (var col = 0; col <= layout.cols; col++) {
        catalog.push({
          id: "sq-" + col + "-" + row,
          cx: col * T,
          cy: layout.offsetY + row * T,
          r: r,
        });
      }
    }

    return catalog;
  }

  /**
   * Largest circle that fits inside the unit-cell octagon (local center T/2, T/2).
   * @param {number} T tile size
   * @returns {number}
   */
  function octagonInscribedRadius(T) {
    var cut = T * CUT;
    var edges = getOctagonEdges(T, cut);
    var px = T / 2;
    var py = T / 2;
    var minDistSq = Infinity;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var dSq = distancePointToSegmentSq(px, py, e.x1, e.y1, e.x2, e.y2);
      if (dSq < minDistSq) minDistSq = dSq;
    }
    return Math.sqrt(minDistSq);
  }

  /**
   * Center of each unit-cell octagon on the canvas.
   * @param {number} octagonsN
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{ id: string, cx: number, cy: number }[]}
   */
  function buildOctagonCenterCatalog(octagonsN, canvasW, canvasH) {
    var layout = computeLayout(octagonsN, canvasW, canvasH);
    var T = layout.tileSize;
    var half = T / 2;
    var catalog = [];

    for (var row = 0; row < layout.rows; row++) {
      for (var col = 0; col < layout.cols; col++) {
        catalog.push({
          id: "oc-" + col + "-" + row,
          cx: col * T + half,
          cy: layout.offsetY + row * T + half,
        });
      }
    }

    return catalog;
  }

  /**
   * @param {number} T tile size
   * @returns {number}
   */
  function letterMarkerRadius(T) {
    var radiusRatio =
      typeof LETTER_MARKER_RADIUS_RATIO !== "undefined"
        ? LETTER_MARKER_RADIUS_RATIO
        : 0.75;
    return octagonInscribedRadius(T) * radiusRatio;
  }

  /**
   * @param {string[]} words
   * @returns {number[]}
   */
  function letterMarkerWordLengths(words) {
    var lengths = [];
    for (var i = 0; i < words.length; i++) {
      lengths.push(Array.from(words[i]).length);
    }
    return lengths;
  }

  /**
   * Row span when each word starts at the previous word's last circle.
   * @param {number[]} lengths
   * @returns {number}
   */
  function letterMarkerCascadeRowSpan(lengths) {
    var sum = 0;
    var i;
    for (i = 0; i < lengths.length; i++) {
      sum += lengths[i];
    }
    return sum - lengths.length;
  }

  /**
   * @param {{ rows: number, cols: number }} layout
   * @param {{ col: number, startRow: number }} anchor
   * @param {number[]} lengths per word (index 0 = rightmost column)
   * @returns {boolean}
   */
  function isLetterMarkerAnchorValid(layout, anchor, lengths) {
    if (!anchor || !lengths.length) return false;
    var maxColumns =
      typeof LETTER_MARKER_MAX_COLUMNS !== "undefined"
        ? LETTER_MARKER_MAX_COLUMNS
        : 12;
    if (lengths.length > maxColumns) return false;
    if (anchor.col < lengths.length - 1) return false;

    var rowSpan = letterMarkerCascadeRowSpan(lengths);
    if (anchor.startRow < 0) return false;
    if (anchor.startRow + rowSpan >= layout.rows) return false;

    return true;
  }

  /**
   * @param {{ rows: number, cols: number }} layout
   * @param {number[]} lengths
   * @returns {{ col: number, startRow: number }[]}
   */
  function findValidLetterMarkerAnchors(layout, lengths) {
    if (!lengths.length) return [];

    var maxColumns =
      typeof LETTER_MARKER_MAX_COLUMNS !== "undefined"
        ? LETTER_MARKER_MAX_COLUMNS
        : 12;
    if (lengths.length > maxColumns) return [];

    var nCols = lengths.length;
    var rowSpan = letterMarkerCascadeRowSpan(lengths);
    var maxStartRow = layout.rows - 1 - rowSpan;
    if (maxStartRow < 0) return [];

    var candidates = [];
    var col;
    var startRow;

    for (col = nCols - 1; col < layout.cols; col++) {
      for (startRow = 0; startRow <= maxStartRow; startRow++) {
        candidates.push({ col: col, startRow: startRow });
      }
    }

    return candidates;
  }

  /**
   * @param {{ rows: number, cols: number }} layout
   * @param {number[]} lengths
   * @returns {{ col: number, startRow: number } | null}
   */
  function pickRandomLetterMarkerAnchor(layout, lengths) {
    var candidates = findValidLetterMarkerAnchors(layout, lengths);
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * One column per word; words[0] is rightmost. Each word starts at the last
   * circle row of the previous word (cascade down and left).
   * @param {{ tileSize: number, offsetY: number, rows: number }} layout
   * @param {{ col: number, startRow: number }} anchor
   * @param {string[]} words
   * @returns {{ columns: { markers: { cx: number, cy: number, r: number, char: string }[] }[] }}
   */
  function buildLetterMarkerColumns(layout, anchor, words) {
    var lengths = letterMarkerWordLengths(words);
    if (!lengths.length || !anchor) {
      return { columns: [] };
    }

    var T = layout.tileSize;
    var half = T / 2;
    var letterR = letterMarkerRadius(T);
    var rowCursor = anchor.startRow;
    var columns = [];
    var i;
    var j;

    for (i = 0; i < words.length; i++) {
      var colIndex = anchor.col - i;
      var len = lengths[i];
      var chars = Array.from(words[i]);
      var markers = [];

      for (j = 0; j < len; j++) {
        markers.push({
          cx: colIndex * T + half,
          cy: layout.offsetY + (rowCursor + j) * T + half,
          r: letterR,
          char: chars[j],
        });
      }
      columns.push({ markers: markers });
      rowCursor += len - 1;
    }

    return { columns: columns };
  }

  var VERTICAL_SEGMENT_X_EPS = 1e-6;
  var FACE_MIN_AREA = 0.5;
  var FACE_MAX_AREA_RATIO = 0.5;

  /**
   * @param {{x:number,y:number}[]} points
   * @returns {number}
   */
  function polygonSignedArea(points) {
    var area = 0;
    var n = points.length;
    if (n < 3) return 0;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return area / 2;
  }

  /**
   * @param {{x:number,y:number}[]} points
   * @returns {number}
   */
  function polygonArea(points) {
    return Math.abs(polygonSignedArea(points));
  }

  /**
   * @param {{x:number,y:number}[]} points
   * @returns {{ x: number, y: number }}
   */
  function polygonCentroid(points) {
    var cx = 0;
    var cy = 0;
    for (var i = 0; i < points.length; i++) {
      cx += points[i].x;
      cy += points[i].y;
    }
    var n = points.length || 1;
    return { x: cx / n, y: cy / n };
  }

  /**
   * @param {number} px
   * @param {number} py
   * @param {{x:number,y:number}[]} points
   * @returns {boolean}
   */
  function pointInPolygon(px, py, points) {
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i].x;
      var yi = points[i].y;
      var xj = points[j].x;
      var yj = points[j].y;
      var intersect =
        yi > py !== yj > py &&
        px <
          ((xj - xi) * (py - yi)) / (yj - yi + 1e-20) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  function segmentsBoundingBox(segments) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      minX = Math.min(minX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2);
      maxX = Math.max(maxX, s.x1, s.x2);
      maxY = Math.max(maxY, s.y1, s.y2);
    }
    if (!segments.length) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * @param {{ from: { key: string, x: number, y: number }, to: { key: string, x: number, y: number } }} he
   * @returns {number}
   */
  function halfEdgeAngle(he) {
    return Math.atan2(he.to.y - he.from.y, he.to.x - he.from.x);
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {{ id: number, from: object, to: object, twin: object, next: object }[]}
   */
  function buildHalfEdges(segments) {
    var verts = {};
    var edges = [];

    function getVert(x, y) {
      var k = vertexKey(x, y);
      if (!verts[k]) {
        verts[k] = { key: k, x: roundCoord(x), y: roundCoord(y) };
      }
      return verts[k];
    }

    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var a = getVert(s.x1, s.y1);
      var b = getVert(s.x2, s.y2);
      var fwd = {
        id: edges.length,
        from: a,
        to: b,
        twin: null,
        next: null,
        indexAtVertex: -1,
      };
      var rev = {
        id: edges.length + 1,
        from: b,
        to: a,
        twin: fwd,
        next: null,
        indexAtVertex: -1,
      };
      fwd.twin = rev;
      edges.push(fwd, rev);
    }

    var outgoing = {};
    for (var j = 0; j < edges.length; j++) {
      var e = edges[j];
      var fk = e.from.key;
      if (!outgoing[fk]) outgoing[fk] = [];
      outgoing[fk].push(e);
    }

    for (var vk in outgoing) {
      if (!Object.prototype.hasOwnProperty.call(outgoing, vk)) continue;
      var list = outgoing[vk];
      list.sort(function (e1, e2) {
        return halfEdgeAngle(e1) - halfEdgeAngle(e2);
      });
      for (var li = 0; li < list.length; li++) {
        list[li].indexAtVertex = li;
      }
    }

    for (var k = 0; k < edges.length; k++) {
      var he = edges[k];
      var headList = outgoing[he.to.key];
      if (!headList || headList.length === 0) continue;
      var twinIdx = he.twin.indexAtVertex;
      if (twinIdx < 0) continue;
      var nextIdx = (twinIdx - 1 + headList.length) % headList.length;
      he.next = headList[nextIdx];
    }

    return edges;
  }

  /**
   * Enclosed faces from a segment arrangement (planar graph).
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function traceFaces(segments) {
    if (!segments.length) return [];

    var halfEdges = buildHalfEdges(segments);
    var used = new Set();
    var faces = [];
    var bbox = segmentsBoundingBox(segments);
    var maxArea = bbox.width * bbox.height * FACE_MAX_AREA_RATIO;

    for (var i = 0; i < halfEdges.length; i++) {
      var start = halfEdges[i];
      if (used.has(start.id)) continue;

      var loop = [];
      var cur = start;
      var guard = 0;

      do {
        used.add(cur.id);
        loop.push({ x: cur.from.x, y: cur.from.y });
        cur = cur.next;
        guard++;
        if (!cur || guard > halfEdges.length + 2) break;
      } while (cur !== start);

      if (loop.length < 3) continue;

      var area = polygonArea(loop);
      if (area < FACE_MIN_AREA) continue;
      if (maxArea > 0 && area >= maxArea) continue;

      var c = polygonCentroid(loop);
      if (
        c.x < bbox.x - 1e-6 ||
        c.y < bbox.y - 1e-6 ||
        c.x > bbox.x + bbox.width + 1e-6 ||
        c.y > bbox.y + bbox.height + 1e-6
      ) {
        continue;
      }

      faces.push({ points: loop });
    }

    return faces;
  }

  /**
   * Baseline cell count enclosed by a current face (merged if &gt; 1).
   * @param {{ points: { x: number, y: number }[] }} face
   * @param {{ points: { x: number, y: number }[] }[]} baselineFaces
   * @returns {number}
   */
  function countBaselineFacesInsideCurrentFace(face, baselineFaces) {
    var count = 0;
    for (var i = 0; i < baselineFaces.length; i++) {
      var c = polygonCentroid(baselineFaces[i].points);
      if (pointInPolygon(c.x, c.y, face.points)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Merged polygon regions (holes in the white mask) from removed edges.
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} allSegments
   * @param {Set<string>} removedSet
   * @returns {{ points: { x: number, y: number }[] }[]}
   */
  function getMergedPolygonRegions(allSegments, removedSet) {
    if (!removedSet || !removedSet.size) return [];

    var baselineFaces = traceFaces(allSegments);
    var visible = getVisibleSegmentsFromRemoved(allSegments, removedSet);
    var currentFaces = traceFaces(visible);
    var merged = [];

    for (var i = 0; i < currentFaces.length; i++) {
      var face = currentFaces[i];
      if (countBaselineFacesInsideCurrentFace(face, baselineFaces) > 1) {
        merged.push(face);
      }
    }

    return merged;
  }

  /**
   * Unique X from vertical grid segments only (aligned with existing upright edges).
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {number[]}
   */
  function collectUniqueGridXCoords(segments) {
    var xs = {};
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      if (Math.abs(s.x1 - s.x2) > VERTICAL_SEGMENT_X_EPS) continue;
      var key = roundCoord(s.x1);
      if (!xs[key]) xs[key] = s.x1;
    }
    var out = [];
    for (var k in xs) {
      if (Object.prototype.hasOwnProperty.call(xs, k)) out.push(xs[k]);
    }
    out.sort(function (a, b) {
      return a - b;
    });
    return out;
  }

  global.TopkapiGeometry = {
    buildPatternSegments: buildPatternSegments,
    addUnitCellSegments: addUnitCellSegments,
    computeLayout: computeLayout,
    getGridContentBounds: getGridContentBounds,
    tileSizeFromN: tileSizeFromN,
    segmentKey: segmentKey,
    vertexKey: vertexKey,
    distancePointToSegmentSq: distancePointToSegmentSq,
    findSegmentsNearPolyline: findSegmentsNearPolyline,
    findDanglingSegmentKeys: findDanglingSegmentKeys,
    findDanglingPruneKeys: findDanglingPruneKeys,
    findRestoreCandidateKeys: findRestoreCandidateKeys,
    filterValidRestoreKeys: filterValidRestoreKeys,
    buildVertexIncidence: buildVertexIncidence,
    buildDiamondCatalog: buildDiamondCatalog,
    buildUprightSquareCatalog: buildUprightSquareCatalog,
    buildOctagonCenterCatalog: buildOctagonCenterCatalog,
    octagonInscribedRadius: octagonInscribedRadius,
    letterMarkerWordLengths: letterMarkerWordLengths,
    isLetterMarkerAnchorValid: isLetterMarkerAnchorValid,
    findValidLetterMarkerAnchors: findValidLetterMarkerAnchors,
    pickRandomLetterMarkerAnchor: pickRandomLetterMarkerAnchor,
    buildLetterMarkerColumns: buildLetterMarkerColumns,
    uprightSquareInscribedRadius: uprightSquareInscribedRadius,
    collectUniqueGridXCoords: collectUniqueGridXCoords,
    traceFaces: traceFaces,
    getMergedPolygonRegions: getMergedPolygonRegions,
  };
})(typeof window !== "undefined" ? window : this);

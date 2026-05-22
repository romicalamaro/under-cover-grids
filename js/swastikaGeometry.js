/**
 * Rotated-square swastika repeat unit: quadrant axes, pinwheel squares, 4×4 grids, tiled.
 * Per quadrant: TL/BR +36° CW, TR/BL −36° CCW; whole unit rotated 90° CW on the canvas.
 */
(function (global) {
  var PINWHEEL_SQUARE_ROTATION_DEG = 36;

  function roundCoord(v) {
    return Math.round(v * 10000) / 10000;
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  /**
   * Rotate a point in unit-local coords 90° clockwise around the unit center.
   * @param {number} lx
   * @param {number} ly
   * @param {number} u
   * @returns {{x:number,y:number}}
   */
  function rotateUnitLocal90CW(lx, ly, u) {
    var cx = u * 0.5;
    var cy = u * 0.5;
    return {
      x: roundCoord(cx - (ly - cy)),
      y: roundCoord(cy + (lx - cx)),
    };
  }

  /**
   * Map unit-local point to canvas space (whole unit rotated 90° CW, then tiled).
   * @param {number} ox
   * @param {number} oy
   * @param {number} u
   * @param {number} lx
   * @param {number} ly
   * @returns {{x:number,y:number}}
   */
  function unitLocalToWorld(ox, oy, u, lx, ly) {
    var r = rotateUnitLocal90CW(lx, ly, u);
    return { x: roundCoord(ox + r.x), y: roundCoord(oy + r.y) };
  }

  /**
   * @param {Map<string,{x1:number,y1:number,x2:number,y2:number}>} map
   * @param {number} ox
   * @param {number} oy
   * @param {number} u
   * @param {number} lx1
   * @param {number} ly1
   * @param {number} lx2
   * @param {number} ly2
   */
  function addUnitSegment(map, ox, oy, u, lx1, ly1, lx2, ly2) {
    var a = unitLocalToWorld(ox, oy, u, lx1, ly1);
    var b = unitLocalToWorld(ox, oy, u, lx2, ly2);
    addSegment(map, a.x, a.y, b.x, b.y);
  }

  /**
   * True if a unit-local segment lies entirely on the repeat unit outer edge (tile frame).
   * @param {number} lx1
   * @param {number} ly1
   * @param {number} lx2
   * @param {number} ly2
   * @param {number} u
   * @returns {boolean}
   */
  function isOuterBoundarySegment(lx1, ly1, lx2, ly2, u) {
    var e = Math.max(1e-6, u * 1e-9);
    if (Math.abs(ly1) < e && Math.abs(ly2) < e) return true;
    if (Math.abs(ly1 - u) < e && Math.abs(ly2 - u) < e) return true;
    if (Math.abs(lx1) < e && Math.abs(lx2) < e) return true;
    if (Math.abs(lx1 - u) < e && Math.abs(lx2 - u) < e) return true;
    return false;
  }

  /**
   * @param {Map<string,{x1:number,y1:number,x2:number,y2:number}>} map
   * @param {number} ox
   * @param {number} oy
   * @param {number} u
   * @param {number} lx1
   * @param {number} ly1
   * @param {number} lx2
   * @param {number} ly2
   */
  function addUnitSegmentUnlessBoundary(map, ox, oy, u, lx1, ly1, lx2, ly2) {
    if (isOuterBoundarySegment(lx1, ly1, lx2, ly2, u)) return;
    addUnitSegment(map, ox, oy, u, lx1, ly1, lx2, ly2);
  }

  /**
   * Axis-aligned center cross for the repeat unit (full width + height, tiles seamlessly).
   * @param {Map<string,{x1:number,y1:number,x2:number,y2:number}>} map
   * @param {number} ox
   * @param {number} oy
   * @param {number} u
   */
  function addRepeatUnitCenterAxes(map, ox, oy, u) {
    var midX = roundCoord(ox + u / 2);
    var midY = roundCoord(oy + u / 2);
    addSegment(map, midX, oy, midX, roundCoord(oy + u));
    addSegment(map, ox, midY, roundCoord(ox + u), midY);
  }

  /**
   * TL square (+36° CW) in unit coords; centroid at quadrant center (u/4, u/4).
   * @param {number} u
   * @returns {[{x:number,y:number},{x:number,y:number},{x:number,y:number},{x:number,y:number}]}
   */
  function getBaseTLSquareVertices(u) {
    var tanT = Math.tan(degToRad(PINWHEEL_SQUARE_ROTATION_DEG));
    var t0 = (0.5 * tanT) / (1 + tanT);
    return [
      { x: t0 * u, y: 0 },
      { x: 0.5 * u, y: t0 * u },
      { x: (0.5 - t0) * u, y: 0.5 * u },
      { x: 0, y: (0.5 - t0) * u },
    ];
  }

  /** @param {{x:number,y:number}} p @param {number} u */
  function mirrorXPoint(p, u) {
    return { x: u - p.x, y: p.y };
  }

  /** @param {{x:number,y:number}} p @param {number} u */
  function mirrorYPoint(p, u) {
    return { x: p.x, y: u - p.y };
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
   * @param {{x:number,y:number}} a
   * @param {{x:number,y:number}} b
   * @param {number} t
   * @returns {{x:number,y:number}}
   */
  function lerpPoint(a, b, t) {
    return {
      x: roundCoord(a.x + (b.x - a.x) * t),
      y: roundCoord(a.y + (b.y - a.y) * t),
    };
  }

  /**
   * @param {Map<string,{x1:number,y1:number,x2:number,y2:number}>} map
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  function addSegment(map, x1, y1, x2, y2) {
    if (x1 === x2 && y1 === y2) return;
    var key = segmentKey(x1, y1, x2, y2);
    if (!map.has(key)) {
      map.set(key, {
        x1: roundCoord(x1),
        y1: roundCoord(y1),
        x2: roundCoord(x2),
        y2: roundCoord(y2),
      });
    }
  }

  /**
   * 4×4 grid + outline inside a quadrilateral P0→P1→P2→P3 (unit-local coords).
   * @param {Map<string,{x1:number,y1:number,x2:number,y2:number}>} map
   * @param {number} ox
   * @param {number} oy
   * @param {number} u
   * @param {{x:number,y:number}} p0
   * @param {{x:number,y:number}} p1
   * @param {{x:number,y:number}} p2
   * @param {{x:number,y:number}} p3
   */
  function addDiamondGrid(map, ox, oy, u, p0, p1, p2, p3) {
    addUnitSegmentUnlessBoundary(
      map,
      ox,
      oy,
      u,
      p0.x,
      p0.y,
      p1.x,
      p1.y
    );
    addUnitSegmentUnlessBoundary(
      map,
      ox,
      oy,
      u,
      p1.x,
      p1.y,
      p2.x,
      p2.y
    );
    addUnitSegmentUnlessBoundary(
      map,
      ox,
      oy,
      u,
      p2.x,
      p2.y,
      p3.x,
      p3.y
    );
    addUnitSegmentUnlessBoundary(
      map,
      ox,
      oy,
      u,
      p3.x,
      p3.y,
      p0.x,
      p0.y
    );

    var k;
    for (k = 1; k <= 3; k++) {
      var t = k / 4;
      var a = lerpPoint(p0, p3, t);
      var b = lerpPoint(p1, p2, t);
      addUnitSegmentUnlessBoundary(map, ox, oy, u, a.x, a.y, b.x, b.y);
    }
    for (k = 1; k <= 3; k++) {
      t = k / 4;
      a = lerpPoint(p0, p1, t);
      b = lerpPoint(p3, p2, t);
      addUnitSegmentUnlessBoundary(map, ox, oy, u, a.x, a.y, b.x, b.y);
    }
  }

  /**
   * Square vertices for quadrant 0=TL, 1=TR, 2=BL, 3=BR (CCW for 4×4 grid).
   * TL/BR +36° CW; TR/BL −36° CCW via axis mirrors (pinwheel toward unit center).
   * @param {number} u
   * @param {number} quad
   * @returns {[{x:number,y:number},{x:number,y:number},{x:number,y:number},{x:number,y:number}]}
   */
  function getQuadrantSquareVertices(u, quad) {
    var base = getBaseTLSquareVertices(u);
    var verts;
    var order;

    if (quad === 0) {
      verts = base;
      order = [0, 1, 2, 3];
    } else if (quad === 1) {
      verts = base.map(function (p) {
        return mirrorXPoint(p, u);
      });
      order = [0, 3, 2, 1];
    } else if (quad === 2) {
      verts = base.map(function (p) {
        return mirrorYPoint(p, u);
      });
      order = [0, 3, 2, 1];
    } else {
      verts = base.map(function (p) {
        return mirrorYPoint(mirrorXPoint(p, u), u);
      });
      order = [0, 1, 2, 3];
    }

    var out = [];
    var i;
    for (i = 0; i < 4; i++) {
      var p = verts[order[i]];
      out.push({ x: roundCoord(p.x), y: roundCoord(p.y) });
    }
    return out;
  }

  /**
   * One repeat unit at (ox, oy); geometry built in local space, rotated 90° CW as a whole.
   * @param {Map<string,{x1:number,y1:number,x2:number,y2:number}>} map
   * @param {number} ox
   * @param {number} oy
   * @param {number} u
   */
  function addRepeatUnit(map, ox, oy, u) {
    var q;
    for (q = 0; q < 4; q++) {
      var verts = getQuadrantSquareVertices(u, q);
      addDiamondGrid(map, ox, oy, u, verts[0], verts[1], verts[2], verts[3]);
    }
    addRepeatUnitCenterAxes(map, ox, oy, u);
  }

  /**
   * @param {number} unitSize
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
   */
  function buildAllSegments(unitSize, canvasW, canvasH) {
    var u = unitSize;
    if (!(u > 0)) return [];

    var map = new Map();
    var colStart = Math.floor(-canvasW / u) - 1;
    var colEnd = Math.ceil(canvasW / u) + 1;
    var rowStart = Math.floor(-canvasH / u) - 1;
    var rowEnd = Math.ceil(canvasH / u) + 1;
    var col;
    var row;

    for (row = rowStart; row <= rowEnd; row++) {
      for (col = colStart; col <= colEnd; col++) {
        addRepeatUnit(map, col * u, row * u, u);
      }
    }

    return Array.from(map.values());
  }

  global.SwastikaGeometry = {
    buildAllSegments: buildAllSegments,
  };
})(typeof window !== "undefined" ? window : this);

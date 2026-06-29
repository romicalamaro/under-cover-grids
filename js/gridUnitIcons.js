/**
 * Inline SVG thumbnails of one grid unit per type (questionnaire gridType step).
 */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var UNIT_SIZE = 100;
  var STROKE_WIDTH = 1.25;
  var DOT_DIAMETER =
    typeof CIRCLES_GRID_FRAME_JUNCTION_DOT_DIAMETER_PX !== "undefined"
      ? CIRCLES_GRID_FRAME_JUNCTION_DOT_DIAMETER_PX
      : 5;

  function elSvg(tag) {
    return document.createElementNS(NS, tag);
  }

  function resolveInnerScale(innerScale) {
    if (typeof innerScale !== "number" || !isFinite(innerScale)) {
      return typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    }
    var min =
      typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
    var max =
      typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    return Math.min(max, Math.max(min, innerScale));
  }

  /** Star grid: slider min → max pinwheel; slider max → symmetric middle star. */
  function getStarPinwheelFactorFromInnerScale(innerScale) {
    var min =
      typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
    var max =
      typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
    var span = max - min;
    if (span < 1e-9) return 0;
    var t = (resolveInnerScale(innerScale) - min) / span;
    return Math.max(0, Math.min(1, 1 - t));
  }

  function filterSegmentsInBounds(segments, max) {
    var eps = 1e-6;
    var out = [];
    var i;
    var s;
    for (i = 0; i < segments.length; i++) {
      s = segments[i];
      if (
        s.x1 >= -eps &&
        s.y1 >= -eps &&
        s.x2 <= max + eps &&
        s.y2 <= max + eps &&
        s.x1 <= max + eps &&
        s.y1 <= max + eps &&
        s.x2 >= -eps &&
        s.y2 >= -eps
      ) {
        out.push(s);
      }
    }
    return out;
  }

  function appendSegments(g, segments) {
    var i;
    var s;
    var line;
    for (i = 0; i < segments.length; i++) {
      s = segments[i];
      line = elSvg("line");
      line.setAttribute("x1", String(s.x1));
      line.setAttribute("y1", String(s.y1));
      line.setAttribute("x2", String(s.x2));
      line.setAttribute("y2", String(s.y2));
      g.appendChild(line);
    }
  }

  function appendCircle(g, cx, cy, r) {
    var circle = elSvg("circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(r));
    g.appendChild(circle);
  }

  function appendDotsAtSideMidpoints(g, T, r) {
    var half = T / 2;
    appendCircle(g, half, 0, r);
    appendCircle(g, T, half, r);
    appendCircle(g, half, T, r);
    appendCircle(g, 0, half, r);
  }

  function buildSplitCellSegments(T, innerScale) {
    var Circles = global.CirclesGridGeometry;
    var half = T / 2;
    var sideHalf =
      Circles && Circles.sideHalfWidthFromInnerScale
        ? Circles.sideHalfWidthFromInnerScale(T, innerScale)
        : half;
    var xs = [
      Math.max(0, half - sideHalf),
      half,
      Math.min(T, half + sideHalf),
    ];
    var ys = xs.slice();
    if (!Circles || !Circles.buildSplitGridSegments) return [];
    return Circles.buildSplitGridSegments(xs, ys);
  }

  var CUT =
    typeof CUT_RATIO !== "undefined" ? CUT_RATIO : 1 / (2 + Math.SQRT2);

  /**
   * Single centered octagon unit, drawn like the actual octagon grid tile:
   * octagon → inner square → inner diamond, plus the diagonal corner lines and
   * the vertical/horizontal lines that link the octagon edges to the square.
   * Built in a box of side `size` whose top-left is (x0, y0).
   */
  function buildOctagonUnitSegments(x0, y0, size) {
    var cut = size * CUT;
    var half = size / 2;
    var inner = size - cut; // far edge of the inner square (cut .. size-cut)
    var segs = [];

    function push(ax, ay, bx, by) {
      segs.push({ x1: x0 + ax, y1: y0 + ay, x2: x0 + bx, y2: y0 + by });
    }

    // Octagon outline (8 edges)
    push(cut, 0, inner, 0);
    push(inner, 0, size, cut);
    push(size, cut, size, inner);
    push(size, inner, inner, size);
    push(inner, size, cut, size);
    push(cut, size, 0, inner);
    push(0, inner, 0, cut);
    push(0, cut, cut, 0);

    // Inner upright square
    push(cut, cut, inner, cut);
    push(inner, cut, inner, inner);
    push(inner, inner, cut, inner);
    push(cut, inner, cut, cut);

    // Diagonal corner lines: square corner → midpoint of the octagon's cut edge
    push(cut, cut, cut / 2, cut / 2);
    push(inner, cut, size - cut / 2, cut / 2);
    push(inner, inner, size - cut / 2, size - cut / 2);
    push(cut, inner, cut / 2, size - cut / 2);

    // Inner diamond (vertices on the square's edge midpoints)
    push(half, cut, inner, half);
    push(inner, half, half, inner);
    push(half, inner, cut, half);
    push(cut, half, half, cut);

    // Vertical / horizontal lines: octagon edge midpoint → square edge
    push(half, 0, half, cut);
    push(half, inner, half, size);
    push(0, half, cut, half);
    push(inner, half, size, half);

    return segs;
  }

  /**
   * Octagon chooser icon: shows the grid's full unit (octagon + square +
   * diamond + connector lines), centered with breathing room inside the frame.
   */
  function buildOctagonIconData(T) {
    return { segments: buildOctagonUnitSegments(0, 0, T) };
  }

  function buildStarIconData(T, innerScale) {
    var Star = global.NestedStarOctagonsGeometry;
    if (!Star || !Star.buildUnitCellPattern) {
      return { segments: [], starFills: [] };
    }
    var pinwheelFactor = getStarPinwheelFactorFromInnerScale(innerScale);
    var pattern = Star.buildUnitCellPattern(T, pinwheelFactor);
    return {
      segments: filterSegmentsInBounds(pattern.segments, T),
      starFills: pattern.starFills || [],
    };
  }

  function buildCirclesIconData(T, innerScale) {
    var Circles = global.CirclesGridGeometry;
    var half = T / 2;
    var sideHalf =
      Circles && Circles.sideHalfWidthFromInnerScale
        ? Circles.sideHalfWidthFromInnerScale(T, innerScale)
        : half;
    return {
      segments: buildSplitCellSegments(T, innerScale),
      circle: {
        cx: half,
        cy: half,
        r: Math.min(sideHalf, half),
      },
      dots: true,
    };
  }

  function buildDiamondsIconData(T, innerScale) {
    var Circles = global.CirclesGridGeometry;
    var half = T / 2;
    var sideHalf =
      Circles && Circles.sideHalfWidthFromInnerScale
        ? Circles.sideHalfWidthFromInnerScale(T, innerScale)
        : half;
    var rx = Math.min(sideHalf, half);
    var segments = buildSplitCellSegments(T, innerScale);
    segments.push(
      { x1: half, y1: half - rx, x2: half + rx, y2: half },
      { x1: half + rx, y1: half, x2: half, y2: half + rx },
      { x1: half, y1: half + rx, x2: half - rx, y2: half },
      { x1: half - rx, y1: half, x2: half, y2: half - rx }
    );
    return { segments: segments, dots: true };
  }

  function appendStarFills(g, starFills) {
    var Star = global.NestedStarOctagonsGeometry;
    if (!Star || !Star.closedPolygonPathD) return;
    var i;
    var d;
    var path;
    for (i = 0; i < starFills.length; i++) {
      d = Star.closedPolygonPathD(starFills[i].outline);
      if (!d) continue;
      path = elSvg("path");
      path.setAttribute("d", d);
      path.setAttribute("class", "grid-unit-icon__bg-fill");
      path.setAttribute("fill", "#fff");
      path.setAttribute("fill-rule", "nonzero");
      path.setAttribute("stroke", "none");
      g.appendChild(path);
    }
  }

  function populateGeomGroup(geom, gridType, innerScale) {
    var T = UNIT_SIZE;
    var data;
    var dotR = DOT_DIAMETER / 2;
    var scale = resolveInnerScale(innerScale);

    if (gridType === "octagon") {
      data = buildOctagonIconData(T);
      appendSegments(geom, data.segments);
    } else if (gridType === "star") {
      data = buildStarIconData(T, scale);
      appendStarFills(geom, data.starFills);
      appendSegments(geom, data.segments);
    } else if (gridType === "circles") {
      data = buildCirclesIconData(T, scale);
      appendSegments(geom, data.segments);
      appendCircle(geom, data.circle.cx, data.circle.cy, data.circle.r);
      if (data.dots) {
        var dotsG = elSvg("g");
        dotsG.setAttribute("class", "grid-unit-icon__dots");
        dotsG.setAttribute("fill", "currentColor");
        dotsG.setAttribute("stroke", "none");
        appendDotsAtSideMidpoints(dotsG, T, dotR);
        geom.appendChild(dotsG);
      }
    } else if (gridType === "diamonds") {
      data = buildDiamondsIconData(T, scale);
      appendSegments(geom, data.segments);
      if (data.dots) {
        var diamondDots = elSvg("g");
        diamondDots.setAttribute("class", "grid-unit-icon__dots");
        diamondDots.setAttribute("fill", "currentColor");
        diamondDots.setAttribute("stroke", "none");
        appendDotsAtSideMidpoints(diamondDots, T, dotR);
        geom.appendChild(diamondDots);
      }
    }
  }

  function createGeomGroup() {
    var geom = elSvg("g");
    geom.setAttribute("class", "grid-unit-icon__geom");
    geom.setAttribute("fill", "none");
    geom.setAttribute("stroke", "currentColor");
    geom.setAttribute("stroke-width", String(STROKE_WIDTH));
    geom.setAttribute("stroke-linecap", "square");
    geom.setAttribute("stroke-linejoin", "miter");
    return geom;
  }

  function createIconShell() {
    var svg = elSvg("svg");
    svg.setAttribute("viewBox", "0 0 " + UNIT_SIZE + " " + UNIT_SIZE);
    svg.setAttribute("class", "grid-unit-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    var frame = elSvg("rect");
    frame.setAttribute("class", "grid-unit-icon__frame");
    frame.setAttribute("x", "0");
    frame.setAttribute("y", "0");
    frame.setAttribute("width", String(UNIT_SIZE));
    frame.setAttribute("height", String(UNIT_SIZE));
    frame.setAttribute("fill", "none");
    frame.setAttribute("stroke", "currentColor");
    frame.setAttribute("stroke-width", String(STROKE_WIDTH));
    svg.appendChild(frame);

    return svg;
  }

  function createIcon(gridType, innerScale) {
    var scale = resolveInnerScale(innerScale);
    var svg = createIconShell();
    var geom = createGeomGroup();
    populateGeomGroup(geom, gridType, scale);
    svg.appendChild(geom);
    svg.setAttribute("data-grid-type", gridType || "");
    return svg;
  }

  function updateIconInnerScale(svg, gridType, innerScale) {
    if (!svg || !gridType) return;
    var geom = svg.querySelector(".grid-unit-icon__geom");
    if (!geom) return;
    while (geom.firstChild) {
      geom.removeChild(geom.firstChild);
    }
    populateGeomGroup(geom, gridType, innerScale);
    svg.setAttribute("data-grid-type", gridType);
  }

  global.GridUnitIcons = {
    createIcon: createIcon,
    updateIconInnerScale: updateIconInnerScale,
    resolveInnerScale: resolveInnerScale,
    UNIT_SIZE: UNIT_SIZE,
  };
})(typeof window !== "undefined" ? window : this);

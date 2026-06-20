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

  function buildSquareCellSegments(T) {
    var Circles = global.CirclesGridGeometry;
    if (!Circles || !Circles.buildSplitGridSegments) return [];
    var half = T / 2;
    return Circles.buildSplitGridSegments([0, half, T], [0, half, T]);
  }

  function getOctagonEdgeSegments(T, cut) {
    var innerRight = T - cut;
    var innerBottom = T - cut;
    return [
      { x1: cut, y1: 0, x2: innerRight, y2: 0 },
      { x1: innerRight, y1: 0, x2: T, y2: cut },
      { x1: T, y1: cut, x2: T, y2: innerBottom },
      { x1: T, y1: innerBottom, x2: innerRight, y2: T },
      { x1: innerRight, y1: T, x2: cut, y2: T },
      { x1: cut, y1: T, x2: 0, y2: innerBottom },
      { x1: 0, y1: innerBottom, x2: 0, y2: cut },
      { x1: 0, y1: cut, x2: cut, y2: 0 },
    ];
  }

  function buildOctagonIconData(T) {
    var cutRatio =
      typeof CUT_RATIO !== "undefined" ? CUT_RATIO : 1 / (2 + Math.SQRT2);
    var cut = T * cutRatio;
    var half = T / 2;
    var innerRight = T - cut;
    var innerBottom = T - cut;

    var segments = getOctagonEdgeSegments(T, cut);

    // Inner square (inset within the cell)
    segments.push(
      { x1: cut, y1: cut, x2: innerRight, y2: cut },
      { x1: innerRight, y1: cut, x2: innerRight, y2: innerBottom },
      { x1: innerRight, y1: innerBottom, x2: cut, y2: innerBottom },
      { x1: cut, y1: innerBottom, x2: cut, y2: cut },
      // Outer square corners → inner square corners
      { x1: 0, y1: 0, x2: cut, y2: cut },
      { x1: T, y1: 0, x2: innerRight, y2: cut },
      { x1: T, y1: T, x2: innerRight, y2: innerBottom },
      { x1: 0, y1: T, x2: cut, y2: innerBottom },
      // Diamond inscribed in inner square (vertices at side midpoints)
      { x1: half, y1: cut, x2: innerRight, y2: half },
      { x1: innerRight, y1: half, x2: half, y2: innerBottom },
      { x1: half, y1: innerBottom, x2: cut, y2: half },
      { x1: cut, y1: half, x2: half, y2: cut }
    );

    return { segments: segments };
  }

  function buildStarIconData(T) {
    var Star = global.NestedStarOctagonsGeometry;
    if (!Star || !Star.buildUnitCellPattern) return { segments: [], starFills: [] };
    var pattern = Star.buildUnitCellPattern(T, 0);
    return {
      segments: filterSegmentsInBounds(pattern.segments, T),
      starFills: pattern.starFills || [],
    };
  }

  function buildCirclesIconData(T) {
    var segments = buildSquareCellSegments(T);
    var half = T / 2;
    return {
      segments: segments,
      circle: { cx: half, cy: half, r: half },
      dots: true,
    };
  }

  function buildDiamondsIconData(T) {
    var segments = buildSquareCellSegments(T);
    var half = T / 2;
    segments.push(
      { x1: half, y1: 0, x2: T, y2: half },
      { x1: T, y1: half, x2: half, y2: T },
      { x1: half, y1: T, x2: 0, y2: half },
      { x1: 0, y1: half, x2: half, y2: 0 }
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

  function createIconShell() {
    var svg = elSvg("svg");
    svg.setAttribute("viewBox", "0 0 " + UNIT_SIZE + " " + UNIT_SIZE);
    svg.setAttribute("class", "grid-unit-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    var frame = elSvg("rect");
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

  function createIcon(gridType) {
    var T = UNIT_SIZE;
    var svg = createIconShell();
    var geom = elSvg("g");
    geom.setAttribute("class", "grid-unit-icon__geom");
    geom.setAttribute("fill", "none");
    geom.setAttribute("stroke", "currentColor");
    geom.setAttribute("stroke-width", String(STROKE_WIDTH));
    geom.setAttribute("stroke-linecap", "square");
    geom.setAttribute("stroke-linejoin", "miter");

    var data;
    var dotR = DOT_DIAMETER / 2;

    if (gridType === "octagon") {
      data = buildOctagonIconData(T);
      appendSegments(geom, data.segments);
    } else if (gridType === "star") {
      data = buildStarIconData(T);
      appendStarFills(geom, data.starFills);
      appendSegments(geom, data.segments);
    } else if (gridType === "circles") {
      data = buildCirclesIconData(T);
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
      data = buildDiamondsIconData(T);
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

    svg.appendChild(geom);
    return svg;
  }

  global.GridUnitIcons = {
    createIcon: createIcon,
    UNIT_SIZE: UNIT_SIZE,
  };
})(typeof window !== "undefined" ? window : this);

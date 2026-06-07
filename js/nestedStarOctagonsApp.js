(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var designSvg = null;
  var cachedSegments = [];
  var cachedStarFills = [];
  var cachedStarRhombusFills = [];
  var validLayouts = [];

  var STROKE_COLOR =
    typeof PATTERN_STROKE_COLOR_DEFAULT !== "undefined"
      ? PATTERN_STROKE_COLOR_DEFAULT
      : "#222222";
  var STROKE_WIDTH =
    typeof NESTED_STAR_STROKE_WIDTH !== "undefined"
      ? NESTED_STAR_STROKE_WIDTH
      : 1;

  function elSvg(name) {
    return document.createElementNS(NS, name);
  }

  function getCurrentLayout() {
    var slider = document.getElementById("nested-star-octagons-n");
    var requested = slider
      ? Math.round(Number(slider.value))
      : OCTAGONS_N_DEFAULT;
    return NestedStarOctagonsGeometry.snapLayoutToN(
      requested,
      validLayouts,
      CANVAS_W,
      CANVAS_H
    );
  }

  function closedPolygonPathD(points) {
    return NestedStarOctagonsGeometry.closedPolygonPathD(points);
  }

  function starFillsToGroup(starFills, fillColor, groupId) {
    var g = elSvg("g");
    g.setAttribute("id", groupId || "layer-star-fills");
    var fill = fillColor || BG_COLOR;
    var i;
    var p;
    for (i = 0; i < starFills.length; i++) {
      p = elSvg("path");
      p.setAttribute("d", closedPolygonPathD(starFills[i].outline));
      p.setAttribute("fill", fill);
      p.setAttribute("fill-rule", "nonzero");
      p.setAttribute("stroke", "none");
      g.appendChild(p);
    }
    return g;
  }

  function segmentsToGroup(segments) {
    var g = elSvg("g");
    g.setAttribute("id", "layer-pattern-lines");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", STROKE_COLOR);
    g.setAttribute("stroke-width", String(STROKE_WIDTH));
    g.setAttribute("stroke-linecap", "square");
    g.setAttribute("stroke-linejoin", "miter");

    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var line = elSvg("line");
      line.setAttribute("x1", String(s.x1));
      line.setAttribute("y1", String(s.y1));
      line.setAttribute("x2", String(s.x2));
      line.setAttribute("y2", String(s.y2));
      g.appendChild(line);
    }
    return g;
  }

  function createDesignSvg() {
    var svg = elSvg("svg");
    designSvg = svg;
    svg.setAttribute("id", "design-svg");
    svg.setAttribute("viewBox", "0 0 " + CANVAS_W + " " + CANVAS_H);
    svg.setAttribute("xmlns", NS);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Nested star octagon grid pattern");

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
    svg.appendChild(defs);

    var bg = elSvg("rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(CANVAS_W));
    bg.setAttribute("height", String(CANVAS_H));
    bg.setAttribute("fill", BG_COLOR);
    svg.appendChild(bg);

    var pattern = elSvg("g");
    pattern.setAttribute("id", "layer-pattern");
    pattern.setAttribute("clip-path", "url(#canvas-clip)");
    svg.appendChild(pattern);

    return svg;
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

  function render() {
    var layout = getCurrentLayout();
    var actualT = NestedStarOctagonsGeometry.roundCoord(layout.tileSize);
    var slider = document.getElementById("nested-star-octagons-n");
    if (slider) {
      slider.value = String(layout.n);
    }

    var out = document.getElementById("nested-star-octagons-n-out");
    if (out) {
      out.textContent = String(layout.n);
    }

    var info = document.getElementById("tile-info");
    if (info) {
      info.textContent =
        layout.n +
        " complete/row · " +
        layout.m +
        " complete/col · " +
        actualT +
        " px tile";
    }

    var pattern = NestedStarOctagonsGeometry.buildPattern(layout);
    cachedSegments = pattern.segments;
    cachedStarFills = pattern.starFills;
    cachedStarRhombusFills = pattern.starRhombusFills || [];

    if (!designSvg) {
      designSvg = createDesignSvg();
      var wrap = document.getElementById("stage-wrap");
      if (wrap) wrap.appendChild(designSvg);
    }

    var patternLayer = designSvg.querySelector("#layer-pattern");
    if (!patternLayer) return;

    while (patternLayer.firstChild) {
      patternLayer.removeChild(patternLayer.firstChild);
    }
    if (cachedStarFills.length) {
      patternLayer.appendChild(starFillsToGroup(cachedStarFills));
    }
    patternLayer.appendChild(segmentsToGroup(cachedSegments));
    layoutStage();
  }

  function buildExportSvgString() {
    var pattern = cachedSegments.length
      ? {
          segments: cachedSegments,
          starFills: cachedStarFills,
        }
      : NestedStarOctagonsGeometry.buildPattern(getCurrentLayout());
    var segments = pattern.segments;
    var starFills = pattern.starFills || [];
    var lines = [];
    var fi;

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        CANVAS_W +
        " " +
        CANVAS_H +
        '" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '">'
    );
    lines.push("<defs>");
    lines.push(
      '<clipPath id="canvas-clip"><rect x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '"/></clipPath>'
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
    lines.push('<g clip-path="url(#canvas-clip)">');

    for (fi = 0; fi < starFills.length; fi++) {
      lines.push(
        '<path d="' +
          closedPolygonPathD(starFills[fi].outline) +
          '" fill="' +
          BG_COLOR +
          '" fill-rule="nonzero" stroke="none"/>'
      );
    }

    lines.push(
      '<g fill="none" stroke="' +
        STROKE_COLOR +
        '" stroke-width="' +
        STROKE_WIDTH +
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
    lines.push("</g>");
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
    try {
      var markup = buildExportSvgString();
      var blob = new Blob([markup], {
        type: "image/svg+xml;charset=utf-8",
      });
      downloadBlob(blob, "star-grid-export-68x180cm.svg");
    } catch (e) {
      console.error(e);
      alert("SVG export failed.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    validLayouts = NestedStarOctagonsGeometry.buildValidLayouts(
      CANVAS_W,
      CANVAS_H
    );
    if (!validLayouts.length) {
      validLayouts = [
        NestedStarOctagonsGeometry.computeLayoutFromN(
          OCTAGONS_N_DEFAULT,
          CANVAS_W,
          CANVAS_H
        ),
      ];
    }

    var slider = document.getElementById("nested-star-octagons-n");
    if (slider) {
      var minN = validLayouts[0].n;
      var maxN = validLayouts[validLayouts.length - 1].n;
      var startLayout = NestedStarOctagonsGeometry.snapLayoutToN(
        OCTAGONS_N_DEFAULT,
        validLayouts,
        CANVAS_W,
        CANVAS_H
      );
      slider.min = String(minN);
      slider.max = String(maxN);
      slider.step = "1";
      slider.value = String(startLayout.n);
      slider.addEventListener("input", render);
    }

    var exportBtn = document.getElementById("export-svg-btn");
    if (exportBtn) exportBtn.addEventListener("click", onExportSvg);

    window.addEventListener("resize", layoutStage);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

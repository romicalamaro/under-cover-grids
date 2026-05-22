(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var designSvg = null;
  var cachedSegments = [];

  function elSvg(name) {
    return document.createElementNS(NS, name);
  }

  function getUnitSize() {
    var slider = document.getElementById("swastika-unit-size");
    var v = slider ? Number(slider.value) : SWASTIKA_UNIT_DEFAULT;
    return Math.min(
      SWASTIKA_UNIT_MAX,
      Math.max(SWASTIKA_UNIT_MIN, Math.round(v))
    );
  }

  function segmentsToGroup(segments) {
    var g = elSvg("g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", PATTERN_STROKE_COLOR_DEFAULT);
    g.setAttribute("stroke-width", String(SWASTIKA_STROKE_WIDTH));
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
    svg.setAttribute("aria-label", "Rotated square swastika grid");

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

  function render() {
    var unitSize = getUnitSize();
    var out = document.getElementById("swastika-unit-size-out");
    if (out) out.textContent = String(unitSize) + " px";

    var info = document.getElementById("tile-info");
    if (info) {
      var cols = Math.ceil(CANVAS_W / unitSize);
      var rows = Math.ceil(CANVAS_H / unitSize);
      info.textContent =
        "Unit " +
        unitSize +
        " px · ~" +
        cols +
        " × " +
        rows +
        " across canvas";
    }

    cachedSegments = SwastikaGeometry.buildAllSegments(
      unitSize,
      CANVAS_W,
      CANVAS_H
    );

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
    patternLayer.appendChild(segmentsToGroup(cachedSegments));
    layoutStage();
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

  function buildExportSvgString() {
    var segments = cachedSegments.length
      ? cachedSegments
      : SwastikaGeometry.buildAllSegments(
          getUnitSize(),
          CANVAS_W,
          CANVAS_H
        );
    var lines = [];
    var stroke = PATTERN_STROKE_COLOR_DEFAULT;
    var sw = SWASTIKA_STROKE_WIDTH;

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
    lines.push(
      '<g fill="none" stroke="' +
        stroke +
        '" stroke-width="' +
        sw +
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
      downloadBlob(blob, "swastika-export-70x180cm.svg");
    } catch (e) {
      console.error(e);
      alert("SVG export failed.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    var slider = document.getElementById("swastika-unit-size");
    if (slider) {
      slider.min = String(SWASTIKA_UNIT_MIN);
      slider.max = String(SWASTIKA_UNIT_MAX);
      slider.value = String(SWASTIKA_UNIT_DEFAULT);
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

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var designSvg = null;
  var lastOctagonsN = OCTAGONS_N_DEFAULT;
  var lastTileSize = CANVAS_W / (OCTAGONS_N_DEFAULT + 1);
  var cachedAllSegments = [];

  var interactionMode = "view";
  var removedEdges = new Set();
  var dragPath = [];
  var isDragging = false;

  function elSvg(name) {
    return document.createElementNS(NS, name);
  }

  function getOctagonsN() {
    var slider = document.getElementById("octagons-n");
    var v = slider ? Number(slider.value) : OCTAGONS_N_DEFAULT;
    return Math.min(OCTAGONS_N_MAX, Math.max(OCTAGONS_N_MIN, Math.round(v)));
  }

  function getInnerScale() {
    var slider = document.getElementById("inner-scale");
    var v = slider ? Number(slider.value) : INNER_SCALE_DEFAULT;
    return Math.min(
      INNER_SCALE_MAX,
      Math.max(INNER_SCALE_MIN, Math.round(v * 100) / 100)
    );
  }

  function updateLayoutState() {
    lastOctagonsN = getOctagonsN();
    lastTileSize = TopkapiGeometry.tileSizeFromN(lastOctagonsN, CANVAS_W);
  }

  function buildAllSegments() {
    return TopkapiGeometry.buildPatternSegments(
      lastTileSize,
      CANVAS_W,
      CANVAS_H,
      lastOctagonsN,
      getInnerScale()
    );
  }

  function getVisibleSegments(segments) {
    var visible = [];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (!removedEdges.has(key)) visible.push(s);
    }
    return visible;
  }

  function getRemovedSegments() {
    var removed = [];
    for (var i = 0; i < cachedAllSegments.length; i++) {
      var s = cachedAllSegments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      if (removedEdges.has(key)) removed.push(s);
    }
    return removed;
  }

  function isDragInteractionMode() {
    return interactionMode === "merge" || interactionMode === "restore";
  }

  function clearMergeState() {
    removedEdges.clear();
    updateResetButton();
  }

  function updateResetButton() {
    var resetBtn = document.getElementById("reset-grid-btn");
    if (resetBtn) resetBtn.disabled = removedEdges.size === 0;
  }

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {SVGElement}
   */
  function segmentsToGroup(segments) {
    var g = elSvg("g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", STROKE_COLOR);
    g.setAttribute("stroke-width", String(STROKE_WIDTH));
    g.setAttribute("stroke-linecap", "square");
    g.setAttribute("stroke-linejoin", "miter");

    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var key = TopkapiGeometry.segmentKey(s.x1, s.y1, s.x2, s.y2);
      var line = elSvg("line");
      line.setAttribute("x1", String(s.x1));
      line.setAttribute("y1", String(s.y1));
      line.setAttribute("x2", String(s.x2));
      line.setAttribute("y2", String(s.y2));
      line.setAttribute("data-key", key);
      g.appendChild(line);
    }
    return g;
  }

  function createDesignSvg() {
    var svg = elSvg("svg");
    svg.setAttribute("id", "design-svg");
    svg.setAttribute("viewBox", "0 0 " + CANVAS_W + " " + CANVAS_H);
    svg.setAttribute("xmlns", NS);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Topkapi geometric grid");

    var bg = elSvg("rect");
    bg.setAttribute("id", "canvas-bg");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(CANVAS_W));
    bg.setAttribute("height", String(CANVAS_H));
    bg.setAttribute("fill", BG_COLOR);
    svg.appendChild(bg);

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

    var pattern = elSvg("g");
    pattern.setAttribute("id", "layer-pattern");
    pattern.setAttribute("clip-path", "url(#canvas-clip)");
    svg.appendChild(pattern);

    return svg;
  }

  function renderPatternLayer() {
    if (!designSvg) return;
    var layer = designSvg.querySelector("#layer-pattern");
    if (!layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    layer.appendChild(segmentsToGroup(getVisibleSegments(cachedAllSegments)));
  }

  function render() {
    updateLayoutState();

    var outN = document.getElementById("octagons-n-out");
    if (outN) outN.textContent = String(lastOctagonsN);

    var innerScale = getInnerScale();
    var outInner = document.getElementById("inner-scale-out");
    if (outInner) outInner.textContent = String(innerScale);

    var layout = TopkapiGeometry.computeLayout(
      lastOctagonsN,
      CANVAS_W,
      CANVAS_H
    );
    var info = document.getElementById("tile-info");
    if (info) {
      info.textContent =
        "Tile " +
        Math.round(layout.tileSize * 100) / 100 +
        " px · " +
        (lastOctagonsN + 1) +
        " across · " +
        (layout.m + 1) +
        " down (symmetric clip)";
    }

    if (!designSvg) {
      designSvg = createDesignSvg();
      var wrap = document.getElementById("stage-wrap");
      if (wrap) wrap.appendChild(designSvg);
    }

    cachedAllSegments = buildAllSegments();
    renderPatternLayer();
    layoutStage();
    updateResetButton();
  }

  function renderAfterSliderChange() {
    clearMergeState();
    render();
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

  /**
   * @param {{x1:number,y1:number,x2:number,y2:number}[]} segments
   * @returns {string}
   */
  function buildExportSvgString(segments) {
    var lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      '<svg xmlns="' +
        NS +
        '" width="70cm" height="180cm" viewBox="0 0 ' +
        CANVAS_W +
        " " +
        CANVAS_H +
        '">'
    );
    lines.push(
      '<rect x="0" y="0" width="' +
        CANVAS_W +
        '" height="' +
        CANVAS_H +
        '" fill="' +
        BG_COLOR +
        '"/>'
    );
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
      var segments = getVisibleSegments(cachedAllSegments);
      var markup = buildExportSvgString(segments);
      var blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(blob, "topkapi-export-70x180cm.svg");
    } catch (e) {
      console.error(e);
      alert("SVG export failed.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function clientToViewBox(svg, clientX, clientY) {
    var pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  function getHitThreshold(svg) {
    var rect = svg.getBoundingClientRect();
    var scale = rect.width / CANVAS_W;
    if (!scale || scale <= 0) scale = 1;
    return EDGE_HIT_THRESHOLD_PX / scale;
  }

  function appendDragPoint(svg, clientX, clientY) {
    var pt = clientToViewBox(svg, clientX, clientY);
    if (!pt) return;
    var last = dragPath[dragPath.length - 1];
    if (last) {
      var dx = pt.x - last.x;
      var dy = pt.y - last.y;
      if (dx * dx + dy * dy < 1) return;
    }
    dragPath.push({ x: pt.x, y: pt.y });
  }

  function applyDanglingPrune() {
    var changed = false;
    var pruneKeys = TopkapiGeometry.findDanglingPruneKeys(
      cachedAllSegments,
      removedEdges
    );
    for (var j = 0; j < pruneKeys.length; j++) {
      var pk = pruneKeys[j];
      if (removedEdges.has(pk)) continue;
      removedEdges.add(pk);
      changed = true;
    }
    return changed;
  }

  function removeEdgesByKeys(keys) {
    var changed = false;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (removedEdges.has(key)) continue;
      removedEdges.add(key);
      changed = true;
    }

    if (applyDanglingPrune()) changed = true;

    if (changed) {
      renderPatternLayer();
      updateResetButton();
    }
  }

  function restoreEdgesByKeys(keys) {
    var validKeys = TopkapiGeometry.filterValidRestoreKeys(
      cachedAllSegments,
      removedEdges,
      keys
    );
    var changed = false;
    for (var i = 0; i < validKeys.length; i++) {
      var key = validKeys[i];
      if (!removedEdges.has(key)) continue;
      removedEdges.delete(key);
      changed = true;
    }

    if (applyDanglingPrune()) changed = true;

    if (changed) {
      renderPatternLayer();
      updateResetButton();
    }
  }

  function processDragHitTest() {
    if (!designSvg || dragPath.length === 0) return;
    var threshold = getHitThreshold(designSvg);

    if (interactionMode === "merge") {
      var visible = getVisibleSegments(cachedAllSegments);
      var keys = TopkapiGeometry.findSegmentsNearPolyline(
        visible,
        dragPath,
        threshold,
        removedEdges
      );
      removeEdgesByKeys(keys);
    } else if (interactionMode === "restore") {
      var removedSegs = getRemovedSegments();
      if (!removedSegs.length) return;
      var restoreKeys = TopkapiGeometry.findSegmentsNearPolyline(
        removedSegs,
        dragPath,
        threshold,
        null
      );
      restoreEdgesByKeys(restoreKeys);
    }
  }

  function onPointerDown(e) {
    if (!isDragInteractionMode() || !designSvg) return;
    if (e.button !== 0) return;
    isDragging = true;
    dragPath = [];
    designSvg.setPointerCapture(e.pointerId);
    appendDragPoint(designSvg, e.clientX, e.clientY);
    processDragHitTest();
    var wrap = document.getElementById("stage-wrap");
    if (wrap) wrap.classList.add("is-dragging");
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging || !designSvg) return;
    appendDragPoint(designSvg, e.clientX, e.clientY);
    processDragHitTest();
    e.preventDefault();
  }

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    dragPath = [];
    if (designSvg && designSvg.hasPointerCapture(e.pointerId)) {
      designSvg.releasePointerCapture(e.pointerId);
    }
    var wrap = document.getElementById("stage-wrap");
    if (wrap) wrap.classList.remove("is-dragging");
  }

  function onPointerUp(e) {
    endDrag(e);
  }

  function onPointerCancel(e) {
    endDrag(e);
  }

  var interactionListenersBound = false;

  function bindInteractionPointerListeners() {
    if (!designSvg || interactionListenersBound) return;
    designSvg.addEventListener("pointerdown", onPointerDown);
    designSvg.addEventListener("pointermove", onPointerMove);
    designSvg.addEventListener("pointerup", onPointerUp);
    designSvg.addEventListener("pointercancel", onPointerCancel);
    interactionListenersBound = true;
  }

  function unbindInteractionPointerListeners() {
    if (!designSvg || !interactionListenersBound) return;
    designSvg.removeEventListener("pointerdown", onPointerDown);
    designSvg.removeEventListener("pointermove", onPointerMove);
    designSvg.removeEventListener("pointerup", onPointerUp);
    designSvg.removeEventListener("pointercancel", onPointerCancel);
    interactionListenersBound = false;
    isDragging = false;
    dragPath = [];
    var wrap = document.getElementById("stage-wrap");
    if (wrap) wrap.classList.remove("is-dragging");
  }

  function updateModeUi() {
    var viewBtn = document.getElementById("mode-view-btn");
    var mergeBtn = document.getElementById("mode-merge-btn");
    var restoreBtn = document.getElementById("mode-restore-btn");
    var mergeHint = document.getElementById("merge-hint");
    var restoreHint = document.getElementById("restore-hint");

    if (viewBtn) {
      viewBtn.classList.toggle("is-active", interactionMode === "view");
      viewBtn.setAttribute("aria-pressed", String(interactionMode === "view"));
    }
    if (mergeBtn) {
      mergeBtn.classList.toggle("is-active", interactionMode === "merge");
      mergeBtn.setAttribute("aria-pressed", String(interactionMode === "merge"));
    }
    if (restoreBtn) {
      restoreBtn.classList.toggle("is-active", interactionMode === "restore");
      restoreBtn.setAttribute(
        "aria-pressed",
        String(interactionMode === "restore")
      );
    }
    if (mergeHint) mergeHint.hidden = interactionMode !== "merge";
    if (restoreHint) restoreHint.hidden = interactionMode !== "restore";
    if (designSvg) {
      designSvg.classList.toggle("is-merge-mode", interactionMode === "merge");
      designSvg.classList.toggle(
        "is-restore-mode",
        interactionMode === "restore"
      );
    }
  }

  function setMode(mode) {
    if (mode !== "view" && mode !== "merge" && mode !== "restore") return;
    interactionMode = mode;
    updateModeUi();
    if (isDragInteractionMode()) {
      bindInteractionPointerListeners();
    } else {
      unbindInteractionPointerListeners();
    }
  }

  function onResetGrid() {
    clearMergeState();
    renderPatternLayer();
  }

  function init() {
    var slider = document.getElementById("octagons-n");
    if (slider) {
      slider.min = String(OCTAGONS_N_MIN);
      slider.max = String(OCTAGONS_N_MAX);
      slider.value = String(OCTAGONS_N_DEFAULT);
      slider.addEventListener("input", renderAfterSliderChange);
    }

    var innerSlider = document.getElementById("inner-scale");
    if (innerSlider) {
      innerSlider.min = String(INNER_SCALE_MIN);
      innerSlider.max = String(INNER_SCALE_MAX);
      innerSlider.value = String(INNER_SCALE_DEFAULT);
      innerSlider.addEventListener("input", renderAfterSliderChange);
    }

    var exportBtn = document.getElementById("export-svg-btn");
    if (exportBtn) exportBtn.addEventListener("click", onExportSvg);

    var viewBtn = document.getElementById("mode-view-btn");
    if (viewBtn) viewBtn.addEventListener("click", function () {
      setMode("view");
    });

    var mergeBtn = document.getElementById("mode-merge-btn");
    if (mergeBtn) mergeBtn.addEventListener("click", function () {
      setMode("merge");
    });

    var restoreBtn = document.getElementById("mode-restore-btn");
    if (restoreBtn) restoreBtn.addEventListener("click", function () {
      setMode("restore");
    });

    var resetBtn = document.getElementById("reset-grid-btn");
    if (resetBtn) resetBtn.addEventListener("click", onResetGrid);

    window.addEventListener("resize", layoutStage);
    render();
    setMode("view");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

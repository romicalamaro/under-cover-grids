/**
 * Interactive spider / radar chart for questionnaire feelings.
 * Center = maximum intensity; outer edge = minimum.
 * Snaps to FEELINGS_SLIDER_STEPS discrete rings.
 */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  var VIEW_SIZE = 420;
  var CENTER = VIEW_SIZE / 2;
  var OUTER_RADIUS = 118;
  var LABEL_RADIUS = OUTER_RADIUS + 34;
  var AXIS_HIT_WIDTH = 22;

  function getSteps() {
    return typeof FEELINGS_SLIDER_STEPS !== "undefined"
      ? FEELINGS_SLIDER_STEPS
      : 5;
  }

  function axisAngle(index, count) {
    return -Math.PI / 2 + (index * 2 * Math.PI) / count;
  }

  function stepFromDistance(distance, outerRadius, steps) {
    if (steps < 2) return 1;
    var t = distance / outerRadius;
    if (t <= 0) return steps;
    if (t >= 1) return 1;
    var raw = steps - t * (steps - 1);
    return clampFeelingsStepNumber(Math.round(raw));
  }

  function distanceFromStep(step, outerRadius, steps) {
    if (steps < 2) return outerRadius;
    return (outerRadius * (steps - step)) / (steps - 1);
  }

  function pointOnAxis(index, count, distance) {
    var angle = axisAngle(index, count);
    return {
      x: CENTER + distance * Math.cos(angle),
      y: CENTER + distance * Math.sin(angle),
    };
  }

  function polygonPointsForRing(ringStep, count, outerRadius, steps) {
    var dist = distanceFromStep(ringStep, outerRadius, steps);
    var parts = [];
    var i;
    for (i = 0; i < count; i++) {
      var pt = pointOnAxis(i, count, dist);
      parts.push(pt.x.toFixed(2) + "," + pt.y.toFixed(2));
    }
    return parts.join(" ");
  }

  function clientToSvg(svg, clientX, clientY) {
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return { x: CENTER, y: CENTER };
    }
    var vb = svg.viewBox.baseVal;
    var vbX = vb.width ? vb.x : 0;
    var vbY = vb.height ? vb.y : 0;
    var vbW = vb.width || VIEW_SIZE;
    var vbH = vb.height || VIEW_SIZE;
    return {
      x: vbX + ((clientX - rect.left) / rect.width) * vbW,
      y: vbY + ((clientY - rect.top) / rect.height) * vbH,
    };
  }

  function projectDistanceOnAxis(localX, localY, angle) {
    var dx = localX - CENTER;
    var dy = localY - CENTER;
    var ux = Math.cos(angle);
    var uy = Math.sin(angle);
    return dx * ux + dy * uy;
  }

  function createSvgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    var key;
    for (key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) {
        el.setAttribute(key, attrs[key]);
      }
    }
    return el;
  }

  /**
   * @param {HTMLElement} container
   * @param {{
   *   rows: Array<{label: string, stepId: string}>,
   *   scaleLabels?: string[],
   *   getBounds: (stepId: string) => [number, number]|null,
   *   getValue: (stepId: string) => number,
   *   setValue: (stepId: string, value: number) => void,
   *   onChange?: () => void
   * }} options
   */
  function createFeelingsSpiderChart(container, options) {
    options = options || {};
    var rows = options.rows || [];
    var scaleLabels = options.scaleLabels || [];
    var getBounds = options.getBounds;
    var getValue = options.getValue;
    var setValue = options.setValue;
    var onChange = options.onChange;
    var couplings = options.couplings || [];
    var count = rows.length;
    var steps = getSteps();
    var outerRadius = OUTER_RADIUS;

    var state = rows.map(function (row, index) {
      var bounds = getBounds ? getBounds(row.stepId) : null;
      var min = bounds ? bounds[0] : 0;
      var max = bounds ? bounds[1] : 0;
      var internal = getValue ? Number(getValue(row.stepId)) : min;
      var step = feelingsStepFromValue(internal, min, max);
      return {
        index: index,
        stepId: row.stepId,
        label: row.label,
        min: min,
        max: max,
        step: step,
      };
    });

    // Quick lookup so couplings can reference axes by their stepId.
    var stateByStepId = {};
    state.forEach(function (axisState) {
      stateByStepId[axisState.stepId] = axisState;
    });

    /**
     * Enforce emotion couplings (raise-only floor).
     * When a source axis is at/above its threshold step, the target axis is
     * pushed up to at least its floor step. It never lowers an axis, so an
     * inactive source leaves its target untouched.
     */
    function applyCouplings() {
      if (!couplings.length) return;
      couplings.forEach(function (coupling) {
        var source = stateByStepId[coupling.sourceStepId];
        var target = stateByStepId[coupling.targetStepId];
        if (!source || !target) return;
        if (source.step >= coupling.sourceMinStep) {
          var floorStep = clampFeelingsStepNumber(coupling.targetFloorStep);
          if (target.step < floorStep) {
            target.step = floorStep;
          }
        }
      });
    }

    /**
     * Run couplings and write any raised axes back through setValue, without
     * firing onChange. Used at setup and on refresh to keep stored answers in
     * sync after a restore.
     */
    function persistCoupledChanges() {
      var prevSteps = state.map(function (s) {
        return s.step;
      });
      applyCouplings();
      state.forEach(function (s, idx) {
        if (s.step !== prevSteps[idx] && setValue) {
          setValue(s.stepId, feelingsValueFromStep(s.step, s.min, s.max));
        }
      });
    }

    var svg = createSvgEl("svg", {
      class: "questionnaire-feelings-spider__svg",
      viewBox: "0 0 " + VIEW_SIZE + " " + VIEW_SIZE,
      role: "group",
      "aria-label": "Feelings intensity spider chart",
    });

    var gridLayer = createSvgEl("g", { class: "questionnaire-feelings-spider__grid" });
    var axisHitLayer = createSvgEl("g", {
      class: "questionnaire-feelings-spider__axis-hits",
    });
    var dataLayer = createSvgEl("g", { class: "questionnaire-feelings-spider__data" });
    var handlesLayer = createSvgEl("g", {
      class: "questionnaire-feelings-spider__handles",
    });
    var labelsLayer = createSvgEl("g", {
      class: "questionnaire-feelings-spider__labels",
    });

    var ringStep;
    for (ringStep = 1; ringStep <= steps; ringStep++) {
      gridLayer.appendChild(
        createSvgEl("polygon", {
          class: "questionnaire-feelings-spider__ring",
          points: polygonPointsForRing(ringStep, count, outerRadius, steps),
          "data-ring-step": String(ringStep),
        })
      );
    }

    var axisIndex;
    for (axisIndex = 0; axisIndex < count; axisIndex++) {
      var outerPt = pointOnAxis(axisIndex, count, outerRadius);
      gridLayer.appendChild(
        createSvgEl("line", {
          class: "questionnaire-feelings-spider__axis",
          x1: String(CENTER),
          y1: String(CENTER),
          x2: String(outerPt.x),
          y2: String(outerPt.y),
        })
      );
    }

    var polygonEl = createSvgEl("polygon", {
      class: "questionnaire-feelings-spider__polygon",
    });
    dataLayer.appendChild(polygonEl);

    var handleEls = [];
    var handleHitEls = [];

    state.forEach(function (axisState, idx) {
      var labelPt = pointOnAxis(idx, count, LABEL_RADIUS);
      var labelEl = createSvgEl("text", {
        class: "questionnaire-feelings-spider__label",
        x: String(labelPt.x),
        y: String(labelPt.y),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "pointer-events": "none",
      });
      labelEl.textContent = axisState.label;
      labelsLayer.appendChild(labelEl);

      var outerAxisPt = pointOnAxis(idx, count, outerRadius);
      var axisHit = createSvgEl("line", {
        class: "questionnaire-feelings-spider__axis-hit",
        x1: String(CENTER),
        y1: String(CENTER),
        x2: String(outerAxisPt.x),
        y2: String(outerAxisPt.y),
        "stroke-width": String(AXIS_HIT_WIDTH),
        "data-step-id": axisState.stepId,
      });
      axisHitLayer.appendChild(axisHit);

      var handle = createSvgEl("circle", {
        class: "questionnaire-feelings-spider__handle",
        r: "5",
        tabindex: "0",
        role: "slider",
        "aria-valuemin": "1",
        "aria-valuemax": String(steps),
        "data-step-id": axisState.stepId,
      });
      var hit = createSvgEl("circle", {
        class: "questionnaire-feelings-spider__handle-hit",
        r: "14",
        tabindex: "-1",
        "data-step-id": axisState.stepId,
      });
      handleEls.push(handle);
      handleHitEls.push(hit);
      handlesLayer.appendChild(hit);
      handlesLayer.appendChild(handle);
    });

    svg.appendChild(gridLayer);
    svg.appendChild(axisHitLayer);
    svg.appendChild(dataLayer);
    svg.appendChild(handlesLayer);
    svg.appendChild(labelsLayer);
    container.appendChild(svg);

    var activeDrag = null;
    var dragDirty = false;

    function ariaLabelForAxis(axisState) {
      var scaleText =
        scaleLabels[axisState.step - 1] || String(axisState.step);
      return axisState.label + ": " + scaleText;
    }

    function syncAxisVisual(axisState, handleEl) {
      var dist = distanceFromStep(axisState.step, outerRadius, steps);
      var pt = pointOnAxis(axisState.index, count, dist);
      handleEl.setAttribute("cx", String(pt.x));
      handleEl.setAttribute("cy", String(pt.y));
      handleEl.setAttribute("aria-valuenow", String(axisState.step));
      handleEl.setAttribute("aria-label", ariaLabelForAxis(axisState));
    }

    function syncAllVisuals() {
      var points = [];
      state.forEach(function (axisState, idx) {
        syncAxisVisual(axisState, handleEls[idx]);
        var hitEl = handleHitEls[idx];
        hitEl.setAttribute("cx", handleEls[idx].getAttribute("cx"));
        hitEl.setAttribute("cy", handleEls[idx].getAttribute("cy"));
        points.push(
          handleEls[idx].getAttribute("cx") +
            "," +
            handleEls[idx].getAttribute("cy")
        );
      });
      polygonEl.setAttribute("points", points.join(" "));
    }

    function notifyChange() {
      if (onChange) onChange();
    }

    function commitAxisStep(axisState, nextStep, silent) {
      // Snapshot every axis so couplings can change more than the dragged one,
      // and so we only write/notify for axes that actually moved.
      var prevSteps = state.map(function (s) {
        return s.step;
      });
      axisState.step = clampFeelingsStepNumber(nextStep);
      applyCouplings();

      var changed = false;
      state.forEach(function (s, idx) {
        if (s.step !== prevSteps[idx]) {
          changed = true;
          if (setValue) {
            setValue(s.stepId, feelingsValueFromStep(s.step, s.min, s.max));
          }
        }
      });

      syncAllVisuals();
      if (changed) {
        if (silent) {
          dragDirty = true;
        } else {
          notifyChange();
        }
      }
    }

    function updateAxisFromPointer(axisState, clientX, clientY, silent) {
      var local = clientToSvg(svg, clientX, clientY);
      var angle = axisAngle(axisState.index, count);
      var dist = projectDistanceOnAxis(local.x, local.y, angle);
      if (dist < 0) dist = 0;
      if (dist > outerRadius) dist = outerRadius;
      var nextStep = stepFromDistance(dist, outerRadius, steps);
      commitAxisStep(axisState, nextStep, silent);
    }

    function detachDocumentDragListeners() {
      document.removeEventListener("pointermove", onDocumentPointerMove, true);
      document.removeEventListener("pointerup", onDocumentPointerUp, true);
      document.removeEventListener("pointercancel", onDocumentPointerUp, true);
    }

    function endDrag() {
      if (!activeDrag) return;
      var drag = activeDrag;
      activeDrag = null;
      detachDocumentDragListeners();
      if (drag.captureEl && drag.captureEl.releasePointerCapture) {
        try {
          drag.captureEl.releasePointerCapture(drag.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      updateAxisFromPointer(
        drag.axisState,
        drag.lastClientX,
        drag.lastClientY,
        true
      );
      if (dragDirty) {
        dragDirty = false;
        notifyChange();
      }
    }

    function onDocumentPointerMove(event) {
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
      event.preventDefault();
      activeDrag.lastClientX = event.clientX;
      activeDrag.lastClientY = event.clientY;
      updateAxisFromPointer(
        activeDrag.axisState,
        event.clientX,
        event.clientY,
        true
      );
    }

    function onDocumentPointerUp(event) {
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
      endDrag();
    }

    function startDrag(axisState, event, captureEl) {
      if (activeDrag) endDrag();
      activeDrag = {
        axisState: axisState,
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        captureEl: captureEl || event.currentTarget,
      };
      dragDirty = false;
      if (activeDrag.captureEl && activeDrag.captureEl.setPointerCapture) {
        try {
          activeDrag.captureEl.setPointerCapture(event.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      document.addEventListener("pointermove", onDocumentPointerMove, true);
      document.addEventListener("pointerup", onDocumentPointerUp, true);
      document.addEventListener("pointercancel", onDocumentPointerUp, true);
      updateAxisFromPointer(axisState, event.clientX, event.clientY, true);
      event.preventDefault();
      event.stopPropagation();
    }

    state.forEach(function (axisState, idx) {
      var handleEl = handleEls[idx];
      var hitEl = handleHitEls[idx];
      var axisHitEl = axisHitLayer.children[idx];

      function bindDrag(el) {
        el.addEventListener("pointerdown", function (event) {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          startDrag(axisState, event, el);
        });
      }

      bindDrag(handleEl);
      bindDrag(hitEl);
      bindDrag(axisHitEl);

      handleEl.addEventListener("keydown", function (event) {
        var delta = 0;
        if (event.key === "ArrowUp" || event.key === "ArrowRight") {
          delta = 1;
        } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
          delta = -1;
        } else {
          return;
        }
        event.preventDefault();
        commitAxisStep(axisState, axisState.step + delta, false);
      });
    });

    // Enforce couplings on the initial (possibly restored) values so the chart
    // never opens in an impossible state, persisting any bump without notifying.
    persistCoupledChanges();
    syncAllVisuals();

    return {
      destroy: function () {
        endDrag();
        if (container.contains(svg)) {
          container.removeChild(svg);
        }
      },
      refresh: function () {
        state.forEach(function (axisState) {
          var internal = getValue
            ? Number(getValue(axisState.stepId))
            : axisState.min;
          axisState.step = feelingsStepFromValue(
            internal,
            axisState.min,
            axisState.max
          );
        });
        persistCoupledChanges();
        syncAllVisuals();
      },
    };
  }

  window.FeelingsSpiderChart = {
    create: createFeelingsSpiderChart,
  };
})();

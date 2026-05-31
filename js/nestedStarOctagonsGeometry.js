(function (global) {
  "use strict";

  var CUT_RATIO = typeof NESTED_STAR_CUT_RATIO !== "undefined" ? NESTED_STAR_CUT_RATIO : 1 / (2 + Math.SQRT2);
  var INNER_STAR_MIN_T = typeof NESTED_STAR_INNER_STAR_MIN_T !== "undefined" ? NESTED_STAR_INNER_STAR_MIN_T : 6;

function roundCoord(v) {
          return Math.round(v * 10000) / 10000;
        }

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
         * Half octagon on all four edges. Slider n = complete octagons per row.
         * Horizontal: (n + 1) tile units span canvasW exactly, T = W / (n + 1).
         * Vertical: (m + 1) tile units span canvasH when H/T is integer; else ceil + center.
         * @param {number} n complete octagons per row (whole number)
         */
        function computeLayoutFromN(n, canvasW, canvasH) {
          var nComplete = Math.max(1, Math.round(n));
          var cols = nComplete + 1;
          var tileSize = canvasW / cols;
          var verticalUnits = canvasH / tileSize;
          var rows;
          var mComplete;
          var offsetY = 0;

          if (Math.abs(verticalUnits - Math.round(verticalUnits)) < 1e-9) {
            rows = Math.round(verticalUnits);
            mComplete = rows - 1;
          } else {
            rows = Math.max(1, Math.ceil(canvasH / tileSize));
            mComplete = Math.max(1, rows - 1);
            offsetY = (canvasH - rows * tileSize) / 2;
          }

          return {
            tileSize: tileSize,
            cols: cols,
            rows: rows,
            offsetY: offsetY,
            n: nComplete,
            m: mComplete,
          };
        }

        /**
         * Build outer octagram + inner star at cell size T (same logic as addDualStar).
         * @returns {{ outerOctagram: {x:number,y:number}[], innerOctagram: {x:number,y:number}[]|null, cx: number, cy: number }|null}
         */
        function buildCellStarGeometry(T) {
          var cut = T * CUT_RATIO;
          var cx = T / 2;
          var cy = T / 2;
          var half = (T - 2 * cut) / 2;
          var starScale = starScaleToOctagon(cx, cy, T, cut);
          half *= starScale;

          var aCorners = [
            { x: cx - half, y: cy - half },
            { x: cx + half, y: cy - half },
            { x: cx + half, y: cy + half },
            { x: cx - half, y: cy + half },
          ];
          var bCorners = [];
          var i;
          for (i = 0; i < 4; i++) {
            bCorners.push(
              rotatePoint(cx, cy, aCorners[i].x, aCorners[i].y, Math.PI / 4)
            );
          }
          var aEdges = [];
          var bEdges = [];
          for (i = 0; i < 4; i++) {
            aEdges.push({
              x1: aCorners[i].x,
              y1: aCorners[i].y,
              x2: aCorners[(i + 1) % 4].x,
              y2: aCorners[(i + 1) % 4].y,
            });
            bEdges.push({
              x1: bCorners[i].x,
              y1: bCorners[i].y,
              x2: bCorners[(i + 1) % 4].x,
              y2: bCorners[(i + 1) % 4].y,
            });
          }
          var intersections = computeSquareIntersections(aEdges, bEdges);
          if (intersections.length < 8) return null;
          var outerOctagram = buildOctagramOutline(
            aCorners,
            bCorners,
            intersections,
            cx,
            cy
          );
          if (outerOctagram.length < 16) return null;

          var innerApothem = Infinity;
          for (i = 0; i < intersections.length; i++) {
            var dx = Math.abs(intersections[i].x - cx);
            var dy = Math.abs(intersections[i].y - cy);
            innerApothem = Math.min(innerApothem, dx, dy);
          }
          if (!(half > 0) || !(innerApothem < Infinity)) return null;

          var k = innerApothem / half;
          var TInner = T * k * starScale;
          if (TInner < INNER_STAR_MIN_T) {
            return { outerOctagram: outerOctagram, innerOctagram: null, cx: cx, cy: cy };
          }

          var innerOctagram = buildLocalDualStarOctagram(cx, cy, TInner);
          return {
            outerOctagram: outerOctagram,
            innerOctagram: innerOctagram,
            cx: cx,
            cy: cy,
          };
        }

        function cellGeometryOk(T) {
          var geom = buildCellStarGeometry(T);
          if (!geom) return false;
          if (!geom.innerOctagram || geom.innerOctagram.length < 16) return false;
          return buildMiddleStarOutline(
            geom.outerOctagram,
            geom.innerOctagram,
            geom.cx,
            geom.cy
          ) !== null;
        }

        function buildValidLayouts(canvasW, canvasH) {
          var layouts = [];
          var maxN = Math.max(
            OCTAGONS_N_MIN,
            Math.floor(canvasW / NESTED_STAR_TILE_MIN) - 1
          );
          var n;
          for (n = OCTAGONS_N_MIN; n <= Math.min(OCTAGONS_N_MAX, maxN); n++) {
            var layout = computeLayoutFromN(n, canvasW, canvasH);
            if (layout.tileSize < NESTED_STAR_TILE_MIN - 1e-6) continue;
            if (!cellGeometryOk(layout.tileSize)) continue;
            layouts.push(layout);
          }
          return layouts;
        }

        function snapLayoutToN(requestedN, validLayouts, canvasW, canvasH) {
    if (!validLayouts || !validLayouts.length) {
            return computeLayoutFromN(Math.max(OCTAGONS_N_MIN, requestedN), canvasW, canvasH);
          }
          var best = validLayouts[0];
          var bestDist = Infinity;
          var i;
          for (i = 0; i < validLayouts.length; i++) {
            var d = Math.abs(validLayouts[i].n - requestedN);
            if (d < bestDist) {
              bestDist = d;
              best = validLayouts[i];
            }
          }
          return best;
        }

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

        function rotatePoint(cx, cy, px, py, angleRad) {
          var dx = px - cx;
          var dy = py - cy;
          var cosA = Math.cos(angleRad);
          var sinA = Math.sin(angleRad);
          return {
            x: roundCoord(cx + dx * cosA - dy * sinA),
            y: roundCoord(cy + dx * sinA + dy * cosA),
          };
        }

        function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
          var denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
          if (Math.abs(denom) < 1e-12) return null;
          var t =
            ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
          var u =
            -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
          if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) {
            return null;
          }
          return {
            x: roundCoord(x1 + t * (x2 - x1)),
            y: roundCoord(y1 + t * (y2 - y1)),
          };
        }

        function pointKey(x, y) {
          return roundCoord(x) + "," + roundCoord(y);
        }

        function addClosedPolygon(map, points) {
          var n = points.length;
          var i;
          for (i = 0; i < n; i++) {
            var a = points[i];
            var b = points[(i + 1) % n];
            addSegment(map, a.x, a.y, b.x, b.y);
          }
        }

        function closedPolygonPathD(points) {
          if (!points.length) return "";
          var d = "M " + points[0].x + " " + points[0].y;
          var i;
          for (i = 1; i < points.length; i++) {
            d += " L " + points[i].x + " " + points[i].y;
          }
          return d + " Z";
        }

        function pointAngle(cx, cy, p) {
          return Math.atan2(p.y - cy, p.x - cx);
        }

        function raySegmentHitDist(cx, cy, ux, uy, x1, y1, x2, y2) {
          var dx = x2 - x1;
          var dy = y2 - y1;
          var denom = ux * dy - uy * dx;
          if (Math.abs(denom) < 1e-12) return null;
          var qx = x1 - cx;
          var qy = y1 - cy;
          var t = (qx * dy - qy * dx) / denom;
          var v = (qx * uy - qy * ux) / denom;
          if (t < 1e-9) return null;
          if (v < -1e-9 || v > 1 + 1e-9) return null;
          return t;
        }

        /** Distance from center along ray to octagon edge (unit direction ux, uy). */
        function rayOctagonHitDistance(cx, cy, tipX, tipY, T, cut) {
          var dx = tipX - cx;
          var dy = tipY - cy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1e-12) return Infinity;
          var ux = dx / dist;
          var uy = dy / dist;
          var edges = getOctagonEdges(T, cut);
          var best = Infinity;
          var e;
          for (e = 0; e < edges.length; e++) {
            var edge = edges[e];
            var hit = raySegmentHitDist(
              cx,
              cy,
              ux,
              uy,
              edge.x1,
              edge.y1,
              edge.x2,
              edge.y2
            );
            if (hit !== null && hit < best) best = hit;
          }
          return best;
        }

        /**
         * Scale so all 8 star tips (square corners) meet the octagon outline.
         * @returns {number}
         */
        function starScaleToOctagon(cx, cy, T, cut) {
          var half = (T - 2 * cut) / 2;
          var aCorners = [
            { x: cx - half, y: cy - half },
            { x: cx + half, y: cy - half },
            { x: cx + half, y: cy + half },
            { x: cx - half, y: cy + half },
          ];
          var corners = aCorners.slice();
          var i;
          for (i = 0; i < 4; i++) {
            corners.push(
              rotatePoint(cx, cy, aCorners[i].x, aCorners[i].y, Math.PI / 4)
            );
          }
          var minScale = Infinity;
          var tipDist;
          var boundDist;
          for (i = 0; i < corners.length; i++) {
            tipDist = Math.hypot(corners[i].x - cx, corners[i].y - cy);
            boundDist = rayOctagonHitDistance(
              cx,
              cy,
              corners[i].x,
              corners[i].y,
              T,
              cut
            );
            if (boundDist < Infinity && tipDist > 1e-9) {
              minScale = Math.min(minScale, boundDist / tipDist);
            }
          }
          return minScale < Infinity ? minScale : 1;
        }

        function buildLocalDualStarOctagram(cx, cy, T) {
          var cut = T * CUT_RATIO;
          var half = (T - 2 * cut) / 2;
          var aCorners = [
            { x: cx - half, y: cy - half },
            { x: cx + half, y: cy - half },
            { x: cx + half, y: cy + half },
            { x: cx - half, y: cy + half },
          ];
          var bCorners = [];
          var i;
          for (i = 0; i < 4; i++) {
            bCorners.push(
              rotatePoint(cx, cy, aCorners[i].x, aCorners[i].y, Math.PI / 4)
            );
          }
          var aEdges = [];
          var bEdges = [];
          for (i = 0; i < 4; i++) {
            aEdges.push({
              x1: aCorners[i].x,
              y1: aCorners[i].y,
              x2: aCorners[(i + 1) % 4].x,
              y2: aCorners[(i + 1) % 4].y,
            });
            bEdges.push({
              x1: bCorners[i].x,
              y1: bCorners[i].y,
              x2: bCorners[(i + 1) % 4].x,
              y2: bCorners[(i + 1) % 4].y,
            });
          }
          var intersections = computeSquareIntersections(aEdges, bEdges);
          if (intersections.length < 8) return null;
          var octagram = buildOctagramOutline(
            aCorners,
            bCorners,
            intersections,
            cx,
            cy
          );
          return octagram.length >= 16 ? octagram : null;
        }

        /** Horizontal edges of the inner star outline (existing y, not recalculated). */
        function innerStarHorizontalEdges(octagram) {
          var edges = [];
          var n = octagram.length;
          var i;
          for (i = 0; i < n; i++) {
            var a = octagram[i];
            var b = octagram[(i + 1) % n];
            if (Math.abs(a.y - b.y) > 1e-6) continue;
            edges.push({
              y: a.y,
              leftX: Math.min(a.x, b.x),
              rightX: Math.max(a.x, b.x),
            });
          }
          return edges;
        }

        function horizontalSegmentIntersectionX(yLine, x1, y1, x2, y2) {
          if (Math.abs(y1 - y2) < 1e-12) return null;
          var t = (yLine - y1) / (y2 - y1);
          if (t < -1e-9 || t > 1 + 1e-9) return null;
          return roundCoord(x1 + t * (x2 - x1));
        }

        /**
         * Left/right inner concave x on the outer star at a fixed y (inner horizontal edge).
         * @param {{x:number,y:number}[]} outerOctagram
         * @param {number} yLine
         * @returns {{ leftX: number, rightX: number } | null}
         */
        function outerStarInnerConcaveXsAtY(outerOctagram, yLine) {
          var xs = [];
          var n = outerOctagram.length;
          var i;
          for (i = 0; i < n; i++) {
            if (Math.abs(outerOctagram[i].y - yLine) < 1e-6) {
              xs.push(outerOctagram[i].x);
            }
            var a = outerOctagram[i];
            var b = outerOctagram[(i + 1) % n];
            var xHit = horizontalSegmentIntersectionX(yLine, a.x, a.y, b.x, b.y);
            if (xHit !== null) xs.push(xHit);
          }
          if (xs.length < 2) return null;
          xs.sort(function (u, v) {
            return u - v;
          });
          if (xs.length >= 4) {
            return { leftX: xs[1], rightX: xs[2] };
          }
          return { leftX: xs[0], rightX: xs[1] };
        }

        function addStarHorizontalLines(map, ox, oy, outerOctagram, innerOctagram) {
          var horiz = innerStarHorizontalEdges(innerOctagram);
          var i;
          for (i = 0; i < horiz.length; i++) {
            var edge = horiz[i];
            var outerXs = outerStarInnerConcaveXsAtY(outerOctagram, edge.y);
            if (!outerXs) continue;
            addSegment(
              map,
              ox + outerXs.leftX,
              oy + edge.y,
              ox + outerXs.rightX,
              oy + edge.y
            );
          }
        }

        function computeSquareIntersections(aEdges, bEdges) {
          var hitMap = new Map();
          var ai;
          var bi;
          for (ai = 0; ai < 4; ai++) {
            for (bi = 0; bi < 4; bi++) {
              var ea = aEdges[ai];
              var eb = bEdges[bi];
              var pt = lineIntersection(
                ea.x1,
                ea.y1,
                ea.x2,
                ea.y2,
                eb.x1,
                eb.y1,
                eb.x2,
                eb.y2
              );
              if (!pt) continue;
              var pk = pointKey(pt.x, pt.y);
              if (!hitMap.has(pk)) {
                hitMap.set(pk, { x: pt.x, y: pt.y });
              }
            }
          }
          return Array.from(hitMap.values());
        }

        /**
         * Single 16-vertex outline of two overlapping squares (8 outer tips + 8 inner
         * corners at edge crossings). No internal crossing lines.
         */
        function buildOctagramOutline(aCorners, bCorners, intersections, cx, cy) {
          var corners = aCorners.concat(bCorners);
          var taggedCorners = [];
          var i;
          for (i = 0; i < corners.length; i++) {
            taggedCorners.push({
              x: corners[i].x,
              y: corners[i].y,
              a: pointAngle(cx, cy, corners[i]),
            });
          }
          taggedCorners.sort(function (u, v) {
            return u.a - v.a;
          });

          var taggedIx = [];
          for (i = 0; i < intersections.length; i++) {
            taggedIx.push({
              x: intersections[i].x,
              y: intersections[i].y,
              a: pointAngle(cx, cy, intersections[i]),
            });
          }

          var out = [];
          var k;
          for (i = 0; i < taggedCorners.length; i++) {
            out.push({ x: taggedCorners[i].x, y: taggedCorners[i].y });
            var a0 = taggedCorners[i].a;
            var a1 = taggedCorners[(i + 1) % taggedCorners.length].a;
            var useWrap = i === taggedCorners.length - 1;
            var best = null;
            var bestA = Infinity;
            for (k = 0; k < taggedIx.length; k++) {
              var aTest = taggedIx[k].a;
              if (useWrap && aTest < a0) {
                aTest += Math.PI * 2;
              }
              var aEnd = useWrap ? taggedCorners[0].a + Math.PI * 2 : a1;
              if (aTest > a0 + 1e-9 && aTest < aEnd - 1e-9 && aTest < bestA) {
                bestA = aTest;
                best = taggedIx[k];
              }
            }
            if (best) {
              out.push({ x: best.x, y: best.y });
            }
          }
          return out;
        }

        function worldPoints(ox, oy, localPoints) {
          var out = [];
          var i;
          for (i = 0; i < localPoints.length; i++) {
            out.push({
              x: roundCoord(ox + localPoints[i].x),
              y: roundCoord(oy + localPoints[i].y),
            });
          }
          return out;
        }

        /** Octagram outline alternates tip (even index) and inner concave (odd index). */
        function octagramTips(octagram) {
          var tips = [];
          var i;
          for (i = 0; i < octagram.length; i += 2) {
            tips.push(octagram[i]);
          }
          return tips;
        }

        function octagramConcaves(octagram) {
          var concaves = [];
          var i;
          for (i = 1; i < octagram.length; i += 2) {
            concaves.push(octagram[i]);
          }
          return concaves;
        }

        function angleDiffRad(a, b) {
          var d = a - b;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          return Math.abs(d);
        }

        /** Match inner tips to outer tips (same arm); do not angle-sort concaves alone. */
        function octagramTipPhaseOffset(outerTips, innerTips, cx, cy) {
          var bestK = 0;
          var bestSum = Infinity;
          var k;
          var i;
          var sum;
          var aOut;
          var aIn;
          for (k = 0; k < 8; k++) {
            sum = 0;
            for (i = 0; i < 8; i++) {
              aOut = pointAngle(cx, cy, outerTips[i]);
              aIn = pointAngle(cx, cy, innerTips[(i + k) % 8]);
              sum += angleDiffRad(aOut, aIn);
            }
            if (sum < bestSum) {
              bestSum = sum;
              bestK = k;
            }
          }
          return bestK;
        }

        /**
         * Middle 8-point star: outer tips = outer star concaves; inner corners = inner star tips.
         * Polygon walks CCW: inner tip then its outer concave (not concave→tip — that self-crosses).
         * @returns {{x:number,y:number}[]|null} 16 vertices, closed polygon
         */
        function buildMiddleStarOutline(outerOctagram, innerOctagram, cx, cy) {
          if (outerOctagram.length < 16 || innerOctagram.length < 16) return null;
          var outerConcaves = octagramConcaves(outerOctagram);
          var outerTips = octagramTips(outerOctagram);
          var innerTips = octagramTips(innerOctagram);
          if (
            outerConcaves.length !== 8 ||
            outerTips.length !== 8 ||
            innerTips.length !== 8
          ) {
            return null;
          }
          var phase = octagramTipPhaseOffset(outerTips, innerTips, cx, cy);
          var entries = [];
          var i;
          for (i = 0; i < 8; i++) {
            entries.push(innerTips[(i + phase) % 8]);
            entries.push(outerConcaves[i]);
          }
          entries.sort(function (a, b) {
            return pointAngle(cx, cy, a) - pointAngle(cx, cy, b);
          });
          return entries;
        }

        function addMiddleStar(map, ox, oy, outerOctagram, innerOctagram, cx, cy) {
          var outline = buildMiddleStarOutline(
            outerOctagram,
            innerOctagram,
            cx,
            cy
          );
          if (!outline) return;
          addClosedPolygon(map, worldPoints(ox, oy, outline));
        }

        /**
         * Dual-square 8-point star + inner octagon; optionally recurse for inner star.
         * @param {Map} map
         * @param {{points:{x:number,y:number}[]}[]} starFills
         * @param {number} ox world offset
         * @param {number} oy world offset
         * @param {number} cx local center x
         * @param {number} cy local center y
         * @param {number} T local tile size for this nesting level
         * @param {boolean} recurse draw outer star lines + nested inner star fill
         */
        function addDualStar(map, starFills, ox, oy, cx, cy, T, recurse) {
          var cut = T * CUT_RATIO;
          var half = (T - 2 * cut) / 2;
          var starScale = 1;
          if (recurse) {
            starScale = starScaleToOctagon(cx, cy, T, cut);
            half *= starScale;
          }

          var aCorners = [
            { x: cx - half, y: cy - half },
            { x: cx + half, y: cy - half },
            { x: cx + half, y: cy + half },
            { x: cx - half, y: cy + half },
          ];

          var bCorners = [];
          var i;
          for (i = 0; i < 4; i++) {
            var r = rotatePoint(cx, cy, aCorners[i].x, aCorners[i].y, Math.PI / 4);
            bCorners.push(r);
          }

          var aEdges = [];
          var bEdges = [];
          for (i = 0; i < 4; i++) {
            aEdges.push({
              x1: aCorners[i].x,
              y1: aCorners[i].y,
              x2: aCorners[(i + 1) % 4].x,
              y2: aCorners[(i + 1) % 4].y,
            });
            bEdges.push({
              x1: bCorners[i].x,
              y1: bCorners[i].y,
              x2: bCorners[(i + 1) % 4].x,
              y2: bCorners[(i + 1) % 4].y,
            });
          }

          var intersections = computeSquareIntersections(aEdges, bEdges);
          if (intersections.length < 8) return;

          var octagram = buildOctagramOutline(
            aCorners,
            bCorners,
            intersections,
            cx,
            cy
          );
          if (octagram.length < 16) return;

          var worldOctagram = worldPoints(ox, oy, octagram);

          if (!recurse) {
            starFills.push({ outline: worldOctagram });
            return;
          }

          addClosedPolygon(map, worldOctagram);

          var innerApothem = Infinity;
          for (i = 0; i < intersections.length; i++) {
            var dx = Math.abs(intersections[i].x - cx);
            var dy = Math.abs(intersections[i].y - cy);
            innerApothem = Math.min(innerApothem, dx, dy);
          }

          if (!(half > 0) || !(innerApothem < Infinity)) return;

          var k = innerApothem / half;
          var TInner = T * k * starScale;
          if (TInner < INNER_STAR_MIN_T) return;

          var innerOctagram = buildLocalDualStarOctagram(cx, cy, TInner);
          if (innerOctagram) {
            addStarHorizontalLines(map, ox, oy, octagram, innerOctagram);
            addMiddleStar(map, ox, oy, octagram, innerOctagram, cx, cy);
          }

          addDualStar(map, starFills, ox, oy, cx, cy, TInner, false);
        }

        function addUnitCell(map, starFills, ox, oy, T) {
          var cut = T * CUT_RATIO;
          var cx = T / 2;
          var cy = T / 2;
          var edges = getOctagonEdges(T, cut);
          var e;

          for (e = 0; e < edges.length; e++) {
            var edge = edges[e];
            addSegment(
              map,
              ox + edge.x1,
              oy + edge.y1,
              ox + edge.x2,
              oy + edge.y2
            );
          }

          addDualStar(map, starFills, ox, oy, cx, cy, T, true);
        }

        /** Rotated 45° connector square at octagon junction (no upright square). */
        function addJunctionDiamond(map, cx, cy, T) {
          var cut = T * CUT_RATIO;
          var h = cut;
          addSegment(map, cx, cy - h, cx + h, cy);
          addSegment(map, cx + h, cy, cx, cy + h);
          addSegment(map, cx, cy + h, cx - h, cy);
          addSegment(map, cx - h, cy, cx, cy - h);
        }

        function buildPattern(layout) {
          var T = layout.tileSize;
          var map = new Map();
          var starFills = [];
          var row;
          var col;

          for (row = 0; row < layout.rows; row++) {
            for (col = 0; col < layout.cols; col++) {
              addUnitCell(
                map,
                starFills,
                col * T,
                layout.offsetY + row * T,
                T
              );
            }
          }

          for (row = 0; row <= layout.rows; row++) {
            for (col = 0; col <= layout.cols; col++) {
              addJunctionDiamond(map, col * T, layout.offsetY + row * T, T);
            }
          }

          return {
            segments: Array.from(map.values()),
            starFills: starFills,
          };
        }

        /**
         * Horizontal centers of junction diamonds (rotated connector between octagons).
         * One X per grid column junction line, col * tileSize.
         * @param {{ tileSize: number, cols: number }} layout
         * @returns {number[]}
         */
        function collectJunctionDiamondCenterXCoords(layout) {
          var T = layout.tileSize;
          var cols = layout.cols;
          var xs = [];
          var col;
          for (col = 0; col <= cols; col++) {
            xs.push(roundCoord(col * T));
          }
          return xs;
        }

        /**
         * Horizontal center of each octagon unit cell (inner nested star center).
         * Midpoint between adjacent junction columns: (col + 0.5) * tileSize.
         * @param {{ tileSize: number, cols: number }} layout
         * @returns {number[]}
         */
        function collectInnerStarCenterXCoords(layout) {
          var T = layout.tileSize;
          var cols = layout.cols;
          var xs = [];
          var col;
          for (col = 0; col < cols; col++) {
            xs.push(roundCoord((col + 0.5) * T));
          }
          return xs;
        }

        /**
         * @param {number[][]} lists
         * @returns {number[]}
         */
        function mergeUniqueSortedXCoords(lists) {
          var byKey = new Map();
          var out = [];
          var li;
          var i;
          var x;
          var key;
          for (li = 0; li < lists.length; li++) {
            for (i = 0; i < lists[li].length; i++) {
              x = lists[li][i];
              key = roundCoord(x);
              if (!byKey.has(key)) {
                byKey.set(key, x);
                out.push(x);
              }
            }
          }
          out.sort(function (a, b) {
            return a - b;
          });
          return out;
        }

        /**
         * One X midway between each pair of consecutive sorted anchors.
         * @param {number[]} sortedXs ascending
         * @returns {number[]}
         */
        function collectMidpointXCoordsBetweenSorted(sortedXs) {
          var mids = [];
          var i;
          for (i = 0; i < sortedXs.length - 1; i++) {
            mids.push(roundCoord((sortedXs[i] + sortedXs[i + 1]) / 2));
          }
          return mids;
        }

        /**
         * Anger vertical anchors: junction diamonds, inner star centers,
         * plus one midpoint X between every adjacent pair of those lines.
         * @param {{ tileSize: number, cols: number }} layout
         * @returns {number[]}
         */
        function collectStarGridVerticalAnchorXCoords(layout) {
          var junction = collectJunctionDiamondCenterXCoords(layout);
          var inner = collectInnerStarCenterXCoords(layout);
          var base = mergeUniqueSortedXCoords([junction, inner]);
          var between = collectMidpointXCoordsBetweenSorted(base);
          return mergeUniqueSortedXCoords([base, between]);
        }

        /**
         * Rotated junction diamonds between octagons (Pain layer catalog).
         * Only diamonds that intersect the canvas are included.
         * @param {{ tileSize: number, cols: number, rows: number, offsetY: number }} layout
         * @param {number} canvasW
         * @param {number} canvasH
         * @returns {{ id: string, points: { x: number, y: number }[] }[]}
         */
        function buildJunctionDiamondCatalog(layout, canvasW, canvasH) {
          var T = layout.tileSize;
          var cut = T * CUT_RATIO;
          var h = cut;
          var catalog = [];
          var row;
          var col;
          var cx;
          var cy;

          for (row = 0; row <= layout.rows; row++) {
            for (col = 0; col <= layout.cols; col++) {
              cx = col * T;
              cy = layout.offsetY + row * T;
              if (
                cx + h <= 0 ||
                cx - h >= canvasW ||
                cy + h <= 0 ||
                cy - h >= canvasH
              ) {
                continue;
              }
              catalog.push({
                id: "star-dm-" + col + "-" + row,
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
         * Sadness circles: center of each junction diamond, inscribed radius
         * matches octagon-grid upright-square catalog (cut·√2 / 2).
         * @param {{ tileSize: number, cols: number, rows: number, offsetY: number }} layout
         * @param {number} canvasW
         * @param {number} canvasH
         * @returns {{ id: string, cx: number, cy: number, r: number }[]}
         */
        function buildJunctionCircleCatalog(layout, canvasW, canvasH) {
          var T = layout.tileSize;
          var cut = T * CUT_RATIO;
          var h = cut;
          var r = (cut * Math.SQRT2) / 2;
          var catalog = [];
          var row;
          var col;
          var cx;
          var cy;

          for (row = 0; row <= layout.rows; row++) {
            for (col = 0; col <= layout.cols; col++) {
              cx = col * T;
              cy = layout.offsetY + row * T;
              if (
                cx + h <= 0 ||
                cx - h >= canvasW ||
                cy + h <= 0 ||
                cy - h >= canvasH
              ) {
                continue;
              }
              catalog.push({
                id: "star-sq-" + col + "-" + row,
                cx: cx,
                cy: cy,
                r: r,
              });
            }
          }

          return catalog;
        }

        /**
         * Helplessness X marks on star grid: diagonal crossings between adjacent octagons
         * (not junction diamonds). H-mid = between two vertically stacked octagons;
         * V-mid = between two horizontally adjacent octagons. X half-extent = cut / 2.
         * @param {{ tileSize: number, cols: number, rows: number, offsetY: number }} layout
         * @param {number} canvasW
         * @param {number} canvasH
         * @returns {{ id: string, cx: number, cy: number, halfW: number, halfH: number }[]}
         */
        function buildHelplessnessJunctionCatalog(layout, canvasW, canvasH) {
          var T = layout.tileSize;
          var cut = T * CUT_RATIO;
          var halfExtent = cut / 2;
          var margin = halfExtent;
          var catalog = [];
          var row;
          var col;
          var cx;
          var cy;

          for (row = 0; row <= layout.rows; row++) {
            for (col = 0; col < layout.cols; col++) {
              cx = (col + 0.5) * T;
              cy = layout.offsetY + row * T;
              if (
                cx + margin <= 0 ||
                cx - margin >= canvasW ||
                cy + margin <= 0 ||
                cy - margin >= canvasH
              ) {
                continue;
              }
              catalog.push({
                id: "star-hp-h-" + col + "-" + row,
                cx: cx,
                cy: cy,
                halfW: halfExtent,
                halfH: halfExtent,
              });
            }
          }

          for (row = 0; row < layout.rows; row++) {
            for (col = 0; col <= layout.cols; col++) {
              cx = col * T;
              cy = layout.offsetY + (row + 0.5) * T;
              if (
                cx + margin <= 0 ||
                cx - margin >= canvasW ||
                cy + margin <= 0 ||
                cy - margin >= canvasH
              ) {
                continue;
              }
              catalog.push({
                id: "star-hp-v-" + col + "-" + row,
                cx: cx,
                cy: cy,
                halfW: halfExtent,
                halfH: halfExtent,
              });
            }
          }

          return catalog;
        }

  global.NestedStarOctagonsGeometry = {
    computeLayoutFromN: computeLayoutFromN,
    buildValidLayouts: buildValidLayouts,
    snapLayoutToN: snapLayoutToN,
    buildPattern: buildPattern,
    closedPolygonPathD: closedPolygonPathD,
    roundCoord: roundCoord,
    collectJunctionDiamondCenterXCoords: collectJunctionDiamondCenterXCoords,
    collectInnerStarCenterXCoords: collectInnerStarCenterXCoords,
    collectStarGridVerticalAnchorXCoords: collectStarGridVerticalAnchorXCoords,
    buildJunctionDiamondCatalog: buildJunctionDiamondCatalog,
    buildJunctionCircleCatalog: buildJunctionCircleCatalog,
    buildHelplessnessJunctionCatalog: buildHelplessnessJunctionCatalog,
  };
})(typeof window !== "undefined" ? window : this);

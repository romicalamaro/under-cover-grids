/**
 * Floyd–Steinberg stipple generation (shared by stipple.html and main grid app).
 */
(function (global) {
  "use strict";

  var MAX_PIXELS = 16000000;
  var ROWS_PER_FRAME = 4;

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function scaleSourceToCanvas(sourceImage, outW, outH) {
    var off = document.createElement("canvas");
    off.width = outW;
    off.height = outH;
    var ctx = off.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(sourceImage, 0, 0, outW, outH);
    return ctx.getImageData(0, 0, outW, outH);
  }

  function sampleGrid(imageData, pitch, gridCols, gridRows) {
    var data = imageData.data;
    var imgW = imageData.width;
    var imgH = imageData.height;
    var n = gridCols * gridRows;
    var r = new Float32Array(n);
    var g = new Float32Array(n);
    var b = new Float32Array(n);
    var lum = new Float32Array(n);

    for (var gy = 0; gy < gridRows; gy++) {
      var y0 = gy * pitch;
      var y1 = Math.min(imgH, y0 + pitch);
      for (var gx = 0; gx < gridCols; gx++) {
        var x0 = gx * pitch;
        var x1 = Math.min(imgW, x0 + pitch);
        var sumR = 0;
        var sumG = 0;
        var sumB = 0;
        var count = 0;
        for (var py = y0; py < y1; py++) {
          var rowOff = py * imgW * 4;
          for (var px = x0; px < x1; px++) {
            var i = rowOff + px * 4;
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
            count++;
          }
        }
        if (count === 0) count = 1;
        var idx = gy * gridCols + gx;
        var avgR = sumR / count;
        var avgG = sumG / count;
        var avgB = sumB / count;
        r[idx] = avgR;
        g[idx] = avgG;
        b[idx] = avgB;
        lum[idx] = luminance(avgR, avgG, avgB);
      }
    }

    return { r: r, g: g, b: b, lum: lum };
  }

  function distributeError(errBuf, gridCols, gridRows, x, y, errVal) {
    var w7 = (errVal * 7) / 16;
    var w3 = (errVal * 3) / 16;
    var w5 = (errVal * 5) / 16;
    var w1 = (errVal * 1) / 16;
    var idx;

    if (x + 1 < gridCols) {
      idx = y * gridCols + (x + 1);
      errBuf[idx] += w7;
    }
    if (y + 1 < gridRows) {
      if (x - 1 >= 0) {
        idx = (y + 1) * gridCols + (x - 1);
        errBuf[idx] += w3;
      }
      idx = (y + 1) * gridCols + x;
      errBuf[idx] += w5;
      if (x + 1 < gridCols) {
        idx = (y + 1) * gridCols + (x + 1);
        errBuf[idx] += w1;
      }
    }
  }

  function processRowBw(y, gridCols, gridRows, lum, errLum, place, threshold) {
    for (var x = 0; x < gridCols; x++) {
      var i = y * gridCols + x;
      var old = lum[i] + errLum[i];
      var newVal = old >= threshold ? 255 : 0;
      errLum[i] = old - newVal;
      place[i] = newVal === 255 ? 1 : 0;
      distributeError(errLum, gridCols, gridRows, x, y, errLum[i]);
    }
  }

  function processRowColor(
    y,
    gridCols,
    gridRows,
    r,
    g,
    b,
    errR,
    errG,
    errB,
    place,
    threshold
  ) {
    for (var x = 0; x < gridCols; x++) {
      var i = y * gridCols + x;
      var oldR = r[i] + errR[i];
      var oldG = g[i] + errG[i];
      var oldB = b[i] + errB[i];
      var avgOld = (oldR + oldG + oldB) / 3;

      var newR = oldR >= threshold ? 255 : 0;
      var newG = oldG >= threshold ? 255 : 0;
      var newB = oldB >= threshold ? 255 : 0;

      errR[i] = oldR - newR;
      errG[i] = oldG - newG;
      errB[i] = oldB - newB;

      place[i] = avgOld >= threshold ? 1 : 0;

      distributeError(errR, gridCols, gridRows, x, y, errR[i]);
      distributeError(errG, gridCols, gridRows, x, y, errG[i]);
      distributeError(errB, gridCols, gridRows, x, y, errB[i]);
    }
  }

  /**
   * @param {number} y
   * @param {number} gridCols
   * @param {number} pitch
   * @param {number} dotRadius
   * @param {Uint8Array} place
   * @param {{ r: Float32Array, g: Float32Array, b: Float32Array }} samples
   * @param {boolean} isColor
   * @param {number} outW
   * @param {number} outH
   * @param {{ cx: number, cy: number, r: number, fill: string }[]} dotsOut
   */
  function collectRowDots(
    y,
    gridCols,
    pitch,
    dotRadius,
    place,
    samples,
    isColor,
    outW,
    outH,
    dotsOut
  ) {
    for (var x = 0; x < gridCols; x++) {
      var i = y * gridCols + x;
      if (!place[i]) continue;

      var cx = x * pitch + pitch / 2;
      var cy = y * pitch + pitch / 2;
      if (cx >= outW || cy >= outH) continue;

      var fill;
      if (isColor) {
        fill =
          "rgb(" +
          Math.round(samples.r[i]) +
          "," +
          Math.round(samples.g[i]) +
          "," +
          Math.round(samples.b[i]) +
          ")";
      } else {
        fill = "#000000";
      }

      dotsOut.push({ cx: cx, cy: cy, r: dotRadius, fill: fill });
    }
  }

  /**
   * @param {{
   *   sourceImage: HTMLImageElement,
   *   outW: number,
   *   outH: number,
   *   dotSize: number,
   *   dotSpacing: number,
   *   colorMode: string,
   *   jobId: number
   * }} options
   * @param {{ onProgress?: function(number, number), onComplete?: function(Object), onCancel?: function() }} callbacks
   * @returns {boolean} false if validation failed
   */
  function generate(options, callbacks) {
    callbacks = callbacks || {};
    var sourceImage = options.sourceImage;
    var outW = options.outW;
    var outH = options.outH;
    var dotSize = options.dotSize;
    var dotSpacing = options.dotSpacing;
    var colorMode = options.colorMode;
    var jobId = options.jobId;

    if (!sourceImage) return false;

    if (outW * outH > MAX_PIXELS) {
      if (callbacks.onError) {
        callbacks.onError(
          "Output is too large (" +
            outW +
            "×" +
            outH +
            " = " +
            (outW * outH).toLocaleString() +
            " pixels). Lower the resolution slider and try again."
        );
      }
      return false;
    }

    var pitch = Math.max(1, dotSize + dotSpacing);
    var dotRadius = dotSize / 2;
    var gridCols = Math.ceil(outW / pitch);
    var gridRows = Math.ceil(outH / pitch);
    var isColor = colorMode === "color";

    var imageData = scaleSourceToCanvas(sourceImage, outW, outH);
    var samples = sampleGrid(imageData, pitch, gridCols, gridRows);
    var n = gridCols * gridRows;
    var place = new Uint8Array(n);
    var errLum = new Float32Array(n);
    var errR = new Float32Array(n);
    var errG = new Float32Array(n);
    var errB = new Float32Array(n);
    var threshold = 128;
    var dots = [];
    var y0 = 0;

    function frame() {
      if (options.getJobId && options.getJobId() !== jobId) {
        if (callbacks.onCancel) callbacks.onCancel();
        return;
      }

      var y1 = Math.min(gridRows, y0 + ROWS_PER_FRAME);
      for (var y = y0; y < y1; y++) {
        if (isColor) {
          processRowColor(
            y,
            gridCols,
            gridRows,
            samples.r,
            samples.g,
            samples.b,
            errR,
            errG,
            errB,
            place,
            threshold
          );
        } else {
          processRowBw(
            y,
            gridCols,
            gridRows,
            samples.lum,
            errLum,
            place,
            threshold
          );
        }
        collectRowDots(
          y,
          gridCols,
          pitch,
          dotRadius,
          place,
          samples,
          isColor,
          outW,
          outH,
          dots
        );
      }

      y0 = y1;
      if (callbacks.onProgress) callbacks.onProgress(y0, gridRows);

      if (y0 < gridRows) {
        requestAnimationFrame(frame);
      } else {
        if (options.getJobId && options.getJobId() !== jobId) {
          if (callbacks.onCancel) callbacks.onCancel();
          return;
        }
        if (callbacks.onComplete) {
          callbacks.onComplete({
            dots: dots,
            outW: outW,
            outH: outH,
            jobId: jobId,
          });
        }
      }
    }

    requestAnimationFrame(frame);
    return true;
  }

  global.StippleEngine = {
    MAX_PIXELS: MAX_PIXELS,
    generate: generate,
  };
})(typeof window !== "undefined" ? window : this);

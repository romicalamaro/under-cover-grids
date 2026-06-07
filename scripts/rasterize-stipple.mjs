/**
 * Rasterizer: SVG stipple → PNG at canvas width (68cm @ 300 DPI = 803px).
 * Usage: node scripts/rasterize-stipple.mjs [input.svg] [output.png]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const CANVAS_W = 803;
const CANVAS_H = 2126;

const inputSvg = resolve(root, process.argv[2] || "stipple-1780673179311.svg");
const outputPng = resolve(root, process.argv[3] || "stipple-1780673179311.png");

const svgText = readFileSync(inputSvg, "utf8");
const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/i);
const viewBox = viewBoxMatch ? viewBoxMatch[1] : `0 0 ${CANVAS_W} ${CANVAS_H}`;
const vbParts = viewBox.trim().split(/[\s,]+/).map(Number);
const vbW = vbParts[2] > 0 ? vbParts[2] : CANVAS_W;
const vbH = vbParts[3] > 0 ? vbParts[3] : CANVAS_H;
const scale = Math.min(CANVAS_W / vbW, CANVAS_H / vbH);
const drawW = vbW * scale;
const drawH = vbH * scale;
const offsetX = (CANVAS_W - drawW) / 2;
const offsetY = (CANVAS_H - drawH) / 2;
const innerMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
const inner = innerMatch ? innerMatch[1] : svgText;

// Bake uniform-scale stipple onto a full canvas bitmap (opaque white letterbox).
const wrappedSvg =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">` +
  `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#ffffff"/>` +
  `<svg x="${offsetX}" y="${offsetY}" width="${drawW}" height="${drawH}" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="none">` +
  inner +
  "</svg></svg>";

const resvg = new Resvg(wrappedSvg, {
  fitTo: { mode: "width", value: CANVAS_W },
  background: "white",
});
const rendered = resvg.render();
const pngData = rendered.asPng();

writeFileSync(outputPng, pngData);
console.log("Wrote", outputPng, `(${CANVAS_W}×${CANVAS_H}, uniform stipple ${drawW.toFixed(1)}×${drawH.toFixed(1)})`);

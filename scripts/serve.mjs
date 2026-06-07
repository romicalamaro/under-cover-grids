/**
 * Dev server: static files + Google Sheet CSV proxy for Palette 8 live sync.
 * file:// cannot fetch Google CSV directly; the proxy works from any page origin.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8080);
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yMwNB7MopTJWDEH328VF0WiU2XXdPu5Cfs0I1YDyeDQ/export?format=csv&gid=790839210";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

async function proxyGoogleSheetCsv(req, res) {
  const query = new URL(req.url || "/", "http://127.0.0.1").searchParams;
  const callback = query.get("callback");
  const jsonp =
    callback && /^[A-Za-z_$][\w$]*$/.test(callback) ? callback : null;
  try {
    const url = SHEET_CSV_URL + "&_=" + Date.now();
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      const errBody = "Upstream CSV failed";
      if (jsonp) {
        send(res, upstream.status, jsonp + "(" + JSON.stringify(errBody) + ");", {
          "Content-Type": "application/javascript; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        return;
      }
      send(res, upstream.status, errBody, {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      return;
    }
    const text = await upstream.text();
    if (jsonp) {
      send(res, 200, jsonp + "(" + JSON.stringify(text) + ");", {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      });
      return;
    }
    send(res, 200, text, {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    });
  } catch (err) {
    const errBody = String(err && err.message ? err.message : err);
    if (jsonp) {
      send(res, 502, jsonp + "(" + JSON.stringify(errBody) + ");", {
        "Content-Type": "application/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      return;
    }
    send(res, 502, errBody, {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
  }
}

function serveStatic(req, res) {
  const safePath = decodeURIComponent(req.url.split("?")[0]);
  const rel = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.resolve(ROOT, "." + rel);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain" });
    return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) {
      send(res, 404, "Not found", { "Content-Type": "text/plain" });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" || ext === ".js" ? "no-cache" : "public, max-age=60",
    });
  });
}

const server = http.createServer(function (req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, "", {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return;
  }
  if (req.url && req.url.split("?")[0] === "/api/google-sheet-palette.csv") {
    proxyGoogleSheetCsv(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, function () {
  console.log("UNDER.COVER dev server: http://127.0.0.1:" + PORT);
  console.log("Palette CSV proxy: http://127.0.0.1:" + PORT + "/api/google-sheet-palette.csv");
});

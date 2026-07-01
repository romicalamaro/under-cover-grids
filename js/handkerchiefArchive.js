(function () {
  "use strict";

  var LEGACY_STORAGE_KEY = "undercover.handkerchiefArchive";
  var DB_NAME = "undercover.handkerchiefArchive";
  var DB_VERSION = 1;
  var STORE_NAME = "entries";

  /** Fixed thumbnail width — sharp on archive cards (~240px card × 2 DPR). */
  var ARCHIVE_THUMB_STORAGE_WIDTH = 480;
  var ARCHIVE_WEBP_QUALITY = 0.92;
  var ARCHIVE_JPEG_QUALITY = 0.93;

  var dbPromise = null;
  var activeObjectUrls = [];

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not available"));
        return;
      }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = function (event) {
        resolve(event.target.result);
      };
      request.onerror = function () {
        reject(request.error || new Error("Could not open archive storage"));
      };
    });
    return dbPromise;
  }

  function rejectIfQuota(err, reject) {
    if (err && err.name === "QuotaExceededError") {
      reject(new Error("Archive storage is full"));
      return true;
    }
    return false;
  }

  function getAllEntries() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readonly");
        var store = tx.objectStore(STORE_NAME);
        var request = store.getAll();
        request.onsuccess = function () {
          var entries = request.result || [];
          entries.sort(function (a, b) {
            return String(a.savedAt || "").localeCompare(String(b.savedAt || ""));
          });
          resolve(entries);
        };
        request.onerror = function () {
          reject(request.error || new Error("Could not read archive"));
        };
      });
    });
  }

  function putEntry(entry) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        var store = tx.objectStore(STORE_NAME);
        store.put(entry);
        tx.oncomplete = function () {
          resolve(entry);
        };
        tx.onerror = function () {
          var err = tx.error || new Error("Could not save to archive");
          if (!rejectIfQuota(err, reject)) {
            reject(err);
          }
        };
        tx.onabort = function () {
          var err = tx.error || new Error("Could not save to archive");
          if (!rejectIfQuota(err, reject)) {
            reject(err);
          }
        };
      });
    });
  }

  function getEntryTitle() {
    return getEntryProfile().name;
  }

  function getEntryProfile() {
    var profile = {
      name: "",
      age: "",
      nowIn: "",
    };

    if (window.Questionnaire) {
      if (typeof window.Questionnaire.getNameLabelText === "function") {
        profile.name = String(window.Questionnaire.getNameLabelText() || "").trim();
      }
      if (typeof window.Questionnaire.getAnswers === "function") {
        var answers = window.Questionnaire.getAnswers();
        profile.age = String(answers.age || "").trim();
        profile.nowIn = String(answers.nowIn || "").trim();
      }
    }

    if (!profile.name) profile.name = "Untitled";

    return profile;
  }

  function getArchiveCardLineParts(entry) {
    var profile = entry && entry.profile;
    var name = profile && profile.name ? profile.name : entry && entry.title;
    var row = profile ? { age: profile.age, nowIn: profile.nowIn } : null;

    if (
      window.ProductComboSpec &&
      typeof window.ProductComboSpec.getShopCardLineParts === "function"
    ) {
      return window.ProductComboSpec.getShopCardLineParts(name, row);
    }

    return name ? [String(name).trim()] : ["Untitled"];
  }

  function renderArchiveCardTitle(titleEl, entry) {
    var parts = getArchiveCardLineParts(entry);

    if (
      window.ProductComboSpec &&
      typeof window.ProductComboSpec.renderShopCardName === "function"
    ) {
      window.ProductComboSpec.renderShopCardName(titleEl, parts);
      return;
    }

    titleEl.textContent = parts.length ? parts.join(", ") : "Untitled";
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error("Could not encode archive thumbnail"));
            return;
          }
          resolve(blob);
        },
        type,
        quality
      );
    });
  }

  function encodeThumbBlob(canvas) {
    return canvasToBlob(canvas, "image/webp", ARCHIVE_WEBP_QUALITY)
      .then(function (blob) {
        return { blob: blob, mimeType: blob.type || "image/webp" };
      })
      .catch(function () {
        return canvasToBlob(canvas, "image/jpeg", ARCHIVE_JPEG_QUALITY).then(
          function (blob) {
            return { blob: blob, mimeType: blob.type || "image/jpeg" };
          }
        );
      });
  }

  function compressImageForStorage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var scale =
          img.width > ARCHIVE_THUMB_STORAGE_WIDTH
            ? ARCHIVE_THUMB_STORAGE_WIDTH / img.width
            : 1;
        var width = Math.max(1, Math.round(img.width * scale));
        var height = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not compress archive image"));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        if (typeof ctx.imageSmoothingQuality !== "undefined") {
          ctx.imageSmoothingQuality = "high";
        }
        ctx.drawImage(img, 0, 0, width, height);
        encodeThumbBlob(canvas).then(resolve).catch(reject);
      };
      img.onerror = function () {
        reject(new Error("Could not load captured image for compression"));
      };
      img.src = dataUrl;
    });
  }

  function dataUrlToEncodedImage(dataUrl) {
    return compressImageForStorage(dataUrl);
  }

  function readLegacyEntries() {
    try {
      var raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function clearLegacyStorage() {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function migrateLegacyLocalStorage() {
    var legacyEntries = readLegacyEntries().filter(function (entry) {
      return entry && entry.id && entry.imagePng;
    });
    if (!legacyEntries.length) {
      clearLegacyStorage();
      return Promise.resolve(0);
    }

    var migrated = 0;
    var chain = Promise.resolve();
    legacyEntries.forEach(function (legacyEntry) {
      chain = chain.then(function () {
        return dataUrlToEncodedImage(legacyEntry.imagePng).then(function (encoded) {
          return putEntry({
            id: legacyEntry.id,
            savedAt: legacyEntry.savedAt || new Date().toISOString(),
            title: legacyEntry.title || "Untitled",
            mimeType: encoded.mimeType,
            image: encoded.blob,
          }).then(function () {
            migrated += 1;
          });
        });
      });
    });

    return chain
      .then(function () {
        clearLegacyStorage();
        return migrated;
      })
      .catch(function (err) {
        console.warn("[HandkerchiefArchive] Legacy migration incomplete:", err);
        return migrated;
      });
  }

  function ensureDesignReadyForCapture() {
    return new Promise(function (resolve) {
      var page2 = document.getElementById("page2");
      if (page2) page2.classList.add("page2--design-active");
      var svg = document.getElementById("design-svg");
      if (svg) svg.style.display = "block";
      if (typeof window.render === "function") window.render();
      if (typeof window.layoutStage === "function") window.layoutStage();
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  function measurePngDataUrl(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ uniqueColors: 0, width: img.width, height: img.height });
          return;
        }
        ctx.drawImage(img, 0, 0);
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var colors = {};
        var px;
        for (px = 0; px < data.length; px += 16) {
          colors[data[px] + "," + data[px + 1] + "," + data[px + 2]] = true;
        }
        resolve({
          uniqueColors: Object.keys(colors).length,
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = function () {
        resolve({ uniqueColors: 0, width: 0, height: 0 });
      };
      img.src = dataUrl;
    });
  }

  function captureDesignPng() {
    return ensureDesignReadyForCapture().then(function () {
      if (typeof window.captureArchiveDesignPng !== "function") {
        return Promise.reject(new Error("Export capture unavailable"));
      }

      return window
        .captureArchiveDesignPng(ARCHIVE_THUMB_STORAGE_WIDTH)
        .then(function (dataUrl) {
          return measurePngDataUrl(dataUrl).then(function (stats) {
            if (stats.uniqueColors <= 2) {
              throw new Error("Captured image appears blank");
            }
            return dataUrl;
          });
        });
    });
  }

  function formatSavedDate(isoString) {
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function revokeActiveObjectUrls() {
    var i;
    for (i = 0; i < activeObjectUrls.length; i++) {
      URL.revokeObjectURL(activeObjectUrls[i]);
    }
    activeObjectUrls = [];
  }

  function getEntryImageSrc(entry) {
    if (entry.image instanceof Blob) {
      var objectUrl = URL.createObjectURL(entry.image);
      activeObjectUrls.push(objectUrl);
      return objectUrl;
    }
    if (entry.imagePng) {
      return entry.imagePng;
    }
    return "";
  }

  function renderArchiveGridWithEntries(entries) {
    var grid = document.getElementById("handkerchief-archive-grid");
    var emptyEl = document.getElementById("archive-empty");
    if (!grid) return;

    revokeActiveObjectUrls();

    var visibleEntries = (entries || []).filter(function (entry) {
      return entry && entry.id && (entry.image instanceof Blob || entry.imagePng);
    });
    grid.innerHTML = "";

    if (emptyEl) {
      emptyEl.hidden = visibleEntries.length > 0;
    }

    var i;
    for (i = visibleEntries.length - 1; i >= 0; i--) {
      (function (entry) {
        var imageSrc = getEntryImageSrc(entry);
        if (!imageSrc) return;

        var card = document.createElement("article");
        card.className = "archive-card";
        card.setAttribute("role", "listitem");
        card.setAttribute("data-archive-id", entry.id);

        var thumb = document.createElement("div");
        thumb.className = "archive-card__thumbnail";
        var figure = document.createElement("div");
        figure.className = "archive-card__figure";
        var img = document.createElement("img");
        img.className = "archive-card__image";
        img.src = imageSrc;
        img.alt = getArchiveCardLineParts(entry).join(", ") || "Saved handkerchief";
        img.decoding = "async";
        figure.appendChild(img);
        thumb.appendChild(figure);

        var title = document.createElement("p");
        title.className = "archive-card__title";
        renderArchiveCardTitle(title, entry);

        var date = document.createElement("p");
        date.className = "archive-card__date";
        date.textContent = formatSavedDate(entry.savedAt);

        var meta = document.createElement("div");
        meta.className = "archive-card__meta";
        meta.appendChild(title);
        meta.appendChild(date);

        card.appendChild(thumb);
        card.appendChild(meta);
        grid.appendChild(card);
      })(visibleEntries[i]);
    }

    if (
      window.Page2Navigation &&
      typeof window.Page2Navigation.updateScrollability === "function"
    ) {
      window.requestAnimationFrame(function () {
        window.Page2Navigation.updateScrollability();
      });
    }
  }

  function renderArchiveGrid(entriesOverride) {
    if (entriesOverride) {
      renderArchiveGridWithEntries(entriesOverride);
      return Promise.resolve();
    }
    return getAllEntries()
      .then(renderArchiveGridWithEntries)
      .catch(function (err) {
        console.warn("[HandkerchiefArchive] Could not render archive:", err);
        renderArchiveGridWithEntries([]);
      });
  }

  function saveCurrentDesign() {
    return captureDesignPng()
      .then(compressImageForStorage)
      .then(function (encoded) {
        var profile = getEntryProfile();
        var entry = {
          id: Date.now() + "-" + Math.random().toString(36).slice(2, 9),
          savedAt: new Date().toISOString(),
          title: profile.name,
          profile: profile,
          mimeType: encoded.mimeType,
          image: encoded.blob,
        };
        return putEntry(entry).then(function (savedEntry) {
          return getAllEntries().then(function (entries) {
            renderArchiveGridWithEntries(entries);
            return savedEntry;
          });
        });
      });
  }

  function revealDesignArchive() {
    renderArchiveGrid();
    if (
      window.Page2Navigation &&
      typeof window.Page2Navigation.showSection === "function"
    ) {
      window.Page2Navigation.showSection(5);
      return;
    }
    var archiveSection = document.getElementById("section-archive");
    if (archiveSection) {
      archiveSection.classList.add("is-active");
      document.querySelectorAll(".page2-section").forEach(function (section) {
        if (section !== archiveSection) {
          section.classList.remove("is-active");
        }
      });
    }
  }

  function init() {
    openDb()
      .then(migrateLegacyLocalStorage)
      .then(function () {
        return renderArchiveGrid();
      })
      .catch(function (err) {
        console.warn("[HandkerchiefArchive] Init failed:", err);
        renderArchiveGridWithEntries([]);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.HandkerchiefArchive = {
    saveCurrentDesign: saveCurrentDesign,
    renderArchiveGrid: renderArchiveGrid,
    revealDesignArchive: revealDesignArchive,
    getEntries: getAllEntries,
  };
})();

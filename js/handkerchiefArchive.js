(function () {
  "use strict";

  var STORAGE_KEY = "undercover.handkerchiefArchive";
  var ARCHIVE_THUMB_WIDTH = 280;

  function readEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (e) {
      console.warn("[HandkerchiefArchive] Could not save:", e);
      return false;
    }
  }

  function getEntryTitle() {
    if (window.Questionnaire && window.Questionnaire.getNameLabelText) {
      var label = String(window.Questionnaire.getNameLabelText() || "").trim();
      if (label) return label;
    }
    return "Untitled";
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
        .captureArchiveDesignPng(ARCHIVE_THUMB_WIDTH)
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

  function renderArchiveGrid(entriesOverride) {
    var grid = document.getElementById("handkerchief-archive-grid");
    var emptyEl = document.getElementById("archive-empty");
    if (!grid) return;

    var entries = (entriesOverride || readEntries()).filter(function (entry) {
      return entry && entry.imagePng;
    });
    grid.innerHTML = "";

    if (emptyEl) {
      emptyEl.hidden = entries.length > 0;
    }

    var i;
    for (i = entries.length - 1; i >= 0; i--) {
      (function (entry) {
        var card = document.createElement("article");
        card.className = "archive-card";
        card.setAttribute("role", "listitem");
        card.setAttribute("data-archive-id", entry.id);

        var thumb = document.createElement("div");
        thumb.className = "archive-card__thumbnail";
        var img = document.createElement("img");
        img.className = "archive-card__image";
        img.src = entry.imagePng;
        img.alt = entry.title || "Saved handkerchief";
        img.decoding = "async";
        thumb.appendChild(img);

        var title = document.createElement("h3");
        title.className = "archive-card__title";
        title.textContent = entry.title || "Untitled";

        var date = document.createElement("p");
        date.className = "archive-card__date";
        date.textContent = formatSavedDate(entry.savedAt);

        var actions = document.createElement("div");
        actions.className = "archive-card__actions";

        var deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "archive-card__btn archive-card__btn--delete";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", function () {
          deleteEntry(entry.id);
        });

        actions.appendChild(deleteBtn);

        card.appendChild(thumb);
        card.appendChild(title);
        card.appendChild(date);
        card.appendChild(actions);
        grid.appendChild(card);
      })(entries[i]);
    }
  }

  function saveCurrentDesign() {
    return captureDesignPng().then(function (imagePng) {
      var entry = {
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 9),
        savedAt: new Date().toISOString(),
        title: getEntryTitle(),
        imagePng: imagePng,
      };
      var entries = readEntries();
      entries.push(entry);
      var saved = writeEntries(entries);
      renderArchiveGrid(saved ? null : entries);
      return entry;
    });
  }

  function deleteEntry(id) {
    var entries = readEntries().filter(function (entry) {
      return entry.id !== id;
    });
    writeEntries(entries);
    renderArchiveGrid();
  }

  function revealDesignArchive() {
    var designArchive = document.getElementById("design-archive");
    var sectionDesign = document.getElementById("section-design");
    if (designArchive) {
      designArchive.hidden = false;
    }
    if (sectionDesign) {
      sectionDesign.classList.add("section-design--archive-visible");
    }
    renderArchiveGrid();
  }

  function init() {
    var designArchive = document.getElementById("design-archive");
    if (designArchive && designArchive.hidden) {
      return;
    }
    renderArchiveGrid();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.HandkerchiefArchive = {
    saveCurrentDesign: saveCurrentDesign,
    deleteEntry: deleteEntry,
    renderArchiveGrid: renderArchiveGrid,
    revealDesignArchive: revealDesignArchive,
    getEntries: readEntries,
  };
})();

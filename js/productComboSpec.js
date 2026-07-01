(function () {
  "use strict";

  /**
   * Maps shop folder → combo index (0-based).
   * Update when gallery ↔ combination assignments are finalized.
   */
  var SHOP_FOLDER_TO_COMBO = {
    "name 01": 6,
    "name 02": 2,
    "name 03": 4,
    "name 04": 3,
    "name 05": 5,
    "name 06": 1,
    "name 07": 7,
    "name 08": 8,
    "name 09": 0,
    "name 10": 5,
    "name 11": 1,
    "name 12": 6,
  };

  var DISPLAY_SECTIONS = [
    {
      id: "profile",
      title: "",
      keys: ["livingDuration", "leavingYear", "from", "nowIn", "homeAt"],
    },
  ];

  var LABELS = {
    livingInIran: "Did you ever live in Iran?",
    livingDuration: "I lived in Iran",
    leavingYear: "Year of leaving",
    from: "From",
    nowIn: "Now in",
    name: "Name",
    nameDisplayMode: "How name appears on the label",
    age: "Age",
    homeAt: 'Where do you feel most "at home" today?',
    labelBarTagIndex: "Side sign (0–5)",
    borderFrameDivisions: "Frame divisions",
    borderSideWhiteFill: "Margin empty cells",
    fanLeaves:
      "When you lived in Iran, how free did you feel to choose how to dress in public spaces?",
  };

  var ENUM_LABELS = {
    livingInIran: { yes: "Yes", no: "No" },
    livingDuration: {
      smallPart: "a small part of my life",
      partOfLife: "part of my life",
      mostAll: "most / all of my life",
    },
    nameDisplayMode: {
      anonymous: "Anonymous",
      initials: "Initials",
      name: "Name",
    },
    homeAt: {
      inIran: "In Iran",
      whereILive: "Outside Iran / where I live now",
      nowhere: "Nowhere / in between",
      "in betweeen": "Nowhere / in between",
    },
  };

  var SLIDER_MAX = {
    borderFrameDivisions: 3,
    fanLeaves: 10,
  };

  var specEl = document.getElementById("product-spec");
  var priceEl = document.getElementById("product-price");

  function isEmptyValue(raw) {
    if (raw === undefined || raw === null) return true;
    var s = String(raw).trim();
    return s === "" || s === "-";
  }

  function formatValue(key, raw) {
    if (isEmptyValue(raw)) return "—";

    var str = String(raw).trim();

    if (key === "livingInIran") {
      var yn = ENUM_LABELS.livingInIran[str.toLowerCase()];
      return yn || str;
    }

    if (ENUM_LABELS[key] && ENUM_LABELS[key][str]) {
      return ENUM_LABELS[key][str];
    }

    if (key === "borderSideWhiteFill") {
      var pct = parseInt(str, 10);
      return isFinite(pct) ? String(pct) + "%" : str;
    }

    if (key === "borderFrameDivisions" || key === "fanLeaves") {
      var num = parseInt(str, 10);
      var max = SLIDER_MAX[key];
      if (isFinite(num) && max) return String(num) + " / " + String(max);
      return str;
    }

    if (key === "labelBarTagIndex") {
      var tag = parseInt(str, 10);
      return isFinite(tag) ? String(tag) : str;
    }

    return str;
  }

  function getComboRow(folderName) {
    if (!folderName || SHOP_FOLDER_TO_COMBO[folderName] === undefined) return null;
    var index = SHOP_FOLDER_TO_COMBO[folderName];
    if (
      !window.HandkerchiefCombinations ||
      typeof window.HandkerchiefCombinations.getCombinations !== "function"
    ) {
      return null;
    }
    var combos = window.HandkerchiefCombinations.getCombinations();
    if (!combos || !combos[index]) return null;
    return combos[index];
  }

  function renderProductSpec(folderName) {
    if (!specEl) return;

    var row = getComboRow(folderName);
    if (
      !row &&
      window.HandkerchiefCombinations &&
      typeof window.HandkerchiefCombinations.loadCombinationsFromCsv === "function" &&
      typeof window.HandkerchiefCombinations.getCombinations === "function" &&
      !window.HandkerchiefCombinations.getCombinations().length
    ) {
      window.HandkerchiefCombinations.loadCombinationsFromCsv().then(function () {
        renderProductSpec(folderName);
      });
      return;
    }

    specEl.textContent = "";
    specEl.hidden = false;

    row = getComboRow(folderName);
    if (!row) {
      var unavailable = document.createElement("p");
      unavailable.className = "product-spec__unavailable";
      unavailable.textContent = "Profile unavailable.";
      specEl.appendChild(unavailable);
      renderProductPrice();
      return;
    }

    var sectionIdx;
    for (sectionIdx = 0; sectionIdx < DISPLAY_SECTIONS.length; sectionIdx++) {
      var section = DISPLAY_SECTIONS[sectionIdx];
      var sectionEl = document.createElement("section");
      sectionEl.className = "product-spec__section";

      if (section.title) {
        var heading = document.createElement("h3");
        heading.className = "product-spec__heading";
        heading.textContent = section.title;
        sectionEl.appendChild(heading);
      }

      var dl = document.createElement("dl");
      dl.className = "product-spec__list";

      var keyIdx;
      for (keyIdx = 0; keyIdx < section.keys.length; keyIdx++) {
        var key = section.keys[keyIdx];
        var dt = document.createElement("dt");
        dt.className = "product-spec__label";
        dt.textContent = LABELS[key] || key;

        var dd = document.createElement("dd");
        dd.className = "product-spec__value";
        dd.textContent = formatValue(key, row[key]);

        dl.appendChild(dt);
        dl.appendChild(dd);
      }

      sectionEl.appendChild(dl);
      specEl.appendChild(sectionEl);
    }

    renderProductPrice();
  }

  function renderProductPrice() {
    if (!priceEl) return;
    priceEl.hidden = false;
    renderShopCardPriceText(priceEl, PRODUCT_PAGE_PRICE);
  }

  function clearProductPrice() {
    if (!priceEl) return;
    priceEl.textContent = "";
    priceEl.hidden = true;
  }

  function clearProductSpec() {
    if (!specEl) return;
    specEl.textContent = "";
    specEl.hidden = true;
    clearProductPrice();
  }

  function formatShopDisplayText(text) {
    var str = String(text || "").trim();
    if (!str) return str;

    // Initials like "E.M." or "M.R." — keep each letter capitalized.
    if (/^[A-Za-z](\.[A-Za-z]\.)+$/.test(str)) {
      return str
        .split(".")
        .filter(Boolean)
        .map(function (part) {
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join(".") + ".";
    }

    // Acronyms that stay fully uppercase.
    if (/^usa$/i.test(str)) return "USA";

    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function getShopCardLineParts(name, row) {
    var baseName = formatShopDisplayText(name);
    if (!baseName) return [];

    var parts = [baseName];
    if (row) {
      var age = formatValue("age", row.age);
      var nowIn = formatShopDisplayText(formatValue("nowIn", row.nowIn));
      if (age !== "—") parts.push(age);
      if (nowIn !== "—") parts.push(nowIn);
    }
    return parts;
  }

  function setTextWithThinNumbers(el, text) {
    el.textContent = "";
    var digitPattern = /\d+/g;
    var lastIndex = 0;
    var match;

    while ((match = digitPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        el.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      var numEl = document.createElement("span");
      numEl.className = "shop-card__num";
      numEl.textContent = match[0];
      el.appendChild(numEl);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      el.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  }

  function renderShopCardName(nameEl, parts) {
    nameEl.textContent = "";
    if (!parts.length) {
      delete nameEl.dataset.shopLineText;
      return;
    }

    parts.forEach(function (part, index) {
      if (index > 0) {
        var sep = document.createElement("span");
        sep.className = "shop-card__name-sep";
        sep.setAttribute("aria-hidden", "true");
        nameEl.appendChild(sep);
      }

      var partEl = document.createElement("span");
      partEl.className = "shop-card__name-part";
      if (/^\d+$/.test(part)) {
        partEl.classList.add("shop-card__num");
        partEl.textContent = part;
      } else {
        partEl.textContent = part;
      }
      nameEl.appendChild(partEl);
    });

    nameEl.dataset.shopLineText = parts.join(", ");
  }

  function renderShopCardPriceText(el, text) {
    el.textContent = "";
    var priceMatch = text.match(/^(.*?)(\$)(\d+)(\.\d+)(.*)$/);
    if (!priceMatch) {
      setTextWithThinNumbers(el, text);
      return;
    }

    if (priceMatch[1]) {
      el.appendChild(document.createTextNode(priceMatch[1]));
    }

    el.appendChild(document.createTextNode(priceMatch[2]));

    var dollarsEl = document.createElement("span");
    dollarsEl.className = "shop-card__num";
    dollarsEl.textContent = priceMatch[3];
    el.appendChild(dollarsEl);

    el.appendChild(document.createTextNode(priceMatch[4]));

    if (priceMatch[5]) {
      el.appendChild(document.createTextNode(priceMatch[5]));
    }
  }

  var SHOP_CARD_PRICE = "From $59.00 USD";
  var PRODUCT_PAGE_PRICE = "$59.00 USD";

  function renderShopCardPrice(metaEl) {
    if (!metaEl) return;

    var priceEl = metaEl.querySelector(".shop-card__price");
    if (!priceEl) {
      priceEl = document.createElement("p");
      priceEl.className = "shop-card__price";
      metaEl.appendChild(priceEl);
    }

    renderShopCardPriceText(priceEl, SHOP_CARD_PRICE);
  }

  function populateShopGalleryCards() {
    var cards = document.querySelectorAll("#section-shop .shop-card");
    if (!cards.length) return;

    cards.forEach(function (card) {
      var folder = card.getAttribute("data-shop-folder");
      var row = getComboRow(folder);
      var metaEl = card.querySelector(".shop-card__meta");
      var nameEl = card.querySelector(".shop-card__name");
      if (!nameEl) return;

      if (!nameEl.dataset.shopBaseName) {
        nameEl.dataset.shopBaseName = nameEl.textContent.trim();
      }

      var detailsEl = card.querySelector(".shop-card__details");
      if (detailsEl) detailsEl.remove();

      renderShopCardName(nameEl, getShopCardLineParts(nameEl.dataset.shopBaseName, row));
      renderShopCardPrice(metaEl);
    });
  }

  function initShopGalleryCards() {
    populateShopGalleryCards();

    if (
      window.HandkerchiefCombinations &&
      typeof window.HandkerchiefCombinations.getCombinations === "function" &&
      !window.HandkerchiefCombinations.getCombinations().length &&
      typeof window.HandkerchiefCombinations.loadCombinationsFromCsv === "function"
    ) {
      window.HandkerchiefCombinations.loadCombinationsFromCsv().then(function () {
        populateShopGalleryCards();
      });
    }
  }

  window.ProductComboSpec = {
    render: renderProductSpec,
    clear: clearProductSpec,
    populateShopGalleryCards: populateShopGalleryCards,
    getShopCardLineParts: getShopCardLineParts,
    renderShopCardName: renderShopCardName,
    SHOP_FOLDER_TO_COMBO: SHOP_FOLDER_TO_COMBO,
  };

  initShopGalleryCards();
})();

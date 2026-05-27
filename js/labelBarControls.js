(function () {
  "use strict";

  /** @type {{ type: "svg" | "text", svgFile: string, text: string }[]} */
  var items = [];
  /** @type {((items: { type: "svg" | "text", svgFile: string, text: string }[]) => void) | null} */
  var onChange = null;

  var svgAssets =
    typeof LABEL_BAR_SVG_ASSETS !== "undefined" ? LABEL_BAR_SVG_ASSETS : [];

  function getEndCapSvgFile() {
    return typeof LABEL_BAR_END_CAP_SVG !== "undefined"
      ? LABEL_BAR_END_CAP_SVG
      : "lion.svg";
  }

  function getLivingInIranSvgFile() {
    return typeof LABEL_BAR_LIVING_IN_IRAN_SVG !== "undefined"
      ? LABEL_BAR_LIVING_IN_IRAN_SVG
      : "IN IRAN.svg";
  }

  function getLivingOutsideIranSvgFile() {
    return typeof LABEL_BAR_LIVING_OUTSIDE_IRAN_SVG !== "undefined"
      ? LABEL_BAR_LIVING_OUTSIDE_IRAN_SVG
      : "OUTSIDE IRAN.svg";
  }

  function getFromSvgFile() {
    return typeof LABEL_BAR_FROM_SVG !== "undefined"
      ? LABEL_BAR_FROM_SVG
      : "from.svg";
  }

  function getNowInSvgFile() {
    return typeof LABEL_BAR_NOW_IN_SVG !== "undefined"
      ? LABEL_BAR_NOW_IN_SVG
      : "now in.svg";
  }

  function getBarcodeSvgFile() {
    return typeof LABEL_BAR_BARCODE_SVG !== "undefined"
      ? LABEL_BAR_BARCODE_SVG
      : "barcode.svg";
  }

  function getLeftSignSvgFile() {
    return typeof LABEL_BAR_LEFT_SVG !== "undefined"
      ? LABEL_BAR_LEFT_SVG
      : "left.svg";
  }

  function getWomenSvgFile() {
    return typeof LABEL_BAR_WOMEN_SVG !== "undefined"
      ? LABEL_BAR_WOMEN_SVG
      : "women.svg";
  }

  function getLeftLionInnerRow1SvgFile() {
    return typeof LABEL_BAR_LEFT_LION_INNER_ROW1_SVG !== "undefined"
      ? LABEL_BAR_LEFT_LION_INNER_ROW1_SVG
      : "undercover english.svg";
  }

  function getLeftLionInnerRow1SunSvgFile() {
    return typeof LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG !== "undefined"
      ? LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG
      : "sun.svg";
  }

  function getAgeSvgFile() {
    return typeof LABEL_BAR_AGE_SVG !== "undefined"
      ? LABEL_BAR_AGE_SVG
      : "age.svg";
  }

  function getRightLionInnerRow2SvgFile() {
    return typeof LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG !== "undefined"
      ? LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG
      : "undercover arabic.svg";
  }

  function getLostInnerSvgFile() {
    return typeof LABEL_BAR_LOST_INNER_SVG !== "undefined"
      ? LABEL_BAR_LOST_INNER_SVG
      : "LOST/man.svg";
  }

  function getLostMiddleSvgFile() {
    return typeof LABEL_BAR_LOST_MIDDLE_SVG !== "undefined"
      ? LABEL_BAR_LOST_MIDDLE_SVG
      : "LOST/2 man.svg";
  }

  function getLostDistantSvgFile() {
    return typeof LABEL_BAR_LOST_DISTANT_SVG !== "undefined"
      ? LABEL_BAR_LOST_DISTANT_SVG
      : "LOST/3 man.svg";
  }

  /** SVGs the user can add in the middle (lion + profile Iran signs are excluded). */
  function getSelectableSvgAssets() {
    var cap = getEndCapSvgFile();
    var inIran = getLivingInIranSvgFile();
    var outsideIran = getLivingOutsideIranSvgFile();
    var fromFile = getFromSvgFile();
    var nowInFile = getNowInSvgFile();
    var barcodeFile = getBarcodeSvgFile();
    var leftSignFile = getLeftSignSvgFile();
    var womenFile = getWomenSvgFile();
    var leftWord = getLeftLionInnerRow1SvgFile();
    var sunFile = getLeftLionInnerRow1SunSvgFile();
    var ageFile = getAgeSvgFile();
    var rightWord = getRightLionInnerRow2SvgFile();
    var lostInner = getLostInnerSvgFile();
    var lostMiddle = getLostMiddleSvgFile();
    var lostDistant = getLostDistantSvgFile();
    return svgAssets.filter(function (file) {
      return (
        file !== cap &&
        file !== inIran &&
        file !== outsideIran &&
        file !== fromFile &&
        file !== nowInFile &&
        file !== barcodeFile &&
        file !== leftSignFile &&
        file !== womenFile &&
        file !== leftWord &&
        file !== sunFile &&
        file !== ageFile &&
        file !== rightWord &&
        file !== lostInner &&
        file !== lostMiddle &&
        file !== lostDistant
      );
    });
  }

  function notifyChange() {
    if (onChange) onChange(items.slice());
  }

  function renderItemBody(item, index) {
    var container = document.getElementById("label-bar-items");
    if (!container) return;

    var row = document.createElement("div");
    row.className = "sidebar__label-bar-item";
    row.setAttribute("data-index", String(index));

    var head = document.createElement("div");
    head.className = "sidebar__label-bar-item-head";

    var typeSelect = document.createElement("select");
    typeSelect.className = "sidebar__label-bar-type";
    typeSelect.setAttribute("aria-label", "Item type");

    var svgOption = document.createElement("option");
    svgOption.value = "svg";
    svgOption.textContent = "SVG";
    typeSelect.appendChild(svgOption);

    var textOption = document.createElement("option");
    textOption.value = "text";
    textOption.textContent = "Text";
    typeSelect.appendChild(textOption);

    typeSelect.value = item.type;

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "sidebar__label-bar-delete-btn";
    deleteBtn.setAttribute("aria-label", "Remove item");
    deleteBtn.textContent = "Delete";

    head.appendChild(typeSelect);
    head.appendChild(deleteBtn);
    row.appendChild(head);

    var body = document.createElement("div");
    body.className = "sidebar__label-bar-item-body";

    function renderBodyFields() {
      body.innerHTML = "";
      if (item.type === "svg") {
        var svgSelect = document.createElement("select");
        svgSelect.className = "sidebar__label-bar-svg-select";
        svgSelect.setAttribute("aria-label", "SVG file");
        var selectable = getSelectableSvgAssets();
        var ai;
        for (ai = 0; ai < selectable.length; ai++) {
          var opt = document.createElement("option");
          opt.value = selectable[ai];
          opt.textContent = selectable[ai];
          svgSelect.appendChild(opt);
        }
        svgSelect.value =
          item.svgFile && selectable.indexOf(item.svgFile) >= 0
            ? item.svgFile
            : selectable[0] || "";
        item.svgFile = svgSelect.value;
        svgSelect.addEventListener("change", function () {
          item.svgFile = svgSelect.value;
          notifyChange();
        });
        body.appendChild(svgSelect);
      } else {
        var textInput = document.createElement("input");
        textInput.type = "text";
        textInput.className = "sidebar__label-bar-text-input";
        textInput.setAttribute("aria-label", "Label text");
        textInput.value = item.text || "";
        textInput.addEventListener("input", function () {
          item.text = textInput.value;
          notifyChange();
        });
        body.appendChild(textInput);
      }
    }

    typeSelect.addEventListener("change", function () {
      item.type = typeSelect.value === "text" ? "text" : "svg";
      if (item.type === "svg" && !item.svgFile) {
        var pick = getSelectableSvgAssets();
        item.svgFile = pick[0] || "";
      }
      renderBodyFields();
      notifyChange();
    });

    deleteBtn.addEventListener("click", function () {
      items.splice(index, 1);
      renderList();
      notifyChange();
    });

    renderBodyFields();
    row.appendChild(body);
    container.appendChild(row);
  }

  function renderList() {
    var container = document.getElementById("label-bar-items");
    if (!container) return;
    container.innerHTML = "";
    var i;
    for (i = 0; i < items.length; i++) {
      renderItemBody(items[i], i);
    }
  }

  function addItem() {
    var pick = getSelectableSvgAssets();
    items.push({
      type: "text",
      svgFile: pick[0] || "",
      text: "",
    });
    renderList();
    notifyChange();
  }

  function init(callback) {
    onChange = callback || null;
    var addBtn = document.getElementById("label-bar-add-item-btn");
    if (addBtn) {
      addBtn.addEventListener("click", addItem);
    }
    renderList();
  }

  function getItems() {
    return items.slice();
  }

  window.LabelBarControls = {
    init: init,
    getItems: getItems,
  };
})();

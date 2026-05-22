(function () {
  "use strict";

  /**
   * Living toggle UI only — grid behavior will be wired later.
   * @param {"in"|"outside"} choice
   * @param {HTMLButtonElement} inBtn
   * @param {HTMLButtonElement} outsideBtn
   * @param {HTMLButtonElement|null} familyBtn
   */
  function setLivingChoice(choice, inBtn, outsideBtn, familyBtn) {
    var isOutside = choice === "outside";
    inBtn.classList.toggle("is-active", !isOutside);
    inBtn.setAttribute("aria-pressed", String(!isOutside));
    outsideBtn.classList.toggle("is-active", isOutside);
    outsideBtn.setAttribute("aria-pressed", String(isOutside));
    if (familyBtn) {
      familyBtn.hidden = !isOutside;
    }
  }

  function initAgeInput() {
    var ageInput = document.getElementById("identity-age-input");
    if (!ageInput) return;
    ageInput.addEventListener("input", function () {
      var digitsOnly = ageInput.value.replace(/\D/g, "");
      if (ageInput.value !== digitsOnly) {
        ageInput.value = digitsOnly;
      }
    });
  }

  /**
   * @param {object} options
   * @param {string} options.sliderId
   * @param {string} options.controlId
   * @param {string} options.labelAttr
   * @param {Record<number, string>} options.labelsMap
   * @param {Record<number, string>} [options.ariaLabelsMap]
   */
  function initThreeStepSlider(options) {
    var slider = document.getElementById(options.sliderId);
    var control = document.getElementById(options.controlId);
    if (!slider || !control) return;

    var segments = control.querySelectorAll(".sidebar__identity-regime-segment");
    var labels = control.querySelectorAll(".sidebar__identity-regime-label");
    var labelAttr = options.labelAttr;
    var labelsMap = options.labelsMap;
    var ariaLabelsMap = options.ariaLabelsMap || labelsMap;

    function update() {
      var value = Number(slider.value);
      var ariaText = ariaLabelsMap[value] || ariaLabelsMap[1] || "";
      var i;
      for (i = 0; i < segments.length; i++) {
        var segValue = Number(segments[i].getAttribute("data-segment"));
        segments[i].classList.toggle("is-active", segValue === value);
      }
      for (i = 0; i < labels.length; i++) {
        var labelValue = Number(labels[i].getAttribute(labelAttr));
        labels[i].classList.toggle("is-active", labelValue === value);
      }
      slider.setAttribute("aria-valuenow", String(value));
      slider.setAttribute("aria-valuetext", ariaText);
    }

    update();
    slider.addEventListener("input", update);

    for (var j = 0; j < labels.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          slider.value = btn.getAttribute(labelAttr);
          update();
        });
      })(labels[j]);
    }
  }

  function initRegimeSlider() {
    initThreeStepSlider({
      sliderId: "identity-regime-slider",
      controlId: "identity-regime-control",
      labelAttr: "data-regime",
      labelsMap: {
        1: "Personal",
        2: "Family Members",
        3: "Friends",
      },
    });
  }

  function initLostSlider() {
    initThreeStepSlider({
      sliderId: "identity-lost-slider",
      controlId: "identity-lost-control",
      labelAttr: "data-lost",
      labelsMap: {
        1: "Inner Circle",
        2: "",
        3: "Distant Circle",
      },
      ariaLabelsMap: {
        1: "Inner Circle",
        2: "Middle",
        3: "Distant Circle",
      },
    });
  }

  function initLivingControls() {
    var inBtn = document.getElementById("living-in-btn");
    var outsideBtn = document.getElementById("living-outside-btn");
    var familyBtn = document.getElementById("living-family-btn");
    if (!inBtn || !outsideBtn) return;

    setLivingChoice("in", inBtn, outsideBtn, familyBtn);

    inBtn.addEventListener("click", function () {
      setLivingChoice("in", inBtn, outsideBtn, familyBtn);
    });
    outsideBtn.addEventListener("click", function () {
      setLivingChoice("outside", inBtn, outsideBtn, familyBtn);
    });
  }

  function init() {
    initLivingControls();
    initAgeInput();
    initRegimeSlider();
    initLostSlider();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

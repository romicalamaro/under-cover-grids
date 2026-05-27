(function () {
  "use strict";

  /** @type {null | boolean} true = Yes (IN IRAN); false = No (OUTSIDE IRAN) */
  var livingInIranChoice = true;
  /** @type {((choice: null | boolean) => void) | null} */
  var onLivingInIranChange = null;
  /** @type {1 | 2 | 3} */
  var lostCircleChoice = 1;
  /** @type {((choice: 1 | 2 | 3) => void) | null} */
  var onLostCircleChange = null;
  /** @type {string} */
  var ageValue = "";
  /** @type {((value: string) => void) | null} */
  var onAgeChange = null;
  /** @type {string} */
  var fromValue =
    typeof LABEL_BAR_PROFILE_FROM_DEFAULT !== "undefined"
      ? LABEL_BAR_PROFILE_FROM_DEFAULT
      : "TEHERAN";
  /** @type {string} */
  var nowInValue =
    typeof LABEL_BAR_PROFILE_NOW_IN_DEFAULT !== "undefined"
      ? LABEL_BAR_PROFILE_NOW_IN_DEFAULT
      : "MAINZ";
  /** @type {((value: string) => void) | null} */
  var onFromChange = null;
  /** @type {((value: string) => void) | null} */
  var onNowInChange = null;
  /** @type {string} */
  var leavingYearValue =
    typeof LABEL_BAR_PROFILE_LEAVING_YEAR_DEFAULT !== "undefined"
      ? LABEL_BAR_PROFILE_LEAVING_YEAR_DEFAULT
      : "2021";
  /** @type {((value: string) => void) | null} */
  var onLeavingYearChange = null;
  /** @type {string} */
  var nameValue = "";
  /** @type {"initials" | "anonymous" | "none"} */
  var nameDisplayMode = "anonymous";
  /** @type {(() => void) | null} */
  var onNameChange = null;

  /**
   * @param {object} options
   * @param {string} options.yesBtnId
   * @param {string} options.noBtnId
   * @param {boolean} [options.defaultYes]
   */
  function initYesNoToggle(options) {
    var yesBtn = document.getElementById(options.yesBtnId);
    var noBtn = document.getElementById(options.noBtnId);
    if (!yesBtn || !noBtn) return;

    function setChoice(isYes) {
      yesBtn.classList.toggle("is-active", isYes);
      yesBtn.setAttribute("aria-pressed", String(isYes));
      noBtn.classList.toggle("is-active", !isYes);
      noBtn.setAttribute("aria-pressed", String(!isYes));
    }

    setChoice(options.defaultYes !== false);
    yesBtn.addEventListener("click", function () {
      setChoice(true);
    });
    noBtn.addEventListener("click", function () {
      setChoice(false);
    });
  }

  function initLivingInIranToggle() {
    var yesBtn = document.getElementById("living-in-btn");
    var noBtn = document.getElementById("living-outside-btn");
    var leavingYearField = document.getElementById("identity-leaving-year-field");
    if (!yesBtn || !noBtn) return;

    function applyUi(choice) {
      yesBtn.classList.toggle("is-active", choice === true);
      yesBtn.setAttribute("aria-pressed", String(choice === true));
      noBtn.classList.toggle("is-active", choice === false);
      noBtn.setAttribute("aria-pressed", String(choice === false));
      if (leavingYearField) {
        if (choice === true) {
          leavingYearField.removeAttribute("hidden");
        } else {
          leavingYearField.setAttribute("hidden", "");
        }
      }
    }

    function setChoice(isYes) {
      livingInIranChoice = isYes;
      applyUi(livingInIranChoice);
      if (onLivingInIranChange) onLivingInIranChange(livingInIranChoice);
    }

    applyUi(true);
    yesBtn.addEventListener("click", function () {
      setChoice(true);
    });
    noBtn.addEventListener("click", function () {
      setChoice(false);
    });
  }

  function initAgeInput() {
    var ageInput = document.getElementById("identity-age-input");
    if (!ageInput) return;

    function syncAge() {
      var digitsOnly = ageInput.value.replace(/\D/g, "").slice(0, 2);
      if (ageInput.value !== digitsOnly) {
        ageInput.value = digitsOnly;
      }
      ageValue = digitsOnly;
      if (onAgeChange) onAgeChange(ageValue);
    }

    syncAge();
    ageInput.addEventListener("input", syncAge);
  }

  function initLeavingYearInput() {
    var leavingYearInput = document.getElementById("identity-leaving-year-input");
    if (!leavingYearInput) return;

    function syncLeavingYear() {
      var digitsOnly = leavingYearInput.value.replace(/\D/g, "").slice(0, 4);
      if (leavingYearInput.value !== digitsOnly) {
        leavingYearInput.value = digitsOnly;
      }
      leavingYearValue = digitsOnly;
      if (onLeavingYearChange) onLeavingYearChange(leavingYearValue);
    }

    syncLeavingYear();
    leavingYearInput.addEventListener("input", syncLeavingYear);
  }

  /**
   * Profile text fields: English letters and spaces only, always uppercase.
   * Hebrew and other scripts are stripped as the user types.
   * @param {string} value
   * @returns {string}
   */
  function normalizeProfileEnglishText(value) {
    return String(value || "")
      .replace(/[^A-Za-z ]/g, "")
      .toUpperCase();
  }

  /**
   * @param {string} inputId
   * @param {(value: string) => void} setValue
   * @param {((value: string) => void) | null} onChange
   */
  function initProfileTextField(inputId, setValue, onChange) {
    var input = document.getElementById(inputId);
    if (!input) return;

    function sync() {
      var normalized = normalizeProfileEnglishText(input.value);
      if (input.value !== normalized) {
        input.value = normalized;
      }
      setValue(normalized);
      if (onChange) onChange(normalized);
    }

    sync();
    input.addEventListener("input", sync);
  }

  /**
   * @param {string} fullName
   * @returns {string}
   */
  function formatNameInitials(fullName) {
    var parts = String(fullName || "")
      .trim()
      .split(/\s+/)
      .filter(function (part) {
        return part.length > 0;
      });
    if (!parts.length) return "";
    var letters = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      letters.push(parts[i].charAt(0).toUpperCase());
    }
    return letters.join(".");
  }

  /** Text shown on the label bar between leaving year and women icon. */
  function getNameLabelText() {
    if (nameDisplayMode === "none") return "";
    if (nameDisplayMode === "anonymous") return "ANONYMOUS";
    return formatNameInitials(nameValue);
  }

  function initNameInput() {
    initProfileTextField(
      "identity-name-input",
      function (value) {
        nameValue = value;
      },
      function () {
        if (onNameChange) onNameChange();
      }
    );
  }

  function initNameDisplayModeToggle() {
    var anonymousBtn = document.getElementById("identity-name-anonymous-btn");
    var initialsBtn = document.getElementById("identity-name-initials-btn");
    var noneBtn = document.getElementById("identity-name-none-btn");
    if (!anonymousBtn || !initialsBtn || !noneBtn) return;

    function applyUi(mode) {
      anonymousBtn.classList.toggle("is-active", mode === "anonymous");
      anonymousBtn.setAttribute("aria-pressed", String(mode === "anonymous"));
      initialsBtn.classList.toggle("is-active", mode === "initials");
      initialsBtn.setAttribute("aria-pressed", String(mode === "initials"));
      noneBtn.classList.toggle("is-active", mode === "none");
      noneBtn.setAttribute("aria-pressed", String(mode === "none"));
    }

    function setMode(mode) {
      nameDisplayMode = mode;
      applyUi(nameDisplayMode);
      if (onNameChange) onNameChange();
    }

    applyUi(nameDisplayMode);
    anonymousBtn.addEventListener("click", function () {
      setMode("anonymous");
    });
    initialsBtn.addEventListener("click", function () {
      setMode("initials");
    });
    noneBtn.addEventListener("click", function () {
      setMode("none");
    });
  }

  function initFromAndNowInInputs() {
    initProfileTextField(
      "identity-from-input",
      function (value) {
        fromValue = value;
      },
      function (value) {
        if (onFromChange) onFromChange(value);
      }
    );
    initProfileTextField(
      "identity-now-in-input",
      function (value) {
        nowInValue = value;
      },
      function (value) {
        if (onNowInChange) onNowInChange(value);
      }
    );
  }

  /**
   * @param {object} options
   * @param {string} options.sliderId
   * @param {string} options.controlId
   * @param {string} options.labelAttr
   * @param {Record<number, string>} options.labelsMap
   * @param {Record<number, string>} [options.ariaLabelsMap]
   * @param {(value: number) => void} [options.onChange]
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
      if (options.onChange) options.onChange(value);
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
      onChange: function (value) {
        lostCircleChoice = /** @type {1 | 2 | 3} */ (value);
        if (onLostCircleChange) onLostCircleChange(lostCircleChoice);
      },
    });
  }

  function initWearControlSlider(sliderId, outputId) {
    var slider = document.getElementById(sliderId);
    var output = document.getElementById(outputId);
    if (!slider || !output) return;

    function update() {
      output.textContent = slider.value;
    }

    update();
    slider.addEventListener("input", update);
  }

  function initWearControlSliders() {
    initWearControlSlider("wear-control-home", "wear-control-home-out");
    initWearControlSlider("wear-control-outside", "wear-control-outside-out");
  }

  function init() {
    initLivingInIranToggle();
    initYesNoToggle({
      yesBtnId: "family-friends-iran-yes-btn",
      noBtnId: "family-friends-iran-no-btn",
      defaultYes: true,
    });
    initAgeInput();
    initLeavingYearInput();
    initNameInput();
    initNameDisplayModeToggle();
    initFromAndNowInInputs();
    initRegimeSlider();
    initLostSlider();
    initWearControlSliders();
  }

  window.IdentityControls = {
    /** @returns {null | boolean} */
    getLivingInIran: function () {
      return livingInIranChoice;
    },
    /** @param {(choice: null | boolean) => void} fn */
    setOnLivingInIranChange: function (fn) {
      onLivingInIranChange = fn;
    },
    /** @returns {1 | 2 | 3} */
    getLostCircle: function () {
      return lostCircleChoice;
    },
    /** @param {(choice: 1 | 2 | 3) => void} fn */
    setOnLostCircleChange: function (fn) {
      onLostCircleChange = fn;
    },
    /** @returns {string} */
    getAge: function () {
      return ageValue;
    },
    /** @param {(value: string) => void} fn */
    setOnAgeChange: function (fn) {
      onAgeChange = fn;
    },
    /** @returns {string} */
    getFrom: function () {
      return fromValue;
    },
    /** @param {(value: string) => void} fn */
    setOnFromChange: function (fn) {
      onFromChange = fn;
    },
    /** @returns {string} */
    getNowIn: function () {
      return nowInValue;
    },
    /** @param {(value: string) => void} fn */
    setOnNowInChange: function (fn) {
      onNowInChange = fn;
    },
    /** @returns {string} */
    getLeavingYear: function () {
      return leavingYearValue;
    },
    /** @param {(value: string) => void} fn */
    setOnLeavingYearChange: function (fn) {
      onLeavingYearChange = fn;
    },
    /** @returns {string} */
    getNameLabelText: function () {
      return getNameLabelText();
    },
    /** @param {() => void} fn */
    setOnNameChange: function (fn) {
      onNameChange = fn;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

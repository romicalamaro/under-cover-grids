(function () {
  "use strict";

  /** @type {null | boolean} true = Yes; false = No */
  var livingInIranChoice = true;
  /** @type {((choice: null | boolean) => void) | null} */
  var onLivingInIranChange = null;
  /** @type {"smallPart" | "partOfLife" | "mostAll"} */
  var livingDurationChoice = "partOfLife";
  /** @type {((choice: "smallPart" | "partOfLife" | "mostAll") => void) | null} */
  var onLivingDurationChange = null;
  /** @type {string} */
  var ageValue =
    typeof LABEL_BAR_AGE_DEFAULT !== "undefined"
      ? LABEL_BAR_AGE_DEFAULT
      : "27";
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
  /** @type {"initials" | "anonymous" | "name"} */
  var nameDisplayMode = "anonymous";
  /** @type {(() => void) | null} */
  var onNameChange = null;
  /** @type {"inIran" | "whereILive" | "nowhere"} */
  var homeAtChoice = "inIran";
  /** @type {((choice: "inIran" | "whereILive" | "nowhere") => void) | null} */
  var onHomeAtChange = null;

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
    var livingDurationField = document.getElementById(
      "identity-living-duration-field"
    );
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
      if (livingDurationField) {
        if (choice === true) {
          livingDurationField.removeAttribute("hidden");
        } else {
          livingDurationField.setAttribute("hidden", "");
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
    if (nameDisplayMode === "anonymous") return "ANONYMOUS";
    if (nameDisplayMode === "initials") return formatNameInitials(nameValue);
    return String(nameValue || "").trim();
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
    var nameBtn = document.getElementById("identity-name-name-btn");
    if (!anonymousBtn || !initialsBtn || !nameBtn) return;

    function applyUi(mode) {
      anonymousBtn.classList.toggle("is-active", mode === "anonymous");
      anonymousBtn.setAttribute("aria-pressed", String(mode === "anonymous"));
      initialsBtn.classList.toggle("is-active", mode === "initials");
      initialsBtn.setAttribute("aria-pressed", String(mode === "initials"));
      nameBtn.classList.toggle("is-active", mode === "name");
      nameBtn.setAttribute("aria-pressed", String(mode === "name"));
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
    nameBtn.addEventListener("click", function () {
      setMode("name");
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

  function initLivingDurationPicker() {
    var buttons = document.querySelectorAll("[data-living-duration]");
    if (!buttons.length) return;

    function applyUi(choice) {
      var i;
      for (i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var value = btn.getAttribute("data-living-duration");
        var isActive = value === choice;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      }
    }

    function setChoice(choice) {
      livingDurationChoice = choice;
      applyUi(livingDurationChoice);
      if (onLivingDurationChange) onLivingDurationChange(livingDurationChoice);
    }

    applyUi(livingDurationChoice);

    for (var j = 0; j < buttons.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var value = btn.getAttribute("data-living-duration");
          if (
            value === "smallPart" ||
            value === "partOfLife" ||
            value === "mostAll"
          ) {
            setChoice(value);
          }
        });
      })(buttons[j]);
    }
  }

  function initHomeAtPicker() {
    var buttons = document.querySelectorAll("[data-home-at]");
    if (!buttons.length) return;

    function applyUi(choice) {
      var i;
      for (i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var value = btn.getAttribute("data-home-at");
        var isActive = value === choice;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      }
    }

    function setChoice(choice) {
      homeAtChoice = choice;
      applyUi(homeAtChoice);
      if (onHomeAtChange) onHomeAtChange(homeAtChoice);
    }

    applyUi(homeAtChoice);

    for (var j = 0; j < buttons.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var value = btn.getAttribute("data-home-at");
          if (
            value === "inIran" ||
            value === "whereILive" ||
            value === "nowhere"
          ) {
            setChoice(value);
          }
        });
      })(buttons[j]);
    }
  }

  function syncLivingInIranUiOnly(isYes) {
    var yesBtn = document.getElementById("living-in-btn");
    var noBtn = document.getElementById("living-outside-btn");
    var leavingYearField = document.getElementById("identity-leaving-year-field");
    var livingDurationField = document.getElementById(
      "identity-living-duration-field"
    );
    if (!yesBtn || !noBtn) return;
    yesBtn.classList.toggle("is-active", isYes === true);
    yesBtn.setAttribute("aria-pressed", String(isYes === true));
    noBtn.classList.toggle("is-active", isYes === false);
    noBtn.setAttribute("aria-pressed", String(isYes === false));
    if (leavingYearField) {
      if (isYes === true) leavingYearField.removeAttribute("hidden");
      else leavingYearField.setAttribute("hidden", "");
    }
    if (livingDurationField) {
      if (isYes === true) livingDurationField.removeAttribute("hidden");
      else livingDurationField.setAttribute("hidden", "");
    }
  }

  function syncLivingDurationUiOnly(choice) {
    var buttons = document.querySelectorAll("[data-living-duration]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var value = btn.getAttribute("data-living-duration");
      var isActive = value === choice;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    }
  }

  function syncNameDisplayModeUiOnly(mode) {
    var anonymousBtn = document.getElementById("identity-name-anonymous-btn");
    var initialsBtn = document.getElementById("identity-name-initials-btn");
    var nameBtn = document.getElementById("identity-name-name-btn");
    if (!anonymousBtn || !initialsBtn || !nameBtn) return;
    anonymousBtn.classList.toggle("is-active", mode === "anonymous");
    anonymousBtn.setAttribute("aria-pressed", String(mode === "anonymous"));
    initialsBtn.classList.toggle("is-active", mode === "initials");
    initialsBtn.setAttribute("aria-pressed", String(mode === "initials"));
    nameBtn.classList.toggle("is-active", mode === "name");
    nameBtn.setAttribute("aria-pressed", String(mode === "name"));
  }

  function syncHomeAtUiOnly(choice) {
    var buttons = document.querySelectorAll("[data-home-at]");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var value = btn.getAttribute("data-home-at");
      var isActive = value === choice;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    }
  }

  /**
   * Apply profile fields from a combination row (no grid / palette).
   * @param {Record<string, string>} row
   * @param {{ silent?: boolean }} [options]
   */
  function applyProfileState(row, options) {
    var silent = options && options.silent === true;
    if (!row) return;

    if (row.livingInIran !== undefined && row.livingInIran !== "") {
      var isYes =
        row.livingInIran === true ||
        String(row.livingInIran).toLowerCase() === "yes" ||
        String(row.livingInIran) === "true";
      livingInIranChoice = isYes;
      syncLivingInIranUiOnly(isYes);
      if (!silent && onLivingInIranChange) onLivingInIranChange(livingInIranChoice);
    }

    if (
      row.livingDuration === "smallPart" ||
      row.livingDuration === "partOfLife" ||
      row.livingDuration === "mostAll"
    ) {
      livingDurationChoice = row.livingDuration;
      syncLivingDurationUiOnly(livingDurationChoice);
      if (!silent && onLivingDurationChange) {
        onLivingDurationChange(livingDurationChoice);
      }
    }

    if (row.leavingYear !== undefined) {
      leavingYearValue = String(row.leavingYear).replace(/\D/g, "").slice(0, 4);
      var leavingYearInput = document.getElementById("identity-leaving-year-input");
      if (leavingYearInput) leavingYearInput.value = leavingYearValue;
      if (!silent && onLeavingYearChange) onLeavingYearChange(leavingYearValue);
    }

    if (row.from !== undefined) {
      fromValue = normalizeProfileEnglishText(row.from);
      var fromInput = document.getElementById("identity-from-input");
      if (fromInput) fromInput.value = fromValue;
      if (!silent && onFromChange) onFromChange(fromValue);
    }

    if (row.nowIn !== undefined) {
      nowInValue = normalizeProfileEnglishText(row.nowIn);
      var nowInInput = document.getElementById("identity-now-in-input");
      if (nowInInput) nowInInput.value = nowInValue;
      if (!silent && onNowInChange) onNowInChange(nowInValue);
    }

    if (row.name !== undefined) {
      nameValue = normalizeProfileEnglishText(row.name);
      var nameInput = document.getElementById("identity-name-input");
      if (nameInput) nameInput.value = nameValue;
    }

    if (
      row.nameDisplayMode === "anonymous" ||
      row.nameDisplayMode === "initials" ||
      row.nameDisplayMode === "name"
    ) {
      nameDisplayMode = row.nameDisplayMode;
      syncNameDisplayModeUiOnly(nameDisplayMode);
    }

    if (row.age !== undefined) {
      ageValue = String(row.age).replace(/\D/g, "").slice(0, 2);
      var ageInput = document.getElementById("identity-age-input");
      if (ageInput) ageInput.value = ageValue;
      if (!silent && onAgeChange) onAgeChange(ageValue);
    }

    if (
      row.homeAt === "inIran" ||
      row.homeAt === "whereILive" ||
      row.homeAt === "nowhere"
    ) {
      homeAtChoice = row.homeAt;
      syncHomeAtUiOnly(homeAtChoice);
      if (!silent && onHomeAtChange) onHomeAtChange(homeAtChoice);
    }

    if (!silent && onNameChange) onNameChange();
  }

  function init() {
    initLivingInIranToggle();
    initLivingDurationPicker();
    initAgeInput();
    initLeavingYearInput();
    initNameInput();
    initNameDisplayModeToggle();
    initFromAndNowInInputs();
    initHomeAtPicker();
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
    /** @returns {"smallPart" | "partOfLife" | "mostAll"} */
    getLivingDuration: function () {
      return livingDurationChoice;
    },
    /** @param {(choice: "smallPart" | "partOfLife" | "mostAll") => void} fn */
    setOnLivingDurationChange: function (fn) {
      onLivingDurationChange = fn;
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
    /** @returns {"inIran" | "whereILive" | "nowhere"} */
    getHomeAt: function () {
      return homeAtChoice;
    },
    /** @param {(choice: "inIran" | "whereILive" | "nowhere") => void} fn */
    setOnHomeAtChange: function (fn) {
      onHomeAtChange = fn;
    },
    /**
     * @param {Record<string, string>} row
     * @param {{ silent?: boolean }} [options]
     */
    applyProfileState: applyProfileState,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

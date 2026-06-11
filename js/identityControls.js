(function () {
  "use strict";

  /** @type {null | boolean} true = Yes; false = No */
  var livingInIranChoice = null;
  /** @type {((choice: null | boolean) => void) | null} */
  var onLivingInIranChange = null;
  /** @type {null | "smallPart" | "partOfLife" | "mostAll"} */
  var livingDurationChoice = null;
  /** @type {((choice: "smallPart" | "partOfLife" | "mostAll") => void) | null} */
  var onLivingDurationChange = null;
  /** @type {string} */
  var ageValue = "";
  /** @type {((value: string) => void) | null} */
  var onAgeChange = null;
  /** @type {string} */
  var fromValue = "";
  /** @type {string} */
  var nowInValue = "";
  /** @type {((value: string) => void) | null} */
  var onFromChange = null;
  /** @type {((value: string) => void) | null} */
  var onNowInChange = null;
  /** @type {string} */
  var leavingYearValue = "";
  /** @type {((value: string) => void) | null} */
  var onLeavingYearChange = null;
  /** @type {string} */
  var nameValue = "";
  /** @type {null | "initials" | "anonymous" | "name"} */
  var nameDisplayMode = null;
  /** @type {(() => void) | null} */
  var onNameChange = null;
  /** @type {null | "inIran" | "whereILive" | "nowhere"} */
  var homeAtChoice = null;
  /** @type {((choice: "inIran" | "whereILive" | "nowhere") => void) | null} */
  var onHomeAtChange = null;
  /** @type {(() => void) | null} */
  var onProgressChange = null;

  /** @type {Record<string, boolean>} */
  var userTouched = {
    livingInIran: false,
    livingDuration: false,
    leavingYear: false,
    from: false,
    nowIn: false,
    name: false,
    age: false,
    homeAt: false,
  };

  function notifyProgress() {
    if (onProgressChange) onProgressChange();
    if (
      typeof window.SectionProgression !== "undefined" &&
      window.SectionProgression.notifyProgressChange
    ) {
      window.SectionProgression.notifyProgressChange();
    }
  }

  function markTouched(id) {
    if (userTouched[id]) return;
    userTouched[id] = true;
    notifyProgress();
  }

  function isLivingInIranYes() {
    return livingInIranChoice === true;
  }

  function getRequiredRubricks() {
    var required = [
      "livingInIran",
      "from",
      "nowIn",
      "name",
      "age",
      "homeAt",
    ];
    if (isLivingInIranYes()) {
      required.push("livingDuration", "leavingYear");
    }
    return required;
  }

  function isRubrickComplete(id) {
    if (!userTouched[id]) return false;
    switch (id) {
      case "livingInIran":
        return livingInIranChoice === true || livingInIranChoice === false;
      case "livingDuration":
        if (!isLivingInIranYes()) return true;
        return (
          livingDurationChoice === "smallPart" ||
          livingDurationChoice === "partOfLife" ||
          livingDurationChoice === "mostAll"
        );
      case "leavingYear":
        if (!isLivingInIranYes()) return true;
        return leavingYearValue.length === 4;
      case "from":
        return String(fromValue || "").trim().length > 0;
      case "nowIn":
        return String(nowInValue || "").trim().length > 0;
      case "homeAt":
        return (
          homeAtChoice === "inIran" ||
          homeAtChoice === "whereILive" ||
          homeAtChoice === "nowhere"
        );
      case "age":
        return String(ageValue || "").trim().length > 0;
      case "name":
        if (nameDisplayMode === "anonymous") return true;
        if (nameDisplayMode === "initials" || nameDisplayMode === "name") {
          return String(nameValue || "").trim().length > 0;
        }
        return false;
      default:
        return false;
    }
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
      markTouched("livingInIran");
      applyUi(livingInIranChoice);
      if (onLivingInIranChange) onLivingInIranChange(livingInIranChoice);
      notifyProgress();
    }

    applyUi(null);
    if (leavingYearField) leavingYearField.setAttribute("hidden", "");
    if (livingDurationField) livingDurationField.setAttribute("hidden", "");

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
      if (digitsOnly.length > 0) markTouched("age");
      if (onAgeChange) onAgeChange(ageValue);
      notifyProgress();
    }

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
      if (digitsOnly.length === 4) markTouched("leavingYear");
      if (onLeavingYearChange) onLeavingYearChange(leavingYearValue);
      notifyProgress();
    }

    leavingYearInput.addEventListener("input", syncLeavingYear);
  }

  /**
   * Profile text fields: English letters and spaces only, always uppercase.
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
   * @param {string} rubricId
   * @param {((value: string) => void) | null} onChange
   */
  function initProfileTextField(inputId, setValue, rubricId, onChange) {
    var input = document.getElementById(inputId);
    if (!input) return;

    function sync() {
      var normalized = normalizeProfileEnglishText(input.value);
      if (input.value !== normalized) {
        input.value = normalized;
      }
      setValue(normalized);
      if (normalized.length > 0) markTouched(rubricId);
      if (onChange) onChange(normalized);
      notifyProgress();
    }

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
    if (nameDisplayMode === null) return "";
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
      "name",
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
      if (mode === "anonymous") {
        markTouched("name");
      } else if (String(nameValue || "").trim().length > 0) {
        markTouched("name");
      }
      if (onNameChange) onNameChange();
      notifyProgress();
    }

    applyUi(null);
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
      "from",
      function (value) {
        if (onFromChange) onFromChange(value);
      }
    );
    initProfileTextField(
      "identity-now-in-input",
      function (value) {
        nowInValue = value;
      },
      "nowIn",
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
      markTouched("livingDuration");
      applyUi(livingDurationChoice);
      if (onLivingDurationChange) onLivingDurationChange(livingDurationChoice);
      notifyProgress();
    }

    applyUi(null);

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
      markTouched("homeAt");
      applyUi(homeAtChoice);
      if (onHomeAtChange) onHomeAtChange(homeAtChoice);
      notifyProgress();
    }

    applyUi(null);

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
      userTouched.livingInIran = true;
      syncLivingInIranUiOnly(isYes);
      if (!silent && onLivingInIranChange) onLivingInIranChange(livingInIranChoice);
    }

    if (
      row.livingDuration === "smallPart" ||
      row.livingDuration === "partOfLife" ||
      row.livingDuration === "mostAll"
    ) {
      livingDurationChoice = row.livingDuration;
      userTouched.livingDuration = true;
      syncLivingDurationUiOnly(livingDurationChoice);
      if (!silent && onLivingDurationChange) {
        onLivingDurationChange(livingDurationChoice);
      }
    }

    if (row.leavingYear !== undefined) {
      leavingYearValue = String(row.leavingYear).replace(/\D/g, "").slice(0, 4);
      if (leavingYearValue.length === 4) userTouched.leavingYear = true;
      var leavingYearInput = document.getElementById("identity-leaving-year-input");
      if (leavingYearInput) leavingYearInput.value = leavingYearValue;
      if (!silent && onLeavingYearChange) onLeavingYearChange(leavingYearValue);
    }

    if (row.from !== undefined) {
      fromValue = normalizeProfileEnglishText(row.from);
      if (fromValue.length > 0) userTouched.from = true;
      var fromInput = document.getElementById("identity-from-input");
      if (fromInput) fromInput.value = fromValue;
      if (!silent && onFromChange) onFromChange(fromValue);
    }

    if (row.nowIn !== undefined) {
      nowInValue = normalizeProfileEnglishText(row.nowIn);
      if (nowInValue.length > 0) userTouched.nowIn = true;
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
      userTouched.name = true;
      syncNameDisplayModeUiOnly(nameDisplayMode);
    }

    if (row.age !== undefined) {
      ageValue = String(row.age).replace(/\D/g, "").slice(0, 2);
      if (ageValue.length > 0) userTouched.age = true;
      var ageInput = document.getElementById("identity-age-input");
      if (ageInput) ageInput.value = ageValue;
      if (!silent && onAgeChange) onAgeChange(ageValue);
    }

    if (row.homeAt !== undefined && row.homeAt !== "") {
      var homeAtValue = String(row.homeAt).trim();
      if (homeAtValue === "in betweeen" || homeAtValue === "in between") {
        homeAtValue = "nowhere";
      }
      if (
        homeAtValue === "inIran" ||
        homeAtValue === "whereILive" ||
        homeAtValue === "nowhere"
      ) {
        homeAtChoice = homeAtValue;
        userTouched.homeAt = true;
        syncHomeAtUiOnly(homeAtChoice);
        if (!silent && onHomeAtChange) onHomeAtChange(homeAtChoice);
      }
    }

    if (!silent && onNameChange) onNameChange();
    if (!silent) notifyProgress();
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
    /** @returns {null | "smallPart" | "partOfLife" | "mostAll"} */
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
    /** @returns {null | "initials" | "anonymous" | "name"} */
    getNameDisplayMode: function () {
      return nameDisplayMode;
    },
    /** @param {() => void} fn */
    setOnNameChange: function (fn) {
      onNameChange = fn;
    },
    /** @returns {null | "inIran" | "whereILive" | "nowhere"} */
    getHomeAt: function () {
      return homeAtChoice;
    },
    /** @param {(choice: "inIran" | "whereILive" | "nowhere") => void} fn */
    setOnHomeAtChange: function (fn) {
      onHomeAtChange = fn;
    },
    /** @param {string} id */
    isRubrickTouched: function (id) {
      return !!userTouched[id];
    },
    /** @param {string} id */
    isRubrickComplete: function (id) {
      return isRubrickComplete(id);
    },
    getRequiredRubricks: getRequiredRubricks,
    /** @param {() => void} fn */
    onProgressChange: function (fn) {
      onProgressChange = fn;
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

(function () {
  "use strict";

  var TRANSITION_MS = 450;
  var STAGGER_MS = 80;
  // Start enter before exit fully finishes (~55% through exit duration).
  var ENTER_START_AFTER_EXIT_MS = Math.round(TRANSITION_MS * 0.55);

  var TYPEWRITER_TOTAL_MS = 2000;
  var TYPEWRITER_LINE_PAUSE_RATIO = 0.15;
  var TYPEWRITER_BLANK_CHARS = { short: 2, medium: 3, long: 4 };

  var profileTypewriterPlayed = false;
  /** @type {{ cancel: function(): void, isCancelled: function(): boolean, wait: function(number, function(boolean): void): void } | null} */
  var profileTypewriterController = null;
  /** @type {{ madlibsEl: HTMLElement, lines: Array<{ lineEl: HTMLElement, segments: Array }> } | null} */
  var profileTypewriterState = null;

  /** @type {HTMLElement | null} */
  var scrollEl = null;

  /** @type {HTMLElement | null} */
  var stackEl = null;

  /** @type {HTMLElement | null} */
  var panelEl = null;

  /** @type {HTMLElement | null} */
  var panelGridEl = null;

  /** @type {number} */
  var currentSectionIndex = 0;

  /** @type {boolean} */
  var scrollSnapAnimating = false;

  var SCROLL_SNAP_ANIM_MS = 420;
  var INTRO_SLIDE_MS = 550;

  /** @type {number} */
  var sectionPageLockUntil = 0;

  var SECTION_PAGE_LOCK_MS = SCROLL_SNAP_ANIM_MS;

  /** @type {number | null} */
  var canvasTransitionRafId = null;

  /** @type {{ fromIndex: number, toIndex: number, progress: number }} */
  var sectionCanvasTransition = { fromIndex: 0, toIndex: 0, progress: 0 };

  /** @type {HTMLElement | null} */
  var sectionLabelEl = null;

  /** @type {HTMLElement | null} */
  var remainingEl = null;

  /** @type {HTMLElement | null} */
  var activeStepEl = null;

  /** @type {string | null} */
  var currentStepId = null;

  /** @type {string | null} */
  var displayStepId = null;

  /** @type {HTMLElement | null} */
  var activePalettePickerGroup = null;

  /** @type {HTMLElement | null} */
  var activeMadlibsDropdown = null;

  var madlibsDropdownDismissRegistered = false;

  /** @type {HTMLElement | null} */
  var madlibsBlankSizer = null;

  /** @type {null | function(): void} */
  var syncNameModeDropdownLabels = null;

  var palettesLoadedHookRegistered = false;

  function focusWithoutScroll(el) {
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
  }

  var answers = createDefaultAnswers();

  /** @type {"en" | "fa"} */
  var questionnaireLocale = "en";

  function getStrings() {
    if (
      window.QuestionnaireStrings &&
      window.QuestionnaireStrings[questionnaireLocale]
    ) {
      return window.QuestionnaireStrings[questionnaireLocale];
    }
    return window.QuestionnaireStrings
      ? window.QuestionnaireStrings.en
      : { ui: {}, steps: {}, sectionLabels: {}, feelings: {}, madLibs: {} };
  }

  function getUiString(key) {
    return getStrings().ui[key];
  }

  function getSectionLabels() {
    return getStrings().sectionLabels;
  }

  function getFeelingsTableRows() {
    return getStrings().feelings.tableRows;
  }

  function getFeelingsScaleLabels() {
    return getStrings().feelings.scaleLabels;
  }

  function getStepConfig(stepId) {
    var meta = STEP_META[stepId];
    var str = getStrings().steps[stepId];
    if (!meta) return null;

    var cfg = {
      letter: meta.letter,
      type: meta.type,
      hideHeading: meta.hideHeading,
      wrap: meta.wrap,
      english: meta.english,
      inputMode: meta.inputMode,
      maxLength: meta.maxLength,
      min: meta.min,
      max: meta.max,
      step: meta.step,
      outputSuffix: meta.outputSuffix,
      sync: meta.sync,
    };

    if (str) {
      if (str.label !== undefined) cfg.label = str.label;
      if (str.placeholder !== undefined) cfg.placeholder = str.placeholder;
      if (str.ariaLabel !== undefined) cfg.ariaLabel = str.ariaLabel;
      if (str.modeAriaLabel !== undefined) cfg.modeAriaLabel = str.modeAriaLabel;
      if (str.rangeLabels) cfg.rangeLabels = str.rangeLabels.slice();
      if (str.options && meta.options) {
        cfg.options = meta.options.map(function (opt) {
          return {
            value: opt.value,
            label: str.options[opt.value] || opt.value,
          };
        });
      }
      if (str.modes && meta.modes) {
        cfg.modes = meta.modes.map(function (mode) {
          return {
            value: mode.value,
            label: str.modes[mode.value] || mode.value,
          };
        });
      }
    }

    return cfg;
  }

  function setDesignStartButtonsDisabled(disabled) {
    var btnEn = document.getElementById("design-start-btn-en");
    var btnFa = document.getElementById("design-start-btn-fa");
    if (btnEn) btnEn.disabled = disabled;
    if (btnFa) btnFa.disabled = disabled;
  }

  /** Label-bar / canvas name text — always English, independent of questionnaire UI locale. */
  function getNameLabelTextForCanvas() {
    if (answers.nameDisplayMode === "anonymous") return "ANONYMOUS";
    var trimmed = String(answers.name || "").trim();
    if (answers.nameDisplayMode === "initials") {
      return trimmed ? formatNameInitials(trimmed) : "";
    }
    if (answers.nameDisplayMode === "name") return trimmed;
    return "";
  }

  function ensureQuestionnaireCanvasDirection() {
    var canvasHost = document.getElementById("questionnaire-canvas-host");
    if (!canvasHost) return;
    canvasHost.lang = "en";
    canvasHost.dir = "ltr";
    var wrap = canvasHost.querySelector(".stage-wrap");
    if (wrap) {
      wrap.lang = "en";
      wrap.dir = "ltr";
    }
  }

  function applyQuestionnaireLocale(locale) {
    questionnaireLocale = locale === "fa" ? "fa" : "en";
    var panel = document.getElementById("questionnaire-panel");
    var scroll = document.getElementById("questionnaire-scroll");
    if (!panel) return;

    panel.removeAttribute("lang");
    panel.removeAttribute("dir");
    panel.classList.toggle(
      "questionnaire-panel--locale-fa",
      questionnaireLocale === "fa"
    );

    if (scroll) {
      scroll.lang = questionnaireLocale;
      scroll.dir = questionnaireLocale === "fa" ? "rtl" : "ltr";
    }

    ensureQuestionnaireCanvasDirection();
  }

  function resetQuestionnaireLocale() {
    questionnaireLocale = "en";
    var panel = document.getElementById("questionnaire-panel");
    var scroll = document.getElementById("questionnaire-scroll");
    var canvasHost = document.getElementById("questionnaire-canvas-host");
    if (panel) {
      panel.removeAttribute("lang");
      panel.removeAttribute("dir");
      panel.classList.remove("questionnaire-panel--locale-fa");
    }
    if (scroll) {
      scroll.lang = "en";
      scroll.dir = "ltr";
    }
    if (canvasHost) {
      canvasHost.removeAttribute("lang");
      canvasHost.removeAttribute("dir");
    }
  }

  function createDefaultAnswers() {
    return {
      livingInIran: null,
      livingDuration: null,
      leavingYear: "",
      from: "",
      nowIn: "",
      name: "",
      nameDisplayMode: "name",
      age: "",
      homeAt: null,
      gridType: "octagon",
      octagonsN: 5,
      innerScale: 5,
      palette:
        typeof DEFAULT_SHEET_PALETTE_NUM !== "undefined"
          ? DEFAULT_SHEET_PALETTE_NUM
          : 3,
      closeFamilyInIran: null,
      iranLossTypes: null,
      borderFrameDivisions: 2,
      borderSideWhiteFill: 50,
      fanLeaves: 5,
      angerVerticalLength: 0,
      anxietyVerticalStroke: 0,
      angerTriangleDensity: 0,
      hopeMode: "view",
      circleDensity: 0,
      longingCircleDensity: 0,
      griefCircleDensity: 0,
      strengthDensity: 0,
      autoMergeIntensity: 0,
      prideFillPercent: 0,
      guiltShameFillPercent: 0,
      helplessnessPercent: 0,
    };
  }

  function resetRecordToFalse(record) {
    var key;
    for (key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        record[key] = false;
      }
    }
  }

  function applyPanelDefaultsAfterReset() {
    if (
      typeof window.IdentityControls !== "undefined" &&
      window.IdentityControls.resetProfileState
    ) {
      window.IdentityControls.resetProfileState({ silent: true });
    }

    syncPaletteToPanel(answers.palette);

    if (
      typeof window.FamilyControls !== "undefined" &&
      window.FamilyControls.resetFamilyState
    ) {
      window.FamilyControls.resetFamilyState();
    }

    var stepId;
    for (stepId in PANEL_SLIDER_DOM) {
      if (!Object.prototype.hasOwnProperty.call(PANEL_SLIDER_DOM, stepId)) {
        continue;
      }
      var defaultValue = answers[stepId];
      if (defaultValue === undefined) continue;
      var domIds = PANEL_SLIDER_DOM[stepId];
      syncPanelSliderDom(domIds[0], domIds[1], defaultValue, true);
    }

    syncHopeModeToPanel(answers.hopeMode);

    if (window.UnderCoverComboBridge) {
      if (window.UnderCoverComboBridge.resetHopeMergeState) {
        window.UnderCoverComboBridge.resetHopeMergeState();
      }
      if (window.UnderCoverComboBridge.finalizeApplySilent) {
        window.UnderCoverComboBridge.finalizeApplySilent();
      }
    }
  }

  function restoreDesignStartAfterSubmit() {
    var sectionDesign = document.getElementById("section-design");
    var designStart = document.getElementById("design-start");
    var questionnairePanel = document.getElementById("questionnaire-panel");

    questionnaireStarted = false;
    introSlideActive = false;
    profileTypewriterPlayed = false;
    currentStepId = null;
    displayStepId = null;
    clearStack();
    restoreCanvasToAppShell();
    clearIntroSlideClasses(sectionDesign);

    if (sectionDesign) {
      sectionDesign.classList.remove("section-design--questionnaire-started");
    }
    if (designStart) {
      designStart.hidden = false;
      designStart.scrollTop = 0;
      designStart.style.transform = "";
    }
    if (questionnairePanel) {
      questionnairePanel.hidden = true;
      questionnairePanel.style.transform = "";
    }
    setDesignStartButtonsDisabled(false);
    resetQuestionnaireLocale();
    if (remainingEl) {
      remainingEl.textContent = "";
    }
  }

  function resetQuestionnaireAfterSubmit() {
    var defaults = createDefaultAnswers();
    var key;
    for (key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        answers[key] = defaults[key];
      }
    }

    resetRecordToFalse(profileStepsReached);
    resetRecordToFalse(gridStepsReached);
    resetRecordToFalse(colorStepsReached);
    resetRecordToFalse(familyStepsReached);
    resetRecordToFalse(bodyAutonomyStepsReached);
    resetRecordToFalse(feelingsStepsReached);
    resetRecordToFalse(sectionsPassed);

    currentProfileBlankId = "nameDisplayMode";
    activePalettePickerGroup = null;
    setTransitionLock(false);

    if (
      typeof window.SectionProgression !== "undefined" &&
      window.SectionProgression.resetQuestionnaireProgress
    ) {
      window.SectionProgression.resetQuestionnaireProgress();
    }

    applyPanelDefaultsAfterReset();
    restoreDesignStartAfterSubmit();
    triggerCanvasRender();
    if (typeof window.layoutStage === "function") {
      window.layoutStage();
    }
  }

  function navigateToArchiveAfterSubmit() {
    if (
      window.HandkerchiefArchive &&
      typeof window.HandkerchiefArchive.revealDesignArchive === "function"
    ) {
      window.HandkerchiefArchive.revealDesignArchive();
      return;
    }
    if (
      window.Page2Navigation &&
      typeof window.Page2Navigation.showSection === "function"
    ) {
      window.Page2Navigation.showSection(5);
    }
  }

  var PROFILE_STEP_ORDER = [
    "livingInIran",
    "livingDuration",
    "leavingYear",
    "from",
    "nowIn",
    "name",
    "age",
    "homeAt",
  ];

  var PROFILE_ALL_STEP_ID = "__profile_all__";

  var PROFILE_MADLIBS_BLANK_ORDER = [
    "nameDisplayMode",
    "name",
    "age",
    "livingDuration",
    "leavingYear",
    "from",
    "nowIn",
    "homeAt",
  ];

  /** @type {string} */
  var currentProfileBlankId = "nameDisplayMode";

  var GRID_STEP_ORDER = ["gridType", "octagonsN", "innerScale"];
  var GRID_ALL_STEP_ID = "__grid_all__";

  var COLORS_STEP_ORDER = ["palette"];

  /** Family section: questions drive hidden frame / margin sliders via FamilyControls. */
  var FAMILY_STEP_ORDER = ["closeFamilyInIran", "iranLossTypes"];
  var FAMILY_ALL_STEP_ID = "__family_all__";

  var BODY_AUTONOMY_STEP_ORDER = ["fanLeaves"];

  var FEELINGS_ALL_STEP_ID = "__feelings_all__";
  var SUBMIT_ORDER_STEP_ID = "__submit_order__";

  var FEELINGS_STEP_ORDER = [
    "angerVerticalLength",
    "anxietyVerticalStroke",
    "angerTriangleDensity",
    "hopeMode",
    "circleDensity",
    "longingCircleDensity",
    "griefCircleDensity",
    "strengthDensity",
    "autoMergeIntensity",
    "prideFillPercent",
    "guiltShameFillPercent",
    "helplessnessPercent",
  ];

  /** Emotion groups (headings unused in current UI; kept for reference). */
  var FEELINGS_EMOTION_GROUPS = [
    {
      heading: "Fear",
      controls: [
        { stepId: "angerVerticalLength" },
        { stepId: "anxietyVerticalStroke", subLabel: "Anxiety / Tension" },
      ],
    },
    {
      heading: "Anger",
      controls: [{ stepId: "angerTriangleDensity" }],
    },
    {
      heading: "Hope",
      controls: [{ stepId: "hopeMode", type: "choice" }],
    },
    {
      heading: "Sadness",
      controls: [{ stepId: "circleDensity" }],
    },
    {
      heading: "Longing",
      controls: [{ stepId: "longingCircleDensity" }],
    },
    {
      heading: "Grief",
      controls: [{ stepId: "griefCircleDensity" }],
    },
    {
      heading: "Strength / Power",
      controls: [{ stepId: "strengthDensity" }],
    },
    {
      heading: "Pride",
      controls: [{ stepId: "autoMergeIntensity" }],
    },
    {
      heading: "Pain",
      controls: [{ stepId: "prideFillPercent" }],
    },
    {
      heading: "Guilt / Shame",
      controls: [{ stepId: "guiltShameFillPercent" }],
    },
    {
      heading: "Helplessness",
      controls: [{ stepId: "helplessnessPercent" }],
    },
  ];

  var FEELINGS_SLIDER_BOUNDS = {
    angerVerticalLength: [0, 30],
    anxietyVerticalStroke: [0, 100],
    angerTriangleDensity: [0, 30],
    circleDensity: [0, 30],
    longingCircleDensity: [0, 30],
    griefCircleDensity: [0, 30],
    strengthDensity: [0, 30],
    autoMergeIntensity: [0, 7],
    prideFillPercent: [0, 30],
    guiltShameFillPercent: [0, 30],
    helplessnessPercent: [0, 30],
  };

  /**
   * Emotion couplings for the feelings spider chart: a source emotion can floor
   * a target emotion. Anxiety partially "parents" Fear -- once Anxiety reaches
   * step 2+, Fear can never be below step 2 (there is no anxiety without fear).
   */
  var FEELINGS_COUPLINGS = [
    {
      sourceStepId: "anxietyVerticalStroke",
      sourceMinStep: 2,
      targetStepId: "angerVerticalLength",
      targetFloorStep: 2,
    },
  ];

  var GRID_BTN_IDS = {
    octagon: "grid-choose-octagon-btn",
    star: "grid-choose-star-btn",
    circles: "grid-choose-circles-btn",
    diamonds: "grid-choose-diamonds-btn",
  };

  var PANEL_SLIDER_DOM = {
    octagonsN: ["octagons-n", "octagons-n-out"],
    innerScale: ["inner-scale", "inner-scale-out"],
    borderFrameDivisions: [
      "border-frame-divisions",
      "border-frame-divisions-out",
    ],
    borderSideWhiteFill: [
      "border-side-white-fill",
      "border-side-white-fill-out",
    ],
    fanLeaves: ["fan-leaves", null],
    angerVerticalLength: ["anger-vertical-length", "anger-vertical-length-out"],
    anxietyVerticalStroke: [
      "anxiety-vertical-stroke",
      "anxiety-vertical-stroke-out",
    ],
    angerTriangleDensity: [
      "anger-triangle-density",
      "anger-triangle-density-out",
    ],
    circleDensity: ["circle-density", "circle-density-out"],
    longingCircleDensity: [
      "longing-circle-density",
      "longing-circle-density-out",
    ],
    griefCircleDensity: ["grief-circle-density", "grief-circle-density-out"],
    strengthDensity: ["strength-density", "strength-density-out"],
    autoMergeIntensity: ["auto-merge-intensity", "auto-merge-intensity-out"],
    prideFillPercent: ["pride-fill-percent", "pride-fill-percent-out"],
    guiltShameFillPercent: [
      "guilt-shame-fill-percent",
      "guilt-shame-fill-percent-out",
    ],
    helplessnessPercent: ["helplessness-percent", "helplessness-percent-out"],
  };

  /** @type {Record<string, boolean>} */
  var profileStepsReached = {
    livingInIran: false,
    livingDuration: false,
    leavingYear: false,
    from: false,
    nowIn: false,
    nameDisplayMode: false,
    name: false,
    age: false,
    homeAt: false,
  };

  /** @type {Record<string, boolean>} */
  var gridStepsReached = {
    __grid_all__: false,
    gridType: false,
    octagonsN: false,
    innerScale: false,
  };

  /** @type {Record<string, boolean>} */
  var colorStepsReached = {
    palette: false,
  };

  /** @type {Record<string, boolean>} */
  var familyStepsReached = {
    __family_all__: false,
    closeFamilyInIran: false,
    iranLossTypes: false,
  };

  /** @type {Record<string, boolean>} */
  var bodyAutonomyStepsReached = {
    fanLeaves: false,
  };

  /** @type {Record<string, boolean>} */
  var feelingsStepsReached = {
    __feelings_all__: false,
    angerVerticalLength: false,
    anxietyVerticalStroke: false,
    angerTriangleDensity: false,
    hopeMode: false,
    circleDensity: false,
    longingCircleDensity: false,
    griefCircleDensity: false,
    strengthDensity: false,
    autoMergeIntensity: false,
    prideFillPercent: false,
    guiltShameFillPercent: false,
    helplessnessPercent: false,
  };

  /** Sections the user has finished and moved past (drives filled progress dots). */
  var sectionsPassed = {
    profile: false,
    grid: false,
    colors: false,
    family: false,
    bodyAutonomy: false,
    feelings: false,
    submitOrder: false,
  };

  var STEP_META = {
    livingInIran: {
      letter: "A",
      type: "yesno",
    },
    livingDuration: {
      letter: "B",
      type: "choice",
      wrap: true,
      options: [
        { value: "smallPart" },
        { value: "partOfLife" },
        { value: "mostAll" },
      ],
    },
    leavingYear: {
      letter: "C",
      type: "text",
      inputMode: "numeric",
      maxLength: 4,
    },
    from: {
      letter: "D",
      type: "text",
      english: true,
    },
    nowIn: {
      letter: "E",
      type: "text",
      english: true,
    },
    name: {
      letter: "F",
      type: "name",
      modes: [
        { value: "anonymous" },
        { value: "name" },
      ],
    },
    age: {
      letter: "G",
      type: "text",
      inputMode: "numeric",
      maxLength: 2,
    },
    homeAt: {
      letter: "H",
      type: "choice",
      wrap: true,
      options: [
        { value: "inIran" },
        { value: "whereILive" },
        { value: "nowhere" },
      ],
    },
    gridType: {
      letter: "",
      hideHeading: true,
      type: "choice",
      options: [
        { value: "octagon" },
        { value: "star" },
        { value: "circles" },
        { value: "diamonds" },
      ],
    },
    octagonsN: {
      letter: "",
      type: "slider",
      min: 1,
      max: 10,
      step: 1,
      wrap: true,
    },
    innerScale: {
      letter: "",
      type: "slider",
      min: 1,
      max: 10,
      step: 1,
      wrap: true,
    },
    palette: {
      letter: "",
      type: "palette-picker",
    },
    borderFrameDivisions: {
      letter: "",
      type: "slider",
      min: 1,
      max: 3,
      step: 1,
    },
    borderSideWhiteFill: {
      letter: "",
      type: "slider",
      min: 0,
      max: 100,
      step: 25,
      outputSuffix: "%",
    },
    closeFamilyInIran: {
      letter: "",
      type: "choice",
      wrap: true,
      options: [
        { value: "largePart" },
        { value: "someMembers" },
        { value: "almostAllOutside" },
      ],
    },
    iranLossTypes: {
      letter: "",
      type: "multi-choice",
      wrap: true,
      options: [
        { value: "lovedOne" },
        { value: "place" },
        { value: "languageCulture" },
        { value: "freedomOfMovement" },
        { value: "familyFriendsConnection" },
      ],
    },
    fanLeaves: {
      letter: "",
      type: "slider",
      min: 0,
      max: 10,
      step: 1,
      wrap: true,
    },
    angerVerticalLength: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
      wrap: true,
    },
    anxietyVerticalStroke: {
      letter: "",
      type: "slider",
      min: 0,
      max: 100,
      step: 25,
      wrap: true,
    },
    angerTriangleDensity: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
    },
    hopeMode: {
      letter: "",
      type: "choice",
      options: [{ value: "view" }, { value: "merge" }],
    },
    circleDensity: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
    },
    longingCircleDensity: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
    },
    griefCircleDensity: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
    },
    strengthDensity: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
      wrap: true,
    },
    autoMergeIntensity: {
      letter: "",
      type: "slider",
      min: 0,
      max: 7,
      step: 1.75,
    },
    prideFillPercent: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
    },
    guiltShameFillPercent: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
      wrap: true,
    },
    helplessnessPercent: {
      letter: "",
      type: "slider",
      min: 0,
      max: 30,
      step: 7.5,
    },
  };

  function isLivingInIranYes() {
    return answers.livingInIran === true;
  }

  function ensureLivingInIranFromProfileAnswers() {
    if (answers.livingInIran === true || answers.livingInIran === false) {
      return;
    }
    var hasDuration =
      answers.livingDuration === "smallPart" ||
      answers.livingDuration === "partOfLife" ||
      answers.livingDuration === "mostAll";
    var hasLeavingYear = String(answers.leavingYear || "").trim().length > 0;
    if (hasDuration || hasLeavingYear) {
      answers.livingInIran = true;
    }
  }

  function isStepSkipped(stepId) {
    if (stepId === "livingDuration" || stepId === "leavingYear") {
      return !isLivingInIranYes();
    }
    return false;
  }

  function isProfileStep(stepId) {
    return (
      stepId === PROFILE_ALL_STEP_ID ||
      PROFILE_STEP_ORDER.indexOf(stepId) >= 0
    );
  }

  function shouldShowNameTextInput() {
    return (
      answers.nameDisplayMode === "initials" ||
      answers.nameDisplayMode === "name"
    );
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

  /**
   * @param {null | string} mode
   * @param {string} nameValue
   * @returns {string}
   */
  function getNameModeDisplayLabel(mode, nameValue) {
    var modes = getUiString("nameModes") || {};
    if (mode === "anonymous") return modes.anonymous || "Anonymous";
    var trimmed = String(nameValue || "").trim();
    if (mode === "initials") {
      return trimmed ? formatNameInitials(trimmed) : modes.initials || "Initials";
    }
    if (mode === "name") return trimmed || modes.name || "Name";
    return "";
  }

  function isProfileMadlibsBlank(stepId) {
    return PROFILE_MADLIBS_BLANK_ORDER.indexOf(stepId) >= 0;
  }

  function syncMadlibsFieldFromDom(stepId) {
    if (!activeStepEl) return;
    var el = activeStepEl.querySelector('[data-step-id="' + stepId + '"]');
    if (!el) return;
    if (el.classList.contains("questionnaire-madlibs-dropdown")) {
      var dropdownValue = el.getAttribute("data-value");
      if (dropdownValue) answers[stepId] = dropdownValue;
      return;
    }
    if (el.tagName === "INPUT" && !el.disabled && !el.readOnly) {
      answers[stepId] = normalizeProfileAnswerInputValue(
        /** @type {HTMLInputElement} */ (el)
      );
      return;
    }
    if (el.tagName === "SELECT" && el.value) {
      answers[stepId] = el.value;
    }
  }

  function syncProfileMadlibsAnswersFromDom() {
    if (!activeStepEl) return;
    var i;
    for (i = 0; i < PROFILE_MADLIBS_BLANK_ORDER.length; i++) {
      syncMadlibsFieldFromDom(PROFILE_MADLIBS_BLANK_ORDER[i]);
    }
    ensureLivingInIranFromProfileAnswers();
  }

  function isAllProfileComplete() {
    syncProfileMadlibsAnswersFromDom();
    var i;
    for (i = 0; i < PROFILE_MADLIBS_BLANK_ORDER.length; i++) {
      if (!isStepComplete(PROFILE_MADLIBS_BLANK_ORDER[i])) {
        return false;
      }
    }
    return true;
  }

  function getNextProfileBlank(fromId) {
    var idx = PROFILE_MADLIBS_BLANK_ORDER.indexOf(fromId);
    if (idx < 0) return PROFILE_MADLIBS_BLANK_ORDER[0];
    if (fromId === "nameDisplayMode") {
      if (shouldShowNameTextInput()) return "name";
      return "age";
    }
    if (idx + 1 < PROFILE_MADLIBS_BLANK_ORDER.length) {
      return PROFILE_MADLIBS_BLANK_ORDER[idx + 1];
    }
    return null;
  }

  function updateCardAccessibilityForProfile() {
    if (!displayStepId) return;
    updateCardAccessibility(displayStepId);
  }

  function syncProfileBlankReached(stepId) {
    syncProfileMadlibsAnswersFromDom();
    if (stepId === "homeAt") {
      updateProfileMadlibsFieldIcon("homeAt");
    }
    if (stepId === "livingDuration") {
      updateProfileMadlibsFieldIcon("livingDuration");
    }
    if (isStepComplete(stepId)) {
      profileStepsReached[stepId] = true;
      try {
        syncToPanel();
        triggerCanvasUpdateAfterSync(stepId);
      } catch (err) {
        console.warn("[Questionnaire] Profile sync failed:", err);
      }
    }
    checkSectionCompletion("profile");
    updateCardAccessibilityForProfile();
  }

  function getProfileNameInlineInput() {
    if (!activeStepEl) return null;
    return activeStepEl.querySelector(
      ".questionnaire-madlibs-name-mode__input[data-step-id='name']"
    );
  }

  function focusProfileBlank(stepId) {
    if (!activeStepEl) return;
    if (stepId === "name" && !shouldShowNameTextInput()) {
      stepId = "nameDisplayMode";
    }
    if (stepId === "name" || stepId === "nameDisplayMode") {
      var inlineNameInput = getProfileNameInlineInput();
      if (inlineNameInput) {
        currentProfileBlankId = shouldShowNameTextInput()
          ? "name"
          : "nameDisplayMode";
        focusWithoutScroll(inlineNameInput);
        updateCardAccessibilityForProfile();
        return;
      }
    }
    currentProfileBlankId = stepId;
    var el = activeStepEl.querySelector('[data-step-id="' + stepId + '"]');
    if (el) {
      if (el.classList.contains("questionnaire-madlibs-dropdown")) {
        var trigger = el.querySelector(
          ".questionnaire-madlibs-dropdown__trigger:not([hidden])"
        );
        if (trigger) focusWithoutScroll(trigger);
      } else {
        focusWithoutScroll(el);
      }
      updateCardAccessibilityForProfile();
    }
  }

  function focusProfileContinueBtn() {
    checkSectionCompletion("profile");
  }

  /** Profile + grid: keep large canvas zoom until Family section. */
  function isPreFamilyQuestionnaireStep(stepId) {
    return (
      stepId === PROFILE_ALL_STEP_ID ||
      isProfileStep(stepId) ||
      isGridStep(stepId)
    );
  }

  function isGridStep(stepId) {
    return (
      stepId === GRID_ALL_STEP_ID || GRID_STEP_ORDER.indexOf(stepId) >= 0
    );
  }

  function isColorStep(stepId) {
    return COLORS_STEP_ORDER.indexOf(stepId) >= 0;
  }

  function isFamilyStep(stepId) {
    return (
      stepId === FAMILY_ALL_STEP_ID || FAMILY_STEP_ORDER.indexOf(stepId) >= 0
    );
  }

  function isBodyAutonomyStep(stepId) {
    return BODY_AUTONOMY_STEP_ORDER.indexOf(stepId) >= 0;
  }

  function isFeelingsStep(stepId) {
    return (
      stepId === FEELINGS_ALL_STEP_ID ||
      FEELINGS_STEP_ORDER.indexOf(stepId) >= 0
    );
  }

  function isAllFeelingsComplete() {
    var i;
    for (i = 0; i < FEELINGS_STEP_ORDER.length; i++) {
      if (!isStepComplete(FEELINGS_STEP_ORDER[i])) {
        return false;
      }
    }
    return true;
  }

  function isAllGridComplete() {
    var i;
    for (i = 0; i < GRID_STEP_ORDER.length; i++) {
      if (!isStepComplete(GRID_STEP_ORDER[i])) {
        return false;
      }
    }
    return true;
  }

  function isAllFamilyComplete() {
    if (!FAMILY_STEP_ORDER.length) return true;
    var i;
    for (i = 0; i < FAMILY_STEP_ORDER.length; i++) {
      if (!isStepComplete(FAMILY_STEP_ORDER[i])) {
        return false;
      }
    }
    return true;
  }

  function isNumericInRange(value, min, max) {
    return (
      Number.isFinite(Number(value)) &&
      Number(value) >= min &&
      Number(value) <= max
    );
  }

  function getNextStepId(fromId) {
    if (!fromId) return PROFILE_ALL_STEP_ID;

    if (fromId === PROFILE_ALL_STEP_ID) {
      return GRID_ALL_STEP_ID;
    }

    if (isProfileStep(fromId)) {
      var startIndex = PROFILE_STEP_ORDER.indexOf(fromId) + 1;
      for (var i = startIndex; i < PROFILE_STEP_ORDER.length; i++) {
        var id = PROFILE_STEP_ORDER[i];
        if (!isStepSkipped(id)) return id;
      }
      return GRID_ALL_STEP_ID;
    }

    if (fromId === GRID_ALL_STEP_ID) {
      return FAMILY_ALL_STEP_ID;
    }

    if (isGridStep(fromId)) {
      var gridIndex = GRID_STEP_ORDER.indexOf(fromId) + 1;
      if (gridIndex < GRID_STEP_ORDER.length) {
        return GRID_STEP_ORDER[gridIndex];
      }
      return FAMILY_ALL_STEP_ID;
    }

    if (fromId === FAMILY_ALL_STEP_ID) {
      return "fanLeaves";
    }

    if (isFamilyStep(fromId)) {
      var familyIndex = FAMILY_STEP_ORDER.indexOf(fromId) + 1;
      if (familyIndex < FAMILY_STEP_ORDER.length) {
        return FAMILY_STEP_ORDER[familyIndex];
      }
      return "fanLeaves";
    }

    if (isBodyAutonomyStep(fromId)) {
      var bodyIndex = BODY_AUTONOMY_STEP_ORDER.indexOf(fromId) + 1;
      if (bodyIndex < BODY_AUTONOMY_STEP_ORDER.length) {
        return BODY_AUTONOMY_STEP_ORDER[bodyIndex];
      }
      return FEELINGS_ALL_STEP_ID;
    }

    if (fromId === FEELINGS_ALL_STEP_ID) {
      return "palette";
    }

    if (isColorStep(fromId)) {
      var colorIndex = COLORS_STEP_ORDER.indexOf(fromId) + 1;
      if (colorIndex < COLORS_STEP_ORDER.length) {
        return COLORS_STEP_ORDER[colorIndex];
      }
      return SUBMIT_ORDER_STEP_ID;
    }

    return null;
  }

  function isStepComplete(stepId) {
    switch (stepId) {
      case "livingInIran":
        return answers.livingInIran === true || answers.livingInIran === false;
      case "livingDuration":
        return (
          answers.livingDuration === "smallPart" ||
          answers.livingDuration === "partOfLife" ||
          answers.livingDuration === "mostAll"
        );
      case "leavingYear":
        return String(answers.leavingYear || "").length === 4;
      case "from":
        return String(answers.from || "").trim().length > 0;
      case "nowIn":
        return String(answers.nowIn || "").trim().length > 0;
      case "nameDisplayMode":
        return (
          answers.nameDisplayMode === "anonymous" ||
          answers.nameDisplayMode === "initials" ||
          answers.nameDisplayMode === "name"
        );
      case "name":
        if (answers.nameDisplayMode === "anonymous") return true;
        if (
          answers.nameDisplayMode === "initials" ||
          answers.nameDisplayMode === "name"
        ) {
          return String(answers.name || "").trim().length > 0;
        }
        return false;
      case "age":
        return String(answers.age || "").trim().length > 0;
      case "homeAt":
        return (
          answers.homeAt === "inIran" ||
          answers.homeAt === "whereILive" ||
          answers.homeAt === "nowhere"
        );
      case "gridType":
        return (
          answers.gridType === "octagon" ||
          answers.gridType === "star" ||
          answers.gridType === "circles" ||
          answers.gridType === "diamonds"
        );
      case "octagonsN":
        return (
          Number.isFinite(Number(answers.octagonsN)) &&
          Number(answers.octagonsN) >= 1 &&
          Number(answers.octagonsN) <= 10
        );
      case "innerScale":
        return (
          Number.isFinite(Number(answers.innerScale)) &&
          Number(answers.innerScale) >= 1 &&
          Number(answers.innerScale) <= 10
        );
      case "palette":
        return (
          Number.isFinite(Number(answers.palette)) &&
          Number(answers.palette) >= 1 &&
          Number(answers.palette) <= 12
        );
      case "borderFrameDivisions":
        return (
          Number.isFinite(Number(answers.borderFrameDivisions)) &&
          Number(answers.borderFrameDivisions) >= 1 &&
          Number(answers.borderFrameDivisions) <= 3
        );
      case "borderSideWhiteFill":
        return (
          Number.isFinite(Number(answers.borderSideWhiteFill)) &&
          Number(answers.borderSideWhiteFill) >= 0 &&
          Number(answers.borderSideWhiteFill) <= 100
        );
      case "closeFamilyInIran":
        return (
          answers.closeFamilyInIran === "largePart" ||
          answers.closeFamilyInIran === "someMembers" ||
          answers.closeFamilyInIran === "almostAllOutside"
        );
      case "iranLossTypes":
        return answers.iranLossTypes !== null;
      case "fanLeaves":
        return isNumericInRange(answers.fanLeaves, 0, 10);
      case "hopeMode":
        return answers.hopeMode === "view" || answers.hopeMode === "merge";
      default:
        if (FEELINGS_SLIDER_BOUNDS[stepId]) {
          var feelingsBounds = getQuestionnaireFeelingsBounds(stepId);
          if (!feelingsBounds) return false;
          return isNumericInRange(
            answers[stepId],
            feelingsBounds[0],
            feelingsBounds[1]
          );
        }
        return false;
    }
  }

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function buildProfileRow() {
    ensureLivingInIranFromProfileAnswers();
    var row = {};

    if (answers.livingInIran === true || answers.livingInIran === false) {
      row.livingInIran = answers.livingInIran;
      if (answers.livingInIran === false) {
        row.livingDuration = "";
        row.leavingYear = "";
      }
    }

    if (isLivingInIranYes()) {
      if (answers.livingDuration) {
        row.livingDuration = answers.livingDuration;
      }
      if (answers.leavingYear) {
        row.leavingYear = answers.leavingYear;
      }
    }

    if (answers.from) row.from = answers.from;
    if (answers.nowIn) row.nowIn = answers.nowIn;
    if (answers.name) row.name = answers.name;
    if (answers.nameDisplayMode) row.nameDisplayMode = answers.nameDisplayMode;
    if (answers.age) row.age = answers.age;
    if (answers.homeAt) row.homeAt = answers.homeAt;

    return row;
  }

  function triggerCanvasRender() {
    if (typeof window.render === "function") {
      window.render();
      return;
    }
    if (
      typeof window.SectionProgression !== "undefined" &&
      window.SectionProgression.notifySectionProgressChange
    ) {
      window.SectionProgression.notifySectionProgressChange();
    }
  }

  function isFeelingsSliderStep(stepId) {
    return Object.prototype.hasOwnProperty.call(FEELINGS_SLIDER_BOUNDS, stepId);
  }

  /**
   * Grid-aware min/max for questionnaire feelings (matches combo + panel sliders).
   * @param {string} stepId
   * @returns {[number, number]|null}
   */
  function getQuestionnaireFeelingsBounds(stepId) {
    if (
      window.UnderCoverComboBridge &&
      window.UnderCoverComboBridge.getFeelingsSliderBounds
    ) {
      var gridBounds =
        window.UnderCoverComboBridge.getFeelingsSliderBounds(stepId);
      if (gridBounds) {
        return [gridBounds.min, gridBounds.max];
      }
    }
    var bounds = FEELINGS_SLIDER_BOUNDS[stepId];
    if (!bounds) return null;
    return [bounds[0], bounds[1]];
  }

  function hasFeelingsProgress() {
    var stepId;
    for (stepId in feelingsStepsReached) {
      if (
        Object.prototype.hasOwnProperty.call(feelingsStepsReached, stepId) &&
        feelingsStepsReached[stepId]
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Feelings markers need applyFeelingsControlState (not render alone) when
   * slider values change without a grid layout change — same path as combos.
   */
  function ensureQuestionnaireGridReady() {
    if (!answers.gridType || !window.SectionProgression) return;
    if (window.SectionProgression.isGridTypeChosen()) return;
    // Don't auto-commit the (now pre-selected) default grid type before the
    // user has actually reached the grid section. This function runs while
    // building every section's card up front — including "feelings" — and
    // committing here would unlock the octagon grid on the headscarf during
    // earlier sections like the profile. Once the user has passed the grid
    // section, gridStepsReached.gridType is true and the commit proceeds, so
    // the grid stays visible when navigating back.
    if (!gridStepsReached.gridType && !gridStepsReached[GRID_ALL_STEP_ID]) {
      return;
    }
    syncGridTypeToPanel();
  }

  function buildQuestionnaireFeelingsPayload() {
    var payload = {};
    var i;
    for (i = 0; i < getFeelingsTableRows().length; i++) {
      payload[getFeelingsTableRows()[i].stepId] =
        answers[getFeelingsTableRows()[i].stepId];
    }
    return payload;
  }

  function applyQuestionnaireFeelingsToCanvas() {
    ensureQuestionnaireGridReady();
    ensureQuestionnaireCanvasUnlock(FEELINGS_ALL_STEP_ID);
    if (
      window.UnderCoverComboBridge &&
      window.UnderCoverComboBridge.applyFeelingsFromQuestionnaire
    ) {
      window.UnderCoverComboBridge.applyFeelingsFromQuestionnaire(
        buildQuestionnaireFeelingsPayload()
      );
      return;
    }
    triggerFeelingsCanvasUpdate();
  }

  // When `preview` is true we run the lightweight per-frame update used while a
  // slider is actively being dragged (skips the random reshuffle + label-bar
  // re-measure). The full commit (finalizeApply) runs once on release.
  function triggerFeelingsCanvasUpdate(preview) {
    var bridge = window.UnderCoverComboBridge;
    if (bridge) {
      if (preview && bridge.previewApply) {
        bridge.previewApply();
        return;
      }
      if (bridge.refreshQuestionnaireCanvas) {
        bridge.refreshQuestionnaireCanvas();
        return;
      }
      if (bridge.finalizeApply) {
        bridge.finalizeApply();
        return;
      }
    }
    triggerCanvasRender();
  }

  // Grid-structure sliders rebuild the full tessellation, which is very
  // expensive for the nested-star grid. While dragging, the panel slider's own
  // "input" listener already produces a fast raster bitmap preview
  // (scheduleSliderRender), so we skip the heavy vector render here and let the
  // "change" (release) handler run the single full render on the final value.
  function isGridStructureSliderStep(stepId) {
    return stepId === "octagonsN" || stepId === "innerScale";
  }

  function triggerCanvasUpdateAfterSync(stepId, preview) {
    ensureQuestionnaireGridReady();
    ensureQuestionnaireCanvasUnlock(stepId);
    if (preview && isGridStructureSliderStep(stepId)) {
      return;
    }
    if (isBodyAutonomyStep(stepId)) {
      triggerCanvasRender();
      return;
    }
    if (isFeelingsSliderStep(stepId) || isFeelingsStep(stepId)) {
      triggerFeelingsCanvasUpdate(preview);
      return;
    }
    if (hasFeelingsProgress()) {
      triggerFeelingsCanvasUpdate(preview);
      return;
    }
    triggerCanvasRender();
  }

  function syncFanLeavesToPanel(value, commit) {
    if (value === undefined || value === null || value === "") return;
    if (
      window.UnderCoverComboBridge &&
      typeof window.UnderCoverComboBridge.applyFanLeavesOpeningStep ===
        "function"
    ) {
      window.UnderCoverComboBridge.applyFanLeavesOpeningStep(value, !!commit);
      return;
    }
    var fanDom = PANEL_SLIDER_DOM.fanLeaves;
    syncPanelSliderDom(fanDom[0], fanDom[1], value, !!commit);
  }

  function scheduleFanLeavesSliderCanvasUpdate(stepId, value, preview, commit) {
    coalescedCanvasUpdate(function () {
      ensureQuestionnaireCanvasUnlock(stepId);
      syncFanLeavesToPanel(value, commit);
      triggerCanvasUpdateAfterSync(stepId, preview);
    });
  }

  // Coalesces rapid slider "input" events into at most one canvas update per
  // animation frame. While dragging a slider the browser fires many "input"
  // events (sometimes faster than the screen refreshes); running the full
  // (expensive) canvas re-render on every single one is what made dragging feel
  // stuck. We keep the cheap visual feedback (handle fill, output number)
  // synchronous and only defer the heavy canvas work. The latest value always
  // renders because the most recent scheduled callback is the one that runs.
  var coalescedCanvasUpdate = (function () {
    var frameId = 0;
    var pendingFn = null;
    var raf =
      (typeof window !== "undefined" && window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : function (cb) {
            return window.setTimeout(cb, 16);
          });
    return function scheduleCoalescedCanvasUpdate(fn) {
      pendingFn = fn;
      if (frameId) return;
      frameId = raf(function () {
        frameId = 0;
        var run = pendingFn;
        pendingFn = null;
        if (typeof run === "function") run();
      });
    };
  })();

  function ensureQuestionnaireCanvasUnlock(stepId) {
    if (!window.SectionProgression) return;
    if (
      isFamilyStep(stepId) ||
      isBodyAutonomyStep(stepId) ||
      isFeelingsStep(stepId)
    ) {
      if (window.SectionProgression.markFrameSectionEngaged) {
        window.SectionProgression.markFrameSectionEngaged();
      }
    }
    if (isBodyAutonomyStep(stepId) || isFeelingsStep(stepId)) {
      if (window.SectionProgression.markFanSectionEngaged) {
        window.SectionProgression.markFanSectionEngaged();
      }
    }
  }

  function markQuestionnaireProfileComplete() {
    if (
      typeof window.SectionProgression === "undefined" ||
      !window.SectionProgression.markQuestionnaireProfileComplete
    ) {
      return;
    }
    window.SectionProgression.markQuestionnaireProfileComplete();
  }

  function syncPanelSliderDom(sliderId, outputId, value, commit) {
    if (value === undefined || value === null || value === "") return;
    var slider = document.getElementById(sliderId);
    if (!slider) return;
    var panelStepId = null;
    var stepKey;
    for (stepKey in PANEL_SLIDER_DOM) {
      if (PANEL_SLIDER_DOM[stepKey][0] === sliderId) {
        panelStepId = stepKey;
        break;
      }
    }
    var domValue = value;
    var outputValue = value;
    if (panelStepId && isFeelingsSliderStep(panelStepId)) {
      var panelBounds = getQuestionnaireFeelingsBounds(panelStepId);
      if (panelBounds) {
        domValue = feelingsStepFromValue(
          Number(value),
          panelBounds[0],
          panelBounds[1]
        );
        outputValue = domValue;
      }
    }
    var nextValue = String(domValue);
    var valueChanged = slider.value !== nextValue;
    slider.value = nextValue;
    if (outputId) {
      var output = document.getElementById(outputId);
      if (output) output.textContent = String(outputValue);
    }
    if (valueChanged) {
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      if (commit) {
        slider.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function syncGridTypeToPanel() {
    if (!answers.gridType) return;
    var btnId = GRID_BTN_IDS[answers.gridType];
    var btn = btnId ? document.getElementById(btnId) : null;
    if (btn) btn.click();
  }

  function previewGridTypeOnCanvas() {
    if (!answers.gridType || typeof window.setGridType !== "function") return;
    window.setGridType(answers.gridType, { preview: true });
  }

  function syncGridToPanel() {
    if (gridStepsReached.gridType) {
      syncGridTypeToPanel();
    }
    if (gridStepsReached.octagonsN) {
      syncPanelSliderDom(
        "octagons-n",
        "octagons-n-out",
        answers.octagonsN,
        true
      );
    }
    if (gridStepsReached.innerScale) {
      syncPanelSliderDom(
        "inner-scale",
        "inner-scale-out",
        answers.innerScale,
        true
      );
    }
  }

  function syncPaletteToPanel(paletteNum) {
    var num = Number(paletteNum);
    if (!Number.isFinite(num) || num < 1 || num > 12) return;
    var key = "palette" + num;
    var btn = document.querySelector('[data-palette-key="' + key + '"]');
    if (btn) {
      btn.click();
      return;
    }
    if (
      typeof window.SheetPalettes !== "undefined" &&
      window.SheetPalettes.setActivePalette &&
      window.SheetPalettes.setActivePalette(key)
    ) {
      triggerCanvasRender();
    }
  }

  function syncColorsToPanel() {
    if (colorStepsReached.palette) {
      syncPaletteToPanel(answers.palette);
    }
  }

  function syncFamilyDerivedAnswers() {
    if (
      typeof window.FamilyControls !== "undefined" &&
      window.FamilyControls.getBorderFrameDivisions
    ) {
      answers.borderFrameDivisions =
        window.FamilyControls.getBorderFrameDivisions();
      answers.borderSideWhiteFill =
        window.FamilyControls.getBorderSideWhiteFill();
      return;
    }
    if (
      typeof window.FamilyControls !== "undefined" &&
      window.FamilyControls.borderFrameDivisionsFromCloseFamily
    ) {
      answers.borderFrameDivisions =
        window.FamilyControls.borderFrameDivisionsFromCloseFamily(
          answers.closeFamilyInIran
        );
      answers.borderSideWhiteFill =
        window.FamilyControls.borderSideWhiteFillFromLossTypes(
          answers.iranLossTypes
        );
    }
  }

  function applyFamilyAnswersToPanel(commit) {
    syncFamilyDerivedAnswers();
    if (
      typeof window.FamilyControls === "undefined" ||
      !window.FamilyControls.applyFamilyState
    ) {
      return;
    }
    window.FamilyControls.applyFamilyState(
      {
        closeFamilyInIran: answers.closeFamilyInIran,
        iranLossTypes: answers.iranLossTypes,
      },
      !commit
    );
  }

  function syncFamilyToPanel() {
    if (
      familyStepsReached.closeFamilyInIran ||
      familyStepsReached.iranLossTypes ||
      familyStepsReached[FAMILY_ALL_STEP_ID]
    ) {
      applyFamilyAnswersToPanel(true);
    }
  }

  function syncBodyAutonomyToPanel() {
    if (bodyAutonomyStepsReached.fanLeaves) {
      syncFanLeavesToPanel(answers.fanLeaves, true);
    }
  }

  function syncHopeModeToPanel(mode) {
    if (
      window.UnderCoverComboBridge &&
      typeof window.UnderCoverComboBridge.setHopeMode === "function"
    ) {
      window.UnderCoverComboBridge.setHopeMode(mode);
      return;
    }
    var btnId =
      mode === "merge" ? "hope-mode-merge-btn" : "hope-mode-view-btn";
    var btn = document.getElementById(btnId);
    if (btn) btn.click();
  }

  function syncFeelingsToPanel() {
    var stepId;
    for (stepId in feelingsStepsReached) {
      if (
        !Object.prototype.hasOwnProperty.call(feelingsStepsReached, stepId) ||
        !feelingsStepsReached[stepId]
      ) {
        continue;
      }
      if (stepId === "hopeMode") {
        syncHopeModeToPanel(answers.hopeMode);
        continue;
      }
      var domIds = PANEL_SLIDER_DOM[stepId];
      if (domIds) {
        syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], true);
      }
    }
  }

  function syncProfileToPanel() {
    if (
      typeof window.IdentityControls === "undefined" ||
      !window.IdentityControls.applyProfileState
    ) {
      return;
    }
    window.IdentityControls.applyProfileState(buildProfileRow());
  }

  function syncToPanel() {
    syncProfileToPanel();
    syncGridToPanel();
    syncColorsToPanel();
    syncFamilyToPanel();
    syncBodyAutonomyToPanel();
    syncFeelingsToPanel();
  }

  function markStepReached(stepId) {
    if (stepId === PROFILE_ALL_STEP_ID) {
      markAllProfileStepsReached();
      return;
    }
    if (isProfileStep(stepId)) {
      profileStepsReached[stepId] = true;
    }
    if (stepId === GRID_ALL_STEP_ID) {
      gridStepsReached[GRID_ALL_STEP_ID] = true;
      var gridIdx;
      for (gridIdx = 0; gridIdx < GRID_STEP_ORDER.length; gridIdx++) {
        gridStepsReached[GRID_STEP_ORDER[gridIdx]] = true;
      }
    } else if (isGridStep(stepId)) {
      gridStepsReached[stepId] = true;
    }
    if (isColorStep(stepId)) {
      colorStepsReached[stepId] = true;
    }
    if (stepId === FAMILY_ALL_STEP_ID) {
      familyStepsReached[FAMILY_ALL_STEP_ID] = true;
      var familyIdx;
      for (familyIdx = 0; familyIdx < FAMILY_STEP_ORDER.length; familyIdx++) {
        familyStepsReached[FAMILY_STEP_ORDER[familyIdx]] = true;
      }
    } else if (isFamilyStep(stepId)) {
      familyStepsReached[stepId] = true;
    }
    if (isBodyAutonomyStep(stepId)) {
      bodyAutonomyStepsReached[stepId] = true;
    }
    if (stepId === FEELINGS_ALL_STEP_ID) {
      feelingsStepsReached[FEELINGS_ALL_STEP_ID] = true;
      var feelingsIdx;
      for (feelingsIdx = 0; feelingsIdx < FEELINGS_STEP_ORDER.length; feelingsIdx++) {
        feelingsStepsReached[FEELINGS_STEP_ORDER[feelingsIdx]] = true;
      }
    } else if (isFeelingsStep(stepId)) {
      feelingsStepsReached[stepId] = true;
    }
  }

  var QUESTIONNAIRE_SECTION_ORDER = [
    { key: "profile", entryStepId: PROFILE_ALL_STEP_ID },
    { key: "grid", entryStepId: GRID_ALL_STEP_ID },
    { key: "family", entryStepId: FAMILY_ALL_STEP_ID },
    { key: "bodyAutonomy", entryStepId: "fanLeaves" },
    { key: "feelings", entryStepId: FEELINGS_ALL_STEP_ID },
    { key: "colors", entryStepId: "palette" },
    { key: "submitOrder", entryStepId: SUBMIT_ORDER_STEP_ID },
  ];

  function getSectionKeyFromStepId(stepId) {
    if (stepId === SUBMIT_ORDER_STEP_ID) {
      return "submitOrder";
    }
    if (
      stepId === FEELINGS_ALL_STEP_ID ||
      isFeelingsStep(stepId)
    ) {
      return "feelings";
    }
    if (isBodyAutonomyStep(stepId)) {
      return "bodyAutonomy";
    }
    if (stepId === FAMILY_ALL_STEP_ID || isFamilyStep(stepId)) {
      return "family";
    }
    if (isColorStep(stepId)) {
      return "colors";
    }
    if (stepId === GRID_ALL_STEP_ID || isGridStep(stepId)) {
      return "grid";
    }
    return "profile";
  }

  function getSectionIndex(sectionKey) {
    var i;
    for (i = 0; i < QUESTIONNAIRE_SECTION_ORDER.length; i++) {
      if (QUESTIONNAIRE_SECTION_ORDER[i].key === sectionKey) {
        return i;
      }
    }
    return -1;
  }

  function getCurrentSectionIndex(stepId) {
    return getSectionIndex(getSectionKeyFromStepId(stepId));
  }

  function getSectionEntryStepId(sectionKey) {
    var i;
    for (i = 0; i < QUESTIONNAIRE_SECTION_ORDER.length; i++) {
      if (QUESTIONNAIRE_SECTION_ORDER[i].key === sectionKey) {
        return QUESTIONNAIRE_SECTION_ORDER[i].entryStepId;
      }
    }
    return PROFILE_ALL_STEP_ID;
  }

  function getFirstIncompleteProfileBlank() {
    var i;
    for (i = 0; i < PROFILE_MADLIBS_BLANK_ORDER.length; i++) {
      var blankId = PROFILE_MADLIBS_BLANK_ORDER[i];
      if (blankId === "name" && !shouldShowNameTextInput()) {
        continue;
      }
      if (!isStepComplete(blankId)) {
        return blankId;
      }
    }
    return null;
  }

  function hasSectionBeenPassed(sectionKey) {
    return sectionsPassed[sectionKey] === true;
  }

  function markSectionPassed(sectionKey) {
    if (!sectionKey || sectionsPassed[sectionKey]) return;
    sectionsPassed[sectionKey] = true;
  }

  function markSectionPassedOnAdvance(fromStepId, nextStepId) {
    if (!fromStepId || !nextStepId) return;

    var fromSectionKey = getSectionKeyFromStepId(fromStepId);
    if (nextStepId === SUBMIT_ORDER_STEP_ID) {
      markSectionPassed("colors");
      return;
    }

    var nextSectionKey = getSectionKeyFromStepId(nextStepId);
    if (nextSectionKey !== fromSectionKey) {
      markSectionPassed(fromSectionKey);
    }
  }

  function canNavigateToSection(stepId, targetSectionKey) {
    if (!targetSectionKey) return false;

    var currentIndex = getCurrentSectionIndex(stepId);
    var targetIndex = getSectionIndex(targetSectionKey);
    if (targetIndex < 0) return false;
    return targetIndex !== currentIndex;
  }

  function navigateToSection(targetSectionKey) {
    var stepId = displayStepId || SUBMIT_ORDER_STEP_ID;
    if (!canNavigateToSection(stepId, targetSectionKey)) {
      return;
    }

    var targetIndex = getSectionIndex(targetSectionKey);
    if (targetIndex < 0) return;

    if (targetSectionKey === "profile") {
      cancelProfileTypewriter();
      var firstIncomplete = getFirstIncompleteProfileBlank();
      if (firstIncomplete) {
        currentProfileBlankId = firstIncomplete;
      }
    }

    activateSection(targetIndex, { behavior: "smooth" });

    if (targetSectionKey === "profile") {
      window.setTimeout(function () {
        var blankId =
          currentProfileBlankId || getFirstIncompleteProfileBlank() || "nameDisplayMode";
        focusProfileBlank(blankId);
      }, 350);
    }
  }

  function updateRemainingSteps(index) {
    if (!remainingEl) return;
    var remaining = Math.max(0, QUESTIONNAIRE_SECTION_ORDER.length - index - 1);
    var ui = getStrings().ui;
    remainingEl.textContent =
      remaining === 1
        ? ui.stepsRemainingOne
        : typeof ui.stepsRemainingMany === "function"
          ? ui.stepsRemainingMany(remaining)
          : remaining + " steps remaining";
  }

  function updateCardAccessibility(stepId) {
    if (!stackEl) return;

    var currentIndex = getCurrentSectionIndex(stepId);
    var cards = stackEl.querySelectorAll(".questionnaire-card");

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var header = card.querySelector(".questionnaire-card__header");
      var isExpanded = i === currentIndex;

      card.classList.toggle("is-expanded", isExpanded);
      card.classList.remove("is-locked");

      var body = card.querySelector(".questionnaire-card__body");
      if (body) {
        body.hidden = !isExpanded;
      }
      if (header) {
        header.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        header.disabled = isExpanded;
      }
    }
  }

  function updateCardExpandedState(activeIndex) {
    if (!stackEl) return;
    var cards = stackEl.querySelectorAll(".questionnaire-card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var isExpanded = i === activeIndex;
      card.classList.toggle("is-expanded", isExpanded);
      var header = card.querySelector(".questionnaire-card__header");
      var body = card.querySelector(".questionnaire-card__body");
      if (header) {
        header.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      }
      if (body) {
        body.hidden = !isExpanded;
      }
    }
  }

  function scrollActiveCardIntoView() {
    if (!stackEl) return;
    var activeCard = stackEl.querySelector(".questionnaire-card.is-expanded");
    if (activeCard && typeof activeCard.scrollIntoView === "function") {
      activeCard.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
  }

  function syncQuestionnaireCanvasZoomFromScroll() {
    if (typeof window.layoutQuestionnaireCanvasFromScroll === "function") {
      window.layoutQuestionnaireCanvasFromScroll();
    } else if (typeof window.layoutStage === "function") {
      window.layoutStage();
    }
  }

  function startSectionCanvasTransition(fromIndex, toIndex, behavior) {
    if (canvasTransitionRafId !== null) {
      window.cancelAnimationFrame(canvasTransitionRafId);
      canvasTransitionRafId = null;
    }

    sectionCanvasTransition = {
      fromIndex: fromIndex,
      toIndex: toIndex,
      progress: 0,
    };

    var duration =
      behavior === "smooth" && !prefersReducedMotion() ? SCROLL_SNAP_ANIM_MS : 0;

    if (duration <= 0 || fromIndex === toIndex) {
      sectionCanvasTransition = {
        fromIndex: toIndex,
        toIndex: toIndex,
        progress: 0,
      };
      syncQuestionnaireCanvasZoomFromScroll();
      return;
    }

    scrollSnapAnimating = true;
    lockSectionPaging(toIndex);
    var startTime = performance.now();

    function tick(now) {
      var progress = Math.min(1, (now - startTime) / duration);
      sectionCanvasTransition.progress = progress;
      syncQuestionnaireCanvasZoomFromScroll();
      if (progress < 1) {
        canvasTransitionRafId = window.requestAnimationFrame(tick);
        return;
      }
      canvasTransitionRafId = null;
      sectionCanvasTransition = {
        fromIndex: toIndex,
        toIndex: toIndex,
        progress: 0,
      };
      scrollSnapAnimating = false;
      sectionPageLockUntil = 0;
      syncQuestionnaireCanvasZoomFromScroll();
    }

    canvasTransitionRafId = window.requestAnimationFrame(tick);
  }

  function activateSection(index, options) {
    options = options || {};
    if (!stackEl) return;

    var lastIndex = QUESTIONNAIRE_SECTION_ORDER.length - 1;
    var targetIndex = Math.min(Math.max(0, index), lastIndex);
    var previousIndex = currentSectionIndex;
    var behavior = options.behavior || "auto";

    updateCardExpandedState(targetIndex);
    scrollActiveCardIntoView();

    if (targetIndex !== previousIndex && previousIndex >= 0) {
      startSectionCanvasTransition(previousIndex, targetIndex, behavior);
    } else if (targetIndex !== previousIndex) {
      sectionCanvasTransition = {
        fromIndex: targetIndex,
        toIndex: targetIndex,
        progress: 0,
      };
      syncQuestionnaireCanvasZoomFromScroll();
    }

    setCurrentSectionByIndex(targetIndex, options);
    updateRemainingSteps(targetIndex);
  }

  function onQuestionnaireCardHeaderClick(event) {
    var header = event.currentTarget;
    if (!header || header.disabled) return;
    var card = header.closest(".questionnaire-card");
    if (!card) return;
    var sectionKey = card.getAttribute("data-section-key");
    if (!sectionKey) return;
    navigateToSection(sectionKey);
  }

  function onQuestionnaireCardHeaderKeydown(event) {
    var header = event.currentTarget;
    var card = header.closest(".questionnaire-card");
    if (!card || !stackEl) return;

    var cards = stackEl.querySelectorAll(".questionnaire-card__header:not(:disabled)");
    var cardHeaders = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      cardHeaders.push(cards[i]);
    }
    var index = cardHeaders.indexOf(header);
    if (index < 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      var nextHeader = cardHeaders[(index + 1) % cardHeaders.length];
      if (nextHeader) focusWithoutScroll(nextHeader);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      var prevHeader =
        cardHeaders[(index - 1 + cardHeaders.length) % cardHeaders.length];
      if (prevHeader) focusWithoutScroll(prevHeader);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onQuestionnaireCardHeaderClick(event);
    }
  }

  function markAllProfileStepsReached() {
    var i;
    for (i = 0; i < PROFILE_STEP_ORDER.length; i++) {
      profileStepsReached[PROFILE_STEP_ORDER[i]] = true;
    }
    for (i = 0; i < PROFILE_MADLIBS_BLANK_ORDER.length; i++) {
      profileStepsReached[PROFILE_MADLIBS_BLANK_ORDER[i]] = true;
    }
  }

  function clearStack() {
    if (!stackEl) return;
    cancelProfileTypewriter();
    if (activeMadlibsDropdown) {
      closeMadlibsDropdown(activeMadlibsDropdown);
    }
    stackEl.innerHTML = "";
    activeStepEl = null;
    currentSectionIndex = -1;
  }

  function getStackPanelByIndex(index) {
    if (!stackEl || index < 0) return null;
    return stackEl.children[index] || null;
  }

  function getQuestionnaireCanvasHost() {
    return document.getElementById("questionnaire-canvas-host");
  }

  function resetStageWrapLayoutStyles(wrap) {
    if (!wrap) return;
    wrap.style.marginTop = "";
    wrap.style.height = "";
    wrap.classList.remove("is-questionnaire-focus-zoom");
  }

  function resetQuestionnaireCanvasLayoutCache() {
    if (typeof window.resetPage2QuestionnaireCanvasLayoutCache === "function") {
      window.resetPage2QuestionnaireCanvasLayoutCache();
    }
  }

  function mountCanvasToQuestionnaireHost() {
    var wrap = document.getElementById("stage-wrap");
    var host = getQuestionnaireCanvasHost();
    if (!wrap || !host) return;

    resetStageWrapLayoutStyles(wrap);
    if (wrap.parentNode !== host) {
      host.appendChild(wrap);
    }
    host.setAttribute("aria-hidden", "false");
    ensureQuestionnaireCanvasDirection();
    resetQuestionnaireCanvasLayoutCache();
    syncCanvasLayoutForStep();
  }

  function restoreCanvasToAppShell() {
    var wrap = document.getElementById("stage-wrap");
    var main = document.querySelector("#section-design .app-shell .main");
    var host = getQuestionnaireCanvasHost();
    if (!wrap || !main) return;

    resetStageWrapLayoutStyles(wrap);
    if (wrap.parentNode !== main) {
      main.appendChild(wrap);
    }
    if (host) {
      host.setAttribute("aria-hidden", "true");
    }

    resetQuestionnaireCanvasLayoutCache();
  }

  function getStepElForSection(sectionKey) {
    if (!stackEl) return null;
    var panel = stackEl.querySelector(
      '[data-section-key="' + sectionKey + '"]'
    );
    if (!panel) return null;
    return panel.querySelector(".questionnaire-step");
  }

  function isSectionComplete(sectionKey) {
    switch (sectionKey) {
      case "profile":
        return isAllProfileComplete();
      case "grid":
        return isAllGridComplete();
      case "family":
        return isAllFamilyComplete();
      case "bodyAutonomy":
        return isStepComplete("fanLeaves");
      case "feelings":
        return isAllFeelingsComplete();
      case "colors":
        return isStepComplete("palette");
      case "submitOrder":
        return true;
      default:
        return false;
    }
  }

  function checkSectionCompletion(sectionKey) {
    if (!sectionKey || !isSectionComplete(sectionKey)) return;
    if (sectionsPassed[sectionKey]) return;

    if (sectionKey === "profile") {
      answers.livingInIran = true;
      markAllProfileStepsReached();
      markQuestionnaireProfileComplete();
    }

    var entryStepId = getSectionEntryStepId(sectionKey);
    markStepReached(entryStepId);
    markSectionPassed(sectionKey);
    syncToPanel();
    triggerCanvasUpdateAfterSync(entryStepId);
    updateCardAccessibility(displayStepId || entryStepId);
  }

  function getMaxAccessibleSectionIndex() {
    var max = 0;
    var i;
    for (i = 0; i < QUESTIONNAIRE_SECTION_ORDER.length - 1; i++) {
      if (hasSectionBeenPassed(QUESTIONNAIRE_SECTION_ORDER[i].key)) {
        max = i + 1;
      } else {
        break;
      }
    }
    return max;
  }

  function getEffectiveMaxAccessibleSectionIndex() {
    var max = getMaxAccessibleSectionIndex();
    if (
      currentSectionIndex >= 0 &&
      currentSectionIndex < QUESTIONNAIRE_SECTION_ORDER.length
    ) {
      var currentKey = QUESTIONNAIRE_SECTION_ORDER[currentSectionIndex].key;
      if (isSectionComplete(currentKey)) {
        max = Math.max(max, currentSectionIndex + 1);
      }
    }
    return Math.min(max, QUESTIONNAIRE_SECTION_ORDER.length - 1);
  }

  function setCurrentSectionByIndex(index, options) {
    options = options || {};
    if (index < 0 || index >= QUESTIONNAIRE_SECTION_ORDER.length) return;

    var section = QUESTIONNAIRE_SECTION_ORDER[index];
    var stepId = section.entryStepId;
    var stepEl = getStepElForSection(section.key);
    if (!stepEl) return;

    if (index !== currentSectionIndex) {
      currentSectionIndex = index;
      applyStepUIState(stepId, stepEl);
      checkSectionCompletion(section.key);
      triggerCanvasRender();
    } else {
      updateCardAccessibility(displayStepId || stepId);
    }

    if (!options.deferFocus && !options.skipFocus) {
      var focusTarget = getStepFocusTarget(stepEl, stepId);
      if (focusTarget) focusWithoutScroll(focusTarget);
    }
  }

  function getQuestionnaireScrollZoomTransition() {
    return {
      fromIndex: sectionCanvasTransition.fromIndex,
      toIndex: sectionCanvasTransition.toIndex,
      progress: sectionCanvasTransition.progress,
    };
  }

  function lockSectionPaging() {
    sectionPageLockUntil = Date.now() + SECTION_PAGE_LOCK_MS;
  }

  function handleQuestionnaireResize() {
    syncQuestionnaireCardHeights();
    syncQuestionnaireCanvasZoomFromScroll();
  }

  function getQuestionnaireCardMeasureWidth() {
    var width = 0;

    if (stackEl) width = stackEl.clientWidth;
    if (width <= 0 && scrollEl) width = scrollEl.clientWidth;

    if (width <= 0 && panelGridEl) {
      var gridRect = panelGridEl.getBoundingClientRect();
      if (gridRect.width > 0) {
        var gridStyles = window.getComputedStyle(panelGridEl);
        var paddingInline =
          parseFloat(gridStyles.paddingLeft) +
          parseFloat(gridStyles.paddingRight);
        var columnGap = parseFloat(gridStyles.columnGap) || 0;
        var innerWidth = gridRect.width - paddingInline;
        width = ((innerWidth - columnGap * 11) / 12) * 6 + columnGap * 5;
      }
    }

    return Math.max(0, Math.floor(width));
  }

  // Base (un-shrunk) value of --questionnaire-text-scale; mirrors the CSS
  // default on .questionnaire-panel. Content is always MEASURED at this scale so
  // the fit-to-screen calculation is deterministic (single pass, no oscillation).
  var QUESTIONNAIRE_BASE_TEXT_SCALE = 1.5;
  // Floor so question text never shrinks into illegibility, even if a section is
  // huge. If a section still overflows at this floor, inner scroll is allowed
  // as a last-resort fallback.
  var QUESTIONNAIRE_MIN_TEXT_SCALE = 0.7;

  // Probe scale used as the second sample point when modelling how a section's
  // height responds to the text scale. Must differ from the base scale.
  var QUESTIONNAIRE_PROBE_TEXT_SCALE = 1.0;
  // Headroom (px) kept below the available height so rounding / sub-pixel slack
  // never re-introduces a 1-2px inner scrollbar.
  var QUESTIONNAIRE_FIT_SAFETY_PX = 12;

  // Measure a single card body's natural height at the current panel scale.
  // The body is moved offscreen so measuring never flashes on screen.
  function measureQuestionnaireBodyHeight(body, measureWidth) {
    var wasHidden = body.hidden;
    body.hidden = false;
    body.style.position = "absolute";
    body.style.left = "-10000px";
    body.style.top = "0";
    body.style.width = measureWidth + "px";
    body.style.visibility = "hidden";
    body.style.pointerEvents = "none";

    var h = Math.ceil(body.scrollHeight);

    body.hidden = wasHidden;
    body.style.position = "";
    body.style.left = "";
    body.style.top = "";
    body.style.width = "";
    body.style.visibility = "";
    body.style.pointerEvents = "";
    return h;
  }

  function syncQuestionnaireCardHeights() {
    if (!panelEl || !stackEl) return;

    var cards = stackEl.querySelectorAll(".questionnaire-card");
    if (!cards.length) return;

    var measureWidth = getQuestionnaireCardMeasureWidth();
    if (measureWidth <= 0) return;

    var base = QUESTIONNAIRE_BASE_TEXT_SCALE;
    var probe = QUESTIONNAIRE_PROBE_TEXT_SCALE;
    var i;

    panelEl.classList.add("questionnaire-panel--measuring");

    // --- Pass 1: measure headers + each body height at BASE scale. ---
    panelEl.style.setProperty("--questionnaire-text-scale", String(base));

    var maxHeaderPx = 0;
    var bodies = [];
    var hBase = [];

    for (i = 0; i < cards.length; i++) {
      var header = cards[i].querySelector(".questionnaire-card__header");
      if (header) {
        maxHeaderPx = Math.max(
          maxHeaderPx,
          Math.ceil(header.getBoundingClientRect().height)
        );
      }
      // The spider chart / palette / grid-type used to be excluded from this
      // measurement. They are now included so a section's TRUE height drives
      // the fit-to-screen scale below — that is what removes the inner scroll.
      var body = cards[i].querySelector(".questionnaire-card__body");
      if (!body) continue;
      bodies.push(body);
      hBase.push(measureQuestionnaireBodyHeight(body, measureWidth));
    }

    // --- Pass 2: measure each body height at the PROBE scale. ---
    // Two sample points let us model height(scale) = A*scale + B per section,
    // which correctly accounts for the parts that do NOT scale with the text
    // (fixed rem gaps/padding) — a plain proportional guess slightly overshoots
    // and leaves a few stray pixels of inner scroll.
    panelEl.style.setProperty("--questionnaire-text-scale", String(probe));
    var hProbe = [];
    for (i = 0; i < bodies.length; i++) {
      hProbe.push(measureQuestionnaireBodyHeight(bodies[i], measureWidth));
    }

    panelEl.classList.remove("questionnaire-panel--measuring");

    var maxBodyPx = 0;
    for (i = 0; i < hBase.length; i++) {
      maxBodyPx = Math.max(maxBodyPx, hBase[i]);
    }

    // --- Fit-to-screen ---------------------------------------------------
    // Every card always shows its header; only one card is expanded (shows its
    // body) at a time. Compute the vertical space left for that expanded body,
    // then pick ONE global text scale so EVERY section fits with no inner
    // scroll and no list scroll. A single global scale keeps every question the
    // same size (visual uniformity across sections).
    var fitScale = base;
    var availableBodyPx = 0;

    if (scrollEl && maxHeaderPx > 0 && maxBodyPx > 0) {
      var scrollStyles = window.getComputedStyle(scrollEl);
      var scrollPadTop = parseFloat(scrollStyles.paddingTop) || 0;
      var scrollPadBottom = parseFloat(scrollStyles.paddingBottom) || 0;
      var stackPadBottom =
        parseFloat(window.getComputedStyle(stackEl).paddingBottom) || 0;

      availableBodyPx =
        scrollEl.clientHeight -
        scrollPadTop -
        scrollPadBottom -
        cards.length * maxHeaderPx -
        stackPadBottom;

      var target = availableBodyPx - QUESTIONNAIRE_FIT_SAFETY_PX;

      if (target > 0) {
        for (i = 0; i < hBase.length; i++) {
          // Only sections that overflow at base scale can force a shrink.
          if (hBase[i] <= target) continue;
          // height(scale) = A*scale + B  (A = px gained per unit of scale).
          var A = (hBase[i] - hProbe[i]) / (base - probe);
          var requiredScale;
          if (A > 0.0001) {
            var B = hBase[i] - A * base;
            requiredScale = (target - B) / A;
          } else {
            // Section height barely responds to scale; can't shrink it.
            requiredScale = base;
          }
          if (requiredScale < fitScale) fitScale = requiredScale;
        }
      }

      if (fitScale > base) fitScale = base;
      if (fitScale < QUESTIONNAIRE_MIN_TEXT_SCALE) {
        fitScale = QUESTIONNAIRE_MIN_TEXT_SCALE;
      }
    }

    panelEl.style.setProperty("--questionnaire-text-scale", String(fitScale));

    // Uniform expanded-card height. When we had to shrink, fill the available
    // space; otherwise use the tallest natural body (cards stay as compact as
    // their content allows while remaining uniform).
    var finalBodyPx;
    if (fitScale < base && availableBodyPx > 0) {
      finalBodyPx = availableBodyPx;
    } else {
      finalBodyPx = maxBodyPx;
    }

    if (maxHeaderPx > 0) {
      panelEl.style.setProperty(
        "--questionnaire-card-header-height",
        maxHeaderPx + "px"
      );
    }
    if (finalBodyPx > 0) {
      panelEl.style.setProperty(
        "--questionnaire-card-expanded-height",
        maxHeaderPx + finalBodyPx + "px"
      );
    }
  }

  function scheduleQuestionnaireCardHeightSync() {
    requestAnimationFrame(function () {
      requestAnimationFrame(syncQuestionnaireCardHeights);
    });
  }

  function initQuestionnaireScroll() {
    if (!scrollEl) return;

    window.addEventListener("resize", handleQuestionnaireResize, {
      passive: true,
    });
  }

  function buildQuestionnaireStack() {
    if (!stackEl) return;
    clearStack();

    var i;
    for (i = 0; i < QUESTIONNAIRE_SECTION_ORDER.length; i++) {
      var section = QUESTIONNAIRE_SECTION_ORDER[i];
      var sectionMeta = getSectionLabels()[section.key];
      var card = document.createElement("article");
      card.className = "questionnaire-card";
      card.classList.add("questionnaire-card--light");
      card.setAttribute("data-section-key", section.key);
      if (section.key === "feelings") {
        card.classList.add("questionnaire-card--feelings");
      }

      var header = document.createElement("button");
      header.type = "button";
      header.className = "questionnaire-card__header";
      header.setAttribute("aria-expanded", "false");
      header.setAttribute(
        "aria-controls",
        "questionnaire-card-body-" + section.key
      );
      header.setAttribute(
        "aria-label",
        getUiString("sectionAriaPrefix") +
          sectionMeta.num +
          ": " +
          sectionMeta.name
      );

      var num = document.createElement("span");
      num.className = "questionnaire-card__num";
      num.textContent = String(sectionMeta.num);

      var title = document.createElement("span");
      title.className = "questionnaire-card__title";
      title.textContent = sectionMeta.name;

      header.appendChild(num);
      header.appendChild(title);
      header.addEventListener("click", onQuestionnaireCardHeaderClick);
      header.addEventListener("keydown", onQuestionnaireCardHeaderKeydown);

      var body = document.createElement("div");
      body.className = "questionnaire-card__body";
      body.id = "questionnaire-card-body-" + section.key;
      body.hidden = true;

      var stepEl = buildStepElement(section.entryStepId);
      if (stepEl) {
        body.appendChild(stepEl);
      }

      // "Next" button — appears at the bottom-right of every section except the
      // last one ("Submit & Order"). It advances to the next section, an
      // additional way to move forward alongside clicking the section headers.
      if (i < QUESTIONNAIRE_SECTION_ORDER.length - 1) {
        var nextFooter = document.createElement("div");
        nextFooter.className = "questionnaire-card__next-footer";

        var nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "questionnaire-card__next";
        nextBtn.textContent = getUiString("next");
        nextBtn.setAttribute("aria-label", getUiString("next"));
        nextBtn.addEventListener("click", function () {
          advance();
        });

        nextFooter.appendChild(nextBtn);
        body.appendChild(nextFooter);
      }

      card.appendChild(header);
      card.appendChild(body);
      stackEl.appendChild(card);
    }

    mountCanvasToQuestionnaireHost();
    sectionCanvasTransition = { fromIndex: 0, toIndex: 0, progress: 0 };
    activateSection(0, { deferFocus: true, skipFocus: true, behavior: "auto" });
  }

  function createHeading(step) {
    if (!step.label || step.hideHeading) return null;
    var heading = document.createElement("h3");
    heading.className = "questionnaire-step__heading";
    if (step.wrap) {
      heading.classList.add("questionnaire-step__heading--wrap");
    }
    if (step.letter) {
      heading.setAttribute("data-letter", step.letter);
    }
    heading.textContent = step.label;
    return heading;
  }

  function bindImmediateAdvance() {
    /* removed — scroll stack navigation replaces step advance */
  }

  function appendContinueIfComplete() {
    /* removed — scroll stack navigation replaces Continue buttons */
  }

  function appendQuestionnaireYesNoControl(parent, stepConfig, stepId, onChange) {
    var group = document.createElement("div");
    group.className = "questionnaire-options questionnaire-options--row";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    function makeBtn(label, value) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "questionnaire-option";
      btn.textContent = label;
      if (answers[stepId] === value) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", function () {
        answers[stepId] = value;
        group.querySelectorAll(".questionnaire-option").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        btn.classList.add("is-selected");
        applyFamilyAnswersToPanel(false);
        triggerCanvasUpdateAfterSync(stepId);
        if (onChange) onChange();
      });
      return btn;
    }

    group.appendChild(makeBtn(getUiString("yes"), true));
    group.appendChild(makeBtn(getUiString("no"), false));
    parent.appendChild(group);
  }

  function createFamilyDotOptionButton(opt, isSelected) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "family-dot-option";
    if (isSelected) {
      btn.classList.add("is-selected");
    }
    btn.setAttribute("data-value", opt.value);
    btn.setAttribute("aria-pressed", String(isSelected));

    var circle = document.createElement("span");
    circle.className = "family-dot-option__circle";
    circle.setAttribute("aria-hidden", "true");

    var label = document.createElement("span");
    label.className = "family-dot-option__label";
    label.textContent = opt.label;

    btn.appendChild(circle);
    btn.appendChild(label);
    return btn;
  }

  function appendQuestionnaireSingleChoiceControl(
    parent,
    stepConfig,
    stepId,
    onChange
  ) {
    var group = document.createElement("div");
    group.className = "family-dot-options questionnaire-family-dot-options";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    stepConfig.options.forEach(function (opt) {
      var btn = createFamilyDotOptionButton(opt, answers[stepId] === opt.value);
      btn.addEventListener("click", function () {
        answers[stepId] = opt.value;
        group.querySelectorAll(".family-dot-option").forEach(function (el) {
          el.classList.remove("is-selected");
          el.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-selected");
        btn.setAttribute("aria-pressed", "true");
        applyFamilyAnswersToPanel(false);
        triggerCanvasUpdateAfterSync(stepId);
        if (onChange) onChange();
      });
      group.appendChild(btn);
    });

    parent.appendChild(group);
  }

  function appendQuestionnaireMultiChoiceControl(
    parent,
    stepConfig,
    stepId,
    onChange
  ) {
    if (!Array.isArray(answers[stepId]) && answers[stepId] !== null) {
      answers[stepId] = null;
    }

    var group = document.createElement("div");
    group.className =
      "family-dot-options questionnaire-family-dot-options family-dot-options--multi";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    stepConfig.options.forEach(function (opt) {
      var selected = Array.isArray(answers[stepId])
        ? answers[stepId].indexOf(opt.value) >= 0
        : false;
      var btn = createFamilyDotOptionButton(opt, selected);
      btn.addEventListener("click", function () {
        if (!Array.isArray(answers[stepId])) {
          answers[stepId] = [];
        }
        var idx = answers[stepId].indexOf(opt.value);
        if (idx >= 0) {
          answers[stepId].splice(idx, 1);
          btn.classList.remove("is-selected");
          btn.setAttribute("aria-pressed", "false");
        } else {
          answers[stepId].push(opt.value);
          btn.classList.add("is-selected");
          btn.setAttribute("aria-pressed", "true");
        }
        applyFamilyAnswersToPanel(false);
        triggerCanvasUpdateAfterSync(stepId);
        if (onChange) onChange();
      });
      group.appendChild(btn);
    });

    parent.appendChild(group);
  }

  function renderYesNo(stepConfig, stepId) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var group = document.createElement("div");
    group.className = "questionnaire-options questionnaire-options--row";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    function makeBtn(label, value) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "questionnaire-option";
      btn.textContent = label;
      if (answers[stepId] === value) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", function () {
        answers[stepId] = value;
        group.querySelectorAll(".questionnaire-option").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        btn.classList.add("is-selected");
        bindImmediateAdvance();
      });
      return btn;
    }

    group.appendChild(makeBtn(getUiString("yes"), true));
    group.appendChild(makeBtn(getUiString("no"), false));
    answersWrap.appendChild(group);
    appendContinueIfComplete(answersWrap, stepId);
    return answersWrap;
  }

  function renderMultiChoice(stepConfig, stepId) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = getUiString("continue");
    continueBtn.disabled = !isStepComplete(stepId);

    appendQuestionnaireMultiChoiceControl(
      answersWrap,
      stepConfig,
      stepId,
      function () {
        continueBtn.disabled = !isStepComplete(stepId);
      }
    );

    continueBtn.addEventListener("click", function () {
      if (answers.iranLossTypes === null) {
        answers.iranLossTypes = [];
        applyFamilyAnswersToPanel(false);
      }
      if (isStepComplete(stepId)) advance();
    });
    answersWrap.appendChild(continueBtn);
    return answersWrap;
  }

  function renderChoice(stepConfig, stepId) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var isGridTypeStep = stepId === "gridType";

    var group = document.createElement("div");
    group.className = isGridTypeStep
      ? "questionnaire-options questionnaire-options--row questionnaire-options--grid-type"
      : "questionnaire-options questionnaire-options--multi";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    var continueBtn = null;
    if (isGridTypeStep) {
      continueBtn = document.createElement("button");
      continueBtn.type = "button";
      continueBtn.className = "questionnaire-continue";
      continueBtn.textContent = getUiString("continue");
      continueBtn.disabled = !isStepComplete(stepId);
      continueBtn.addEventListener("click", function () {
        advance();
      });
    }

    stepConfig.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = isGridTypeStep
        ? "questionnaire-option questionnaire-option--grid-icon"
        : "questionnaire-option";
      if (isGridTypeStep) {
        btn.setAttribute("aria-label", opt.label);
        btn.setAttribute("title", opt.label);
        if (window.GridUnitIcons && window.GridUnitIcons.createIcon) {
          btn.appendChild(window.GridUnitIcons.createIcon(opt.value));
        }
      } else {
        btn.textContent = opt.label;
      }
      btn.setAttribute("data-value", opt.value);
      if (answers[stepId] === opt.value) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", function () {
        answers[stepId] = opt.value;
        group.querySelectorAll(".questionnaire-option").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        btn.classList.add("is-selected");
        if (isGridTypeStep) {
          previewGridTypeOnCanvas();
          continueBtn.disabled = false;
          return;
        }
        if (stepId === "hopeMode") {
          syncHopeModeToPanel(opt.value);
        }
        bindImmediateAdvance();
      });
      group.appendChild(btn);
    });

    answersWrap.appendChild(group);
    if (isGridTypeStep) {
      answersWrap.appendChild(continueBtn);
    } else {
      appendContinueIfComplete(answersWrap, stepId);
    }
    return answersWrap;
  }

  function appendQuestionnaireGridTypeChoice(parent, onChange) {
    var stepConfig = getStepConfig("gridType");
    var stepId = "gridType";

    var group = document.createElement("div");
    group.className =
      "questionnaire-options questionnaire-options--row questionnaire-options--grid-type";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    stepConfig.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "questionnaire-option questionnaire-option--grid-icon";
      btn.setAttribute("aria-label", opt.label);
      btn.setAttribute("title", opt.label);
      if (window.GridUnitIcons && window.GridUnitIcons.createIcon) {
        btn.appendChild(window.GridUnitIcons.createIcon(opt.value));
      }
      btn.setAttribute("data-value", opt.value);
      if (answers[stepId] === opt.value) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", function () {
        answers[stepId] = opt.value;
        group.querySelectorAll(".questionnaire-option").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        btn.classList.add("is-selected");
        previewGridTypeOnCanvas();
        if (onChange) onChange();
      });
      group.appendChild(btn);
    });

    parent.appendChild(group);
  }

  function appendQuestionnaireSectionQuestionHeading(parent, label) {
    var heading = document.createElement("h4");
    heading.className = "questionnaire-section-question-heading";
    heading.textContent = label;
    parent.appendChild(heading);
  }

  function renderTextInput(stepConfig, stepId) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var input = document.createElement("input");
    input.type = "text";
    input.className = "questionnaire-input";
    if (stepConfig.english) {
      input.classList.add("questionnaire-input--english");
      input.lang = "en";
    }
    input.value = String(answers[stepId] || "");
    input.setAttribute("aria-label", stepConfig.ariaLabel);
    if (stepConfig.placeholder) {
      input.placeholder = stepConfig.placeholder;
    }
    if (stepConfig.inputMode) {
      input.inputMode = stepConfig.inputMode;
    }
    if (stepConfig.maxLength) {
      input.maxLength = stepConfig.maxLength;
    }
    input.autocomplete = "off";
    input.spellcheck = false;

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = getUiString("continue");
    continueBtn.disabled = !isStepComplete(stepId);

    function syncValue() {
      answers[stepId] = input.value;
      continueBtn.disabled = !isStepComplete(stepId);
    }

    input.addEventListener("input", syncValue);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && isStepComplete(stepId)) {
        event.preventDefault();
        advance();
      }
    });

    continueBtn.addEventListener("click", function () {
      if (isStepComplete(stepId)) advance();
    });

    answersWrap.appendChild(input);
    answersWrap.appendChild(continueBtn);
    return answersWrap;
  }

  function renderName(stepConfig) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var input = document.createElement("input");
    input.type = "text";
    input.className =
      "questionnaire-input questionnaire-input--english";
    input.lang = "en";
    input.value = String(answers.name || "");
    input.placeholder = stepConfig.placeholder;
    input.setAttribute("aria-label", stepConfig.ariaLabel);
    input.autocomplete = "off";
    input.spellcheck = false;

    var modeGroup = document.createElement("div");
    modeGroup.className = "questionnaire-options questionnaire-options--row";
    modeGroup.setAttribute("role", "group");
    modeGroup.setAttribute("aria-label", stepConfig.modeAriaLabel);

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = getUiString("continue");
    continueBtn.disabled = !isStepComplete("name");

    function syncContinue() {
      continueBtn.disabled = !isStepComplete("name");
    }

    input.addEventListener("input", function () {
      answers.name = input.value;
      syncContinue();
    });

    stepConfig.modes.forEach(function (mode) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "questionnaire-option";
      btn.textContent = mode.label;
      if (answers.nameDisplayMode === mode.value) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", function () {
        answers.nameDisplayMode = mode.value;
        modeGroup.querySelectorAll(".questionnaire-option").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        btn.classList.add("is-selected");
        syncContinue();
      });
      modeGroup.appendChild(btn);
    });

    continueBtn.addEventListener("click", function () {
      if (isStepComplete("name")) advance();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && isStepComplete("name")) {
        event.preventDefault();
        advance();
      }
    });

    answersWrap.appendChild(input);
    answersWrap.appendChild(modeGroup);
    answersWrap.appendChild(continueBtn);
    return answersWrap;
  }

  function createQuestionnaireSliderTrack(slider) {
    var track = document.createElement("div");
    track.className = "questionnaire-slider-track";

    var handle = document.createElement("div");
    handle.className = "questionnaire-slider-handle";
    handle.setAttribute("aria-hidden", "true");

    var leftArrow = document.createElement("span");
    leftArrow.className =
      "questionnaire-slider-handle__arrow questionnaire-slider-handle__arrow--left";
    var rightArrow = document.createElement("span");
    rightArrow.className =
      "questionnaire-slider-handle__arrow questionnaire-slider-handle__arrow--right";

    handle.appendChild(leftArrow);
    handle.appendChild(rightArrow);
    track.appendChild(slider);
    track.appendChild(handle);
    return track;
  }

  function syncQuestionnaireSliderBarFill(slider) {
    var min = Number(slider.min);
    var max = Number(slider.max);
    var val = Number(slider.value);
    var pct = max <= min ? 0 : ((val - min) / (max - min)) * 100;
    var fill = pct + "%";
    slider.style.setProperty("--bar-fill", fill);
    var track = slider.closest(".questionnaire-slider-track");
    if (track) {
      track.style.setProperty("--bar-fill", fill);
      track.classList.toggle("is-at-min", val <= min);
      track.classList.toggle("is-at-max", val >= max);
    }
  }

  function appendQuestionnaireSliderControl(parent, stepConfig, stepId, onChange) {
    var sliderWrap = document.createElement("div");
    sliderWrap.className = "questionnaire-slider-wrap";

    if (stepConfig.rangeLabels && stepConfig.rangeLabels.length) {
      var rangeLabels = document.createElement("div");
      rangeLabels.className = "questionnaire-slider-range-labels";
      rangeLabels.setAttribute("aria-hidden", "true");
      stepConfig.rangeLabels.forEach(function (label, index) {
        var span = document.createElement("span");
        span.className = "questionnaire-slider-range-label";
        if (index === stepConfig.rangeLabels.length - 1) {
          span.classList.add("questionnaire-slider-range-label--end");
        }
        span.textContent = label;
        rangeLabels.appendChild(span);
      });
      sliderWrap.appendChild(rangeLabels);
    }

    var control = document.createElement("div");
    control.className = "questionnaire-slider-control";

    var min = stepConfig.min;
    var max = stepConfig.max;
    var isFeelings = isFeelingsSliderStep(stepId);
    var steps =
      typeof FEELINGS_SLIDER_STEPS !== "undefined" ? FEELINGS_SLIDER_STEPS : 10;

    var slider = document.createElement("input");
    slider.type = "range";
    slider.className = "questionnaire-slider";
    if (isFeelings) {
      slider.min = "1";
      slider.max = String(steps);
      slider.step = "1";
      slider.value = String(feelingsStepFromValue(answers[stepId], min, max));
    } else {
      slider.min = String(min);
      slider.max = String(max);
      slider.step = String(stepConfig.step || 1);
      slider.value = String(answers[stepId]);
    }
    slider.setAttribute("aria-label", stepConfig.ariaLabel);

    var output = document.createElement("output");
    output.className = "questionnaire-slider-output";
    output.textContent = isFeelings
      ? String(feelingsStepFromValue(answers[stepId], min, max))
      : String(answers[stepId]) + (stepConfig.outputSuffix || "");

    slider.addEventListener("input", function () {
      syncQuestionnaireSliderBarFill(slider);
      if (isFeelings) {
        var step = clampFeelingsStepNumber(slider.value);
        if (Number(slider.value) !== step) {
          slider.value = String(step);
        }
        var internal = feelingsValueFromStep(step, min, max);
        answers[stepId] = internal;
        output.textContent = String(step);
      } else {
        answers[stepId] = Number(slider.value);
        output.textContent = slider.value + (stepConfig.outputSuffix || "");
      }
      var domIds = PANEL_SLIDER_DOM[stepId];
      if (domIds) {
        if (stepId === "fanLeaves") {
          scheduleFanLeavesSliderCanvasUpdate(
            stepId,
            answers[stepId],
            true,
            false
          );
        } else {
          coalescedCanvasUpdate(function () {
            ensureQuestionnaireCanvasUnlock(stepId);
            syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], false);
            triggerCanvasUpdateAfterSync(stepId, true);
          });
        }
      }
      if (onChange) onChange();
    });

    // Release: run the full commit once (reshuffle + label bar) on the final value.
    slider.addEventListener("change", function () {
      var domIds = PANEL_SLIDER_DOM[stepId];
      if (domIds) {
        // Grid-structure sliders skip the per-frame vector render while dragging
        // (raster preview only). Commit through the real slider's "change" event
        // so its release handler cancels the pending preview and runs one full
        // vector render on the final value.
        if (isGridStructureSliderStep(stepId)) {
          syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], true);
        } else if (stepId === "fanLeaves") {
          scheduleFanLeavesSliderCanvasUpdate(
            stepId,
            answers[stepId],
            false,
            true
          );
        } else {
          syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], false);
          triggerCanvasUpdateAfterSync(stepId, false);
        }
      }
    });

    control.appendChild(createQuestionnaireSliderTrack(slider));
    syncQuestionnaireSliderBarFill(slider);
    control.appendChild(output);
    sliderWrap.appendChild(control);
    parent.appendChild(sliderWrap);
  }

  function appendFeelingsShuffleButton(parent) {
    var actions = document.createElement("div");
    actions.className = "questionnaire-feelings-actions";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "questionnaire-feelings-shuffle-btn";
    btn.textContent = getUiString("shuffleLayout");
    btn.setAttribute("aria-label", getUiString("shuffleLayoutAria"));
    btn.addEventListener("click", function () {
      if (
        window.UnderCoverComboBridge &&
        typeof window.UnderCoverComboBridge.randomizeFeelingsPlacement ===
          "function"
      ) {
        window.UnderCoverComboBridge.randomizeFeelingsPlacement();
      }
    });

    actions.appendChild(btn);
    parent.appendChild(actions);
  }

  function appendFeelingsSpiderChart(parent, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "questionnaire-feelings-spider";
    parent.appendChild(wrap);

    if (
      !window.FeelingsSpiderChart ||
      typeof window.FeelingsSpiderChart.create !== "function"
    ) {
      return;
    }

    window.FeelingsSpiderChart.create(wrap, {
      rows: getFeelingsTableRows(),
      scaleLabels: getFeelingsScaleLabels(),
      couplings: FEELINGS_COUPLINGS,
      getBounds: getQuestionnaireFeelingsBounds,
      getValue: function (stepId) {
        return answers[stepId];
      },
      setValue: function (stepId, value) {
        answers[stepId] = value;
      },
      onChange: function () {
        applyQuestionnaireFeelingsToCanvas();
        if (onChange) onChange();
      },
    });
  }

  function appendQuestionnaireHopeChoice(parent, stepConfig, stepId, onChange) {
    var group = document.createElement("div");
    group.className =
      "questionnaire-options questionnaire-options--row questionnaire-feelings-hope-options";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    stepConfig.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "questionnaire-option";
      btn.textContent = opt.label;
      btn.setAttribute("data-value", opt.value);
      if (answers[stepId] === opt.value) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", function () {
        answers[stepId] = opt.value;
        group.querySelectorAll(".questionnaire-option").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        btn.classList.add("is-selected");
        syncHopeModeToPanel(opt.value);
        triggerCanvasUpdateAfterSync(stepId);
        if (onChange) onChange();
      });
      group.appendChild(btn);
    });

    parent.appendChild(group);
  }

  function appendMadlibsEnterAdvance(el, stepId) {
    el.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && isStepComplete(stepId)) {
        event.preventDefault();
        var next = getNextProfileBlank(stepId);
        if (next) {
          focusProfileBlank(next);
          return;
        }
        focusProfileContinueBtn();
      }
    });
    el.addEventListener("focus", function () {
      currentProfileBlankId = stepId;
      updateCardAccessibilityForProfile();
    });
  }

  function ensureMadlibsBlankSizer() {
    if (!madlibsBlankSizer) {
      madlibsBlankSizer = document.createElement("span");
      madlibsBlankSizer.className = "questionnaire-madlibs-blank-sizer";
      madlibsBlankSizer.setAttribute("aria-hidden", "true");
      document.body.appendChild(madlibsBlankSizer);
    }
    return madlibsBlankSizer;
  }

  function copyMadlibsFontStyles(fromEl, toEl) {
    var style = window.getComputedStyle(fromEl);
    toEl.style.fontFamily = style.fontFamily;
    toEl.style.fontSize = style.fontSize;
    toEl.style.fontWeight = style.fontWeight;
    toEl.style.fontStyle = style.fontStyle;
    toEl.style.letterSpacing = style.letterSpacing;
    toEl.style.textTransform = style.textTransform;
  }

  function measureMadlibsTextPx(text, referenceEl) {
    var sizer = ensureMadlibsBlankSizer();
    copyMadlibsFontStyles(referenceEl, sizer);
    sizer.textContent = text || "\u200b";
    return sizer.getBoundingClientRect().width;
  }

  function supportsFieldSizingContent() {
    return (
      typeof CSS !== "undefined" &&
      CSS.supports &&
      CSS.supports("field-sizing", "content")
    );
  }

  function syncMadlibsTextInputWidth(input) {
    if (!input || input.tagName !== "INPUT") return;
    var style = window.getComputedStyle(input);
    var minWidth = parseFloat(style.minWidth) || 0;
    var padX =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    var text = input.value || "";
    if (!text && input.placeholder) {
      text = input.placeholder;
    }
    var textWidth = text ? measureMadlibsTextPx(text, input) : 0;
    var target = Math.max(minWidth, textWidth + padX + 2);
    if (supportsFieldSizingContent()) {
      input.style.minWidth = Math.ceil(target) + "px";
      input.style.width = "";
      return;
    }
    input.style.width = Math.ceil(target) + "px";
  }

  function syncMadlibsDropdownWidth(wrap) {
    if (!wrap || !wrap.classList.contains("questionnaire-madlibs-dropdown")) {
      return;
    }
    if (wrap.classList.contains("questionnaire-madlibs-name-mode")) {
      var nameModeInput = wrap.querySelector(
        ".questionnaire-madlibs-name-mode__input"
      );
      if (nameModeInput) {
        syncMadlibsTextInputWidth(/** @type {HTMLInputElement} */ (nameModeInput));
      }
      wrap.style.width = "";
      return;
    }
    var trigger = wrap.querySelector(".questionnaire-madlibs-dropdown__trigger");
    var labelEl = wrap.querySelector(".questionnaire-madlibs-dropdown__label");
    if (!trigger || !labelEl) return;

    var style = window.getComputedStyle(wrap);
    var minWidth = parseFloat(style.minWidth) || 0;
    var labelText =
      labelEl.classList.contains("is-placeholder") || !labelEl.textContent
        ? ""
        : labelEl.textContent;
    var caret = wrap.querySelector(".questionnaire-madlibs-dropdown__caret");
    var triggerStyle = window.getComputedStyle(trigger);
    var padX =
      parseFloat(triggerStyle.paddingLeft) +
      parseFloat(triggerStyle.paddingRight);
    var gap = parseFloat(triggerStyle.gap) || 0;
    var caretWidth = caret ? caret.getBoundingClientRect().width : 0;
    var textWidth = labelText ? measureMadlibsTextPx(labelText, trigger) : 0;
    var target = Math.max(
      minWidth,
      textWidth + padX + gap + caretWidth + 2
    );
    wrap.style.width = Math.ceil(target) + "px";
  }

  function bindMadlibsTextInputAutoWidth(input) {
    function resize() {
      syncMadlibsTextInputWidth(input);
    }
    input.addEventListener("input", resize);
    input.addEventListener("change", resize);
    resize();
  }

  function syncAllProfileMadlibsBlankWidths(root) {
    if (!root) return;
    var blanks = root.querySelectorAll(
      ".questionnaire-madlibs-blank, .questionnaire-madlibs-dropdown"
    );
    var i;
    for (i = 0; i < blanks.length; i++) {
      var el = /** @type {HTMLElement} */ (blanks[i]);
      if (el.classList.contains("questionnaire-madlibs-dropdown")) {
        syncMadlibsDropdownWidth(el);
      } else if (el.tagName === "INPUT") {
        syncMadlibsTextInputWidth(/** @type {HTMLInputElement} */ (el));
      }
    }
  }

  function getHomeAtMadlibsIconFile(value) {
    var map =
      typeof LABEL_BAR_HOME_AT_SVGS !== "undefined"
        ? LABEL_BAR_HOME_AT_SVGS
        : {
            inIran: "home/IN IRAN home.svg",
            whereILive: "home/WHERE I LIVE.svg",
            nowhere: "home/NOWHERE.svg",
          };
    var defaultFile =
      typeof LABEL_BAR_HOME_AT_DEFAULT_SVG !== "undefined"
        ? LABEL_BAR_HOME_AT_DEFAULT_SVG
        : map.nowhere;
    if (value === "inIran") return map.inIran;
    if (value === "whereILive") return map.whereILive;
    if (value === "nowhere") return map.nowhere;
    return defaultFile;
  }

  function getLivingDurationMadlibsIconFile(value) {
    var map =
      typeof LABEL_BAR_LIVING_DURATION_SVGS !== "undefined"
        ? LABEL_BAR_LIVING_DURATION_SVGS
        : {
            smallPart: "Did you ever live in Iran?/small part of my life.svg",
            partOfLife: "Did you ever live in Iran?/part of my life.svg",
            mostAll: "Did you ever live in Iran?/Yes, most : all of my life.svg",
          };
    if (value === "smallPart") return map.smallPart;
    if (value === "mostAll") return map.mostAll;
    if (value === "partOfLife") return map.partOfLife;
    // No duration chosen yet — show the middle "part of my life" sign by default.
    return map.partOfLife;
  }

  function getProfileMadlibsIconFile(stepId) {
    if (stepId === "homeAt") {
      return getHomeAtMadlibsIconFile(answers.homeAt);
    }
    if (stepId === "livingDuration") {
      return getLivingDurationMadlibsIconFile(answers.livingDuration);
    }
    var map =
      typeof PROFILE_MADLIBS_FIELD_ICONS !== "undefined"
        ? PROFILE_MADLIBS_FIELD_ICONS
        : {};
    return map[stepId] || "";
  }

  function resolveProfileMadlibsEmbeddedKey(filename) {
    var embedded =
      typeof window !== "undefined" ? window.LABEL_BAR_SVG_EMBEDDED : null;
    if (!filename || !embedded) return null;
    if (embedded[filename]) return filename;
    var slash = filename.lastIndexOf("/");
    if (slash >= 0) {
      var dir = filename.slice(0, slash);
      var base = filename.slice(slash + 1);
      if (dir !== "home" && embedded[base]) return base;
    }
    return null;
  }

  function getProfileMadlibsIconInnerMarkup(filename) {
    var key = resolveProfileMadlibsEmbeddedKey(filename);
    if (
      !key ||
      !window.LABEL_BAR_SVG_EMBEDDED ||
      !window.LABEL_BAR_SVG_EMBEDDED[key]
    ) {
      return "";
    }
    return String(window.LABEL_BAR_SVG_EMBEDDED[key])
      .replace(/<defs[\s\S]*?<\/defs>/gi, "")
      .replace(/\sclass="[^"]*"/gi, "");
  }

  function getProfileMadlibsIconDimensions(filename) {
    if (
      typeof LABEL_BAR_SVG_DIMENSIONS !== "undefined" &&
      LABEL_BAR_SVG_DIMENSIONS[filename]
    ) {
      return LABEL_BAR_SVG_DIMENSIONS[filename];
    }
    return { width: 1, height: 1 };
  }

  function createMadlibsFieldIcon(stepId) {
    var file = getProfileMadlibsIconFile(stepId);
    if (!file) return null;
    var innerMarkup = getProfileMadlibsIconInnerMarkup(file);
    if (!innerMarkup) return null;
    var dims = getProfileMadlibsIconDimensions(file);
    var icon = document.createElement("span");
    icon.className = "questionnaire-madlibs-field__icon";
    icon.setAttribute("aria-hidden", "true");

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute(
      "viewBox",
      "0 0 " + String(dims.width) + " " + String(dims.height)
    );
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = innerMarkup;
    icon.appendChild(svg);

    if (dims.width && dims.height) {
      var ratio = dims.width / dims.height;
      icon.style.height = "1.15em";
      icon.style.width = "calc(1.15em * " + ratio + ")";
    }
    return icon;
  }

  function updateProfileMadlibsFieldIcon(stepId) {
    var profileStep = getStepElForSection("profile");
    if (!profileStep) return;
    var file = getProfileMadlibsIconFile(stepId);
    if (!file) return;
    var innerMarkup = getProfileMadlibsIconInnerMarkup(file);
    if (!innerMarkup) return;
    var dims = getProfileMadlibsIconDimensions(file);
    var fieldWrap = profileStep.querySelector(
      '.questionnaire-madlibs-field[data-field-id="' + stepId + '"]'
    );
    if (!fieldWrap) return;
    var iconWrap = fieldWrap.querySelector(".questionnaire-madlibs-field__icon");
    if (!iconWrap) return;
    var svg = iconWrap.querySelector("svg");
    if (!svg) return;
    svg.setAttribute(
      "viewBox",
      "0 0 " + String(dims.width) + " " + String(dims.height)
    );
    svg.innerHTML = innerMarkup;
    if (dims.width && dims.height) {
      var ratio = dims.width / dims.height;
      iconWrap.style.height = "1.15em";
      iconWrap.style.width = "calc(1.15em * " + ratio + ")";
    }
  }

  function wrapMadlibsFieldWithIcon(stepId, blankEl) {
    var icon = createMadlibsFieldIcon(stepId);
    if (!icon) return blankEl;
    var wrap = document.createElement("span");
    wrap.className = "questionnaire-madlibs-field";
    wrap.setAttribute("data-field-id", stepId);
    wrap.appendChild(icon);
    wrap.appendChild(blankEl);
    return wrap;
  }

  function resolveMadlibsBlankEl(el) {
    if (!el) return null;
    if (el.classList.contains("questionnaire-madlibs-field")) {
      return el.querySelector(
        ".questionnaire-madlibs-blank, .questionnaire-madlibs-dropdown"
      );
    }
    return el;
  }

  function isMadlibsBlankSegment(el) {
    return (
      el.classList.contains("questionnaire-madlibs-field") ||
      el.classList.contains("questionnaire-madlibs-blank") ||
      el.classList.contains("questionnaire-madlibs-dropdown")
    );
  }

  function normalizeProfileAnswerInputValue(input) {
    if (!input || input.readOnly) {
      return String(input ? input.value : "");
    }
    var rawValue = String(input.value || "");
    // English profile fields (from / now in / name) opt in via lang="en".
    // For those we drop anything that is not a Latin letter or space so
    // Hebrew (and other non-Latin characters) can't be typed or pasted in.
    var englishOnly = input.lang === "en";
    var normalized = englishOnly
      ? rawValue.replace(/[^A-Za-z ]/g, "").toUpperCase()
      : rawValue.toUpperCase();
    if (normalized !== input.value) {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      // When characters are removed, shift the caret back by however many
      // disallowed characters sat before it, so typing/backspacing stays natural.
      var removedBeforeStart = 0;
      var removedBeforeEnd = 0;
      if (englishOnly && typeof start === "number" && typeof end === "number") {
        removedBeforeStart =
          start - rawValue.slice(0, start).replace(/[^A-Za-z ]/g, "").length;
        removedBeforeEnd =
          end - rawValue.slice(0, end).replace(/[^A-Za-z ]/g, "").length;
      }
      input.value = normalized;
      if (typeof start === "number" && typeof end === "number") {
        try {
          input.setSelectionRange(
            start - removedBeforeStart,
            end - removedBeforeEnd
          );
        } catch (err) {
          /* ignore invalid selection on some input types */
        }
      }
    }
    return normalized;
  }

  function createMadlibsTextBlank(stepId, sizeClass) {
    var stepConfig = getStepConfig(stepId);
    var input = document.createElement("input");
    input.type = "text";
    input.className =
      "questionnaire-madlibs-blank questionnaire-madlibs-blank--" + sizeClass;
    input.setAttribute("data-step-id", stepId);
    input.setAttribute("aria-label", stepConfig.ariaLabel);
    input.value = String(answers[stepId] || "").toUpperCase();
    answers[stepId] = input.value;
    input.autocomplete = "off";
    input.spellcheck = false;
    if (stepConfig.english) {
      input.classList.add("questionnaire-madlibs-blank--english");
      input.lang = "en";
    }
    if (stepConfig.inputMode) {
      input.inputMode = stepConfig.inputMode;
    }
    if (stepConfig.maxLength) {
      input.maxLength = stepConfig.maxLength;
    }
    input.addEventListener("input", function () {
      answers[stepId] = normalizeProfileAnswerInputValue(input);
      if (stepId === "name" && syncNameModeDropdownLabels) {
        syncNameModeDropdownLabels();
      }
      syncProfileBlankReached(stepId);
    });
    input.addEventListener("change", function () {
      answers[stepId] = normalizeProfileAnswerInputValue(input);
      if (stepId === "name" && syncNameModeDropdownLabels) {
        syncNameModeDropdownLabels();
      }
      syncProfileBlankReached(stepId);
    });
    input.addEventListener("blur", function () {
      answers[stepId] = normalizeProfileAnswerInputValue(input);
      syncProfileContinueBtn();
    });
    appendMadlibsEnterAdvance(input, stepId);
    bindMadlibsTextInputAutoWidth(input);
    return input;
  }

  function ensureMadlibsDropdownDismiss() {
    if (madlibsDropdownDismissRegistered) return;
    madlibsDropdownDismissRegistered = true;
    document.addEventListener("click", function () {
      if (activeMadlibsDropdown) {
        closeMadlibsDropdown(activeMadlibsDropdown);
      }
    });
  }

  function closeMadlibsDropdown(dropdown) {
    if (!dropdown) return;
    var menu = dropdown.querySelector(".questionnaire-madlibs-dropdown__menu");
    var trigger = dropdown.querySelector(".questionnaire-madlibs-dropdown__trigger");
    var caretBtn = dropdown.querySelector(
      ".questionnaire-madlibs-name-mode__caret-btn"
    );
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (caretBtn) caretBtn.setAttribute("aria-expanded", "false");
    if (activeMadlibsDropdown === dropdown) {
      activeMadlibsDropdown = null;
    }
  }

  function openMadlibsDropdown(dropdown) {
    if (activeMadlibsDropdown && activeMadlibsDropdown !== dropdown) {
      closeMadlibsDropdown(activeMadlibsDropdown);
    }
    var menu = dropdown.querySelector(".questionnaire-madlibs-dropdown__menu");
    var trigger = dropdown.querySelector(".questionnaire-madlibs-dropdown__trigger");
    if (menu) menu.hidden = false;
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    activeMadlibsDropdown = dropdown;
  }

  function createMadlibsDropdown(
    stepId,
    sizeClass,
    ariaLabel,
    options,
    onSelect,
    labelOverrides
  ) {
    ensureMadlibsDropdownDismiss();
    labelOverrides = labelOverrides || {};

    var wrap = document.createElement("div");
    wrap.className =
      "questionnaire-madlibs-dropdown questionnaire-madlibs-blank questionnaire-madlibs-blank--" +
      sizeClass;
    wrap.setAttribute("data-step-id", stepId);
    if (answers[stepId]) {
      wrap.setAttribute("data-value", String(answers[stepId]));
    }

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "questionnaire-madlibs-dropdown__trigger";
    trigger.setAttribute("aria-label", ariaLabel);
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    var labelEl = document.createElement("span");
    labelEl.className = "questionnaire-madlibs-dropdown__label";

    var caret = document.createElement("span");
    caret.className = "questionnaire-madlibs-dropdown__caret";
    caret.setAttribute("aria-hidden", "true");

    trigger.appendChild(labelEl);
    trigger.appendChild(caret);

    var menu = document.createElement("ul");
    menu.className = "questionnaire-madlibs-dropdown__menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", ariaLabel);
    menu.hidden = true;

    function findOptionLabel(value) {
      var i;
      for (i = 0; i < options.length; i++) {
        if (options[i].value === value) return options[i].label;
      }
      return "";
    }

    function syncTriggerLabel() {
      var value = String(answers[stepId] || "");
      var label;
      if (labelOverrides.getTriggerLabel) {
        label = labelOverrides.getTriggerLabel();
      } else {
        label = findOptionLabel(value);
      }
      labelEl.textContent = label || "\u00a0";
      labelEl.classList.toggle("is-placeholder", !label);
      if (value) {
        wrap.setAttribute("data-value", value);
      } else {
        wrap.removeAttribute("data-value");
      }
      syncMadlibsDropdownWidth(wrap);
    }

    function syncOptionLabels() {
      if (!labelOverrides.getOptionDisplayLabel) return;
      var optionEls = menu.querySelectorAll(
        ".questionnaire-madlibs-dropdown__option"
      );
      var i;
      for (i = 0; i < optionEls.length; i++) {
        var optValue = optionEls[i].getAttribute("data-value");
        var j;
        for (j = 0; j < options.length; j++) {
          if (options[j].value === optValue) {
            optionEls[i].textContent = labelOverrides.getOptionDisplayLabel(
              options[j]
            );
            break;
          }
        }
      }
    }

    function syncAllLabels() {
      syncTriggerLabel();
      syncOptionLabels();
    }

    function setSelectedOption(value) {
      var optionEls = menu.querySelectorAll(".questionnaire-madlibs-dropdown__option");
      var i;
      for (i = 0; i < optionEls.length; i++) {
        var isSelected = optionEls[i].getAttribute("data-value") === value;
        optionEls[i].classList.toggle("is-selected", isSelected);
        optionEls[i].setAttribute("aria-selected", isSelected ? "true" : "false");
      }
    }

    options.forEach(function (opt) {
      var item = document.createElement("li");
      item.className = "questionnaire-madlibs-dropdown__option";
      item.setAttribute("role", "option");
      item.setAttribute("data-value", opt.value);
      item.textContent = labelOverrides.getOptionDisplayLabel
        ? labelOverrides.getOptionDisplayLabel(opt)
        : opt.label;
      if (answers[stepId] === opt.value) {
        item.classList.add("is-selected");
        item.setAttribute("aria-selected", "true");
      } else {
        item.setAttribute("aria-selected", "false");
      }
      item.addEventListener("click", function (event) {
        event.stopPropagation();
        answers[stepId] = opt.value;
        wrap.setAttribute("data-value", opt.value);
        syncAllLabels();
        setSelectedOption(opt.value);
        closeMadlibsDropdown(wrap);
        if (onSelect) onSelect(opt.value);
        syncProfileBlankReached(stepId);
      });
      menu.appendChild(item);
    });

    syncAllLabels();

    if (labelOverrides.registerSync) {
      labelOverrides.registerSync(syncAllLabels);
    }

    trigger.addEventListener("click", function (event) {
      event.stopPropagation();
      if (activeMadlibsDropdown === wrap) {
        closeMadlibsDropdown(wrap);
        return;
      }
      openMadlibsDropdown(wrap);
    });

    trigger.addEventListener("focus", function () {
      currentProfileBlankId = stepId;
      updateCardAccessibilityForProfile();
    });

    trigger.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMadlibsDropdown(wrap);
        return;
      }
      if (event.key === "Enter" && isStepComplete(stepId)) {
        event.preventDefault();
        var next = getNextProfileBlank(stepId);
        if (next) {
          focusProfileBlank(next);
          return;
        }
        focusProfileContinueBtn();
      }
    });

    menu.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    return wrap;
  }

  function createMadlibsNameModeSelect(sizeClass) {
    ensureMadlibsDropdownDismiss();

    var stepId = "nameDisplayMode";
    var nameStepConfig = getStepConfig("name");
    var options = nameStepConfig.modes;
    var ariaLabel = nameStepConfig.modeAriaLabel;
    var nameInputEditing = false;

    var wrap = document.createElement("div");
    wrap.className =
      "questionnaire-madlibs-dropdown questionnaire-madlibs-name-mode questionnaire-madlibs-blank questionnaire-madlibs-blank--" +
      sizeClass;
    wrap.setAttribute("data-step-id", stepId);
    if (answers[stepId]) {
      wrap.setAttribute("data-value", String(answers[stepId]));
    }

    var surface = document.createElement("div");
    surface.className = "questionnaire-madlibs-name-mode__surface";

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "questionnaire-madlibs-name-mode__input";
    nameInput.setAttribute("data-step-id", "name");
    nameInput.setAttribute("aria-label", nameStepConfig.ariaLabel);
    nameInput.placeholder = nameStepConfig.placeholder;
    nameInput.autocomplete = "off";
    nameInput.spellcheck = false;
    nameInput.lang = "en";

    var caretBtn = document.createElement("button");
    caretBtn.type = "button";
    caretBtn.className = "questionnaire-madlibs-name-mode__caret-btn";
    caretBtn.setAttribute("aria-label", ariaLabel);
    caretBtn.setAttribute("aria-haspopup", "listbox");
    caretBtn.setAttribute("aria-expanded", "false");

    var caretBtnIcon = document.createElement("span");
    caretBtnIcon.className = "questionnaire-madlibs-dropdown__caret";
    caretBtnIcon.setAttribute("aria-hidden", "true");
    caretBtn.appendChild(caretBtnIcon);

    surface.appendChild(nameInput);
    surface.appendChild(caretBtn);

    var menu = document.createElement("ul");
    menu.className = "questionnaire-madlibs-dropdown__menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", ariaLabel);
    menu.hidden = true;

    function syncMenuExpanded(isOpen) {
      caretBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    function closeNameModeMenu() {
      menu.hidden = true;
      syncMenuExpanded(false);
      if (activeMadlibsDropdown === wrap) {
        activeMadlibsDropdown = null;
      }
    }

    function openNameModeMenu() {
      if (activeMadlibsDropdown && activeMadlibsDropdown !== wrap) {
        closeMadlibsDropdown(activeMadlibsDropdown);
      }
      menu.hidden = false;
      syncMenuExpanded(true);
      activeMadlibsDropdown = wrap;
    }

    function syncOptionLabels() {
      var optionEls = menu.querySelectorAll(
        ".questionnaire-madlibs-dropdown__option"
      );
      var i;
      for (i = 0; i < optionEls.length; i++) {
        var optValue = optionEls[i].getAttribute("data-value");
        var j;
        for (j = 0; j < options.length; j++) {
          if (options[j].value === optValue) {
            optionEls[i].textContent = getNameModeDisplayLabel(
              options[j].value,
              answers.name
            );
            break;
          }
        }
      }
    }

    function syncAllLabels() {
      syncOptionLabels();
      syncMadlibsDropdownWidth(wrap);
    }

    syncNameModeDropdownLabels = syncAllLabels;

    function setSelectedOption(value) {
      var optionEls = menu.querySelectorAll(
        ".questionnaire-madlibs-dropdown__option"
      );
      var i;
      for (i = 0; i < optionEls.length; i++) {
        var isSelected = optionEls[i].getAttribute("data-value") === value;
        optionEls[i].classList.toggle("is-selected", isSelected);
        optionEls[i].setAttribute(
          "aria-selected",
          isSelected ? "true" : "false"
        );
      }
    }

    function applyInputDisplay() {
      var mode = answers.nameDisplayMode;
      var isAnonymous = mode === "anonymous";
      wrap.classList.toggle("is-anonymous-mode", isAnonymous);
      wrap.classList.toggle("is-name-editing", !isAnonymous);
      nameInput.readOnly = isAnonymous;
      if (answers.nameDisplayMode) {
        wrap.setAttribute("data-value", String(answers.nameDisplayMode));
      }
      if (isAnonymous) {
        nameInput.value = getNameModeDisplayLabel("anonymous", answers.name);
        nameInput.placeholder = "";
      } else if (mode === "initials" && !nameInputEditing) {
        var initialsLabel = getNameModeDisplayLabel("initials", answers.name);
        var emptyInitials = getNameModeDisplayLabel("initials", "");
        nameInput.value = initialsLabel === emptyInitials ? "" : initialsLabel;
        nameInput.placeholder = getUiString("initialsPlaceholder");
      } else if (mode === "name" && !nameInputEditing) {
        var nameLabel = getNameModeDisplayLabel("name", answers.name);
        var emptyName = getNameModeDisplayLabel("name", "");
        nameInput.value =
          nameLabel === emptyName ? "" : String(answers.name || "").toUpperCase();
        nameInput.placeholder = getUiString("namePlaceholder");
      } else {
        nameInput.value = String(answers.name || "").toUpperCase();
        nameInput.placeholder = nameStepConfig.placeholder;
      }
      syncMadlibsDropdownWidth(wrap);
    }

    function applyModeUi(focusInput) {
      applyInputDisplay();
      if (focusInput) {
        currentProfileBlankId = "name";
        focusWithoutScroll(nameInput);
      }
    }

    options.forEach(function (opt) {
      var item = document.createElement("li");
      item.className = "questionnaire-madlibs-dropdown__option";
      item.setAttribute("role", "option");
      item.setAttribute("data-value", opt.value);
      item.textContent = getNameModeDisplayLabel(opt.value, answers.name);
      if (answers[stepId] === opt.value) {
        item.classList.add("is-selected");
        item.setAttribute("aria-selected", "true");
      } else {
        item.setAttribute("aria-selected", "false");
      }
      item.addEventListener("click", function (event) {
        event.stopPropagation();
        answers[stepId] = opt.value;
        wrap.setAttribute("data-value", opt.value);
        setSelectedOption(opt.value);
        closeNameModeMenu();
        applyModeUi(opt.value === "initials" || opt.value === "name");
        syncAllLabels();
        syncProfileBlankReached(stepId);
        syncProfileBlankReached("name");
      });
      menu.appendChild(item);
    });

    nameInput.addEventListener("input", function () {
      if (nameInput.readOnly) return;
      answers.name = normalizeProfileAnswerInputValue(nameInput);
      syncOptionLabels();
      syncProfileBlankReached("name");
    });
    nameInput.addEventListener("change", function () {
      if (nameInput.readOnly) return;
      answers.name = normalizeProfileAnswerInputValue(nameInput);
      syncOptionLabels();
      syncProfileBlankReached("name");
    });
    nameInput.addEventListener("blur", function () {
      if (!nameInput.readOnly) {
        answers.name = normalizeProfileAnswerInputValue(nameInput);
      }
      nameInputEditing = false;
      applyInputDisplay();
      syncProfileContinueBtn();
    });
    nameInput.addEventListener("focus", function () {
      nameInputEditing = true;
      if (answers.nameDisplayMode === "initials") {
        nameInput.value = String(answers.name || "").toUpperCase();
        nameInput.placeholder = nameStepConfig.placeholder;
      }
      currentProfileBlankId =
        answers.nameDisplayMode === "anonymous" ? stepId : "name";
      updateCardAccessibilityForProfile();
    });
    nameInput.addEventListener("click", function (event) {
      if (nameInput.readOnly) {
        event.stopPropagation();
        openNameModeMenu();
      }
    });
    nameInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeNameModeMenu();
        return;
      }
      if (event.key === "Enter" && answers.nameDisplayMode === "anonymous") {
        if (isStepComplete(stepId)) {
          event.preventDefault();
          var next = getNextProfileBlank(stepId);
          if (next) {
            focusProfileBlank(next);
            return;
          }
          focusProfileContinueBtn();
        }
      }
    });
    appendMadlibsEnterAdvance(nameInput, "name");
    bindMadlibsTextInputAutoWidth(nameInput);

    caretBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      if (activeMadlibsDropdown === wrap) {
        closeNameModeMenu();
        return;
      }
      openNameModeMenu();
    });

    menu.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    wrap.appendChild(surface);
    wrap.appendChild(menu);

    applyModeUi(false);
    syncAllLabels();

    return wrap;
  }

  function createMadlibsSelectBlank(stepId, sizeClass) {
    var stepConfig = getStepConfig(stepId);
    return createMadlibsDropdown(
      stepId,
      sizeClass,
      stepConfig.ariaLabel,
      stepConfig.options,
      null
    );
  }

  function syncProfileContinueBtn() {
    checkSectionCompletion("profile");
  }

  function createTypewriterController() {
    var cancelled = false;
    /** @type {number[]} */
    var timers = [];
    return {
      cancel: function () {
        cancelled = true;
        timers.forEach(function (id) {
          window.clearTimeout(id);
        });
        timers = [];
      },
      isCancelled: function () {
        return cancelled;
      },
      wait: function (ms, cb) {
        if (cancelled) {
          cb(false);
          return;
        }
        var id = window.setTimeout(function () {
          cb(!cancelled);
        }, ms);
        timers.push(id);
      },
    };
  }

  function getBlankCharCount(el) {
    var blankEl = resolveMadlibsBlankEl(el) || el;
    if (blankEl.classList.contains("questionnaire-madlibs-blank--short")) {
      return TYPEWRITER_BLANK_CHARS.short;
    }
    if (blankEl.classList.contains("questionnaire-madlibs-blank--long")) {
      return TYPEWRITER_BLANK_CHARS.long;
    }
    return TYPEWRITER_BLANK_CHARS.medium;
  }

  function setBlankTabBlocked(el, blocked) {
    var blankEl = resolveMadlibsBlankEl(el) || el;
    if (blankEl.tagName === "INPUT") {
      if (blocked) blankEl.setAttribute("tabindex", "-1");
      else blankEl.removeAttribute("tabindex");
      return;
    }
    var trigger = blankEl.querySelector(".questionnaire-madlibs-dropdown__trigger");
    var nameModeInput = blankEl.querySelector(
      ".questionnaire-madlibs-name-mode__input"
    );
    if (nameModeInput) {
      if (blocked) nameModeInput.setAttribute("tabindex", "-1");
      else nameModeInput.removeAttribute("tabindex");
      return;
    }
    if (trigger) {
      if (blocked) trigger.setAttribute("tabindex", "-1");
      else trigger.removeAttribute("tabindex");
    }
  }

  function serializeMadlibsLine(lineEl) {
    /** @type {Array<{ type: string, el: HTMLElement, content?: string, placeholderChars?: number, skipTyping?: boolean }>} */
    var segments = [];
    var child = lineEl.firstChild;

    while (child) {
      var next = child.nextSibling;
      if (child.nodeType === Node.TEXT_NODE) {
        var content = child.textContent || "";
        if (content) {
          var span = document.createElement("span");
          span.className = "questionnaire-typewriter-chunk";
          lineEl.replaceChild(span, child);
          segments.push({ type: "text", el: span, content: content });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        var el = /** @type {HTMLElement} */ (child);
        if (isMadlibsBlankSegment(el)) {
          var blankEl = resolveMadlibsBlankEl(el) || el;
          setBlankTabBlocked(blankEl, true);
          segments.push({
            type: "blank",
            el: el,
            placeholderChars: getBlankCharCount(blankEl),
            skipTyping: blankEl.hasAttribute("hidden"),
          });
        }
      }
      child = next;
    }

    return segments;
  }

  function prepareProfileTypewriter(madlibsEl) {
    var lines = madlibsEl.querySelectorAll(".questionnaire-madlibs-line");
    /** @type {Array<{ lineEl: HTMLElement, segments: Array }>} */
    var state = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      state.push({
        lineEl: /** @type {HTMLElement} */ (lines[i]),
        segments: serializeMadlibsLine(/** @type {HTMLElement} */ (lines[i])),
      });
    }
    return state;
  }

  function clearTypewriterUnderlineDraw(seg) {
    var blankEl = resolveMadlibsBlankEl(seg.el) || seg.el;
    seg.el.classList.remove(
      "is-active",
      "is-typewriter-drawing-underline"
    );
    if (blankEl) {
      blankEl.classList.remove("is-typewriter-drawing-underline");
      blankEl.style.removeProperty("--typewriter-underline-progress");
    }
  }

  function syncMadlibsBlankWidth(blankEl) {
    if (!blankEl) return;
    if (blankEl.classList.contains("questionnaire-madlibs-dropdown")) {
      syncMadlibsDropdownWidth(blankEl);
      return;
    }
    if (blankEl.tagName === "INPUT") {
      syncMadlibsTextInputWidth(/** @type {HTMLInputElement} */ (blankEl));
    }
  }

  function completeTypewriterReveal(madlibsEl, lines, onComplete) {
    var li;
    var si;
    var seg;
    for (li = 0; li < lines.length; li++) {
      for (si = 0; si < lines[li].segments.length; si++) {
        seg = lines[li].segments[si];
        if (seg.type === "text") {
          seg.el.textContent = seg.content || "";
          seg.el.classList.remove("is-active");
        } else if (seg.type === "blank") {
          clearTypewriterUnderlineDraw(seg);
          seg.el.classList.add("is-typewriter-revealed");
          var revealedBlank = resolveMadlibsBlankEl(seg.el) || seg.el;
          revealedBlank.classList.add("is-typewriter-revealed");
          setBlankTabBlocked(seg.el, false);
        }
      }
    }
    madlibsEl.classList.remove("is-typewriting");
    madlibsEl.removeAttribute("aria-busy");
    profileTypewriterController = null;
    profileTypewriterState = null;
    syncAllProfileMadlibsBlankWidths(madlibsEl);
    if (typeof onComplete === "function") onComplete();
  }

  function cancelProfileTypewriter() {
    if (!profileTypewriterController || !profileTypewriterState) return;
    profileTypewriterController.cancel();
    completeTypewriterReveal(
      profileTypewriterState.madlibsEl,
      profileTypewriterState.lines,
      null
    );
  }

  function countTypewriterTicks(lines) {
    var ticks = 0;
    var li;
    var si;
    var seg;
    for (li = 0; li < lines.length; li++) {
      for (si = 0; si < lines[li].segments.length; si++) {
        seg = lines[li].segments[si];
        if (seg.type === "text") {
          ticks += (seg.content || "").length;
        } else if (seg.type === "blank" && !seg.skipTyping) {
          ticks += seg.placeholderChars || 0;
        }
      }
    }
    return {
      ticks: ticks,
      linePauses: Math.max(0, lines.length - 1),
    };
  }

  function getTypewriterTiming(lines) {
    var counts = countTypewriterTicks(lines);
    if (counts.ticks === 0 && counts.linePauses === 0) {
      return { charMs: 0, linePauseMs: 0 };
    }
    var unitMs =
      TYPEWRITER_TOTAL_MS /
      (counts.ticks + counts.linePauses * TYPEWRITER_LINE_PAUSE_RATIO);
    return {
      charMs: Math.max(6, Math.round(unitMs)),
      linePauseMs: Math.max(4, Math.round(unitMs * TYPEWRITER_LINE_PAUSE_RATIO)),
    };
  }

  function runProfileTypewriter(madlibsEl, onComplete) {
    madlibsEl.classList.add("is-typewriting");
    madlibsEl.setAttribute("aria-busy", "true");

    var lines = prepareProfileTypewriter(madlibsEl);
    var timing = getTypewriterTiming(lines);
    var charMs = timing.charMs;
    var linePauseMs = timing.linePauseMs;
    var controller = createTypewriterController();
    profileTypewriterController = controller;
    profileTypewriterState = { madlibsEl: madlibsEl, lines: lines };

    function finish() {
      if (controller.isCancelled()) return;
      completeTypewriterReveal(madlibsEl, lines, onComplete);
    }

    function typeTextSegment(seg, cb) {
      if (controller.isCancelled()) {
        cb();
        return;
      }
      seg.el.classList.add("is-active");
      var index = 0;
      function step() {
        if (controller.isCancelled()) {
          cb();
          return;
        }
        if (index >= (seg.content || "").length) {
          seg.el.classList.remove("is-active");
          cb();
          return;
        }
        seg.el.textContent += seg.content.charAt(index);
        index += 1;
        controller.wait(charMs, function (ok) {
          if (ok) step();
          else cb();
        });
      }
      step();
    }

    function typeBlankSegment(lineEl, seg, cb) {
      if (controller.isCancelled()) {
        cb();
        return;
      }
      if (seg.skipTyping) {
        seg.el.classList.add("is-typewriter-revealed");
        var skippedBlank = resolveMadlibsBlankEl(seg.el) || seg.el;
        skippedBlank.classList.add("is-typewriter-revealed");
        setBlankTabBlocked(seg.el, false);
        cb();
        return;
      }

      var blankEl = resolveMadlibsBlankEl(seg.el) || seg.el;
      syncMadlibsBlankWidth(blankEl);

      seg.el.classList.add(
        "is-typewriter-revealed",
        "is-typewriter-drawing-underline",
        "is-active"
      );
      blankEl.classList.add("is-typewriter-drawing-underline");
      blankEl.style.setProperty("--typewriter-underline-progress", "0");

      var index = 0;
      var total = seg.placeholderChars || 0;

      function finishBlank() {
        clearTypewriterUnderlineDraw(seg);
        blankEl.classList.add("is-typewriter-revealed");
        setBlankTabBlocked(seg.el, false);
        cb();
      }

      function step() {
        if (controller.isCancelled()) {
          clearTypewriterUnderlineDraw(seg);
          cb();
          return;
        }
        if (index >= total) {
          finishBlank();
          return;
        }
        index += 1;
        blankEl.style.setProperty(
          "--typewriter-underline-progress",
          String(index / total)
        );
        controller.wait(charMs, function (ok) {
          if (ok) step();
          else {
            clearTypewriterUnderlineDraw(seg);
            cb();
          }
        });
      }
      step();
    }

    function runSegment(lineIndex, segIndex) {
      if (controller.isCancelled()) return;
      if (lineIndex >= lines.length) {
        finish();
        return;
      }

      var line = lines[lineIndex];
      if (segIndex >= line.segments.length) {
        controller.wait(linePauseMs, function (ok) {
          if (ok) runSegment(lineIndex + 1, 0);
        });
        return;
      }

      var seg = line.segments[segIndex];
      function next() {
        runSegment(lineIndex, segIndex + 1);
      }

      if (seg.type === "text") {
        typeTextSegment(seg, next);
        return;
      }
      typeBlankSegment(line.lineEl, seg, next);
    }

    runSegment(0, 0);
  }

  function appendMadlibsTemplatePart(lineEl, part) {
    if (part.t === "text") {
      lineEl.appendChild(document.createTextNode(part.v));
      return;
    }
    if (part.t === "break") {
      // Soft line break inside the same madlibs line — keeps the "until <year>"
      // question grouped on its own visual row without a full paragraph gap.
      lineEl.appendChild(document.createElement("br"));
      return;
    }
    if (part.t === "nameMode") {
      lineEl.appendChild(createMadlibsNameModeSelect(part.size || "medium"));
      return;
    }
    if (part.t === "blank") {
      var blankEl =
        part.kind === "select"
          ? createMadlibsSelectBlank(part.id, part.size || "medium")
          : createMadlibsTextBlank(part.id, part.size || "medium");
      lineEl.appendChild(wrapMadlibsFieldWithIcon(part.id, blankEl));
    }
  }

  function renderProfileMadLibs() {
    var stepEl = document.createElement("div");
    stepEl.className =
      "questionnaire-step questionnaire-step--profile-madlibs";
    stepEl.setAttribute("data-step-id", PROFILE_ALL_STEP_ID);

    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var madlibsTemplate = getStrings().madLibs;
    var madlibs = document.createElement("div");
    madlibs.className = "questionnaire-profile-madlibs";
    madlibs.setAttribute("role", "group");
    madlibs.setAttribute("aria-label", madlibsTemplate.ariaLabel);

    var lineIndex;
    for (lineIndex = 0; lineIndex < madlibsTemplate.lines.length; lineIndex++) {
      var lineParts = madlibsTemplate.lines[lineIndex];
      var lineEl = document.createElement("p");
      lineEl.className = "questionnaire-madlibs-line";
      var partIndex;
      for (partIndex = 0; partIndex < lineParts.length; partIndex++) {
        appendMadlibsTemplatePart(lineEl, lineParts[partIndex]);
      }
      madlibs.appendChild(lineEl);
    }

    answersWrap.appendChild(madlibs);

    syncProfileMadlibsAnswersFromDom();
    syncAllProfileMadlibsBlankWidths(madlibs);

    stepEl.appendChild(answersWrap);
    currentProfileBlankId = "nameDisplayMode";
    return stepEl;
  }

  function renderAllFeelings() {
    var stepEl = document.createElement("div");
    stepEl.className =
      "questionnaire-step questionnaire-step--feelings-all";
    stepEl.setAttribute("data-step-id", FEELINGS_ALL_STEP_ID);

    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var intro = document.createElement("p");
    intro.className = "questionnaire-feelings-intro";
    intro.textContent = getStrings().feelings.intro;
    answersWrap.appendChild(intro);

    var list = document.createElement("div");
    list.className = "questionnaire-feelings-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", getUiString("feelingsAria"));

    function syncSectionChange() {
      checkSectionCompletion("feelings");
    }

    // Shuffle button is pinned (via CSS) to the top-right of the chart, so it
    // lives inside the list — the chart's positioning context — rather than in
    // the column flow above the chart.
    appendFeelingsShuffleButton(list);

    appendFeelingsSpiderChart(list, syncSectionChange);

    var hopeBlock = document.createElement("div");
    hopeBlock.className =
      "questionnaire-feelings-hope-block questionnaire-section-question";

    appendQuestionnaireSectionQuestionHeading(
      hopeBlock,
      getStrings().feelings.hopeHeading
    );

    var hopeStepConfig = getStepConfig("hopeMode");
    if (hopeStepConfig) {
      appendQuestionnaireHopeChoice(
        hopeBlock,
        hopeStepConfig,
        "hopeMode",
        syncSectionChange
      );
    }
    list.appendChild(hopeBlock);

    answersWrap.appendChild(list);
    stepEl.appendChild(answersWrap);

    applyQuestionnaireFeelingsToCanvas();

    return stepEl;
  }

  function renderAllGrid() {
    var stepEl = document.createElement("div");
    stepEl.className = "questionnaire-step questionnaire-step--grid-all";
    stepEl.setAttribute("data-step-id", GRID_ALL_STEP_ID);

    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var list = document.createElement("div");
    list.className = "questionnaire-section-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", getUiString("gridAria"));

    function syncSectionChange() {
      checkSectionCompletion("grid");
    }

    var gridTypeBlock = document.createElement("div");
    gridTypeBlock.className = "questionnaire-section-question";
    appendQuestionnaireGridTypeChoice(gridTypeBlock, syncSectionChange);
    list.appendChild(gridTypeBlock);

    var octagonsBlock = document.createElement("div");
    octagonsBlock.className = "questionnaire-section-question";
    appendQuestionnaireSectionQuestionHeading(
      octagonsBlock,
      getStepConfig("octagonsN").label
    );
    appendQuestionnaireSliderControl(
      octagonsBlock,
      getStepConfig("octagonsN"),
      "octagonsN",
      syncSectionChange
    );
    list.appendChild(octagonsBlock);

    var innerScaleBlock = document.createElement("div");
    innerScaleBlock.className = "questionnaire-section-question";
    appendQuestionnaireSectionQuestionHeading(
      innerScaleBlock,
      getStepConfig("innerScale").label
    );
    appendQuestionnaireSliderControl(
      innerScaleBlock,
      getStepConfig("innerScale"),
      "innerScale",
      syncSectionChange
    );
    list.appendChild(innerScaleBlock);

    answersWrap.appendChild(list);
    stepEl.appendChild(answersWrap);
    return stepEl;
  }

  function renderAllFamily() {
    var stepEl = document.createElement("div");
    stepEl.className = "questionnaire-step questionnaire-step--family-all";
    stepEl.setAttribute("data-step-id", FAMILY_ALL_STEP_ID);

    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var list = document.createElement("div");
    list.className = "questionnaire-section-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", getUiString("familyAria"));

    function syncSectionChange() {
      if (answers.iranLossTypes === null && isAllFamilyComplete()) {
        answers.iranLossTypes = [];
        applyFamilyAnswersToPanel(false);
      }
      checkSectionCompletion("family");
    }

    FAMILY_STEP_ORDER.forEach(function (stepId) {
      var stepConfig = getStepConfig(stepId);
      if (!stepConfig) return;

      var questionBlock = document.createElement("div");
      questionBlock.className = "questionnaire-section-question";
      appendQuestionnaireSectionQuestionHeading(questionBlock, stepConfig.label);
      if (stepConfig.type === "choice") {
        appendQuestionnaireSingleChoiceControl(
          questionBlock,
          stepConfig,
          stepId,
          syncSectionChange
        );
      } else if (stepConfig.type === "yesno") {
        appendQuestionnaireYesNoControl(
          questionBlock,
          stepConfig,
          stepId,
          syncSectionChange
        );
      } else if (stepConfig.type === "multi-choice") {
        appendQuestionnaireMultiChoiceControl(
          questionBlock,
          stepConfig,
          stepId,
          syncSectionChange
        );
      } else if (stepConfig.type === "slider") {
        appendQuestionnaireSliderControl(
          questionBlock,
          stepConfig,
          stepId,
          syncSectionChange
        );
      }
      list.appendChild(questionBlock);
    });

    answersWrap.appendChild(list);
    stepEl.appendChild(answersWrap);
    return stepEl;
  }

  function renderSlider(stepConfig, stepId) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var sliderWrap = document.createElement("div");
    sliderWrap.className = "questionnaire-slider-wrap";

    if (stepConfig.rangeLabels && stepConfig.rangeLabels.length) {
      var rangeLabels = document.createElement("div");
      rangeLabels.className = "questionnaire-slider-range-labels";
      rangeLabels.setAttribute("aria-hidden", "true");
      stepConfig.rangeLabels.forEach(function (label, index) {
        var span = document.createElement("span");
        span.className = "questionnaire-slider-range-label";
        if (index === stepConfig.rangeLabels.length - 1) {
          span.classList.add("questionnaire-slider-range-label--end");
        }
        span.textContent = label;
        rangeLabels.appendChild(span);
      });
      sliderWrap.appendChild(rangeLabels);
    }

    var control = document.createElement("div");
    control.className = "questionnaire-slider-control";

    var slider = document.createElement("input");
    slider.type = "range";
    slider.className = "questionnaire-slider";
    slider.min = String(stepConfig.min);
    slider.max = String(stepConfig.max);
    slider.step = String(stepConfig.step || 1);
    slider.value = String(answers[stepId]);
    slider.setAttribute("aria-label", stepConfig.ariaLabel);

    var output = document.createElement("output");
    output.className = "questionnaire-slider-output";
    output.textContent =
      String(answers[stepId]) + (stepConfig.outputSuffix || "");

    slider.addEventListener("input", function () {
      syncQuestionnaireSliderBarFill(slider);
      answers[stepId] = Number(slider.value);
      output.textContent = slider.value + (stepConfig.outputSuffix || "");
      if (stepId === "fanLeaves") {
        checkSectionCompletion("bodyAutonomy");
      }
      if (stepConfig.sync === "palette") {
        syncPaletteToPanel(answers[stepId]);
        return;
      }
      if (stepId === "fanLeaves") {
        scheduleFanLeavesSliderCanvasUpdate(
          stepId,
          answers[stepId],
          true,
          false
        );
        return;
      }
      var domIds = PANEL_SLIDER_DOM[stepId];
      if (domIds) {
        coalescedCanvasUpdate(function () {
          ensureQuestionnaireCanvasUnlock(stepId);
          syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], false);
          triggerCanvasUpdateAfterSync(stepId, true);
        });
      }
    });

    // Release: run the full commit once on the final value.
    slider.addEventListener("change", function () {
      if (stepConfig.sync === "palette") return;
      if (stepId === "fanLeaves") {
        scheduleFanLeavesSliderCanvasUpdate(
          stepId,
          answers[stepId],
          false,
          true
        );
        checkSectionCompletion("bodyAutonomy");
        return;
      }
      var domIds = PANEL_SLIDER_DOM[stepId];
      if (domIds) {
        syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], false);
        triggerCanvasUpdateAfterSync(stepId, false);
      }
    });

    control.appendChild(createQuestionnaireSliderTrack(slider));
    syncQuestionnaireSliderBarFill(slider);
    control.appendChild(output);
    sliderWrap.appendChild(control);
    answersWrap.appendChild(sliderWrap);
    return answersWrap;
  }

  function stylePaletteDotFill(fill, paletteNum) {
    if (!fill) return;
    var key = "palette" + paletteNum;
    var btn = fill.parentElement;
    var base = btn
      ? btn.querySelector(".questionnaire-palette-dot__base")
      : null;
    var sheetPalettes = window.SheetPalettes;

    function applySolidColor(hex) {
      fill.style.background = hex;
      fill.style.backgroundColor = hex;
      if (base) base.style.backgroundColor = hex;
      if (btn) btn.style.backgroundColor = hex;
      fill.classList.remove("questionnaire-palette-dot__fill--mesh");
    }

    if (
      !sheetPalettes ||
      !sheetPalettes.getProminentPaletteColors ||
      !sheetPalettes.getPaletteMeshGradient
    ) {
      applySolidColor("#cccccc");
      return;
    }

    var colors = sheetPalettes.getProminentPaletteColors(key);
    if (!colors.length) {
      applySolidColor("#cccccc");
      return;
    }

    if (base) base.style.backgroundColor = colors[0];
    if (btn) btn.style.backgroundColor = colors[0];
    fill.style.backgroundColor = colors[0];

    if (colors.length === 1) {
      applySolidColor(colors[0]);
      return;
    }

    fill.style.background = sheetPalettes.getPaletteMeshGradient(key);
    fill.classList.add("questionnaire-palette-dot__fill--mesh");
  }

  function applyPaletteDotBackgrounds(group) {
    if (!group) return;
    var dots = group.querySelectorAll("[data-palette-num]");
    var i;
    for (i = 0; i < dots.length; i++) {
      var btn = dots[i];
      var num = Number(btn.getAttribute("data-palette-num"));
      if (!Number.isFinite(num)) continue;
      var fill = btn.querySelector(".questionnaire-palette-dot__fill");
      stylePaletteDotFill(fill, num);
    }
  }

  function refreshPalettePickerGradients() {
    if (currentStepId !== "palette" || !activePalettePickerGroup) return;
    applyPaletteDotBackgrounds(activePalettePickerGroup);
  }

  function ensurePaletteLoadedRefreshHook() {
    if (
      palettesLoadedHookRegistered ||
      typeof window.SheetPalettes === "undefined" ||
      !window.SheetPalettes.onPalettesLoaded
    ) {
      return;
    }
    palettesLoadedHookRegistered = true;
    window.SheetPalettes.onPalettesLoaded(function () {
      refreshPalettePickerGradients();
      scheduleQuestionnaireCardHeightSync();
    });
  }

  function renderPalettePicker(stepConfig, stepId) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var group = document.createElement("div");
    group.className = "questionnaire-palette-picker";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    var n;
    for (n = 1; n <= 12; n++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "questionnaire-palette-dot";
      btn.setAttribute("data-palette-num", String(n));
      btn.setAttribute("aria-label", getUiString("palettePrefix") + n);
      btn.setAttribute("aria-pressed", answers.palette === n ? "true" : "false");
      if (answers.palette === n) {
        btn.classList.add("is-selected");
      }
      var base = document.createElement("span");
      base.className = "questionnaire-palette-dot__base";
      base.setAttribute("aria-hidden", "true");
      var fill = document.createElement("span");
      fill.className = "questionnaire-palette-dot__fill";
      fill.setAttribute("aria-hidden", "true");
      btn.appendChild(base);
      btn.appendChild(fill);
      stylePaletteDotFill(fill, n);
      (function (paletteNum, button) {
        button.addEventListener("click", function () {
          answers[stepId] = paletteNum;
          group.querySelectorAll(".questionnaire-palette-dot").forEach(function (el) {
            el.classList.remove("is-selected");
            el.setAttribute("aria-pressed", "false");
          });
          button.classList.add("is-selected");
          button.setAttribute("aria-pressed", "true");
          syncPaletteToPanel(paletteNum);
          checkSectionCompletion("colors");
        });
      })(n, btn);
      group.appendChild(btn);
    }

    (function attachPaletteSpreadPersistence() {
      function clearPaletteSpread() {
        group.querySelectorAll(".questionnaire-palette-dot").forEach(function (dot) {
          dot.classList.remove("is-spread-before", "is-spread-after");
        });
      }

      function applyPaletteSpread(dot) {
        clearPaletteSpread();
        if (!dot) return;
        var paletteNum = Number(dot.getAttribute("data-palette-num"));
        if (paletteNum > 1) {
          dot.classList.add("is-spread-before");
        }
        if (dot.nextElementSibling) {
          dot.nextElementSibling.classList.add("is-spread-after");
        }
      }

      group.querySelectorAll(".questionnaire-palette-dot").forEach(function (dot) {
        dot.addEventListener("mouseenter", function () {
          applyPaletteSpread(dot);
        });
      });

      group.addEventListener("mouseleave", function (e) {
        var related = e.relatedTarget;
        if (related && group.contains(related)) return;
        clearPaletteSpread();
      });
    })();

    activePalettePickerGroup = group;
    ensurePaletteLoadedRefreshHook();
    refreshPalettePickerGradients();

    answersWrap.appendChild(group);
    return answersWrap;
  }

  function renderComplete() {
    var stepEl = document.createElement("div");
    stepEl.className = "questionnaire-step questionnaire-step--complete";
    stepEl.setAttribute("data-step-id", SUBMIT_ORDER_STEP_ID);

    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "questionnaire-archive-btn";
    saveBtn.textContent = getUiString("submitOrder");

    var confirmEl = document.createElement("p");
    confirmEl.className = "questionnaire-archive-confirm";
    confirmEl.hidden = true;
    confirmEl.textContent = getUiString("savedToArchive");

    saveBtn.addEventListener("click", function () {
      // Canvas already reflects questionnaire choices — resyncing the hidden
      // panel clears hope merge and reshuffles emotion marks.
      if (answers.hopeMode) {
        syncHopeModeToPanel(answers.hopeMode);
      }
      if (typeof window.render === "function") {
        window.render();
      }
      if (typeof window.layoutStage === "function") {
        window.layoutStage();
      }
      if (
        !window.HandkerchiefArchive ||
        !window.HandkerchiefArchive.saveCurrentDesign
      ) {
        return;
      }

      saveBtn.disabled = true;
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          window.HandkerchiefArchive.saveCurrentDesign()
            .then(function () {
              confirmEl.textContent = getUiString("savedToArchive");
              confirmEl.hidden = false;
              resetQuestionnaireAfterSubmit();
              navigateToArchiveAfterSubmit();
            })
            .catch(function (err) {
              console.warn("[Questionnaire] Save failed:", err);
              confirmEl.textContent =
                err && err.message === "Archive storage is full"
                  ? getUiString("archiveFull")
                  : getUiString("archiveError");
              confirmEl.hidden = false;
            })
            .finally(function () {
              saveBtn.disabled = false;
            });
        });
      });
    });

    stepEl.appendChild(saveBtn);
    stepEl.appendChild(confirmEl);
    return stepEl;
  }

  function prepareStepAnimationLayers(stepEl) {
    if (!stepEl) return stepEl;
    if (
      stepEl.querySelector(".questionnaire-step__anim-upper") ||
      stepEl.querySelector(".questionnaire-step__anim-lower")
    ) {
      return stepEl;
    }

    var heading = stepEl.querySelector(":scope > .questionnaire-step__heading");
    var toMoveLower = [];
    var child = stepEl.firstElementChild;

    while (child) {
      var next = child.nextElementSibling;
      if (child !== heading) {
        toMoveLower.push(child);
      }
      child = next;
    }

    if (heading) {
      var upper = document.createElement("div");
      upper.className = "questionnaire-step__anim-upper";
      upper.appendChild(heading);
      stepEl.insertBefore(upper, stepEl.firstChild);
    }

    if (toMoveLower.length > 0) {
      var lower = document.createElement("div");
      lower.className = "questionnaire-step__anim-lower";
      toMoveLower.forEach(function (el) {
        lower.appendChild(el);
      });
      stepEl.appendChild(lower);
    }

    return stepEl;
  }

  function buildStepElement(stepId) {
    var stepEl = null;

    if (stepId === PROFILE_ALL_STEP_ID) {
      stepEl = renderProfileMadLibs();
    } else if (stepId === GRID_ALL_STEP_ID) {
      stepEl = renderAllGrid();
    } else if (stepId === FAMILY_ALL_STEP_ID) {
      stepEl = renderAllFamily();
    } else if (stepId === FEELINGS_ALL_STEP_ID) {
      stepEl = renderAllFeelings();
    } else if (stepId === SUBMIT_ORDER_STEP_ID) {
      stepEl = renderComplete();
    } else {
      var stepConfig = getStepConfig(stepId);
      if (!stepConfig) return null;

      stepEl = document.createElement("div");
      stepEl.className = "questionnaire-step";
      stepEl.setAttribute("data-step-id", stepId);

      var heading = createHeading(stepConfig);
      if (heading) stepEl.appendChild(heading);

      var answersEl;
      switch (stepConfig.type) {
        case "yesno":
          answersEl = renderYesNo(stepConfig, stepId);
          break;
        case "multi-choice":
          answersEl = renderMultiChoice(stepConfig, stepId);
          break;
        case "choice":
          answersEl = renderChoice(stepConfig, stepId);
          break;
        case "text":
          answersEl = renderTextInput(stepConfig, stepId);
          break;
        case "name":
          answersEl = renderName(stepConfig);
          break;
        case "slider":
          answersEl = renderSlider(stepConfig, stepId);
          break;
        case "palette-picker":
          answersEl = renderPalettePicker(stepConfig, stepId);
          break;
        default:
          return null;
      }

      stepEl.appendChild(answersEl);
    }

    return stepEl ? prepareStepAnimationLayers(stepEl) : null;
  }

  function getStepFocusTarget(stepEl, stepId) {
    if (stepId === PROFILE_ALL_STEP_ID) {
      var blankId = currentProfileBlankId || "nameDisplayMode";
      if (blankId === "name" && !shouldShowNameTextInput()) {
        blankId = "nameDisplayMode";
      }
      var blankEl = stepEl.querySelector('[data-step-id="' + blankId + '"]');
      if (blankEl) {
        if (blankEl.classList.contains("questionnaire-madlibs-name-mode")) {
          var comboboxInput = blankEl.querySelector(
            ".questionnaire-madlibs-name-mode__input"
          );
          if (comboboxInput) return comboboxInput;
        }
        if (blankEl.classList.contains("questionnaire-madlibs-dropdown")) {
          if (blankId === "name") {
            var inlineName = blankEl.querySelector(
              ".questionnaire-madlibs-name-mode__input"
            );
            if (inlineName) return inlineName;
          }
          return blankEl.querySelector(
            ".questionnaire-madlibs-dropdown__trigger"
          );
        }
        return blankEl;
      }
      var nameModeWrap = stepEl.querySelector(
        ".questionnaire-madlibs-name-mode"
      );
      if (nameModeWrap) {
        return nameModeWrap.querySelector(
          ".questionnaire-madlibs-name-mode__input"
        );
      }
      return stepEl.querySelector(
        ".questionnaire-madlibs-name-mode__input"
      );
    }
    return stepEl.querySelector(
      "input, button.questionnaire-option, button.questionnaire-archive-btn, button.questionnaire-feelings-shuffle-btn, input.questionnaire-slider"
    );
  }

  function applyStepUIState(stepId, stepEl) {
    displayStepId = stepId;
    currentStepId = stepId === SUBMIT_ORDER_STEP_ID ? null : stepId;
    activeStepEl = stepEl;
    updateCardAccessibility(stepId);
    updateRemainingSteps(getCurrentSectionIndex(stepId));
    ensureQuestionnaireCanvasUnlock(stepId);
    syncCanvasLayoutForStep();
    if (isBodyAutonomyStep(stepId)) {
      syncFanLeavesToPanel(answers.fanLeaves, true);
      triggerCanvasRender();
    }
    if (
      (stepId === "gridType" || stepId === GRID_ALL_STEP_ID) &&
      answers.gridType &&
      !gridStepsReached.gridType
    ) {
      previewGridTypeOnCanvas();
    }
  }

  function getLastAnimPart(stepEl, phase, direction) {
    var upper = stepEl.querySelector(".questionnaire-step__anim-upper");
    var lower = stepEl.querySelector(".questionnaire-step__anim-lower");
    if (phase === "enter" && direction === "forward") {
      return lower || upper;
    }
    if (phase === "enter") {
      return direction === "forward" ? upper || lower : lower || upper;
    }
    return direction === "forward" ? lower || upper : upper || lower;
  }

  function setTransitionLock(active) {
    var page2 = document.getElementById("page2");
    if (page2) {
      page2.classList.toggle("questionnaire--step-transitioning", active);
    }
  }

  function clearSlideDistances(stepEl) {
    if (!stepEl) return;
    ["--exit-upper", "--exit-lower", "--enter-upper", "--enter-lower", "--enter-y"].forEach(
      function (prop) {
        stepEl.style.removeProperty(prop);
      }
    );
  }

  function clearSectionSlideDistances() {
    if (!sectionLabelEl) return;
    ["--exit-upper", "--enter-upper", "--enter-y"].forEach(function (prop) {
      sectionLabelEl.style.removeProperty(prop);
    });
  }

  function measureSectionExitDistance(direction) {
    if (!sectionLabelEl) return;
    var rect = sectionLabelEl.getBoundingClientRect();
    var distance =
      direction === "back"
        ? window.innerHeight - rect.top + rect.height
        : rect.top + rect.height;
    sectionLabelEl.style.setProperty("--exit-upper", distance + "px");
  }

  function measureSectionEnterDistance(direction) {
    if (!sectionLabelEl) return;
    var rect = sectionLabelEl.getBoundingClientRect();

    if (direction === "forward") {
      var enterY = Math.max(0, window.innerHeight - rect.top);
      sectionLabelEl.style.setProperty("--enter-y", enterY + "px");
      return;
    }

    var enterBack = rect.top + rect.height;
    sectionLabelEl.style.setProperty("--enter-y", enterBack + "px");
    sectionLabelEl.style.setProperty("--enter-upper", enterBack + "px");
  }

  function startSectionExitAnimation(direction, exitingClass) {
    if (!sectionLabelEl) return;
    measureSectionExitDistance(direction);
    sectionLabelEl.classList.remove("is-active");
    sectionLabelEl.classList.add(exitingClass);
    void sectionLabelEl.offsetHeight;
  }

  function startSectionEnterAnimation(direction, enteringClass) {
    if (!sectionLabelEl) return;

    sectionLabelEl.classList.remove("is-exiting-forward", "is-exiting-back");
    sectionLabelEl.classList.add("is-awaiting-enter");
    measureSectionEnterDistance(direction);
    sectionLabelEl.classList.remove("is-awaiting-enter");
    sectionLabelEl.classList.add(enteringClass);

    var completed = false;
    function finish() {
      if (completed) return;
      completed = true;
      sectionLabelEl.classList.remove(enteringClass);
      sectionLabelEl.style.removeProperty("transition");
      sectionLabelEl.style.removeProperty("transform");
      clearSectionSlideDistances();
      sectionLabelEl.classList.add("is-active");
    }

    if (direction === "forward") {
      playEnterSlide(sectionLabelEl, finish);
      return;
    }

    void sectionLabelEl.offsetHeight;

    function onEnterEnd(event) {
      if (completed) return;
      if (event.target !== sectionLabelEl) return;
      if (event.propertyName !== "transform") return;
      sectionLabelEl.removeEventListener("transitionend", onEnterEnd);
      finish();
    }

    sectionLabelEl.addEventListener("transitionend", onEnterEnd);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        sectionLabelEl.classList.add("is-active");
      });
    });
    window.setTimeout(finish, TRANSITION_MS + STAGGER_MS + 50);
  }

  function measureExitDistances(stepEl, direction) {
    var upper = stepEl.querySelector(".questionnaire-step__anim-upper");
    var lower = stepEl.querySelector(".questionnaire-step__anim-lower");

    function distanceForward(el) {
      var rect = el.getBoundingClientRect();
      return rect.top + rect.height;
    }

    function distanceBack(el) {
      var rect = el.getBoundingClientRect();
      return window.innerHeight - rect.top + rect.height;
    }

    var measure = direction === "back" ? distanceBack : distanceForward;
    if (upper) stepEl.style.setProperty("--exit-upper", measure(upper) + "px");
    if (lower) stepEl.style.setProperty("--exit-lower", measure(lower) + "px");
  }

  function measureEnterDistances(stepEl, direction) {
    var stepRect = stepEl.getBoundingClientRect();

    if (direction === "forward") {
      // Start with the step top at the bottom edge of the viewport, slide up to rest.
      var enterY = Math.max(0, window.innerHeight - stepRect.top);
      stepEl.style.setProperty("--enter-y", enterY + "px");
      return;
    }

    var upper = stepEl.querySelector(".questionnaire-step__anim-upper");
    var lower = stepEl.querySelector(".questionnaire-step__anim-lower");
    var enterBack = stepRect.top + stepRect.height;
    stepEl.style.setProperty("--enter-y", enterBack + "px");
    if (upper) stepEl.style.setProperty("--enter-upper", enterBack + "px");
    if (lower) stepEl.style.setProperty("--enter-lower", enterBack + "px");
  }

  function playEnterSlide(stepEl, onComplete) {
    var enterY = stepEl.style.getPropertyValue("--enter-y").trim();
    if (!enterY) {
      var rect = stepEl.getBoundingClientRect();
      enterY = Math.max(0, window.innerHeight - rect.top) + "px";
      stepEl.style.setProperty("--enter-y", enterY);
    }

    var startTransform = "translateY(" + enterY + ")";
    stepEl.style.transform = startTransform;

    var completed = false;
    function done() {
      if (completed) return;
      completed = true;
      stepEl.style.removeProperty("transform");
      stepEl.classList.add("is-active");
      if (typeof onComplete === "function") onComplete();
    }

    var animation =
      typeof stepEl.animate === "function"
        ? stepEl.animate(
            [
              { transform: startTransform },
              { transform: "translateY(0)" },
            ],
            {
              duration: TRANSITION_MS,
              easing: "cubic-bezier(0.7, 0, 0.3, 1)",
              fill: "forwards",
            }
          )
        : null;

    if (animation) {
      animation.addEventListener("finish", function () {
        animation.cancel();
        done();
      });
      animation.addEventListener("cancel", function () {
        if (!completed) done();
      });
      window.setTimeout(done, TRANSITION_MS + 100);
      return;
    }

    stepEl.style.transition =
      "transform " + TRANSITION_MS + "ms cubic-bezier(0.7, 0, 0.3, 1)";

    function onEnd(event) {
      if (event.target !== stepEl) return;
      if (event.propertyName !== "transform") return;
      stepEl.removeEventListener("transitionend", onEnd);
      done();
    }

    stepEl.addEventListener("transitionend", onEnd);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        stepEl.style.transform = "translateY(0)";
      });
    });
    window.setTimeout(done, TRANSITION_MS + 100);
  }

  function getEnterTransitionTarget(stepEl, direction) {
    if (direction === "forward") {
      return stepEl;
    }
    return getLastAnimPart(stepEl, "enter", direction);
  }

  function syncCanvasLayoutForStep() {
    if (typeof window.layoutStage !== "function") return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        window.layoutStage();
      });
    });
  }

  function showStep(stepId, options) {
    options = options || {};
    if (!stackEl) return;

    if (currentStepId === "palette" && stepId !== "palette") {
      activePalettePickerGroup = null;
    }

    var sectionKey = getSectionKeyFromStepId(stepId);
    var index = getSectionIndex(sectionKey);
    if (index < 0) return;

    activateSection(index, { behavior: "auto", skipFocus: options.skipFocus, deferFocus: options.deferFocus });
  }

  function goToStep(nextId) {
    if (nextId) {
      showStep(nextId);
      return;
    }
    showStep(SUBMIT_ORDER_STEP_ID);
  }

  function runStepTransition(nextId, direction) {
    var resolvedId = nextId || SUBMIT_ORDER_STEP_ID;
    if (currentStepId === "palette" && resolvedId !== "palette") {
      activePalettePickerGroup = null;
    }
    showStep(resolvedId, { skipFocus: direction === "back" });
  }

  function transitionToStep(nextId) {
    runStepTransition(nextId, "forward");
  }

  function advance() {
    if (
      currentSectionIndex >= 0 &&
      currentSectionIndex < QUESTIONNAIRE_SECTION_ORDER.length
    ) {
      checkSectionCompletion(QUESTIONNAIRE_SECTION_ORDER[currentSectionIndex].key);
    }
    var nextIndex = Math.min(
      currentSectionIndex + 1,
      QUESTIONNAIRE_SECTION_ORDER.length - 1
    );
    if (nextIndex !== currentSectionIndex) {
      activateSection(nextIndex, { behavior: "smooth" });
    }
  }

  var questionnaireStarted = false;
  var introSlideActive = false;
  /* Set true to restore the 3D headscarf on the design intro panel */
  var DESIGN_INTRO_HEADSCARF_3D_ENABLED = false;
  var headscarf3dInstance = null;
  var headscarf3dObserver = null;
  var headscarf3dInitPromise = null;
  var headscarf3dRetryCount = 0;

  function scheduleHeadscarf3dRetry() {
    if (!DESIGN_INTRO_HEADSCARF_3D_ENABLED) return;
    if (headscarf3dRetryCount >= 4 || headscarf3dInstance) return;
    headscarf3dRetryCount += 1;
    window.setTimeout(function () {
      var root = document.getElementById("design-intro-headscarf-3d");
      if (!root || headscarf3dInstance) return;
      if (root.querySelector("canvas")) return;
      headscarf3dInitPromise = null;
      var page2 = document.getElementById("page2");
      if (!page2 || !page2.classList.contains("page2--design-active")) return;
      ensureDesignIntroHeadscarf3d();
    }, 400 * headscarf3dRetryCount);
  }

  function destroyDesignIntroHeadscarf3d() {
    if (headscarf3dObserver) {
      headscarf3dObserver.disconnect();
      headscarf3dObserver = null;
    }
    if (
      headscarf3dInstance &&
      typeof headscarf3dInstance.destroy === "function"
    ) {
      headscarf3dInstance.destroy();
      headscarf3dInstance = null;
    }
    headscarf3dInitPromise = null;
    headscarf3dRetryCount = 0;
  }

  function ensureDesignIntroHeadscarf3d() {
    if (!DESIGN_INTRO_HEADSCARF_3D_ENABLED) {
      return Promise.resolve(null);
    }
    var root = document.getElementById("design-intro-headscarf-3d");
    if (!root || headscarf3dInstance || prefersReducedMotion()) {
      return Promise.resolve(null);
    }
    if (root.clientWidth <= 0 || root.clientHeight <= 0) {
      scheduleHeadscarf3dRetry();
      return Promise.resolve(null);
    }

    if (!headscarf3dInitPromise) {
      headscarf3dInitPromise = import("/js/headscarf3d.js?v=20260624-static-flutter")
        .then(function (mod) {
          if (!root.isConnected || headscarf3dInstance) return headscarf3dInstance;
          if (!mod || typeof mod.initHeadscarf3d !== "function") return null;
          headscarf3dInstance = mod.initHeadscarf3d(root, {
            textureUrl: "website/design/headscarf-3d-texture.png",
            config: {
              camY: 0,
              fitToWidth: true,
              fitToWidthScale: 1.1,
              cameraFov: 50,
              flagWidth: 10,
              flagHeight: 2.4,
              meshScale: 1,
              anchorPreset: "Soft Float",
              softAnchorStrength: 0.9,
              enablePointerWind: true,
              pointerWindMode: "flutter",
              pointerWindInfluence: 0.25,
              pointerTurbulenceBoost: 0.02,
              windStrength: 8,
              windDirection: { x: 0, y: 0 },
              turbulence: 25,
              stiffness: 70,
              weight: 0.15,
              damping: 5,
              gustFrequency: 12,
            },
          });
          if (!headscarf3dInstance) {
            headscarf3dInitPromise = null;
            scheduleHeadscarf3dRetry();
            return null;
          }
          window.requestAnimationFrame(function () {
            window.dispatchEvent(new Event("resize"));
          });
          return headscarf3dInstance;
        })
        .catch(function (err) {
          console.error("headscarf3d init failed:", err);
          headscarf3dInitPromise = null;
          scheduleHeadscarf3dRetry();
          return null;
        });
    }

    return headscarf3dInitPromise.then(function (inst) {
      if (!inst) scheduleHeadscarf3dRetry();
      return inst;
    });
  }

  function initDesignIntroHeadscarf3d() {
    if (!DESIGN_INTRO_HEADSCARF_3D_ENABLED) return;
    var root = document.getElementById("design-intro-headscarf-3d");
    if (!root || prefersReducedMotion()) return;

    function maybeInitIfDesignVisible() {
      var page2 = document.getElementById("page2");
      if (!page2 || !page2.classList.contains("page2--design-active")) return;
      ensureDesignIntroHeadscarf3d().then(function (inst) {
        if (inst && typeof inst.play === "function") inst.play();
      });
    }

    maybeInitIfDesignVisible();

    var page2 = document.getElementById("page2");
    if (page2 && typeof MutationObserver !== "undefined") {
      new MutationObserver(function () {
        maybeInitIfDesignVisible();
      }).observe(page2, { attributes: true, attributeFilter: ["class"] });
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    headscarf3dObserver = new IntersectionObserver(
      function (entries) {
        var visible = false;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting && entries[i].intersectionRatio > 0.05) {
            visible = true;
            break;
          }
        }

        if (visible) {
          ensureDesignIntroHeadscarf3d().then(function (inst) {
            if (inst && typeof inst.play === "function") inst.play();
          });
        } else if (
          headscarf3dInstance &&
          typeof headscarf3dInstance.pause === "function"
        ) {
          headscarf3dInstance.pause();
        }
      },
      { threshold: [0, 0.05, 0.25] }
    );
    headscarf3dObserver.observe(root);

    if (
      window.Page2Navigation &&
      typeof window.Page2Navigation.showSection === "function" &&
      !window.Page2Navigation.__headscarf3dHooked
    ) {
      var originalShowSection = window.Page2Navigation.showSection;
      window.Page2Navigation.showSection = function (colIndex, options) {
        var result = originalShowSection.call(this, colIndex, options);
        if (colIndex === 4) {
          window.requestAnimationFrame(function () {
            maybeInitIfDesignVisible();
            window.setTimeout(maybeInitIfDesignVisible, 600);
          });
        }
        return result;
      };
      window.Page2Navigation.__headscarf3dHooked = true;
    }
  }

  function clearIntroSlideClasses(sectionDesign) {
    if (!sectionDesign) return;
    sectionDesign.classList.remove(
      "section-design--intro-slide",
      "section-design--intro-slide-prep",
      "section-design--intro-slide-active"
    );
  }

  function runPostQuestionnaireStartFocus() {
    // Profile typewriter animation disabled: jump straight to the first blank.
    // The madlibs text is hidden by CSS only while the ".is-typewriting" class
    // is present, so skipping the animation leaves everything visible.
    profileTypewriterPlayed = true;
    focusProfileBlank("nameDisplayMode");
  }

  function finalizeQuestionnaireStart() {
    var sectionDesign = document.getElementById("section-design");
    var designStart = document.getElementById("design-start");
    var questionnairePanel = document.getElementById("questionnaire-panel");

    clearIntroSlideClasses(sectionDesign);

    if (sectionDesign) {
      sectionDesign.classList.add("section-design--questionnaire-started");
    }
    if (designStart) {
      designStart.hidden = true;
      designStart.style.transform = "";
    }
    if (questionnairePanel) {
      questionnairePanel.style.transform = "";
    }
    destroyDesignIntroHeadscarf3d();
    introSlideActive = false;

    if (typeof window.render === "function") {
      window.render();
    }
    scheduleQuestionnaireCardHeightSync();
  }

  function isQuestionnaireCanvasHostReady() {
    var host = document.getElementById("questionnaire-canvas-host");
    return !!(host && host.clientWidth > 40);
  }

  function primeQuestionnaireCanvasForSlide(questionnairePanel, done) {
    if (questionnairePanel) {
      void questionnairePanel.offsetHeight;
    }

    var attemptsLeft = 4;

    function attemptPrime() {
      syncQuestionnaireCardHeights();
      if (typeof window.render === "function") {
        window.render();
      }
      if (typeof window.layoutStage === "function") {
        window.layoutStage();
      }

      attemptsLeft -= 1;
      if (isQuestionnaireCanvasHostReady() || attemptsLeft <= 0) {
        if (typeof done === "function") {
          done();
        }
        return;
      }

      window.requestAnimationFrame(attemptPrime);
    }

    window.requestAnimationFrame(attemptPrime);
  }

  function startQuestionnaireIntroSlide(sectionDesign, questionnairePanel) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (sectionDesign) {
          sectionDesign.classList.add("section-design--intro-slide-active");
          sectionDesign.classList.remove("section-design--intro-slide-prep");
        }

        var slideTarget = questionnairePanel;
        if (!slideTarget) {
          finalizeQuestionnaireStart();
          runPostQuestionnaireStartFocus();
          return;
        }

        var slideFinished = false;
        var finishSlide = function () {
          if (slideFinished) return;
          slideFinished = true;
          finalizeQuestionnaireStart();
          runPostQuestionnaireStartFocus();
        };

        var onSlideEnd = function (event) {
          if (event.propertyName !== "transform") return;
          slideTarget.removeEventListener("transitionend", onSlideEnd);
          finishSlide();
        };

        slideTarget.addEventListener("transitionend", onSlideEnd);
        window.setTimeout(function () {
          slideTarget.removeEventListener("transitionend", onSlideEnd);
          finishSlide();
        }, INTRO_SLIDE_MS + 80);
      });
    });
  }

  function beginQuestionnaire(locale) {
    if (questionnaireStarted || introSlideActive || !scrollEl || !stackEl) return;

    var sectionDesign = document.getElementById("section-design");
    var designStart = document.getElementById("design-start");
    var questionnairePanel = document.getElementById("questionnaire-panel");
    var reduced = prefersReducedMotion();

    applyQuestionnaireLocale(locale);
    questionnaireStarted = true;
    introSlideActive = true;

    setDesignStartButtonsDisabled(true);

    if (questionnairePanel) {
      questionnairePanel.hidden = false;
    }

    if (sectionDesign && !reduced) {
      sectionDesign.classList.add(
        "section-design--intro-slide",
        "section-design--intro-slide-prep"
      );
    }

    buildQuestionnaireStack();
    primeQuestionnaireCanvasForSlide(questionnairePanel, function () {
      if (reduced) {
        finalizeQuestionnaireStart();
        runPostQuestionnaireStartFocus();
        return;
      }
      startQuestionnaireIntroSlide(sectionDesign, questionnairePanel);
    });

    if (reduced) {
      return;
    }
  }

  function returnToDesignIntro() {
    if (!questionnaireStarted) return;

    var sectionDesign = document.getElementById("section-design");
    var designStart = document.getElementById("design-start");
    var questionnairePanel = document.getElementById("questionnaire-panel");

    questionnaireStarted = false;
    introSlideActive = false;
    currentSectionIndex = 0;
    currentStepId = null;
    displayStepId = null;
    sectionPageLockUntil = 0;

    clearStack();
    restoreCanvasToAppShell();
    clearIntroSlideClasses(sectionDesign);
    resetQuestionnaireLocale();

    if (sectionDesign) {
      sectionDesign.classList.remove("section-design--questionnaire-started");
    }
    if (questionnairePanel) {
      questionnairePanel.hidden = true;
      questionnairePanel.style.transform = "";
    }
    if (scrollEl) {
      scrollEl.scrollTop = 0;
    }
    if (designStart) {
      designStart.hidden = false;
      designStart.style.transform = "";
      var stepHeight = designStart.clientHeight;
      var contentPanels = getDesignIntroContentPanels(designStart);
      if (stepHeight && contentPanels.length) {
        designStart.scrollTop = (contentPanels.length - 1) * stepHeight;
      }
      window.requestAnimationFrame(function () {
        updateDesignIntroScrollPolish();
        ensureDesignIntroHeadscarf3d();
      });
    }
    setDesignStartButtonsDisabled(false);

    if (typeof window.render === "function") {
      window.render();
    }
    if (typeof window.layoutStage === "function") {
      window.layoutStage();
    }
  }

  function clampDesignIntroProgress(value) {
    return Math.min(1, Math.max(0, value));
  }

  function getDesignIntroContentPanels(designStart) {
    return designStart.querySelectorAll(".design-intro__panel");
  }

  function onDesignIntroScroll() {
    updateDesignIntroScrollPolish();
  }

  function updateDesignIntroScrollPolish() {
    if (prefersReducedMotion()) return;

    var designStart = document.getElementById("design-start");
    if (!designStart || designStart.hidden) return;

    var panels = designStart.querySelectorAll(".design-intro__panel");
    if (!panels.length) return;

    var stepHeight = designStart.clientHeight;
    if (!stepHeight) return;

    var scrollTop = designStart.scrollTop;

    for (var i = 0; i < panels.length; i++) {
      var inner = panels[i].querySelector(".design-intro__panel-inner");
      if (!inner) continue;

      if (i === panels.length - 1) {
        inner.style.transform = "";
        inner.style.opacity = "";
        continue;
      }

      var progress = clampDesignIntroProgress(
        (scrollTop - i * stepHeight) / stepHeight
      );
      var scale = 1 - progress * 0.06;
      inner.style.transform = "scale(" + scale + ")";
      inner.style.opacity = String(1 - progress * 0.25);
    }
  }

  function initDesignIntroScrollPolish() {
    var designStart = document.getElementById("design-start");
    if (!designStart) return;

    designStart.addEventListener("scroll", onDesignIntroScroll, {
      passive: true,
    });
    window.addEventListener("resize", onDesignIntroScroll, {
      passive: true,
    });
    onDesignIntroScroll();
  }

  function init() {
    scrollEl = document.getElementById("questionnaire-scroll");
    stackEl = document.getElementById("questionnaire-stack");
    panelEl = document.getElementById("questionnaire-panel");
    panelGridEl = document.querySelector(
      "#questionnaire-panel .questionnaire-panel__grid"
    );
    remainingEl = document.getElementById("questionnaire-remaining");
    var shopLink = document.getElementById("design-intro-shop-link");
    if (shopLink) {
      shopLink.addEventListener("click", function () {
        if (
          window.Page2Navigation &&
          typeof window.Page2Navigation.showSection === "function"
        ) {
          window.Page2Navigation.showSection(3);
        }
      });
    }
    var startBtnEn = document.getElementById("design-start-btn-en");
    var startBtnFa = document.getElementById("design-start-btn-fa");
    if (startBtnEn) {
      startBtnEn.addEventListener("click", function () {
        beginQuestionnaire("en");
      });
    }
    if (startBtnFa) {
      startBtnFa.addEventListener("click", function () {
        beginQuestionnaire("fa");
      });
    }
    var startAgainBtn = document.getElementById("questionnaire-start-again");
    if (startAgainBtn) {
      startAgainBtn.addEventListener("click", function () {
        resetQuestionnaireAfterSubmit();
      });
    }
    if (
      typeof window.FamilyControls !== "undefined" &&
      window.FamilyControls.setOnFamilyChange
    ) {
      window.FamilyControls.setOnFamilyChange(function () {
        answers.closeFamilyInIran = window.FamilyControls.getCloseFamilyInIran();
        answers.iranLossTypes = window.FamilyControls.getIranLossTypes();
        syncFamilyDerivedAnswers();
        if (
          answers.closeFamilyInIran === "largePart" ||
          answers.closeFamilyInIran === "someMembers" ||
          answers.closeFamilyInIran === "almostAllOutside"
        ) {
          familyStepsReached.closeFamilyInIran = true;
        }
        if (answers.iranLossTypes !== null) {
          familyStepsReached.iranLossTypes = true;
        }
        triggerCanvasUpdateAfterSync("closeFamilyInIran");
      });
    }
    initDesignIntroScrollPolish();
    initDesignIntroHeadscarf3d();
    initQuestionnaireScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Questionnaire = {
    start: function (locale) {
      beginQuestionnaire(locale || "en");
    },
    isStarted: function () {
      return questionnaireStarted;
    },
    getAnswers: function () {
      return Object.assign({}, answers);
    },
    getNameLabelText: function () {
      return getNameLabelTextForCanvas();
    },
    getCurrentStepId: function () {
      return currentStepId;
    },
    isProfileStep: isProfileStep,
    isGridStep: isGridStep,
    isPreFamilyQuestionnaireStep: isPreFamilyQuestionnaireStep,
    isBodyAutonomyStep: isBodyAutonomyStep,
    getScrollZoomTransition: getQuestionnaireScrollZoomTransition,
    getSectionCount: function () {
      return QUESTIONNAIRE_SECTION_ORDER.length;
    },
    getActiveSectionIndex: function () {
      return currentSectionIndex;
    },
  };
})();

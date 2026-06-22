(function () {
  "use strict";

  var TRANSITION_MS = 450;
  var STAGGER_MS = 80;
  // Start enter before exit fully finishes (~55% through exit duration).
  var ENTER_START_AFTER_EXIT_MS = Math.round(TRANSITION_MS * 0.55);

  var TYPEWRITER_CHAR_MS = 42;
  var TYPEWRITER_LINE_PAUSE_MS = 280;
  var TYPEWRITER_BLANK_CHARS = { short: 2, medium: 3, long: 4 };

  var profileTypewriterPlayed = false;
  /** @type {{ cancel: function(): void, isCancelled: function(): boolean, wait: function(number, function(boolean): void): void } | null} */
  var profileTypewriterController = null;
  /** @type {{ madlibsEl: HTMLElement, lines: Array<{ lineEl: HTMLElement, segments: Array }> } | null} */
  var profileTypewriterState = null;

  /** @type {HTMLElement | null} */
  var viewport = null;

  /** @type {HTMLElement | null} */
  var sectionLabelEl = null;

  /** @type {HTMLElement | null} */
  var progressEl = null;

  /** @type {HTMLElement | null} */
  var skipSectionBtn = null;

  /** @type {HTMLElement | null} */
  var activeStepEl = null;

  /** @type {string | null} */
  var currentStepId = null;

  /** @type {string | null} */
  var displayStepId = null;

  /** @type {HTMLElement | null} */
  var activePalettePickerGroup = null;

  /** @type {HTMLElement | null} */
  var profileContinueBtn = null;

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

  var answers = {
    livingInIran: null,
    livingDuration: null,
    leavingYear: "",
    from: "",
    nowIn: "",
    name: "",
    nameDisplayMode: "anonymous",
    age: "",
    homeAt: null,
    gridType: null,
    octagonsN: 5,
    innerScale: 10,
    palette:
      typeof DEFAULT_SHEET_PALETTE_NUM !== "undefined"
        ? DEFAULT_SHEET_PALETTE_NUM
        : 3,
    closeFamilyInIran: null,
    iranLossTypes: null,
    borderFrameDivisions: 2,
    borderSideWhiteFill: 0,
    fanLeaves: 0,
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

  var PROFILE_SKIP_DEFAULTS = {
    livingInIran: false,
    nameDisplayMode: "anonymous",
    name: "",
  };

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

  /** Emotion groups shown together on the combined feelings step. */
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

  /** Questionnaire feelings table: one row per slider (Hope is outside the table). */
  var FEELINGS_TABLE_ROWS = [
    { label: "Fear", stepId: "angerVerticalLength" },
    { label: "Anxiety / Tension", stepId: "anxietyVerticalStroke" },
    { label: "Anger", stepId: "angerTriangleDensity" },
    { label: "Sadness", stepId: "circleDensity" },
    { label: "Longing", stepId: "longingCircleDensity" },
    { label: "Grief", stepId: "griefCircleDensity" },
    { label: "Strength / Power", stepId: "strengthDensity" },
    { label: "Pride", stepId: "autoMergeIntensity" },
    { label: "Pain", stepId: "prideFillPercent" },
    { label: "Guilt / Shame", stepId: "guiltShameFillPercent" },
    { label: "Helplessness", stepId: "helplessnessPercent" },
  ];

  var FEELINGS_SCALE_LABELS = [
    "I do not feel this at all",
    "I feel this occasionally",
    "I feel this somewhat",
    "I feel this clearly",
    "This feeling is very strong",
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

  var STEPS = {
    livingInIran: {
      letter: "A",
      label: "Did you ever live in Iran?",
      type: "yesno",
      ariaLabel: "Did you ever live in Iran? Yes or no",
    },
    livingDuration: {
      letter: "B",
      label: "How much of your life did you live in Iran?",
      type: "choice",
      ariaLabel: "How much of your life did you live in Iran?",
      wrap: true,
      options: [
        { value: "smallPart", label: "Small part of my life" },
        { value: "partOfLife", label: "Yes, part of my life" },
        { value: "mostAll", label: "Yes, most / all of my life" },
      ],
    },
    leavingYear: {
      letter: "C",
      label: "Year of leaving",
      type: "text",
      inputMode: "numeric",
      maxLength: 4,
      placeholder: "Year you left Iran",
      ariaLabel: "Year of leaving",
    },
    from: {
      letter: "D",
      label: "From",
      type: "text",
      english: true,
      placeholder: "Where you are originally from",
      ariaLabel: "From",
    },
    nowIn: {
      letter: "E",
      label: "Now in",
      type: "text",
      english: true,
      placeholder: "Where you live now",
      ariaLabel: "Now in",
    },
    name: {
      letter: "F",
      label: "Name",
      type: "name",
      placeholder: "Name",
      ariaLabel: "Name",
      modeAriaLabel: "How name appears on the label",
      modes: [
        { value: "anonymous", label: "Anonymous" },
        { value: "initials", label: "Initials" },
        { value: "name", label: "Name" },
      ],
    },
    age: {
      letter: "G",
      label: "Age",
      type: "text",
      inputMode: "numeric",
      maxLength: 2,
      ariaLabel: "Age",
    },
    homeAt: {
      letter: "H",
      label: 'where do you feel most "at home" today?',
      type: "choice",
      ariaLabel: 'where do you feel most "at home" today?',
      wrap: true,
      options: [
        { value: "inIran", label: "In Iran" },
        { value: "whereILive", label: "Outside Iran / where I live now" },
        { value: "nowhere", label: "Nowhere / in between" },
      ],
    },
    gridType: {
      letter: "",
      hideHeading: true,
      type: "choice",
      ariaLabel: "Grid type",
      options: [
        { value: "octagon", label: "Octagons" },
        { value: "star", label: "Stars" },
        { value: "circles", label: "Circles" },
        { value: "diamonds", label: "Diamonds" },
      ],
    },
    octagonsN: {
      letter: "",
      label:
        "How much do you feel part of an Iranian community around you (physical or online)?",
      type: "slider",
      ariaLabel:
        "How much do you feel part of an Iranian community around you (physical or online)? Barely part to very much part.",
      min: 1,
      max: 10,
      step: 1,
      rangeLabels: ["Barely part", "Very much part"],
      wrap: true,
    },
    innerScale: {
      letter: "",
      label:
        "How much do you feel that Iranian identity is a central part of your life today?",
      type: "slider",
      ariaLabel:
        "How much do you feel that Iranian identity is a central part of your life today? Very much in the background to at the center of my life.",
      min: 1,
      max: 10,
      step: 1,
      rangeLabels: ["Very much in the background", "At the center of my life"],
      wrap: true,
    },
    palette: {
      letter: "",
      label: "Palette",
      type: "palette-picker",
      ariaLabel: "החלף בין פלטות 1 עד 12",
    },
    borderFrameDivisions: {
      letter: "",
      label: "Frame divisions",
      type: "slider",
      ariaLabel: "Frame horizontal divisions",
      min: 1,
      max: 3,
      step: 1,
    },
    borderSideWhiteFill: {
      letter: "",
      label: "Margin empty cells",
      type: "slider",
      ariaLabel: "Margin empty cell fill",
      min: 0,
      max: 100,
      step: 25,
      outputSuffix: "%",
    },
    closeFamilyInIran: {
      letter: "",
      label: "Do you have close family still living in Iran today?",
      type: "choice",
      ariaLabel: "Do you have close family still living in Iran today?",
      wrap: true,
      options: [
        {
          value: "largePart",
          label: "Yes, a large part of the family",
        },
        {
          value: "someMembers",
          label: "Yes, some family members",
        },
        {
          value: "almostAllOutside",
          label: "No, almost everyone is outside Iran",
        },
      ],
    },
    iranLossTypes: {
      letter: "",
      label:
        "What type of loss / disconnection do you feel in relation to Iran? (select all that apply)",
      type: "multi-choice",
      ariaLabel:
        "What type of loss or disconnection do you feel in relation to Iran? Select all that apply.",
      wrap: true,
      options: [
        { value: "lovedOne", label: "Loss of a loved one" },
        {
          value: "place",
          label: "Loss of place (home, neighborhood, city)",
        },
        {
          value: "languageCulture",
          label: "Loss of language / culture in daily life",
        },
        {
          value: "freedomOfMovement",
          label: "Loss of freedom of movement (cannot return / visit)",
        },
        {
          value: "familyFriendsConnection",
          label: "Loss of connection with part of the family or friends",
        },
      ],
    },
    fanLeaves: {
      letter: "",
      label: "When you lived in Iran, how free did you feel to choose how to dress in public spaces?",
      type: "slider",
      ariaLabel:
        "Fan leaves. Step 0 fully open, step 9 four ribs, step 10 closed.",
      min: 0,
      max: 10,
      step: 1,
      rangeLabels: ["No freedom of choice at all", "Feeling relatively free to choose"],
      wrap: true,
    },
    angerVerticalLength: {
      letter: "",
      label: "Fear — Vertical line length",
      type: "slider",
      ariaLabel: "Vertical line length",
      min: 0,
      max: 30,
      step: 7.5,
      wrap: true,
    },
    anxietyVerticalStroke: {
      letter: "",
      label: "Fear — Anxiety / Tension",
      type: "slider",
      ariaLabel: "Anxiety / Tension — vertical line thickness",
      min: 0,
      max: 100,
      step: 25,
      wrap: true,
    },
    angerTriangleDensity: {
      letter: "",
      label: "Anger",
      type: "slider",
      ariaLabel: "Anger triangle density",
      min: 0,
      max: 30,
      step: 7.5,
    },
    hopeMode: {
      letter: "",
      label: "Hope",
      type: "choice",
      ariaLabel: "Hope interaction mode",
      options: [
        { value: "view", label: "View" },
        { value: "merge", label: "Merge" },
      ],
    },
    circleDensity: {
      letter: "",
      label: "Sadness",
      type: "slider",
      ariaLabel: "Circle density",
      min: 0,
      max: 30,
      step: 7.5,
    },
    longingCircleDensity: {
      letter: "",
      label: "Longing",
      type: "slider",
      ariaLabel: "Longing circle density",
      min: 0,
      max: 30,
      step: 7.5,
    },
    griefCircleDensity: {
      letter: "",
      label: "Grief",
      type: "slider",
      ariaLabel: "Grief circle density",
      min: 0,
      max: 30,
      step: 7.5,
    },
    strengthDensity: {
      letter: "",
      label: "Strength / Power",
      type: "slider",
      ariaLabel: "Strength / Power circle-in-square density",
      min: 0,
      max: 30,
      step: 7.5,
      wrap: true,
    },
    autoMergeIntensity: {
      letter: "",
      label: "Pride",
      type: "slider",
      ariaLabel: "Pride merged area amount and size",
      min: 0,
      max: 7,
      step: 1.75,
    },
    prideFillPercent: {
      letter: "",
      label: "Pain",
      type: "slider",
      ariaLabel: "Pain diamond fill amount",
      min: 0,
      max: 30,
      step: 7.5,
    },
    guiltShameFillPercent: {
      letter: "",
      label: "Guilt / Shame",
      type: "slider",
      ariaLabel: "Guilt / Shame hollow diamond fill amount",
      min: 0,
      max: 30,
      step: 7.5,
      wrap: true,
    },
    helplessnessPercent: {
      letter: "",
      label: "Helplessness",
      type: "slider",
      ariaLabel: "Helplessness junction X mark density",
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
    if (mode === "anonymous") return "Anonymous";
    var trimmed = String(nameValue || "").trim();
    if (mode === "initials") {
      return trimmed ? formatNameInitials(trimmed) : "Initials";
    }
    if (mode === "name") return trimmed || "Name";
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

  function updateProgressDotsForProfile() {
    if (!displayStepId) return;
    updateProgressDots(displayStepId);
  }

  function syncProfileBlankReached(stepId) {
    syncProfileMadlibsAnswersFromDom();
    if (stepId === "homeAt") {
      updateProfileMadlibsFieldIcon("homeAt");
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
    syncProfileContinueBtn();
    updateProgressDotsForProfile();
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
        updateProgressDotsForProfile();
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
      updateProgressDotsForProfile();
    }
  }

  function focusProfileContinueBtn() {
    if (!activeStepEl) return;
    var btn = activeStepEl.querySelector(".questionnaire-continue");
    if (btn) focusWithoutScroll(btn);
  }

  /** Profile + grid + palette: keep large canvas zoom until Family section. */
  function isPreFamilyQuestionnaireStep(stepId) {
    return (
      stepId === PROFILE_ALL_STEP_ID ||
      isProfileStep(stepId) ||
      isGridStep(stepId) ||
      isColorStep(stepId)
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
      return "palette";
    }

    if (isGridStep(fromId)) {
      var gridIndex = GRID_STEP_ORDER.indexOf(fromId) + 1;
      if (gridIndex < GRID_STEP_ORDER.length) {
        return GRID_STEP_ORDER[gridIndex];
      }
      return "palette";
    }

    if (isColorStep(fromId)) {
      var colorIndex = COLORS_STEP_ORDER.indexOf(fromId) + 1;
      if (colorIndex < COLORS_STEP_ORDER.length) {
        return COLORS_STEP_ORDER[colorIndex];
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
    syncGridTypeToPanel();
  }

  function buildQuestionnaireFeelingsPayload() {
    var payload = {};
    var i;
    for (i = 0; i < FEELINGS_TABLE_ROWS.length; i++) {
      payload[FEELINGS_TABLE_ROWS[i].stepId] = answers[FEELINGS_TABLE_ROWS[i].stepId];
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

  function triggerFeelingsCanvasUpdate() {
    if (
      window.UnderCoverComboBridge &&
      window.UnderCoverComboBridge.finalizeApply
    ) {
      window.UnderCoverComboBridge.finalizeApply();
      return;
    }
    if (
      window.UnderCoverComboBridge &&
      window.UnderCoverComboBridge.refreshQuestionnaireCanvas
    ) {
      window.UnderCoverComboBridge.refreshQuestionnaireCanvas();
      return;
    }
    triggerCanvasRender();
  }

  function triggerCanvasUpdateAfterSync(stepId) {
    ensureQuestionnaireGridReady();
    ensureQuestionnaireCanvasUnlock(stepId);
    if (isFeelingsSliderStep(stepId) || isFeelingsStep(stepId)) {
      triggerFeelingsCanvasUpdate();
      return;
    }
    if (hasFeelingsProgress()) {
      triggerFeelingsCanvasUpdate();
      return;
    }
    triggerCanvasRender();
  }

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
    slider.value = String(domValue);
    if (outputId) {
      var output = document.getElementById(outputId);
      if (output) output.textContent = String(outputValue);
    }
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    if (commit) {
      slider.dispatchEvent(new Event("change", { bubbles: true }));
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
      var fanDom = PANEL_SLIDER_DOM.fanLeaves;
      syncPanelSliderDom(
        fanDom[0],
        fanDom[1],
        answers.fanLeaves,
        true
      );
    }
  }

  function syncHopeModeToPanel(mode) {
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

  var SECTION_LABELS = {
    profile: { num: 1, name: "profile" },
    grid: { num: 2, name: "Grid" },
    colors: { num: 3, name: "Colors" },
    family: { num: 4, name: "Family and friends in Iran" },
    bodyAutonomy: { num: 5, name: "Body autonomy" },
    feelings: { num: 6, name: "Feelings" },
    submitOrder: { num: 7, name: "submit&order" },
  };

  var QUESTIONNAIRE_SECTION_ORDER = [
    { key: "profile", entryStepId: PROFILE_ALL_STEP_ID },
    { key: "grid", entryStepId: GRID_ALL_STEP_ID },
    { key: "colors", entryStepId: "palette" },
    { key: "family", entryStepId: FAMILY_ALL_STEP_ID },
    { key: "bodyAutonomy", entryStepId: "fanLeaves" },
    { key: "feelings", entryStepId: FEELINGS_ALL_STEP_ID },
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
      markSectionPassed("feelings");
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
    if (targetIndex === currentIndex) return false;

    if (targetIndex < currentIndex) {
      return true;
    }
    return hasSectionBeenPassed(targetSectionKey);
  }

  function navigateToSection(targetSectionKey) {
    var stepId = displayStepId || SUBMIT_ORDER_STEP_ID;
    if (!canNavigateToSection(stepId, targetSectionKey)) {
      return;
    }

    var currentIndex = getCurrentSectionIndex(stepId);
    var targetIndex = getSectionIndex(targetSectionKey);
    var direction = targetIndex < currentIndex ? "back" : "forward";
    var entryStepId = getSectionEntryStepId(targetSectionKey);

    if (targetSectionKey === "profile") {
      cancelProfileTypewriter();
      var firstIncomplete = getFirstIncompleteProfileBlank();
      if (firstIncomplete) {
        currentProfileBlankId = firstIncomplete;
      }
    }

    runStepTransition(entryStepId, direction);
  }

  function formatSectionLabel(sectionKey) {
    var section = SECTION_LABELS[sectionKey];
    return section.num + "/ " + section.name;
  }

  function updateSectionLabel(stepId) {
    if (!sectionLabelEl) return;
    if (stepId === SUBMIT_ORDER_STEP_ID) {
      sectionLabelEl.textContent = formatSectionLabel("submitOrder");
      return;
    }
    if (
      stepId === FEELINGS_ALL_STEP_ID ||
      isFeelingsStep(stepId)
    ) {
      sectionLabelEl.textContent = formatSectionLabel("feelings");
      return;
    }
    if (isBodyAutonomyStep(stepId)) {
      sectionLabelEl.textContent = formatSectionLabel("bodyAutonomy");
      return;
    }
    if (isFamilyStep(stepId)) {
      sectionLabelEl.textContent = formatSectionLabel("family");
      return;
    }
    if (isColorStep(stepId)) {
      sectionLabelEl.textContent = formatSectionLabel("colors");
      return;
    }
    if (isGridStep(stepId)) {
      sectionLabelEl.textContent = formatSectionLabel("grid");
      return;
    }
    sectionLabelEl.textContent = formatSectionLabel("profile");
  }

  function updateSkipButtonVisibility(stepId) {
    if (!skipSectionBtn) return;
    var showSkip = stepId === PROFILE_ALL_STEP_ID;
    skipSectionBtn.hidden = !showSkip;
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

  function updateProgressDots(stepId) {
    if (!progressEl) return;

    var currentIndex = getCurrentSectionIndex(stepId);
    var sectionCount = QUESTIONNAIRE_SECTION_ORDER.length;

    progressEl.innerHTML = "";

    for (var i = 0; i < sectionCount; i++) {
      var section = QUESTIONNAIRE_SECTION_ORDER[i];
      var sectionKey = section.key;
      var sectionMeta = SECTION_LABELS[sectionKey];
      var isFilled = hasSectionBeenPassed(sectionKey);
      var isCurrent = i === currentIndex && currentIndex < sectionCount;
      var isClickable = canNavigateToSection(stepId, sectionKey);
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "questionnaire-panel__progress-dot";
      dot.setAttribute("data-section-key", sectionKey);
      if (isFilled) {
        dot.classList.add("is-filled");
      }
      if (isCurrent) {
        dot.classList.add("is-current");
      }
      if (isClickable) {
        dot.classList.add("is-clickable");
        dot.setAttribute(
          "aria-label",
          (i < currentIndex ? "Back to section " : "Go to section ") +
            sectionMeta.num +
            " of " +
            sectionCount +
            ": " +
            sectionMeta.name
        );
        dot.addEventListener("click", function (event) {
          var targetKey = event.currentTarget.getAttribute("data-section-key");
          navigateToSection(targetKey);
        });
      } else {
        dot.disabled = true;
        dot.setAttribute(
          "aria-label",
          isCurrent
            ? "Current section " +
                sectionMeta.num +
                " of " +
                sectionCount +
                ": " +
                sectionMeta.name
            : "Section " +
                sectionMeta.num +
                " of " +
                sectionCount +
                ": " +
                sectionMeta.name
        );
      }
      progressEl.appendChild(dot);
    }
  }

  function clearViewport() {
    if (!viewport) return;
    cancelProfileTypewriter();
    if (activeMadlibsDropdown) {
      closeMadlibsDropdown(activeMadlibsDropdown);
    }
    viewport.innerHTML = "";
    activeStepEl = null;
    profileContinueBtn = null;
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
    window.setTimeout(function () {
      advance();
    }, prefersReducedMotion() ? 0 : 120);
  }

  function appendContinueIfComplete(answersWrap, stepId) {
    if (!isStepComplete(stepId)) return;
    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = "Continue";
    continueBtn.addEventListener("click", function () {
      advance();
    });
    answersWrap.appendChild(continueBtn);
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

    group.appendChild(makeBtn("Yes", true));
    group.appendChild(makeBtn("No", false));
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

    group.appendChild(makeBtn("Yes", true));
    group.appendChild(makeBtn("No", false));
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
    continueBtn.textContent = "Continue";
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
      continueBtn.textContent = "Continue";
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
    var stepConfig = STEPS.gridType;
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
    continueBtn.textContent = "Continue";
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
    continueBtn.textContent = "Continue";
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
        syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], false);
        triggerCanvasUpdateAfterSync(stepId);
      }
      if (onChange) onChange();
    });

    control.appendChild(createQuestionnaireSliderTrack(slider));
    syncQuestionnaireSliderBarFill(slider);
    control.appendChild(output);
    sliderWrap.appendChild(control);
    parent.appendChild(sliderWrap);
  }

  function appendFeelingsGridTable(parent, onChange) {
    var steps =
      typeof FEELINGS_SLIDER_STEPS !== "undefined" ? FEELINGS_SLIDER_STEPS : 5;
    var grid = document.createElement("div");
    grid.className = "questionnaire-feelings-grid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Feelings intensity");

    var headerRow = document.createElement("div");
    headerRow.className =
      "questionnaire-feelings-grid__row questionnaire-feelings-grid__row--header";
    headerRow.setAttribute("role", "row");

    var headerLabelCell = document.createElement("div");
    headerLabelCell.className =
      "questionnaire-feelings-grid__label-cell questionnaire-feelings-grid__label-cell--header";
    headerLabelCell.setAttribute("role", "columnheader");
    headerRow.appendChild(headerLabelCell);

    var headerIdx;
    for (headerIdx = 0; headerIdx < steps; headerIdx++) {
      var headerCell = document.createElement("div");
      headerCell.className = "questionnaire-feelings-grid__scale-header";
      headerCell.setAttribute("role", "columnheader");

      var headerNumber = document.createElement("span");
      headerNumber.className = "questionnaire-feelings-grid__scale-number";
      headerNumber.textContent = String(headerIdx + 1);
      headerCell.appendChild(headerNumber);

      var headerText = document.createElement("span");
      headerText.className = "questionnaire-feelings-grid__scale-label";
      headerText.textContent =
        FEELINGS_SCALE_LABELS[headerIdx] || String(headerIdx + 1);
      headerCell.appendChild(headerText);

      headerRow.appendChild(headerCell);
    }
    grid.appendChild(headerRow);

    FEELINGS_TABLE_ROWS.forEach(function (rowDef) {
      var stepId = rowDef.stepId;
      var bounds = getQuestionnaireFeelingsBounds(stepId);
      if (!bounds) return;
      var min = bounds[0];
      var max = bounds[1];
      var currentStep = feelingsStepFromValue(answers[stepId], min, max);

      var rowEl = document.createElement("div");
      rowEl.className = "questionnaire-feelings-grid__row";
      rowEl.setAttribute("role", "radiogroup");
      rowEl.setAttribute("aria-label", rowDef.label + " — intensity");

      var labelCell = document.createElement("div");
      labelCell.className = "questionnaire-feelings-grid__label-cell";
      labelCell.setAttribute("role", "rowheader");
      labelCell.textContent = rowDef.label;
      rowEl.appendChild(labelCell);

      var stepNum;
      for (stepNum = 1; stepNum <= steps; stepNum++) {
        var cell = document.createElement("div");
        cell.className = "questionnaire-feelings-grid__cell";
        cell.setAttribute("role", "gridcell");

        var radio = document.createElement("input");
        radio.type = "radio";
        radio.className = "questionnaire-feelings-grid__radio";
        radio.name = "feelings-" + stepId;
        radio.value = String(stepNum);
        radio.checked = currentStep === stepNum;
        radio.setAttribute(
          "aria-label",
          rowDef.label + ": " + (FEELINGS_SCALE_LABELS[stepNum - 1] || stepNum)
        );

        radio.addEventListener("change", function () {
          if (!this.checked) return;
          var chosenStep = clampFeelingsStepNumber(this.value);
          answers[stepId] = feelingsValueFromStep(chosenStep, min, max);
          applyQuestionnaireFeelingsToCanvas();
          if (onChange) onChange();
        });

        cell.appendChild(radio);
        rowEl.appendChild(cell);
      }

      grid.appendChild(rowEl);
    });

    parent.appendChild(grid);
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
      updateProgressDotsForProfile();
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

  function getProfileMadlibsIconFile(stepId) {
    if (stepId === "homeAt") {
      return getHomeAtMadlibsIconFile(answers.homeAt);
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
    if (!viewport) return;
    var file = getProfileMadlibsIconFile(stepId);
    if (!file) return;
    var innerMarkup = getProfileMadlibsIconInnerMarkup(file);
    if (!innerMarkup) return;
    var dims = getProfileMadlibsIconDimensions(file);
    var fieldWrap = viewport.querySelector(
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
    var normalized = String(input.value || "").toUpperCase();
    if (normalized !== input.value) {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      input.value = normalized;
      if (typeof start === "number" && typeof end === "number") {
        try {
          input.setSelectionRange(start, end);
        } catch (err) {
          /* ignore invalid selection on some input types */
        }
      }
    }
    return normalized;
  }

  function createMadlibsTextBlank(stepId, sizeClass) {
    var stepConfig = STEPS[stepId];
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
      updateProgressDotsForProfile();
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
    var options = STEPS.name.modes;
    var ariaLabel = STEPS.name.modeAriaLabel;
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
    nameInput.setAttribute("aria-label", STEPS.name.ariaLabel);
    nameInput.placeholder = STEPS.name.placeholder;
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
        nameInput.value = initialsLabel === "Initials" ? "" : initialsLabel;
        nameInput.placeholder = "Initials";
      } else if (mode === "name" && !nameInputEditing) {
        var nameLabel = getNameModeDisplayLabel("name", answers.name);
        nameInput.value =
          nameLabel === "Name" ? "" : String(answers.name || "").toUpperCase();
        nameInput.placeholder = "Name";
      } else {
        nameInput.value = String(answers.name || "").toUpperCase();
        nameInput.placeholder = STEPS.name.placeholder;
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
        nameInput.placeholder = STEPS.name.placeholder;
      }
      currentProfileBlankId =
        answers.nameDisplayMode === "anonymous" ? stepId : "name";
      updateProgressDotsForProfile();
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
    var stepConfig = STEPS[stepId];
    return createMadlibsDropdown(
      stepId,
      sizeClass,
      stepConfig.ariaLabel,
      stepConfig.options,
      null
    );
  }

  function syncProfileContinueBtn() {
    if (!profileContinueBtn) return;
    profileContinueBtn.disabled = !isAllProfileComplete();
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

  function runProfileTypewriter(madlibsEl, onComplete) {
    madlibsEl.classList.add("is-typewriting");
    madlibsEl.setAttribute("aria-busy", "true");

    var lines = prepareProfileTypewriter(madlibsEl);
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
        controller.wait(TYPEWRITER_CHAR_MS, function (ok) {
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
        controller.wait(TYPEWRITER_CHAR_MS, function (ok) {
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
        controller.wait(TYPEWRITER_LINE_PAUSE_MS, function (ok) {
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

  function renderProfileMadLibs() {
    var stepEl = document.createElement("div");
    stepEl.className =
      "questionnaire-step questionnaire-step--profile-madlibs";
    stepEl.setAttribute("data-step-id", PROFILE_ALL_STEP_ID);

    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var madlibs = document.createElement("div");
    madlibs.className = "questionnaire-profile-madlibs";
    madlibs.setAttribute("role", "group");
    madlibs.setAttribute("aria-label", "Profile");

    var line1 = document.createElement("p");
    line1.className = "questionnaire-madlibs-line";
    line1.appendChild(document.createTextNode("My name is "));
    line1.appendChild(createMadlibsNameModeSelect("medium"));
    line1.appendChild(document.createTextNode(", I'm "));
    line1.appendChild(
      wrapMadlibsFieldWithIcon("age", createMadlibsTextBlank("age", "short"))
    );
    line1.appendChild(document.createTextNode(" years old."));
    madlibs.appendChild(line1);

    var line2 = document.createElement("p");
    line2.className = "questionnaire-madlibs-line";
    line2.appendChild(document.createTextNode("I lived in Iran "));
    line2.appendChild(
      wrapMadlibsFieldWithIcon(
        "livingDuration",
        createMadlibsSelectBlank("livingDuration", "medium")
      )
    );
    line2.appendChild(document.createTextNode(" until "));
    line2.appendChild(
      wrapMadlibsFieldWithIcon(
        "leavingYear",
        createMadlibsTextBlank("leavingYear", "short")
      )
    );
    line2.appendChild(document.createTextNode(", I came from "));
    line2.appendChild(
      wrapMadlibsFieldWithIcon("from", createMadlibsTextBlank("from", "medium"))
    );
    line2.appendChild(document.createTextNode(" to "));
    line2.appendChild(
      wrapMadlibsFieldWithIcon("nowIn", createMadlibsTextBlank("nowIn", "medium"))
    );
    line2.appendChild(document.createTextNode("."));
    madlibs.appendChild(line2);

    var line3 = document.createElement("p");
    line3.className = "questionnaire-madlibs-line";
    line3.appendChild(document.createTextNode("I feel most at home in "));
    line3.appendChild(
      wrapMadlibsFieldWithIcon(
        "homeAt",
        createMadlibsSelectBlank("homeAt", "medium")
      )
    );
    line3.appendChild(document.createTextNode("."));
    madlibs.appendChild(line3);

    answersWrap.appendChild(madlibs);

    profileContinueBtn = document.createElement("button");
    profileContinueBtn.type = "button";
    profileContinueBtn.className = "questionnaire-continue";
    profileContinueBtn.textContent = "Continue";
    profileContinueBtn.disabled = !isAllProfileComplete();
    profileContinueBtn.addEventListener("click", function () {
      if (isAllProfileComplete()) advance();
    });
    answersWrap.appendChild(profileContinueBtn);

    syncProfileMadlibsAnswersFromDom();
    syncProfileContinueBtn();
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
    intro.textContent =
      "How much do you feel these emotions when you think about Iran?";
    answersWrap.appendChild(intro);

    var list = document.createElement("div");
    list.className = "questionnaire-feelings-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Feelings");

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = "Continue";
    continueBtn.disabled = !isAllFeelingsComplete();

    function syncContinue() {
      continueBtn.disabled = !isAllFeelingsComplete();
    }

    appendFeelingsGridTable(list, syncContinue);

    var hopeBlock = document.createElement("div");
    hopeBlock.className = "questionnaire-feelings-hope-block";

    var hopeHeading = document.createElement("h4");
    hopeHeading.className = "questionnaire-feelings-emotion-heading";
    hopeHeading.textContent = "Hope";
    hopeBlock.appendChild(hopeHeading);

    var hopeStepConfig = STEPS.hopeMode;
    if (hopeStepConfig) {
      appendQuestionnaireHopeChoice(
        hopeBlock,
        hopeStepConfig,
        "hopeMode",
        syncContinue
      );
    }
    list.appendChild(hopeBlock);

    continueBtn.addEventListener("click", function () {
      if (isAllFeelingsComplete()) advance();
    });

    answersWrap.appendChild(list);
    answersWrap.appendChild(continueBtn);
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
    list.setAttribute("aria-label", "Grid");

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = "Continue";
    continueBtn.disabled = !isAllGridComplete();

    function syncContinue() {
      continueBtn.disabled = !isAllGridComplete();
    }

    var gridTypeBlock = document.createElement("div");
    gridTypeBlock.className = "questionnaire-section-question";
    appendQuestionnaireGridTypeChoice(gridTypeBlock, syncContinue);
    list.appendChild(gridTypeBlock);

    var octagonsBlock = document.createElement("div");
    octagonsBlock.className = "questionnaire-section-question";
    appendQuestionnaireSectionQuestionHeading(
      octagonsBlock,
      STEPS.octagonsN.label
    );
    appendQuestionnaireSliderControl(
      octagonsBlock,
      STEPS.octagonsN,
      "octagonsN",
      syncContinue
    );
    list.appendChild(octagonsBlock);

    var innerScaleBlock = document.createElement("div");
    innerScaleBlock.className = "questionnaire-section-question";
    appendQuestionnaireSectionQuestionHeading(
      innerScaleBlock,
      STEPS.innerScale.label
    );
    appendQuestionnaireSliderControl(
      innerScaleBlock,
      STEPS.innerScale,
      "innerScale",
      syncContinue
    );
    list.appendChild(innerScaleBlock);

    continueBtn.addEventListener("click", function () {
      if (isAllGridComplete()) advance();
    });

    answersWrap.appendChild(list);
    answersWrap.appendChild(continueBtn);
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
    list.setAttribute("aria-label", "Family and friends in Iran");

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = "Continue";
    continueBtn.disabled = !isAllFamilyComplete();

    function syncContinue() {
      continueBtn.disabled = !isAllFamilyComplete();
    }

    FAMILY_STEP_ORDER.forEach(function (stepId) {
      var stepConfig = STEPS[stepId];
      if (!stepConfig) return;

      var questionBlock = document.createElement("div");
      questionBlock.className = "questionnaire-section-question";
      appendQuestionnaireSectionQuestionHeading(questionBlock, stepConfig.label);
      if (stepConfig.type === "choice") {
        appendQuestionnaireSingleChoiceControl(
          questionBlock,
          stepConfig,
          stepId,
          syncContinue
        );
      } else if (stepConfig.type === "yesno") {
        appendQuestionnaireYesNoControl(
          questionBlock,
          stepConfig,
          stepId,
          syncContinue
        );
      } else if (stepConfig.type === "multi-choice") {
        appendQuestionnaireMultiChoiceControl(
          questionBlock,
          stepConfig,
          stepId,
          syncContinue
        );
      } else if (stepConfig.type === "slider") {
        appendQuestionnaireSliderControl(
          questionBlock,
          stepConfig,
          stepId,
          syncContinue
        );
      }
      list.appendChild(questionBlock);
    });

    continueBtn.addEventListener("click", function () {
      if (answers.iranLossTypes === null) {
        answers.iranLossTypes = [];
        applyFamilyAnswersToPanel(false);
      }
      if (isAllFamilyComplete()) advance();
    });

    answersWrap.appendChild(list);
    answersWrap.appendChild(continueBtn);
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

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = "Continue";
    continueBtn.disabled = !isStepComplete(stepId);

    slider.addEventListener("input", function () {
      syncQuestionnaireSliderBarFill(slider);
      answers[stepId] = Number(slider.value);
      output.textContent = slider.value + (stepConfig.outputSuffix || "");
      continueBtn.disabled = !isStepComplete(stepId);
      if (stepConfig.sync === "palette") {
        syncPaletteToPanel(answers[stepId]);
        return;
      }
      var domIds = PANEL_SLIDER_DOM[stepId];
      if (domIds) {
        syncPanelSliderDom(domIds[0], domIds[1], answers[stepId], false);
        triggerCanvasUpdateAfterSync(stepId);
      }
    });

    continueBtn.addEventListener("click", function () {
      if (isStepComplete(stepId)) advance();
    });

    control.appendChild(createQuestionnaireSliderTrack(slider));
    syncQuestionnaireSliderBarFill(slider);
    control.appendChild(output);
    sliderWrap.appendChild(control);
    answersWrap.appendChild(sliderWrap);
    answersWrap.appendChild(continueBtn);
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
    });
  }

  function renderPalettePicker(stepConfig, stepId) {
    var answersWrap = document.createElement("div");
    answersWrap.className = "questionnaire-step__answers";

    var group = document.createElement("div");
    group.className = "questionnaire-palette-picker";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", stepConfig.ariaLabel);

    var continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "questionnaire-continue";
    continueBtn.textContent = "Continue";
    continueBtn.disabled = !isStepComplete(stepId);

    var n;
    for (n = 1; n <= 12; n++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "questionnaire-palette-dot";
      btn.setAttribute("data-palette-num", String(n));
      btn.setAttribute("aria-label", "Palette " + n);
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
          continueBtn.disabled = !isStepComplete(stepId);
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

    continueBtn.addEventListener("click", function () {
      if (isStepComplete(stepId)) advance();
    });

    answersWrap.appendChild(group);
    answersWrap.appendChild(continueBtn);
    return answersWrap;
  }

  function renderComplete() {
    var stepEl = document.createElement("div");
    stepEl.className = "questionnaire-step questionnaire-step--complete";
    stepEl.setAttribute("data-step-id", SUBMIT_ORDER_STEP_ID);

    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "questionnaire-continue questionnaire-archive-btn";
    saveBtn.textContent = "submit & order";

    var confirmEl = document.createElement("p");
    confirmEl.className = "questionnaire-archive-confirm";
    confirmEl.hidden = true;
    confirmEl.textContent = "Saved to archive";

    saveBtn.addEventListener("click", function () {
      syncToPanel();
      triggerFeelingsCanvasUpdate();
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
              confirmEl.hidden = false;
              if (
                window.HandkerchiefArchive.revealDesignArchive
              ) {
                window.HandkerchiefArchive.revealDesignArchive();
              }
            })
            .catch(function (err) {
              console.warn("[Questionnaire] Save failed:", err);
              confirmEl.textContent = "Could not save image. Try again.";
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
      var stepConfig = STEPS[stepId];
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
      "input, button.questionnaire-option, button.questionnaire-continue, input.questionnaire-slider"
    );
  }

  function applyStepUIState(stepId, stepEl) {
    displayStepId = stepId;
    currentStepId = stepId === SUBMIT_ORDER_STEP_ID ? null : stepId;
    activeStepEl = stepEl;
    updateSectionLabel(stepId);
    updateSkipButtonVisibility(stepId);
    updateProgressDots(stepId);
    ensureQuestionnaireCanvasUnlock(stepId);
    syncCanvasLayoutForStep();
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
    if (!viewport) return;

    if (currentStepId === "palette" && stepId !== "palette") {
      activePalettePickerGroup = null;
    }

    clearViewport();

    var stepEl = buildStepElement(stepId);
    if (!stepEl) return;

    applyStepUIState(stepId, stepEl);

    var skipAnim = options.skipEnterAnimation || prefersReducedMotion();
    if (skipAnim) {
      viewport.appendChild(stepEl);
      stepEl.classList.add("is-active");
      if (sectionLabelEl) sectionLabelEl.classList.add("is-active");
      if (!options.deferFocus) {
        var focusTarget = getStepFocusTarget(stepEl, stepId);
        if (focusTarget) focusWithoutScroll(focusTarget);
      }
      return;
    }

    stepEl.classList.add("is-awaiting-enter");
    viewport.appendChild(stepEl);
    measureEnterDistances(stepEl, "forward");
    stepEl.classList.remove("is-awaiting-enter");
    stepEl.classList.add("is-entering-forward");
    startSectionEnterAnimation("forward", "is-entering-forward");
    playEnterSlide(stepEl, function () {
      stepEl.classList.remove("is-entering-forward");
      clearSlideDistances(stepEl);
      var focusTarget = getStepFocusTarget(stepEl, stepId);
      if (focusTarget) focusWithoutScroll(focusTarget);
    });
  }

  function goToStep(nextId) {
    if (nextId) {
      showStep(nextId);
      return;
    }
    showStep(SUBMIT_ORDER_STEP_ID);
  }

  function startEnterAnimation(nextStepEl, resolvedId, direction, enteringClass) {
    var completed = false;

    applyStepUIState(resolvedId, nextStepEl);

    nextStepEl.classList.add("is-awaiting-enter");
    viewport.appendChild(nextStepEl);
    measureEnterDistances(nextStepEl, direction);
    nextStepEl.classList.remove("is-awaiting-enter");
    nextStepEl.classList.add(enteringClass);
    startSectionEnterAnimation(direction, enteringClass);

    function finishTransition() {
      if (completed) return;
      completed = true;
      nextStepEl.classList.remove(enteringClass);
      nextStepEl.style.removeProperty("transition");
      nextStepEl.style.removeProperty("transform");
      clearSlideDistances(nextStepEl);
      setTransitionLock(false);
      activeStepEl = nextStepEl;
      var focusTarget = getStepFocusTarget(nextStepEl, resolvedId);
      if (focusTarget) focusWithoutScroll(focusTarget);
    }

    if (direction === "forward") {
      playEnterSlide(nextStepEl, finishTransition);
      return;
    }

    var enterTarget = getEnterTransitionTarget(nextStepEl, direction);
    void nextStepEl.offsetHeight;

    function onEnterEnd(event) {
      if (completed) return;
      if (event.target !== enterTarget) return;
      if (event.propertyName !== "transform") return;
      finishTransition();
    }

    if (enterTarget) {
      enterTarget.addEventListener("transitionend", onEnterEnd);
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        nextStepEl.classList.add("is-active");
      });
    });

    window.setTimeout(finishTransition, TRANSITION_MS + STAGGER_MS + 50);
  }

  function runStepTransition(nextId, direction) {
    var resolvedId = nextId || SUBMIT_ORDER_STEP_ID;
    direction = direction === "back" ? "back" : "forward";

    if (!activeStepEl || !viewport) {
      goToStep(nextId);
      return;
    }

    if (prefersReducedMotion()) {
      goToStep(nextId);
      return;
    }

    var exitingEl = activeStepEl;
    var nextStepEl = buildStepElement(resolvedId);
    if (!nextStepEl) return;

    if (currentStepId === "palette" && resolvedId !== "palette") {
      activePalettePickerGroup = null;
    }

    var enteringClass =
      direction === "back" ? "is-entering-back" : "is-entering-forward";
    var exitingClass =
      direction === "back" ? "is-exiting-back" : "is-exiting-forward";

    setTransitionLock(true);

    var exitDone = false;
    var enterStarted = false;
    var exitLastPart = getLastAnimPart(exitingEl, "exit", direction);

    function cleanupExit() {
      if (exitDone) return;
      exitDone = true;
      if (exitLastPart) {
        exitLastPart.removeEventListener("transitionend", onExitEnd);
      }
      if (exitingEl.parentNode) {
        exitingEl.parentNode.removeChild(exitingEl);
      }
      clearSlideDistances(exitingEl);
    }

    function beginEnter() {
      if (enterStarted) return;
      enterStarted = true;
      startEnterAnimation(nextStepEl, resolvedId, direction, enteringClass);
    }

    function onExitEnd(event) {
      if (exitDone) return;
      if (event.target !== exitLastPart) return;
      if (event.propertyName !== "transform") return;
      cleanupExit();
      if (!enterStarted) {
        beginEnter();
      }
    }

    measureExitDistances(exitingEl, direction);
    exitingEl.classList.remove("is-active");
    exitingEl.classList.add(exitingClass);
    startSectionExitAnimation(direction, exitingClass);
    void exitingEl.offsetHeight;

    if (exitLastPart) {
      exitLastPart.addEventListener("transitionend", onExitEnd);
    }

    window.setTimeout(beginEnter, ENTER_START_AFTER_EXIT_MS);

    window.setTimeout(function () {
      cleanupExit();
      if (!enterStarted) {
        beginEnter();
      }
    }, TRANSITION_MS + STAGGER_MS + 50);
  }

  function transitionToStep(nextId) {
    runStepTransition(nextId, "forward");
  }

  function skipProfileSection() {
    if (!currentStepId || currentStepId !== PROFILE_ALL_STEP_ID) return;

    cancelProfileTypewriter();
    Object.assign(answers, PROFILE_SKIP_DEFAULTS);
    markAllProfileStepsReached();
    markQuestionnaireProfileComplete();
    markSectionPassed("profile");
    syncToPanel();
    triggerCanvasUpdateAfterSync("homeAt");
    transitionToStep(GRID_ALL_STEP_ID);
  }

  function advance() {
    if (!currentStepId) return;

    if (currentStepId === PROFILE_ALL_STEP_ID) {
      answers.livingInIran = true;
      markAllProfileStepsReached();
      markQuestionnaireProfileComplete();
    } else if (currentStepId === "homeAt") {
      markQuestionnaireProfileComplete();
    }

    markStepReached(currentStepId);
    syncToPanel();
    triggerCanvasUpdateAfterSync(currentStepId);

    var nextId = getNextStepId(currentStepId);
    markSectionPassedOnAdvance(currentStepId, nextId);
    transitionToStep(nextId);
  }

  var questionnaireStarted = false;

  function beginQuestionnaire() {
    if (questionnaireStarted || !viewport) return;
    questionnaireStarted = true;

    var sectionDesign = document.getElementById("section-design");
    var designStart = document.getElementById("design-start");
    var questionnairePanel = document.getElementById("questionnaire-panel");
    if (sectionDesign) {
      sectionDesign.classList.add("section-design--questionnaire-started");
    }
    if (designStart) {
      designStart.hidden = true;
    }
    if (questionnairePanel) {
      questionnairePanel.hidden = false;
    }

    showStep(PROFILE_ALL_STEP_ID, {
      skipEnterAnimation: true,
      deferFocus: true,
    });

    if (typeof window.render === "function") {
      window.render();
    }

    var madlibs = viewport.querySelector(".questionnaire-profile-madlibs");
    if (madlibs && !profileTypewriterPlayed && !prefersReducedMotion()) {
      runProfileTypewriter(/** @type {HTMLElement} */ (madlibs), function () {
        profileTypewriterPlayed = true;
        focusProfileBlank("nameDisplayMode");
      });
      return;
    }

    focusProfileBlank("nameDisplayMode");
  }

  function init() {
    viewport = document.getElementById("questionnaire-viewport");
    sectionLabelEl = document.getElementById("questionnaire-section-label");
    progressEl = document.getElementById("questionnaire-progress");
    skipSectionBtn = document.getElementById("questionnaire-skip-btn");
    if (skipSectionBtn) {
      skipSectionBtn.addEventListener("click", skipProfileSection);
    }
    var startBtn = document.getElementById("design-start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", beginQuestionnaire);
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Questionnaire = {
    start: beginQuestionnaire,
    isStarted: function () {
      return questionnaireStarted;
    },
    getAnswers: function () {
      return Object.assign({}, answers);
    },
    getNameLabelText: function () {
      return getNameModeDisplayLabel(answers.nameDisplayMode, answers.name);
    },
    getCurrentStepId: function () {
      return currentStepId;
    },
    isProfileStep: isProfileStep,
    isGridStep: isGridStep,
    isPreFamilyQuestionnaireStep: isPreFamilyQuestionnaireStep,
    isBodyAutonomyStep: isBodyAutonomyStep,
  };
})();

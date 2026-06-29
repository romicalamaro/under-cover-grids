(function () {
  "use strict";

  /** @type {Array<{ id: string, selector: string }>} */
  var SECTIONS = [
    { id: "combinations", selector: ".sidebar__section--combinations" },
    { id: "identity", selector: ".sidebar__section--identity" },
    { id: "grid", selector: ".sidebar__section--grid-choose" },
    { id: "color-divisions", selector: ".sidebar__section--color-divisions" },
    { id: "body-autonomy", selector: ".sidebar__section--body-autonomy" },
    { id: "body-autonomy-wear", selector: ".sidebar__section--body-autonomy-wear" },
    { id: "feelings", selector: ".sidebar__section--feelings" },
    { id: "colors-export", selector: ".sidebar__section--colors-export" },
  ];

  var labelBarTagTouched = false;
  var profileWasComplete = false;
  var questionnaireProfileComplete = false;
  var gridTypeChosen = false;
  var frameSectionEngaged = false;
  var fanSectionEngaged = false;
  // Highest questionnaire section the user has reached. Content unlocks are
  // gated by this "furthest reached" index (not the live current index) so that
  // navigating back to an earlier section never re-hides content that was
  // already revealed.
  var maxQuestionnaireSectionIndex = -1;
  /** @type {Array<() => void>} */
  var progressListeners = [];

  function getIdentityControls() {
    return typeof window.IdentityControls !== "undefined"
      ? window.IdentityControls
      : null;
  }

  function isProfileRubrickComplete(id) {
    if (id === "labelBarTag") return labelBarTagTouched;
    if (id === "coordinates") {
      return (
        isProfileRubrickComplete("from") &&
        isProfileRubrickComplete("nowIn") &&
        isProfileRubrickComplete("homeAt")
      );
    }
    var ic = getIdentityControls();
    if (!ic || !ic.isRubrickComplete) return false;
    return ic.isRubrickComplete(id);
  }

  function isProfileSectionComplete() {
    var ic = getIdentityControls();
    if (!ic || !ic.getRequiredRubricks) return false;
    var required = ic.getRequiredRubricks();
    var i;
    for (i = 0; i < required.length; i++) {
      if (!isProfileRubrickComplete(required[i])) return false;
    }
    if (!isProfileRubrickComplete("labelBarTag")) return false;
    return true;
  }

  function isGridTypeChosen() {
    return gridTypeChosen;
  }

  function isGridContentUnlocked() {
    if (isQuestionnaireActive() && gridTypeChosen) {
      return true;
    }
    return (
      (isProfileSectionComplete() || questionnaireProfileComplete) &&
      gridTypeChosen
    );
  }

  function isFrameContentUnlocked() {
    if (!isGridContentUnlocked()) return false;
    if (isQuestionnaireActive()) {
      var sectionIndex = getEffectiveQuestionnaireSectionIndex();
      if (sectionIndex >= 0) {
        return sectionIndex >= 2;
      }
    }
    return frameSectionEngaged;
  }

  function isFanContentUnlocked() {
    if (!isFrameContentUnlocked()) return false;
    if (isQuestionnaireActive()) {
      var sectionIndex = getEffectiveQuestionnaireSectionIndex();
      if (sectionIndex >= 0) {
        return sectionIndex >= 3;
      }
    }
    return fanSectionEngaged;
  }

  function isSectionUnlocked(sectionId) {
    if (sectionId === "identity") return true;
    if (sectionId === "combinations") return false;
    if (sectionId === "grid") {
      return isProfileSectionComplete() || questionnaireProfileComplete;
    }
    if (sectionId === "color-divisions") return gridTypeChosen;
    if (sectionId === "body-autonomy") return gridTypeChosen;
    if (sectionId === "body-autonomy-wear") return frameSectionEngaged;
    if (sectionId === "feelings") return fanSectionEngaged;
    return false;
  }

  function applySidebarLocks() {
    var i;
    var entry;
    var section;
    var comboButtons;
    for (i = 0; i < SECTIONS.length; i++) {
      entry = SECTIONS[i];
      section = document.querySelector(entry.selector);
      if (!section) continue;
      var unlocked = isSectionUnlocked(entry.id);
      section.classList.toggle("is-locked", !unlocked);
      section.setAttribute("aria-disabled", String(!unlocked));
    }
    comboButtons = document.querySelectorAll("[data-handkerchief-combo]");
    for (i = 0; i < comboButtons.length; i++) {
      comboButtons[i].disabled = !isSectionUnlocked("combinations");
    }
  }

  function notifySectionProgressChange() {
    var i;
    for (i = 0; i < progressListeners.length; i++) {
      progressListeners[i]();
    }
    applySidebarLocks();
    if (typeof window.render === "function") {
      window.render();
    }
  }

  function notifyProgressChange() {
    var complete = isProfileSectionComplete();
    notifySectionProgressChange();
    if (complete && !profileWasComplete) {
      profileWasComplete = true;
    }
  }

  function markGridTypeChosen() {
    if (gridTypeChosen) return;
    gridTypeChosen = true;
    notifySectionProgressChange();
  }

  function markQuestionnaireProfileComplete() {
    if (questionnaireProfileComplete) return;
    questionnaireProfileComplete = true;
    notifySectionProgressChange();
  }

  function resetQuestionnaireProgress() {
    labelBarTagTouched = false;
    profileWasComplete = false;
    questionnaireProfileComplete = false;
    gridTypeChosen = false;
    frameSectionEngaged = false;
    fanSectionEngaged = false;
    maxQuestionnaireSectionIndex = -1;
    notifySectionProgressChange();
  }

  function markFrameSectionEngaged() {
    if (frameSectionEngaged) return;
    frameSectionEngaged = true;
    notifySectionProgressChange();
  }

  function markFanSectionEngaged() {
    if (fanSectionEngaged) return;
    fanSectionEngaged = true;
    notifySectionProgressChange();
  }

  function onProfileProgressChange(callback) {
    if (typeof callback === "function") {
      progressListeners.push(callback);
    }
  }

  function markLabelBarTagTouched() {
    if (labelBarTagTouched) return;
    labelBarTagTouched = true;
    notifyProgressChange();
  }

  function shouldShowProfileLabelPart(partId) {
    if (partId === "decorative") {
      return true;
    }
    return isProfileRubrickComplete(partId);
  }

  function isQuestionnaireActive() {
    var q =
      typeof window.Questionnaire !== "undefined" ? window.Questionnaire : null;
    if (!q || !q.isStarted || !q.isStarted()) return false;
    if (typeof q.getActiveSectionIndex === "function") {
      var sectionIndex = q.getActiveSectionIndex();
      if (sectionIndex >= 0) return true;
    }
    if (!q.getCurrentStepId) return false;
    var stepId = q.getCurrentStepId();
    return !!(stepId && stepId !== "__feelings_complete__");
  }

  function getQuestionnaireActiveSectionIndex() {
    var q =
      typeof window.Questionnaire !== "undefined" ? window.Questionnaire : null;
    if (!q || !q.isStarted || !q.isStarted()) return -1;
    if (typeof q.getActiveSectionIndex !== "function") return -1;
    return q.getActiveSectionIndex();
  }

  /**
   * Like getQuestionnaireActiveSectionIndex, but returns the furthest section
   * the user has reached so far (the running maximum). Going back to an earlier
   * section keeps the max, so unlocked content stays unlocked.
   */
  function getEffectiveQuestionnaireSectionIndex() {
    var idx = getQuestionnaireActiveSectionIndex();
    if (idx < 0) return idx;
    if (idx > maxQuestionnaireSectionIndex) {
      maxQuestionnaireSectionIndex = idx;
    }
    return maxQuestionnaireSectionIndex;
  }

  function shouldShowProfileLabelSymbol(partId) {
    if (partId === "decorative") {
      return true;
    }
    if (isQuestionnaireActive()) {
      return true;
    }
    return isProfileRubrickComplete(partId);
  }

  function shouldShowProfileLabelText(partId) {
    if (partId === "decorative") {
      return true;
    }
    return isProfileRubrickComplete(partId);
  }

  window.SectionProgression = {
    isProfileRubrickComplete: isProfileRubrickComplete,
    isProfileSectionComplete: isProfileSectionComplete,
    isGridContentUnlocked: isGridContentUnlocked,
    isGridTypeChosen: isGridTypeChosen,
    isFrameContentUnlocked: isFrameContentUnlocked,
    isFanContentUnlocked: isFanContentUnlocked,
    markGridTypeChosen: markGridTypeChosen,
    markQuestionnaireProfileComplete: markQuestionnaireProfileComplete,
    resetQuestionnaireProgress: resetQuestionnaireProgress,
    markFrameSectionEngaged: markFrameSectionEngaged,
    markFanSectionEngaged: markFanSectionEngaged,
    isSectionUnlocked: isSectionUnlocked,
    applySidebarLocks: applySidebarLocks,
    onProfileProgressChange: onProfileProgressChange,
    markLabelBarTagTouched: markLabelBarTagTouched,
    shouldShowProfileLabelPart: shouldShowProfileLabelPart,
    isQuestionnaireActive: isQuestionnaireActive,
    shouldShowProfileLabelSymbol: shouldShowProfileLabelSymbol,
    shouldShowProfileLabelText: shouldShowProfileLabelText,
    notifyProgressChange: notifyProgressChange,
    notifySectionProgressChange: notifySectionProgressChange,
  };
})();

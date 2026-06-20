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
    return (
      (isProfileSectionComplete() || questionnaireProfileComplete) &&
      gridTypeChosen
    );
  }

  function isFrameContentUnlocked() {
    return isGridContentUnlocked() && frameSectionEngaged;
  }

  function isFanContentUnlocked() {
    return isFrameContentUnlocked() && fanSectionEngaged;
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

  window.SectionProgression = {
    isProfileRubrickComplete: isProfileRubrickComplete,
    isProfileSectionComplete: isProfileSectionComplete,
    isGridContentUnlocked: isGridContentUnlocked,
    isGridTypeChosen: isGridTypeChosen,
    isFrameContentUnlocked: isFrameContentUnlocked,
    isFanContentUnlocked: isFanContentUnlocked,
    markGridTypeChosen: markGridTypeChosen,
    markQuestionnaireProfileComplete: markQuestionnaireProfileComplete,
    markFrameSectionEngaged: markFrameSectionEngaged,
    markFanSectionEngaged: markFanSectionEngaged,
    isSectionUnlocked: isSectionUnlocked,
    applySidebarLocks: applySidebarLocks,
    onProfileProgressChange: onProfileProgressChange,
    markLabelBarTagTouched: markLabelBarTagTouched,
    shouldShowProfileLabelPart: shouldShowProfileLabelPart,
    notifyProgressChange: notifyProgressChange,
    notifySectionProgressChange: notifySectionProgressChange,
  };
})();

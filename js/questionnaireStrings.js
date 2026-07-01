/**
 * Questionnaire UI strings — English and Persian (Farsi).
 * Logic values (option.value, step IDs) stay in questionnaire.js.
 */
(function () {
  "use strict";

  function buildLocale(partial) {
    return partial;
  }

  var en = buildLocale({
    sectionLabels: {
      profile: { num: 1, name: "profile" },
      grid: { num: 2, name: "Community" },
      family: { num: 3, name: "Family" },
      bodyAutonomy: { num: 4, name: "Body autonomy" },
      feelings: { num: 5, name: "Feelings" },
      colors: { num: 6, name: "Colors" },
      submitOrder: { num: 7, name: "submit&order" },
    },
    feelings: {
      intro:
        "How much do you feel these emotions when you think about Iran?",
      hopeHeading: "Hope",
      tableRows: [
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
      ],
      scaleLabels: [
        "I do not feel this at all",
        "I feel this occasionally",
        "I feel this somewhat",
        "I feel this clearly",
        "This feeling is very strong",
      ],
    },
    ui: {
      yes: "Yes",
      no: "No",
      continue: "Continue",
      next: "Next",
      shuffleLayout: "Shuffle layout",
      shuffleLayoutAria:
        "Randomize emotion placement on the canvas without changing intensity values",
      submitOrder: "submit & order",
      savedToArchive: "Saved to archive",
      archiveFull:
        "Archive is full — delete older handkerchiefs to save new ones.",
      archiveError: "Could not save to archive. Try again.",
      sectionAriaPrefix: "Section ",
      profileAria: "Profile",
      feelingsAria: "Feelings",
      gridAria: "Community",
      familyAria: "Family",
      palettePrefix: "Palette ",
      nameModes: {
        anonymous: "Anonymous",
        initials: "Initials",
        name: "Name",
      },
      initialsPlaceholder: "Initials",
      namePlaceholder: "Name",
      stepsRemainingOne: "1 step remaining",
      stepsRemainingMany: function (n) {
        return n + " steps remaining";
      },
    },
    madLibs: {
      ariaLabel: "Profile",
      lines: [
        [
          { t: "text", v: "My name is " },
          { t: "nameMode", size: "medium" },
          { t: "text", v: "." },
        ],
        [
          { t: "text", v: "I'm " },
          { t: "blank", id: "age", size: "short" },
          { t: "text", v: " years old." },
        ],
        [
          { t: "text", v: "I lived in Iran " },
          { t: "blank", id: "livingDuration", size: "medium", kind: "select" },
        ],
        [
          { t: "text", v: "until " },
          { t: "blank", id: "leavingYear", size: "short" },
          { t: "text", v: "." },
        ],
        [
          { t: "text", v: "I came from (city / state) " },
          { t: "blank", id: "from", size: "medium" },
          { t: "text", v: " to (city / state) " },
          { t: "blank", id: "nowIn", size: "medium" },
          { t: "text", v: "." },
        ],
        [
          { t: "text", v: "I feel most at home in " },
          { t: "blank", id: "homeAt", size: "medium", kind: "select" },
          { t: "text", v: "." },
        ],
      ],
    },
    steps: {
      livingInIran: {
        label: "Did you ever live in Iran?",
        ariaLabel: "Did you ever live in Iran? Yes or no",
      },
      livingDuration: {
        label: "How much of your life did you live in Iran?",
        ariaLabel: "How much of your life did you live in Iran?",
        options: {
          smallPart: "Small part of my life",
          partOfLife: "Yes, part of my life",
          mostAll: "Yes, most / all of my life",
        },
      },
      leavingYear: {
        label: "Year of leaving",
        placeholder: "Year you left Iran",
        ariaLabel: "Year of leaving",
      },
      from: {
        label: "From",
        placeholder: "Where you are originally from",
        ariaLabel: "From",
      },
      nowIn: {
        label: "Now in",
        placeholder: "Where you live now",
        ariaLabel: "Now in",
      },
      name: {
        label: "Name",
        placeholder: "Name",
        ariaLabel: "Name",
        modeAriaLabel: "How name appears on the label",
        modes: {
          anonymous: "Anonymous",
          initials: "Initials",
          name: "Name",
        },
      },
      age: {
        label: "Age",
        ariaLabel: "Age",
      },
      homeAt: {
        label: 'where do you feel most "at home" today?',
        ariaLabel: 'where do you feel most "at home" today?',
        options: {
          inIran: "In Iran",
          whereILive: "Outside Iran / where I live now",
          nowhere: "Nowhere / in between",
        },
      },
      gridType: {
        ariaLabel: "Grid type",
        options: {
          octagon: "Octagons",
          star: "Stars",
          circles: "Circles",
          diamonds: "Diamonds",
        },
      },
      octagonsN: {
        label:
          "How much do you feel part of an Iranian community around you (physical or online)?",
        ariaLabel:
          "How much do you feel part of an Iranian community around you (physical or online)? Barely part to very much part.",
        rangeLabels: ["Barely part", "Very much part"],
      },
      innerScale: {
        label:
          "How much do you feel that Iranian identity is a central part of your life today?",
        ariaLabel:
          "How much do you feel that Iranian identity is a central part of your life today? Very much in the background to at the center of my life.",
        rangeLabels: ["Very much in the background", "At the center of my life"],
      },
      palette: {
        label: "choose your palette",
        ariaLabel: "Switch between palettes 1 to 12",
      },
      borderFrameDivisions: {
        label: "Frame divisions",
        ariaLabel: "Frame horizontal divisions",
      },
      borderSideWhiteFill: {
        label: "Margin empty cells",
        ariaLabel: "Margin empty cell fill",
      },
      closeFamilyInIran: {
        label: "Do you have close family still living in Iran today?",
        ariaLabel: "Do you have close family still living in Iran today?",
        options: {
          largePart: "Yes, a large part of the family",
          someMembers: "Yes, some family members",
          almostAllOutside: "No, almost everyone is outside Iran",
        },
      },
      iranLossTypes: {
        label:
          "What type of loss / disconnection do you feel in relation to Iran? (select all that apply)",
        ariaLabel:
          "What type of loss or disconnection do you feel in relation to Iran? Select all that apply.",
        options: {
          lovedOne: "Loss of a loved one",
          place: "Loss of place (home, neighborhood, city)",
          languageCulture: "Loss of language / culture in daily life",
          freedomOfMovement:
            "Loss of freedom of movement (cannot return / visit)",
          familyFriendsConnection:
            "Loss of connection with part of the family or friends",
        },
      },
      fanLeaves: {
        label:
          "When you lived in Iran, how free did you feel to choose how to dress in public spaces?",
        ariaLabel:
          "Fan leaves. Step 0 fully open, step 9 four ribs, step 10 closed.",
        rangeLabels: [
          "No freedom of choice at all",
          "Feeling relatively free to choose",
        ],
      },
      angerVerticalLength: {
        label: "Fear — Vertical line length",
        ariaLabel: "Vertical line length",
      },
      anxietyVerticalStroke: {
        label: "Fear — Anxiety / Tension",
        ariaLabel: "Anxiety / Tension — vertical line thickness",
      },
      angerTriangleDensity: {
        label: "Anger",
        ariaLabel: "Anger triangle density",
      },
      hopeMode: {
        label: "Hope",
        ariaLabel: "Hope interaction mode",
        options: {
          view: "View",
          merge: "Merge",
        },
      },
      circleDensity: {
        label: "Sadness",
        ariaLabel: "Circle density",
      },
      longingCircleDensity: {
        label: "Longing",
        ariaLabel: "Longing circle density",
      },
      griefCircleDensity: {
        label: "Grief",
        ariaLabel: "Grief circle density",
      },
      strengthDensity: {
        label: "Strength / Power",
        ariaLabel: "Strength / Power circle-in-square density",
      },
      autoMergeIntensity: {
        label: "Pride",
        ariaLabel: "Pride merged area amount and size",
      },
      prideFillPercent: {
        label: "Pain",
        ariaLabel: "Pain diamond fill amount",
      },
      guiltShameFillPercent: {
        label: "Guilt / Shame",
        ariaLabel: "Guilt / Shame hollow diamond fill amount",
      },
      helplessnessPercent: {
        label: "Helplessness",
        ariaLabel: "Helplessness junction X mark density",
      },
    },
  });

  var fa = buildLocale({
    sectionLabels: {
      profile: { num: 1, name: "پروفایل" },
      grid: { num: 2, name: "جامعه" },
      family: { num: 3, name: "خانواده" },
      bodyAutonomy: { num: 4, name: "خودمختاری بدن" },
      feelings: { num: 5, name: "احساسات" },
      colors: { num: 6, name: "رنگ‌ها" },
      submitOrder: { num: 7, name: "ثبت و سفارش" },
    },
    feelings: {
      intro:
        "وقتی به ایران فکر می‌کنید، این احساسات را تا چه حد تجربه می‌کنید؟",
      hopeHeading: "امید",
      tableRows: [
        { label: "ترس", stepId: "angerVerticalLength" },
        { label: "اضطراب / تنش", stepId: "anxietyVerticalStroke" },
        { label: "خشم", stepId: "angerTriangleDensity" },
        { label: "غم", stepId: "circleDensity" },
        { label: "اشتیاق", stepId: "longingCircleDensity" },
        { label: "سوگ", stepId: "griefCircleDensity" },
        { label: "قدرت / نیرو", stepId: "strengthDensity" },
        { label: "افتخار", stepId: "autoMergeIntensity" },
        { label: "درد", stepId: "prideFillPercent" },
        { label: "گناه / شرم", stepId: "guiltShameFillPercent" },
        { label: "درماندگی", stepId: "helplessnessPercent" },
      ],
      scaleLabels: [
        "اصلاً این احساس را ندارم",
        "گاهی این احساس را دارم",
        "تا حدی این احساس را دارم",
        "به‌وضوح این احساس را دارم",
        "این احساس بسیار قوی است",
      ],
    },
    ui: {
      yes: "بله",
      no: "خیر",
      continue: "ادامه",
      next: "بعدی",
      shuffleLayout: "چیدمان تصادفی",
      shuffleLayoutAria:
        "جای احساسات روی بوم را بدون تغییر شدت، تصادفی کنید",
      submitOrder: "ثبت و سفارش",
      savedToArchive: "در آرشیو ذخیره شد",
      archiveFull:
        "آرشیو پر است — برای ذخیره طرح‌های جدید، طرح‌های قدیمی‌تر را حذف کنید.",
      archiveError: "ذخیره در آرشیو ممکن نشد. دوباره تلاش کنید.",
      sectionAriaPrefix: "بخش ",
      profileAria: "پروفایل",
      feelingsAria: "احساسات",
      gridAria: "جامعه",
      familyAria: "خانواده",
      palettePrefix: "پالت ",
      nameModes: {
        anonymous: "ناشناس",
        initials: "حروف اول",
        name: "نام",
      },
      initialsPlaceholder: "حروف اول",
      namePlaceholder: "نام",
      stepsRemainingOne: "۱ مرحله باقی مانده",
      stepsRemainingMany: function (n) {
        return n + " مرحله باقی مانده";
      },
    },
    madLibs: {
      ariaLabel: "پروفایل",
      lines: [
        [
          { t: "text", v: "نام من " },
          { t: "nameMode", size: "medium" },
          { t: "text", v: " است." },
        ],
        [
          { t: "text", v: "من " },
          { t: "blank", id: "age", size: "short" },
          { t: "text", v: " سال دارم." },
        ],
        [
          { t: "text", v: "من در ایران " },
          { t: "blank", id: "livingDuration", size: "medium", kind: "select" },
          { t: "text", v: " زندگی کردم تا " },
          { t: "blank", id: "leavingYear", size: "short" },
          { t: "text", v: "." },
        ],
        [
          { t: "text", v: "من از " },
          { t: "blank", id: "from", size: "medium" },
          { t: "text", v: " به " },
          { t: "blank", id: "nowIn", size: "medium" },
          { t: "text", v: " آمدم." },
        ],
        [
          { t: "text", v: "امروز بیشتر در " },
          { t: "blank", id: "homeAt", size: "medium", kind: "select" },
          { t: "text", v: " احساس خانه بودن دارم." },
        ],
      ],
    },
    steps: {
      livingInIran: {
        label: "آیا تا به حال در ایران زندگی کرده‌اید؟",
        ariaLabel: "آیا تا به حال در ایران زندگی کرده‌اید؟ بله یا خیر",
      },
      livingDuration: {
        label: "چه مقدار از زندگی‌تان را در ایران گذرانده‌اید؟",
        ariaLabel: "چه مقدار از زندگی‌تان را در ایران گذرانده‌اید؟",
        options: {
          smallPart: "بخش کوچکی از زندگی‌ام",
          partOfLife: "بله، بخشی از زندگی‌ام",
          mostAll: "بله، بیشتر / تمام زندگی‌ام",
        },
      },
      leavingYear: {
        label: "سال خروج",
        placeholder: "سال خروج از ایران",
        ariaLabel: "سال خروج",
      },
      from: {
        label: "از",
        placeholder: "اصالت شما",
        ariaLabel: "از",
      },
      nowIn: {
        label: "اکنون در",
        placeholder: "محل زندگی فعلی",
        ariaLabel: "اکنون در",
      },
      name: {
        label: "نام",
        placeholder: "نام",
        ariaLabel: "نام",
        modeAriaLabel: "نحوه نمایش نام روی برچسب",
        modes: {
          anonymous: "ناشناس",
          initials: "حروف اول",
          name: "نام",
        },
      },
      age: {
        label: "سن",
        ariaLabel: "سن",
      },
      homeAt: {
        label: "امروز بیشتر کجا احساس «خانه بودن» دارید؟",
        ariaLabel: "امروز بیشتر کجا احساس خانه بودن دارید؟",
        options: {
          inIran: "در ایران",
          whereILive: "خارج از ایران / جایی که اکنون زندگی می‌کنم",
          nowhere: "هیچ‌جا / بین دو جهان",
        },
      },
      gridType: {
        ariaLabel: "نوع شبکه",
        options: {
          octagon: "هشت‌ضلعی‌ها",
          star: "ستاره‌ها",
          circles: "دایره‌ها",
          diamonds: "لوزی‌ها",
        },
      },
      octagonsN: {
        label:
          "تا چه حد خود را بخشی از یک جامعه ایرانی (حضوری یا آنلاین) می‌دانید؟",
        ariaLabel:
          "تا چه حد خود را بخشی از یک جامعه ایرانی می‌دانید؟ از تقریباً بی‌ارتباط تا بسیار مرتبط.",
        rangeLabels: ["تقریباً بی‌ارتباط", "بسیار مرتبط"],
      },
      innerScale: {
        label:
          "تا چه حد هویت ایرانی بخش مرکزی زندگی‌تان امروز است؟",
        ariaLabel:
          "تا چه حد هویت ایرانی بخش مرکزی زندگی‌تان است؟ از بسیار پس‌زمینه تا در مرکز زندگی‌ام.",
        rangeLabels: ["بسیار در پس‌زمینه", "در مرکز زندگی‌ام"],
      },
      palette: {
        label: "پالت خود را انتخاب کنید",
        ariaLabel: "جابه‌جایی بین پالت‌های ۱ تا ۱۲",
      },
      borderFrameDivisions: {
        label: "تقسیم‌بندی قاب",
        ariaLabel: "تقسیم‌بندی افقی قاب",
      },
      borderSideWhiteFill: {
        label: "سلول‌های خالی حاشیه",
        ariaLabel: "پر شدن سلول‌های خالی حاشیه",
      },
      closeFamilyInIran: {
        label: "آیا هنوز خانواده نزدیکی در ایران دارید؟",
        ariaLabel: "آیا هنوز خانواده نزدیکی در ایران دارید؟",
        options: {
          largePart: "بله، بخش بزرگی از خانواده",
          someMembers: "بله، برخی از اعضای خانواده",
          almostAllOutside: "خیر، تقریباً همه خارج از ایران هستند",
        },
      },
      iranLossTypes: {
        label:
          "چه نوع از دست دادن / قطع ارتباطی را نسبت به ایران احساس می‌کنید؟ (همه موارد مرتبط را انتخاب کنید)",
        ariaLabel:
          "چه نوع از دست دادن یا قطع ارتباطی را نسبت به ایران احساس می‌کنید؟ همه موارد مرتبط را انتخاب کنید.",
        options: {
          lovedOne: "از دست دادن عزیزی",
          place: "از دست دادن مکان (خانه، محله، شهر)",
          languageCulture: "از دست دادن زبان / فرهنگ در زندگی روزمره",
          freedomOfMovement:
            "از دست دادن آزادی حرکت (امکان بازگشت / سفر نیست)",
          familyFriendsConnection:
            "از دست دادن ارتباط با بخشی از خانواده یا دوستان",
        },
      },
      fanLeaves: {
        label:
          "وقتی در ایران زندگی می‌کردید، چقدر آزاد بودید که در فضاهای عمومی نحوه لباس پوشیدن را انتخاب کنید؟",
        ariaLabel:
          "برگ‌های بادبزن. گام ۰ کاملاً باز، گام ۹ چهار پره، گام ۱۰ بسته.",
        rangeLabels: [
          "هیچ آزادی انتخابی نداشتم",
          "نسبتاً آزاد برای انتخاب بودم",
        ],
      },
      angerVerticalLength: {
        label: "ترس — طول خط عمودی",
        ariaLabel: "طول خط عمودی",
      },
      anxietyVerticalStroke: {
        label: "ترس — اضطراب / تنش",
        ariaLabel: "اضطراب / تنش — ضخامت خط عمودی",
      },
      angerTriangleDensity: {
        label: "خشم",
        ariaLabel: "تراکم مثلث‌های خشم",
      },
      hopeMode: {
        label: "امید",
        ariaLabel: "حالت تعامل امید",
        options: {
          view: "مشاهده",
          merge: "ادغام",
        },
      },
      circleDensity: {
        label: "غم",
        ariaLabel: "تراکم دایره‌ها",
      },
      longingCircleDensity: {
        label: "اشتیاق",
        ariaLabel: "تراکم دایره‌های اشتیاق",
      },
      griefCircleDensity: {
        label: "سوگ",
        ariaLabel: "تراکم دایره‌های سوگ",
      },
      strengthDensity: {
        label: "قدرت / نیرو",
        ariaLabel: "تراکم دایره در مربع — قدرت / نیرو",
      },
      autoMergeIntensity: {
        label: "افتخار",
        ariaLabel: "میزان و اندازه ناحیه ادغام‌شده افتخار",
      },
      prideFillPercent: {
        label: "درد",
        ariaLabel: "میزان پر شدن لوزی درد",
      },
      guiltShameFillPercent: {
        label: "گناه / شرم",
        ariaLabel: "میزان پر شدن لوزی توخالی گناه / شرم",
      },
      helplessnessPercent: {
        label: "درماندگی",
        ariaLabel: "تراکم علامت X درماندگی",
      },
    },
  });

  window.QuestionnaireStrings = {
    en: en,
    fa: fa,
  };
})();

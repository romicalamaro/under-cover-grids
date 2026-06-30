/**
 * Sign glossary entries for the page-2 Signs section.
 * Each entry maps to one 2:3 card; `section` enables future grouped layouts.
 */
(function (global) {
  "use strict";

  /** Uniform brown card background (matches --color-brown in styles.css) */
  var SIGNS_CARD_BG = "#442c28";

  var SIGNS_SECTIONS = [
    {
      id: "profile",
      label: "profile",
      labelFa: "پروفایل",
      description:
        "This layer holds the personal details: name, age, and the country where the woman currently lives. It is the most technical and neutral layer, forming the basic context of her story.",
      descriptionFa:
        "این لایه جزئیات شخصی — نام، سن و کشوری که زن در آن زندگی می‌کند — را در بر می‌گیرد. فنی‌ترین و خنثی‌ترین لایه است و زمینهٔ پایهٔ داستان او را می‌سازد.",
    },
    {
      id: "grid",
      label: "Grid",
      labelFa: "شبکه",
      description:
        "This layer focuses on her sense of belonging to the Iranian community and how present her Iranian identity is in her everyday life. It maps how strongly Iran still shapes who she is.",
      descriptionFa:
        "این لایه بر حس تعلق او به جامعهٔ ایرانی و حضور هویت ایرانی‌اش در زندگی روزمره تمرکز دارد. نشان می‌دهد ایران تا چه اندازه همچنان شکل‌دهندهٔ هویت اوست.",
    },
    {
      id: "family",
      label: "Family",
      labelFa: "خانواده",
      description:
        "This layer speaks about the family and friends who remain in Iran, and the loss, distance, or longing she experiences in relation to them. It marks the emotional borders between the life she left and the people who stayed.",
      descriptionFa:
        "این لایه دربارهٔ خانواده و دوستانی است که در ایران مانده‌اند و فقدان، فاصله یا اشتیاقی که در رابطه با آن‌ها تجربه می‌کند. مرزهای عاطفی بین زندگی‌ای که رها کرده و کسانی که مانده‌اند را ترسیم می‌کند.",
    },
    {
      id: "bodyAutonomy",
      label: "Body autonomy",
      labelFa: "خودمختاری بدن",
      description:
        "This layer reflects how much autonomy and ownership she felt over her own body while living in Iran. It captures her experience of control, restriction, or freedom in relation to her physical self.",
      descriptionFa:
        "این لایه منعکس‌کنندهٔ میزان خودمختاری و مالکیتی است که در ایران بر بدن خود احساس می‌کرد. تجربهٔ کنترل، محدودیت یا آزادی در رابطه با جسم خود را ثبت می‌کند.",
    },
    {
      id: "feelings",
      label: "Feelings",
      labelFa: "احساسات",
      description:
        "This final layer holds the most significant feelings that arise when she thinks about Iran. It translates her emotional landscape into visual form – from grief and anger to hope and connection.",
      descriptionFa:
        "این لایه نهایی مهم‌ترین احساساتی را در بر می‌گیرد که با فکر کردن به ایران به وجود می‌آیند. منظر عاطفی او را به فرم بصری ترجمه می‌کند — از سوگ و خشم تا امید و پیوند.",
    },
  ];

  var GRID_INNER_SCALE_CONFIG = {
    label:
      "How much do you feel that Iranian identity is a central part of your life today?",
    labelFa:
      "تا چه حد احساس می‌کنید هویت ایرانی بخش مرکزی زندگی‌تان امروز است؟",
    ariaLabel:
      "How much do you feel that Iranian identity is a central part of your life today? Very much in the background to at the center of my life.",
    ariaLabelFa:
      "تا چه حد احساس می‌کنید هویت ایرانی بخش مرکزی زندگی‌تان امروز است؟ از بسیار در پس‌زمینه تا در مرکز زندگی من.",
    min: 1,
    max: 10,
    step: 1,
    rangeLabels: ["Very much in the background", "At the center of my life"],
    rangeLabelsFa: ["بسیار در پس‌زمینه", "در مرکز زندگی من"],
  };

  var SIGNS_CATALOG = [
    /* —— Profile —— */
    {
      id: "profile-age",
      section: "profile",
      label: "Age",
      labelFa: "سن",
      visual: { type: "svgFile", file: "age.svg" },
    },
    {
      id: "profile-now-in",
      section: "profile",
      label: "Now in",
      labelFa: "اکنون در",
      visual: { type: "svgFile", file: "now in.svg" },
    },
    {
      id: "profile-leaving-year",
      section: "profile",
      label: "Leaving year",
      labelFa: "سال خروج",
      visual: { type: "svgFile", file: "left.svg" },
    },
    {
      id: "profile-home-inIran",
      section: "profile",
      label: "At home in Iran",
      labelFa: "در خانه در ایران",
      visual: { type: "svgFile", file: "home/IN IRAN home.svg" },
    },
    {
      id: "profile-home-whereILive",
      section: "profile",
      label: "At home where I live",
      labelFa: "در خانه‌ای که زندگی می‌کنم",
      visual: { type: "svgFile", file: "home/WHERE I LIVE.svg" },
    },
    {
      id: "profile-home-nowhere",
      section: "profile",
      label: "At home nowhere",
      labelFa: "در هیچ‌جا خانه ندارم",
      visual: { type: "svgFile", file: "home/NOWHERE.svg" },
    },
    {
      id: "profile-living-smallPart",
      section: "profile",
      label: "Small part of life in Iran",
      labelFa: "بخش کوچکی از زندگی در ایران",
      visual: {
        type: "svgFile",
        file: "Did you ever live in Iran?/small part of my life.svg",
      },
    },
    {
      id: "profile-living-partOfLife",
      section: "profile",
      label: "Part of life in Iran",
      labelFa: "بخشی از زندگی در ایران",
      visual: {
        type: "svgFile",
        file: "Did you ever live in Iran?/part of my life.svg",
      },
    },
    {
      id: "profile-living-mostAll",
      section: "profile",
      label: "Most or all of life in Iran",
      labelFa: "بیشتر یا تمام زندگی در ایران",
      visual: {
        type: "svgFile",
        file: "Did you ever live in Iran?/Yes, most : all of my life.svg",
      },
    },

    /* —— Grid —— */
    {
      id: "grid-star",
      section: "grid",
      label: "",
      labelFa: "",
      visual: { type: "gridIcon", gridType: "star" },
    },

    /* —— Feelings —— */
    {
      id: "feelings-fear-anxiety",
      section: "feelings",
      label: "Fear / Anxiety",
      labelFa: "ترس / اضطراب",
      visual: { type: "canvasPreview", previewId: "anxiety" },
    },
    {
      id: "feelings-anger",
      section: "feelings",
      label: "Anger",
      labelFa: "خشم",
      visual: { type: "canvasPreview", previewId: "anger" },
    },
    {
      id: "feelings-hope",
      section: "feelings",
      label: "Hope",
      labelFa: "امید",
      visual: { type: "canvasPreview", previewId: "hope" },
    },
    {
      id: "feelings-sadness",
      section: "feelings",
      label: "Sadness",
      labelFa: "غم",
      visual: { type: "canvasPreview", previewId: "sadness" },
    },
    {
      id: "feelings-longing",
      section: "feelings",
      label: "Longing",
      labelFa: "اشتیاق",
      visual: { type: "canvasPreview", previewId: "longing" },
    },
    {
      id: "feelings-grief",
      section: "feelings",
      label: "Grief",
      labelFa: "سوگ",
      visual: { type: "canvasPreview", previewId: "grief" },
    },
    {
      id: "feelings-strength",
      section: "feelings",
      label: "Strength / Power",
      labelFa: "قدرت / نیرو",
      visual: { type: "canvasPreview", previewId: "strength" },
    },
    {
      id: "feelings-pride",
      section: "feelings",
      label: "Pride",
      labelFa: "افتخار",
      visual: { type: "canvasPreview", previewId: "pride" },
    },
    {
      id: "feelings-pain",
      section: "feelings",
      label: "Pain",
      labelFa: "درد",
      visual: { type: "canvasPreview", previewId: "pain" },
    },
    {
      id: "feelings-guiltShame",
      section: "feelings",
      label: "Guilt / Shame",
      labelFa: "گناه / شرم",
      visual: { type: "canvasPreview", previewId: "guiltShame" },
    },
    {
      id: "feelings-helplessness",
      section: "feelings",
      label: "Helplessness",
      labelFa: "درماندگی",
      visual: { type: "canvasPreview", previewId: "helplessness" },
    },

    /* —— Family —— */
    {
      id: "family-frame-line",
      section: "family",
      label: "",
      labelFa: "",
      visual: { type: "canvasPreview", previewId: "familyFrameLine" },
    },

    /* —— Body autonomy —— */
    {
      id: "body-fanLeaves",
      section: "bodyAutonomy",
      label: "Fan leaves",
      labelFa: "برگ‌های بادبزن",
      visual: { type: "canvasPreview", previewId: "fanLeaves" },
    },

  ];

  function getSignsCardBgColor() {
    return SIGNS_CARD_BG;
  }

  global.SignsCatalog = {
    entries: SIGNS_CATALOG,
    sections: SIGNS_SECTIONS,
    gridInnerScaleConfig: GRID_INNER_SCALE_CONFIG,
    cardBg: SIGNS_CARD_BG,
    getCardBgColor: getSignsCardBgColor,
  };
})(typeof window !== "undefined" ? window : this);

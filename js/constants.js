/** Logical print canvas: 68cm × 180cm at 300 DPI */
var CANVAS_W = 803;
var CANVAS_H = 2126;

/** Outer colored frame outside the canvas (print hem), width in cm */
var HANDKERCHIEF_FRAME_CM = 1;
/** Logical px per cm derived from canvas width (803 ÷ 68 ≈ 11.81) */
var HANDKERCHIEF_CM_TO_PX = CANVAS_W / 68;
/** 1 cm outer frame in logical px */
var HANDKERCHIEF_OUTER_FRAME_PX = HANDKERCHIEF_CM_TO_PX * HANDKERCHIEF_FRAME_CM;
/** Dashed brown outline around the outer frame perimeter */
var HANDKERCHIEF_OUTER_FRAME_DASH_STROKE_WIDTH = 1;
var HANDKERCHIEF_OUTER_FRAME_DASH_COLOR = "#685450";
var HANDKERCHIEF_OUTER_FRAME_DASH_ARRAY = "4 3";

/** White margin ring area as a fraction of full canvas area (symmetric sides) */
var CANVAS_BORDER_AREA_RATIO = 0.15;

/** Outline between grid and white margin (stroke color = pattern color) */
var GRID_BOUNDARY_STROKE_WIDTH = 5;

/** Layout margins (CSS px) around scaled canvas */
var VIEW_MARGIN = 24;

/** Grid + circle stroke (shared color picker) — RGB(255, 60, 60) */
var PATTERN_STROKE_COLOR_DEFAULT = "#ff3c3c";
/** Sadness circles fill (color picker default) */
var CIRCLE_FILL_COLOR_DEFAULT = "#ffffff";
var GRID_STROKE_WIDTH_DEFAULT = 1;
/** Color divisions slider: 1 = none, 5 = all five regions colored (H1–H5) */
var COLOR_DIVISIONS_MIN = 1;
var COLOR_DIVISIONS_MAX = 5;
var COLOR_DIVISIONS_DEFAULT = 1;
var COLOR_DIVISIONS_FILL_DEFAULT = "#00ff89";
/** Five geometric tiles; palette slots H1–H5 */
var COLOR_DIVISIONS_REGION_COUNT = 5;
/** CSS mix-blend-mode on color-division rects H1–H4 (blends with grid stack below) */
var COLOR_DIVISIONS_BLEND_MODE = "exclusion";
/** H5 area only — color dodge instead of exclusion */
var COLOR_DIVISIONS_BLEND_MODE_H5 = "color-dodge";
/** Sidebar pipettes for palette slots H1–H5 (color-division blend areas) */
var BLEND_AREA_COLOR_SLOTS = [
  { slot: "H1", label: "אזור 1", blendMode: "exclusion" },
  { slot: "H2", label: "אזור 2", blendMode: "exclusion" },
  { slot: "H3", label: "אזור 3", blendMode: "exclusion" },
  { slot: "H4", label: "אזור 4", blendMode: "exclusion" },
  { slot: "H5", label: "אזור 5", blendMode: "color-dodge" },
];
/** Area 1–5 defaults when sheet palette has no H slot */
var COLOR_DIVISIONS_FILL_DEFAULTS = [
  "#00ff89",
  "#b2ff00",
  "#00fff9",
  "#000000",
  "#303030",
];
/** Canvas background (color picker default) — must be one of CANVAS_BACKGROUND_COLORS */
var CANVAS_BACKGROUND_COLOR_DEFAULT = "#fffce8";
/** Only these three colors may be used as canvas background */
var CANVAS_BACKGROUND_COLORS = ["#fffce8", "#ffc9e2", "#ffeff7"];
var BG_COLOR = CANVAS_BACKGROUND_COLOR_DEFAULT;

/**
 * Full-width brown bars on top/bottom side-frame division edges.
 * Bottom bar is canonical; top bar duplicates bottom layout on the bar, then rotates 180°.
 */
var CANVAS_EDGE_BROWN_BAR_HEIGHT_PX = 100;
/** Length toward canvas top/bottom past division line (inner edge stays on divY) */
var CANVAS_EDGE_BROWN_BAR_OUTWARD_EXTEND_PX = 20;
/** Extra canvas area above bottom label bar included in profile questionnaire zoom */
var PROFILE_LABEL_FOCUS_PAD_ABOVE_PX = 280;
/** Legacy bottom gap constant (profile zoom now centers label on viewport Y) */
var PROFILE_LABEL_FOCUS_BOTTOM_SCREEN_GAP_PX = 100;
/** Shift profile label focus above viewport center (CSS px; positive = higher) */
var PROFILE_LABEL_FOCUS_CENTER_OFFSET_UP_PX = 80;
/** Additional upward clip extension beyond header alignment (CSS px) */
var PROFILE_LABEL_FOCUS_EXTRA_EXTEND_UP_PX = 100;
/** Profile zoom target: grid columns (1-based) — profile section only */
var PROFILE_LABEL_FOCUS_GRID_COL_START = 7;
var PROFILE_LABEL_FOCUS_GRID_COL_SPAN = 6;
/** Pre-family grid/color + body-autonomy focus columns (1-based) */
var QUESTIONNAIRE_FOCUS_GRID_COL_START = 8;
var QUESTIONNAIRE_FOCUS_GRID_COL_SPAN = 5;
/** #design-svg box-shadow bleed reserved in large profile zoom layout (CSS px) */
var CANVAS_LAYOUT_BOX_SHADOW_BLEED_PX = 12;
/** Extra canvas area below top brown bar included in body-autonomy questionnaire zoom */
var BODY_AUTONOMY_FOCUS_PAD_BELOW_PX = 450;
/** Gap between handkerchief top focus and viewport header in large body-autonomy mode (CSS px) */
var BODY_AUTONOMY_FOCUS_TOP_SCREEN_GAP_PX = 100;
/** Grid + palette: gap from handkerchief bottom to viewport bottom (CSS px) */
var GRID_COLOR_FOCUS_BOTTOM_SCREEN_GAP_PX = 150;
var CANVAS_EDGE_BROWN_BAR_COLOR = "#685450";
/** Label bar background (color picker default) */
var LABEL_BAR_BACKGROUND_COLOR_DEFAULT = CANVAS_EDGE_BROWN_BAR_COLOR;
/** Icons, text, and separators on the label bar (color picker default) */
var LABEL_BAR_CONTENT_COLOR_DEFAULT = "#b2ff00";
/** Horizontal bands inside each top/bottom brown bar (2 divider lines → 3 equal parts) */
var CANVAS_EDGE_BROWN_BAR_HORIZONTAL_SEGMENTS = 3;
/** Division lines on brown bars (visible on #685450 fill) */
var CANVAS_EDGE_BROWN_BAR_DIVISION_STROKE = "#ffffff";
/**
 * Checkerboard grid in outer third: 11 cols × 3 rows (cell edges only, no overlay strokes).
 * VERTICAL_LINES / HORIZONTAL_LINES = interior divider count that defines those cells.
 */
var CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_VERTICAL_LINES = 10;
var CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_HORIZONTAL_LINES = 2;
/** Row heights in outer-third grid: rows 1–2 = 40% each, row 3 (outer) = 20% (must sum to 1) */
var CANVAS_EDGE_BROWN_BAR_GRID_ROW_RATIOS = [0.4, 0.4, 0.2];
/** Padding inside the outer-third row: left, right, and canvas-outer edge (px) */
var CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_INSET_PX = 10;
/** Padding on the inner edge (toward row 2 / horizontal division above the grid) */
var CANVAS_EDGE_BROWN_BAR_OUTER_THIRD_GRID_INSET_TOP_PX = 0;
/** Non-highlighted grid cells in outer third (use label content color from palette) */
var CANVAS_EDGE_BROWN_BAR_GRID_CELL_BASE_FILL = "#ffffff";
/** Min column width (px) for randomized outer-third grid columns */
var CANVAS_EDGE_BROWN_BAR_GRID_MIN_COL_WIDTH_PX = 10;
/** At most this fraction of columns may use the minimum width (1/5) */
var CANVAS_EDGE_BROWN_BAR_GRID_MAX_MIN_COL_FRACTION = 0.2;
/** Random width exponent (>1 = more narrow + fewer wide among non-min columns) */
var CANVAS_EDGE_BROWN_BAR_GRID_WIDTH_RANDOM_POWER = 3.2;

/** Banner in first brown-bar segment (grid-facing band), top + bottom bars (empty = hidden) */
var BROWN_BAR_BANNER_TEXT = "";
/** Middle word struck through (line spans IRANIAN only, not the dots) */
var BROWN_BAR_BANNER_STRIKE_WORD = "IRANIAN";
var BROWN_BAR_BANNER_FONT_FAMILY = "DIN Condensed";
var BROWN_BAR_BANNER_FILL = "#ffffff";
/** Extra space between characters (SVG letter-spacing, canvas px) */
var BROWN_BAR_BANNER_LETTER_SPACING = -1;
/** Strikethrough bar thickness (× banner font-size) */
var BROWN_BAR_BANNER_STRIKE_STROKE_WIDTH_RATIO = 0.11;
/** Shrink strikethrough inside IRANIAN from each end (× word width, keeps off dots) */
var BROWN_BAR_BANNER_STRIKE_INSET_RATIO = 0.08;
/** font-size as fraction of first-segment height */
var BROWN_BAR_BANNER_FONT_HEIGHT_RATIO = 0.85;
/** Downward nudge (× font-size) so all-caps sit visually centered in the row */
var BROWN_BAR_BANNER_OPTICAL_CENTER_DY_EM = 0.12;

/** SVG files available for the dynamic label bar (svg/ folder) */
var LABEL_BAR_SVG_ASSETS = [
  "tag/lion.svg",
  "tag/tag01.2.svg",
  "tag/tag02.svg",
  "tag/tag03.svg",
  "tag/tag04.svg",
  "tag/tag05.2.svg",
  "tag/reshet.svg",
  "reshetsmall.svg",
  "IN IRAN.svg",
  "OUTSIDE IRAN.svg",
  "undercover english.svg",
  "logo placeholder.svg",
  "age.svg",
  "from.svg",
  "now in.svg",
  "circle.svg",
  "Union.svg",
  "Unionsmall.svg",
  "Vector.svg",
  "left.svg",
  "women.svg",
  "LOST/man.svg",
  "LOST/2 man.svg",
  "LOST/3 man.svg",
  "home/IN IRAN home.svg",
  "home/WHERE I LIVE.svg",
  "home/NOWHERE.svg",
  "Did you ever live in Iran?/no.svg",
  "Did you ever live in Iran?/small part of my life.svg",
  "Did you ever live in Iran?/part of my life.svg",
  "Did you ever live in Iran?/Yes, most : all of my life.svg",
];
/** Natural pixel sizes for label-bar layout (from each SVG viewBox) */
var LABEL_BAR_SVG_DIMENSIONS = {
  "tag/lion.svg": { width: 257.14, height: 186 },
  "tag/tag01.2.svg": { width: 193, height: 192 },
  "tag/tag02.svg": { width: 221, height: 198 },
  "tag/tag03.svg": { width: 78, height: 78 },
  "tag/tag04.svg": { width: 94, height: 69 },
  "tag/tag05.2.svg": { width: 195, height: 195 },
  "tag/reshet.svg": { width: 192, height: 193 },
  "lion.svg": { width: 257.14, height: 186 },
  "man.svg": { width: 89, height: 115 },
  "LOST/man.svg": { width: 89, height: 115 },
  "LOST/2 man.svg": { width: 168, height: 115 },
  "LOST/3 man.svg": { width: 247, height: 115 },
  "reshetsmall.svg": { width: 129, height: 90 },
  "IN IRAN.svg": { width: 115, height: 103.73 },
  "OUTSIDE IRAN.svg": { width: 111, height: 111 },
  "undercover english.svg": { width: 164.16, height: 80 },
  "logo placeholder.svg": { width: 294, height: 88 },
  "undercover arabic.svg": { width: 215, height: 80 },
  "age.svg": { width: 60.75, height: 80 },
  "from.svg": { width: 96, height: 85 },
  "now in.svg": { width: 96, height: 85 },
  "circle.svg": { width: 154, height: 152 },
  "Union.svg": { width: 296.9, height: 53 },
  "Unionsmall.svg": { width: 304, height: 87 },
  "Vector.svg": { width: 164, height: 91 },
  "left.svg": { width: 81, height: 80 },
  "women.svg": { width: 47.58, height: 80 },
  "home/IN IRAN home.svg": { width: 66, height: 98 },
  "home/WHERE I LIVE.svg": { width: 66, height: 98 },
  "home/NOWHERE.svg": { width: 66, height: 98 },
  "Did you ever live in Iran?/no.svg": { width: 86, height: 86 },
  "Did you ever live in Iran?/small part of my life.svg": { width: 86, height: 86 },
  "Did you ever live in Iran?/part of my life.svg": { width: 86, height: 86 },
  "Did you ever live in Iran?/Yes, most : all of my life.svg": { width: 86, height: 86 },
};
/** Profile “where do you feel at home?” → row 1 icon */
var LABEL_BAR_HOME_AT_SVGS = {
  inIran: "home/IN IRAN home.svg",
  whereILive: "home/WHERE I LIVE.svg",
  nowhere: "home/NOWHERE.svg",
};
/** Default home-at sign in questionnaire + label bar before / as fallback choice */
var LABEL_BAR_HOME_AT_DEFAULT_SVG = "home/NOWHERE.svg";
/** Multi-color or non-tintable SVGs on the label bar (original colors preserved) */
var LABEL_BAR_NATIVE_COLOR_SVGS = [];
/** Profile “Yes” → this sign on the label; “No” → OUTSIDE IRAN (legacy, unused for duration question) */
var LABEL_BAR_LIVING_IN_IRAN_SVG = "IN IRAN.svg";
var LABEL_BAR_LIVING_OUTSIDE_IRAN_SVG = "OUTSIDE IRAN.svg";
/** Profile “Did you ever live in Iran?” — No sign on the label */
var LABEL_BAR_LIVING_NEVER_IN_IRAN_SVG = "Did you ever live in Iran?/no.svg";
/** Profile “Did you ever live in Iran?” Yes → duration signs on the label */
var LABEL_BAR_LIVING_DURATION_SVGS = {
  smallPart: "Did you ever live in Iran?/small part of my life.svg",
  partOfLife: "Did you ever live in Iran?/part of my life.svg",
  mostAll: "Did you ever live in Iran?/Yes, most : all of my life.svg",
};
/** Row 2: profile From / Now in icons inward from the living-in-Iran sign */
var LABEL_BAR_FROM_SVG = "from.svg";
var LABEL_BAR_NOW_IN_SVG = "now in.svg";
/** Row 2: reshet sign between Now in and profile name (svg/reshetsmall.svg) */
var LABEL_BAR_CIRCLE_SVG = "reshetsmall.svg";
/** Row 1: fixed union sign between home-at icon and women icon */
var LABEL_BAR_UNION_SVG = "Union.svg";
/** Row 1 left edge + row 2 right edge (pinned, not spread) */
var LABEL_BAR_UNION_SMALL_SVG = "Union.svg";
var LABEL_BAR_PROFILE_FROM_DEFAULT = "TEHERAN";
var LABEL_BAR_PROFILE_NOW_IN_DEFAULT = "MAINZ";
var LABEL_BAR_PROFILE_LEAVING_YEAR_DEFAULT = "2021";
var LABEL_BAR_AGE_DEFAULT = "27";
/** Top row: left icon + leaving year text between logo wordmark and home icon */
var LABEL_BAR_LEFT_SVG = "left.svg";
/** Row 1: women icon after union (replaces former Vector position) */
var LABEL_BAR_WOMEN_SVG = "women.svg";
/** Fixed wordmarks by the lions (empty = hidden) */
var LABEL_BAR_LEFT_LION_INNER_ROW1_SVG = "";
/** Row 1: fixed sun icon removed — Profile “at home” icon sits here (see LABEL_BAR_HOME_AT_SVGS) */
var LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG = "reshetsmall.svg";
var LABEL_BAR_AGE_SVG = "age.svg";
/** Profile mad-libs blanks — static question signs (same assets as label bar) */
var PROFILE_MADLIBS_FIELD_ICONS = {
  age: LABEL_BAR_AGE_SVG,
  livingDuration: LABEL_BAR_LIVING_IN_IRAN_SVG,
  leavingYear: LABEL_BAR_LEFT_SVG,
  from: LABEL_BAR_FROM_SVG,
  nowIn: LABEL_BAR_NOW_IN_SVG,
  homeAt: LABEL_BAR_HOME_AT_DEFAULT_SVG,
};
/** Fixed caption left of the Age icon (row 1, inward from undercover english) */
var LABEL_BAR_AGE_LABEL_TEXT = "AGE";
/** Circle center in age.svg viewBox (for profile age digits overlay) */
var LABEL_BAR_AGE_CIRCLE_CX = 30.38;
var LABEL_BAR_AGE_CIRCLE_CY = 40;
var LABEL_BAR_AGE_CIRCLE_R = 23.65;
/** Overlay font size as a fraction of circle diameter */
var LABEL_BAR_AGE_OVERLAY_FONT_SIZE_RATIO = 0.56;
var LABEL_BAR_AGE_OVERLAY_FILL = "#ffffff";
/** Letter-spacing for age digits (0 keeps double digits visually centered) */
var LABEL_BAR_AGE_OVERLAY_LETTER_SPACING = 0;
/** Nudge age digits inside the circle (px) */
var LABEL_BAR_AGE_OVERLAY_X_OFFSET_PX = 0;
var LABEL_BAR_AGE_OVERLAY_Y_OFFSET_PX = 0.5;
var LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG = "";
/** Profile Lost icon inward from the right lion (row 1) — always Inner Circle */
var LABEL_BAR_LOST_INNER_SVG = "";
var LABEL_BAR_LOST_MIDDLE_SVG = "LOST/2 man.svg";
var LABEL_BAR_LOST_DISTANT_SVG = "LOST/3 man.svg";
/** Fixed caption left of the Lost profile icon (row 1, inward from right lion) */
var LABEL_BAR_LOST_LABEL_TEXT = "1/1";
/** Label-bar icons render white on the brown bar */
var LABEL_BAR_ICON_FILL = "#ffffff";
/** SVG filter id — tints white icon assets to G4 via feFlood (exact color match) */
var LABEL_BAR_ICON_TINT_FILTER_ID = "label-bar-icon-tint-filter";
/** Horizontal inset from each bar edge before label items are laid out */
var LABEL_BAR_HORIZONTAL_INSET_PX = 10;
/** Vertical inset above and below label items inside the bar segment (text band) */
var LABEL_BAR_VERTICAL_INSET_PX = 10;
/** Legacy vertical padding removed from SVG icons only (restores pre-text-fit icon size) */
var LABEL_BAR_SVG_LEGACY_VERTICAL_INSET_PX = 0;
/** Gap between row-1 and row-2 label content (split evenly at the segment boundary) */
var LABEL_BAR_ADJACENT_ROW_CONTENT_GAP_PX = 5;
/**
 * Nudge both content rows toward the outer grid band without changing row heights
 * or the row-1↔row-2 gap. Transfers padding from below row 2 to above row 1.
 */
var LABEL_BAR_CONTENT_SHIFT_TOWARD_GRID_PX = 2.5;
/** End-cap tag SVGs (svg/tag/) — user cycles via sidebar control */
var LABEL_BAR_TAG_SVGS = [
  "tag/lion.svg",
  "tag/tag01.2.svg",
  "tag/tag02.svg",
  "tag/tag03.svg",
  "tag/tag04.svg",
  "tag/tag05.2.svg",
];
var LABEL_BAR_TAG_ROTATION_STORAGE_KEY = "undercover.labelBarTagIndex";
/** Fallback end-cap SVG when rotation pool is unavailable */
var LABEL_BAR_END_CAP_SVG = "tag/lion.svg";
/** End caps span this many brown-bar horizontal rows (segments) from the inner edge */
var LABEL_BAR_END_CAP_ROW_SPAN = 2;
/** Gap between end cap and inner label content on each side (px) */
var LABEL_BAR_ITEM_GAP_PX = 8;
/** Fixed gap between caption text and its symbol inside one label-bar group (px) */
var LABEL_BAR_CLUSTER_INTERNAL_GAP_PX = 8;
/** Square inserted between each pair of label-bar SVG symbol clusters */
var LABEL_BAR_SYMBOL_SEPARATOR_SIZE_PX = 5;
var LABEL_BAR_SYMBOL_SEPARATOR_FILL = "#ffffff";
/** Uniform scale for all label-bar text and SVG symbols (1 = max row height) */
var LABEL_BAR_CONTENT_SCALE = 1;
/** Starting scale for label-bar text before bbox fit (1 = fill content band height) */
var LABEL_BAR_TEXT_FONT_HEIGHT_RATIO = 1;
/** Extra scale after bbox fit (1 = glyph bbox matches content row height) */
var LABEL_BAR_TEXT_TOUCH_OVERSCALE = 1;
/** Downward nudge so all-caps sit visually centered in the row (px) */
var LABEL_BAR_TEXT_Y_OFFSET_PX = 3;
/** Padding inside the knockout badge (coordinates + 1/1) */
var LABEL_BAR_COORDINATES_BADGE_PAD_X_PX = 7;
var LABEL_BAR_COORDINATES_BADGE_PAD_Y_PX = 3;
/** Minimum extra knockout-badge width in SVG export (Illustrator text is wider) */
var LABEL_BAR_COORDINATES_BADGE_EXPORT_EXTRA_WIDTH_PX = 8;
/** Extra downward nudge for text inside knockout badges (px); rect stays put */
var LABEL_BAR_KNOCKOUT_BADGE_TEXT_Y_OFFSET_PX = -1;
/** Lift outlined export text vs on-screen middle baseline (negative = up) */
var LABEL_BAR_EXPORT_OUTLINE_Y_NUDGE_PX = -3;
/** Knockout fraction badges (1/1) — tiny downward vs coordinates */
var LABEL_BAR_EXPORT_FRACTION_BADGE_OUTLINE_Y_NUDGE_PX = -4;
/** Knockout coordinates badge — sits lower than fraction text in export */
var LABEL_BAR_EXPORT_COORDINATES_OUTLINE_Y_NUDGE_PX = -3;

/** Random 8-digit serial in white margin above/below brown bars (same number top + bottom) */
var CANVAS_EDGE_SERIAL_EDGE_INSET_PX = 50;
var CANVAS_EDGE_SERIAL_DIGIT_COUNT = 8;
/** Each digit value N → N filled circles in a row (0 → none) */
var CANVAS_EDGE_SERIAL_CIRCLE_GAP_PX = 3;
/** Max circle diameter as fraction of white strip height (capped by slot width) */
var CANVAS_EDGE_SERIAL_CIRCLE_DIAMETER_RATIO = 0.35;
/** Dot clusters in white margin above/below brown bars (palette slot G5) */
var CANVAS_EDGE_SERIAL_FILL = "#3c06a7";

/** Full octagons per row/column (n); half-octagon on each edge → (n+1) tile widths */
var OCTAGONS_N_MIN = 3;
var OCTAGONS_N_MAX = 13;
var OCTAGONS_N_DEFAULT = 7;
/** UI shows steps 1–10; grid still uses OCTAGONS_N_MIN–MAX internally. */
var OCTAGONS_N_STEPS = 10;

/**
 * @param {number} stepNumber 1 = min density, OCTAGONS_N_STEPS = max density
 * @returns {number}
 */
function octagonsNValueFromStep(stepNumber) {
  var steps =
    typeof OCTAGONS_N_STEPS !== "undefined" ? OCTAGONS_N_STEPS : 10;
  var min = typeof OCTAGONS_N_MIN !== "undefined" ? OCTAGONS_N_MIN : 3;
  var max = typeof OCTAGONS_N_MAX !== "undefined" ? OCTAGONS_N_MAX : 13;
  var idx = Math.round(Number(stepNumber)) - 1;
  if (!isFinite(idx)) idx = steps - 1;
  if (idx < 0) idx = 0;
  if (idx > steps - 1) idx = steps - 1;
  if (steps < 2) return max;
  return Math.round(min + (idx / (steps - 1)) * (max - min));
}

/**
 * @param {number} value internal grid n (OCTAGONS_N_MIN–MAX)
 * @returns {number} step 1–OCTAGONS_N_STEPS
 */
function octagonsNStepFromValue(value) {
  var steps =
    typeof OCTAGONS_N_STEPS !== "undefined" ? OCTAGONS_N_STEPS : 10;
  var min = typeof OCTAGONS_N_MIN !== "undefined" ? OCTAGONS_N_MIN : 3;
  var max = typeof OCTAGONS_N_MAX !== "undefined" ? OCTAGONS_N_MAX : 13;
  var span = max - min;
  if (span < 1e-9) return steps;
  var idx = Math.round(((Number(value) - min) / span) * (steps - 1));
  return Math.max(1, Math.min(steps, idx + 1));
}

/**
 * @param {number} stepNumber 1-based UI step
 * @param {number[]} table length OCTAGONS_N_STEPS
 * @returns {number}
 */
function octagonsNValueFromStepTable(stepNumber, table) {
  var steps =
    typeof OCTAGONS_N_STEPS !== "undefined" ? OCTAGONS_N_STEPS : 10;
  var idx = Math.round(Number(stepNumber)) - 1;
  if (!isFinite(idx)) idx = steps - 1;
  if (idx < 0) idx = 0;
  if (idx > steps - 1) idx = steps - 1;
  if (!table || !table.length) return OCTAGONS_N_DEFAULT;
  return table[idx];
}

/**
 * @param {number} value grid n
 * @param {number[]} table
 * @returns {number} step 1–OCTAGONS_N_STEPS
 */
function octagonsNStepFromTableValue(value, table) {
  var steps =
    typeof OCTAGONS_N_STEPS !== "undefined" ? OCTAGONS_N_STEPS : 10;
  if (!table || !table.length) return octagonsNStepFromValue(value);
  var num = Math.round(Number(value));
  var bestStep = 1;
  var bestDist = Infinity;
  var i;
  for (i = 0; i < table.length; i++) {
    var dist = Math.abs(table[i] - num);
    if (dist < bestDist) {
      bestDist = dist;
      bestStep = i + 1;
    }
  }
  return bestStep;
}

/** Star grid: one step below octagon min, two steps above former star max. */
var OCTAGONS_N_BY_STEP_STAR = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** Circles/diamonds: one odd step below former min, five above former max. */
var OCTAGONS_N_BY_STEP_CIRCLES = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23];

/** Corner cut: t = side / (2 + sqrt(2)) */
var CUT_RATIO = 1 / (2 + Math.SQRT2);

/**
 * Inner diamond + connector scale (octagon grid).
 * Star grid: same slider drives middle-star pinwheel (min = max skew, max = symmetric).
 */
var INNER_SCALE_MIN = 0.3;
var INNER_SCALE_MAX = 1.0;
var INNER_SCALE_DEFAULT = INNER_SCALE_MAX;
/** UI shows steps 1–10; grid still uses INNER_SCALE_MIN–MAX internally. */
var INNER_SCALE_STEPS = 10;

/**
 * @param {number} stepNumber 1 = min scale, INNER_SCALE_STEPS = max scale
 * @returns {number}
 */
function innerScaleValueFromStep(stepNumber) {
  var steps =
    typeof INNER_SCALE_STEPS !== "undefined" ? INNER_SCALE_STEPS : 10;
  var min = typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
  var max = typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
  var idx = Math.round(Number(stepNumber)) - 1;
  if (!isFinite(idx)) idx = steps - 1;
  if (idx < 0) idx = 0;
  if (idx > steps - 1) idx = steps - 1;
  if (steps < 2) return max;
  return min + (idx / (steps - 1)) * (max - min);
}

/**
 * @param {number} value internal scale (INNER_SCALE_MIN–MAX)
 * @returns {number} step 1–INNER_SCALE_STEPS
 */
function innerScaleStepFromValue(value) {
  var steps =
    typeof INNER_SCALE_STEPS !== "undefined" ? INNER_SCALE_STEPS : 10;
  var min = typeof INNER_SCALE_MIN !== "undefined" ? INNER_SCALE_MIN : 0.3;
  var max = typeof INNER_SCALE_MAX !== "undefined" ? INNER_SCALE_MAX : 1;
  var span = max - min;
  if (span < 1e-9) return steps;
  var idx = Math.round(((Number(value) - min) / span) * (steps - 1));
  return Math.max(1, Math.min(steps, idx + 1));
}

/** Hope merge mode: cursor must pass within this many screen px of an edge */
var EDGE_HIT_THRESHOLD_PX = 5;

/**
 * Auto Merge: 8 discrete steps (0–7). 0 = off; steps 1–7 → exactly 2–8 merged areas.
 * Edge budget scales with step so higher steps produce larger regions.
 */
var AUTO_MERGE_INTENSITY_MIN = 0;
var AUTO_MERGE_INTENSITY_MAX = 7;
var AUTO_MERGE_INTENSITY_DEFAULT = 0;
var AUTO_MERGE_INTENSITY_STEPS = 8;
var AUTO_MERGE_AREA_COUNT_AT_MIN = 2;
var AUTO_MERGE_AREA_COUNT_AT_MAX = 8;
var AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MIN = 4;
var AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MIN = 7;
var AUTO_MERGE_EDGES_PER_AREA_MIN_AT_MAX = 7;
var AUTO_MERGE_EDGES_PER_AREA_MAX_AT_MAX = 16;
/** Extra seed tries per target area when forming clusters */
var AUTO_MERGE_SEED_ATTEMPTS_PER_AREA = 12;
/** Inset from grid content bounds when placing random seeds (px) */
var AUTO_MERGE_SEED_BOUNDS_INSET_PX = 40;
/** Connected auto-merge regions: neon outline + cast shadow (left + down) */
var AUTO_MERGE_OUTLINE_COLOR = "#3c06a7";
/** Outline stroke = grid stroke × this multiplier */
var AUTO_MERGE_OUTLINE_WIDTH_GRID_MULTIPLIER = 3;
var AUTO_MERGE_SHADOW_COLOR = "#ff3c3c";
/** Softens cast shadow (direction still from offset below) */
var AUTO_MERGE_SHADOW_BLUR_PX = 8;
/** Negative dx = shadow to the left; positive dy = shadow downward */
var AUTO_MERGE_SHADOW_OFFSET_X_PX = -5;
var AUTO_MERGE_SHADOW_OFFSET_Y_PX = 5;
var AUTO_MERGE_SHADOW_OPACITY = 0.9;
var AUTO_MERGE_SHADOW_FILTER_ID = "auto-merge-region-shadow";

/** Feelings sidebar sliders: discrete positions between each control's min and max */
var FEELINGS_SLIDER_STEPS = 5;

/**
 * @param {number} stepNumber 1 = min (0 marks), FEELINGS_SLIDER_STEPS = max marks
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function feelingsValueFromStep(stepNumber, min, max) {
  var steps =
    typeof FEELINGS_SLIDER_STEPS !== "undefined" ? FEELINGS_SLIDER_STEPS : 10;
  var idx = Math.round(Number(stepNumber)) - 1;
  if (!isFinite(idx)) idx = 0;
  if (idx < 0) idx = 0;
  if (idx >= steps - 1) return max;
  if (steps < 2) return min;
  var stepSize = (max - min) / (steps - 1);
  return min + idx * stepSize;
}

/**
 * @param {number} value internal slider value (min–max)
 * @param {number} min
 * @param {number} max
 * @returns {number} step 1–FEELINGS_SLIDER_STEPS
 */
function feelingsStepFromValue(value, min, max) {
  var steps =
    typeof FEELINGS_SLIDER_STEPS !== "undefined" ? FEELINGS_SLIDER_STEPS : 10;
  if (steps < 2) return 1;
  var num = Number(value);
  if (num <= min) return 1;
  if (num >= max) return steps;
  var stepSize = (max - min) / (steps - 1);
  var idx = Math.round((num - min) / stepSize);
  if (idx < 0) idx = 0;
  if (idx > steps - 1) idx = steps - 1;
  return idx + 1;
}

/**
 * @param {number} step
 * @returns {number}
 */
function clampFeelingsStepNumber(step) {
  var steps =
    typeof FEELINGS_SLIDER_STEPS !== "undefined" ? FEELINGS_SLIDER_STEPS : 10;
  var n = Math.round(Number(step));
  if (!isFinite(n)) return 1;
  if (n < 1) return 1;
  if (n > steps) return steps;
  return n;
}

/**
 * @param {number} raw
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function snapFeelingsSliderValue(raw, min, max) {
  return feelingsValueFromStep(feelingsStepFromValue(raw, min, max), min, max);
}

/** Random circles in upright squares (% of all upright squares on canvas) */
var CIRCLE_DENSITY_MIN = 0;
var CIRCLE_DENSITY_MAX = 30;
var CIRCLE_DENSITY_DEFAULT = 0;

/** Strength / Power: circle-in-square marks (% of junction catalog on canvas) */
var STRENGTH_DENSITY_MIN = CIRCLE_DENSITY_MIN;
var STRENGTH_DENSITY_MAX = CIRCLE_DENSITY_MAX;
var STRENGTH_DENSITY_DEFAULT = CIRCLE_DENSITY_DEFAULT;

/** Left/right horizontal divisions inset from grid border (top and bottom), px */
var BORDER_SIDE_DIVISION_INSET_PX = 30;
/** Filled dots at border-frame grid line crossings (diameter, px) */
var BORDER_DIVISION_JUNCTION_CIRCLE_DIAMETER_PX = 5;
/** Overlap (px) to hide anti-aliasing gaps at 1 cm frame + division cell seams */
var BORDER_FRAME_SEAM_BLEED_PX = 1;

/** Inset frame overlay inside grid content bounds (px from grid frame edges) */
var GRID_FRAME_INSET_OVERLAY_HORIZONTAL_PX = 90;
var GRID_FRAME_INSET_OVERLAY_VERTICAL_PX = 150;
/** Extra nudge of top/bottom horizontal lines from symmetric vertical inset */
var GRID_FRAME_INSET_OVERLAY_TOP_SHIFT_DOWN_PX = 125;
var GRID_FRAME_INSET_OVERLAY_BOTTOM_SHIFT_UP_PX = 75;
var GRID_FRAME_INSET_OVERLAY_STROKE_WIDTH = 5;
/** Caps at top of each overlay vertical (width × length, px) */
var GRID_FRAME_INSET_OVERLAY_CAP_RECT_WIDTH = 15;
var GRID_FRAME_INSET_OVERLAY_CAP_RECT_LENGTH = 50;
/** Gap from cap inner edge (canvas side) to nearest ellipse edge (px) */
var GRID_FRAME_INSET_OVERLAY_CAP_ELLIPSE_INSET_PX = 30;
var GRID_FRAME_INSET_OVERLAY_CAP_ELLIPSE_RX = 7;
var GRID_FRAME_INSET_OVERLAY_CAP_ELLIPSE_RY = 12;

/** Left/right white margin strip horizontal divisions (3-step slider) */
var BORDER_LEFT_RIGHT_SEGMENTS_LOW = 6;
var BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT = 12;
var BORDER_LEFT_RIGHT_SEGMENTS_HIGH = 20;
/** Random height weights per margin row (normalized to fill strip) */
var BORDER_SIDE_SEGMENT_HEIGHT_MIN_RATIO = 0.18;
var BORDER_SIDE_SEGMENT_HEIGHT_MAX_RATIO = 1.4;
/** >1 skews weights toward extremes (thinner + taller rows) */
var BORDER_SIDE_SEGMENT_HEIGHT_RANDOM_POWER = 2.2;

/** Border margin white-out (0 = all color, 100 = cap % white) */
var BORDER_SIDE_WHITE_FILL_MIN = 0;
var BORDER_SIDE_WHITE_FILL_MAX = 100;
var BORDER_SIDE_WHITE_FILL_DEFAULT = 0;
/** Discrete positions on the slider (0, 25, 50, 75, 100) */
var BORDER_SIDE_WHITE_FILL_STEPS = 5;
/** At slider maximum, this fraction of margin division cells are painted white */
var BORDER_SIDE_WHITE_CAP_PERCENT = 50;
/** Color-fade empty margin cells: stipple dot diameter (px) */
var BORDER_FRAME_EMPTY_CELL_DOT_SIZE = 2;
/** Color-fade empty margin cells: min gap between dot edges (px) */
var BORDER_FRAME_EMPTY_CELL_DOT_SPACING = 2;

/** Fan geometry variant: original (cusp petals) or radial (base line + arc + ribs) */
var FAN_TYPE_ORIGINAL = "original";
var FAN_TYPE_RADIAL = "radial";
var FAN_TYPE_DEFAULT = "radial";
/** Radial fan: outer arc scale (slider 70–100 → 0.7×–1× base radius; base line stays fixed) */
var RADIAL_FAN_OUTER_ARC_SCALE_MIN = 0.7;
var RADIAL_FAN_OUTER_ARC_SCALE_MAX = 1;
var RADIAL_FAN_OUTER_ARC_SCALE_DEFAULT = 1;
/** Radial fan: inner arcs in a tight band near the focal center */
var RADIAL_FAN_INNER_ARC_COUNT = 6;
/** +1 arc inset by RADIAL_FAN_INNER_ARC_STEP_PX from the outer frame arc */
var RADIAL_FAN_FRAME_ADJACENT_INNER_ARC = true;
/** +1 arc inward from frame-adjacent arc: step × this multiplier (4 = 2× gap between arcs 7–8) */
var RADIAL_FAN_FRAME_INWARD_ARC = true;
var RADIAL_FAN_FRAME_INWARD_ARC_STEP_MULTIPLIER = 4;
/** Scales Arc position toward center (0.72 × 50% slider ≈ 36% of fan radius) */
var RADIAL_FAN_INNER_ARC_INWARD_SCALE = 0.72;
/** Fixed px gap between consecutive inner arcs and from outer frame (scaled by HALF_CIRCLE_RADIUS_SCALE in app) */
var RADIAL_FAN_INNER_ARC_STEP_PX = 11;
/** Radial fan stroke width (px); original fan uses HALF_CIRCLE_FAN_STROKE_WIDTH in app.js */
var RADIAL_FAN_STROKE_WIDTH = 2;
/** Mirrored diagonals on 6th inner arc: start corner rib index 1, outer end at 3rd rib (index 2) */
var RADIAL_FAN_SIXTH_ARC_DIAGONAL_ARC_INDEX = 5;
var RADIAL_FAN_SIXTH_ARC_DIAGONAL_START_CORNER_RIB_INDEX = 1;
var RADIAL_FAN_SIXTH_ARC_DIAGONAL_END_RIB_INDEX = 2;
/** Base diagonals: outer-arc ends are computed so both lines meet at the middle third-arc ring center. */
/** Middle-rib band: 2 cells per pair, 1 empty cell between pairs. */
var RADIAL_FAN_MIDDLE_BAND_FILL_GAP_CELLS = 1;
/** Omit the 2nd triangle-pair from the fan start (left) and end (right). */
var RADIAL_FAN_MIDDLE_BAND_TRIM_SECOND_PAIR_FROM_START = true;
var RADIAL_FAN_MIDDLE_BAND_TRIM_SECOND_PAIR_FROM_END = true;
/** End-cap diagonal: almost-outer arc at outer rib → middle arc at inner rib (offsets from each fan end). */
var RADIAL_FAN_MIDDLE_BAND_END_CAP_DIAG_OUTER_RIB_FROM_END = 8;
var RADIAL_FAN_MIDDLE_BAND_END_CAP_DIAG_INNER_RIB_FROM_END = 7;
/** Outermost end-cap: last/first drawable rib → adjacent rib (1-based offset from each fan end; matches FAN_END_SECTOR_TRIM). */
var RADIAL_FAN_MIDDLE_BAND_OUTERMOST_CAP_DIAG_OUTER_RIB_FROM_END = 1;
var RADIAL_FAN_MIDDLE_BAND_OUTERMOST_CAP_DIAG_INNER_RIB_FROM_END = 2;
/** Middle-band right-angle triangle stipple: dot diameter (px) */
var RADIAL_FAN_MIDDLE_BAND_DOT_SIZE = 2;
/** Middle-band right-angle triangle stipple: min gap between dot edges (px) */
var RADIAL_FAN_MIDDLE_BAND_DOT_SPACING = 2;
/** Center-zone diagonals: outer rib top → inner arc at adjacent rib (offsets from middle rib). */
var RADIAL_FAN_CENTER_DIAG_1_START_RIB_OFFSET = 2;
var RADIAL_FAN_CENTER_DIAG_1_END_RIB_OFFSET = 1;
var RADIAL_FAN_CENTER_DIAG_2_START_RIB_OFFSET = -2;
var RADIAL_FAN_CENTER_DIAG_2_END_RIB_OFFSET = -1;
/** Ribs from focal center to outer arc (equal angular spacing across the semicircle) */
var RADIAL_FAN_RIB_COUNT = 25;
/** Rings seated on the 3rd inner arc: count, radius (px), arc index (0-based) */
var RADIAL_FAN_THIRD_ARC_RING_COUNT = 5;
var RADIAL_FAN_THIRD_ARC_RING_RADIUS = 44;
var RADIAL_FAN_THIRD_ARC_RING_ARC_INDEX = 2;
/** Concentric rings per seat: large + medium + small (equal radial gaps) */
var RADIAL_FAN_THIRD_ARC_NESTED_RING_COUNT = 3;
/** Radial slice lines per large ring set (pizza-style equal sectors) */
var RADIAL_FAN_THIRD_ARC_RING_SLICE_COUNT = 16;
/** Min angular gap between ring centers = no-touch × this margin (prevents overlap) */
var RADIAL_FAN_THIRD_ARC_RING_GAP_MARGIN = 1.2;
/** Extra inset for outermost rings from fan edges (fraction of safe arc span) */
var RADIAL_FAN_THIRD_ARC_RING_EDGE_MARGIN_RATIO = 0.08;
/** Elevated rings between base pairs 1–2 and 4–5 (1-based): scale, edge clearance from neighbors (px) */
var RADIAL_FAN_ELEVATED_RING_SCALE = 1.2;
var RADIAL_FAN_ELEVATED_RING_GAP_PX = 8;
/** Elevated rings: omit innermost circle only; medium + large keep 3-ring spacing */
var RADIAL_FAN_ELEVATED_NESTED_RING_COUNT = 2;
/** Large elevated rings sit between these ribs (1-based from each fan end; outer < inner). */
var RADIAL_FAN_ELEVATED_RING_OUTER_RIB_FROM_END = 4;
var RADIAL_FAN_ELEVATED_RING_INNER_RIB_FROM_END = 7;
/** Base row (5 rings): each spans 5 ribs; rings 2 and 4 flank the center ring. */
var RADIAL_FAN_BASE_ROW_END_OUTER_RIB_FROM_END = 1;
var RADIAL_FAN_BASE_ROW_END_INNER_RIB_FROM_END = 5;
var RADIAL_FAN_BASE_ROW_START_OUTER_RIB = 1;
var RADIAL_FAN_BASE_ROW_START_INNER_RIB = 5;
var RADIAL_FAN_BASE_ROW_MIDDLE_RIB_OFFSET_OUTER = 2;
var RADIAL_FAN_BASE_ROW_MIDDLE_RIB_OFFSET_INNER = 2;
/** Ring 2 (left of center): midIdx − these offsets → shares boundary rib with center. */
var RADIAL_FAN_BASE_ROW_LEFT_INNER_RIB_OFFSET_OUTER = 6;
var RADIAL_FAN_BASE_ROW_LEFT_INNER_RIB_OFFSET_INNER = 2;
/** Ring 4 (right of center): midIdx + these offsets → shares boundary rib with center. */
var RADIAL_FAN_BASE_ROW_RIGHT_INNER_RIB_OFFSET_OUTER = 2;
var RADIAL_FAN_BASE_ROW_RIGHT_INNER_RIB_OFFSET_INNER = 6;

/** Sectors omitted at each fan end (between rib 1–2 and the last rib pair); angles the base */
var FAN_END_SECTOR_TRIM_COUNT = 1;

/** Body autonomy: shared fan opening (both manifolds), discrete steps (0 = open, 10 = closed) */
var WEAR_CONTROL_OPENING_STEP_MIN = 0;
var WEAR_CONTROL_OPENING_STEP_MAX = 10;
var WEAR_CONTROL_OPENING_STEP_DEFAULT = 0;
/** Penultimate slider step: this many drawable ribs remain before fully closed. */
var FAN_CLOSING_MIN_RIBS = 4;

/** Shared fan tuning: inner arc radius as % of fan radius */
var FAN_INNER_ARC_PERCENT_MIN = 20;
var FAN_INNER_ARC_PERCENT_MAX = 80;
var FAN_INNER_ARC_PERCENT_DEFAULT = 50;
/** Shared fan tuning: star inner radius as % of valley circle radius */
var FAN_STAR_INNER_PERCENT_MIN = 50;
var FAN_STAR_INNER_PERCENT_MAX = 95;
var FAN_STAR_INNER_PERCENT_DEFAULT = 75;
/** Shared fan tuning: offset (px) from inner arc pair to second arc pair (fills + diagonals) */
var FAN_OUTSIDE_EXTRA_ARC_GAP_MIN = 0;
var FAN_OUTSIDE_EXTRA_ARC_GAP_MAX = 80;
var FAN_OUTSIDE_EXTRA_ARC_GAP_DEFAULT = 24;
/** Shared fan tuning: inner leaf size (width + length), 0 = small/narrow, 100 = large/wide */
var FAN_LEAF_SIZE_MIN = 0;
var FAN_LEAF_SIZE_MAX = 100;
var FAN_LEAF_SIZE_DEFAULT = 90;
var FAN_LEAF_INSET_AT_MIN = 0.28;
var FAN_LEAF_INSET_AT_MAX = 0.02;
var FAN_LEAF_TIP_ARC_AT_MIN = 0.48;
var FAN_LEAF_TIP_ARC_AT_MAX = 0.85;
var FAN_LEAF_LENGTH_SCALE_AT_MIN = 0.58;
var FAN_LEAF_LENGTH_SCALE_AT_MAX = 1;
/** Star tips per valley circle: 5 → 10-vertex outline; 4 → 8-vertex outline */
var FAN_TOP_STAR_POINT_COUNT = 5;
var FAN_BOTTOM_STAR_POINT_COUNT = 5;
/** Alternating fills in left/right margin cells (top cell = brown) */
var BORDER_SIDE_CELL_COLOR_BROWN = "#685450";
/** Was blue (#a5bcc0); default RGB(255, 60, 60) — same as diamond fill */
var BORDER_SIDE_CELL_COLOR_BLUE = "#ff3c3c";

/** Four triangles inside the X on each brown margin cell */
var BORDER_SIDE_X_FILL_TOP = "#655551";
var BORDER_SIDE_X_FILL_LEFT = "#655551";
var BORDER_SIDE_X_FILL_RIGHT = "#eb4f46";
var BORDER_SIDE_X_FILL_BOTTOM = "#3c06a7";

/** Blue margin cell X: top/bottom blue, left/right brown */
var BORDER_SIDE_BLUE_X_FILL_TOP = BORDER_SIDE_CELL_COLOR_BLUE;
var BORDER_SIDE_BLUE_X_FILL_BOTTOM = BORDER_SIDE_CELL_COLOR_BLUE;
var BORDER_SIDE_BLUE_X_FILL_LEFT = BORDER_SIDE_CELL_COLOR_BROWN;
var BORDER_SIDE_BLUE_X_FILL_RIGHT = BORDER_SIDE_CELL_COLOR_BROWN;

/** Empty margin row between home and outside (solid, no X) */
var BORDER_SIDE_CELL_COLOR_GREY = "#f7cecd";
/** Empty margin row after outside */
var BORDER_SIDE_CELL_COLOR_BEIGE = "#655551";

/** Default fill for pride diamonds — #FF3C3C */
var DIAMOND_FILL_COLOR_DEFAULT = "#ff3c3c";

/** Pride: filled inner diamonds (% of diamond catalog on canvas) */
var PRIDE_FILL_PERCENT_MIN = 0;
var PRIDE_FILL_PERCENT_MAX = 30;
var PRIDE_FILL_PERCENT_DEFAULT = 0;

/** Guilt / Shame: hollow junction diamonds (% of diamond catalog on canvas) */
var GUILT_SHAME_FILL_PERCENT_MIN = 0;
var GUILT_SHAME_FILL_PERCENT_MAX = 30;
var GUILT_SHAME_FILL_PERCENT_DEFAULT = 0;
/** Inner hole scale relative to outer diamond (0.5 = half size) */
var GUILT_SHAME_INNER_DIAMOND_SCALE = 0.5;
var GUILT_SHAME_DIAMOND_FILL_COLOR_DEFAULT = "#ff3c3c";

/** Helplessness: X marks at inner-diagonal crossings in each octagon cell (% of catalog) */
var HELPLESSNESS_PERCENT_MIN = 0;
var HELPLESSNESS_PERCENT_MAX = 30;
var HELPLESSNESS_PERCENT_DEFAULT = 0;
var HELPLESSNESS_SHUFFLE_SEED = 847293;
var HELPLESSNESS_STROKE_WIDTH = 3;

/** Anger: upper-half triangle in junction diamonds (% of diamond catalog on canvas) */
var ANGER_TRIANGLE_DENSITY_MIN = 0;
var ANGER_TRIANGLE_DENSITY_MAX = 30;
var ANGER_TRIANGLE_DENSITY_DEFAULT = 0;
var ANGER_TRIANGLE_SHUFFLE_SEED = 391827;

/** Fear slider (anger-vertical-length id): visible length of vertical grid lines (% of full span) */
var ANGER_VERTICAL_LENGTH_MIN = 0;
var ANGER_VERTICAL_LENGTH_MAX = 30;
var ANGER_VERTICAL_LENGTH_DEFAULT = 0;
/** At slider 0%, line span = this × the previous minimum (0.5 = 2× shorter than before) */
var ANGER_VERTICAL_LENGTH_MIN_SPAN_RATIO = 0.5;

/** Anxiety slider: fear vertical line stroke (0–100 maps min → max px) */
var ANXIETY_VERTICAL_STROKE_MIN = 0;
var ANXIETY_VERTICAL_STROKE_MAX = 100;
/** ~17% ≈ 3 px at default grid weight (2×1 … 8 px), matching prior 3× grid stroke */
var ANXIETY_VERTICAL_STROKE_DEFAULT = 0;
var ANXIETY_VERTICAL_STROKE_MAX_PX = 8;
var ANXIETY_VERTICAL_STROKE_GRID_MULT_MIN = 2;

/** Star grid (nested-star-octagons.html): minimum tile size in px */
var NESTED_STAR_TILE_MIN = 40;
var NESTED_STAR_CUT_RATIO = 1 / (2 + Math.SQRT2);
var NESTED_STAR_INNER_STAR_MIN_T = 6;
var NESTED_STAR_STROKE_WIDTH = 1;
/** Star grid Strength square: half-side from dual-square geometry (see starGridJunctionStrengthHalfSide) */
var NESTED_STAR_STRENGTH_SQUARE_USE_TILE_CUT = true;

/** Main app grid type (index.html) */
var GRID_TYPE_OCTAGON = "octagon";
var GRID_TYPE_STAR = "star";
var GRID_TYPE_CIRCLES = "circles";
var GRID_TYPE_DIAMONDS = "diamonds";
/** Circles grid: rotated diamond half-side as fraction of cell size */
var CIRCLES_GRID_CELL_DIAMOND_HALF_RATIO = 0.35;
/** Circles grid: helplessness X half-extent as fraction of cell size */
var CIRCLES_GRID_HELPLESS_HALF_RATIO = 0.3;
/** Circles grid: filled dots at each structural circle frame corner (diameter, px) */
var CIRCLES_GRID_FRAME_JUNCTION_DOT_DIAMETER_PX = 5;
/** Circles grid: density slider steps by 2 fine cells (one full 2×2 circle column) */
var CIRCLES_GRID_N_STEP = 2;
/** Least-dense circles grid: minimum structural circles per row (each spans 2 cell columns) */
var CIRCLES_GRID_MIN_CIRCLE_COLUMNS = 3;
/** Fine-cell n at minimum density: 2 × circle columns − 1 */
var CIRCLES_GRID_N_MIN =
  2 * CIRCLES_GRID_MIN_CIRCLE_COLUMNS - 1;
/** Circles/diamonds density slider table max (odd n) */
var CIRCLES_GRID_N_MAX = 23;
/** Circles grid only: Helplessness, Longing, Grief, Strength slider cap (%) */
var CIRCLES_GRID_JUNCTION_EMOTION_DENSITY_MAX = 20;
/** Circles grid only: anger triangles / pain diamonds / guilt-shame diamonds slider cap (%) */
var CIRCLES_GRID_ANGER_TRIANGLE_DENSITY_MAX = 50;
var CIRCLES_GRID_PRIDE_FILL_PERCENT_MAX = 50;
var CIRCLES_GRID_GUILT_SHAME_FILL_PERCENT_MAX = 50;
/** Pride circles grid: keep merged fills that span at least this many structural circles */
var CIRCLES_GRID_PRIDE_MIN_CIRCLES_INSIDE = 2;
/** Reference density for Pride area compensation on circles grid */
var CIRCLES_GRID_PRIDE_REFERENCE_N = CIRCLES_GRID_N_MIN;
/** Pride circles grid: ellipse outline segments in tessellation (chord count) */
var CIRCLES_GRID_PRIDE_ELLIPSE_ARC_STEPS = 16;
/** Pride circles grid: samples per rounded exterior quarter-circle corner (shadow only) */
var CIRCLES_GRID_PRIDE_CORNER_ARC_STEPS = 6;
/** Pride circles grid: tolerance for matching outline edges to structural ellipses */
var CIRCLES_GRID_PRIDE_ELLIPSE_EDGE_EPS = 0.12;
/** Pride circles grid: shadow polygon samples along each smooth arc segment */
var CIRCLES_GRID_PRIDE_SHADOW_ARC_STEPS = 24;
/**
 * Pride tessellation inner-scale cap — at slider max (1) the mesh still needs
 * corner cells, so Pride uses a slightly lower effective inner scale.
 */
var CIRCLES_GRID_PRIDE_TESSELLATION_INNER_SCALE_MAX = 0.92;
/** Star grid only: max value on “Iranian community” density slider (octagons-n) */
var STAR_GRID_OCTAGONS_N_MAX = 11;
/** Hope merge cutouts: ignore micro-faces smaller than this × tileSize² */
var STAR_GRID_HOPE_MERGE_MIN_AREA_TILE_FRACTION = 0.45;
/** Octagon Hope merge: min stipple hole area (× tileSize²); lower → finer, more intricate shapes */
var OCTAGON_HOPE_MERGE_MIN_AREA_TILE_FRACTION = 0.18;
/** Circles Hope merge: min stipple hole area (× tileSize²); lower → quarter/half sectors */
var CIRCLES_GRID_HOPE_MERGE_MIN_AREA_TILE_FRACTION = 0.18;
/**
 * Circles Hope merge: reject single-circle holes at/above this × tileSize² — dangling
 * prune false positives (~0.75× tile² per block from runtime tessellation).
 */
var CIRCLES_GRID_HOPE_SINGLE_BLOCK_MAX_AREA_TILE_FRACTION = 0.75;
/**
 * Pride on star grid uses coarse octagon+square mesh (see getSegmentsForPrideAutoMerge).
 * Edge budget matches octagon grid; no extra multiplier needed.
 */
var STAR_GRID_AUTO_MERGE_EDGE_MULTIPLIER = 1;
/** Inner scale for coarse pride tessellation (1 = octagon + square cells only). */
var STAR_GRID_PRIDE_COARSE_INNER_SCALE = 1;
/** Pride star grid: keep merged fills that span at least this many star cells */
var STAR_GRID_PRIDE_MIN_STARS_INSIDE = 2;
/**
 * Pride auto-merge: denser grid → larger merged clusters so canvas fill area
 * stays proportional to the reference (sparse) density.
 */
var PRIDE_AUTO_MERGE_REFERENCE_N_OCTAGON = OCTAGONS_N_DEFAULT;
/** Edge budget scale ~ (refTile / currentTile)^exp; 2 = px² area compensation */
var PRIDE_AUTO_MERGE_DENSITY_AREA_EXPONENT = 2;
/** Cap edge-budget scale on very dense grids (performance guard) */
var PRIDE_AUTO_MERGE_DENSITY_AREA_SCALE_MAX = 8;
/** refTile/currentTile at/above this → fast simple merge path (no prune/orphans) */
var PRIDE_AUTO_MERGE_SIMPLE_MODE_DENSITY_RATIO = 3;
/** Octagon grid only: Pride auto-merge edge budget scale (0.85 ≈ 15% smaller regions). */
/** Octagon grid: switch to coarse Pride auto-merge at moderate density (step ~9+). */
var OCTAGON_GRID_PRIDE_SIMPLE_MODE_DENSITY_RATIO = 1.5;
var OCTAGON_GRID_PRIDE_EDGE_SCALE = 0.85;
/** Octagon grid + low inner-scale: min Hope stipple region area (× tileSize²) */
var HOPE_LOW_INNER_SCALE_MIN_AREA_TILE_FRACTION = 1.5;
/** Default stipple dot fill (Hope layer) */
var HOPE_DOTS_COLOR_DEFAULT = "#3c06a7";

/**
 * Full project palette (14 colors). Each session picks COLOR_PALETTE_PICK_COUNT
 * at random; canvas items are tinted from that active subset only.
 */
var COLOR_PALETTE = [
  "#26CCB9",
  "#FFEFF7",
  "#264D3A",
  "#FFC9E2",
  "#4D37E3",
  "#000000",
  "#FF80FF",
  "#B2FF00",
  "#FF0004",
  "#5C26D9",
  "#685450",
  "#FFFF00",
  "#FFFFFF",
  "#FFFCE8",
];
var COLOR_PALETTE_PICK_COUNT = 5;

/** Sheet palette on first load and pre-selected in the questionnaire (1–12). */
var DEFAULT_SHEET_PALETTE_NUM = 3;

/** Default 5-color session shown on first load (Active palette row). */
var DEFAULT_ACTIVE_PALETTE = [
  "#fffce8",
  "#ff3c3c",
  "#685450",
  "#b2ff00",
  "#ffc9e2",
];

/** Default role colors on first load (matches Colors & export pickers). */
var DEFAULT_COLOR_ASSIGNMENTS = {
  canvasBackground: "#fffce8",
  patternStroke: "#ff3c3c",
  diamondFill: "#ff3c3c",
  labelBarBackground: "#685450",
  labelBarContent: "#b2ff00",
  borderSideGrey: "#f7cecd",
  borderSideBeige: "#655551",
  borderSideXTop: "#655551",
  borderSideXLeft: "#655551",
  borderSideXRight: "#eb4f46",
  borderSideXBottom: "#3c06a7",
};

/** Logical print canvas: 70cm × 180cm at 300 DPI */
var CANVAS_W = 827;
var CANVAS_H = 2126;

/** White margin ring area as a fraction of full canvas area (symmetric sides) */
var CANVAS_BORDER_AREA_RATIO = 0.15;

/** Outline between grid and white margin (stroke color = pattern color) */
var GRID_BOUNDARY_STROKE_WIDTH = 5;

/** Layout margins (CSS px) around scaled canvas */
var VIEW_MARGIN = 24;

/** Grid + circle stroke (shared color picker) — RGB(104, 84, 80) */
var PATTERN_STROKE_COLOR_DEFAULT = "#685450";
/** Sadness circles fill (color picker default) */
var CIRCLE_FILL_COLOR_DEFAULT = "#ffffff";
var GRID_STROKE_WIDTH_MIN = 1;
var GRID_STROKE_WIDTH_MAX = 3;
var GRID_STROKE_WIDTH_DEFAULT = 1;
/** Canvas background (color picker default) */
var CANVAS_BACKGROUND_COLOR_DEFAULT = "#ffffff";
var BG_COLOR = CANVAS_BACKGROUND_COLOR_DEFAULT;

/**
 * Full-width brown bars on top/bottom side-frame division edges.
 * Bottom bar is canonical; top bar mirrors bottom vertically (flip Y).
 */
var CANVAS_EDGE_BROWN_BAR_HEIGHT_PX = 100;
/** Length toward canvas top/bottom past division line (inner edge stays on divY) */
var CANVAS_EDGE_BROWN_BAR_OUTWARD_EXTEND_PX = 20;
var CANVAS_EDGE_BROWN_BAR_COLOR = "#685450";
/** Label bar background (color picker default) */
var LABEL_BAR_BACKGROUND_COLOR_DEFAULT = CANVAS_EDGE_BROWN_BAR_COLOR;
/** Icons, text, and separators on the label bar (color picker default) */
var LABEL_BAR_CONTENT_COLOR_DEFAULT = "#ffffff";
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
/** Non-highlighted grid cells in outer third (use Label content / pipette color) */
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
  "lion.svg",
  "man.svg",
  "sun.svg",
  "IN IRAN.svg",
  "OUTSIDE IRAN.svg",
  "undercover english.svg",
  "undercover arabic.svg",
  "age.svg",
  "from.svg",
  "now in.svg",
  "barcode.svg",
  "left.svg",
  "women.svg",
  "LOST/man.svg",
  "LOST/2 man.svg",
  "LOST/3 man.svg",
];
/** Natural pixel sizes for label-bar layout (from each SVG viewBox) */
var LABEL_BAR_SVG_DIMENSIONS = {
  "lion.svg": { width: 257.14, height: 186 },
  "man.svg": { width: 89, height: 115 },
  "LOST/man.svg": { width: 89, height: 115 },
  "LOST/2 man.svg": { width: 168, height: 115 },
  "LOST/3 man.svg": { width: 247, height: 115 },
  "sun.svg": { width: 123, height: 136 },
  "IN IRAN.svg": { width: 115, height: 103.73 },
  "OUTSIDE IRAN.svg": { width: 115, height: 106 },
  "undercover english.svg": { width: 215, height: 80 },
  "undercover arabic.svg": { width: 215, height: 80 },
  "age.svg": { width: 60.75, height: 80 },
  "from.svg": { width: 96, height: 85 },
  "now in.svg": { width: 96, height: 85 },
  "barcode.svg": { width: 797, height: 81 },
  "left.svg": { width: 96, height: 85 },
  "women.svg": { width: 55, height: 80 },
};
/** Multi-color or non-tintable SVGs on the label bar (original colors preserved) */
var LABEL_BAR_NATIVE_COLOR_SVGS = [];
/** Profile “Yes” → this sign on the label; “No” → OUTSIDE IRAN */
var LABEL_BAR_LIVING_IN_IRAN_SVG = "IN IRAN.svg";
var LABEL_BAR_LIVING_OUTSIDE_IRAN_SVG = "OUTSIDE IRAN.svg";
/** Row 2: profile From / Now in icons inward from the living-in-Iran sign */
var LABEL_BAR_FROM_SVG = "from.svg";
var LABEL_BAR_NOW_IN_SVG = "now in.svg";
/** Row 2: fixed barcode inward from the Now in location text */
var LABEL_BAR_BARCODE_SVG = "barcode.svg";
var LABEL_BAR_PROFILE_FROM_DEFAULT = "TEHERAN";
var LABEL_BAR_PROFILE_NOW_IN_DEFAULT = "MAINZ";
var LABEL_BAR_PROFILE_LEAVING_YEAR_DEFAULT = "2021";
/** Row 2: left icon + leaving year text (single cluster) */
var LABEL_BAR_LEFT_SVG = "left.svg";
/** Row 2: women icon left of undercover arabic */
var LABEL_BAR_WOMEN_SVG = "women.svg";
/** Fixed wordmarks by the lions */
var LABEL_BAR_LEFT_LION_INNER_ROW1_SVG = "undercover english.svg";
/** Row 1: sun icon (separate cluster, after undercover english in layout order) */
var LABEL_BAR_LEFT_LION_INNER_ROW1_SUN_SVG = "sun.svg";
var LABEL_BAR_AGE_SVG = "age.svg";
/** Fixed caption left of the Age icon (row 1, inward from undercover english) */
var LABEL_BAR_AGE_LABEL_TEXT = "AGE";
/** Circle center in age.svg viewBox (for profile age digits overlay) */
var LABEL_BAR_AGE_CIRCLE_CX = 30.38;
var LABEL_BAR_AGE_CIRCLE_CY = 40;
var LABEL_BAR_AGE_CIRCLE_R = 23.65;
/** Overlay font size as a fraction of circle diameter */
var LABEL_BAR_AGE_OVERLAY_FONT_SIZE_RATIO = 0.58;
var LABEL_BAR_AGE_OVERLAY_FILL = "#ffffff";
/** Nudge age digits down inside the circle (px) */
var LABEL_BAR_AGE_OVERLAY_Y_OFFSET_PX = 1;
var LABEL_BAR_RIGHT_LION_INNER_ROW2_SVG = "undercover arabic.svg";
/** Profile Lost slider → icon inward from the right lion (row 1) */
var LABEL_BAR_LOST_INNER_SVG = "LOST/man.svg";
var LABEL_BAR_LOST_MIDDLE_SVG = "LOST/2 man.svg";
var LABEL_BAR_LOST_DISTANT_SVG = "LOST/3 man.svg";
/** Fixed caption left of the Lost profile icon (row 1, inward from right lion) */
var LABEL_BAR_LOST_LABEL_TEXT = "LOST";
/** Label-bar icons render white on the brown bar */
var LABEL_BAR_ICON_FILL = "#ffffff";
/** Horizontal inset from each bar edge before label items are laid out */
var LABEL_BAR_HORIZONTAL_INSET_PX = 10;
/** Vertical inset above and below label items inside the bar segment */
var LABEL_BAR_VERTICAL_INSET_PX = 10;
/** Gap between row-1 and row-2 label content (split evenly at the segment boundary) */
var LABEL_BAR_ADJACENT_ROW_CONTENT_GAP_PX = 5;
/** Fixed end-cap SVG on both bar edges (center items sit between them) */
var LABEL_BAR_END_CAP_SVG = "lion.svg";
/** End caps span this many brown-bar horizontal rows (segments) from the inner edge */
var LABEL_BAR_END_CAP_ROW_SPAN = 2;
/** Gap between adjacent label-bar symbols (px) */
var LABEL_BAR_ITEM_GAP_PX = 5;
/** Fixed gap between caption text and its symbol inside one label-bar group (px) */
var LABEL_BAR_CLUSTER_INTERNAL_GAP_PX = 10;
/** 5×5 px square inserted between each pair of label-bar SVG symbols */
var LABEL_BAR_SYMBOL_SEPARATOR_SIZE_PX = 5;
var LABEL_BAR_SYMBOL_SEPARATOR_FILL = "#ffffff";
/** Label-bar text fills content height (1 = up to vertical margins) */
var LABEL_BAR_TEXT_FONT_HEIGHT_RATIO = 1;
/** Nudge label-bar text down from cell center (px) */
var LABEL_BAR_TEXT_Y_OFFSET_PX = 3;

/** Random 8-digit serial in white margin above/below brown bars (same number top + bottom) */
var CANVAS_EDGE_SERIAL_EDGE_INSET_PX = 50;
var CANVAS_EDGE_SERIAL_DIGIT_COUNT = 8;
/** Each digit value N → N filled circles in a row (0 → none) */
var CANVAS_EDGE_SERIAL_CIRCLE_GAP_PX = 3;
/** Max circle diameter as fraction of white strip height (capped by slot width) */
var CANVAS_EDGE_SERIAL_CIRCLE_DIAMETER_RATIO = 0.35;
var CANVAS_EDGE_SERIAL_FILL = PATTERN_STROKE_COLOR_DEFAULT;

/** Full octagons per row/column (n); half-octagon on each edge → (n+1) tile widths */
var OCTAGONS_N_MIN = 3;
var OCTAGONS_N_MAX = 15;
var OCTAGONS_N_DEFAULT = 7;

/** Corner cut: t = side / (2 + sqrt(2)) */
var CUT_RATIO = 1 / (2 + Math.SQRT2);

/** Inner diamond + connector unit scale (8-fold grid only) */
var INNER_SCALE_MIN = 0.3;
var INNER_SCALE_MAX = 1.0;
var INNER_SCALE_DEFAULT = 1.0;

/** Merge mode: cursor must pass within this many screen px of an edge */
var EDGE_HIT_THRESHOLD_PX = 5;

/**
 * Auto Merge intensity slider (0 = minimum coverage, 100 = maximum).
 * Low %: 1 area, small merges (4–7 edges). High %: up to 8 areas, richer merges (7–16 edges).
 * Area count rises with the slider; edge minimum stays achievable so clusters do not fail.
 */
var AUTO_MERGE_INTENSITY_MIN = 0;
var AUTO_MERGE_INTENSITY_MAX = 100;
var AUTO_MERGE_INTENSITY_DEFAULT = 70;
var AUTO_MERGE_AREA_COUNT_AT_MIN = 1;
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
var AUTO_MERGE_OUTLINE_COLOR = "#B2FF00";
/** Outline stroke = grid stroke × this multiplier */
var AUTO_MERGE_OUTLINE_WIDTH_GRID_MULTIPLIER = 3;
var AUTO_MERGE_SHADOW_COLOR = "#685450";
/** Softens cast shadow (direction still from offset below) */
var AUTO_MERGE_SHADOW_BLUR_PX = 4;
/** Negative dx = shadow to the left; positive dy = shadow downward */
var AUTO_MERGE_SHADOW_OFFSET_X_PX = -5;
var AUTO_MERGE_SHADOW_OFFSET_Y_PX = 5;
var AUTO_MERGE_SHADOW_OPACITY = 0.9;
var AUTO_MERGE_SHADOW_FILTER_ID = "auto-merge-region-shadow";

/** Random circles in upright squares (% of all upright squares on canvas) */
var CIRCLE_DENSITY_MIN = 10;
var CIRCLE_DENSITY_MAX = 40;
var CIRCLE_DENSITY_DEFAULT = 25;

/** Left/right horizontal divisions inset from grid border (top and bottom), px */
var BORDER_SIDE_DIVISION_INSET_PX = 30;

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

/** Left/right white margin strip horizontal divisions (segment count) */
var BORDER_LEFT_RIGHT_SEGMENTS_MIN = 12;
var BORDER_LEFT_RIGHT_SEGMENTS_MAX = 24;
var BORDER_LEFT_RIGHT_SEGMENTS_DEFAULT = 12;
/** Random height weights per margin row (normalized to fill strip) */
var BORDER_SIDE_SEGMENT_HEIGHT_MIN_RATIO = 0.05;
var BORDER_SIDE_SEGMENT_HEIGHT_MAX_RATIO = 1.4;
/** >1 skews weights toward extremes (thinner + taller rows) */
var BORDER_SIDE_SEGMENT_HEIGHT_RANDOM_POWER = 2.2;

/** Alternating fills in left/right margin cells (top cell = brown) */
var BORDER_SIDE_CELL_COLOR_BROWN = "#685450";
/** Was blue (#a5bcc0); default RGB(255, 60, 60) — same as diamond fill */
var BORDER_SIDE_CELL_COLOR_BLUE = "#ff3c3c";

/** Four triangles inside the X on each brown margin cell */
var BORDER_SIDE_X_FILL_TOP = "#685450";
var BORDER_SIDE_X_FILL_LEFT = "#ff3c3c";
var BORDER_SIDE_X_FILL_RIGHT = "#fdfae3";
var BORDER_SIDE_X_FILL_BOTTOM = "#d9d9d9";

/** Blue margin cell X: top/bottom blue, left/right brown */
var BORDER_SIDE_BLUE_X_FILL_TOP = BORDER_SIDE_CELL_COLOR_BLUE;
var BORDER_SIDE_BLUE_X_FILL_BOTTOM = BORDER_SIDE_CELL_COLOR_BLUE;
var BORDER_SIDE_BLUE_X_FILL_LEFT = BORDER_SIDE_CELL_COLOR_BROWN;
var BORDER_SIDE_BLUE_X_FILL_RIGHT = BORDER_SIDE_CELL_COLOR_BROWN;

/** Empty margin row between home and outside (solid, no X) */
var BORDER_SIDE_CELL_COLOR_GREY = "#d9d9d9";
/** Empty margin row after outside — same as outside X right triangle */
var BORDER_SIDE_CELL_COLOR_BEIGE = BORDER_SIDE_X_FILL_RIGHT;

/** Default fill for pride diamonds — #FF3C3C */
var DIAMOND_FILL_COLOR_DEFAULT = "#ff3c3c";

/** Pride: filled inner diamonds (% of diamond catalog on canvas) */
var PRIDE_FILL_PERCENT_MIN = 10;
var PRIDE_FILL_PERCENT_MAX = 40;
var PRIDE_FILL_PERCENT_DEFAULT = 25;

/** Anger slider: visible length of vertical grid lines across full width (% of full span) */
var ANGER_VERTICAL_LENGTH_MIN = 0;
var ANGER_VERTICAL_LENGTH_MAX = 40;
var ANGER_VERTICAL_LENGTH_DEFAULT = 40;
/** At slider 0%, line span = this × the previous minimum (0.5 = 2× shorter than before) */
var ANGER_VERTICAL_LENGTH_MIN_SPAN_RATIO = 0.5;

/** Rotated-square swastika grid (swastika.html): repeat unit side length in px */
var SWASTIKA_UNIT_MIN = 40;
var SWASTIKA_UNIT_MAX = 280;
var SWASTIKA_UNIT_DEFAULT = 100;
var SWASTIKA_STROKE_WIDTH = 1;

/** Nested star octagons grid (nested-star-octagons.html): minimum tile size in px */
var NESTED_STAR_TILE_MIN = 40;
var NESTED_STAR_CUT_RATIO = 1 / (2 + Math.SQRT2);
var NESTED_STAR_INNER_STAR_MIN_T = 6;
var NESTED_STAR_STROKE_WIDTH = 1;

/** Main app grid type (index.html) */
var GRID_TYPE_OCTAGON = "octagon";
var GRID_TYPE_STAR = "star";

/** Star grid only: max value on “Iranian community” density slider (octagons-n) */
var STAR_GRID_OCTAGONS_N_MAX = 11;

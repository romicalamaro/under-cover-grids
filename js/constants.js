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
var GRID_STROKE_WIDTH_MIN = 1;
var GRID_STROKE_WIDTH_MAX = 3;
var GRID_STROKE_WIDTH_DEFAULT = 1;
var BG_COLOR = "#ffffff";

/**
 * Full-width brown bars on top/bottom side-frame division edges.
 * Bottom bar is canonical; top bar mirrors bottom vertically (flip Y).
 */
var CANVAS_EDGE_BROWN_BAR_HEIGHT_PX = 100;
/** Length toward canvas top/bottom past division line (inner edge stays on divY) */
var CANVAS_EDGE_BROWN_BAR_OUTWARD_EXTEND_PX = 20;
var CANVAS_EDGE_BROWN_BAR_COLOR = "#685450";
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
/** Row heights in outer-third grid: top 40%, middle 20%, bottom 40% (must sum to 1) */
var CANVAS_EDGE_BROWN_BAR_GRID_ROW_RATIOS = [0.4, 0.2, 0.4];
/** Non-highlighted grid cells in outer third (brown cells use CANVAS_EDGE_BROWN_BAR_COLOR) */
var CANVAS_EDGE_BROWN_BAR_GRID_CELL_BASE_FILL = "#ffffff";
/** Min column width (px) for randomized outer-third grid columns */
var CANVAS_EDGE_BROWN_BAR_GRID_MIN_COL_WIDTH_PX = 10;
/** At most this fraction of columns may use the minimum width (1/5) */
var CANVAS_EDGE_BROWN_BAR_GRID_MAX_MIN_COL_FRACTION = 0.2;
/** Random width exponent (>1 = more narrow + fewer wide among non-min columns) */
var CANVAS_EDGE_BROWN_BAR_GRID_WIDTH_RANDOM_POWER = 3.2;

/** Banner in first brown-bar segment (grid-facing band), top + bottom bars */
var BROWN_BAR_BANNER_TEXT = "FREE.IRANIAN.WOMEN";
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

/** Alternating fills in left/right margin cells (top cell = brown) */
var BORDER_SIDE_CELL_COLOR_BROWN = "#685450";
var BORDER_SIDE_CELL_COLOR_BLUE = "#a5bcc0";

/** Four triangles inside the X on each brown margin cell */
var BORDER_SIDE_X_FILL_TOP = "#685450";
var BORDER_SIDE_X_FILL_LEFT = "#a5bcc0";
var BORDER_SIDE_X_FILL_RIGHT = "#fdfae3";
var BORDER_SIDE_X_FILL_BOTTOM = "#d9d9d9";

/** Blue margin cell X: top/bottom blue, left/right brown */
var BORDER_SIDE_BLUE_X_FILL_TOP = BORDER_SIDE_CELL_COLOR_BLUE;
var BORDER_SIDE_BLUE_X_FILL_BOTTOM = BORDER_SIDE_CELL_COLOR_BLUE;
var BORDER_SIDE_BLUE_X_FILL_LEFT = BORDER_SIDE_CELL_COLOR_BROWN;
var BORDER_SIDE_BLUE_X_FILL_RIGHT = BORDER_SIDE_CELL_COLOR_BROWN;

/** Every second blue-pattern row: solid grey (no X triangles) */
var BORDER_SIDE_CELL_COLOR_GREY = "#d9d9d9";

/** A/B/C letter markers on center octagons (connector stroke = 2 × grid line weight) */
/** Circle radius = inscribedRadius × this (0.75 = 2× previous 0.375) */
var LETTER_MARKER_RADIUS_RATIO = 0.75;
/** Font size ≈ 48% of circle diameter (0.4 × 1.2, +20%) */
var LETTER_MARKER_FONT_SIZE_RATIO = 0.48;
/** Max word columns (space-separated) on the grid */
var LETTER_MARKER_MAX_COLUMNS = 12;
/** Default phrase: woman, life, freedom (Arabic) */
var LETTER_MARKER_WORD_DEFAULT = "امرأة حياة حرية";

/** Random solid fill on inner diamonds (% of all diamonds on canvas) */
var DIAMOND_FILL_PERCENT_MIN = 10;
var DIAMOND_FILL_PERCENT_MAX = 40;
var DIAMOND_FILL_PERCENT_DEFAULT = 25;

/** Default fill for randomly filled diamonds — #FF3C3C */
var DIAMOND_FILL_COLOR_DEFAULT = "#ff3c3c";

/** Rotated-square swastika grid (swastika.html): repeat unit side length in px */
var SWASTIKA_UNIT_MIN = 40;
var SWASTIKA_UNIT_MAX = 280;
var SWASTIKA_UNIT_DEFAULT = 100;
var SWASTIKA_STROKE_WIDTH = 1;

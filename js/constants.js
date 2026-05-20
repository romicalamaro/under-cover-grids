/** Logical print canvas: 70cm × 180cm at 300 DPI */
var CANVAS_W = 827;
var CANVAS_H = 2126;

/** Layout margins (CSS px) around scaled canvas */
var VIEW_MARGIN = 24;

/** Pattern line styling */
var STROKE_COLOR = "#333333";
var STROKE_WIDTH = 1;
var BG_COLOR = "#ffffff";

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

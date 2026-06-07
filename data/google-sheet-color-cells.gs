/**
 * UNDER.COVER — צביעת תאי hex בגיליון הפלטות
 *
 * התקנה ב-Google Sheets (פעם אחת):
 * 1. פתחי את גיליון הפלטות (1yMwNB7MopTJWDEH328VF0WiU2XXdPu5Cfs0I1YDyeDQ) → Extensions → Apps Script
 * 2. מחקי את התוכן הקיים והדביקי את הקובץ הזה
 * 3. שמרי (Ctrl/Cmd+S) → Run → colorPaletteHexCells (אישור הרשאות בפעם הראשונה)
 * 4. רענני את הגיליון — עמודות Palette 1–9 (E–M) יצבעו לפי ה-hex
 *
 * אופציונלי: הרצה אוטומטית בכל פתיחה — הריצי פעם אחת createOpenTrigger()
 */

// עמודות: A=Category B=Division C=Slot D=Element E–M = Palette 1–9
var COLOR_COLUMN_START = 5; // עמודה E = Palette 1
var COLOR_COLUMN_END = 13; // עמודה M = Palette 9
var GVIZ_CSV_ONLY_COLUMN_START = 12; // L = Palette 8, M = Palette 9
var SLOT_COLUMN = 3; // עמודה C = Slot
var DATA_START_ROW = 2;

function normalizeHex_(value) {
  if (value == null || value === "") return null;
  var v = String(value).trim();
  if (!v) return null;
  if (v.charAt(0) !== "#") v = "#" + v;
  v = v.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return (
      "#" +
      v.charAt(1) +
      v.charAt(1) +
      v.charAt(2) +
      v.charAt(2) +
      v.charAt(3) +
      v.charAt(3)
    );
  }
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  return null;
}

function contrastText_(hex) {
  var h = hex.replace("#", "");
  var r = parseInt(h.substring(0, 2), 16);
  var g = parseInt(h.substring(2, 4), 16);
  var b = parseInt(h.substring(4, 6), 16);
  var yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#111111" : "#ffffff";
}

/**
 * Palette 8–9 (עמודות L–M) חייבות Plain Text — אחרת gviz מחזיר null ל-hex עם אותיות
 * והעדכון החי בקנבס לא עובד.
 */
function ensureCsvOnlyPalettePlainTextColumns_(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), DATA_START_ROW);
  sheet
    .getRange(
      DATA_START_ROW,
      GVIZ_CSV_ONLY_COLUMN_START,
      lastRow - DATA_START_ROW + 1,
      COLOR_COLUMN_END - GVIZ_CSV_ONLY_COLUMN_START + 1
    )
    .setNumberFormat("@");
}

/** הרצה חד-פעמית: תיקון פורמט עמודות Palette 8–9 */
function fixPalette8ColumnFormat() {
  var sheet = SpreadsheetApp.getActiveSheet();
  ensureCsvOnlyPalettePlainTextColumns_(sheet);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "עמודות Palette 8–9 הוגדרו כ-Plain Text",
    "פלטות",
    4
  );
}

/** צובע את כל תאי הצבע לפי הערך בתא */
function colorPaletteHexCells() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return;

  ensureCsvOnlyPalettePlainTextColumns_(sheet);

  var slotCol = SLOT_COLUMN;
  var r;
  for (r = DATA_START_ROW; r <= lastRow; r++) {
    var slot = String(sheet.getRange(r, slotCol).getValue() || "").trim();
    if (!slot) {
      sheet.getRange(r, COLOR_COLUMN_START, 1, COLOR_COLUMN_END - COLOR_COLUMN_START + 1)
        .setBackground(null)
        .setFontColor(null);
      continue;
    }
    var c;
    for (c = COLOR_COLUMN_START; c <= COLOR_COLUMN_END; c++) {
      var cell = sheet.getRange(r, c);
      var raw = cell.getValue();
      var hex = normalizeHex_(raw);
      if (hex) {
        cell.setBackground(hex).setFontColor(contrastText_(hex));
      } else if (raw === "" || raw == null) {
        cell.setBackground("#f3f3f3").setFontColor("#888888");
      } else {
        cell.setBackground("#ffe8e8").setFontColor("#990000");
      }
    }
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("תאי הצבע עודכנו", "פלטות", 3);
}

/** תפריט בגיליון */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("פלטות צבע")
    .addItem("צבע תאי hex", "colorPaletteHexCells")
    .addItem("תיקון פורמט Palette 8–9 (Plain Text)", "fixPalette8ColumnFormat")
    .addToUi();
}

/** הרצה אוטומטית בכל פתיחת הגיליון (אופציונלי) */
function createOpenTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "colorPaletteHexCells") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("colorPaletteHexCells")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();
}

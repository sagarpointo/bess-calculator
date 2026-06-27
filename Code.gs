/**
 * Pointo BESS calculator — lead capture endpoint.
 *
 * This script is bound to a Google Sheet and deployed as a Web App.
 * Every form submit POSTs JSON here, and one row is appended to the sheet
 * (newest at the bottom, in the order leads arrive).
 *
 * SETUP: see README.md -> "Connecting the Google Sheet".
 */

// Name of the tab that stores leads. It will be created automatically if missing.
var SHEET_NAME = 'Leads';

// Header row written once, the first time the sheet is used.
var HEADERS = [
  'Timestamp', 'Phone', 'kVA', 'Backup hours', 'Solar',
  'Diesel ₹/L', 'Grid ₹/unit', 'Monthly saving', 'System price', 'EMI', 'Source'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // serialize writes so concurrent submits don't collide
  try {
    var data = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date(),
      "'" + (data.phone || ''),     // leading quote keeps leading zeros / avoids number formatting
      data.kva || '',
      data.hours || '',
      data.solar ? 'Yes' : 'No',
      data.dieselPrice || '',
      data.gridTariff || '',
      data.monthlySaving || '',
      data.systemPrice || '',
      data.emi || '',
      data.page || 'calculator'
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return json({ ok: true, service: 'pointo-lead-capture' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

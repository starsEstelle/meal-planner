// Deploy this script (Extensions > Apps Script, in a Google Sheet) as a Web App
// to use the Sheet as a free storage backend for the meal planner site.
// See apps-script/SETUP.md for step-by-step instructions.

var SHEET_NAME = 'Plans';
var HEADERS = ['id', 'fromDate', 'toDate', 'budget', 'createdAt', 'meals'];
var MEALS_COL = HEADERS.indexOf('meals') + 1; // 1-indexed sheet column

function doGet(e) {
  return jsonResponse(getAllPlans());
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var sheet = getSheet();

  if (body.action === 'create') {
    var plan = body.plan;
    sheet.appendRow([plan.id, plan.fromDate, plan.toDate, plan.budget, plan.createdAt, JSON.stringify(plan.meals || {})]);
  } else if (body.action === 'delete') {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === body.id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  } else if (body.action === 'updateMeal') {
    var rows = sheet.getDataRange().getValues();
    for (var j = 1; j < rows.length; j++) {
      if (rows[j][0] === body.id) {
        var meals = {};
        try { meals = JSON.parse(rows[j][MEALS_COL - 1] || '{}'); } catch (err) { meals = {}; }
        if (!meals[body.date]) meals[body.date] = {};
        meals[body.date][body.mealType] = body.value;
        sheet.getRange(j + 1, MEALS_COL).setValue(JSON.stringify(meals));
        break;
      }
    }
  }

  return jsonResponse(getAllPlans());
}

function getAllPlans() {
  var sheet = getSheet();
  var rows = sheet.getDataRange().getValues();
  rows.shift(); // drop header row
  return rows
    .filter(function (row) { return row[0] !== ''; })
    .map(rowToPlan);
}

function rowToPlan(row) {
  var plan = {};
  HEADERS.forEach(function (key, i) {
    var value = row[i];
    if (value instanceof Date) {
      value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    plan[key] = value;
  });
  try {
    plan.meals = plan.meals ? JSON.parse(plan.meals) : {};
  } catch (err) {
    plan.meals = {};
  }
  return plan;
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

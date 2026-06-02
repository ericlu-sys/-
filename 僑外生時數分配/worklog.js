// Last pushed: 2026-05-13 v8 by Claude — 移除CSV下載、保留進度視窗、無工時員工 placeholder

// ─── 選單 & UI ───────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⏱ 時數分配')
    .addItem('① 產生 worklog（總檔 → worklog）', 'runProcess總檔ToWorklog')
    .addItem('② 分配時數（worklog → Rearranged）', 'runCreateRearrangedWorklog')
    .addToUi();
}

// 顯示進度對話框並呼叫指定函式
function showDialog_(fnName, message) {
  const t = HtmlService.createTemplateFromFile('ProgressDialog');
  t.fnName = fnName;
  t.initialMessage = message;
  SpreadsheetApp.getUi().showModalDialog(
    t.evaluate().setWidth(340).setHeight(300),
    '時數分配系統'
  );
}

function runProcess總檔ToWorklog() {
  showDialog_('process總檔ToWorklog', '正在讀取總檔並產生工作日誌...');
}

function runCreateRearrangedWorklog() {
  showDialog_('createRearrangedWorklog', '正在分配時數到各公司...');
}


// --- NEW Helper Function: getCompanyInfo ---
/**
 * Reads the '檔案參數' sheet to extract all company names and identify main companies (主單位).
 * This function is independent of sheet duplication.
 * @returns {object} An object containing { allCompanies: string[], mainCompanies: Set<string>, timeValue: string }.
 */
function getCompanyInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const paramSheet = ss.getSheets().find(s => s.getName().includes("檔案參數"));
  if (!paramSheet) {
    throw new Error("Sheet containing '檔案參數' not found.");
  }
  const paramData = paramSheet.getDataRange().getValues();

  const companies = new Set();
  const mainCompanies = new Set();
  let timeValue = '';

  const headers = paramData[0];
  const 廠商Index = headers.indexOf("廠商");
  const 主單位Index = headers.indexOf("主單位");
  const 時間Index = headers.indexOf("時間");

  if (廠商Index === -1 || 主單位Index === -1 || 時間Index === -1) {
      throw new Error("Missing one or more required headers (廠商, 主單位, 時間) in '檔案參數' sheet.");
  }

  for (let i = 1; i < paramData.length; i++) {
    const 廠商 = paramData[i][廠商Index];
    const 主單位 = paramData[i][主單位Index];
    const 時間 = paramData[i][時間Index];

    if (廠商) companies.add(廠商);
    if (主單位) mainCompanies.add(String(主單位).trim()); // Ensure 主單位 is trimmed for consistent matching
    if (時間 && !timeValue) timeValue = 時間;
  }

  const allCompanies = Array.from(new Set([...companies, ...mainCompanies]));
  return { allCompanies, mainCompanies, timeValue };
}



// --- process總檔ToWorklog function (no changes) ---
/**
 * Processes sheets containing "總檔" in their name, extracts work log data,
 * and compiles it into a 'worklog' sheet.
 *
 * It dynamically identifies the columns for '離職日' and '時數'
 * to determine the range of work dates.
 *
 * The output format in 'worklog' sheet will be:
 * [NO.], [姓名], [work_date], [班別], [hours_worked], [單價], [Bonus1], [Bonus2], ..., [小計]
 *
 * This version handles:
 * - 'NO.' for Employee ID.
 * - '姓名' for Employee Name.
 * - '班別' as the general shift type (fallback).
 * - Daily work cells containing "ShiftType Hours" (e.g., "夜班 10"),
 * or just "Hours" (e.g., "8"), or just "ShiftType" (e.g., "特休").
 * - Dynamically finds the header row (e.g., if headers start at A2).
 * - Propagates 'NO.' and '姓名' values down for merged cells.
 * - Extracts '單價', individual bonus columns, and calculates '小計' for worklog.
 * - Uses original headers from 總檔 for NO., 姓名, 班別, 單價, bonus columns, and 小計.
 */
function process總檔ToWorklog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const worklogSheetName = 'worklog';

  let worklogSheet = ss.getSheetByName(worklogSheetName);
  if (!worklogSheet) {
    worklogSheet = ss.insertSheet(worklogSheetName);
  } else {
    worklogSheet.clearContents();
  }

  const processedData = [];
  let dynamicWorklogHeaders = [];
  let headerIndexesFromFirst總檔 = {};

  let first總檔Sheet = null;
  for (const sheet of sheets) {
    if (sheet.getName().includes('總檔')) {
      first總檔Sheet = sheet;
      break;
    }
  }

  if (!first總檔Sheet) {
    Logger.log('No sheet containing "總檔" found. No worklog data to process.');
    worklogSheet.getRange(1, 1, 1, ['No', 'Name', 'work_date', 'shift_type', 'hours_worked'].length).setValues([['No', 'Name', 'work_date', 'shift_type', 'hours_worked']]).setFontWeight('bold');
    return;
  }

  const first總檔Data = first總檔Sheet.getDataRange().getValues();
  let first總檔HeaderRowIndex = -1;
  let first總檔Headers = [];

  for (let r = 0; r < Math.min(first總檔Data.length, 5); r++) {
    const currentRow = first總檔Data[r];
    const noHeaderIndex = currentRow.findIndex(cell => String(cell).trim() === 'NO.');
    if (noHeaderIndex !== -1) {
      first總檔HeaderRowIndex = r;
      first總檔Headers = currentRow;
      break;
    }
  }

  if (first總檔HeaderRowIndex === -1) {
    Logger.log(`Could not find header 'NO.' in the first 5 rows of the first "總檔" sheet (${first總檔Sheet.getName()}). Cannot determine worklog headers.`);
    worklogSheet.getRange(1, 1, 1, ['No', 'Name', 'work_date', 'shift_type', 'hours_worked'].length).setValues([['No', 'Name', 'work_date', 'shift_type', 'hours_worked']]).setFontWeight('bold');
    return;
  }

  headerIndexesFromFirst總檔.no = first總檔Headers.findIndex(header => String(header).trim() === 'NO.');
  headerIndexesFromFirst總檔.name = first總檔Headers.findIndex(header => String(header).trim() === '姓名');
  headerIndexesFromFirst總檔.shiftTypeGeneral = first總檔Headers.findIndex(header => String(header).trim() === '班別');
  headerIndexesFromFirst總檔.resignationDate = first總檔Headers.findIndex(header => String(header).trim() === '離職日');
  headerIndexesFromFirst總檔.hours = first總檔Headers.findIndex(header => String(header).trim() === '時數');
  headerIndexesFromFirst總檔.unitPrice = first總檔Headers.findIndex(header => String(header).trim() === '單價');
  headerIndexesFromFirst總檔.subtotal = first總檔Headers.findIndex(header => String(header).trim() === '小計');

  dynamicWorklogHeaders = [];

  if (headerIndexesFromFirst總檔.no !== -1) {
      dynamicWorklogHeaders.push(String(first總檔Headers[headerIndexesFromFirst總檔.no]).trim());
  } else {
      dynamicWorklogHeaders.push('No');
  }

  if (headerIndexesFromFirst總檔.name !== -1) {
      dynamicWorklogHeaders.push(String(first總檔Headers[headerIndexesFromFirst總檔.name]).trim());
  } else {
      dynamicWorklogHeaders.push('Name');
  }
  
  dynamicWorklogHeaders.push('work_date');
  
  if (headerIndexesFromFirst總檔.shiftTypeGeneral !== -1) {
      dynamicWorklogHeaders.push(String(first總檔Headers[headerIndexesFromFirst總檔.shiftTypeGeneral]).trim());
  } else {
      dynamicWorklogHeaders.push('shift_type');
  }
  
  dynamicWorklogHeaders.push('hours_worked');

  const bonusColHeadersForWorklog = [];

  let hasUnitPriceInFirst總檔 = false;
  let hasSubtotalInFirst總檔 = false;

  if (headerIndexesFromFirst總檔.unitPrice !== -1) {
      dynamicWorklogHeaders.push(String(first總檔Headers[headerIndexesFromFirst總檔.unitPrice]).trim());
      hasUnitPriceInFirst總檔 = true;
  } else {
      Logger.log(`Warning: '單價' column not found in the first "總檔" sheet (${first總檔Sheet.getName()}). Price calculations will be based on 0.`);
  }

  if (headerIndexesFromFirst總檔.subtotal !== -1) {
      hasSubtotalInFirst總檔 = true;
      if (hasUnitPriceInFirst總檔 && headerIndexesFromFirst總檔.unitPrice < headerIndexesFromFirst總檔.subtotal) {
          for (let b = headerIndexesFromFirst總檔.unitPrice + 1; b < headerIndexesFromFirst總檔.subtotal; b++) {
              bonusColHeadersForWorklog.push(String(first總檔Headers[b]).trim());
          }
          dynamicWorklogHeaders.push(...bonusColHeadersForWorklog);
      }
      dynamicWorklogHeaders.push(String(first總檔Headers[headerIndexesFromFirst總檔.subtotal]).trim());
  } else {
      Logger.log(`Warning: '小計' column not found in the first "總檔" sheet (${first總檔Sheet.getName()}). Subtotal calculation will not be included.`);
  }
  
  worklogSheet.getRange(1, 1, 1, dynamicWorklogHeaders.length).setValues([dynamicWorklogHeaders]).setFontWeight('bold');

  // Track every employee encountered in 總檔 sheets, regardless of whether they have date data.
  // Used at the end to add placeholder rows for employees with no work-date entries.
  const allEmployeesEncountered = new Map(); // key=`${no}|${name}` → {no, name}
  const employeesWithEntries = new Set();    // keys for employees that got at least one worklog row

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();

    if (sheetName.includes('總檔')) {
      Logger.log(`Processing sheet: ${sheetName}`);
      const currentSheetAllData = sheet.getDataRange().getValues();

      if (currentSheetAllData.length < 2) {
        Logger.log(`Sheet ${sheetName} has insufficient data.`);
        return;
      }

      let currentSheetHeaderRowIndex = -1;
      let currentSheetHeaders = [];
      for (let r = 0; r < Math.min(currentSheetAllData.length, 5); r++) {
        const currentRow = currentSheetAllData[r];
        const noHeaderIndex = currentRow.findIndex(cell => String(cell).trim() === 'NO.');
        if (noHeaderIndex !== -1) {
          currentSheetHeaderRowIndex = r;
          currentSheetHeaders = currentRow;
          break;
        }
      }

      if (currentSheetHeaderRowIndex === -1) {
        Logger.log(`Warning: Could not find header 'NO.' in the first 5 rows of sheet ${sheetName}. Skipping.`);
        return;
      }

      const currentNoColIndex = currentSheetHeaders.findIndex(header => String(header).trim() === 'NO.');
      const currentNameColIndex = currentSheetHeaders.findIndex(header => String(header).trim() === '姓名');
      const currentShiftTypeGeneralColIndex = currentSheetHeaders.findIndex(header => String(header).trim() === '班別');
      const currentResignationDateColIndex = currentSheetHeaders.findIndex(header => String(header).trim() === '離職日');
      const currentHoursColIndex = currentSheetHeaders.findIndex(header => String(header).trim() === '時數');
      const currentUnitPriceColIndex = currentSheetHeaders.findIndex(header => String(header).trim() === '單價');
      const currentSubtotalColIndex = currentSheetHeaders.findIndex(header => String(header).trim() === '小計');


      const workDateStartColIndex = currentResignationDateColIndex + 1;
      const workDateEndColIndex = currentHoursColIndex - 1;

      if (workDateStartColIndex > workDateEndColIndex) {
        Logger.log(`Warning: No valid work date range found between '離職日' and '時數' in sheet ${sheetName}. Skipping.`);
        return;
      }

      let lastEmployeeNo = '';
      let lastEmployeeName = '';

      for (let i = currentSheetHeaderRowIndex + 1; i < currentSheetAllData.length; i++) {
        const row = currentSheetAllData[i];
        
        let currentEmployeeNo = row[currentNoColIndex] ? String(row[currentNoColIndex]).trim() : '';
        let currentEmployeeName = row[currentNameColIndex] ? String(row[currentNameColIndex]).trim() : '';

        if (currentEmployeeNo !== '') {
          lastEmployeeNo = currentEmployeeNo;
        } else {
          currentEmployeeNo = lastEmployeeNo;
        }

        if (currentEmployeeName !== '') {
          lastEmployeeName = currentEmployeeName;
        } else {
          currentEmployeeName = lastEmployeeName;
        }

        if (!currentEmployeeNo && !currentEmployeeName) {
            Logger.log(`Skipping row ${i+1} in sheet ${sheetName} as no employee No or Name could be determined.`);
            continue;
        }

        // Track all employees encountered (regardless of whether they have date data)
        const empKey = currentEmployeeNo + '|' + currentEmployeeName;
        if (!allEmployeesEncountered.has(empKey)) {
          allEmployeesEncountered.set(empKey, { no: currentEmployeeNo, name: currentEmployeeName });
        }

        const generalShiftType = (currentShiftTypeGeneralColIndex !== -1 && row[currentShiftTypeGeneralColIndex] !== undefined) ? String(row[currentShiftTypeGeneralColIndex]).trim() : '';
        
        let currentUnitPriceValue = 0;
        const currentBonusValuesMap = {};
        let totalSumOfBonuses = 0;

        if (currentUnitPriceColIndex !== -1) {
            currentUnitPriceValue = parseFloat(row[currentUnitPriceColIndex]) || 0;
        }

        if (currentUnitPriceColIndex !== -1 && currentSubtotalColIndex !== -1 && currentUnitPriceColIndex < currentSubtotalColIndex) {
            for (let b = currentUnitPriceColIndex + 1; b < currentSubtotalColIndex; b++) {
                const bonusHeader = String(currentSheetHeaders[b]).trim();
                const bonusVal = parseFloat(row[b]) || 0;
                currentBonusValuesMap[bonusHeader] = bonusVal;
                totalSumOfBonuses += bonusVal;
            }
        }

        for (let j = workDateStartColIndex; j <= workDateEndColIndex; j++) {
          const dailyCellValue = String(row[j] || '').trim();

          if (dailyCellValue === '') {
            continue;
          }

          const dateHeader = currentSheetHeaders[j];

          let workDate;
          try {
            if (dateHeader instanceof Date) {
                workDate = dateHeader;
            } else if (typeof dateHeader === 'number' && !isNaN(dateHeader) && dateHeader > 0 && dateHeader < 32) {
                const today = new Date();
                workDate = new Date(today.getFullYear(), today.getMonth(), dateHeader);
            } else {
                workDate = new Date(dateHeader);
            }
            if (isNaN(workDate.getTime())) {
                workDate = null;
            }
          } catch (e) {
            workDate = null;
            Logger.log(`Could not parse date from header '${dateHeader}' in sheet ${sheetName} at column ${j+1}. Error: ${e.message}`);
          }

          if (!workDate) {
            continue;
          }

          let finalShiftType = '';
          let hoursWorked = 0;

          const parts = dailyCellValue.split(/\s+/);

          if (parts.length > 1 && !isNaN(parseFloat(parts[parts.length - 1]))) {
            hoursWorked = parseFloat(parts[parts.length - 1]);
            finalShiftType = parts.slice(0, parts.length - 1).join(' ');
          } else if (!isNaN(parseFloat(dailyCellValue))) {
            hoursWorked = parseFloat(dailyCellValue);
            finalShiftType = generalShiftType || '全日';
          } else {
            finalShiftType = dailyCellValue;
            hoursWorked = 0;
          }

          let calculatedSubtotal = 0;
          if (currentUnitPriceColIndex !== -1 && currentSubtotalColIndex !== -1) {
              calculatedSubtotal = (currentUnitPriceValue + totalSumOfBonuses) * hoursWorked;
          }
          
          const rowDataForWorklog = [];

          rowDataForWorklog.push(currentEmployeeNo);
          rowDataForWorklog.push(currentEmployeeName);
          rowDataForWorklog.push(Utilities.formatDate(workDate, ss.getSpreadsheetTimeZone(), 'yyyy/MM/dd'));
          rowDataForWorklog.push(finalShiftType);
          rowDataForWorklog.push(hoursWorked);

          const unitPriceHeaderName = (headerIndexesFromFirst總檔.unitPrice !== -1) ? String(first總檔Headers[headerIndexesFromFirst總檔.unitPrice]).trim() : '';
          const unitPriceWorklogColIndex = dynamicWorklogHeaders.indexOf(unitPriceHeaderName);

          if (unitPriceWorklogColIndex !== -1) {
              rowDataForWorklog.push(currentUnitPriceValue);
              bonusColHeadersForWorklog.forEach(bonusHeader => {
                  rowDataForWorklog.push(currentBonusValuesMap[bonusHeader] || 0);
              });
              rowDataForWorklog.push(calculatedSubtotal);
          }

          processedData.push(rowDataForWorklog);
          employeesWithEntries.add(empKey);
        }
      }
    }
  });

  // Add placeholder rows for employees in 總檔 with no date data — ensures every employee appears in worklog.
  const unitPriceHeaderName = (headerIndexesFromFirst總檔.unitPrice !== -1) ? String(first總檔Headers[headerIndexesFromFirst總檔.unitPrice]).trim() : '';
  const hasUnitPriceCol = dynamicWorklogHeaders.indexOf(unitPriceHeaderName) !== -1;
  const hasSubtotalCol = headerIndexesFromFirst總檔.subtotal !== -1;
  let placeholderCount = 0;
  for (const [key, emp] of allEmployeesEncountered) {
    if (!employeesWithEntries.has(key)) {
      const placeholderRow = [emp.no, emp.name, '', '', 0];
      if (hasUnitPriceCol) {
        placeholderRow.push(0);
        bonusColHeadersForWorklog.forEach(() => placeholderRow.push(0));
        if (hasSubtotalCol) placeholderRow.push(0);
      }
      processedData.push(placeholderRow);
      placeholderCount++;
    }
  }
  if (placeholderCount > 0) Logger.log(`已加入 ${placeholderCount} 筆無工時資料的員工 placeholder 行。`);

  if (processedData.length > 0) {
    worklogSheet.getRange(2, 1, processedData.length, dynamicWorklogHeaders.length).setValues(processedData);
    Logger.log('Data successfully transferred to worklog sheet.');
  } else {
    Logger.log('No data found to transfer from any "總檔" sheets.');
  }
}

// --- Modified function: createRearrangedWorklog ---
/**
 * Distributes work hours from the 'worklog' sheet into a new 'Rearranged-worklog' sheet.
 *
 * Rules:
 * 1. A person can only work for a company up to 20 hours per week (Monday-Sunday).
 * 2. Shift units (日班/夜班 and their '加' variations) must be assigned as a whole to one company for a given day.
 * 3. Only '主單位' companies can have an employee's sum of '小計' for a month over 20,000.
 * Other companies must keep an employee's monthly '小計' under 19,999.
 * 4. Creates 'Rearranged-worklog' sheet with original worklog data + '公司' column.
 *
 * This version uses getCompanyInfo() to retrieve company data, decoupling it from sheet duplication.
 */
function createRearrangedWorklog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const WEEKLY_HOURS_CAP = 20;
  const MONTHLY_SUBTOTAL_CAP_OTHER = 19999;
  const MONTHLY_OVERFLOW_CAP = 39999; // 允許月小計溢出上限 19999+20000
  const REARRANGED_SHEET_NAME = 'Rearranged-worklog';

  function getShiftUnitCategory(shiftType) {
    if (shiftType.startsWith('日')) { return 'day'; }
    if (shiftType.startsWith('夜')) { return 'night'; }
    return 'other';
  }

  function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return Utilities.formatDate(monday, ss.getSpreadsheetTimeZone(), 'yyyy/MM/dd');
  }

  function getMonthYear(date) {
    return Utilities.formatDate(date, ss.getSpreadsheetTimeZone(), 'yyyy-MM');
  }

  Logger.log("Starting hour distribution process for Rearranged-worklog...");

  // 1. Get company info (allCompanies, mainCompanies) without duplicating sheets
  let companyInfo;
  try {
    companyInfo = getCompanyInfo();
  } catch (e) {
    Logger.log(`Error getting company info: ${e.message}. Aborting distribution.`);
    SpreadsheetApp.getUi().alert('Error', `Failed to read company information: ${e.message}. Please ensure '檔案參數' sheet exists and is correctly formatted.`, SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const { allCompanies, mainCompanies } = companyInfo;

  // 2. Read worklog data
  const worklogSheet = ss.getSheetByName('worklog');
  if (!worklogSheet || worklogSheet.getLastRow() < 2) {
    Logger.log("Worklog sheet not found or is empty. Please run 'process總檔ToWorklog' first.");
    SpreadsheetApp.getUi().alert('Error', "Worklog sheet is empty or not found. Please run 'Process Work Logs' first.", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const worklogData = worklogSheet.getDataRange().getValues();
  const worklogHeaders = worklogData[0];

  const noColIndex = worklogHeaders.indexOf('NO.');
  const nameColIndex = worklogHeaders.indexOf('姓名');
  const workDateColIndex = worklogHeaders.indexOf('work_date');
  const shiftTypeColIndex = worklogHeaders.indexOf('班別');
  const hoursWorkedColIndex = worklogHeaders.indexOf('hours_worked');
  const unitPriceColIndex = worklogHeaders.indexOf('單價');
  const subtotalColIndex = worklogHeaders.indexOf('小計');

  const requiredHeaders = ['NO.', '姓名', 'work_date', '班別', 'hours_worked', '單價', '小計'];
  const missingHeaders = requiredHeaders.filter(h => worklogHeaders.indexOf(h) === -1);
  if (missingHeaders.length > 0) {
    Logger.log(`Missing required headers in 'worklog' sheet: ${missingHeaders.join(', ')}. Aborting.`);
    SpreadsheetApp.getUi().alert('Error', `Missing required headers in 'worklog' sheet: ${missingHeaders.join(', ')}. Please ensure 'process總檔ToWorklog' ran correctly.`, SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // 3. Prepare Rearranged-worklog sheet
  let rearrangedSheet = ss.getSheetByName(REARRANGED_SHEET_NAME);
  if (!rearrangedSheet) {
    rearrangedSheet = ss.insertSheet(REARRANGED_SHEET_NAME);
  } else {
    rearrangedSheet.clearContents();
  }
  const rearrangedHeaders = [...worklogHeaders, '公司'];
  rearrangedSheet.getRange(1, 1, 1, rearrangedHeaders.length).setValues([rearrangedHeaders]).setFontWeight('bold');

  // 4. Pre-process and group worklog data for allocation
  const worklogGroupedForAllocation = {};
  for (let i = 1; i < worklogData.length; i++) {
    const row = worklogData[i];
    const employeeNo = String(row[noColIndex]).trim();
    const employeeName = String(row[nameColIndex]).trim();
    const workDateStr = String(row[workDateColIndex]).trim();
    const shiftType = String(row[shiftTypeColIndex]).trim();
    const hoursWorked = Number(row[hoursWorkedColIndex]) || 0;
    const subtotal = Number(row[subtotalColIndex]) || 0;

    if (!employeeNo || !workDateStr || hoursWorked === 0) continue;

    const workDate = new Date(workDateStr);
    if (isNaN(workDate.getTime())) {
      Logger.log(`Invalid date in worklog: ${workDateStr} for employee ${employeeNo}. Skipping.`);
      continue;
    }

    if (!worklogGroupedForAllocation[employeeNo]) {
      worklogGroupedForAllocation[employeeNo] = { name: employeeName, dates: {} };
    }
    if (!worklogGroupedForAllocation[employeeNo].dates[workDateStr]) {
      worklogGroupedForAllocation[employeeNo].dates[workDateStr] = { day: [], night: [], other: [] };
    }

    const category = getShiftUnitCategory(shiftType);
    worklogGroupedForAllocation[employeeNo].dates[workDateStr][category].push({
      originalRow: row,
      shift: shiftType,
      hours: hoursWorked,
      subtotal: subtotal
    });
  }

  // 5. Allocate hours to companies
  const finalRearrangedData = [];
  const assignedEntriesWithWarnings = []; // New array to collect entries assigned with a warning

  const employeeWeeklyHours = {};
  const employeeMonthlySubtotal = {};
  const employeeDailyUnitCompany = {};

  for (const employeeNo in worklogGroupedForAllocation) {
    const employeeName = worklogGroupedForAllocation[employeeNo].name;
    const sortedWorkDates = Object.keys(worklogGroupedForAllocation[employeeNo].dates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    for (const workDateStr of sortedWorkDates) {
      const workDate = new Date(workDateStr);
      const weekStartDate = getWeekStartDate(workDate);
      const monthYear = getMonthYear(workDate);
      const formattedDate = Utilities.formatDate(workDate, ss.getSpreadsheetTimeZone(), 'yyyy/MM/dd');

      const dailyUnits = worklogGroupedForAllocation[employeeNo].dates[workDateStr];

      ['day', 'night', 'other'].forEach(category => {
        const entries = dailyUnits[category];
        if (entries.length === 0) return;

        const unitTotalHours = entries.reduce((sum, e) => sum + e.hours, 0);
        const unitTotalSubtotal = entries.reduce((sum, e) => sum + e.subtotal, 0);

        // --- 單次遍歷，三個優先層級 ---
        // 週上限是絕對原則，任何情況不得違反。
        // bestMain    → 主單位，週ok（主單位無月上限）
        // bestOther   → 非主單位，週ok，月 ≤ 19,999
        // overflowOther → 非主單位，週ok，月 ≤ 39,999（帶警告）
        let bestMain = null;
        let bestOther = null;
        let overflowOther = null;

        for (const companyName of allCompanies) {
          const isMain = mainCompanies.has(companyName);
          const curW = (employeeWeeklyHours[employeeNo] && employeeWeeklyHours[employeeNo][companyName] && employeeWeeklyHours[employeeNo][companyName][weekStartDate]) ? employeeWeeklyHours[employeeNo][companyName][weekStartDate] : 0;
          const curM = (employeeMonthlySubtotal[employeeNo] && employeeMonthlySubtotal[employeeNo][companyName] && employeeMonthlySubtotal[employeeNo][companyName][monthYear]) ? employeeMonthlySubtotal[employeeNo][companyName][monthYear] : 0;

          // 週上限絕對原則：超過直接跳過
          if (curW + unitTotalHours > WEEKLY_HOURS_CAP) continue;

          if (isMain) {
            // 主單位：無月上限
            if (!bestMain || curW > bestMain.w) bestMain = { companyName, w: curW };
          } else {
            const newM = curM + unitTotalSubtotal;
            if (newM <= MONTHLY_SUBTOTAL_CAP_OTHER) {
              // 完全合規
              if (!bestOther || curW > bestOther.w) bestOther = { companyName, w: curW };
            } else if (newM <= MONTHLY_OVERFLOW_CAP) {
              // 月小計溢出（帶警告），greedy fill 取最多週時數
              if (!overflowOther || curW > overflowOther.w) overflowOther = { companyName, w: curW, curM, newM };
            }
            // 超過 39,999：跳過
          }
        }

        let assignedCompany = null;
        let capViolationWarning = false;
        let warningReason = '';

        if (bestMain) {
          assignedCompany = bestMain.companyName;
        } else if (bestOther) {
          assignedCompany = bestOther.companyName;
        } else if (overflowOther) {
          assignedCompany = overflowOther.companyName;
          capViolationWarning = true;
          warningReason = `月小計溢出：${overflowOther.curM.toFixed(0)} + ${unitTotalSubtotal.toFixed(0)} = ${overflowOther.newM.toFixed(0)} > 19,999（上限 39,999）`;
        } else {
          // 所有公司均達週上限，無法分配
          Logger.log(`⚠️ 無法分配：${employeeName}(${employeeNo}) ${formattedDate} [${category}] — 所有公司均已達週時數上限`);
          entries.forEach(e => finalRearrangedData.push([...e.originalRow, '無法分配']));
          return;
        }

        // 更新追蹤
        if (!employeeWeeklyHours[employeeNo]) employeeWeeklyHours[employeeNo] = {};
        if (!employeeWeeklyHours[employeeNo][assignedCompany]) employeeWeeklyHours[employeeNo][assignedCompany] = {};
        if (!employeeMonthlySubtotal[employeeNo]) employeeMonthlySubtotal[employeeNo] = {};
        if (!employeeMonthlySubtotal[employeeNo][assignedCompany]) employeeMonthlySubtotal[employeeNo][assignedCompany] = {};

        employeeWeeklyHours[employeeNo][assignedCompany][weekStartDate] = (employeeWeeklyHours[employeeNo][assignedCompany][weekStartDate] || 0) + unitTotalHours;
        employeeMonthlySubtotal[employeeNo][assignedCompany][monthYear] = (employeeMonthlySubtotal[employeeNo][assignedCompany][monthYear] || 0) + unitTotalSubtotal;

        Logger.log(`${employeeName}(${employeeNo}) ${formattedDate} [${category}] ${unitTotalHours}h → ${assignedCompany} (本週累計: ${employeeWeeklyHours[employeeNo][assignedCompany][weekStartDate]}h)`);

        if (capViolationWarning) {
          Logger.log(`  ⚠️ 警告：${warningReason}`);
          assignedEntriesWithWarnings.push({
            employeeNo, employeeName, formattedDate,
            shiftType: entries[0].shift, hours: unitTotalHours, subtotal: unitTotalSubtotal,
            company: assignedCompany, reason: warningReason
          });
        }

        entries.forEach(e => finalRearrangedData.push([...e.originalRow, assignedCompany]));
      });
    }
  }

  if (finalRearrangedData.length > 0) {
    rearrangedSheet.getRange(2, 1, finalRearrangedData.length, rearrangedHeaders.length).setValues(finalRearrangedData);
    Logger.log('Rearranged-worklog 寫入完成。');
  } else {
    Logger.log('沒有資料可寫入 Rearranged-worklog。');
  }

  // 寫入「警告」工作表
  const WARNING_SHEET_NAME = '警告';
  let warningSheet = ss.getSheetByName(WARNING_SHEET_NAME);
  if (!warningSheet) {
    warningSheet = ss.insertSheet(WARNING_SHEET_NAME);
  } else {
    warningSheet.clearContents();
  }

  if (assignedEntriesWithWarnings.length > 0) {
    const warningHeaders = ['員工編號', '姓名', '日期', '班別', '時數', '小計', '分配公司', '警告原因'];
    warningSheet.getRange(1, 1, 1, warningHeaders.length).setValues([warningHeaders]).setFontWeight('bold');
    const warningData = assignedEntriesWithWarnings.map(w => [
      w.employeeNo, w.employeeName, w.formattedDate,
      w.shiftType, w.hours, w.subtotal, w.company, w.reason
    ]);
    warningSheet.getRange(2, 1, warningData.length, warningHeaders.length).setValues(warningData);
    Logger.log(`共 ${assignedEntriesWithWarnings.length} 筆月小計溢出警告，已寫入「${WARNING_SHEET_NAME}」工作表。`);
    SpreadsheetApp.getUi().alert('⚠️ 月小計溢出', `有 ${assignedEntriesWithWarnings.length} 筆分配超出月小計上限（19,999），已允許溢出至 39,999。\n請查閱「${WARNING_SHEET_NAME}」工作表。`, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    Logger.log('✅ 時數分配完成，無警告。');
    SpreadsheetApp.getUi().alert('✅ 完成', '時數分配完成！', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}



function duplicateMergedBlock() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName('總檔');
  const paramSheet = ss.getSheetByName('檔案參數');

  const paramData = paramSheet.getDataRange().getValues();
  const headerRow = paramData[0];

  // Step 1: Map titles to column indexes
  const titleMap = {};
  for (let c = 0; c < headerRow.length; c++) {
    const title = headerRow[c]?.toString().trim();
    if (title) {
      titleMap[title] = c;
    }
  }

  // Step 2: Get name list from "姓名(Trim)" — read ALL rows, derive count automatically
  const nameCol = titleMap['姓名(Trim)'];
  if (nameCol === undefined) {
    throw new Error("找不到『姓名(Trim)』欄位");
  }
  const nameList = [];
  for (let r = 1; r < paramData.length; r++) {
    const name = paramData[r]?.[nameCol];
    if (name && name.toString().trim()) nameList.push(name.toString().trim());
  }

  if (nameList.length === 0) {
    throw new Error("『姓名(Trim)』欄位中沒有員工姓名，請先填入員工姓名");
  }

  const staffCount = nameList.length;

  // Auto-sync 員工數量 back to 檔案參數 so other functions stay in sync
  const staffCol = titleMap['員工數量'];
  if (staffCol !== undefined) {
    paramSheet.getRange(2, staffCol + 1).setValue(staffCount);
  }

  const repeatCount = staffCount - 1;

  // Step 4: Find the first merged cell in column A in 總檔
  const allMergedRanges = summarySheet.getRange(1, 1, summarySheet.getMaxRows()).getMergedRanges();
  let targetMergedRange = null;
  for (let range of allMergedRanges) {
    if (range.getColumn() === 1 && range.getNumColumns() === 1) {
      targetMergedRange = range;
      break;
    }
  }

  if (!targetMergedRange) {
    throw new Error('在「總檔」中找不到合併的欄位 A');
  }

  const startRow = targetMergedRange.getRow();
  const numRows = targetMergedRange.getNumRows();
  const numCols = summarySheet.getLastColumn();

  const sourceRange = summarySheet.getRange(startRow, 1, numRows, numCols);

  // Ensure sheet has enough rows for all employee blocks
  const totalRowsNeeded = startRow + numRows * staffCount - 1;
  const currentMaxRows = summarySheet.getMaxRows();
  if (totalRowsNeeded > currentMaxRows) {
    summarySheet.insertRowsAfter(currentMaxRows, totalRowsNeeded - currentMaxRows);
    SpreadsheetApp.flush();
  }

  // Step 5: Paste the first name to column D in original block
  // 👇 This line sets the first name into column D of the first block
  summarySheet.getRange(startRow, 4).setValue(nameList[0]);

  // 👇 Set the first sequence number in column A
  summarySheet.getRange(startRow, 1).setValue(1);

  // Step 6: Copy the block (staffCount - 1) times
  // flush() every 10 iterations prevents execution timeout for large employee counts
  for (let i = 1; i < staffCount; i++) {
    const pasteStartRow = startRow + numRows * i;
    const pasteRange = summarySheet.getRange(pasteStartRow, 1, numRows, numCols);

    // 👇 Copy the whole block including formatting and merged cells
    sourceRange.copyTo(pasteRange, SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);

    // 👇 Merge column A for the pasted block (optional for structure)
    summarySheet.getRange(pasteStartRow, 1, numRows).merge();

    // 👇 Set the sequence number for the merged block in column A
    summarySheet.getRange(pasteStartRow, 1).setValue(i + 1);

    // 👇 This line sets the corresponding name in column D
    summarySheet.getRange(pasteStartRow, 4).setValue(nameList[i]);

    if (i % 10 === 0) SpreadsheetApp.flush();
  }
  transferBlockToRearrangedSheet() 
}


function transferBlockToRearrangedSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName('總檔');
  const rearrangedSheet = ss.getSheetByName('安排後時間');
  const paramSheet = ss.getSheetByName('檔案參數');

  const frozenRows = summarySheet.getFrozenRows();
  const startRow = frozenRows + 1;
  const lastRow = summarySheet.getLastRow();
  const lastCol = summarySheet.getLastColumn();
  const numRows = lastRow - startRow + 1;

  // Copy entire block from 總檔 to 安排後時間
  const targetRange = rearrangedSheet.getRange(startRow, 1);
  summarySheet.getRange(`${startRow}:${lastRow}`).copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);

  //得先clear解除A2#REF問題
  const rearrangedHeader = rearrangedSheet.getRange(2, 1, 1, rearrangedSheet.getLastColumn()).getValues()[0];
  let formulaEndCol = rearrangedHeader.findIndex(val => val.toString().trim() === '時數');

  // Clear only A3 to the end of date columns (not "時數")
  const clearEndColLetter = getColumnLetter(formulaEndCol);
  rearrangedSheet.getRange(`A${startRow}:${clearEndColLetter}${lastRow}`).clear({ contentsOnly: true, skipFilteredRows: true });


  // Read header to locate formula range
  const rearrangedHeader2 = rearrangedSheet.getRange(2, 1, 1, rearrangedSheet.getLastColumn()).getValues()[0];
  //再次找尋輸入值，因為一開始G2不會有value
  const formulaStartCol = rearrangedHeader2.findIndex(val => val.toString().trim() === '離職日') + 1;

  if (formulaStartCol <= 0 || formulaEndCol <= 0) {
    throw new Error('找不到日期起始欄或「時數」欄，請確認第2列標題');
  }


  // Set and autofill formula in H3-like range
  const firstFormulaCell = rearrangedSheet.getRange(startRow, formulaStartCol + 1);
  const colLetter = columnToLetter(formulaStartCol + 1);
  const dayHeader = `${colLetter}$2`;

  const formula = `=IFERROR(FILTER('Rearranged-worklog'!$E:$E,'Rearranged-worklog'!$M:$M=$A$1,'Rearranged-worklog'!$A:$A=INDIRECT("$A"&(FLOOR(ROW()-3,'檔案參數'!$E$2)+3)),'Rearranged-worklog'!$C:$C=${dayHeader},'Rearranged-worklog'!$D:$D=$B${startRow}),"")`;
  firstFormulaCell.setFormula(formula);

  // AutoFill formulas (row, then area)
  const formulaWidth = formulaEndCol - (formulaStartCol );
  rearrangedSheet.getRange(startRow, formulaStartCol + 1).autoFill(
    rearrangedSheet.getRange(startRow, formulaStartCol + 1, 1, formulaWidth),
    SpreadsheetApp.AutoFillSeries.DEFAULT_SERIES
  );
  rearrangedSheet.getRange(startRow, formulaStartCol + 1, 1, formulaWidth).autoFill(
    rearrangedSheet.getRange(startRow, formulaStartCol + 1, numRows, formulaWidth),
    SpreadsheetApp.AutoFillSeries.DEFAULT_SERIES
  );
}

// Helper to convert column number to letter
function columnToLetter(column) {
  let temp = '';
  while (column > 0) {
    let rem = (column - 1) % 26;
    temp = String.fromCharCode(65 + rem) + temp;
    column = Math.floor((column - 1) / 26);
  }
  return temp;
}

function getColumnLetter(col) {
  let temp = '';
  while (col > 0) {
    let mod = (col - 1) % 26;
    temp = String.fromCharCode(65 + mod) + temp;
    col = Math.floor((col - mod) / 26);
  }
  return temp;
}

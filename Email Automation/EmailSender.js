/**
 * 處理並發送郵件
 * @param {string} draftId - 草稿範本 ID
 * @returns {Object} 處理結果
 * 此為prd環境
 */
function processSendEmails(draftId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const header = data.shift();

  const emailIndex = header.indexOf('Email');
  const sentTimeIndex = header.indexOf('Delivered');

  if (emailIndex === -1 || sentTimeIndex === -1) {
    return SpreadsheetApp.getUi().alert('缺少必要欄位 (Email、Delivered)，請檢查。');
  }

  // 找出所有模板參數欄位 (格式為 <<XXX>>)
  const parameterIndexes = getTemplateParameters(header);

  const draft = GmailApp.getDraft(draftId);
  const templateSubject = draft.getMessage().getSubject();
  const templateBody = draft.getMessage().getBody();

  const validRows = data.filter(row => row[emailIndex]);
  const totalEmails = validRows.length;
  let successCount = 0;
  let errorMessages = [];

  // 初始化進度
  PropertiesService.getUserProperties().setProperty("emailProgress", "0/" + totalEmails);

  // 顯示進度條 UI
  const htmlOutput = HtmlService.createHtmlOutputFromFile('ProgressUI').setWidth(400).setHeight(120);
  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, '寄送進度');

  validRows.forEach((row, i) => {
    let email;
    try {
      email = row[emailIndex];
      // 建立替換參數物件
      const replacements = getReplacements(parameterIndexes, row);

      // 替換範本主旨與內容中的參數
      const subject = replacePlaceholders(templateSubject, replacements);
      let messageBody = replacePlaceholders(templateBody, replacements);

      // 在郵件正文中的連結加入追蹤
      // messageBody = addTrackingToLinks(messageBody, email);
      // 在郵件正文中加入追蹤像素
      messageBody += createTrackingPixel(email, sheet);

      Logger.log(`準備發送郵件: ${email}，主旨: ${subject}`);

      // 發送電子郵件
      GmailApp.sendEmail(email, subject, '', {
        htmlBody: messageBody
      });
      sheet.getRange(i + 2, sentTimeIndex + 1).setValue(new Date());

      successCount++;
      PropertiesService.getUserProperties().setProperty("emailProgress", successCount + "/" + totalEmails);
    } catch (error) {
      errorMessages.push(`${email}：${error}`);
    }
  });

  // 顯示結果後，自動關閉 `ProgressUI`
  SpreadsheetApp.getUi().alert(`發送完成！成功: ${successCount}，失敗: ${errorMessages.length}`, SpreadsheetApp.getUi().ButtonSet.OK);

  // 顯示錯誤細節（如果有）
  if (errorMessages.length > 0) {
    Logger.log("❌ 發送錯誤列表：\n" + errorMessages.join("\n"));
    SpreadsheetApp.getUi().alert("部分郵件發送失敗，請檢查工作表中的錯誤欄位。");
  }
  closeAllDialogs();
}

/**
 * 取得目前郵件發送進度
 * @returns {string} 已發送 / 總數
 */
function getEmailProgress() {
  return PropertiesService.getUserProperties().getProperty("emailProgress") || "0/0";
}

/**
 * 關閉所有對話框
 */
function closeAllDialogs() {
  const html = HtmlService.createHtmlOutput("<script>google.script.host.close();</script>");
  SpreadsheetApp.getUi().showModalDialog(html, "關閉中...");
}

/**
 * 替換範本中的參數 
 * @param header 表頭 
 * @returns {Object} 參數名稱與索引的對應物件 
 */
function getTemplateParameters(header) {
  return header.reduce((acc, columnName, index) => {
    const match = columnName.match(/^<<(.*)>>$/);
    if (match) {
      acc[match[1]] = index;
    }
    return acc;
  }, {});
}

/**
 * 替換範本中的參數 
 * @param parameterIndexes 參數名稱與索引的對應物件 
 * @param row 資料列 
 * @returns {Object} 替換參數的物件 
 */
function getReplacements(parameterIndexes, row) {
  const replacements = {};
  for (const [paramName, columnIndex] of Object.entries(parameterIndexes)) {
    replacements[paramName] = row[columnIndex] || '';
  }
  return replacements;
}

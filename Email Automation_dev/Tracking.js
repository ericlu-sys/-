// 定義腳本基礎 URL 為全域變數
const BASE_URL = 'https://script.google.com/macros/s/AKfycbxjJyYSZMdJ2nBTPNZJGEnDFGSgLzM-R-mPKNRSJg3PPaJkf1RCb3cR4ab4Dr8WzOw7/exec';

/**
 * 在 Google Apps Script 中使用 Google Sheets 記錄郵件開啟和點擊行為 
 * @param e {object} - 請求參數
 * @returns {object} - 輸出內容 
 */
function doGet(e) {
  Logger.log('完整請求參數: ' + JSON.stringify(e));

  const params = e.parameter || {};
  const email = params.email;
  const action = params.action;
  const url = params.url;
  const sheetId = params.sheetId;

  if (!email || !action) {
    Logger.log('缺少必要參數');
    return ContentService.createTextOutput('Missing required parameters');
  }

  
  // 根據 sheetId 尋找對應的工作表
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  let sheet = null;
  for (let s of sheets) {
    if (s.getSheetId().toString() === sheetId) {
      sheet = s;
      break;
    }
  }

  if (!sheet) {
    Logger.log(`未找到 Sheet: ${sheetId}`);
    return ContentService.createTextOutput('Sheet not found');
  }

  // 讀取數據
  const data = sheet.getDataRange().getValues();
  const header = data.shift();

  const emailIndex = header.indexOf('Email');
  const openedIndex = header.indexOf('Opened');
  // const clickedIndex = header.indexOf('Clicked');
  // const clickedUrlsIndex = header.indexOf('Clicked URLs');
  // const respondedIndex = header.indexOf('Responded');
  // const bouncedIndex = header.indexOf('Bounced');

  if (emailIndex === -1 || openedIndex === -1) {
    Logger.log(`工作表結構無效: ${data}`);
    return ContentService.createTextOutput('Invalid sheet structure');
  }

  let found = false;

  data.forEach((row, i) => {
    if (row[emailIndex] === email) {
      const now = new Date();

      switch (action) {
        case 'opened':
          sheet.getRange(i + 2, openedIndex + 1).setValue(now);
          Logger.log(`郵件已開啟: ${email} 時間: ${now}`);
          break;

        case 'clicked':
          if (!url) {
            Logger.log('缺少url參數');
            return ContentService.createTextOutput('Missing required parameters');
          }
          sheet.getRange(i + 2, clickedIndex + 1).setValue(now);
          const currentUrls = row[clickedUrlsIndex] || '';
          const updatedUrls = currentUrls ? currentUrls + '\n' + url : url;
          sheet.getRange(i + 2, clickedUrlsIndex + 1).setValue(updatedUrls);
          Logger.log(`郵件已點擊: ${email}，URL: ${url}，時間: ${now}`);
          break;

        case 'responded':
          sheet.getRange(i + 2, respondedIndex + 1).setValue(now);
          Logger.log(`郵件已回覆: ${email} 時間: ${now}`);
          break;

        case 'bounced':
          sheet.getRange(i + 2, bouncedIndex + 1).setValue(now);
          Logger.log(`郵件已退回: ${email} 時間: ${now}`);
          break;
      }

      found = true;
    }
  });

  if (!found) {
    Logger.log(`未找到郵件: ${email}`);
    return ContentService.createTextOutput('Email not found');
  }

  return ContentService.createTextOutput('Success');
}


/**
 * 在範本中的每個連結加入追蹤功能 (保持原始網址)
 * @param {string} templateBody - HTML 範本
 * @param {string} email - 使用者電子郵件
 * @returns {string} - 加入追蹤的 HTML 範本
 */
function addTrackingToLinks(templateBody, email) {
  // 尋找 HTML 中的超連結
  const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>/gi;
  return templateBody.replace(linkRegex, (match, originalUrl) => {
    // 包裝成跳轉追蹤 URL
    const trackingUrl = `${BASE_URL}?email=${encodeURIComponent(email)}&action=clicked&url=${encodeURIComponent(originalUrl)}&timestamp=${new Date().getTime()}`;
    return match.replace(originalUrl, trackingUrl);
  });
}

/**
 * 創建追蹤像素，加入 sheetId 參數
 * @param {string} email - 使用者電子郵件
 * @param {Sheet} sheet - 寄送郵件的 Google Sheet
 * @returns {string} - 追蹤像素的 HTML
 */
function createTrackingPixel(email, sheet) {
  const sheetId = sheet.getSheetId(); // 取得工作表的唯一 ID
  return `
    <img src="${BASE_URL}?email=${encodeURIComponent(email)}&action=opened&sheetId=${sheetId}&timestamp=${new Date().getTime()}" width="1" height="1" style="display:none;" loading="eager" alt="Tracking Pixel" />
  `;
}

/**
 * 產生「開啟追蹤」的測試網址，以對話框顯示並提供一鍵複製。
 * 在瀏覽器開啟該網址後，若成功該列的 Opened 會寫入時間。
 */
function getTestOpenedTrackingUrl() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const sheetId = sheet.getSheetId().toString();
  const response = SpreadsheetApp.getUi().prompt('請輸入要測試的 Email（與試算表該列完全一致）');
  const email = response.getResponseText();
  if (!email || response.getSelectedButton() !== response.getButton()) return;
  const url = BASE_URL + '?email=' + encodeURIComponent(email) + '&action=opened&sheetId=' + sheetId + '&timestamp=' + new Date().getTime();
  Logger.log('追蹤測試網址: ' + url);
  showTestUrlDialog(url);
}

/**
 * 顯示測試網址對話框，含複製按鈕與圖示
 * @param {string} url - 要顯示並可複製的網址
 */
function showTestUrlDialog(url) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body { font-family: Arial, sans-serif; margin: 16px; font-size: 14px; color: #333; }
        p { margin: 0 0 10px 0; color: #555; }
        .url-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
        .url-box { flex: 1; padding: 10px 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; word-break: break-all; }
        .btn-copy { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border: none; border-radius: 6px; background: #5BBBC5; color: white; cursor: pointer; flex-shrink: 0; }
        .btn-copy:hover { background: #4a9ba3; }
        .btn-copy:active { transform: scale(0.98); }
        .btn-copy svg { width: 20px; height: 20px; }
        .toast { margin-top: 10px; font-size: 12px; color: #2e7d32; display: none; }
        .toast.show { display: block; }
      </style>
    </head>
    <body>
      <p>請複製以下網址到瀏覽器開啟，若成功該列的 Opened 會寫入時間。</p>
      <div class="url-row">
        <input type="text" class="url-box" id="trackingUrl" readonly value="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">
        <button type="button" class="btn-copy" id="btnCopy" title="複製網址">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
      <div class="toast" id="toast">已複製到剪貼簿</div>
      <script>
        (function() {
          var input = document.getElementById('trackingUrl');
          var btn = document.getElementById('btnCopy');
          var toast = document.getElementById('toast');
          btn.addEventListener('click', function() {
            input.select();
            input.setSelectionRange(0, 99999);
            try {
              navigator.clipboard.writeText(input.value);
              toast.classList.add('show');
              setTimeout(function() { toast.classList.remove('show'); }, 2000);
            } catch (e) {
              document.execCommand('copy');
              toast.classList.add('show');
              setTimeout(function() { toast.classList.remove('show'); }, 2000);
            }
          });
        })();
      </script>
    </body>
    </html>
  `;
  const htmlOutput = HtmlService.createHtmlOutput(html).setWidth(520).setHeight(160);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '測試追蹤網址');
}
/**
 * 主要函數，用於設置google sheet菜單
 * 這是一個特殊的函數，當Google Sheet打開時，會自動運行一次
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('郵件功能')
    .addItem('發送郵件', 'sendEmails')
    .addSeparator()
    .addItem('測試追蹤網址 (Opened)', 'getTestOpenedTrackingUrl')
    .addToUi();
}

/**
 * 主要發送郵件函數
 * 這個函數將打開一個對話框，使用者可以選擇一個草稿範本
 */
function sendEmails() {
  const ui = SpreadsheetApp.getUi();
  const htmlOutput = createDraftSelectionDialog();
  ui.showModalDialog(htmlOutput, "郵件自動化工具");
}

/**
 * 建立並回傳範本選擇對話框的 HTML
 * @returns {HtmlOutput} 對話框的 HTML 輸出
 */
function createDraftSelectionDialog() {
  // 取得所有草稿
  const drafts = GmailApp.getDrafts();
  const uniqueDrafts = new Map();

  // 依主旨整理草稿，保留最新版本
  drafts.forEach((draft) => {
    const subject = draft.getMessage().getSubject();
    const date = draft.getMessage().getDate();
    
    if (!uniqueDrafts.has(subject) || date > uniqueDrafts.get(subject).date) {
      uniqueDrafts.set(subject, { 
        id: draft.getId(), 
        name: subject,
        date: date
      });
    }
  });

  // 檢查是否有可用的草稿
  if (uniqueDrafts.size === 0) {
    SpreadsheetApp.getUi().alert('目前沒有可用的草稿範本。');
    return null;
  }

  // 建立對話框 HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: Arial, sans-serif; padding: 10px; }
          select { width: 100%; padding: 8px; margin-bottom: 20px; }
          button { 
            padding: 10px 15px; 
            background-color: #5BBBC5; 
            color: white; 
            border: none; 
            cursor: pointer; 
            width: 100%; 
          }
          button:hover { background-color: #4a9ba3; }
          .loading { display: none; text-align: center; padding: 20px; }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #5BBBC5;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div id="mainContent">
          <h2>選擇範本</h2>
          <select id="draftDropdown">
            ${Array.from(uniqueDrafts.values())
              .sort((a, b) => b.date - a.date)
              .map(draft => {
                const formattedDate = Utilities.formatDate(
                  draft.date, 
                  Session.getScriptTimeZone(), 
                  'yyyy/MM/dd HH:mm'
                );
                return `<option value="${draft.id}">${draft.name} (${formattedDate})</option>`;
              })
              .join('')}
          </select>
          <button id="sendButton" onclick="submitForm()">選擇並發送</button>
          <div id="loadingScreen" class="loading">
            <div class="spinner"></div>
          <p>準備中...</p>
          </div>
        </div>
        
        <script>
          // 提交表單處理
          function submitForm() {
            const draftId = document.getElementById('draftDropdown').value;
            if (!draftId) {
              alert('請選擇一個範本！');
              return;
            }
            
            // 停用發送按鈕並顯示進度條
            document.getElementById('sendButton').disabled = true;
            document.getElementById('loadingScreen').style.display = 'block';
            
            // 呼叫後端處理函數
            google.script.run
              .withSuccessHandler(function(result) {
                if (result.success) {
                  google.script.host.close();
                } else {
                  alert(result.message || '發送過程中發生錯誤');
                  document.getElementById('sendButton').disabled = false;
                }
              })
              .withFailureHandler(function(error) {
                alert('發生錯誤：' + error);
                document.getElementById('sendButton').disabled = false;
              })
              .processSendEmails(draftId);
          }

        </script>
      </body>
    </html>
  `;

  // 回傳 HTML 輸出
  return HtmlService.createHtmlOutput(htmlContent)
    .setWidth(400)
    .setHeight(350)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}
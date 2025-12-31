let allUsers = [];

async function init() {
  const select = document.getElementById('userSelect');
  
  // 1. 先設定一組預設資料（測試用），確保畫面不會空白
  allUsers = [{
    nameCn: "測試人員",
    nameEn: "Test User",
    titleCn: "職稱展示",
    titleEn: "Job Title",
    email: "test@wport.me",
    ext: "000",
    mobile: "0912-345-678"
  }];

  try {
    // 2. 嘗試從 API 抓取正式資料
    const response = await fetch('/api/portal?key=employee_json');
    if (response.ok) {
      const data = await response.json();
      allUsers = typeof data === 'string' ? JSON.parse(data) : data;
      console.log("成功取得遠端資料");
    }
  } catch (err) {
    // 3. 如果失敗了，只在 Console 報錯，不打斷畫面渲染
    console.warn("無法取得遠端資料，改用預設資料顯示：", err.message);
  }

  // 4. 不管 API 成功或失敗，都執行渲染
  if (allUsers && allUsers.length > 0) {
    select.innerHTML = allUsers.map((u, i) => 
      `<option value="${i}">${u.nameCn} ${u.nameEn}</option>`
    ).join('');
    
    render(); // 執行渲染，這樣格式就出來了！
  }
}

function render() {
  const select = document.getElementById('userSelect');
  const idx = select.value;
  const user = allUsers[idx];
  
  if (!user) {
    console.warn("找不到對應的員工資料, index:", idx);
    return;
  }

  console.log("目前渲染對象:", user);

  const showCompanyTel = document.getElementById('showCompanyTel').checked;
  const showMobile = document.getElementById('showMobile').checked;

  // 確保欄位名稱與你 GAS 傳出的一致
  const nameCn = user.nameCn || "";
  const nameEn = user.nameEn || "";
  const titleCn = user.titleCn || "";
  const titleEn = user.titleEn ? ` ${user.titleEn}` : "";
  const email = user.email || "";
  const ext = user.ext || "";
  const mobile = user.mobile || "";

  const telHtml = showCompanyTel ? `TEL: (03)-370-2101${ext ? ` #${ext}` : ""}<br>` : "";
  const mobileHtml = (showMobile && mobile) ? `MOBILE: ${mobile}<br>` : "";

  const htmlContent = `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Microsoft JhengHei', sans-serif; color: #4d4d4d; line-height: 1.6; border-collapse: collapse;">
  <tr>
    <td valign="top" style="width: 160px; padding-right: 25px; text-align: center; height: 1px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 160px; height: 100%;">
        <tr>
          <td valign="top" style="padding-bottom: 10px;">
            <a href="https://wport.me" target="_blank">
              <img src="https://cdn.wport.me/static/mediazone/images/ecde4f0e-5113-4ff0-b4bb-6aacddbd56cd.jpg" alt="wport" width="160" style="display: block; border: 0;">
            </a>
          </td>
        </tr>
        <tr>
          <td valign="middle" style="padding: 10px 0;">
            <img src="https://cdn.wport.me/static/mediazone/images/dff654fd-9a13-4e94-b262-d9ea46a472e6.jpg" alt="職航站" width="160" style="display: block; margin-bottom: 6px; border: 0;">
            <img src="https://cdn.wport.me/static/mediazone/images/05671818-9cd4-45c7-be3e-72617cb9ecfd.jpg" alt="熱火數碼資訊" width="160" style="display: block; border: 0;">
          </td>
        </tr>
        <tr>
          <td valign="bottom" style="padding-top: 10px;">
            <table cellpadding="0" cellspacing="0" border="0" width="160" style="width: 160px;">
              <tr>
                <td align="left" width="32"><a href="https://www.facebook.com/wportjobstation" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/9479489e-f34f-47ab-860a-afdeb74738f3.jpg" width="26" alt="FB_icon" style="display: block; border: 0;"></a></td>
                <td align="center" width="32"><a href="https://www.instagram.com/wport.me/" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/de4bf454-62be-47df-a72c-bda39845433c.jpg" width="26" alt="IG_icon" style="display: block; border: 0;"></a></td>
                <td align="center" width="32"><a href="https://www.tiktok.com/@wport.me" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/aa929f06-d3a3-45d7-8371-19769dad1bde.jpg" width="26" alt="Tiktok_icon" style="display: block; border: 0;"></a></td>
                <td align="center" width="32"><a href="https://www.youtube.com/@wport-me" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/4511738a-6648-4e82-843c-9bb72aafc010.jpg" width="26" alt="Youtube_icon" style="display: block; border: 0;"></a></td>
                <td align="right" width="32"><a href="https://www.linkedin.com/company/wport" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/4baad69e-9773-4965-9c00-7550a0587958.jpg" width="26" alt="Linkedin_icon" style="display: block; border: 0;"></a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>

    <td style="border-left: 1px solid #d1d1d1; padding: 0; width: 1px;">&nbsp;</td>

    <td valign="top" style="padding-left: 25px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="padding-bottom: 12px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 24px; color: #44b2aa; font-weight: bold; letter-spacing: 2px; line-height: 1.2;">${nameCn} ${nameEn}</td>
              </tr>
              <tr>
                <td style="font-size: 18px; color: #4d4d4d; font-weight: bold; line-height: 1.8; padding-top: 4px;">${titleCn}${titleEn}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="font-size: 14px; color: #4d4d4d; line-height: 1.8;">
            ${telHtml}
            ${mobileHtml}
            E-mail: <a href="mailto:${email}" style="color: #4d4d4d; text-decoration: none;">${email}</a><br>
            統一編號：89121689<br>
            338 桃園市蘆竹區新興里文新街 7 號 5 樓
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  document.getElementById('sig-container').innerHTML = htmlContent;
}

// 監聽事件
document.getElementById('userSelect')?.addEventListener('change', render);
document.getElementById('showCompanyTel')?.addEventListener('change', render);
document.getElementById('showMobile')?.addEventListener('change', render);

document.getElementById('copyBtn')?.addEventListener('click', async () => {
  const container = document.getElementById('sig-container');
  
  try {
    // Create a temporary container to ensure clean HTML copy
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.innerHTML = container.innerHTML;
    document.body.appendChild(tempDiv);
    
    // Method 1: Try modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        const htmlContent = tempDiv.innerHTML;
        const textContent = tempDiv.innerText || tempDiv.textContent;
        
        // Create a blob with HTML content
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([textContent], { type: 'text/plain' });
        
        if (window.ClipboardItem) {
          const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          });
          await navigator.clipboard.write([clipboardItem]);
        } else {
          // Fallback: copy as HTML using execCommand
          const range = document.createRange();
          range.selectNodeContents(tempDiv);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('copy');
          selection.removeAllRanges();
        }
      } catch (clipboardError) {
        // Fallback to execCommand
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
      }
    } 
    // Method 2: Fallback to execCommand
    else {
      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('copy');
      selection.removeAllRanges();
    }
    
    // Clean up
    document.body.removeChild(tempDiv);
    
    const btn = document.getElementById('copyBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ 已複製！';
    setTimeout(() => btn.innerHTML = originalText, 2000);
  } catch (err) {
    console.error('Copy failed:', err);
    alert('複製失敗，請手動選取簽名檔內容並複製');
  }
});

// 啟動
init();
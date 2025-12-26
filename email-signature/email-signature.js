let allUsers = [];

/**
 * 初始化：從 KV 抓取資料並填充選單
 */
async function init() {
  const select = document.getElementById('userSelect');
  const container = document.getElementById('sig-container');
  
  try {
    // 關鍵：這裡必須對應你存入的 Key 名稱
    const response = await fetch('/api/portal?key=employee_json');
    if (!response.ok) throw new Error('無法從伺服器取得資料');
    
    allUsers = await response.json();
    
    if (allUsers && allUsers.length > 0) {
      // 填充下拉選單
      select.innerHTML = allUsers.map((u, i) => 
        `<option value="${i}">${u.nameCn || ''} ${u.nameEn || ''}</option>`
      ).join('');
      
      // 移除載入中動畫並渲染第一筆
      document.getElementById('loader')?.remove();
      render(); 
    } else {
      select.innerHTML = '<option>名單目前是空的</option>';
    }
  } catch (err) {
    console.error("載入失敗:", err);
    select.innerHTML = '<option>連線失敗</option>';
    container.innerHTML = `<p style="color:red; text-align:center;">錯誤：${err.message}<br>請確認 KV 是否已有資料。</p>`;
  }
}

/**
 * 渲染名片 HTML
 */
function render() {
  const idx = document.getElementById('userSelect').value;
  const user = allUsers[idx];
  if (!user) return;

  const showCompanyTel = document.getElementById('showCompanyTel').checked;
  const showMobile = document.getElementById('showMobile').checked;

  // 取得變數
  const nameCn = user.nameCn || "";
  const nameEn = user.nameEn || "";
  const titleCn = user.titleCn || "";
  const titleEn = user.titleEn ? ` ${user.titleEn}` : "";
  const email = user.email || "";
  const ext = user.ext || "";
  const mobile = user.mobile || "";

  const telHtml = showCompanyTel ? `TEL: (03)-370-2101${ext ? ` #${ext}` : ""}<br>` : "";
  const mobileHtml = (showMobile && mobile) ? `MOBILE: ${mobile}<br>` : "";

  // 產生簽名檔內容 (與你原始設計一致)
  const htmlContent = `
    <table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Microsoft JhengHei', sans-serif; color: #4d4d4d; line-height: 1.6; border-collapse: collapse;">
      <tr>
        <td valign="top" style="width: 160px; padding-right: 25px; text-align: center;">
          <img src="https://cdn.wport.me/static/mediazone/images/816d4514-4692-41bc-b146-cec5115716a8.svg" width="160" style="display: block; margin-bottom: 10px;">
          <img src="https://cdn.wport.me/static/mediazone/images/b1de9d75-4dac-484d-8d2a-bd385c5d7adc.svg" width="160" style="display: block; margin-bottom: 6px;">
          <img src="https://cdn.wport.me/static/mediazone/images/05c0d90a-2fc6-42fa-ab70-15140ac62511.svg" width="160" style="display: block; margin-bottom: 15px;">
        </td>
        <td style="border-left: 1px solid #d1d1d1; padding-left: 25px;">
          <div style="font-size: 24px; color: #44b2aa; font-weight: bold; letter-spacing: 2px;">${nameCn} ${nameEn}</div>
          <div style="font-size: 18px; color: #4d4d4d; font-weight: bold; line-height: 1.8;">${titleCn}${titleEn}</div>
          <div style="font-size: 14px; color: #4d4d4d; margin-top: 10px;">
            ${telHtml}${mobileHtml}
            E-mail: <a href="mailto:${email}" style="color: #4d4d4d; text-decoration: none;">${email}</a><br>
            統一編號：89121689<br>
            338 桃園市蘆竹區新興里文新街 7 號 5 樓
          </div>
        </td>
      </tr>
    </table>`;

  document.getElementById('sig-container').innerHTML = htmlContent;
}

// 監聽器
document.getElementById('userSelect').addEventListener('change', render);
document.getElementById('showCompanyTel').addEventListener('change', render);
document.getElementById('showMobile').addEventListener('change', render);

// 一鍵複製功能
document.getElementById('copyBtn').addEventListener('click', () => {
  const container = document.getElementById('sig-container');
  const range = document.createRange();
  range.selectNode(container);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  
  try {
    document.execCommand('copy');
    const btn = document.getElementById('copyBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i>已複製成功';
    setTimeout(() => btn.innerHTML = originalText, 2000);
  } catch (err) {
    alert('複製失敗，請手動全選名片區域。');
  }
});

// 啟動程式
init();
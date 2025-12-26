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
              <img src="https://cdn.wport.me/static/mediazone/images/816d4514-4692-41bc-b146-cec5115716a8.svg" alt="wport" width="160" style="display: block; border: 0;">
            </a>
          </td>
        </tr>
        <tr>
          <td valign="middle" style="padding: 10px 0;">
            <img src="https://cdn.wport.me/static/mediazone/images/b1de9d75-4dac-484d-8d2a-bd385c5d7adc.svg" alt="職航站" width="160" style="display: block; margin-bottom: 6px; border: 0;">
            <img src="https://cdn.wport.me/static/mediazone/images/05c0d90a-2fc6-42fa-ab70-15140ac62511.svg" alt="熱火數碼資訊" width="160" style="display: block; border: 0;">
          </td>
        </tr>
        <tr>
          <td valign="bottom" style="padding-top: 10px;">
            <table cellpadding="0" cellspacing="0" border="0" width="160" style="width: 160px;">
              <tr>
                <td align="left" width="32"><a href="https://www.facebook.com/profile.php?id=61559574624536" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/2d99beb5-bdce-4356-85d9-64abead2f925.svg" width="26" alt="FB_icon" style="display: block; border: 0;"></a></td>
                <td align="center" width="32"><a href="https://www.instagram.com/eric_rookie_ceo/" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/95ae3007-ce61-4d66-a1ae-b283e42e47d1.svg" width="26" alt="IG_icon" style="display: block; border: 0;"></a></td>
                <td align="center" width="32"><a href="https://www.tiktok.com/@wport.me" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/04af89be-2aa3-4c14-a08b-0f9d2eacaf42.svg" width="26" alt="Tiktok_icon" style="display: block; border: 0;"></a></td>
                <td align="center" width="32"><a href="https://www.youtube.com/@wport-me" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/d02c9914-d271-4f2f-bf77-797a056d2c4b.svg" width="26" alt="Youtube_icon" style="display: block; border: 0;"></a></td>
                <td align="right" width="32"><a href="https://www.linkedin.com/company/wport" target="_blank"><img src="https://cdn.wport.me/static/mediazone/images/9b6b0b03-a909-4e02-9612-d0ba9accafe7.svg" width="26" alt="Linkedin_icon" style="display: block; border: 0;"></a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>

    <td style="border-left: 1px solid #d1d1d1; padding: 0; width: 1px;">&nbsp;</td>

    <td valign="top" style="padding-left: 25px;">
      <div style="margin-bottom: 12px;">
        <div style="font-size: 24px; color: #44b2aa; font-weight: bold; letter-spacing: 2px; line-height: 1.2;">${nameCn} ${nameEn}</div>
        <div style="font-size: 18px; color: #4d4d4d; font-weight: bold; line-height: 1.8;">${titleCn}${titleEn}</div>
      </div>
      
      <div style="font-size: 14px; color: #4d4d4d; line-height: 1.8;">
        ${telHtml}
        ${mobileHtml}
        E-mail: <a href="mailto:${email}" style="color: #4d4d4d; text-decoration: none;">${email}</a><br>
        統一編號：89121689<br>
        338 桃園市蘆竹區新興里文新街 7 號 5 樓
      </div>
    </td>
  </tr>
</table>`;

  document.getElementById('sig-container').innerHTML = htmlContent;
}

// 監聽事件
document.getElementById('userSelect')?.addEventListener('change', render);
document.getElementById('showCompanyTel')?.addEventListener('change', render);
document.getElementById('showMobile')?.addEventListener('change', render);

document.getElementById('copyBtn')?.addEventListener('click', () => {
  const container = document.getElementById('sig-container');
  const range = document.createRange();
  range.selectNode(container);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  document.execCommand('copy');
  
  const btn = document.getElementById('copyBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '✅ 已複製！';
  setTimeout(() => btn.innerHTML = originalText, 2000);
});

// 啟動
init();
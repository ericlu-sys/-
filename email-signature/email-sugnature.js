let allUsers = [];

async function init() {
  const select = document.getElementById('userSelect');
  try {
    const response = await fetch('/api/signature');
    if (!response.ok) throw new Error('API 抓取失敗');
    
    allUsers = await response.json();
    
    if (allUsers && allUsers.length > 0) {
      // 1. 填充下拉選單
      select.innerHTML = allUsers.map((u, i) => 
        `<option value="${i}">${u.nameCn} ${u.nameEn}</option>`
      ).join('');
      
      // 2. 移除 Loader 並執行初次渲染
      document.getElementById('loader')?.remove();
      render(); 
    } else {
      select.innerHTML = '<option>名單為空</option>';
    }
  } catch (err) {
    console.error("初始化失敗:", err);
    select.innerHTML = '<option>無法載入名單</option>';
    document.getElementById('sig-container').innerHTML = `<p class="text-red-400">載入失敗: ${err.message}</p>`;
  }
}

function render() {
  const idx = document.getElementById('userSelect').value;
  const user = allUsers[idx];
  if (!user) return;

  const showCompanyTel = document.getElementById('showCompanyTel').checked;
  const showMobile = document.getElementById('showMobile').checked;

  // 預處理資料（對應你的 GAS 欄位名）
  const nameCn = user.nameCn || "";
  const nameEn = user.nameEn || "";
  const titleCn = user.titleCn || "";
  const titleEnStr = user.titleEn ? ` ${user.titleEn}` : "";
  const email = user.email || "";
  const telHtml = showCompanyTel ? `TEL: (03)-370-2101${user.ext ? ` #${user.ext}` : ""}<br>` : "";
  const mobileHtml = (showMobile && user.mobile) ? `MOBILE: ${user.mobile}<br>` : "";

  const htmlContent = `
    <table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Microsoft JhengHei', sans-serif; color: #4d4d4d; line-height: 1.6; border-collapse: collapse;">
      <tr>
        <td valign="top" style="width: 160px; padding-right: 25px; text-align: center;">
          <table cellpadding="0" cellspacing="0" border="0" style="width: 160px;">
            <tr>
              <td style="padding-bottom: 10px;">
                <img src="https://cdn.wport.me/static/mediazone/images/816d4514-4692-41bc-b146-cec5115716a8.svg" alt="wport" width="160" style="display: block; border: 0;">
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <img src="https://cdn.wport.me/static/mediazone/images/b1de9d75-4dac-484d-8d2a-bd385c5d7adc.svg" alt="職航站" width="160" style="display: block; margin-bottom: 6px; border: 0;">
                <img src="https://cdn.wport.me/static/mediazone/images/05c0d90a-2fc6-42fa-ab70-15140ac62511.svg" alt="熱火數碼" width="160" style="display: block; border: 0;">
              </td>
            </tr>
            <tr>
              <td style="padding-top: 10px;">
                <table cellpadding="0" cellspacing="0" border="0" width="160">
                  <tr>
                    <td align="left"><a href="https://www.facebook.com/w101blog/"><img src="https://cdn.wport.me/static/mediazone/images/2d99beb5-bdce-4356-85d9-64abead2f925.svg" width="24" style="border:0;"></a></td>
                    <td align="center"><a href="https://www.instagram.com/w101.com.tw/"><img src="https://cdn.wport.me/static/mediazone/images/95ae3007-ce61-4d66-a1ae-b283e42e47d1.svg" width="24" style="border:0;"></a></td>
                    <td align="center"><a href="https://www.tiktok.com/@wport.me"><img src="https://cdn.wport.me/static/mediazone/images/04af89be-2aa3-4c14-a08b-0f9d2eacaf42.svg" width="24" style="border:0;"></a></td>
                    <td align="center"><a href="https://www.youtube.com/@wport-me"><img src="https://cdn.wport.me/static/mediazone/images/d02c9914-d271-4f2f-bf77-797a056d2c4b.svg" width="24" style="border:0;"></a></td>
                    <td align="right"><a href="https://www.linkedin.com/company/wport"><img src="https://cdn.wport.me/static/mediazone/images/9b6b0b03-a909-4e02-9612-d0ba9accafe7.svg" width="24" style="border:0;"></a></td>
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
            <div style="font-size: 18px; color: #4d4d4d; font-weight: bold; line-height: 1.8;">${titleCn}${titleEnStr}</div>
          </div>
          <div style="font-size: 14px; color: #4d4d4d; line-height: 1.8;">
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

// 綁定所有互動
document.getElementById('userSelect').addEventListener('change', render);
document.getElementById('showCompanyTel').addEventListener('change', render);
document.getElementById('showMobile').addEventListener('change', render);
document.getElementById('copyBtn').addEventListener('click', () => {
  const range = document.createRange();
  range.selectNode(document.getElementById('sig-container'));
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  try {
    document.execCommand('copy');
    const btn = document.getElementById('copyBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i>已複製成功';
    setTimeout(() => btn.innerHTML = originalText, 2000);
  } catch (err) {
    alert('複製失敗，請手動選取名片。');
  }
});

init();
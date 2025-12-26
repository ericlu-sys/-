// @ts-nocheck

function renderSignature(data) {
    const container = document.getElementById("signatureContainer");
    container.innerHTML = "";
  
    if (!data || !data.length) {
      container.innerHTML = `<p class="text-gray-400">尚無簽名資料</p>`;
      return;
    }
  
    data.forEach(item => {
      const div = document.createElement("div");
      div.className = "rounded-xl p-4 border border-gray-200 mb-3 bg-white shadow-sm";
  
      div.innerHTML = `
        <p><strong>${item.name}</strong> | ${item.title}</p>
        <p>${item.email}</p>
        <button class="btn-copy px-4 py-1 rounded bg-[#56C7BB] text-white mt-2">複製簽名</button>
      `;
  
      const btn = div.querySelector(".btn-copy");
      btn.addEventListener("click", () => {
        const text = `${item.name} | ${item.title}\n${item.email}`;
        navigator.clipboard.writeText(text);
        alert("簽名已複製到剪貼簿");
      });
  
      container.appendChild(div);
    });
  }
  
  // 從 Worker 注入的資料
  const signatureData = JSON.parse('%%SAFE_JSON%%');
  renderSignature(signatureData);
  
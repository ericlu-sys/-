// portal/portal.js

async function initPortal() {
    try {
        // 1. 去你剛剛建好的 API 拿資料
        const response = await fetch('/api/portal');
        if (!response.ok) throw new Error('API 回應錯誤');
        
        const links = await response.json();
        
        // 2. 執行你原本的渲染邏輯 (這部分是你原本 portal.js 裡的內容)
        renderLinks(links); 
        renderTags(links);
        setupSearch(links);

    } catch (error) {
        console.error('載入失敗:', error);
        document.getElementById('linksContainer').innerHTML = `<p class="text-red-500">無法載入資料: ${error.message}</p>`;
    }
}

// 這裡放你原本 portal.js 的其餘 function (例如 renderLinks 等)
// ...

// 啟動
initPortal();
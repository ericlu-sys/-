// portal/portal.js
// 1. 啟動函式
async function initPortal() {
    try {
        const response = await fetch('/api/portal');
        if (!response.ok) throw new Error('API 回應錯誤');
        
        const links = await response.json();
        
        // 呼叫下方定義的渲染功能
        renderLinks(links); 
        // 如果你還有標籤過濾和搜尋功能，也可以在這裡啟動
        // renderTags(links);
        // setupSearch(links);

    } catch (error) {
        console.error('載入失敗:', error);
        document.getElementById('linksContainer').innerHTML = `<p class="text-red-500">無法載入資料: ${error.message}</p>`;
    }
}

// 2. 定義渲染連結的函式 (就是這一段不見了！)
function renderLinks(links) {
    const container = document.getElementById('linksContainer');
    if (!container) return;

    container.innerHTML = links.map(link => `
        <a href="${link.url}" target="_blank" class="block p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all group">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl ${link.color || 'text-teal-600'}">
                    <i class="${link.icon || 'fa-solid fa-link'}"></i>
                </div>
                <div>
                    <h3 class="font-bold text-slate-700 group-hover:text-[#56C7BB] transition-colors">${link.name}</h3>
                    <p class="text-sm text-slate-400">${link.tag}</p>
                </div>
            </div>
        </a>
    `).join('');
}

// 3. 執行
initPortal();
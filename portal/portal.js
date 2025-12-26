// portal/portal.js

let allLinks = []; // 儲存原始資料

async function initPortal() {
    try {
        const response = await fetch('/api/portal');
        if (!response.ok) throw new Error('API 回應錯誤');
        
        allLinks = await response.json();
        
        // 初始渲染
        renderTags(allLinks);
        renderLinks(allLinks);
        setupSearch();

    } catch (error) {
        console.error('載入失敗:', error);
        document.getElementById('linksContainer').innerHTML = 
            `<p class="text-red-500 text-center py-10">無法載入資料: ${error.message}</p>`;
    }
}

// 渲染卡片 (還原舊版風格)
function renderLinks(links) {
    const container = document.getElementById('linksContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (links.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = links.map(link => `
        <a href="${link.url}" target="_blank" 
           class="group relative bg-white rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] border border-slate-50 flex flex-col h-full">
            <div class="flex justify-between items-start mb-8">
                <div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl transition-colors duration-500 group-hover:bg-[#56C7BB]/10 ${link.color || 'text-teal-600'}">
                    <i class="${link.icon || 'fa-solid fa-link'}"></i>
                </div>
                <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-500 text-[#56C7BB]">
                    <i class="fa-solid fa-arrow-up-right-from-square text-lg"></i>
                </div>
            </div>
            <div>
                <span class="inline-block px-3 py-1 rounded-lg bg-slate-50 text-slate-400 text-[10px] font-bold tracking-wider uppercase mb-3 group-hover:bg-[#56C7BB]/5 group-hover:text-[#56C7BB] transition-colors">
                    ${link.tag}
                </span>
                <h3 class="text-xl font-bold text-slate-800 mb-2">${link.name}</h3>
                <p class="text-slate-400 text-sm font-light leading-relaxed line-clamp-2">
                    點擊進入 ${link.name} 的相關資源與系統。
                </p>
            </div>
        </a>
    `).join('');
}

// 渲染標籤
function renderTags(links) {
    const filterTags = document.getElementById('filterTags');
    const tags = ['全部', ...new Set(links.map(l => l.tag))];
    
    filterTags.innerHTML = tags.map(tag => `
        <button onclick="filterByTag('${tag}')" 
                class="tag-btn px-6 py-2.5 rounded-2xl bg-white shadow-sm text-sm font-medium text-slate-500 hover:text-[#56C7BB] transition-all border border-transparent hover:border-[#56C7BB]/20">
            ${tag}
        </button>
    `).join('');
}

// 搜尋功能
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allLinks.filter(l => 
            l.name.toLowerCase().includes(term) || 
            l.tag.toLowerCase().includes(term)
        );
        renderLinks(filtered);
    });
}

// 標籤過濾 (掛載到 window 以供 HTML onclick 呼叫)
window.filterByTag = (tag) => {
    const filtered = tag === '全部' ? allLinks : allLinks.filter(l => l.tag === tag);
    renderLinks(filtered);
    
    // 更新按鈕樣式 (選中狀態)
    document.querySelectorAll('.tag-btn').forEach(btn => {
        if (btn.innerText.trim() === tag) {
            btn.classList.add('bg-[#56C7BB]', 'text-white', 'shadow-md');
        } else {
            btn.classList.remove('bg-[#56C7BB]', 'text-white', 'shadow-md');
        }
    });
};

initPortal();
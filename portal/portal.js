let allLinks = [];

async function initPortal() {
    try {
        const response = await fetch('/api/portal');
        if (!response.ok) throw new Error('API 回應錯誤');
        
        const rawData = await response.json();
        
        // 處理複數 Tag 邏輯
        allLinks = rawData.map(item => ({
            ...item,
            tagArray: item.tag ? item.tag.split(',').map(t => t.trim()) : ["未分類"]
        }));
        
        renderTags();
        renderLinks(allLinks);
        setupSearch();

    } catch (error) {
        console.error('載入失敗:', error);
        document.getElementById('linksContainer').innerHTML = `<p class="text-red-500 text-center py-10">無法載入資料: ${error.message}</p>`;
    }
}

function renderLinks(links) {
    const container = document.getElementById('linksContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (links.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = links.map(item => `
        <a href="${item.url}" target="_blank" 
           class="link-card group bg-white p-7 rounded-3xl shadow-sm border border-transparent hover:border-[#56C7BB] hover:shadow-2xl hover:shadow-[#56C7BB]/10 flex flex-col justify-between relative overflow-hidden transition-all duration-400">
            
            <div class="flex items-start justify-between mb-6">
                <div class="w-14 h-14 rounded-2xl bg-[#56C7BB]/10 flex items-center justify-center text-[#56C7BB] text-2xl group-hover:scale-110 transition-transform duration-300">
                    <i class="${item.icon || 'fa-solid fa-link'}"></i>
                </div>
                <div class="flex flex-wrap gap-1.5 justify-end max-w-[150px]">
                    ${item.tagArray.map(t => `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-400 border border-slate-100 uppercase tracking-tighter">${t}</span>`).join('')}
                </div>
            </div>
            
            <div>
                <h3 class="text-xl font-bold text-slate-800 mb-2 group-hover:text-[#56C7BB] transition-colors">${item.name}</h3>
                <p class="text-sm text-slate-400 truncate font-light">${item.url.replace('https://', '')}</p>
            </div>

            <div class="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                <i class="fa-solid fa-arrow-right text-[#56C7BB]"></i>
            </div>
        </a>
    `).join('');
}

function renderTags() {
    const filterTags = document.getElementById('filterTags');
    const tags = ["全部"];
    allLinks.forEach(item => {
        item.tagArray.forEach(t => { if (!tags.includes(t)) tags.push(t); });
    });
    
    filterTags.innerHTML = tags.map(tag => `
        <button onclick="filterByTag('${tag}')" 
                class="tag-btn px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 font-medium hover:bg-slate-50 transition-all">
            ${tag}
        </button>
    `).join('');
    
    // 預設選中全部
    const firstBtn = filterTags.querySelector('button');
    if (firstBtn) firstBtn.classList.add('active');
}

window.filterByTag = (tag) => {
    const filtered = tag === '全部' ? allLinks : allLinks.filter(l => l.tagArray.includes(tag));
    renderLinks(filtered);
    
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.trim() === tag);
    });
};

function setupSearch() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allLinks.filter(l => 
            l.name.toLowerCase().includes(term) || 
            l.tagArray.some(t => t.toLowerCase().includes(term))
        );
        renderLinks(filtered);
    });
}

initPortal();
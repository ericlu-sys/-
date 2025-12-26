// @ts-nocheck

let currentTag = "全部";
let currentSearch = "";

// 處理複數 Tag
linkData.forEach(item => {
  item.tagArray = item.tag ? item.tag.split(',').map(t => t.trim()) : ["未分類"];
});

const allTags = ["全部"];
linkData.forEach(item => {
  item.tagArray.forEach(t => {
    if (!allTags.includes(t)) allTags.push(t);
  });
});

// 建立 Tag 按鈕
const filterTagsContainer = document.getElementById("filterTags");
allTags.forEach(tag => {
  const btn = document.createElement("button");
  btn.className = "tag-btn px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 font-medium hover:bg-slate-50 transition-all";
  btn.innerText = tag;
  btn.addEventListener("click", () => filterByTag(tag));
  filterTagsContainer.appendChild(btn);
});

function filterByTag(tag) {
  currentTag = tag;
  updateUI();
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.trim() === tag);
  });
}

document.getElementById('searchInput').addEventListener("input", e => {
  currentSearch = e.target.value.toLowerCase();
  updateUI();
});

function updateUI() {
  const container = document.getElementById("linksContainer");
  container.innerHTML = "";
  let hasVisible = false;

  linkData.forEach(item => {
    const matchesTag = (currentTag === "全部" || item.tagArray.includes(currentTag));
    const matchesSearch = item.name.toLowerCase().includes(currentSearch);

    if (matchesTag && matchesSearch) {
      hasVisible = true;
      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.className = "link-card group bg-white p-7 rounded-3xl shadow-sm border border-transparent hover:border-[#56C7BB] hover:shadow-2xl hover:shadow-[#56C7BB]/10 flex flex-col justify-between relative overflow-hidden";
      a.dataset.tags = JSON.stringify(item.tagArray);
      a.dataset.name = item.name;

      a.innerHTML = `
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
          <p class="text-sm text-slate-400 truncate font-light">${item.url.replace('https://','')}</p>
        </div>
        <div class="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
          <i class="fa-solid fa-arrow-right text-[#56C7BB]"></i>
        </div>
      `;
      container.appendChild(a);
    }
  });

  document.getElementById('emptyState').classList.toggle('hidden', hasVisible);
}

updateUI();

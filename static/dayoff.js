// @ts-nocheck
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
              .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }
  
  function renderEvents(events) {
    const list = document.getElementById("eventList");
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
    list.style.display = "flex";
  
    list.innerHTML = "";
  
    if (!events.length) {
      document.getElementById("noEvents").style.display = "block";
      return;
    } else {
      document.getElementById("noEvents").style.display = "none";
    }
  
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1).getTime()-1;
  
    events.forEach(event => {
      const start = new Date(event.startTime).getTime();
      const end = new Date(event.endTime).getTime();
  
      const div = document.createElement("div");
      div.className = "event rounded-xl p-4 border-l-4 border-[#56C7BB] shadow-sm mb-2" + ((todayStart <= end && todayEnd >= start) ? " today bg-[#56C7BB] text-white" : "");
  
      div.innerHTML = `
        <div>
          <strong>${escapeHTML(event.title)}</strong>
          <div class="date">🗓 ${new Date(event.startTime).toLocaleString()} ~ ${new Date(event.endTime).toLocaleString()}</div>
          <div class="date">📅 ${escapeHTML(event.calendarName)}</div>
        </div>
      `;
      list.appendChild(div);
    });
  }
  
  function filterEvents(keyword) {
    const lower = keyword.trim().toLowerCase();
    const filtered = allEvents.filter(e => e.title.toLowerCase().includes(lower) || e.calendarName.toLowerCase().includes(lower));
    renderEvents(filtered);
  }
  
  function sortEvents(order) {
    const sorted = [...allEvents].sort((a,b)=> {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      return order==="asc"? aTime-bTime : bTime-aTime;
    });
    renderEvents(sorted);
  }
  
  document.getElementById("filterInput").addEventListener("input", e => filterEvents(e.target.value));
  document.getElementById("sortOrder")?.addEventListener("change", e => sortEvents(e.target.value));
  
  sortEvents("desc");
  
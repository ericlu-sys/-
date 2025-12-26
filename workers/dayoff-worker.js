export default {
    async fetch(request, env) {
      let dayOffData = [];
      try {
        // 單一 KV binding, 前綴 dayoff
        const kvData = await env.WPORT_KV.get("dayoff:latest");
        if (kvData) dayOffData = JSON.parse(kvData).data || [];
      } catch(e) {
        console.error("KV 讀取失敗:", e);
        dayOffData = [];
      }
  
      const safeJson = JSON.stringify(dayOffData)
        .replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
  
      let html;
      try {
        html = await env.DOCS.get("dayoff/index.html");
        html = html.replace('%%SAFE_JSON%%', safeJson);
      } catch(e) {
        console.error("讀取 dayoff/index.html 失敗:", e);
        html = `<html><body><div id="eventList"></div><script>const allEvents=[];</script><script type="module" src="/static/dayoff.js"></script></body></html>`;
      }
  
      return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
    }
  };
  
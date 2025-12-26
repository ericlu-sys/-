export async function onRequest(context) {
    try {
      // 從綁定的 KV 中抓取 GAS 塞進去的 'links_json'
      // 這裡的 WPORT_LINKS 必須跟你在 Pages Settings 設定的一模一樣
      const data = await context.env.WPORT_LINKS.get("links_json");
  
      if (!data) {
        return new Response(JSON.stringify({ error: "KV 中找不到資料，請先執行 GAS 同步" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
  
      return new Response(data, {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Access-Control-Allow-Origin": "*"
        },
      });
    } catch (e) {
      return new Response("讀取 KV 失敗: " + e.message, { status: 500 });
    }
  }
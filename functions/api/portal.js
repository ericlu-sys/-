export async function onRequest(context) {
  const { request, env } = context;

  // --- 1. 處理寫入 (POST) ---
  // 當 GAS 執行 UrlFetchApp.fetch 時，會跑這段
  if (request.method === "POST" || request.method === "PUT") {
    try {
      const payload = await request.json(); // 拿到 { key: "...", value: "..." }
      
      if (!payload.key || !payload.value) {
        return new Response("錯誤：缺少 key 或 value", { status: 400 });
      }

      // 根據 GAS 傳來的 key 名稱，存入 KV 抽屜裡
      await env.WPORT_LINKS.put(payload.key, payload.value);
      
      return new Response(`成功！資料已存入抽屜：${payload.key}`, { 
        status: 200,
        headers: { "Content-Type": "text/plain;charset=UTF-8" }
      });
    } catch (e) {
      return new Response("寫入 KV 失敗: " + e.message, { status: 500 });
    }
  }

  // --- 2. 處理讀取 (GET) ---
  // 當網頁打開載入資料時，會跑這段
  try {
    // 取得網址參數中的 key，例如 /api/portal?key=employee_json
    const { searchParams } = new URL(request.url);
    let key = searchParams.get('key') || "links_json"; // 如果沒給參數，預設讀取門戶連結

    const data = await env.WPORT_LINKS.get(key);

    if (!data) {
      return new Response(JSON.stringify({ error: `抽屜 ${key} 是空的` }), {
        status: 404,
        headers: { "Content-Type": "application/json;charset=UTF-8" }
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
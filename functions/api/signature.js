export async function onRequest(context) {
  try {
    // 從 WPORT_LINKS KV 命名空間抓取 employee_json
    const data = await context.env.WPORT_LINKS.get("employee_json");
    
    if (!data) {
      return new Response(JSON.stringify({ error: "KV 中找不到 employee_json 資料" }), { 
        status: 404,
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      });
    }

    return new Response(data, {
      headers: { 
        "Content-Type": "application/json;charset=UTF-8",
        "Access-Control-Allow-Origin": "*" 
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json;charset=UTF-8" }
    });
  }
}
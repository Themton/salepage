// ═══════════════════════════════════════════
// SalePage Notification Worker — Telegram Only
// ═══════════════════════════════════════════

const TG_BOT = "8541537002:AAEISzVZ1wTJnE_C2YJ9xkJ1j5al3EGmtqQ";
const TG_CHAT = "-5239129044";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: true, service: "salepage-notify" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      const { action, ...data } = await request.json();

      if (action === "notify") {
        const msg = `🛒 *ออเดอร์ใหม่!*\n\n📄 เซลเพจ: ${data.pageName || ''}\n👤 ชื่อ: ${data.name || ''}\n📞 เบอร์: ${data.tel || ''}\n📍 ที่อยู่: ${data.addr || ''}\n📦 สินค้า: ${data.pkg || ''}\n💰 ยอด: ฿${Number(data.total || 0).toLocaleString()}\n\n⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
        const tgResp = await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: 'Markdown' }),
        });
        const result = await tgResp.json();
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },
};

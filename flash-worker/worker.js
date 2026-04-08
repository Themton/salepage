// ═══════════════════════════════════════════
// Flash Express API Proxy — Cloudflare Worker
// Deploy: wrangler deploy
// ═══════════════════════════════════════════

const FLASH_MCH_ID = "CA5610";
const FLASH_API_KEY = "0bc50ae59546"; // ← ใส่ key เต็มตรงนี้
const FLASH_API_URL = "https://open-api-training.flashexpress.com"; // Training ENV

// === Helpers ===
async function sha256(msg) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function nonce() {
  return String(Date.now());
}

async function makeSign(params) {
  const filtered = Object.entries(params)
    .filter(([k, v]) => k !== "sign" && v !== "" && v != null && String(v).trim() !== "")
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return await sha256(filtered + FLASH_API_KEY);
}

// === Flash API call ===
async function callFlash(endpoint, params) {
  params.mchId = FLASH_MCH_ID;
  params.nonceStr = nonce();
  params.sign = await makeSign(params);

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v != null) body.append(k, v);
  }

  const resp = await fetch(`${FLASH_API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return await resp.json();
}

// === CORS ===
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
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      const { action, ...data } = await request.json();
      let result;

      switch (action) {
        case "createOrder": {
          const p = {
            outTradeNo: data.outTradeNo || "",
            expressCategory: data.codAmount > 0 ? 1 : 0,
            srcName: data.srcName || "",
            srcPhone: data.srcPhone || "",
            srcDetailAddress: data.srcAddress || "",
            srcPostalCode: data.srcPostal || "",
            dstName: data.dstName || "",
            dstPhone: data.dstPhone || "",
            dstProvinceName: data.dstProvince || "",
            dstCityName: data.dstDistrict || "",
            dstDistrictName: data.dstSubdistrict || "",
            dstPostalCode: data.dstPostal || "",
            dstDetailAddress: data.dstAddress || "",
            articleCategory: 1,
            weight: data.weight || 1000,
            insured: 0,
            codEnabled: data.codAmount > 0 ? 1 : 0,
            codAmount: data.codAmount > 0 ? Math.round(data.codAmount * 100) : 0,
          };
          result = await callFlash("/open/v3/orders", p);
          break;
        }

        case "cancelOrder": {
          result = await callFlash("/open/v1/orders/cancel", { pno: data.pno });
          break;
        }

        case "getLabel": {
          result = await callFlash("/open/v1/orders/label", {
            pno: data.pno,
            pageSize: data.pageSize || "100x75",
          });
          break;
        }

        case "tracking": {
          result = await callFlash("/open/v1/orders/tracking", { pno: data.pno });
          break;
        }

        default:
          result = { code: -1, message: "Unknown action" };
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

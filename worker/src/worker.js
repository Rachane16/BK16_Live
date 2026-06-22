const FOOTBALL_DATA_API = "https://api.football-data.org/v4/matches";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 10;
const CACHE_TTL_SECONDS = 30;

function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function parseAllowedOrigins(env) {
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return configured.length
    ? configured
    : [
        "https://rachane16.github.io",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
      ];
}

function getCorsOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return "*";
  return parseAllowedOrigins(env).includes(origin) ? origin : null;
}

function withCors(response, allowedOrigin) {
  const next = new Response(response.body, response);
  next.headers.set("Access-Control-Allow-Origin", allowedOrigin || "*");
  next.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  next.headers.set("Access-Control-Allow-Headers", "Accept, Content-Type");
  next.headers.set("Access-Control-Max-Age", "86400");
  next.headers.append("Vary", "Origin");
  return next;
}

function validateDateRange(dateFrom, dateTo) {
  if (!DATE_RE.test(dateFrom || "") || !DATE_RE.test(dateTo || "")) {
    return "dateFrom และ dateTo ต้องอยู่ในรูปแบบ YYYY-MM-DD";
  }

  const fromMs = Date.parse(`${dateFrom}T00:00:00Z`);
  const toMs = Date.parse(`${dateTo}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }

  const days = Math.floor((toMs - fromMs) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) return `ช่วงวันที่ต้องไม่เกิน ${MAX_RANGE_DAYS} วัน`;
  return null;
}

async function handleMatches(request, env, ctx, allowedOrigin) {
  if (!env.FOOTBALL_DATA_TOKEN) {
    return withCors(
      jsonResponse({ error:"FOOTBALL_DATA_TOKEN is not configured" }, { status:500 }),
      allowedOrigin
    );
  }

  const incoming = new URL(request.url);
  const dateFrom = incoming.searchParams.get("dateFrom") || "";
  const dateTo = incoming.searchParams.get("dateTo") || "";
  const error = validateDateRange(dateFrom, dateTo);
  if (error) return withCors(jsonResponse({ error }, { status:400 }), allowedOrigin);

  const upstreamUrl = new URL(FOOTBALL_DATA_API);
  upstreamUrl.searchParams.set("dateFrom", dateFrom);
  upstreamUrl.searchParams.set("dateTo", dateTo);

  const cache = caches.default;
  const cacheKey = new Request(
    `https://bk16-cache.invalid/matches?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`
  );
  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-BK16-Cache", "HIT");
    return withCors(response, allowedOrigin);
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers:{
        "X-Auth-Token":env.FOOTBALL_DATA_TOKEN,
        "Accept":"application/json"
      }
    });
  } catch (fetchError) {
    return withCors(
      jsonResponse({ error:"Unable to reach football-data.org", detail:String(fetchError) }, { status:502 }),
      allowedOrigin
    );
  }

  const body = await upstream.text();
  const contentType = upstream.headers.get("Content-Type") || "application/json; charset=utf-8";
  const response = new Response(body, {
    status:upstream.status,
    statusText:upstream.statusText,
    headers:{
      "Content-Type":contentType,
      "Cache-Control":`public, max-age=${CACHE_TTL_SECONDS}`,
      "X-BK16-Cache":"MISS"
    }
  });

  if (upstream.ok) {
    const cacheResponse = new Response(body, {
      status:200,
      headers:{
        "Content-Type":contentType,
        "Cache-Control":`public, max-age=${CACHE_TTL_SECONDS}`
      }
    });
    ctx.waitUntil(cache.put(cacheKey, cacheResponse));
  }

  return withCors(response, allowedOrigin);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const allowedOrigin = getCorsOrigin(request, env);

    if (!allowedOrigin) return jsonResponse({ error:"Origin is not allowed" }, { status:403 });
    if (request.method === "OPTIONS") return withCors(new Response(null, { status:204 }), allowedOrigin);
    if (request.method !== "GET") return withCors(jsonResponse({ error:"Method not allowed" }, { status:405 }), allowedOrigin);

    if (url.pathname === "/health") {
      return withCors(jsonResponse({
        ok:true,
        service:"BK16 football-data proxy",
        tokenConfigured:Boolean(env.FOOTBALL_DATA_TOKEN),
        timestamp:new Date().toISOString()
      }), allowedOrigin);
    }

    if (url.pathname === "/api/matches") return handleMatches(request, env, ctx, allowedOrigin);

    return withCors(jsonResponse({
      error:"Not found",
      endpoints:["/health", "/api/matches?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD"]
    }, { status:404 }), allowedOrigin);
  }
};

import crypto from "crypto";

/**
 * GA4 Data API 最小客户端：服务账号 JWT 换 access_token，跑 report。
 * 环境变量：
 *   GA4_PROPERTY_ID      形如 123456789（GA4 数据流属性 ID）
 *   GA4_CLIENT_EMAIL     服务账号邮箱
 *   GA4_PRIVATE_KEY      服务账号私钥（PEM，换行用 \n）
 * 未配置时 getOverview 返回 { configured: false }。
 */

const TOKEN_URL = (process.env.GA4_OAUTH_BASE || "https://oauth2.googleapis.com") + "/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DATA_API = (process.env.GA4_API_BASE || "https://analyticsdata.googleapis.com") + "/v1beta";

let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey = (process.env.GA4_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("GA4_NOT_CONFIGURED");

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(`${header}.${claim}`), privateKey)
    .toString("base64url");
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`GA4_TOKEN_ERROR: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

export type Ga4Daily = { date: string; pv: number; uv: number };

export async function fetchGa4Overview(days = 30): Promise<{
  configured: boolean;
  daily: Ga4Daily[];
  totalPv: number;
  totalUv: number;
  sources: { source: string; sessions: number }[];
}> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || !process.env.GA4_CLIENT_EMAIL || !process.env.GA4_PRIVATE_KEY) {
    return { configured: false, daily: [], totalPv: 0, totalUv: 0, sources: [] };
  }
  const token = await getAccessToken();
  const dateRange = {
    startDate: `${days}daysAgo`,
    endDate: "today",
  };

  const dailyRes = await fetch(
    `${DATA_API}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [dateRange],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 100,
      }),
    },
  );
  if (!dailyRes.ok) throw new Error(`GA4_API_ERROR: ${await dailyRes.text()}`);
  const dailyJson = await dailyRes.json();

  const daily: Ga4Daily[] = (dailyJson.rows || []).map((r: any) => ({
    date: `${r.dimensionValues[0].value.slice(0, 4)}-${r.dimensionValues[0].value.slice(4, 6)}-${r.dimensionValues[0].value.slice(6, 8)}`,
    pv: Number(r.metricValues[0].value),
    uv: Number(r.metricValues[1].value),
  }));

  const sourceRes = await fetch(
    `${DATA_API}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [dateRange],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 6,
      }),
    },
  );
  const sourceJson = sourceRes.ok ? await sourceRes.json() : {};
  const sources = (sourceJson.rows || []).map((r: any) => ({
    source: r.dimensionValues[0].value,
    sessions: Number(r.metricValues[0].value),
  }));

  return {
    configured: true,
    daily,
    totalPv: daily.reduce((s, d) => s + d.pv, 0),
    totalUv: daily.reduce((s, d) => s + d.uv, 0),
    sources,
  };
}

/** Server-only Supabase REST helper. Never imported by client code. */
export async function supabaseSelect(env, table, { select, query = {}, order } = {}) {
  const base = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_KEY;
  if (!base || !key) {
    const err = new Error("missing_supabase_env");
    err.status = 500;
    throw err;
  }
  const url = new URL(`${base}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  if (order) url.searchParams.set("order", order);
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const err = new Error(`supabase ${res.status}`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

export function json(status, body, cache = "no-store") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cache,
  };
  if (cache === "no-store") {
    headers["CDN-Cache-Control"] = "no-store";
    headers["Vercel-CDN-Cache-Control"] = "no-store";
  }
  return { status, headers, body: JSON.stringify(body) };
}

export function fail(err) {
  return json(err.status || 502, { error: "unavailable" }, "no-store");
}

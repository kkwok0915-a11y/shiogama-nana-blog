import { fail, json, supabaseSelect } from "./supabase.mjs";

export const LIST_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
const SELECT = "code,taken_at,caption,permalink,slides,photo_count,added_at";
const CODE_RE = /^[A-Za-z0-9_-]{5,40}$/;

/** GET /api/instagram (newest first) and GET /api/instagram?code=<shortcode>. */
export async function handleInstagram(env, requestUrl) {
  try {
    const code = requestUrl?.searchParams.get("code");
    if (code && !CODE_RE.test(code)) return json(400, { error: "bad_code" }, "no-store");
    const query = { published: "eq.true" };
    if (code) query.code = `eq.${code}`;
    const rows = await supabaseSelect(env, "instagram_posts", {
      select: SELECT,
      query,
      order: "taken_at.desc",
    });
    if (code) return rows.length ? json(200, rows[0], LIST_CACHE) : json(404, { error: "not_found" }, "no-store");
    return json(200, rows, LIST_CACHE);
  } catch (err) {
    return fail(err);
  }
}

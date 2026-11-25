import { fail, json, supabaseSelect } from "./supabase.mjs";

export const LIST_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
const SELECT = "id,title_zh,title_jp,post_date,original_url,body,photo_count,added_at,published";
const ID_RE = /^[\w.-]+$/;

export async function handlePosts(env, requestUrl) {
  try {
    const id = requestUrl?.searchParams.get("id");
    if (id && !ID_RE.test(id)) return json(400, { error: "bad_id" }, "no-store");
    const query = { published: "eq.true" };
    if (id) query.id = `eq.${id}`;
    const rows = await supabaseSelect(env, "blog_posts", {
      select: SELECT,
      query,
      order: "post_date.desc",
    });
    if (id && rows.length === 0) return json(404, { error: "not_found" }, "no-store");
    return json(200, rows, LIST_CACHE);
  } catch (err) {
    return fail(err);
  }
}

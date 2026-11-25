import { fail, json, supabaseSelect } from "./supabase.mjs";

export const SETTINGS_CACHE = "public, s-maxage=60, stale-while-revalidate=60";

export async function handleSettings(env) {
  try {
    const rows = await supabaseSelect(env, "site_settings", {
      select: "notice_enabled,notice_text",
      query: { id: "eq.1" },
    });
    const row = rows[0] ?? {};
    return json(
      200,
      {
        notice_enabled: Boolean(row.notice_enabled),
        notice_text: typeof row.notice_text === "string" ? row.notice_text : "",
      },
      SETTINGS_CACHE,
    );
  } catch (err) {
    return fail(err);
  }
}

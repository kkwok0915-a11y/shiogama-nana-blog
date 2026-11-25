-- Site-wide settings (singleton row id=1). Anon may only SELECT; no client writes.
-- Writes go through the Supabase dashboard / execute_sql (service role), never from the browser.
create table if not exists public.site_settings (
  id int primary key default 1,
  notice_enabled boolean not null default false,
  notice_text text,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = 1)
);

alter table public.site_settings enable row level security;

revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;

drop policy if exists "Site settings are readable" on public.site_settings;
create policy "Site settings are readable"
  on public.site_settings for select
  to anon, authenticated
  using (true);

insert into public.site_settings (id, notice_enabled, notice_text, updated_at)
values (1, true, '網站升級中，部分功能可能暫時無法使用', now())
on conflict (id) do update
  set notice_enabled = excluded.notice_enabled,
      notice_text = excluded.notice_text,
      updated_at = now();

create or replace function public.touch_site_settings()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_site_settings();

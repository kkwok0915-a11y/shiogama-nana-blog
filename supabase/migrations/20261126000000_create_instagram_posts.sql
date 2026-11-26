-- 塩釜菜那 Instagram archive. Public read of published rows only; no anon writes.
-- Photos are static files at /photos/ig/<code>/<n>.jpg (same as blog photos); the original
-- Instagram CDN URLs are signed and expire, so they are never stored here.
create table if not exists public.instagram_posts (
  code         text primary key,                   -- Instagram shortcode, e.g. 'DdwFquxlNS7'
  taken_at     timestamptz not null,
  caption      text not null default '',           -- byte-exact caption
  permalink    text not null,                      -- https://www.instagram.com/p/<code>/
  slides       jsonb not null default '[]'::jsonb, -- ordered: {type:'photo',src,width,height} | {type:'video',src:null}
  photo_count  int  not null default 0,
  added_at     timestamptz not null default now(),
  published    boolean not null default true,
  constraint instagram_posts_code_format check (code ~ '^[A-Za-z0-9_-]+$'),
  constraint instagram_posts_slides_is_array check (jsonb_typeof(slides) = 'array')
);

create index if not exists instagram_posts_taken_at_idx on public.instagram_posts (taken_at desc) where published;

alter table public.instagram_posts enable row level security;

revoke all on table public.instagram_posts from anon, authenticated;
grant select on table public.instagram_posts to anon, authenticated;

drop policy if exists "Published instagram posts are readable" on public.instagram_posts;
create policy "Published instagram posts are readable"
  on public.instagram_posts for select
  to anon, authenticated
  using (published);

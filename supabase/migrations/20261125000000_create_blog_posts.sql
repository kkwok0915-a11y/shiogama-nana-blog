-- 塩釜菜那 blog translations. Public read of published rows only; no anon writes.
create table if not exists public.blog_posts (
  id            text primary key,                 -- bokuao.com blog post id, e.g. '21671'
  title_zh      text not null,
  title_jp      text,
  post_date     date,
  original_url  text unique,
  body          jsonb not null default '[]'::jsonb, -- ordered blocks: {type:'text',text} | {type:'photo',src,alt,width,height}
  photo_count   int  not null default 0,
  added_at      timestamptz not null default now(),
  published     boolean not null default true,
  constraint blog_posts_body_is_array check (jsonb_typeof(body) = 'array')
);

create index if not exists blog_posts_post_date_idx on public.blog_posts (post_date desc, id desc) where published;

alter table public.blog_posts enable row level security;

revoke all on table public.blog_posts from anon, authenticated;
grant select on table public.blog_posts to anon, authenticated;

drop policy if exists "Published posts are readable" on public.blog_posts;
create policy "Published posts are readable"
  on public.blog_posts for select
  to anon, authenticated
  using (published);

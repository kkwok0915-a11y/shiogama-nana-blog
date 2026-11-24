/** Matches Supabase public.blog_posts. */
export type Block =
  | { type: "text"; text: string }
  | { type: "photo"; src: string; alt?: string | null; width?: number | null; height?: number | null };

export interface PostRow {
  id: string;
  title_zh: string;
  title_jp: string | null;
  post_date: string | null; // YYYY-MM-DD
  original_url: string | null;
  body: Block[];
  photo_count: number;
  added_at: string;
  published?: boolean;
}

export type PhotoBlock = Extract<Block, { type: "photo" }>;

export interface Post extends PostRow {
  dateLabel: string; // YYYY.MM.DD
  excerpt: string;
  cover: PhotoBlock | null;
  photos: PhotoBlock[];
  searchText: string;
}

export type DataSource = "supabase" | "json";

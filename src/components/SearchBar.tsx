interface Props {
  query: string;
  onQuery: (q: string) => void;
}

export default function SearchBar({ query, onQuery }: Props) {
  return (
    <div className="toolbar" role="search">
      <label className="search">
        <span className="visually-hidden">搜尋文章</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M10 4a6 6 0 104.47 10l4.77 4.76 1.41-1.41-4.76-4.77A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z"
          />
        </svg>
        <input
          type="search"
          value={query}
          placeholder="搜尋標題、內文或日期（例如 2026.11）"
          onChange={(e) => onQuery(e.target.value)}
          enterKeyHint="search"
        />
      </label>
    </div>
  );
}

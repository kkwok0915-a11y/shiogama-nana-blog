interface Props {
  query: string;
  onQuery: (q: string) => void;
  /** When true, render only the search field (parent provides the toolbar). */
  bare?: boolean;
}

export default function SearchBar({ query, onQuery, bare }: Props) {
  const field = (
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
        placeholder="搜尋標題、譯文或日文原文…"
        onChange={(e) => onQuery(e.target.value)}
        enterKeyHint="search"
        autoComplete="off"
      />
      {query && (
        <button type="button" className="search-clear" aria-label="清除搜尋" onClick={() => onQuery("")}>
          ✕
        </button>
      )}
    </label>
  );
  return bare ? field : <div className="toolbar" role="search">{field}</div>;
}

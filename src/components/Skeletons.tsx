/** Shimmer placeholders shaped like the real toolbar, cards, grid and post view, so nothing jumps when data lands. */

function ToolbarSkeleton() {
  return (
    <div className="toolbar">
      <div className="skel skel-search" />
      <div className="chip-row view-tabs">
        <span className="skel skel-chip" />
        <span className="skel skel-chip" />
      </div>
      <div className="toolbar-row filter-row">
        <span className="skel skel-seg" />
        <span className="skel skel-chip skel-date-chip" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ view, count = 6 }: { view: "feed" | "gallery"; count?: number }) {
  return (
    <>
      <p className="visually-hidden" role="status">
        載入中…
      </p>
      <div className="list-skeleton" aria-hidden="true">
        <ToolbarSkeleton />
        <p className="result-count">
          <span className="skel skel-count" />
        </p>
        <section className="month-section">
          <h2 className="month-heading">
            <span className="skel skel-month" />
          </h2>
          {view === "gallery" ? (
            <ul className="gallery">
              {Array.from({ length: Math.max(count, 12) }, (_, i) => (
                <li key={i}>
                  <span className="gallery-btn skel" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="list">
              {Array.from({ length: count }, (_, i) => (
                <li className="card" key={i}>
                  <div className="card-btn">
                    <span className="thumb skel" />
                    <span className="card-body">
                      <span className="skel skel-date" />
                      <span className="skel skel-title" />
                      <span className="skel skel-excerpt" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function PostSkeleton() {
  return (
    <>
      <p className="visually-hidden" role="status">
        載入中…
      </p>
      <article className="post post-skeleton" aria-hidden="true">
        <div className="post-nav top">
          <span className="skel skel-pill" />
          <span className="skel skel-pill" />
        </div>
        <header className="post-head">
          <span className="skel skel-date skel-center" />
          <span className="skel skel-heading skel-center" />
        </header>
        <div className="post-body">
          <span className="skel skel-photo" />
          <span className="skel skel-line" />
          <span className="skel skel-line" />
          <span className="skel skel-line short" />
        </div>
      </article>
    </>
  );
}

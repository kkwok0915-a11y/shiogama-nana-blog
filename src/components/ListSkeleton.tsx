/** Placeholder chrome sized like the real toolbar and post cards while /api/posts loads. */
export default function ListSkeleton({ count }: { count: number }) {
  const n = Math.max(count, 4);
  return (
    <>
      <p className="visually-hidden" role="status">
        載入文章中…
      </p>
      <div className="list-skeleton" aria-hidden="true">
        <div className="toolbar">
          <div className="skel skel-search" />
          <div className="chip-row view-tabs">
            <span className="skel skel-chip" />
            <span className="skel skel-chip" />
          </div>
          <div className="date-filter">
            <span className="skel skel-chip skel-date-chip" />
          </div>
        </div>
        <p className="result-count">
          <span className="skel skel-count" />
        </p>
        <section className="month-section">
          <h2 className="month-heading">
            <span className="skel skel-month" />
          </h2>
          <ul className="list">
            {Array.from({ length: n }, (_, i) => (
              <li className="card" key={i}>
                <div className="card-btn">
                  <span className="thumb" />
                  <span className="card-body">
                    <span className="skel skel-date" />
                    <span className="skel skel-title" />
                    <span className="skel skel-excerpt" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

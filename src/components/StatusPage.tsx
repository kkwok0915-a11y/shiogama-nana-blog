interface Props {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  alert?: boolean;
}

/** Friendly empty or error state with a single recovery action. */
export default function StatusPage({ title, message, actionLabel, onAction, alert }: Props) {
  return (
    <div className="status-page" role={alert ? "alert" : "status"}>
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" className="status-action" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}

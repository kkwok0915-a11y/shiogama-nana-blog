import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render crashes so visitors see a Traditional Chinese recovery page instead of a blank screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="status-page" role="alert">
        <h1>頁面發生問題</h1>
        <p>請重新整理後再試。若持續出現，請稍後再回來。</p>
        <button type="button" className="status-action" onClick={() => window.location.reload()}>
          重新整理
        </button>
      </div>
    );
  }
}

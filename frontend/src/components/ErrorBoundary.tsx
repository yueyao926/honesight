import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
};

type State = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI render error:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-ink">
          <p className="font-medium">这部分内容加载失败</p>
          <p className="mt-2 text-muted">请尝试切换上一页，或刷新页面后重新分析。</p>
          <button className="btn-secondary mt-4" type="button" onClick={this.handleReset}>
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

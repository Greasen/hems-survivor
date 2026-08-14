import { Component, type ErrorInfo, type ReactNode } from 'react';

interface GameErrorBoundaryProps {
  children: ReactNode;
  onRestart: () => void;
}

interface GameErrorBoundaryState {
  error: Error | null;
}

export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // The fallback itself is the recoverable production surface.
  }

  render() {
    if (this.state.error) {
      return (
        <section className="overlay overlay--error" role="dialog" aria-modal="true" aria-live="assertive" aria-labelledby="error-title">
          <h2 id="error-title">游戏状态异常</h2>
          <p>游戏已暂停，请重新开始本局。</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null }, this.props.onRestart)}
          >
            重新开始
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

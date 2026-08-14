import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ModalDialog } from './ModalDialog';

interface GameErrorBoundaryProps {
  children: ReactNode;
  onRestart: () => void;
  onError?: (error: Error) => void;
}

interface GameErrorBoundaryState {
  error: Error | null;
}

export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) {
      return (
        <ModalDialog className="overlay overlay--error" titleId="error-title">
          <h2 id="error-title">游戏状态异常</h2>
          <p>游戏已暂停，请重新开始本局。</p>
          <button type="button" onClick={() => {
            this.props.onRestart();
            this.setState({ error: null });
          }}>
            重新开始
          </button>
        </ModalDialog>
      );
    }
    return this.props.children;
  }
}

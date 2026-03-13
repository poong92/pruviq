import { Component } from 'preact';
import type { ComponentChildren } from 'preact';

const labels = {
  en: {
    errorMsg: (name: string) => `Something went wrong loading ${name}.`,
    retry: 'Retry',
  },
  ko: {
    errorMsg: (name: string) => `${name} 로딩 중 오류가 발생했습니다.`,
    retry: '다시 시도',
  },
};

interface Props {
  name: string;
  lang?: 'en' | 'ko';
  children: ComponentChildren;
}

interface State {
  error: Error | null;
}

/**
 * Preact Error Boundary - prevents one component crash from blanking the entire page.
 * Wraps interactive components (MarketDashboard, CoinListTable, SimulatorPage, etc.)
 * so a runtime error shows a recoverable error UI instead of skeleton/blank state.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const t = labels[this.props.lang || 'en'] || labels.en;
      return (
        <div className="border border-[--color-border] rounded-lg p-6 bg-[--color-bg-card] text-center my-4">
          <p className="font-mono text-sm text-[--color-red] mb-3">
            {t.errorMsg(this.props.name)}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
          >
            {t.retry}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

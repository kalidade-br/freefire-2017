import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado na aplicação.',
    };
  }

  public componentDidCatch(error: Error): void {
    console.error('Application ErrorBoundary caught:', error);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950 p-4 text-white">
          <div className="w-full max-w-md bg-[#14181e] border-2 border-amber-500 p-6 space-y-4 text-center shadow-2xl">
            <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">
              Algo deu errado
            </h2>
            <p className="text-xs font-mono text-neutral-300 break-words max-h-36 overflow-y-auto">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest cursor-pointer"
            >
              RECARREGAR JOGO
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

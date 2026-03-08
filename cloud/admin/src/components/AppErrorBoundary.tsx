import React from "react";

type State = { hasError: boolean; message: string };

function messageFromError(error: unknown): string {
  const msg = String((error as any)?.message || "").trim();
  return msg || "O painel admin encontrou um erro inesperado.";
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: messageFromError(error) };
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error("[cloud-admin] erro nao tratado:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-text">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-panel p-6 shadow-soft">
          <div className="text-xl font-black">Falha inesperada no admin</div>
          <p className="mt-2 text-sm text-dim">{this.state.message}</p>
          <p className="mt-1 text-xs text-mute">Tente recarregar. Se persistir, valide API, banco e variaveis cloud.</p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-border bg-black/20 px-4 py-2 text-sm font-bold hover:border-white/30"
            onClick={() => window.location.reload()}
          >
            Recarregar admin
          </button>
        </div>
      </div>
    );
  }
}

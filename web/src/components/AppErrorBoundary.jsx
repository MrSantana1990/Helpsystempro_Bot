import React from "react";

function fallbackMessage(error) {
  const msg = String(error?.message || "").trim();
  if (!msg) return "O painel encontrou um erro inesperado.";
  return msg;
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: fallbackMessage(error) };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("[web] erro não tratado:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050913] p-4 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-black/40 p-6 shadow-soft">
          <div className="text-xl font-black">Falha inesperada no painel</div>
          <p className="mt-2 text-sm text-white/80">{this.state.message}</p>
          <p className="mt-1 text-xs text-white/60">
            Tente recarregar a página. Se persistir, reinicie API e painel.
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            onClick={() => window.location.reload()}
          >
            Recarregar painel
          </button>
        </div>
      </div>
    );
  }
}

import React, { useEffect, useMemo, useState } from "react";
import AuthGate from "./components/AuthGate.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Bot from "./pages/Bot.jsx";
import Config from "./pages/Config.jsx";
import Decisions from "./pages/Decisions.jsx";
import Events from "./pages/Events.jsx";
import Health from "./pages/Health.jsx";
import Market from "./pages/Market.jsx";
import News from "./pages/News.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Overview from "./pages/Overview.jsx";
import Support from "./pages/Support.jsx";
import Trades from "./pages/Trades.jsx";
import { apiGet, apiPost } from "./lib/api.js";

function useToken() {
  const [token, setToken] = useState(() => localStorage.getItem("hsp_token") || "local-dev");
  useEffect(() => localStorage.setItem("hsp_token", token), [token]);
  useEffect(() => {
    const onExternal = () => {
      const next = localStorage.getItem("hsp_token") || "local-dev";
      setToken(next);
    };
    window.addEventListener("hsp-token-changed", onExternal);
    window.addEventListener("storage", onExternal);
    return () => {
      window.removeEventListener("hsp-token-changed", onExternal);
      window.removeEventListener("storage", onExternal);
    };
  }, []);
  return { token, setToken };
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const { token, setToken } = useToken();
  const [botOn, setBotOn] = useState(false);
  const [ver, setVer] = useState(null);
  const [meta, setMeta] = useState(null);

  const refreshMeta = async () => {
    const [bot, overview] = await Promise.all([
      apiGet("/api/bot/status", { token }),
      apiGet("/api/overview", { token }).catch(() => null)
    ]);
    setBotOn(!!bot.running);
    setMeta(overview);
    return { bot, overview };
  };

  const onPlay = async () => {
    await apiPost("/api/bot/start", { token, query: { dry_run: true, once: false } });
    await refreshMeta();
  };

  const onStop = async () => {
    await apiPost("/api/bot/stop", { token });
    await refreshMeta();
  };

  useEffect(() => {
    refreshMeta().catch(() => {});
  }, [token]);

  useEffect(() => {
    apiGet("/api/version", { token }).then(setVer).catch(() => setVer(null));
  }, [token]);

  useEffect(() => {
    const done = localStorage.getItem("hsp_onboarding_done") === "1";
    if (!done) setTab("onboarding");
  }, []);

  const pages = useMemo(
    () => ({
      onboarding: <Onboarding token={token} setToken={setToken} onGoDashboard={() => setTab("overview")} />,
      overview: <Overview token={token} botOn={botOn} />,
      market: <Market token={token} />,
      trades: <Trades token={token} />,
      decisions: <Decisions token={token} />,
      news: <News token={token} />,
      events: <Events token={token} />,
      bot: <Bot token={token} setToken={setToken} />,
      config: <Config token={token} setToken={setToken} />,
      health: <Health token={token} />,
      support: <Support token={token} />
    }),
    [token, botOn, setToken]
  );

  return (
    <AuthGate>
      <div className="mx-auto flex h-[100dvh] max-w-[1280px] flex-col gap-3 p-4">
        <Topbar
          botOn={botOn}
          testnet={Boolean(meta?.testnet ?? true)}
          version={ver}
          onDeposit={() => setTab("overview")}
          onRefreshAll={() => refreshMeta().catch(() => {})}
          onPlay={onPlay}
          onStop={onStop}
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
          <Sidebar active={tab} onSelect={setTab} botOn={botOn} />
          <main className="min-h-0 overflow-auto rounded-xl2 border border-white/10 bg-black/10 p-3 shadow-soft">
            {pages[tab] || pages.overview}
            <div className="mt-4 text-xs text-white/50">
              Sem promessa de lucro: este sistema é um assistente operacional (simulação/dry-run por padrão) e exige validação do usuário.</div>
          </main>
        </div>
      </div>
    </AuthGate>
  );
}



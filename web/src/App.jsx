import React, { useEffect, useMemo, useState } from "react";
import Topbar from "./components/Topbar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Overview from "./pages/Overview.jsx";
import Market from "./pages/Market.jsx";
import Trades from "./pages/Trades.jsx";
import Decisions from "./pages/Decisions.jsx";
import News from "./pages/News.jsx";
import Bot from "./pages/Bot.jsx";
import Config from "./pages/Config.jsx";
import Health from "./pages/Health.jsx";
import { apiGet, apiPost } from "./lib/api.js";

function useToken() {
  const [token, setToken] = useState(() => localStorage.getItem("hsp_token") || "local-dev");
  useEffect(() => localStorage.setItem("hsp_token", token), [token]);
  return { token, setToken };
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const { token, setToken } = useToken();
  const [botOn, setBotOn] = useState(false);
  const [ver, setVer] = useState(null);

  const refreshBot = async () => {
    const r = await apiGet("/api/bot/status", { token });
    setBotOn(!!r.running);
    return r;
  };

  const onPlay = async () => {
    await apiPost("/api/bot/start", { token, query: { dry_run: true, once: false } });
    await refreshBot();
  };

  const onStop = async () => {
    await apiPost("/api/bot/stop", { token });
    await refreshBot();
  };

  useEffect(() => {
    refreshBot().catch(() => {});
  }, []);

  useEffect(() => {
    apiGet("/api/version", { token }).then(setVer).catch(() => setVer(null));
  }, [token]);

  const pages = useMemo(
    () => ({
      overview: <Overview token={token} botOn={botOn} />,
      market: <Market token={token} />,
      trades: <Trades token={token} />,
      decisions: <Decisions token={token} />,
      news: <News token={token} />,
      bot: <Bot token={token} setToken={setToken} />,
      config: <Config token={token} setToken={setToken} />,
      health: <Health token={token} />
    }),
    [token, botOn, setToken]
  );

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[1280px] flex-col gap-3 p-4">
      <Topbar
        botOn={botOn}
        version={ver}
        onDeposit={() => setTab("overview")}
        onRefreshAll={() => window.location.reload()}
        onPlay={onPlay}
        onStop={onStop}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        <Sidebar active={tab} onSelect={setTab} botOn={botOn} />
        <main className="min-h-0 overflow-auto rounded-xl2 border border-white/10 bg-black/10 p-3 shadow-soft">
          {pages[tab] || pages.overview}
          <div className="mt-4 text-xs text-white/50">
            Sem promessa de lucro: este sistema é um assistente operacional (simulação/dry-run por padrão) e exige validação do usuário.
          </div>
        </main>
      </div>
    </div>
  );
}

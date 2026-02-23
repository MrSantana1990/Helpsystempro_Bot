import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet, apiPost } from "../lib/api.js";

const ENV_FIELDS = [
  { k: "API_KEY", label: "Binance API Key", hint: "Obrigatório para rodar o bot real.", optional: false },
  { k: "API_SECRET", label: "Binance API Secret", hint: "Obrigatório para rodar o bot real.", optional: false },
  { k: "NEWS_API_KEY", label: "NewsAPI Key", hint: "Habilita o módulo de notícias.", optional: false },
  { k: "TELEGRAM_API_KEY", label: "Telegram Bot Token", hint: "Opcional (alertas).", optional: true },
  { k: "TELEGRAM_CHAT_ID", label: "Telegram Chat ID", hint: "Opcional (alertas).", optional: true }
];

const PROFILES = {
  conservador: {
    label: "Conservador",
    values: {
      buy_threshold: 0.55,
      avoid_threshold: -0.25,
      stop_loss_percentual: 1.5,
      take_profit_percentual: 3.0,
      max_moedas_por_ciclo: 2,
      max_open_positions: 2,
      minimo_usdt_por_ordem: 8,
      discovery_min_score: 0.65,
      discovery_max_new_per_day: 2
    }
  },
  padrao: {
    label: "Padrão",
    values: {
      buy_threshold: 0.45,
      avoid_threshold: -0.2,
      stop_loss_percentual: 2.0,
      take_profit_percentual: 5.0,
      max_moedas_por_ciclo: 3,
      max_open_positions: 3,
      minimo_usdt_por_ordem: 5,
      discovery_min_score: 0.55,
      discovery_max_new_per_day: 3
    }
  },
  agressivo: {
    label: "Agressivo",
    values: {
      buy_threshold: 0.35,
      avoid_threshold: -0.15,
      stop_loss_percentual: 3.0,
      take_profit_percentual: 7.0,
      max_moedas_por_ciclo: 4,
      max_open_positions: 5,
      minimo_usdt_por_ordem: 5,
      discovery_min_score: 0.5,
      discovery_max_new_per_day: 5
    }
  }
};

export default function Config({ token, setToken }) {
  const [st, setSt] = useState(null);
  const [show, setShow] = useState(false);
  const [envMsg, setEnvMsg] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [env, setEnv] = useState({
    API_KEY: "",
    API_SECRET: "",
    NEWS_API_KEY: "",
    TELEGRAM_API_KEY: "",
    TELEGRAM_CHAT_ID: ""
  });
  const [settings, setSettings] = useState("{}");
  const [profile, setProfile] = useState("padrao");
  const [simple, setSimple] = useState({
    testnet: true,
    moedas_monitoradas_csv: "BTCUSDT,ETHUSDT",
    news_term: "crypto",
    intervalo_execucao: 30,
    intervalo_pausa: 300,
    minimo_usdt_por_ordem: 5,
    max_moedas_por_ciclo: 3,
    max_open_positions: 3,
    buy_threshold: 0.45,
    avoid_threshold: -0.2,
    stop_loss_percentual: 2,
    take_profit_percentual: 5,
    discovery_enabled: true,
    discovery_limit: 20,
    discovery_min_quote_volume: 5000000,
    discovery_min_score: 0.55,
    discovery_max_new_per_day: 3,
    discovery_cooldown_hours: 24,
    discovery_exclude_bases_csv: ""
  });

  const refresh = async () => {
    const r = await apiGet("/api/config/status");
    setSt(r);
    setSettings(JSON.stringify(r.settings || {}, null, 2));
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  useEffect(() => {
    const s = st?.settings || null;
    if (!s) return;
    setSimple((p) => ({
      ...p,
      testnet: Boolean(s.testnet ?? p.testnet),
      moedas_monitoradas_csv: Array.isArray(s.moedas_monitoradas) ? s.moedas_monitoradas.join(",") : p.moedas_monitoradas_csv,
      news_term: typeof s.news_term === "string" ? s.news_term : p.news_term,
      intervalo_execucao: Number.isFinite(Number(s.intervalo_execucao)) ? Number(s.intervalo_execucao) : p.intervalo_execucao,
      intervalo_pausa: Number.isFinite(Number(s.intervalo_pausa)) ? Number(s.intervalo_pausa) : p.intervalo_pausa,
      minimo_usdt_por_ordem: Number.isFinite(Number(s.minimo_usdt_por_ordem)) ? Number(s.minimo_usdt_por_ordem) : p.minimo_usdt_por_ordem,
      max_moedas_por_ciclo: Number.isFinite(Number(s.max_moedas_por_ciclo)) ? Number(s.max_moedas_por_ciclo) : p.max_moedas_por_ciclo,
      max_open_positions: Number.isFinite(Number(s.max_open_positions)) ? Number(s.max_open_positions) : p.max_open_positions,
      buy_threshold: Number.isFinite(Number(s.buy_threshold)) ? Number(s.buy_threshold) : p.buy_threshold,
      avoid_threshold: Number.isFinite(Number(s.avoid_threshold)) ? Number(s.avoid_threshold) : p.avoid_threshold,
      stop_loss_percentual: Number.isFinite(Number(s.stop_loss_percentual)) ? Number(s.stop_loss_percentual) : p.stop_loss_percentual,
      take_profit_percentual: Number.isFinite(Number(s.take_profit_percentual)) ? Number(s.take_profit_percentual) : p.take_profit_percentual,
      discovery_enabled: Boolean(s.discovery_enabled ?? p.discovery_enabled),
      discovery_limit: Number.isFinite(Number(s.discovery_limit)) ? Number(s.discovery_limit) : p.discovery_limit,
      discovery_min_quote_volume: Number.isFinite(Number(s.discovery_min_quote_volume)) ? Number(s.discovery_min_quote_volume) : p.discovery_min_quote_volume,
      discovery_min_score: Number.isFinite(Number(s.discovery_min_score)) ? Number(s.discovery_min_score) : p.discovery_min_score,
      discovery_max_new_per_day: Number.isFinite(Number(s.discovery_max_new_per_day)) ? Number(s.discovery_max_new_per_day) : p.discovery_max_new_per_day,
      discovery_cooldown_hours: Number.isFinite(Number(s.discovery_cooldown_hours)) ? Number(s.discovery_cooldown_hours) : p.discovery_cooldown_hours,
      discovery_exclude_bases_csv: Array.isArray(s.discovery_exclude_bases) ? s.discovery_exclude_bases.join(",") : p.discovery_exclude_bases_csv
    }));
  }, [st]);

  const presentText = useMemo(() => {
    const p = st?.env_present || {};
    return Object.keys(p)
      .sort()
      .map((k) => `${k}=${p[k] ? "OK" : "-"}`)
      .join("\n");
  }, [st]);

  const saveEnv = async () => {
    setEnvMsg("");
    const body = Object.fromEntries(
      Object.entries(env)
        .map(([k, v]) => [k, String(v ?? "").trim()])
        .filter(([, v]) => v.length > 0)
    );
    if (Object.keys(body).length === 0) throw new Error("Nada para salvar (preencha ao menos 1 campo).");
    const r = await apiPost("/api/config/save_env", { token, body });
    const saved = (r.saved || []).join(", ") || "(nenhum)";
    const ignored = (r.ignored_blank || []).length ? " | ignorados vazios: " + r.ignored_blank.join(", ") : "";
    setEnvMsg("OK: key.env salvo: " + saved + ignored);
    await refresh();
  };

  const saveSettings = async () => {
    setSettingsMsg("");
    let obj;
    try {
      obj = JSON.parse(settings);
    } catch {
      throw new Error("JSON inválido em settings.");
    }
    const r = await apiPost("/api/config/save_settings", { token, body: obj });
    setSettingsMsg("OK: settings.yml salvo em " + r.path);
    await refresh();
  };

  const applySimpleToEditor = () => {
    setSettingsMsg("");
    let obj;
    try {
      obj = JSON.parse(settings);
    } catch {
      setSettingsMsg("Erro: JSON inválido no editor. Corrija antes de aplicar o modo simples.");
      return;
    }

    const moedas = String(simple.moedas_monitoradas_csv || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);

    obj.testnet = Boolean(simple.testnet);
    if (moedas.length) obj.moedas_monitoradas = moedas;
    obj.news_term = String(simple.news_term || obj.news_term || "crypto").trim();
    obj.intervalo_execucao = Number(simple.intervalo_execucao);
    obj.intervalo_pausa = Number(simple.intervalo_pausa);
    obj.minimo_usdt_por_ordem = Number(simple.minimo_usdt_por_ordem);
    obj.max_moedas_por_ciclo = Number(simple.max_moedas_por_ciclo);
    obj.max_open_positions = Number(simple.max_open_positions);
    obj.buy_threshold = Number(simple.buy_threshold);
    obj.avoid_threshold = Number(simple.avoid_threshold);
    obj.stop_loss_percentual = Number(simple.stop_loss_percentual);
    obj.take_profit_percentual = Number(simple.take_profit_percentual);
    obj.discovery_enabled = Boolean(simple.discovery_enabled);
    obj.discovery_limit = Number(simple.discovery_limit);
    obj.discovery_min_quote_volume = Number(simple.discovery_min_quote_volume);
    obj.discovery_min_score = Number(simple.discovery_min_score);
    obj.discovery_max_new_per_day = Number(simple.discovery_max_new_per_day);
    obj.discovery_cooldown_hours = Number(simple.discovery_cooldown_hours);
    obj.discovery_exclude_bases = String(simple.discovery_exclude_bases_csv || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);

    setSettings(JSON.stringify(obj, null, 2));
    setSettingsMsg("OK: modo simples aplicado no editor. Agora clique em “Salvar settings.yml”.");
  };

  const applyProfile = () => {
    const p = PROFILES[profile]?.values;
    if (!p) return;
    setSimple((prev) => ({ ...prev, ...p }));
    setSettingsMsg(`OK: perfil aplicado (${PROFILES[profile]?.label || profile}). Agora clique em “Aplicar no editor (JSON)” e depois “Salvar settings.yml”.`);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="Configurações (passo a passo)"
        right={
          <div className="flex items-center gap-2">
            <Badge tone={st?.write_enabled ? "good" : "warn"}>escrita: {st?.write_enabled ? "OK" : "OFF"}</Badge>
            <Button variant="secondary" onClick={() => refresh().catch(() => {})}>
              Recarregar
            </Button>
          </div>
        }
      >
        <div className="text-sm text-white/70">
          Token padrão no modo local: <span className="font-mono">local-dev</span>.
        </div>
        <details className="mt-2 text-sm text-white/70">
          <summary className="cursor-pointer select-none text-white/80">Onde pego as chaves?</summary>
          <div className="mt-2 grid gap-1 text-xs text-white/60">
            <div>Binance: sua conta → Gerenciamento de API (crie uma chave e copie API Key/Secret).</div>
            <div>NewsAPI: crie conta no NewsAPI e gere uma chave (NEWS_API_KEY).</div>
            <div>Telegram (opcional): crie bot no @BotFather (TELEGRAM_API_KEY) e pegue o Chat ID via @userinfobot.</div>
          </div>
        </details>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-xs text-white/60">Token</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="text-xs text-white/60">
            settings: <span className="font-mono">{st?.settings_path || "-"}</span>
          </div>
        </div>
      </Card>

      <Card title="Passo 1 — key.env">
        <div className="text-sm text-white/70">
          Preencha o que você tiver agora. <span className="font-semibold">Telegram é opcional</span> (apenas alertas). Binance é necessário para o bot real.
        </div>
        <label className="mt-2 text-xs text-white/60">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostrar valores digitados
        </label>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {ENV_FIELDS.map(({ k, label, hint, optional }) => (
            <div key={k}>
              <div className="flex items-baseline justify-between gap-2 text-xs text-white/60">
                <div className="truncate">
                  {k} <span className="text-white/40">— {label}</span>
                </div>
                {optional ? <span className="text-white/40">opcional</span> : null}
              </div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                type={show ? "text" : "password"}
                value={env[k]}
                onChange={(e) => setEnv((p) => ({ ...p, [k]: e.target.value }))}
              />
              <div className="mt-1 text-xs text-white/40">{hint}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" onClick={() => saveEnv().catch((e) => setEnvMsg("Erro: " + e.message))}>
            Salvar key.env
          </Button>
          {envMsg ? <div className="text-sm text-white/70">{envMsg}</div> : null}
        </div>
        <div className="mt-3">
          <div className="text-xs text-white/60">Detectado:</div>
          <textarea className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs" rows={5} readOnly value={presentText} />
        </div>
      </Card>

      <Card title="Passo 2 — settings.yml">
        <div className="text-sm text-white/70">
          Modo simples: ajuste os campos principais e aplique no editor. Depois clique em <span className="font-semibold">Salvar settings.yml</span>.
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-xs text-white/60">Perfil (atalho)</div>
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/25"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
            >
              <option value="conservador">Conservador</option>
              <option value="padrao">Padrão</option>
              <option value="agressivo">Agressivo</option>
            </select>
            <div className="mt-1 text-xs text-white/40">
              Perfis só mudam limites/thresholds. Não existe garantia de lucro.
            </div>
          </div>
          <Button variant="secondary" onClick={() => applyProfile()}>
            Aplicar perfil
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <input type="checkbox" checked={simple.testnet} onChange={(e) => setSimple((p) => ({ ...p, testnet: e.target.checked }))} />
            <span>Testnet (recomendado para começar)</span>
          </label>

          <div>
            <div className="text-xs text-white/60">Moedas monitoradas (CSV)</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
              value={simple.moedas_monitoradas_csv}
              onChange={(e) => setSimple((p) => ({ ...p, moedas_monitoradas_csv: e.target.value }))}
              placeholder="BTCUSDT,ETHUSDT,XRPUSDT"
            />
          </div>

          <div>
            <div className="text-xs text-white/60">Termo de notícias</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
              value={simple.news_term}
              onChange={(e) => setSimple((p) => ({ ...p, news_term: e.target.value }))}
              placeholder="crypto"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-white/60">Execução (s)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.intervalo_execucao}
                onChange={(e) => setSimple((p) => ({ ...p, intervalo_execucao: Number(e.target.value) }))}
                type="number"
                min={5}
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Pausa (s)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.intervalo_pausa}
                onChange={(e) => setSimple((p) => ({ ...p, intervalo_pausa: Number(e.target.value) }))}
                type="number"
                min={10}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-white/60">Mín. USDT/ordem</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.minimo_usdt_por_ordem}
                onChange={(e) => setSimple((p) => ({ ...p, minimo_usdt_por_ordem: Number(e.target.value) }))}
                type="number"
                min={1}
                step="0.1"
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Máx. moedas/ciclo</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.max_moedas_por_ciclo}
                onChange={(e) => setSimple((p) => ({ ...p, max_moedas_por_ciclo: Number(e.target.value) }))}
                type="number"
                min={1}
                step="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-white/60">Stop loss (%)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.stop_loss_percentual}
                onChange={(e) => setSimple((p) => ({ ...p, stop_loss_percentual: Number(e.target.value) }))}
                type="number"
                min={0.1}
                step="0.1"
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Take profit (%)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.take_profit_percentual}
                onChange={(e) => setSimple((p) => ({ ...p, take_profit_percentual: Number(e.target.value) }))}
                type="number"
                min={0.1}
                step="0.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-white/60">Buy threshold</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.buy_threshold}
                onChange={(e) => setSimple((p) => ({ ...p, buy_threshold: Number(e.target.value) }))}
                type="number"
                step="0.01"
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Avoid threshold</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.avoid_threshold}
                onChange={(e) => setSimple((p) => ({ ...p, avoid_threshold: Number(e.target.value) }))}
                type="number"
                step="0.01"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={simple.discovery_enabled}
              onChange={(e) => setSimple((p) => ({ ...p, discovery_enabled: e.target.checked }))}
            />
            <span>Buscar novas moedas (exige aprovação)</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-white/60">Discovery: top N</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.discovery_limit}
                onChange={(e) => setSimple((p) => ({ ...p, discovery_limit: Number(e.target.value) }))}
                type="number"
                min={5}
                step="1"
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Volume mínimo (USDT)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.discovery_min_quote_volume}
                onChange={(e) => setSimple((p) => ({ ...p, discovery_min_quote_volume: Number(e.target.value) }))}
                type="number"
                min={0}
                step="100000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-white/60">Score mínimo (discovery)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.discovery_min_score}
                onChange={(e) => setSimple((p) => ({ ...p, discovery_min_score: Number(e.target.value) }))}
                type="number"
                step="0.01"
                min={-1}
                max={1}
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Máx. novas/dia</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.discovery_max_new_per_day}
                onChange={(e) => setSimple((p) => ({ ...p, discovery_max_new_per_day: Number(e.target.value) }))}
                type="number"
                step="1"
                min={0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-white/60">Cooldown (h)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.discovery_cooldown_hours}
                onChange={(e) => setSimple((p) => ({ ...p, discovery_cooldown_hours: Number(e.target.value) }))}
                type="number"
                step="1"
                min={0}
              />
            </div>
            <div>
              <div className="text-xs text-white/60">Excluir bases (CSV)</div>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                value={simple.discovery_exclude_bases_csv}
                onChange={(e) => setSimple((p) => ({ ...p, discovery_exclude_bases_csv: e.target.value }))}
                placeholder="ex: PEPE,FLOKI"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => applySimpleToEditor()}>
            Aplicar no editor (JSON)
          </Button>
        </div>

        <div className="mt-4 text-xs text-white/60">Editor avançado (JSON → YAML). Se não souber, use o modo simples acima.</div>
        <textarea
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs outline-none focus:border-white/25"
          rows={16}
          value={settings}
          onChange={(e) => setSettings(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" onClick={() => saveSettings().catch((e) => setSettingsMsg("Erro: " + e.message))}>
            Salvar settings.yml
          </Button>
          {!settingsMsg ? null : <div className="text-sm text-white/70">{settingsMsg}</div>}
        </div>
      </Card>
    </div>
  );
}

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import streamlit as st

from Modulos.config import load_settings
from Modulos.paths import logs_dir
from Modulos.storage import Storage


st.set_page_config(page_title="HelpSystem • Binance Bot", layout="wide")


def _safe_json_load(s: str):
    try:
        return json.loads(s)
    except Exception:
        return None


def _fmt_tool() -> None:
    st.subheader("Ferramentas")
    st.caption("Padrão HelpSystem: utilitários rápidos e autoexplicativos.")

    tab1, tab2, tab3 = st.tabs(["JSON Formatter", "Base64 → Texto", "Analisar Projeto"])

    with tab1:
        raw = st.text_area("Cole um JSON", height=220, placeholder='{"ok": true}')
        col1, col2 = st.columns([1, 1])
        with col1:
            indent = st.number_input("Indentação", min_value=2, max_value=8, value=2)
        with col2:
            sort_keys = st.checkbox("Ordenar chaves", value=False)

        if st.button("Formatar JSON", use_container_width=True):
            try:
                parsed = json.loads(raw)
                st.code(json.dumps(parsed, indent=int(indent), ensure_ascii=False, sort_keys=bool(sort_keys)), language="json")
            except Exception as e:
                st.error(f"JSON inválido: {e}")

    with tab2:
        import base64

        b64 = st.text_area("Cole um Base64", height=160)
        if st.button("Decodificar", use_container_width=True):
            try:
                decoded = base64.b64decode(b64).decode("utf-8", errors="replace")
                st.code(decoded)
            except Exception as e:
                st.error(f"Falha ao decodificar: {e}")

    with tab3:
        from Modulos.project_analyzer import analyze_project

        st.caption("Aponta stack, manifests, e riscos básicos de um diretório local.")
        path = st.text_input("Caminho do projeto", value=str(Path.cwd().parent))
        if st.button("Analisar", use_container_width=True):
            try:
                rep = analyze_project(path)
                st.write(f"**Root:** {rep.root}")
                st.write("**Top-level:**")
                st.code("\n".join(rep.top_level))
                st.write("**Manifests:**", ", ".join(rep.manifests) if rep.manifests else "(nenhum)")
                st.write("**Linguagens (aprox.):**")
                st.json([{k: v} for k, v in rep.languages])
                st.write("**Dicas:**")
                for h in rep.hints:
                    st.write(f"- {h}")
                if rep.risks:
                    st.write("**Riscos:**")
                    for r in rep.risks:
                        st.write(f"- {r}")
            except Exception as e:
                st.error(str(e))


def _overview(storage: Storage) -> None:
    st.subheader("Visão Geral")
    settings = load_settings()

    trades = storage.trades_df(limit=5000)
    decisions = storage.decisions_df(limit=5000)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Testnet", str(settings.get("testnet", True)))
    c2.metric("Trades", int(trades.shape[0]))
    c3.metric("Decisões", int(decisions.shape[0]))
    c4.metric("Moedas monitoradas", len(settings.get("moedas_monitoradas", []) or []))

    st.divider()
    st.caption("Últimas decisões (explicáveis)")
    if decisions.empty:
        st.info("Sem decisões registradas ainda. Rode o bot pelo menos uma vez.")
        return

    # Explode o JSON (sem quebrar se tiver lixo)
    decisions = decisions.copy()
    decisions["details"] = decisions["details_json"].map(_safe_json_load)
    decisions["explain"] = decisions["details"].map(lambda d: (d or {}).get("explain"))
    decisions["sentiment"] = decisions["details"].map(lambda d: ((d or {}).get("signals") or {}).get("sentiment"))

    st.dataframe(
        decisions[["ts_utc", "symbol", "action", "score", "confidence", "sentiment"]],
        use_container_width=True,
        hide_index=True,
    )


def _trades(storage: Storage) -> None:
    st.subheader("Trades")
    df = storage.trades_df(limit=20000)
    if df.empty:
        st.info("Sem trades registrados.")
        return

    st.dataframe(
        df[["ts_utc", "symbol", "side", "qty", "price", "quote_qty", "status", "order_id"]],
        use_container_width=True,
        hide_index=True,
    )

    st.divider()
    st.caption("Volume (USDT) por símbolo")
    agg = df.groupby("symbol", as_index=False)["quote_qty"].sum().sort_values("quote_qty", ascending=False)
    st.bar_chart(agg.set_index("symbol")["quote_qty"])


def _decisions(storage: Storage) -> None:
    st.subheader("Decisões (Explainable)")
    df = storage.decisions_df(limit=5000)
    if df.empty:
        st.info("Sem decisões registradas.")
        return

    df = df.copy()
    df["details"] = df["details_json"].map(_safe_json_load)
    df["explain"] = df["details"].map(lambda d: (d or {}).get("explain") or [])
    df["signals"] = df["details"].map(lambda d: (d or {}).get("signals") or {})

    st.dataframe(df[["ts_utc", "symbol", "action", "score", "confidence"]], use_container_width=True, hide_index=True)

    st.divider()
    st.caption("Abrir uma decisão")
    symbols = df["symbol"].dropna().unique().tolist()
    symbol = st.selectbox("Símbolo", symbols, index=0)
    latest = df[df["symbol"] == symbol].head(1)
    if latest.empty:
        return

    row = latest.iloc[0]
    st.write(f"**Ação:** {row['action']}  |  **Score:** {row['score']:.2f}  |  **Confiança:** {row['confidence']:.2f}")
    with st.expander("Por que essa decisão foi tomada?", expanded=True):
        for line in row["explain"]:
            st.write(f"- {line}")
    with st.expander("Sinais brutos"):
        st.json(row["signals"])


def _config() -> None:
    st.subheader("Config")
    settings = load_settings()
    st.caption("A config vem de `BinanceBot/Configs/settings.yml` + `BinanceBot/Configs/key.env`.")
    st.json(settings)


def _logs() -> None:
    st.subheader("Logs")
    log_path = logs_dir() / "trading_bot.log"
    st.caption(f"Arquivo: {log_path}")
    if not log_path.exists():
        st.info("Nenhum log ainda.")
        return

    max_lines = st.slider("Linhas", min_value=50, max_value=2000, value=300, step=50)
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    tail = "\n".join(lines[-int(max_lines) :])
    st.code(tail)


def main() -> None:
    storage = Storage()

    st.title("📊 HelpSystem • Painel do Binance Bot")
    st.caption("Simples, moderno e autoexplicativo: você vê o que o bot decidiu e por quê.")

    tab_overview, tab_trades, tab_decisions, tab_config, tab_logs, tab_tools = st.tabs(
        ["Visão Geral", "Trades", "Decisões", "Config", "Logs", "Ferramentas"]
    )

    with tab_overview:
        _overview(storage)
    with tab_trades:
        _trades(storage)
    with tab_decisions:
        _decisions(storage)
    with tab_config:
        _config()
    with tab_logs:
        _logs()
    with tab_tools:
        _fmt_tool()


if __name__ == "__main__":
    main()

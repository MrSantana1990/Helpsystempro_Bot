import streamlit as st
import pandas as pd
import os

# Carregar histórico real de operações
def carregar_historico():
    arquivo = "logs/historico_operacoes.csv"

    if not os.path.exists(arquivo):
        return pd.DataFrame(columns=["Data", "Ativo", "Tipo", "Quantidade", "Preço", "Resultado"])

    return pd.read_csv(arquivo)

# Calcular métricas de performance
def calcular_metricas(historico):
    if historico.empty:
        return 0, 0, 0

    lucro_total = historico["Resultado"].sum()
    qtd_trades = len(historico)
    taxa_acerto = (historico[historico["Resultado"] > 0].shape[0] / qtd_trades) * 100 if qtd_trades > 0 else 0

    return lucro_total, qtd_trades, taxa_acerto

# Gráfico de evolução do saldo
def gerar_grafico_pnl(historico):
    if historico.empty:
        return pd.Series([0])

    historico["Acumulado"] = historico["Resultado"].cumsum()
    return historico.set_index("Data")["Acumulado"]

# Interface Principal
def main():
    st.set_page_config(page_title="Painel Binance Bot", layout="wide")
    st.title("📊 Painel de Controle - Binance Bot")

    historico = carregar_historico()
    lucro_total, qtd_trades, taxa_acerto = calcular_metricas(historico)

    # Métricas Principais
    col1, col2, col3 = st.columns(3)
    col1.metric("Lucro Total", f"${lucro_total:.2f}")
    col2.metric("Total de Trades", f"{qtd_trades}")
    col3.metric("Taxa de Acerto", f"{taxa_acerto:.2f}%")

    # Gráfico PnL
    st.subheader("📈 Evolução do Saldo")
    st.line_chart(gerar_grafico_pnl(historico))

    # Tabela de Histórico de Operações
    st.subheader("📊 Histórico de Operações")
    st.dataframe(historico)

if __name__ == "__main__":
    main()

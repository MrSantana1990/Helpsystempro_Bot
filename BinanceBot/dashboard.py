import streamlit as st

def main():
    st.title("📊 Painel de Controle - Binance Bot")

    st.header("📈 Resumo de Operações")
    st.text("Lucro Total: $20")
    st.text("Última Operação: Compra de BTCUSDT")

    st.header("📊 Gráfico de Preços (Simulado)")
    st.line_chart([10200, 10300, 10100, 10400])

if __name__ == "__main__":
    main()

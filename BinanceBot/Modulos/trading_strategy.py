import pandas as pd
import numpy as np
from binance.client import Client

def configurar_stop_loss(preco_compra, percentual_perda):
    return preco_compra * (1 - percentual_perda / 100)

def configurar_take_profit(preco_compra, percentual_lucro):
    return preco_compra * (1 + percentual_lucro / 100)

def calcular_rsi(fecha_precos, periodo=14):
    delta = fecha_precos.diff(1)
    ganhos = delta.where(delta > 0, 0)
    perdas = -delta.where(delta < 0, 0)

    media_ganho = ganhos.rolling(window=periodo).mean()
    media_perda = perdas.rolling(window=periodo).mean()

    rs = media_ganho / media_perda
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calcular_bollinger_bands(fecha_precos, periodo=20, desvios=2):
    media_movel = fecha_precos.rolling(window=periodo).mean()
    desvio_padrao = fecha_precos.rolling(window=periodo).std()

    banda_superior = media_movel + (desvios * desvio_padrao)
    banda_inferior = media_movel - (desvios * desvio_padrao)

    return banda_inferior, media_movel, banda_superior

def sinal_rsi(client, par_moeda, periodo=14):
    try:
        klines = client.get_klines(symbol=par_moeda, interval=Client.KLINE_INTERVAL_1HOUR, limit=100)
        fechamentos = pd.Series([float(kline[4]) for kline in klines])

        rsi = calcular_rsi(fechamentos, periodo).iloc[-1]
        if rsi < 30:
            return 'compra'
        elif rsi > 70:
            return 'venda'
        else:
            return 'aguardar'

    except Exception as e:
        print(f"Erro ao calcular RSI para {par_moeda}: {e}")
        return 'erro'

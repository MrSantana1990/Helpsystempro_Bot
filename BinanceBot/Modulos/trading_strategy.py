import pandas as pd
import numpy as np
import logging
from binance.client import Client

from .config import load_settings

# Configurar logger
logger = logging.getLogger(__name__)

# Carregar configurações dinâmicas
config = load_settings()

# ----------------- STOP LOSS E TAKE PROFIT -----------------

def configurar_stop_loss(preco_compra, percentual_perda=None):
    percentual_perda = percentual_perda or config.get('stop_loss_percentual', 2)
    stop_loss = preco_compra * (1 - percentual_perda / 100)
    logger.info(f"🛑 Stop Loss configurado em {stop_loss:.2f} (Perda {percentual_perda}%)")
    return stop_loss


def configurar_take_profit(preco_compra, percentual_lucro=None):
    percentual_lucro = percentual_lucro or config.get('take_profit_percentual', 5)
    take_profit = preco_compra * (1 + percentual_lucro / 100)
    logger.info(f"✅ Take Profit configurado em {take_profit:.2f} (Lucro {percentual_lucro}%)")
    return take_profit


# ----------------- VALIDAÇÃO -----------------

def validar_precos(fecha_precos):
    if fecha_precos.isnull().sum() > 0 or len(fecha_precos) < 20:
        logger.warning("⚠️ Dados de preços inconsistentes ou insuficientes.")
        return False
    return True


# ----------------- INDICADORES TÉCNICOS -----------------

def calcular_rsi(fecha_precos, periodo=None):
    periodo = periodo or config.get('rsi_periodo', 14)

    if not validar_precos(fecha_precos):
        return None

    delta = fecha_precos.diff(1)
    ganhos = delta.where(delta > 0, 0)
    perdas = -delta.where(delta < 0, 0)

    media_ganho = ganhos.rolling(window=periodo).mean()
    media_perda = perdas.rolling(window=periodo).mean()

    rs = media_ganho / media_perda
    rsi = 100 - (100 / (1 + rs))

    logger.info(f"📊 RSI calculado: {rsi.iloc[-1]:.2f}")
    return rsi


def calcular_bollinger_bands(fecha_precos, periodo=20, desvios=2):
    if not validar_precos(fecha_precos):
        return None, None, None

    media_movel = fecha_precos.rolling(window=periodo).mean()
    desvio_padrao = fecha_precos.rolling(window=periodo).std()

    banda_superior = media_movel + (desvios * desvio_padrao)
    banda_inferior = media_movel - (desvios * desvio_padrao)

    logger.info(f"📊 Bollinger Bands calculadas para período {periodo}.")
    return banda_inferior, media_movel, banda_superior


def calcular_macd(fecha_precos, curto=12, longo=26, sinal=9):
    if not validar_precos(fecha_precos):
        return None, None, None

    ema_curta = fecha_precos.ewm(span=curto, adjust=False).mean()
    ema_longa = fecha_precos.ewm(span=longo, adjust=False).mean()
    macd = ema_curta - ema_longa
    sinal_macd = macd.ewm(span=sinal, adjust=False).mean()

    logger.info(f"📊 MACD calculado (Curto={curto}, Longo={longo}, Sinal={sinal})")
    return macd, sinal_macd, macd - sinal_macd


def calcular_ema_cruzada(fecha_precos, curto=9, longo=21):
    if not validar_precos(fecha_precos):
        return None, None

    ema_curta = fecha_precos.ewm(span=curto, adjust=False).mean()
    ema_longa = fecha_precos.ewm(span=longo, adjust=False).mean()

    cruzamento = "neutro"
    if ema_curta.iloc[-1] > ema_longa.iloc[-1]:
        cruzamento = "alta"
    elif ema_curta.iloc[-1] < ema_longa.iloc[-1]:
        cruzamento = "baixa"

    logger.info(f"📊 EMA Cruzada: {cruzamento}")
    return ema_curta, ema_longa


def calcular_volume_oscillator(volumes, curto=14, longo=28):
    if len(volumes) < longo:
        logger.warning("📉 Volume insuficiente para cálculo do Oscillator.")
        return None

    ma_curta = volumes.rolling(window=curto).mean()
    ma_longa = volumes.rolling(window=longo).mean()

    oscillator = ((ma_curta - ma_longa) / ma_longa) * 100
    logger.info(f"📊 Volume Oscillator: {oscillator.iloc[-1]:.2f}%")
    return oscillator


# ----------------- HISTÓRICO -----------------

def carregar_historico(client, par_moeda, intervalo=Client.KLINE_INTERVAL_1HOUR, limite=100):
    try:
        klines = client.get_klines(symbol=par_moeda, interval=intervalo, limit=limite)
        fechamentos = pd.Series([float(kline[4]) for kline in klines])
        volumes = pd.Series([float(kline[5]) for kline in klines])
        return fechamentos, volumes
    except Exception as e:
        logger.error(f"Erro ao carregar histórico de {par_moeda}: {e}")
        return pd.Series(dtype=float), pd.Series(dtype=float)


# ----------------- SINAL DE COMPRA/VENDA -----------------

def sinal_rsi(client, par_moeda):
    try:
        fechamentos, _ = carregar_historico(client, par_moeda)
        if fechamentos.empty:
            return 'erro'

        rsi = calcular_rsi(fechamentos)
        if rsi is None:
            return 'erro'

        rsi_atual = rsi.iloc[-1]
        limite_compra = config.get('rsi_compra', 30)
        limite_venda = config.get('rsi_venda', 70)

        if rsi_atual < limite_compra:
            logger.info(f"📉 Sinal RSI: COMPRA ({rsi_atual:.2f})")
            return 'compra'
        elif rsi_atual > limite_venda:
            logger.info(f"📈 Sinal RSI: VENDA ({rsi_atual:.2f})")
            return 'venda'
        else:
            logger.info(f"🔎 Sinal RSI: AGUARDAR ({rsi_atual:.2f})")
            return 'aguardar'

    except Exception as e:
        logger.error(f"Erro ao calcular sinal RSI para {par_moeda}: {e}")
        return 'erro'

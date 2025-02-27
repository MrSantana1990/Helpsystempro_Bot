import aiohttp
import asyncio
from textblob import TextBlob
import os
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente
load_dotenv(dotenv_path='C:\\Users\\Rodolfo Santana\\Documents\\github\\binancebot\\config\\key.env')

# Obter a chave da API de notícias
API_KEY_NEWS = os.getenv('NEWS_API_KEY')

# Buscar notícias relacionadas a criptomoedas
async def buscar_noticias(termo='crypto'):
    if not API_KEY_NEWS:
        logger.error("API Key da NewsAPI não encontrada. Verifique o arquivo .env.")
        return []
    url = f"https://newsapi.org/v2/everything?q={termo}&language=pt&apiKey={API_KEY_NEWS}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.json()
                return data.get('articles', [])
    except Exception as e:
        logger.error(f"Erro ao buscar notícias: {e}")
        return []

# Analisar o sentimento das notícias
def analisar_sentimento(noticias):
    sentimentos = []
    for noticia in noticias:
        titulo = noticia.get('title', '')
        descricao = noticia.get('description', '')
        texto = f"{titulo} {descricao}" if titulo and descricao else ''
        sentimento = TextBlob(texto).sentiment.polarity
        sentimentos.append(sentimento)
    return sum(sentimentos) / len(sentimentos) if sentimentos else 0

# Ajustar variáveis de operação com base no sentimento
def ajustar_variaveis(sentimento_geral):
    if sentimento_geral > 0.1:
        return 'compra', 0.02
    elif sentimento_geral < -0.1:
        return 'venda', 0.01
    else:
        return 'aguardar', 0.005

# Avaliar moedas com base na variação de preço e volume
def avaliar_moeda(client, par_moeda):
    try:
        ticker = client.get_ticker(symbol=par_moeda)
        variacao_percentual = float(ticker['priceChangePercent'])
        volume = float(ticker['quoteVolume'])
        return {
            'moeda': par_moeda,
            'variacao_percentual': variacao_percentual,
            'volume': volume
        }
    except Exception as e:
        logger.error(f"Erro ao avaliar a moeda {par_moeda}: {e}")
        return None

# Selecionar as melhores moedas com base no sentimento e dados do mercado
def selecionar_melhores_moedas(client, sentimento, saldo_disponivel):
    moedas_possiveis = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'SOLUSDT']
    moedas_avaliadas = [avaliar_moeda(client, moeda) for moeda in moedas_possiveis]
    moedas_avaliadas = [m for m in moedas_avaliadas if m]

    # Filtro por saldo disponível
    moedas_filtradas = []
    for moeda in moedas_avaliadas:
        preco_atual = buscar_preco(moeda['moeda'])
        if saldo_disponivel >= preco_atual * 0.001:  # Exemplo: 0.001 unidade mínima
            moedas_filtradas.append(moeda)

    moedas_filtradas.sort(key=lambda x: x['variacao_percentual'], reverse=True)

    if sentimento > 0.5:
        return [m['moeda'] for m in moedas_filtradas[:3]]
    elif 0 < sentimento <= 0.5:
        return [m['moeda'] for m in moedas_filtradas[:2]]
    else:
        return [m['moeda'] for m in moedas_filtradas[-2:]]

# Verificar o valor mínimo de compra
async def verificar_minimo_compra(moeda):
    url = "https://api.binance.com/api/v3/exchangeInfo"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.json()
                for symbol in data['symbols']:
                    if symbol['symbol'] == moeda:
                        for filtro in symbol['filters']:
                            if filtro['filterType'] == 'MIN_NOTIONAL':
                                return float(filtro['minNotional'])
                logger.warning(f"⚠️ Moeda {moeda} não encontrada ou sem filtro MIN_NOTIONAL.")
                return None
    except Exception as e:
        logger.error(f"Erro ao verificar mínimo de compra para {moeda}: {e}")
        return None

# Buscar informações da Binance
async def buscar_informacoes_binance(symbol):
    url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                return await response.json()
    except Exception as e:
        logger.error(f"Erro ao buscar informações da Binance para {symbol}: {e}")
        return None

# Função principal para processar notícias e moedas
async def processar_noticias(client):
    noticias = await buscar_noticias()
    if not noticias:
        logger.warning("Nenhuma notícia encontrada para análise.")
        return

    sentimento_geral = analisar_sentimento(noticias)
    logger.info(f"Sentimento geral das notícias: {sentimento_geral}")

    acao, risco = ajustar_variaveis(sentimento_geral)
    logger.info(f"Ação sugerida: {acao}, Risco: {risco}")

    melhores_moedas = selecionar_melhores_moedas(client, sentimento_geral)
    logger.info(f"Melhores moedas para negociação: {melhores_moedas}")

    for moeda in melhores_moedas:
        min_notional = await verificar_minimo_compra(moeda)
        informacoes = await buscar_informacoes_binance(moeda)
        if informacoes:
            logger.info(f"Informações para {moeda}: {informacoes}")

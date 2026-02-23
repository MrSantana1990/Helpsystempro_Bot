import aiohttp
import logging
from textblob import TextBlob
from cachetools import TTLCache

from .config import load_env, load_settings

logger = logging.getLogger(__name__)

# Cache de notícias - reduz chamadas duplicadas
cache_noticias = TTLCache(maxsize=10, ttl=3600)

# Carregar configurações dinâmicas
config = load_settings()

# Buscar notícias com cache
async def buscar_noticias(termo='crypto'):
    if termo in cache_noticias:
        logger.info(f"📰 Notícias de '{termo}' carregadas do cache.")
        return cache_noticias[termo]

    api_key = load_env().news_api_key
    if not api_key:
        logger.error("❌ API Key da NewsAPI não encontrada.")
        return []

    url = f"https://newsapi.org/v2/everything?q={termo}&language=pt&apiKey={api_key}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.json()
                artigos = data.get('articles', [])
                cache_noticias[termo] = artigos
                return artigos
    except Exception as e:
        logger.error(f"Erro ao buscar notícias: {e}")
        return []

# Analisar sentimento de uma lista de notícias
def analisar_sentimento(noticias):
    sentimentos = []
    for noticia in noticias:
        texto = f"{noticia.get('title', '')} {noticia.get('description', '')}".strip()
        if texto:
            sentimento = TextBlob(texto).sentiment.polarity
            sentimentos.append(sentimento)

    media_sentimento = sum(sentimentos) / len(sentimentos) if sentimentos else 0
    logger.info(f"📊 Sentimento médio: {media_sentimento:.2f}")
    return media_sentimento

# Ajustar estratégia com base no sentimento geral
def ajustar_variaveis(sentimento_geral):
    if sentimento_geral > 0.1:
        return 'compra', 0.02
    elif sentimento_geral < -0.1:
        return 'venda', 0.01
    else:
        return 'aguardar', 0.005

# Coletar dados de variação de preço e volume
def avaliar_moeda(client, par_moeda):
    try:
        ticker = client.get_ticker(symbol=par_moeda)
        return {
            'moeda': par_moeda,
            'variacao_percentual': float(ticker['priceChangePercent']),
            'volume': float(ticker['quoteVolume'])
        }
    except Exception as e:
        logger.error(f"Erro ao avaliar a moeda {par_moeda}: {e}")
        return None

# Selecionar melhores moedas considerando sentimento e mercado
def selecionar_melhores_moedas(client, sentimento, saldo_disponivel):
    moedas_possiveis = config.get('moedas_monitoradas', ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'SOLUSDT'])
    avaliadas = filter(None, [avaliar_moeda(client, moeda) for moeda in moedas_possiveis])

    # Filtro de saldo disponível (exemplo com 0.001 mínimo)
    moedas_filtradas = []
    for moeda in avaliadas:
        preco = buscar_preco(client, moeda['moeda'])
        if saldo_disponivel >= preco * 0.001:
            moedas_filtradas.append(moeda)

    moedas_filtradas.sort(key=lambda x: x['variacao_percentual'], reverse=True)

    if sentimento > 0.5:
        return [m['moeda'] for m in moedas_filtradas[:3]]
    elif sentimento > 0:
        return [m['moeda'] for m in moedas_filtradas[:2]]
    else:
        return [m['moeda'] for m in moedas_filtradas[-2:]]

# Buscar preço atual
def buscar_preco(client, par_moeda):
    try:
        ticker = client.get_symbol_ticker(symbol=par_moeda)
        return float(ticker['price'])
    except Exception as e:
        logger.error(f"Erro ao buscar preço de {par_moeda}: {e}")
        return 0.0

# Buscar informações da Binance para o par
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

# Processamento completo de notícias e moedas
async def processar_noticias(client):
    noticias = await buscar_noticias()
    if not noticias:
        logger.warning("⚠️ Nenhuma notícia encontrada para análise.")
        return

    sentimento_geral = analisar_sentimento(noticias)
    acao, risco = ajustar_variaveis(sentimento_geral)

    logger.info(f"📊 Sentimento: {sentimento_geral:.2f} | Ação sugerida: {acao} | Risco: {risco:.3%}")

    melhores_moedas = selecionar_melhores_moedas(client, sentimento_geral, verificar_saldo(client))
    logger.info(f"💰 Moedas sugeridas: {melhores_moedas}")

    for moeda in melhores_moedas:
        info = await buscar_informacoes_binance(moeda)
        if info:
            logger.info(f"📈 Dados 24h {moeda}: {info}")

# Verificar saldo (necessário para filtro de moedas)
def verificar_saldo(client):
    try:
        saldo = client.get_asset_balance(asset='USDT')
        return float(saldo['free'])
    except Exception as e:
        logger.error(f"Erro ao verificar saldo: {e}")
        return 0.0

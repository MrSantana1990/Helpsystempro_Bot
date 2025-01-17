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

# Função para buscar notícias relacionadas a criptomoedas
async def buscar_noticias(termo='crypto'):
    if not API_KEY_NEWS:
        print("API Key da NewsAPI não encontrada. Verifique o arquivo .env.")
        return []
    url = f"https://newsapi.org/v2/everything?q={termo}&language=pt&apiKey={API_KEY_NEWS}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    print(f"Falha ao buscar notícias: Código de status HTTP inválido {response.status}")
                    return []
                data = await response.json(content_type=None)
                noticias = data.get('articles', [])
                if not noticias:
                    print("Nenhuma notícia encontrada.")
                return noticias
    except aiohttp.ClientError as e:
        print(f"Erro ao buscar notícias: {e}")
        return []

# Função para analisar o sentimento das notícias
def analisar_sentimento(noticias):
    sentimentos = []
    for noticia in noticias:
        titulo = noticia.get('title', '')
        descricao = noticia.get('description', '')
        texto = f"{titulo} {descricao}" if titulo and descricao else ''
        sentimento = TextBlob(texto).sentiment.polarity
        sentimentos.append(sentimento)
    return sum(sentimentos) / len(sentimentos) if sentimentos else 0

# Função para ajustar as variáveis de operação com base no sentimento
def ajustar_variaveis(sentimento_geral):
    if sentimento_geral > 0.1:
        print("Sentimento positivo. Considerando compra.")
        return 'compra', 0.02
    elif sentimento_geral < -0.1:
        print("Sentimento negativo. Considerando venda ou precaução.")
        return 'venda', 0.01
    else:
        print("Sentimento neutro. Aguardando melhores oportunidades.")
        return 'aguardar', 0.005

# Função para selecionar as melhores moedas com base no sentimento
def selecionar_melhores_moedas(sentimento):
    moedas_possiveis = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT']
    if sentimento > 0.5:
        return moedas_possiveis
    elif 0 < sentimento <= 0.5:
        return ['BTCUSDT', 'ETHUSDT']
    else:
        return ['XRPUSDT', 'DOGEUSDT']

# 🔍 Buscar o valor mínimo de compra (LOT_SIZE e MIN_NOTIONAL)
async def verificar_minimo_compra(moeda):
    url = "https://api.binance.com/api/v3/exchangeInfo"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.json()

                for symbol in data['symbols']:
                    if symbol['symbol'] == moeda:
                        min_notional = None

                        for filtro in symbol['filters']:
                            if filtro['filterType'] == 'MIN_NOTIONAL':
                                min_notional = float(filtro['minNotional'])
                                break  # Parar após encontrar o filtro necessário

                        if min_notional:
                            print(f"🔍 Minimo de compra para {moeda}: {min_notional}")
                            return min_notional

                print(f"⚠️ Moeda {moeda} não encontrada ou sem filtros disponíveis.")
                return None
    except Exception as e:
        print(f"❌ Erro ao verificar o mínimo de compra para {moeda}: {e}")
        logger.error(f"Erro ao verificar o mínimo de compra: {e}")
        return None

# Função para buscar informações da Binance
async def buscar_informacoes_binance(symbol):
    url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                data = await response.json(content_type=None)
                print(f"Informações da Binance para {symbol}: {data}")
                return data
    except aiohttp.ClientError as e:
        print(f"Erro ao buscar informações da Binance: {e}")
        return None

# Função para buscar e processar notícias
async def processar_noticias():
    noticias = await buscar_noticias()
    if not noticias:
        print("Nenhuma notícia encontrada para analisar.")
        return

    sentimento_geral = analisar_sentimento(noticias)
    print(f"Sentimento geral das notícias: {sentimento_geral}")

    acao, risco = ajustar_variaveis(sentimento_geral)
    print(f"Ação sugerida: {acao}, Risco: {risco}")

    melhores_moedas = selecionar_melhores_moedas(sentimento_geral)
    print(f"Melhores moedas para negociação: {melhores_moedas}")

    for moeda in melhores_moedas:
        await verificar_minimo_compra(moeda)
        informacoes = await buscar_informacoes_binance(moeda)
        if informacoes:
            print(f"Informações para {moeda}: {informacoes}")

# Executar a análise de notícias
asyncio.run(processar_noticias())

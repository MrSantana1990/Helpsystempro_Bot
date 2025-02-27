from binance.client import Client
import logging

logger = logging.getLogger(__name__)

def calcular_stop_take(preco_compra, stop=2, take=5):
    stop_loss = preco_compra * (1 - stop / 100)
    take_profit = preco_compra * (1 + take / 100)
    return stop_loss, take_profit

async def verificar_minimo_compra(client, par_moeda):
    try:
        exchange_info = client.get_symbol_info(par_moeda)
        if exchange_info is None:
            logger.error(f"⚠️ Par de moedas {par_moeda} não encontrado na Binance.")
            return None

        for filtro in exchange_info['filters']:
            if filtro['filterType'] == 'NOTIONAL':
                min_notional = float(filtro['minNotional'])
                logger.info(f"🔍 MinNotional (NOTIONAL) para {par_moeda}: {min_notional}")
                return min_notional
            elif filtro['filterType'] == 'MIN_NOTIONAL':  # Verificação de compatibilidade
                min_notional = float(filtro['minNotional'])
                logger.info(f"🔍 MinNotional (MIN_NOTIONAL) para {par_moeda}: {min_notional}")
                return min_notional

        logger.warning(f"⚠️ Filtro NOTIONAL/MIN_NOTIONAL não encontrado para {par_moeda}.")
        return None

    except Exception as e:
        logger.error(f"❌ Erro ao verificar mínimo de compra para {par_moeda}: {e}")
        return None

def ajustar_quantidade(client, par_moeda, quantidade_desejada):
    try:
        exchange_info = client.get_symbol_info(par_moeda)
        for filtro in exchange_info['filters']:
            if filtro['filterType'] == 'LOT_SIZE':
                step_size = float(filtro['stepSize'])
                casas_decimais = abs(int(format(step_size, 'e').split('e-')[1]))
                quantidade_corrigida = quantidade_desejada - (quantidade_desejada % step_size)
                quantidade_formatada = f"{quantidade_corrigida:.{casas_decimais}f}".rstrip('0').rstrip('.')
                logger.info(f"🔍 Quantidade ajustada para {par_moeda}: {quantidade_formatada}")
                return quantidade_formatada
        logger.warning(f"⚠️ Filtro LOT_SIZE não encontrado para {par_moeda}.")
    except Exception as e:
        logger.error(f"❌ Erro ao ajustar quantidade para {par_moeda}: {e}")
    return quantidade_desejada

async def verificar_taxas(client):
    try:
        info = client.get_trade_fee()
        taxas = {f['symbol']: f['makerCommission'] for f in info['tradeFee']}
        logger.info(f"🔍 Taxas obtidas: {taxas}")
        return taxas
    except Exception as e:
        logger.error(f"❌ Erro ao verificar taxas: {e}")
        return {}

def converter_para_usdt(client, par_moeda, quantidade):
    try:
        ordem_venda = client.order_market_sell(
            symbol=par_moeda,
            quantity=quantidade
        )
        logger.info(f"🟢 Venda realizada de {quantidade} {par_moeda}: {ordem_venda}")
        return ordem_venda
    except Exception as e:
        logger.error(f"❌ Erro ao converter {par_moeda} para USDT: {e}")
        return None

async def executar_compra(client, par_moeda, saldo_disponivel, preco_atual, enviar_mensagem_telegram):
    min_notional = await verificar_minimo_compra(client, par_moeda)

    # Garantir que o valor mínimo de compra seja respeitado
    if min_notional is None:
        mensagem = f"⚠️ Não foi possível determinar o valor mínimo de compra para {par_moeda}."
        await enviar_mensagem_telegram(mensagem)
        logger.warning(mensagem)
        return

    valor_ordem = saldo_disponivel
    if valor_ordem < min_notional:
        mensagem = f"⚠️ Ordem para {par_moeda} abaixo do mínimo permitido ({min_notional}). Valor da ordem: {valor_ordem:.2f}."
        await enviar_mensagem_telegram(mensagem)
        logger.warning(mensagem)
        return

    quantidade = ajustar_quantidade(client, par_moeda, valor_ordem / preco_atual)
    valor_ordem_final = float(quantidade) * preco_atual

    if valor_ordem_final < min_notional:
        mensagem = f"❌ Quantidade ajustada não atende ao mínimo permitido para {par_moeda}. Valor: {valor_ordem_final:.2f}"
        await enviar_mensagem_telegram(mensagem)
        logger.warning(mensagem)
        return

    try:
        ordem = client.order_market_buy(symbol=par_moeda, quantity=quantidade)
        mensagem = f"🟢 Compra realizada de {par_moeda}: {ordem}"
        await enviar_mensagem_telegram(mensagem)
        logger.info(mensagem)
        
    except Exception as e:
        mensagem = f"❌ Erro ao comprar {par_moeda}: {e}"
        await enviar_mensagem_telegram(mensagem)
        logger.error(mensagem)

        # Configurar Stop-Loss e Take-Profit
        stop_loss, take_profit = calcular_stop_take(preco_atual, stop=2, take=5)
        logger.info(f"🔒 Configurado Stop-Loss: {stop_loss:.2f}, Take-Profit: {take_profit:.2f}")

        # Monitorar preço e realizar venda ao atingir lucro desejado
        while True:
            preco_atualizado = float(client.get_symbol_ticker(symbol=par_moeda)['price'])
            if preco_atualizado >= take_profit:
                converter_para_usdt(client, par_moeda, quantidade)
                mensagem = f"🎯 Lucro atingido! Venda realizada de {par_moeda} com preço {preco_atualizado}."
                await enviar_mensagem_telegram(mensagem)
                logger.info(mensagem)
                break
            elif preco_atualizado <= stop_loss:
                converter_para_usdt(client, par_moeda, quantidade)
                mensagem = f"⛔ Stop-Loss acionado! Venda realizada de {par_moeda} com preço {preco_atualizado}."
                await enviar_mensagem_telegram(mensagem)
                logger.info(mensagem)
                break

    except Exception as e:
        mensagem = f"❌ Erro ao comprar {par_moeda}: {e}"
        await enviar_mensagem_telegram(mensagem)
        logger.error(mensagem)

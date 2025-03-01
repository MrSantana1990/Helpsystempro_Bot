from binance.client import Client
import logging
import asyncio

logger = logging.getLogger(__name__)

# ----------------- CALCULOS DE STOP E TAKE -----------------

def calcular_stop_take(preco_compra, stop=2, take=5):
    stop_loss = preco_compra * (1 - stop / 100)
    take_profit = preco_compra * (1 + take / 100)
    return stop_loss, take_profit


# ----------------- VERIFICAÇÃO DE MIN_NOTIONAL -----------------

async def verificar_minimo_compra(client, par_moeda):
    try:
        exchange_info = client.get_symbol_info(par_moeda)
        if not exchange_info:
            logger.error(f"⚠️ Par {par_moeda} não encontrado na Binance.")
            return None

        for filtro in exchange_info['filters']:
            if filtro['filterType'] in ['NOTIONAL', 'MIN_NOTIONAL']:
                min_notional = float(filtro['minNotional'])
                logger.info(f"🔍 MinNotional para {par_moeda}: {min_notional}")
                return min_notional

        logger.warning(f"⚠️ Nenhum filtro NOTIONAL encontrado para {par_moeda}.")
        return None

    except Exception as e:
        logger.error(f"❌ Erro ao verificar minNotional de {par_moeda}: {e}")
        return None


# ----------------- AJUSTE DE QUANTIDADE -----------------

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
        return quantidade_desejada

    except Exception as e:
        logger.error(f"❌ Erro ao ajustar quantidade para {par_moeda}: {e}")
        return quantidade_desejada


# ----------------- EXECUÇÃO DE COMPRA -----------------

async def executar_compra(client, par_moeda, saldo_disponivel, preco_atual, enviar_mensagem_telegram):
    min_notional = await verificar_minimo_compra(client, par_moeda)

    if not min_notional:
        mensagem = f"⚠️ MinNotional não encontrado para {par_moeda}. Compra cancelada."
        await enviar_mensagem_telegram(mensagem)
        logger.warning(mensagem)
        return

    if saldo_disponivel < min_notional:
        mensagem = f"⚠️ Saldo insuficiente para operar {par_moeda}. Mínimo: {min_notional:.2f} USDT."
        await enviar_mensagem_telegram(mensagem)
        logger.warning(mensagem)
        return

    quantidade = ajustar_quantidade(client, par_moeda, saldo_disponivel / preco_atual)
    valor_ordem = float(quantidade) * preco_atual

    if valor_ordem < min_notional:
        mensagem = f"❌ Ordem ajustada abaixo do mínimo ({valor_ordem:.2f} USDT). Compra cancelada."
        await enviar_mensagem_telegram(mensagem)
        logger.warning(mensagem)
        return

    try:
        ordem = client.order_market_buy(symbol=par_moeda, quantity=quantidade)
        logger.info(f"🟢 Ordem de compra executada: {ordem}")
        await enviar_mensagem_telegram(f"🟢 Compra executada: {quantidade} {par_moeda} a {preco_atual:.2f} USDT")

        asyncio.create_task(monitorar_pos_compra(client, par_moeda, float(quantidade), preco_atual, enviar_mensagem_telegram))

    except Exception as e:
        logger.error(f"❌ Erro ao executar compra de {par_moeda}: {e}")
        await enviar_mensagem_telegram(f"❌ Erro na compra de {par_moeda}: {e}")


# ----------------- MONITORAMENTO DE TAKE E STOP -----------------

async def monitorar_pos_compra(client, par_moeda, quantidade, preco_compra, enviar_mensagem_telegram):
    stop_loss, take_profit = calcular_stop_take(preco_compra)

    logger.info(f"🔒 Monitorando {par_moeda}: SL={stop_loss:.2f}, TP={take_profit:.2f}")

    while True:
        try:
            preco_atual = float(client.get_symbol_ticker(symbol=par_moeda)['price'])

            if preco_atual >= take_profit:
                await executar_venda(client, par_moeda, quantidade, "Take Profit atingido", enviar_mensagem_telegram)
                break

            if preco_atual <= stop_loss:
                await executar_venda(client, par_moeda, quantidade, "Stop Loss atingido", enviar_mensagem_telegram)
                break

            await asyncio.sleep(5)

        except Exception as e:
            logger.error(f"❌ Erro ao monitorar preço de {par_moeda}: {e}")
            await asyncio.sleep(10)


# ----------------- EXECUÇÃO DE VENDA -----------------

async def executar_venda(client, par_moeda, quantidade, motivo, enviar_mensagem_telegram):
    try:
        ordem = client.order_market_sell(symbol=par_moeda, quantity=quantidade)
        logger.info(f"🔴 Ordem de venda executada: {ordem}")

        mensagem = f"🔴 Venda de {quantidade} {par_moeda} realizada ({motivo})."
        await enviar_mensagem_telegram(mensagem)

    except Exception as e:
        logger.error(f"❌ Erro ao executar venda de {par_moeda}: {e}")
        await enviar_mensagem_telegram(f"❌ Erro ao vender {par_moeda}: {e}")

from __future__ import annotations

import asyncio
import logging

from .config import load_settings
from .storage import Storage, make_trade

logger = logging.getLogger(__name__)


def calcular_stop_take(preco_compra: float, stop: float | None = None, take: float | None = None) -> tuple[float, float]:
    settings = load_settings()
    stop = float(stop if stop is not None else settings.get("stop_loss_percentual", 2.0))
    take = float(take if take is not None else settings.get("take_profit_percentual", 5.0))
    stop_loss = float(preco_compra) * (1 - stop / 100)
    take_profit = float(preco_compra) * (1 + take / 100)
    return stop_loss, take_profit


def _min_notional_from_info(exchange_info: dict) -> float | None:
    try:
        for filtro in exchange_info.get("filters") or []:
            if filtro.get("filterType") in {"NOTIONAL", "MIN_NOTIONAL"}:
                v = float(filtro.get("minNotional") or 0.0)
                return v if v > 0 else None
    except Exception:
        return None
    return None


async def verificar_minimo_compra(client, par_moeda: str) -> float | None:
    try:
        exchange_info = client.get_symbol_info(par_moeda)
        if not exchange_info:
            logger.error("Par %s não encontrado na Binance.", par_moeda)
            return None
        return _min_notional_from_info(exchange_info)
    except Exception as e:
        logger.error("Erro ao verificar minNotional de %s: %s", par_moeda, e)
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

async def executar_compra(
    client,
    par_moeda,
    saldo_disponivel,
    preco_atual,
    enviar_mensagem_telegram,
    *,
    dry_run: bool = False,
    storage: Storage | None = None,
):
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

    if dry_run:
        msg = f"DRY-RUN: compra simulada {quantidade} {par_moeda} a {preco_atual:.6f} USDT (≈ {valor_ordem:.2f} USDT)"
        logger.info(msg)
        await enviar_mensagem_telegram(msg)
        if storage is not None:
            storage.record_trade(
                make_trade(
                    symbol=par_moeda,
                    side="BUY",
                    qty=float(quantidade),
                    price=float(preco_atual),
                    quote_qty=float(valor_ordem),
                    status="SIMULATED",
                    order_id=None,
                    raw={"dry_run": True},
                )
            )
        return

    def _enrich_order_with_hs(ordem: dict, *, symbol: str) -> dict:
        """
        Normaliza métricas de execução:
        - executed_qty / quote_qty (cummulativeQuoteQty)
        - avg_price (quote/qty)
        - fills com fee_usdt (best-effort)
        """
        try:
            base = symbol.upper().replace("USDT", "")
            quote = "USDT"
        except Exception:
            base, quote = symbol, "USDT"

        executed_qty = float(ordem.get("executedQty") or ordem.get("origQty") or 0.0)
        quote_qty = float(ordem.get("cummulativeQuoteQty") or 0.0)
        avg_price = (quote_qty / executed_qty) if executed_qty > 0 and quote_qty > 0 else None

        fills = []
        raw_fills = ordem.get("fills") if isinstance(ordem.get("fills"), list) else []
        for f in raw_fills:
            if not isinstance(f, dict):
                continue
            try:
                f_qty = float(f.get("qty") or 0.0)
                f_price = float(f.get("price") or 0.0)
                comm = float(f.get("commission") or 0.0)
                comm_asset = str(f.get("commissionAsset") or "").upper() or None
            except Exception:
                continue
            fee_usdt = None
            if comm_asset == "USDT":
                fee_usdt = comm
            elif comm_asset == base and f_price > 0 and quote == "USDT":
                fee_usdt = comm * f_price
            elif comm_asset:
                # tenta converter via ticker público na própria Binance (já temos client autenticado)
                try:
                    px = float(client.get_symbol_ticker(symbol=f"{comm_asset}USDT")["price"])
                    if px > 0:
                        fee_usdt = comm * px
                except Exception:
                    fee_usdt = None

            fills.append(
                {
                    "qty": f_qty,
                    "price": f_price,
                    "commission": comm,
                    "commissionAsset": comm_asset,
                    "fee_usdt": float(fee_usdt) if fee_usdt is not None and fee_usdt > 0 else None,
                }
            )

        ordem = dict(ordem)
        ordem.setdefault("_hs", {})
        if isinstance(ordem["_hs"], dict):
            ordem["_hs"].update(
                {
                    "executed_qty": executed_qty if executed_qty > 0 else None,
                    "quote_qty": quote_qty if quote_qty > 0 else None,
                    "avg_price": avg_price,
                    "fills": fills,
                }
            )
        return ordem

    try:
        ordem = client.order_market_buy(symbol=par_moeda, quantity=quantidade)
        ordem_hs = _enrich_order_with_hs(ordem, symbol=par_moeda)

        # Preferir métricas reais de execução quando disponíveis
        executed_qty = float(ordem_hs.get("_hs", {}).get("executed_qty") or ordem.get("executedQty") or quantidade)
        quote_qty = float(ordem_hs.get("_hs", {}).get("quote_qty") or ordem.get("cummulativeQuoteQty") or valor_ordem)
        avg_price = float(ordem_hs.get("_hs", {}).get("avg_price") or (quote_qty / executed_qty if executed_qty else preco_atual))

        if storage is not None:
            storage.record_trade(
                make_trade(
                    symbol=par_moeda,
                    side="BUY",
                    qty=float(executed_qty),
                    price=float(avg_price),
                    quote_qty=float(quote_qty),
                    status=str(ordem.get("status", "FILLED")),
                    order_id=str(ordem.get("orderId")) if ordem.get("orderId") is not None else None,
                    raw=ordem_hs,
                )
            )
        logger.info(f"🟢 Ordem de compra executada: {ordem}")
        await enviar_mensagem_telegram(f"🟢 Compra executada: {executed_qty:.8f} {par_moeda} a {avg_price:.6f} USDT")

        asyncio.create_task(
            monitorar_pos_compra(
                client,
                par_moeda,
                float(executed_qty),
                float(avg_price),
                enviar_mensagem_telegram,
                storage=storage,
            )
        )

    except Exception as e:
        logger.error(f"❌ Erro ao executar compra de {par_moeda}: {e}")
        await enviar_mensagem_telegram(f"❌ Erro na compra de {par_moeda}: {e}")


# ----------------- MONITORAMENTO DE TAKE E STOP -----------------

async def monitorar_pos_compra(
    client,
    par_moeda,
    quantidade,
    preco_compra,
    enviar_mensagem_telegram,
    *,
    storage: Storage | None = None,
):
    stop_loss, take_profit = calcular_stop_take(preco_compra)

    logger.info(f"🔒 Monitorando {par_moeda}: SL={stop_loss:.2f}, TP={take_profit:.2f}")

    while True:
        try:
            preco_atual = float(client.get_symbol_ticker(symbol=par_moeda)['price'])

            if preco_atual >= take_profit:
                await executar_venda(
                    client,
                    par_moeda,
                    quantidade,
                    "Take Profit atingido",
                    enviar_mensagem_telegram,
                    storage=storage,
                )
                break

            if preco_atual <= stop_loss:
                await executar_venda(
                    client,
                    par_moeda,
                    quantidade,
                    "Stop Loss atingido",
                    enviar_mensagem_telegram,
                    storage=storage,
                )
                break

            await asyncio.sleep(5)

        except Exception as e:
            logger.error(f"❌ Erro ao monitorar preço de {par_moeda}: {e}")
            await asyncio.sleep(10)


# ----------------- EXECUÇÃO DE VENDA -----------------

async def executar_venda(
    client,
    par_moeda,
    quantidade,
    motivo,
    enviar_mensagem_telegram,
    *,
    storage: Storage | None = None,
):
    try:
        ordem = client.order_market_sell(symbol=par_moeda, quantity=quantidade)
        logger.info("Ordem de venda executada: %s", ordem)

        if storage is not None:
            # Usa métricas reais de execução quando disponíveis
            executed_qty = float(ordem.get("executedQty") or ordem.get("origQty") or quantidade)
            quote_qty = float(ordem.get("cummulativeQuoteQty") or 0.0) or (float(executed_qty) * float(client.get_symbol_ticker(symbol=par_moeda)["price"]))
            avg_price = (quote_qty / executed_qty) if executed_qty > 0 else float(client.get_symbol_ticker(symbol=par_moeda)["price"])

            # Reaproveita a mesma normalização de fills/fees do BUY
            try:
                base = par_moeda.upper().replace("USDT", "")
                quote = "USDT"
            except Exception:
                base, quote = par_moeda, "USDT"
            fills = []
            raw_fills = ordem.get("fills") if isinstance(ordem.get("fills"), list) else []
            for f in raw_fills:
                if not isinstance(f, dict):
                    continue
                try:
                    f_qty = float(f.get("qty") or 0.0)
                    f_price = float(f.get("price") or 0.0)
                    comm = float(f.get("commission") or 0.0)
                    comm_asset = str(f.get("commissionAsset") or "").upper() or None
                except Exception:
                    continue
                fee_usdt = None
                if comm_asset == "USDT":
                    fee_usdt = comm
                elif comm_asset == base and f_price > 0 and quote == "USDT":
                    fee_usdt = comm * f_price
                elif comm_asset:
                    try:
                        px = float(client.get_symbol_ticker(symbol=f"{comm_asset}USDT")["price"])
                        if px > 0:
                            fee_usdt = comm * px
                    except Exception:
                        fee_usdt = None
                fills.append(
                    {
                        "qty": f_qty,
                        "price": f_price,
                        "commission": comm,
                        "commissionAsset": comm_asset,
                        "fee_usdt": float(fee_usdt) if fee_usdt is not None and fee_usdt > 0 else None,
                    }
                )

            ordem_hs = dict(ordem)
            ordem_hs.setdefault("_hs", {})
            if isinstance(ordem_hs["_hs"], dict):
                ordem_hs["_hs"].update(
                    {
                        "executed_qty": executed_qty if executed_qty > 0 else None,
                        "quote_qty": quote_qty if quote_qty > 0 else None,
                        "avg_price": avg_price,
                        "fills": fills,
                    }
                )
            storage.record_trade(
                make_trade(
                    symbol=par_moeda,
                    side="SELL",
                    qty=float(executed_qty),
                    price=float(avg_price),
                    quote_qty=float(quote_qty),
                    status=str(ordem.get("status", "FILLED")),
                    order_id=str(ordem.get("orderId")) if ordem.get("orderId") is not None else None,
                    raw=ordem_hs,
                )
            )

        mensagem = f"🔴 Venda de {float(ordem.get('executedQty') or quantidade):.8f} {par_moeda} realizada ({motivo})."
        await enviar_mensagem_telegram(mensagem)

    except Exception as e:
        logger.error(f"❌ Erro ao executar venda de {par_moeda}: {e}")
        await enviar_mensagem_telegram(f"❌ Erro ao vender {par_moeda}: {e}")

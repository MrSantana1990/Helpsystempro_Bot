import Container from "./Container";
import { buildWhatsAppUrl } from "../lib/whatsapp";

export default function Hero({
  brandName,
  whatsappPhone,
  whatsappBaseMessage
}: {
  brandName: string;
  whatsappPhone: string;
  whatsappBaseMessage: string;
}) {
  const whatsappUrl = buildWhatsAppUrl({
    phone: whatsappPhone,
    baseMessage: whatsappBaseMessage,
    objective: "Implantação e proposta"
  });

  return (
    <section id="top" className="pt-12 sm:pt-16">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr,0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/10 bg-card/50 px-3 py-1 text-xs text-muted shadow-soft backdrop-blur">
              <span className="inline-flex h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              <span>Dry-run / Testnet primeiro. Live só com trava.</span>
            </div>

            <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-text sm:text-5xl">
              Operação de cripto com disciplina, risco controlado e auditoria.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base text-muted sm:text-lg">
              Portal + Bot com decisões explicáveis, discovery com aprovação e travas para rodar com governança. Use para
              padronizar operação, reduzir erro manual e validar em dry-run/testnet antes do real.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="#produto"
                className="focus-ring inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg shadow-soft hover:brightness-110"
              >
                Ver demonstração
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex items-center justify-center rounded-xl border border-border/10 bg-card/60 px-5 py-3 text-sm font-semibold text-text shadow-soft backdrop-blur hover:bg-card/80"
              >
                Solicitar implantação (WhatsApp)
              </a>
            </div>

            <p className="mt-4 text-xs text-muted">
              {brandName} • Ajuda operacional. <strong className="font-semibold text-text">Não é recomendação financeira</strong>{" "}
              e <strong className="font-semibold text-text">não há garantia de lucro</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-border/10 bg-card/50 p-5 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-text">Preview do portal</div>
              <div className="text-xs text-muted">painel estilo exchange</div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-border/10 bg-bg/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted">Saldo estimado (USDT / R$)</div>
                  <div className="rounded-full bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent">
                    auditoria ON
                  </div>
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-text">—</div>
                <div className="mt-1 text-xs text-muted">PnL, exposição, limites e travas por ciclo</div>
              </div>

              <div className="rounded-xl border border-border/10 bg-bg/40 p-4">
                <div className="text-xs text-muted">Decisão explicável</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-good/15 px-2 py-1 text-[11px] font-semibold text-good">HOLD</span>
                  <span className="rounded-full bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent">
                    confidence (interno)
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted">
                  Sinais + motivo • logs • trilha de decisão → trade → execução
                </div>
              </div>

              <div className="rounded-xl border border-border/10 bg-bg/40 p-4">
                <div className="text-xs text-muted">Discovery com governança</div>
                <div className="mt-2 text-sm font-semibold text-text">Moedas novas → pendente</div>
                <div className="mt-1 text-xs text-muted">Aprova por prazo (24h / 7d / sempre) antes de operar.</div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}


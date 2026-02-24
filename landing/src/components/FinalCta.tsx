import { FormEvent, useMemo, useState } from "react";
import Container from "./Container";
import { buildWhatsAppUrl } from "../lib/whatsapp";

export default function FinalCta({
  whatsappPhone,
  whatsappBaseMessage
}: {
  whatsappPhone: string;
  whatsappBaseMessage: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [objective, setObjective] = useState("");

  const quickWhatsApp = useMemo(() => {
    return buildWhatsAppUrl({
      phone: whatsappPhone,
      baseMessage: whatsappBaseMessage,
      objective: "Agendar call e proposta"
    });
  }, [whatsappBaseMessage, whatsappPhone]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const url = buildWhatsAppUrl({
      phone: whatsappPhone,
      baseMessage: whatsappBaseMessage,
      objective: objective.trim() || "__",
      name: name.trim() || undefined,
      contact: phone.trim() || undefined
    });
    window.open(url, "_blank", "noreferrer");
  }

  return (
    <section className="pt-14 sm:pt-20">
      <Container>
        <div className="rounded-2xl border border-border/10 bg-card/50 p-6 shadow-soft backdrop-blur lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr,1fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-accent">CTA</div>
              <h3 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-text sm:text-3xl">
                Quer implantar no seu ambiente e operar com governança?
              </h3>
              <p className="mt-3 text-sm text-muted sm:text-base">
                Comece por dry-run/testnet, defina limites conservadores e evolua com métricas (PnL, drawdown, win rate).
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={quickWhatsApp}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg shadow-soft hover:brightness-110"
                >
                  WhatsApp
                </a>
                <a
                  href={quickWhatsApp}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex items-center justify-center rounded-xl border border-border/10 bg-bg/20 px-5 py-3 text-sm font-semibold text-text shadow-soft hover:bg-bg/30"
                >
                  Agendar call
                </a>
              </div>

              <div className="mt-4 text-xs text-muted">
                Sem promessas de retorno. <strong className="font-semibold text-text">Não é recomendação financeira</strong>.
              </div>
            </div>

            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-semibold text-text">
                  Nome
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="focus-ring w-full rounded-xl border border-border/10 bg-bg/30 px-3 py-2 text-sm text-text placeholder:text-muted"
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="phone" className="text-sm font-semibold text-text">
                  WhatsApp
                </label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="focus-ring w-full rounded-xl border border-border/10 bg-bg/30 px-3 py-2 text-sm text-text placeholder:text-muted"
                  placeholder="(DDD) 9xxxx-xxxx"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="objective" className="text-sm font-semibold text-text">
                  Objetivo
                </label>
                <textarea
                  id="objective"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="focus-ring min-h-24 w-full resize-y rounded-xl border border-border/10 bg-bg/30 px-3 py-2 text-sm text-text placeholder:text-muted"
                  placeholder="Ex.: quero começar em dry-run/testnet e validar por 2 semanas"
                />
              </div>

              <button
                type="submit"
                className="focus-ring inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg shadow-soft hover:brightness-110"
              >
                Enviar no WhatsApp
              </button>

              <p className="text-xs text-muted">
                Ao enviar, você será redirecionado ao WhatsApp com uma mensagem pré-preenchida (sem backend).
              </p>
            </form>
          </div>
        </div>
      </Container>
    </section>
  );
}


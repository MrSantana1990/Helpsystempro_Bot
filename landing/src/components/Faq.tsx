import { useId, useMemo, useState } from "react";
import Container from "./Container";
import SectionHeader from "./SectionHeader";

type Item = { q: string; a: string };

export default function Faq() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items: Item[] = useMemo(
    () => [
      {
        q: "Dá lucro garantido?",
        a: "Não. Este sistema não garante lucro. Ele ajuda a operar com disciplina, gestão de risco e auditoria. Resultados variam conforme mercado, configuração e execução."
      },
      {
        q: "Posso usar sem chave?",
        a: "Sim, em dry-run (simulação). Para testnet/live você configura chaves com permissões mínimas. Recomendação: validar primeiro em dry-run/testnet."
      },
      {
        q: "Como funciona testnet?",
        a: "A testnet é um ambiente de testes. Você opera sem usar saldo real, ideal para validar regras, limites e comportamento do bot antes do modo live."
      },
      {
        q: "O que acontece com moedas novas?",
        a: "O discovery identifica oportunidades e abre uma pendência. Você aprova (por prazo ou permanentemente) antes do sistema operar aquele ativo."
      },
      {
        q: "Qual suporte?",
        a: "Depende do plano. Sugestão: janela comercial (ex.: dias úteis) e SLA por criticidade. O foco é manter o ambiente rodando e ajustar configurações de risco."
      },
      {
        q: "Posso cancelar?",
        a: "Sim, no modelo mensal. Você pode pausar a operação a qualquer momento e manter o portal para auditoria/consulta de logs."
      }
    ],
    []
  );

  return (
    <section>
      <SectionHeader
        id="faq"
        eyebrow="FAQ"
        title="Perguntas frequentes"
        subtitle="Respostas objetivas para orientar onboarding, risco e governança."
      />
      <Container>
        <div className="mt-8 space-y-3">
          {items.map((it, idx) => {
            const panelId = `${baseId}-panel-${idx}`;
            const buttonId = `${baseId}-btn-${idx}`;
            const isOpen = openIndex === idx;
            return (
              <div
                key={it.q}
                className="rounded-2xl border border-border/10 bg-card/50 shadow-soft backdrop-blur"
              >
                <button
                  id={buttonId}
                  type="button"
                  className="focus-ring flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left"
                  aria-controls={panelId}
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex((cur) => (cur === idx ? null : idx))}
                >
                  <span className="text-sm font-semibold text-text">{it.q}</span>
                  <span className="text-muted" aria-hidden="true">
                    {isOpen ? "–" : "+"}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={[
                    "grid overflow-hidden px-5 transition-[grid-template-rows] duration-200",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  ].join(" ")}
                >
                  <div className="min-h-0 pb-4 text-sm text-muted">{it.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}


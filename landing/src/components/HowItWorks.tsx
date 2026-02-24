import Container from "./Container";
import SectionHeader from "./SectionHeader";

const steps = [
  {
    title: "Configurar chaves (opcional p/ live/testnet)",
    desc: "Pode começar sem chaves em modo dry-run. Para operar em testnet/live, configure as chaves com permissões mínimas."
  },
  {
    title: "Definir estratégia e limites",
    desc: "Escolha perfil (Conservador/Padrão/Agressivo), tamanho de ordem, SL/TP e limites por ciclo."
  },
  {
    title: "Rodar em dry-run/testnet",
    desc: "Valide o comportamento: decisões, logs, circuit breaker e execução simulada antes do real."
  },
  {
    title: "Aprovar moedas novas",
    desc: "Discovery sugere ativos novos, mas só entra em operação após seu OK (por prazo ou permanente)."
  },
  {
    title: "Operar com auditoria e relatórios",
    desc: "Acompanhe decisões e trades no portal e exporte relatórios para revisão (roadmap: PDF)."
  }
];

export default function HowItWorks() {
  return (
    <section>
      <SectionHeader
        id="como-funciona"
        eyebrow="Como funciona"
        title="Fluxo simples: configurar, validar e operar com rastreabilidade."
        subtitle="O objetivo é reduzir fricção e manter governança: nada de “caixa-preta” e nada de live sem validação."
      />
      <Container>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, idx) => (
            <li
              key={s.title}
              className="rounded-2xl border border-border/10 bg-card/50 p-5 shadow-soft backdrop-blur"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent">
                  {idx + 1}
                </div>
                <div className="text-sm font-semibold text-text">{s.title}</div>
              </div>
              <div className="mt-3 text-sm text-muted">{s.desc}</div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}


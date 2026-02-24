import Container from "./Container";
import SectionHeader from "./SectionHeader";

const items = [
  {
    title: "Decisão explicável (sinais + motivo)",
    desc: "Cada ação vem com justificativa, score/sinais e rastreio para auditoria."
  },
  {
    title: "Travas de risco (SL/TP, limites por ciclo, circuit breaker)",
    desc: "Proteções para reduzir exposição: limites por ciclo, posições abertas e travas de segurança."
  },
  {
    title: "Discovery com governança (moedas novas só com aprovação)",
    desc: "O sistema encontra oportunidades, mas exige aprovação antes de operar novos ativos."
  },
  {
    title: "Painel estilo exchange (status, logs, carteira, pendências)",
    desc: "Tudo em uma tela: visão operacional, pendências, logs e trilha de execução."
  }
];

export default function ValueProof() {
  return (
    <section>
      <SectionHeader
        id="produto"
        eyebrow="Produto"
        title="Portal moderno + Bot + auditoria: governança aplicada à operação."
        subtitle="Uma interface clara para executar com disciplina. Validação em dry-run/testnet, explicabilidade e travas de risco por padrão."
      />
      <Container>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl border border-border/10 bg-card/50 p-5 shadow-soft backdrop-blur"
            >
              <div className="text-sm font-semibold text-text">{it.title}</div>
              <div className="mt-2 text-sm text-muted">{it.desc}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}


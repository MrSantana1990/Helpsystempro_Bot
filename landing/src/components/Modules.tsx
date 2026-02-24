import Container from "./Container";
import SectionHeader from "./SectionHeader";

const modules = [
  { title: "Engine de decisão (indicadores)", desc: "Sinais e score para BUY/SELL/HOLD com explicação." },
  { title: "Risk manager", desc: "Limites por ciclo, SL/TP, exposição máxima e circuit breaker." },
  { title: "Notícias (opcional)", desc: "Resumo e sentimento como sinal auxiliar (sem substituir risco)." },
  { title: "Alertas Telegram (opcional)", desc: "Notificações operacionais e pendências (quando configurado)." },
  { title: "Logs/auditoria", desc: "Trilha completa: decisão → ação → execução → logs." },
  { title: "Relatórios CSV/PDF (roadmap)", desc: "Exportação para análise e prestação de contas." }
];

function Icon({ idx }: { idx: number }) {
  const glyphs = ["▦", "◷", "📰", "✉", "≣", "⬇"];
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-bg/40 text-sm text-text"
      aria-hidden="true"
    >
      {glyphs[idx] ?? "•"}
    </span>
  );
}

export default function Modules() {
  return (
    <section>
      <SectionHeader
        id="modulos"
        eyebrow="Módulos"
        title="Componentes pensados para operação disciplinada."
        subtitle="Tudo com foco em risco, clareza e governança. Sem promessas de retorno — ferramenta operacional."
      />
      <Container>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {modules.map((m, idx) => (
            <div
              key={m.title}
              className="flex gap-4 rounded-2xl border border-border/10 bg-card/50 p-5 shadow-soft backdrop-blur"
            >
              <Icon idx={idx} />
              <div>
                <div className="text-sm font-semibold text-text">{m.title}</div>
                <div className="mt-1 text-sm text-muted">{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}


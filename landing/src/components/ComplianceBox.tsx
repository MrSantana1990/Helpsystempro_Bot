import Container from "./Container";

export default function ComplianceBox() {
  return (
    <Container>
      <div className="mt-16 rounded-2xl border border-border/10 bg-card/55 p-6 shadow-soft backdrop-blur">
        <div className="text-sm font-semibold text-text">Compliance / Disclaimers</div>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>
            <strong className="font-semibold text-text">Não é recomendação financeira.</strong> O conteúdo é informativo e
            operacional.
          </li>
          <li>
            <strong className="font-semibold text-text">Não há garantia de lucro.</strong> Resultados variam e o risco é do
            usuário.
          </li>
          <li>
            <strong className="font-semibold text-text">Use dry-run/testnet.</strong> Valide estratégia, limites e travas
            antes de operar no real.
          </li>
          <li>
            <strong className="font-semibold text-text">Proteja suas chaves.</strong> Use permissões mínimas e mantenha o
            ambiente seguro.
          </li>
        </ul>
      </div>
    </Container>
  );
}


import Container from "./Container";

export default function Footer({
  brandName,
  portfolioUrl,
  githubUrl
}: {
  brandName: string;
  portfolioUrl: string;
  githubUrl?: string;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border/10 py-10">
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-text">{brandName}</div>
            <div className="mt-1 text-xs text-muted">
              © {year} • Todos os direitos reservados • HelpSystem • Binance Bot
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a href="#compliance" className="focus-ring rounded-lg text-sm text-muted hover:text-text">
              Disclaimers
            </a>
            {githubUrl ? (
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring rounded-lg text-sm text-muted hover:text-text"
              >
                GitHub
              </a>
            ) : null}
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded-lg text-sm text-muted hover:text-text"
            >
              Portfólio
            </a>
          </div>
        </div>

        <div className="mt-6 text-xs text-muted">
          Este material é informativo. <strong className="font-semibold text-text">Não é recomendação financeira</strong> e{" "}
          <strong className="font-semibold text-text">não há garantia de lucro</strong>. Use dry-run/testnet e opere com limites.
        </div>
      </Container>
    </footer>
  );
}

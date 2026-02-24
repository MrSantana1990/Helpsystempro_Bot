import { useMemo, useState } from "react";
import Container from "./Container";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { buildWhatsAppUrl } from "../lib/whatsapp";

export default function Header({
  brandName,
  theme,
  onToggleTheme,
  whatsappPhone,
  whatsappBaseMessage
}: {
  brandName: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  whatsappPhone: string;
  whatsappBaseMessage: string;
}) {
  const [open, setOpen] = useState(false);

  const links = useMemo(
    () => [
      { href: "#produto", label: "Produto" },
      { href: "#como-funciona", label: "Como funciona" },
      { href: "#planos", label: "Planos" },
      { href: "#faq", label: "FAQ" }
    ],
    []
  );

  const whatsappUrl = buildWhatsAppUrl({
    phone: whatsappPhone,
    baseMessage: whatsappBaseMessage,
    objective: "Implantação e proposta"
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border/10 bg-bg/70 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between gap-3">
          <a href="#top" className="focus-ring inline-flex items-center gap-3 rounded-xl">
            <Logo className="shrink-0" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-text">{brandName}</div>
              <div className="text-xs text-muted">HelpSystem • Binance Bot</div>
            </div>
          </a>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="focus-ring rounded-lg text-sm text-muted hover:text-text"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="focus-ring hidden rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-soft hover:brightness-110 md:inline-flex"
            >
              Solicitar implantação
            </a>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />

            <button
              type="button"
              className="focus-ring inline-flex items-center justify-center rounded-xl border border-border/10 bg-card/60 px-3 py-2 text-sm text-text shadow-soft backdrop-blur hover:bg-card/80 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menu"
              aria-expanded={open}
            >
              <span aria-hidden="true">{open ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>

        {open ? (
          <div className="md:hidden">
            <div className="mb-4 rounded-2xl border border-border/10 bg-card/60 p-3 shadow-soft backdrop-blur">
              <nav aria-label="Menu mobile" className="flex flex-col gap-1">
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="focus-ring rounded-xl px-3 py-2 text-sm text-text hover:bg-bg/30"
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </a>
                ))}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring mt-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg shadow-soft hover:brightness-110"
                  onClick={() => setOpen(false)}
                >
                  Solicitar implantação
                </a>
              </nav>
            </div>
          </div>
        ) : null}
      </Container>
    </header>
  );
}


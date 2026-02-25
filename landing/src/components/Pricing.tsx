import Container from "./Container";
import SectionHeader from "./SectionHeader";
import { buildWhatsAppUrl } from "../lib/whatsapp";

type Props = {
  priceStarter: string;
  pricePro: string;
  pricePremium: string;
  whatsappPhone: string;
  whatsappBaseMessage: string;
};

function PlanCard({
  title,
  price,
  subtitle,
  features,
  highlight,
  ctaHref,
  ctaLabel,
  demoHref,
  demoLabel,
  footer
}: {
  title: string;
  price: string;
  subtitle: string;
  features: string[];
  highlight?: boolean;
  ctaHref: string;
  ctaLabel: string;
  demoHref: string;
  demoLabel: string;
  footer: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-card/50 p-6 shadow-soft backdrop-blur",
        highlight ? "border-accent/40 ring-1 ring-accent/20" : "border-border/10"
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-text">{title}</div>
          <div className="mt-1 text-xs text-muted">{subtitle}</div>
        </div>
        {highlight ? (
          <div className="rounded-full bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent">
            recomendado
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="text-3xl font-semibold tracking-tight text-text">{price}</div>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-muted">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-[2px] text-accent" aria-hidden="true">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <a
          href={ctaHref}
          target="_blank"
          rel="noreferrer"
          className={[
            "focus-ring inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold shadow-soft",
            highlight
              ? "bg-accent text-bg hover:brightness-110"
              : "border border-border/10 bg-bg/20 text-text hover:bg-bg/30"
          ].join(" ")}
        >
          {ctaLabel}
        </a>
        <a
          href={demoHref}
          className="focus-ring inline-flex w-full items-center justify-center rounded-xl border border-border/10 bg-card/40 px-4 py-3 text-sm font-semibold text-text shadow-soft backdrop-blur hover:bg-card/60"
        >
          {demoLabel}
        </a>
      </div>

      <div className="mt-4 text-xs text-muted">{footer}</div>
    </div>
  );
}

export default function Pricing({
  priceStarter,
  pricePro,
  pricePremium,
  whatsappPhone,
  whatsappBaseMessage
}: Props) {
  const demoHref = "#produto";
  const waStarter = buildWhatsAppUrl({
    phone: whatsappPhone,
    baseMessage: whatsappBaseMessage,
    objective: "Starter: dry-run/testnet + setup"
  });
  const waPro = buildWhatsAppUrl({
    phone: whatsappPhone,
    baseMessage: whatsappBaseMessage,
    objective: "Pro: alertas + relatórios + suporte"
  });
  const waPremium = buildWhatsAppUrl({
    phone: whatsappPhone,
    baseMessage: whatsappBaseMessage,
    objective: "Premium: tuning + acompanhamento"
  });

  return (
    <section>
      <SectionHeader
        id="planos"
        eyebrow="Planos e preços"
        title="Planos com governança, risco e auditoria — sem hype."
        subtitle="Sem promessas de performance. O foco é disciplina operacional: travas de risco, auditoria exportável e validação em dry-run/testnet."
      />
      <Container>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <PlanCard
            title="Starter"
            price={priceStarter}
            subtitle="R$ 297/mês + Setup R$ 497"
            features={[
              "Portal estilo exchange (status, logs, pendências)",
              "Auditoria exportável (CSV)",
              "Risco: kill switch + limites obrigatórios",
              "Discovery com pendências (aprovação)",
              "Dry-run/testnet (recomendado no piloto)",
              "Onboarding e configuração inicial"
            ]}
            ctaHref={waStarter}
            ctaLabel="Contratar"
            demoHref={demoHref}
            demoLabel="Ver demo"
            footer="Observação legal: preços podem variar conforme escopo / implantação / suporte."
          />
          <PlanCard
            title="Pro"
            price={pricePro}
            subtitle="Starter + alertas + relatórios + suporte"
            features={[
              "Tudo do Starter",
              "Alertas (Telegram opcional)",
              "Relatórios (CSV) e rotinas de backup",
              "Suporte e ajustes recorrentes"
            ]}
            highlight
            ctaHref={waPro}
            ctaLabel="Contratar"
            demoHref={demoHref}
            demoLabel="Ver demo"
            footer="Observação legal: preços podem variar conforme escopo / implantação / suporte."
          />
          <PlanCard
            title="Premium"
            price={pricePremium}
            subtitle="Pro + tuning e acompanhamento"
            features={[
              "Tudo do Pro",
              "Tuning de perfis e limites (governança)",
              "Acompanhamento de métricas",
              "Revisão de risco e governança"
            ]}
            ctaHref={waPremium}
            ctaLabel="Contratar"
            demoHref={demoHref}
            demoLabel="Ver demo"
            footer="Observação legal: preços podem variar conforme escopo / implantação / suporte."
          />
        </div>

        <div className="mt-6 rounded-2xl border border-border/10 bg-card/40 p-5 text-sm text-muted shadow-soft backdrop-blur">
          <strong className="font-semibold text-text">Aviso:</strong> não é recomendação financeira e{" "}
          <strong className="font-semibold text-text">não há garantia de lucro</strong>. Comece em{" "}
          <strong className="font-semibold text-text">dry-run/testnet</strong> e só migre para live após validação e entendimento do risco.
        </div>
      </Container>
    </section>
  );
}

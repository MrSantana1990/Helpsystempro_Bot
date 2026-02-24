import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ValueProof from "./components/ValueProof";
import HowItWorks from "./components/HowItWorks";
import Modules from "./components/Modules";
import Pricing from "./components/Pricing";
import Faq from "./components/Faq";
import ComplianceBox from "./components/ComplianceBox";
import FinalCta from "./components/FinalCta";
import Footer from "./components/Footer";
import WhatsAppFab from "./components/WhatsAppFab";

const CONFIG = {
  whatsappPhone: "5599999999999",
  brandName: "HelpSystem Pro",
  portfolioUrl: "https://seu-portfolio.com",
  priceStarter: "R$ 297/mês",
  pricePro: "R$ 497/mês",
  pricePremium: "R$ 997/mês"
} as const;

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("hs_theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    try {
      localStorage.setItem("hs_theme", theme);
    } catch {}
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  const whatsappBaseMessage = useMemo(() => {
    return "Quero implantar o HelpSystem • Binance Bot. Meu objetivo é: __. Vou começar por dry-run/testnet. Me envie proposta.";
  }, []);

  return (
    <div className="min-h-dvh">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(240,185,11,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(99,102,241,0.10),transparent_60%),radial-gradient(800px_circle_at_60%_85%,rgba(34,197,94,0.07),transparent_60%)]" />
        <div className="absolute inset-0 bg-bg/80 backdrop-blur-[1px]" />
      </div>

      <Header
        brandName={CONFIG.brandName}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        whatsappPhone={CONFIG.whatsappPhone}
        whatsappBaseMessage={whatsappBaseMessage}
      />

      <main>
        <Hero
          brandName={CONFIG.brandName}
          whatsappPhone={CONFIG.whatsappPhone}
          whatsappBaseMessage={whatsappBaseMessage}
        />
        <ValueProof />
        <HowItWorks />
        <Modules />
        <Pricing
          priceStarter={CONFIG.priceStarter}
          pricePro={CONFIG.pricePro}
          pricePremium={CONFIG.pricePremium}
          whatsappPhone={CONFIG.whatsappPhone}
          whatsappBaseMessage={whatsappBaseMessage}
        />
        <Faq />
        <section id="compliance" className="scroll-mt-24">
          <ComplianceBox />
        </section>
        <FinalCta whatsappPhone={CONFIG.whatsappPhone} whatsappBaseMessage={whatsappBaseMessage} />
      </main>

      <Footer brandName={CONFIG.brandName} portfolioUrl={CONFIG.portfolioUrl} />
      <WhatsAppFab whatsappPhone={CONFIG.whatsappPhone} whatsappBaseMessage={whatsappBaseMessage} />
    </div>
  );
}


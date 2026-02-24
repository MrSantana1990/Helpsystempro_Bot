import { buildWhatsAppUrl } from "../lib/whatsapp";

export default function WhatsAppFab({
  whatsappPhone,
  whatsappBaseMessage
}: {
  whatsappPhone: string;
  whatsappBaseMessage: string;
}) {
  const url = buildWhatsAppUrl({
    phone: whatsappPhone,
    baseMessage: whatsappBaseMessage,
    objective: "Implantação e proposta"
  });

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="focus-ring fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-bg shadow-soft hover:brightness-110"
      aria-label="Abrir WhatsApp para solicitar implantação"
      title="WhatsApp"
    >
      <span aria-hidden="true">WhatsApp</span>
    </a>
  );
}


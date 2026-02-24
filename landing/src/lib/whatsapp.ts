type Params = {
  phone: string;
  baseMessage: string;
  objective: string;
  name?: string;
  contact?: string;
};

function sanitizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export function buildWhatsAppMessage({
  baseMessage,
  objective,
  name,
  contact
}: Omit<Params, "phone">) {
  const firstLine = baseMessage.replace("Meu objetivo é: __", `Meu objetivo é: ${objective}`);
  const extra: string[] = [];
  if (name) extra.push(`Nome: ${name}`);
  if (contact) extra.push(`WhatsApp: ${contact}`);
  return [firstLine, ...extra].join("\n");
}

export function buildWhatsAppUrl(params: Params) {
  const phone = sanitizePhone(params.phone);
  const text = buildWhatsAppMessage(params);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}


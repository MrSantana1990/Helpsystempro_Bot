export const CONFIG = {
  apiBase: (import.meta as any).env?.VITE_API_BASE || ""
};

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string;

  constructor(message: string, status: number, code?: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function fallbackMessageForStatus(status: number): string {
  if (status === 0) return "Nao foi possivel conectar na API cloud. Verifique se o servidor esta online.";
  if (status === 400 || status === 422) return "Dados invalidos. Revise os campos e tente novamente.";
  if (status === 401) return "Sessao expirada. Faca login novamente.";
  if (status === 403) return "Voce nao tem permissao para essa acao.";
  if (status === 404) return "Recurso nao encontrado.";
  if (status === 409) return "Conflito de operacao. Atualize a tela e tente novamente.";
  if (status === 428) return "Pre-condicao obrigatoria nao atendida.";
  if (status >= 500) return "Servidor indisponivel no momento. Tente novamente em instantes.";
  return "Nao foi possivel concluir a operacao.";
}

const FRIENDLY_CODE_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "Sem conexao com o servidor. Verifique rede, API e portas liberadas.",
  INVALID_TOKEN: "Sessao invalida. Entre novamente para continuar.",
  UNAUTHORIZED: "Voce precisa entrar no sistema para continuar.",
  FORBIDDEN: "Voce nao tem permissao para esta acao.",
  FORBIDDEN_MASTER: "Somente a conta master pode executar esta acao.",
  MASTER_ONLY_ADMIN: "Apenas o email master pode ter perfil administrador.",
  BOOTSTRAP_CODE_INVALID: "Codigo de bootstrap invalido. Confirme o valor no arquivo de ambiente.",
  BOOTSTRAP_ALREADY_DONE: "Bootstrap ja foi concluido. Use o login normal.",
  BOOTSTRAP_INPUT_INVALID: "Preencha email valido e senha com no minimo 8 caracteres.",
  MASTER_EMAIL_MISMATCH: "O email informado nao corresponde ao master configurado no servidor.",
  LOGIN_INVALID: "Email ou senha invalidos.",
  LOGIN_ERROR: "Nao foi possivel concluir o login agora. Tente novamente.",
  TOTP_REQUIRED: "2FA obrigatorio. Conclua o onboarding de seguranca.",
  TOTP_SETUP_REQUIRED: "2FA ainda nao foi configurado. Gere o QR e ative o autenticador.",
  TOTP_CODE_INVALID: "Codigo do autenticador invalido. Confira o app e tente novamente.",
  TOTP_ALREADY_ENABLED: "2FA ja esta ativo para este usuario.",
  ME_ERROR: "Nao foi possivel carregar os dados da conta.",
  USERS_LIST_ERROR: "Nao foi possivel carregar os usuarios.",
  USER_CREATE_INVALID: "Dados invalidos para criar usuario.",
  USER_EMAIL_EXISTS: "Ja existe um usuario com este email.",
  USER_CREATE_ERROR: "Nao foi possivel criar o usuario agora.",
  TENANTS_LIST_ERROR: "Nao foi possivel carregar os clientes.",
  TENANT_CREATE_INVALID: "Nome do cliente invalido.",
  TENANT_CREATE_ERROR: "Nao foi possivel criar o cliente agora.",
  LICENSE_INVALID: "Selecione um cliente e confira os campos da licenca.",
  LICENSE_TENANT_NOT_FOUND: "Cliente nao encontrado para vincular licenca.",
  LICENSE_CREATE_ERROR: "Nao foi possivel salvar a licenca agora.",
  BILLING_ERROR: "Nao foi possivel carregar os eventos de cobranca.",
  BILLING_INVOICES_ERROR: "Nao foi possivel carregar as faturas.",
  BILLING_INVOICE_TENANT_REQUIRED: "Selecione um cliente para gerar a cobranca.",
  BILLING_PROVIDER_NOT_SUPPORTED: "Provedor de pagamento nao suportado no servidor.",
  BILLING_INVOICE_CREATE_ERROR: "Nao foi possivel gerar a cobranca PIX.",
  BILLING_INVOICE_INVALID: "Fatura invalida.",
  BILLING_INVOICE_CANCEL_INVALID: "A fatura ja foi processada ou nao existe.",
  BILLING_INVOICE_CANCEL_ERROR: "Nao foi possivel cancelar a fatura.",
  BILLING_WEBHOOK_ERROR: "Webhook de pagamento invalido.",
  BILLING_STATUS_ERROR: "Nao foi possivel carregar o status de cobranca.",
  BILLING_TENANT_NOT_FOUND: "Cliente nao encontrado para o evento de cobranca.",
  BILLING_CREATE_ERROR: "Nao foi possivel salvar o evento de cobranca.",
  GRANT_INVALID: "Selecione usuario e cliente para criar o vinculo.",
  GRANT_USER_NOT_FOUND: "Usuario nao encontrado para vinculo.",
  GRANT_TENANT_NOT_FOUND: "Cliente nao encontrado para vinculo.",
  GRANT_TARGET_NOT_FOUND: "Usuario ou cliente nao encontrado para vinculo.",
  LINKS_LIST_ERROR: "Nao foi possivel carregar os vinculos de usuarios e clientes.",
  GRANT_ERROR: "Nao foi possivel salvar o vinculo entre usuario e cliente.",
  SUBSCRIBERS_ERROR: "Nao foi possivel carregar os assinantes.",
  LICENSES_ERROR: "Nao foi possivel carregar as licencas.",
  AUDIT_ERROR: "Nao foi possivel carregar os logs de auditoria.",
  SECURITY_ERROR: "Nao foi possivel carregar os dados de seguranca.",
  ADMIN_SETTINGS_ERROR: "Nao foi possivel carregar as configuracoes do painel admin.",
  MOBILE_CONNECT_READ_ERROR: "Nao foi possivel carregar a configuracao de conexao mobile.",
  MOBILE_CONNECT_LAN_HOST_REQUIRED: "No modo LAN, informe o IP/host da API.",
  MOBILE_CONNECT_CUSTOM_URL_REQUIRED: "No modo URL personalizada, informe a URL base da API.",
  MOBILE_CONNECT_SAVE_ERROR: "Nao foi possivel salvar a conexao mobile.",
  DASHBOARD_ERROR: "Nao foi possivel carregar o painel agora. Tente novamente.",
  INTERNAL_ERROR: "Falha interna no servidor. Tente novamente em instantes.",
  REGISTRATION_REQUESTS_ERROR: "Nao foi possivel carregar as solicitacoes de cadastro.",
  REGISTRATION_REQUEST_INVALID: "Solicitacao invalida.",
  REGISTRATION_REQUEST_NOT_FOUND: "Solicitacao de cadastro nao encontrada.",
  REGISTRATION_REQUEST_ALREADY_PROCESSED: "Solicitacao ja processada.",
  REGISTRATION_REQUEST_PAYMENT_PENDING: "Pagamento ainda nao confirmado para aprovacao.",
  REGISTRATION_REQUEST_PAYMENT_ERROR: "Nao foi possivel atualizar o pagamento da solicitacao.",
  REGISTRATION_REQUEST_DATA_INVALID: "Solicitacao invalida: dados obrigatorios ausentes.",
  REGISTRATION_REQUEST_USER_EXISTS: "Ja existe usuario ativo com este e-mail.",
  REGISTRATION_REQUEST_CONFLICT: "Conflito ao aprovar a solicitacao. Atualize e tente novamente.",
  REGISTRATION_REQUEST_APPROVE_ERROR: "Nao foi possivel aprovar a solicitacao.",
  REGISTRATION_REQUEST_REJECT_INVALID: "Solicitacao invalida para rejeicao.",
  REGISTRATION_REQUEST_REJECT_ERROR: "Nao foi possivel rejeitar a solicitacao.",
  REGISTER_REQUEST_ALREADY_PENDING: "Ja existe solicitacao pendente para este e-mail.",
  REGISTER_EMAIL_ALREADY_ACTIVE: "Este e-mail ja possui acesso ativo."
};

function messageForCode(code?: string): string {
  if (!code) return "";
  return FRIENDLY_CODE_MESSAGES[String(code).trim().toUpperCase()] || "";
}

function normalizeApiError(json: any, status: number, statusText?: string): { message: string; code?: string; detail?: string } {
  const code = typeof json?.code === "string" ? json.code : typeof json?.error?.code === "string" ? json.error.code : undefined;
  const friendlyByCode = messageForCode(code);
  const envelopeMessage = typeof json?.error?.message === "string" ? json.error.message : "";
  const plainError = typeof json?.error === "string" ? json.error : "";
  const detail = typeof json?.detail === "string" ? json.detail : "";
  const statusMsg = typeof statusText === "string" ? statusText.trim() : "";
  const message = friendlyByCode || envelopeMessage || plainError || detail || statusMsg || fallbackMessageForStatus(status);
  return { message, code, detail };
}

async function parseJsonSafe(res: Response): Promise<any> {
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) return {};
  return res.json().catch(() => ({}));
}

type ApiOpts = {
  token?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function apiJson<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const url = CONFIG.apiBase ? `${String(CONFIG.apiBase).replace(/\/+$/, "")}${path}` : path;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.method && opts.method !== "GET" ? JSON.stringify(opts.body ?? {}) : undefined
    });
  } catch {
    throw new ApiError(fallbackMessageForStatus(0), 0, "NETWORK_ERROR");
  }

  const json = await parseJsonSafe(response);
  if (!response.ok) {
    const normalized = normalizeApiError(json, response.status, response.statusText);
    throw new ApiError(normalized.message, response.status, normalized.code, normalized.detail);
  }
  return json as T;
}

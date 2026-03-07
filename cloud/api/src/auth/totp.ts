import { authenticator } from "otplib";

export function generateTotpSecret(): { secret: string } {
  const secret = authenticator.generateSecret();
  return { secret };
}

export function totpVerify(secret: string, code: string): boolean {
  const c = String(code || "").replace(/\s+/g, "");
  return authenticator.check(c, secret);
}

export function totpOtpAuthUrl(opts: { label: string; issuer: string; secret: string }): string {
  return authenticator.keyuri(opts.label, opts.issuer, opts.secret);
}


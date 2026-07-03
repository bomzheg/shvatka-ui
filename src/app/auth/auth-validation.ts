// Mirrors server-side validation from the email-auth API contract.
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const CODE_PATTERN = /^\d{6}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

// The server trims and lowercases emails; do the same before sending.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function isValidConfirmationCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function errorDetail(error: unknown): string {
  const detail = (error as any)?.error?.detail;
  return typeof detail === "string" ? detail : "";
}

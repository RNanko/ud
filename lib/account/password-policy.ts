// Shared by browser forms, server actions and Better Auth.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_LENGTH_HINT = `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`;
export function passwordValidationError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Use a password with ${PASSWORD_LENGTH_HINT}.`;
  }
  if (new Set(Array.from(password)).size < 2) return "Use at least two different characters in your password.";
  return null;
}

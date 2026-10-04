import { PublicError } from "./errors";
import "server-only";
import { passwordValidationError } from "./password-policy";
export async function validateNewPassword(password: unknown) {
  const error = passwordValidationError(password);
  if (error) throw new PublicError(error);
}

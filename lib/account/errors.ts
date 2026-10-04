// Only deliberate, reviewed application messages may cross the action boundary.
// Never wrap database/provider errors in this type or pass their message to it.
import { ZodError } from "zod";
import { customerMessage } from "./customer-messages";
export class PublicError extends Error {
  constructor(message: string, readonly code?: "LEGAL_VERSIONS_CHANGED" | "REGISTRATION_UNAVAILABLE") { super(message); }
}
export function publicErrorMessage(error: unknown) {
  if (error instanceof PublicError) return customerMessage(error.message);
  if (error instanceof ZodError) {
    const path = error.issues[0]?.path;
    if (path?.includes("email")) return "Please enter a valid email address.";
    if (path?.includes("legal")) return "Please accept the Terms & Conditions to continue.";
    if (path?.includes("name")) return "Enter a display name of 1–80 characters.";
    return "Check the form fields and retry.";
  }
  return "Request failed. Please retry.";
}

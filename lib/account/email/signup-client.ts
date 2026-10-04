import type {
  beginEmailProof,
  resendEmailProof,
  confirmEmailCode,
  completeSignup,
} from "@/lib/actions/identity.actions";
import type { LegalAgreement } from "@/lib/legal/types";

// A cookie-setting Server Action also refreshes the current route. Signup is
// an in-memory, multi-step form: use JSON requests so that refresh cannot reset
// its code step or discard the password before account creation.
async function signupRequest<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/public/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw Error("Registration request could not be completed.");
  }
  return response.json();
}

export function beginSignupProof(input: { email: string; legal?: LegalAgreement }) {
  return signupRequest<Awaited<ReturnType<typeof beginEmailProof>>>({ operation: "request", ...input });
}
export function resendSignupProof() {
  return signupRequest<Awaited<ReturnType<typeof resendEmailProof>>>({ operation: "resend" });
}
export function confirmSignupCode(code: string) {
  return signupRequest<Awaited<ReturnType<typeof confirmEmailCode>>>({ operation: "confirm", code });
}
export function completeVerifiedSignup(input: { password: string; dateOfBirth: string; legal: LegalAgreement }) {
  return signupRequest<Awaited<ReturnType<typeof completeSignup>>>({ operation: "complete", ...input });
}

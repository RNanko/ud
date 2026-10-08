type SignInError = { status?: number; code?: string };

export function signInErrorMessage(error: SignInError | null | undefined) {
  if (error?.status === 429) return "Too many sign-in attempts. Please wait and try again.";
  if (error?.status && error.status >= 500) return "Sign-in is temporarily unavailable. Please try again shortly.";
  if (error?.code === "EMAIL_NOT_VERIFIED") return "Verify your email before signing in.";
  if (error?.code === "INVALID_EMAIL_OR_PASSWORD" || error?.status === 401 && error.code !== "FAILED_TO_CREATE_SESSION") {
    return "Email or password is incorrect. Try again or use Forgot password.";
  }
  return "Sign-in could not be completed. Please refresh this page and try again.";
}

import { launchPolicy } from "../config";

export const signupEmailLimitMessage = "Email-code limit reached. Use a different email address.";
export function signupEmailSendLimited(state: { sends?: unknown; blocked_until?: string | null; first_at?: string | null } | null, now = Date.now()) {
  if (!state) return false;
  if (state.blocked_until && Date.parse(state.blocked_until) > now) return true;
  return Number(state.sends) >= launchPolicy().signupSends &&
    (!state.first_at || Date.parse(state.first_at) > now - 24 * 60 * 60 * 1000);
}

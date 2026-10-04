export const customerMessages = {
  registrationUnavailable: "Registration is not available right now. Please try again later.",
  membershipUnavailable: "Membership purchase is currently unavailable.",
  emailUnavailable: "Email verification is currently unavailable. Please try again later or contact support.",
  legalChanged: "The documents changed. Please review them and agree again.",
} as const;
// Applied only to deliberate application errors, never to raw provider/DB errors.
export function customerMessage(message: string) {
  if (/LEGAL_VERSIONS_CHANGED/.test(message)) return customerMessages.legalChanged;
  if (/Registration is unavailable until|Registration is awaiting publication/i.test(message)) return customerMessages.registrationUnavailable;
  if (/checkout.*(?:configured|configuration)|billing.*(?:configured|configuration|reviewed)|annual.*(?:not configured|configuration)|Purchases.*(?:reviewed|withdrawal|consumer-rights)|billing portal configuration/i.test(message)) return customerMessages.membershipUnavailable;
  if (/authentication.*(?:not configured|configuration)|email requests.*configured|EMAIL_PROTECTION_SECRET/i.test(message)) return customerMessages.emailUnavailable;
  return message;
}

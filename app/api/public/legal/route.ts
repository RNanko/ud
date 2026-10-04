import { publishedBundle } from "@/lib/legal/store";
import { registrationConfigurationIssues } from "@/lib/account/registration";
export async function GET() {
  const bundle = await publishedBundle();
  const registrationAvailable = !!bundle && registrationConfigurationIssues().length === 0;
  return Response.json({ bundle, registrationAvailable }, { headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } });
}

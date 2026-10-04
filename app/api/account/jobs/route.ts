import { authorizedJob } from "@/lib/account/jobs";
import { processMailQueue } from "@/lib/account/email/delivery";
import { processStripeQueue } from "@/lib/account/billing/reconcile";
import { processNativeQueue } from "@/lib/account/billing/native";
import { processDeletionQueue } from "@/lib/account/privacy";
import { queueOptionalNotifications } from "@/lib/account/notifications";
import { cleanupPendingLegal } from "@/lib/legal/store";
export async function POST(request: Request) {
  if (!authorizedJob(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const steps = [processDeletionQueue, processStripeQueue, queueOptionalNotifications, processMailQueue, cleanupPendingLegal, processNativeQueue];
  const results: { step: number; state: string }[] = [];
  for (let index = 0; index < steps.length; index++) {
    try { await steps[index](); results.push({ step: index, state: "processed" }); }
    catch { results.push({ step: index, state: "retry-required" }); }
  }
  return Response.json({ results }, { status: results.some(result => result.state === "retry-required") ? 503 : 200 });
}

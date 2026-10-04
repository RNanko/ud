import z from "zod";
import { appOrigin } from "@/lib/account/config";
import { actionResult } from "@/lib/account/result";
import { PublicError } from "@/lib/account/errors";
import {
  beginEmailProof,
  resendEmailProof,
  confirmEmailCode,
  completeSignup,
} from "@/lib/actions/identity.actions";

const commandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("request"), email: z.string(), legal: z.unknown().optional() }).strict(),
  z.object({ operation: z.literal("resend") }).strict(),
  z.object({ operation: z.literal("confirm"), code: z.string().regex(/^\d{6}$/) }).strict(),
  z.object({ operation: z.literal("complete"), password: z.string(), dateOfBirth: z.string(), legal: z.unknown() }).strict(),
]);

export async function POST(request: Request) {
  const result = await actionResult(async () => {
    // Route Handlers do not get Server Actions' automatic origin validation.
    // Require a same-origin browser JSON POST before touching proof or identity.
    if (request.headers.get("origin") !== appOrigin() || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new PublicError("Request origin is not allowed");
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new PublicError("Send a JSON registration request");
    }
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new PublicError("Registration request is invalid"); }
    const command = commandSchema.parse(body);
    switch (command.operation) {
      case "request":
        return beginEmailProof({ email: command.email, legal: command.legal, purpose: "signup" });
      case "resend": return resendEmailProof();
      case "confirm": return confirmEmailCode(command.code);
      case "complete":
        return completeSignup({ password: command.password, dateOfBirth: command.dateOfBirth, legal: command.legal });
    }
  });
  return Response.json(result.ok ? result.value : result, {
    headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" },
  });
}

import { handleMobileRequest } from "@/lib/mobile/service";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  return handleMobileRequest(request, (await context.params).resource);
}
export async function PUT(request: Request, context: Context) {
  return handleMobileRequest(request, (await context.params).resource);
}

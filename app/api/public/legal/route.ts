import { publishedBundle } from "@/lib/legal/store";
export async function GET() {
  return Response.json({ bundle: await publishedBundle() }, { headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } });
}

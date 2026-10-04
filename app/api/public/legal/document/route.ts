import z from "zod";
import { publicDocument } from "@/lib/legal/store";
import { contentHash } from "@/lib/legal/validation";
export async function GET(request: Request) {
 const params=z.object({kind:z.enum(['terms','privacy']),version:z.string().regex(/^[a-zA-Z0-9.-]{1,60}$/)}).strict().safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!params.success)return Response.json({error:'Choose a valid document version'},{status:400});
 const result=await publicDocument(params.data.kind,params.data.version);
 if(!result || result.draft)return Response.json({error:'Document not available'},{status:404,headers:{'Cache-Control':'no-store'}});
 return Response.json({document:result.document,sha256:contentHash(result.document),draft:result.draft},{headers:{'Content-Disposition':`attachment; filename="manforth-${params.data.kind}-${params.data.version}.json"`,'Cache-Control':'no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

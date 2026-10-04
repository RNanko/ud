import { acceptNativeEvent, nativeBillingConfigured, nativeWebhookAuthorized } from "@/lib/account/billing/native";
export async function POST(request:Request){
  if(!nativeBillingConfigured())return Response.json({error:'Store billing is unavailable'},{status:503});
  if(!nativeWebhookAuthorized(request.headers))return Response.json({error:'Unauthorized'},{status:401});
  if(Number(request.headers.get('content-length'))>128_000)return new Response(null,{status:413});
  const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128_000){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body:unknown;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return new Response(null,{status:400});}
  try{await acceptNativeEvent(body);return Response.json({received:true});}catch{return Response.json({error:'Delivery could not be recorded'},{status:503});}
}

import { stripeClient } from "@/lib/account/billing/stripe";
import { acceptStripeEvent,processStripeQueue } from "@/lib/account/billing/reconcile";
import { after } from "next/server";
export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET,signature=request.headers.get("stripe-signature");if(!secret)return Response.json({error:"Webhook is not configured"},{status:503});if(!signature)return Response.json({error:"Missing signature"},{status:400});
 const raw=await request.text();let event;
 try{event=stripeClient().webhooks.constructEvent(raw,signature,secret);}catch{return Response.json({error:"Invalid signature"},{status:400});}
 try{await acceptStripeEvent(event);}catch{return Response.json({error:"Durable webhook acceptance failed"},{status:503});}
 // Acknowledge durable acceptance before provider calls can delay Stripe's response.
 // Failed or interrupted reconciliation remains queued for the protected worker.
 after(async()=>{try{await processStripeQueue(3);}catch{}});
 return Response.json({received:true});
}

import { PublicError } from "./errors";
import "server-only";
import { deletePendingLegal } from "../legal/store";
import { accountSql } from "./store";
import { PERSONAL_PRODUCT } from "./config";
import { stripeClient } from "./billing/stripe";
import { auth } from "../auth";
import { protectedKey } from "./email/crypto";
export async function processDeletion(owner:string){
 const rows=await accountSql`SELECT * FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND status IN ('pending','retry')`;
 if(!rows[0])return;const record=rows[0];
 try{
  const shared = await accountSql`SELECT 1 FROM b1_memberships WHERE user_id=${owner} AND product<>${PERSONAL_PRODUCT} UNION ALL SELECT 1 FROM b1_account_settings WHERE user_id=${owner} AND product<>${PERSONAL_PRODUCT}`;
  if(shared[0])throw new PublicError('Shared identity requires a product-scoped deletion review');
  if(record.customer_id){const stripe=stripeClient(),customer=await stripe.customers.retrieve(record.customer_id);
   if(!customer.deleted){if(customer.metadata.user_id!==owner||customer.metadata.product!==PERSONAL_PRODUCT)throw new PublicError("Billing ownership needs review");
    const subscriptions=await stripe.subscriptions.list({customer:record.customer_id,status:"all",limit:100});
    if(subscriptions.has_more)throw new PublicError("Billing history needs operator review before deletion");
    for(const subscription of subscriptions.data){if(subscription.metadata.user_id!==owner||subscription.metadata.product!==PERSONAL_PRODUCT)throw new PublicError("Shared billing ownership needs review");if(!["canceled","incomplete_expired"].includes(subscription.status))await stripe.subscriptions.cancel(subscription.id,{invoice_now:false,prorate:false},{idempotencyKey:`b1/delete/${owner}/${subscription.id}`});}
    const pending=await stripe.checkout.sessions.list({customer:record.customer_id,status:"open",limit:100});if(pending.has_more)throw new PublicError("Pending billing needs review");
    for(const checkout of pending.data){if(checkout.metadata?.product===PERSONAL_PRODUCT)await stripe.checkout.sessions.expire(checkout.id);}
   }
  }
  const users=await accountSql`SELECT email FROM "user" WHERE id=${owner}`;
  if(users[0]){
   if(process.env.EMAIL_PROTECTION_SECRET)await accountSql`UPDATE b1_email_outbox SET payload='',status='deleted' WHERE recipient_key=${protectedKey(users[0].email.toLowerCase())}`;
   // A removed legacy quote like must not leave an orphan, but unrelated shared quotes stay.
   await accountSql`WITH removed AS (DELETE FROM quote_likes WHERE user_id=${owner} RETURNING quote_id) UPDATE quotes SET likes_count=GREATEST(0,likes_count-1) WHERE id IN(SELECT quote_id FROM removed)`;
   await deletePendingLegal(owner);
   const context=await auth.$context;await context.internalAdapter.deleteUser(owner);
  }
  await accountSql`UPDATE b1_deletions SET status='completed',completed_at=now(),error=NULL WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;
 }catch{await accountSql`UPDATE b1_deletions SET status='retry',error='Deletion awaits billing or database confirmation; account remains read-only' WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;throw new PublicError("Deletion is pending. Billing must be resolved first; support can retry without charging or losing your request.");}
}
export async function processDeletionQueue(){const rows=await accountSql`SELECT user_id FROM b1_deletions WHERE product=${PERSONAL_PRODUCT} AND status IN ('pending','retry') ORDER BY created_at LIMIT 10`;for(const row of rows){try{await processDeletion(row.user_id);}catch{/* Persisted pending status is visible to support. */}}return rows.length;}

import { annualPrices, type BillingCurrency } from "../account/config";
export function annualPriceMatches(price:{active:boolean;product:string|{id:string};currency:string;unit_amount:number|null;recurring?:{interval:string;interval_count:number}|null;tax_behavior?:string|null;livemode:boolean}, currency:BillingCurrency, product:string,live:boolean) {
  return price.active && (typeof price.product==="string"?price.product:price.product.id)===product && price.currency===currency.toLowerCase() && price.unit_amount===annualPrices[currency] && price.recurring?.interval==="year" && price.recurring.interval_count===1 && price.tax_behavior==="inclusive" && price.livemode===live;
}

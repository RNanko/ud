// Fixed decimal values stay integers until a chart/display boundary. No formatted text is parsed.
export function scaledDecimal(value:string,scale:number){
 if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))throw new Error("Invalid decimal amount");
 const negative=value.startsWith("-"),[whole,fraction=""]=(negative?value.slice(1):value).split(".");
 if(fraction.length>scale&&/[1-9]/.test(fraction.slice(scale)))throw new Error("Decimal precision exceeds the supported scale");
 const units=BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.slice(0,scale).padEnd(scale,"0"));return negative?-units:units;
}
export function decimalString(units:bigint,scale:number){const negative=units<0n,value=negative?-units:units,base=10n**BigInt(scale);return `${negative?"-":""}${value/base}${scale?`.${String(value%base).padStart(scale,"0")}`:""}`;}
export const cashMinor=(value:string)=>scaledDecimal(value,2);
export const cashString=(value:bigint)=>decimalString(value,2);
export const displayCash=(value:bigint)=>Number(value)/100;
export const preciseProduct=(price:string,quantity:string)=>scaledDecimal(price,12)*scaledDecimal(quantity,12);
export const displayProduct=(units:bigint)=>Number(units)/1e24;

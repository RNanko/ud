import Link from "next/link";
import Brand from "@/app/components/shared/Brand";
import { brand } from "@/lib/brand";
function policy(value?:string){try{const url=new URL(value??"");return url.protocol==="https:"?url.href:null;}catch{return null;}}
export default function LandingFooter({home=true}:{home?:boolean}) {
 const terms=policy(process.env.POLICY_TERMS_URL),privacy=policy(process.env.POLICY_PRIVACY_URL),language=policy(process.env.LANGUAGE_PRODUCT_URL);
 return <footer className="mf-footer"><div><Brand/><p>ManForth — a B1-Way product.</p><a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></div><nav aria-label="Footer navigation"><a href={`${home?"":"/"}#features`}>Features</a><a href={`${home?"":"/"}#membership`}>Annual membership</a><Link prefetch={false} href="/help">Help & Q&A</Link><a href="/help#cancel-renewal">Trial & cancellation</a><Link prefetch={false} href="/account?section=privacy">Privacy & Legal, export & deletion</Link><Link prefetch={false} href="/auth/login?redirect=%2Faccount">Sign in</Link><Link prefetch={false} href="/terms">Terms & Conditions</Link><Link prefetch={false} href="/privacy">Privacy Policy</Link>{terms&&<a href={terms}>Previously configured terms</a>}{privacy&&<a href={privacy}>Previously configured privacy policy</a>}{language&&<a href={language}>B1-Way language product</a>}</nav><small>Plan. Train. Make progress.</small></footer>;
}

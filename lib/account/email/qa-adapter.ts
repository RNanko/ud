import 'server-only';
import {accountSql} from '../store';
/** Local, provider-free QA only. No simulated delivery success and no production fallback. */
export function qaMailEnabled(){
 if(process.env.MANFORTH_MOBILE_QA_MAIL!=='true')return false;
 const u=new URL(process.env.DATABASE_URL??'');
 if(process.env.NODE_ENV!=='development'||process.env.MANFORTH_MOBILE_QA_LOCAL!=='true'||decodeURIComponent(u.pathname.slice(1))!=='qa_tablename'||decodeURIComponent(u.username)!=='manforth_mobile_qa'||process.env.RESEND_API_KEY)throw Error('Invalid isolated mail configuration.');
 return true;
}
export async function verifyQaMail(){const [row]=await accountSql`SELECT current_database() AS database,current_user AS role`;if(row?.database!=='qa_tablename'||row?.role!=='manforth_mobile_qa')throw Error('Isolated email database identity changed.');}

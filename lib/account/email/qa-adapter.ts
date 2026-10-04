import 'server-only';
import {accountSql} from '../store';
export {qaMailEnabled} from './qa-configuration';
/** Local, provider-free QA only. No simulated delivery success and no production fallback. */
export async function verifyQaMail(){const [row]=await accountSql`SELECT current_database() AS database,current_user AS role`;if(row?.database!=='qa_tablename'||row?.role!=='manforth_mobile_qa')throw Error('Isolated email database identity changed.');}

export type ActionResult<T>={ok:true;value:T}|{ok:false;error:string};
export async function actionResult<T>(run:()=>Promise<T>):Promise<ActionResult<T>>{try{return {ok:true,value:await run()};}catch(error){return {ok:false,error:error instanceof Error?error.message:"Request failed. Please retry."};}}

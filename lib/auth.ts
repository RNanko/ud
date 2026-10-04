import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { authDb } from "./db/auth-drizzle";
import { nextCookies } from "better-auth/next-js";
import { expo } from "@better-auth/expo";
import { appOrigin, localQaWebOrigins } from "./account/config";
import { identityContext } from "./account/identity-context";
import { validateNewPassword } from "./account/password";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./account/password-policy";
import {dateOfBirthSchema} from "./account/birth-date";
import { queueRecovery } from "./account/email/recovery";
import { publishedBundle } from "./legal/store";
import { validateAgreement } from "./legal/validation";
import { assertVerifiedSignupProof } from "./account/signup";
export const auth=betterAuth({
 baseURL:appOrigin(),
 database:drizzleAdapter(authDb,{provider:"pg",transaction:true}),
 emailAndPassword:{enabled:true,requireEmailVerification:false,minPasswordLength:PASSWORD_MIN_LENGTH,maxPasswordLength:PASSWORD_MAX_LENGTH,autoSignIn:false,revokeSessionsOnPasswordReset:true,resetPasswordTokenExpiresIn:3600,sendResetPassword:async({user,url,token})=>queueRecovery(user,url,token)},
 socialProviders:process.env.SOCIAL_PASSWORD_MIGRATION_COMPLETE==="true"?{}:{
  ...(process.env.GITHUB_CLIENT_ID&&process.env.GITHUB_CLIENT_SECRET?{github:{clientId:process.env.GITHUB_CLIENT_ID,clientSecret:process.env.GITHUB_CLIENT_SECRET}}:{}),
  ...(process.env.DISCORD_CLIENT_ID&&process.env.DISCORD_CLIENT_SECRET?{discord:{clientId:process.env.DISCORD_CLIENT_ID,clientSecret:process.env.DISCORD_CLIENT_SECRET}}:{}),
 },account:{accountLinking:{enabled:false}},
 user:{changeEmail:{enabled:true},deleteUser:{enabled:true},additionalFields:{dateOfBirth:{type:"string",required:false,input:false,returned:false}}},
 hooks:{before:createAuthMiddleware(async ctx=>{
  const trusted=identityContext(),path=ctx.path;
  const fail=(message:string)=>{throw new APIError("FORBIDDEN",{message});};
  if(path==="/sign-up/email"&&trusted?.purpose!=="signup") fail("Verify your email through the registration form first");
  if(path==="/request-password-reset"&&!["recovery","migration"].includes(trusted?.purpose??"")) fail("Use the protected password recovery form");
  if(path==="/reset-password"&&!["recovery","migration"].includes(trusted?.purpose??"")) fail("Use the password recovery form");
  if(["/send-verification-email","/change-email","/verify-email","/set-password"].includes(path)&&!trusted) fail("Use Account & Settings to verify or change your email");
  if(path==="/delete-user"&&trusted?.purpose!=="deletion") fail("Use Account & Settings to delete your account safely");
  if((path.startsWith("/sign-in/social")||path.startsWith("/callback/"))&&process.env.SOCIAL_PASSWORD_MIGRATION_COMPLETE==="true"||path.startsWith("/link-social")||path.startsWith("/email-otp")||path.includes("magic-link")) fail("Use email and password. Existing social accounts can set a password through recovery.");
  if(path==="/update-user"&&(typeof ctx.body?.name!=="string"||!ctx.body.name.trim()||ctx.body.name.length>80)) fail("Enter a display name of up to 80 characters");
  if(path==="/update-user"&&Object.keys(ctx.body??{}).some(key=>key!=="name")) fail("Only your display name can be updated here");
  if(["/sign-up/email","/reset-password","/change-password","/set-password"].includes(path)&&!trusted?.passwordValidated) await validateNewPassword(ctx.body?.newPassword??ctx.body?.password);
  const callback=ctx.body?.callbackURL??ctx.body?.redirectTo;
  if(typeof callback==="string"&&new URL(callback,appOrigin()).origin!==appOrigin()) fail("Redirect origin is not allowed");
 })},
 databaseHooks:{user:{create:{before:async data=>{
  const proof=identityContext();
  if(proof?.purpose!=="signup"||proof.email!==data.email.toLowerCase()||!proof.userId) throw new APIError("FORBIDDEN",{message:"Email verification is required"});
  validateAgreement(proof.legal,await publishedBundle());
  await assertVerifiedSignupProof(proof.userId,data.email);
  return {data:{...data,id:proof.userId,emailVerified:true,image:null,dateOfBirth:dateOfBirthSchema.parse(proof.dateOfBirth)}};
 }}}},
 rateLimit:{storage:"database"},session:{cookieCache:{enabled:false},freshAge:600},
 // Native integration is opt-in on the isolated/staging server. Existing web
 // cookies, identity proofs, rate limits and callback rules remain unchanged.
 plugins:[...(process.env.MANFORTH_MOBILE_API_ENABLED==="true"?[expo()]:[]),nextCookies()],
 trustedOrigins:[...new Set([appOrigin(),...localQaWebOrigins(),...(process.env.MANFORTH_MOBILE_API_ENABLED==="true"?["udmobile://"]:[])])],
});

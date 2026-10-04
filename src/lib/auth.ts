import {twoFactor} from "better-auth/plugins";
import {accountMail} from "./mail";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { applicationOrigins } from "./origins";

if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) throw new Error("Configurer BETTER_AUTH_SECRET (32 caractères minimum).");
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "sqlite", transaction: true }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: applicationOrigins(),
  plugins:[twoFactor({issuer:"Kip-City"})],
  databaseHooks:{user:{update:{before:async(data,context)=>{if("twoFactorEnabled" in data&&data.twoFactorEnabled===true){const userId=context?.context.session?.user.id;if(userId){await db.session.deleteMany({where:{userId}});await db.auditEvent.create({data:{actorId:userId,objectId:userId,action:"MFA_ENABLED"}});}}return {data};}}}},
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128, resetPasswordTokenExpiresIn:900,revokeSessionsOnPasswordReset:true,sendResetPassword:async({user,url})=>accountMail(user,url,"RESET"),onPasswordReset:async({user})=>{await db.auditEvent.create({data:{actorId:user.id,objectId:user.id,action:"PASSWORD_RESET"}});} },
  emailVerification:{expiresIn:3600,sendVerificationEmail:async({user,url})=>accountMail(user,url,"VERIFY")},
  session: { expiresIn: 60 * 60 * 8, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 30 },
});

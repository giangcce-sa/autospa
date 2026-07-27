import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "./db";
import { checkAndIncrement, getQuotaStatus, resetBucket } from "./rate-limiter";
import {
  firstForwardedIp,
  isLockedOut,
  loginEmailKey,
  loginIpKey,
  LOGIN_FAIL_LIMIT,
  LOGIN_IP_FAIL_LIMIT,
  LOGIN_IP_WINDOW_SEC,
  LOGIN_WINDOW_SEC,
} from "./login-rate-policy";

class LoginLockedError extends CredentialsSignin {
  code = "locked";
}

// Fixed hash compared when the user does not exist, so both failure paths
// cost one bcrypt round — no email enumeration via response timing.
const DUMMY_HASH = "$2b$10$t3yFG5OsGhGwbIdEUeNQdeSADlcFzSUNkgCu5gAA8FmjiZc9/91aW";

async function requestIp(): Promise<string | null> {
  const h = await headers();
  return firstForwardedIp(h.get("x-forwarded-for"));
}

async function recordLoginFailure(email: string, ip: string | null) {
  await Promise.all([
    checkAndIncrement(loginEmailKey(email), LOGIN_FAIL_LIMIT, LOGIN_WINDOW_SEC),
    checkAndIncrement(loginIpKey(ip), LOGIN_IP_FAIL_LIMIT, LOGIN_IP_WINDOW_SEC),
  ]);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const ip = await requestIp();
        const [emailQuota, ipQuota] = await Promise.all([
          getQuotaStatus(loginEmailKey(email)),
          getQuotaStatus(loginIpKey(ip)),
        ]);
        if (isLockedOut(emailQuota) || isLockedOut(ipQuota)) {
          throw new LoginLockedError();
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await bcrypt.compare(password, DUMMY_HASH);
          await recordLoginFailure(email, ip);
          return null;
        }

        const ok = await bcrypt.compare(password, user.hashedPwd);
        if (!ok) {
          await recordLoginFailure(email, ip);
          return null;
        }

        await Promise.all([
          resetBucket(loginEmailKey(email)),
          prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "owner";
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function hasAnyUser(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}

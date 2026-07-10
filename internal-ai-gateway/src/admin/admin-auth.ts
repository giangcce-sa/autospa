import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { getDb } from "../db/client.js";
import { GatewayError } from "../errors/gateway-error.js";

function safeTokenEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function verifyAdminToken(token: string | undefined): boolean {
  return Boolean(token && safeTokenEqual(token, env.ADMIN_TOKEN));
}

export function cookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function hashAdminSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAdminSession(): { token: string; expiresAt: string; maxAge: number } {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashAdminSessionToken(token);
  const expiresAtMs = Date.now() + env.ADMIN_SESSION_TTL_SECONDS * 1000;
  const db = getDb();
  db.prepare("INSERT INTO admin_sessions (token, expires_at, created_at) VALUES (?, ?, ?)").run(
    tokenHash,
    expiresAtMs,
    new Date().toISOString()
  );
  // Cleanup expired sessions on create (cheap maintenance)
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(Date.now());
  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
    maxAge: env.ADMIN_SESSION_TTL_SECONDS
  };
}

export function revokeAdminSession(token: string): void {
  getDb().prepare("DELETE FROM admin_sessions WHERE token IN (?, ?)").run(hashAdminSessionToken(token), token);
}

function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const db = getDb();
  const tokenHash = hashAdminSessionToken(token);
  let row = db
    .prepare("SELECT expires_at FROM admin_sessions WHERE token = ?")
    .get(tokenHash) as { expires_at: number } | undefined;
  if (!row) {
    row = db
      .prepare("SELECT expires_at FROM admin_sessions WHERE token = ?")
      .get(token) as { expires_at: number } | undefined;
    if (row) {
      db.prepare("UPDATE admin_sessions SET token = ? WHERE token = ?").run(tokenHash, token);
    }
  }
  if (!row) return false;
  if (row.expires_at <= Date.now()) {
    db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(tokenHash);
    return false;
  }
  return true;
}

export async function adminTokenAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers["x-admin-token"] ?? request.headers.authorization;
  const sessionHeader = request.headers["x-admin-session"];
  const rawValue = Array.isArray(header) ? header[0] : header;
  const rawSession = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
  const token = rawValue?.startsWith("Bearer ") ? rawValue.slice("Bearer ".length) : rawValue;
  const sessionToken = rawSession ?? cookieValue(request.headers.cookie, "admin_session");

  if (isValidSession(sessionToken)) {
    return;
  }

  if (!verifyAdminToken(token)) {
    throw new GatewayError("UNAUTHORIZED", "Invalid admin token", 401);
  }
}

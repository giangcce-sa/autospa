import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Timing-safe string equality for verify tokens / header secrets.
 * Digests both sides first so length differences don't throw or leak timing.
 */
export function secureCompare(received: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

type WebhookEnvironment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "ALLOW_INSECURE_DEV_WEBHOOKS">>;

type VerifyWebhookSignatureInput = {
  rawBody: string | Buffer;
  signature: string | null;
  secret: string | undefined;
  env?: WebhookEnvironment;
};

export type WebhookSignatureDecision = {
  allowed: boolean;
  reason: "verified" | "development_bypass" | "missing_secret" | "invalid_signature";
};

export function verifyWebhookSignature({
  rawBody,
  signature,
  secret,
  env = process.env,
}: VerifyWebhookSignatureInput): WebhookSignatureDecision {
  if (!secret) {
    if (env.NODE_ENV !== "production" && env.ALLOW_INSECURE_DEV_WEBHOOKS === "true") {
      return { allowed: true, reason: "development_bypass" };
    }
    return { allowed: false, reason: "missing_secret" };
  }

  const received = (signature ?? "").replace(/^sha256=/, "");
  if (!/^[a-f0-9]{64}$/i.test(received)) {
    return { allowed: false, reason: "invalid_signature" };
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const allowed = timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
  return { allowed, reason: allowed ? "verified" : "invalid_signature" };
}

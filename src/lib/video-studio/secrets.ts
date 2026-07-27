import "server-only";

// Thin shim: video-studio secrets now use the shared at-rest crypto
// (enc:v2, SECRETS_ENCRYPTION_KEY with AUTH_SECRET fallback; still decrypts
// legacy enc:v1 blobs). Names are preserved for existing call sites and tests.
export { encryptSecret as encryptVideoSecret, decryptSecret as decryptVideoSecret } from "@/lib/secrets-crypto";

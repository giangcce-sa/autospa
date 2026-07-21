import test from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateAddress,
  ProviderUrlError,
  sameProviderOrigin,
  validateAiProviderUrl,
} from "../src/lib/provider-url-validation.ts";

test("AI provider URL accepts official HTTPS endpoints", () => {
  assert.equal(validateAiProviderUrl("https://api.anthropic.com", "claude"), "https://api.anthropic.com");
  assert.equal(validateAiProviderUrl("https://api.openai.com/v1/", "openai"), "https://api.openai.com/v1");
});

test("AI provider URL rejects SSRF targets and embedded credentials", () => {
  for (const value of [
    "http://api.openai.com/v1",
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://user:secret@api.openai.com/v1",
    "https://api.openai.com.attacker.example/v1",
  ]) {
    assert.throws(() => validateAiProviderUrl(value, "openai"), ProviderUrlError);
  }
});

test("custom AI gateways require an explicit host allowlist", () => {
  const previous = process.env.AI_PROVIDER_ALLOWED_HOSTS;
  try {
    delete process.env.AI_PROVIDER_ALLOWED_HOSTS;
    assert.throws(() => validateAiProviderUrl("https://gateway.example.com/v1", "openai"), ProviderUrlError);
    process.env.AI_PROVIDER_ALLOWED_HOSTS = "gateway.example.com";
    assert.equal(validateAiProviderUrl("https://gateway.example.com/v1", "openai"), "https://gateway.example.com/v1");
  } finally {
    if (previous === undefined) delete process.env.AI_PROVIDER_ALLOWED_HOSTS;
    else process.env.AI_PROVIDER_ALLOWED_HOSTS = previous;
  }
});

test("private address detection covers IPv4 and IPv6 ranges", () => {
  for (const address of ["10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.1.1", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
});

test("stored keys are reusable only on the same provider origin", () => {
  assert.equal(sameProviderOrigin("https://gateway.example.com/v1", "https://gateway.example.com/chat"), true);
  assert.equal(sameProviderOrigin("https://gateway.example.com", "https://gateway.example.com:8443"), false);
  assert.equal(sameProviderOrigin("https://api.openai.com/v1", "https://gateway.example.com/v1"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { adsMediaHostAllowed, inspectAdsImageBuffer, MAX_AD_IMAGE_BYTES } from "../src/lib/ads-image-policy.ts";

test("accepts supported Ads image magic bytes", () => {
  assert.equal(inspectAdsImageBuffer(Buffer.from("89504e470d0a1a0a00000000", "hex")), "image/png");
  assert.equal(inspectAdsImageBuffer(Buffer.from("ffd8ffe000104a4649460001", "hex")), "image/jpeg");
  assert.equal(inspectAdsImageBuffer(Buffer.from("524946460000000057454250", "hex")), "image/webp");
});

test("rejects malformed and oversized Ads images", () => {
  assert.throws(() => inspectAdsImageBuffer(Buffer.from("not-an-image")), /định dạng/);
  assert.throws(() => inspectAdsImageBuffer(Buffer.alloc(MAX_AD_IMAGE_BYTES + 1)), /10 MB/);
});

test("requires an exact external media host allowlist match", () => {
  assert.equal(adsMediaHostAllowed("cdn.example.com", ["cdn.example.com"]), true);
  assert.equal(adsMediaHostAllowed("attacker.example", ["cdn.example.com"]), false);
  assert.equal(adsMediaHostAllowed("cdn.example.com.attacker.test", ["cdn.example.com"]), false);
});

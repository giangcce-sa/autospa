import assert from "node:assert/strict";
import test from "node:test";
import { resolveMediaStoragePolicy } from "../src/lib/media-storage-policy.ts";

test("media storage allows local only on persistent deployments", () => {
  assert.equal(resolveMediaStoragePolicy({ DEPLOYMENT_MODE: "persistent", MEDIA_STORAGE_PROVIDER: "local" }).allowed, true);
  const stateless = resolveMediaStoragePolicy({ DEPLOYMENT_MODE: "stateless", MEDIA_STORAGE_PROVIDER: "local" });
  assert.equal(stateless.allowed, false);
  assert.match(stateless.blocker, /stateless/);
});

test("media storage requires valid S3 configuration on every deployment mode", () => {
  assert.equal(resolveMediaStoragePolicy({
    DEPLOYMENT_MODE: "stateless",
    MEDIA_STORAGE_PROVIDER: "s3",
    MEDIA_S3_BUCKET: "media",
  }).allowed, true);
  assert.equal(resolveMediaStoragePolicy({
    DEPLOYMENT_MODE: "persistent",
    MEDIA_STORAGE_PROVIDER: "s3",
  }).allowed, false);
  assert.equal(resolveMediaStoragePolicy({
    DEPLOYMENT_MODE: "stateless",
    MEDIA_STORAGE_PROVIDER: "s3",
    MEDIA_S3_BUCKET: "media",
    MEDIA_S3_ACCESS_KEY_ID: "partial",
  }).allowed, false);
  assert.equal(resolveMediaStoragePolicy({
    DEPLOYMENT_MODE: "stateless",
    MEDIA_STORAGE_PROVIDER: "s3",
    MEDIA_S3_BUCKET: "media",
    MEDIA_S3_ENDPOINT: "https://storage.example.test",
  }).allowed, false);
});

test("media storage blocks invalid provider and deployment values", () => {
  assert.equal(resolveMediaStoragePolicy({ MEDIA_STORAGE_PROVIDER: "disk" }).allowed, false);
  assert.equal(resolveMediaStoragePolicy({ DEPLOYMENT_MODE: "serverless", MEDIA_STORAGE_PROVIDER: "s3", MEDIA_S3_BUCKET: "media" }).allowed, false);
});

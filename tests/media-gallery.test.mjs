import assert from "node:assert/strict";
import test from "node:test";
import {
  imageReviewStatus,
  mediaAspectClass,
  mediaStatusPresentation,
  videoPosterUrl,
  videoRevisionState,
} from "../src/lib/media-gallery.ts";

test("does not present completed media as approved", () => {
  assert.deepEqual(mediaStatusPresentation("completed"), { label: "Hoàn tất", tone: "info" });
  assert.deepEqual(mediaStatusPresentation("approved"), { label: "Đã duyệt", tone: "success" });
  assert.equal(imageReviewStatus(true, "completed"), "approved");
  assert.equal(imageReviewStatus(false, "completed"), "rejected");
  assert.equal(imageReviewStatus(null, "completed"), "completed");
});

test("reports render and approval freshness independently", () => {
  assert.deepEqual(videoRevisionState(4, 4, 3), { renderFresh: true, approvalFresh: false });
  assert.deepEqual(videoRevisionState(4, 3, 4), { renderFresh: false, approvalFresh: true });
  assert.deepEqual(videoRevisionState(4, null, null), { renderFresh: false, approvalFresh: false });
});

test("uses only a current real render poster before scene fallback", () => {
  assert.equal(videoPosterUrl({ thumbnailUrl: "/poster.jpg", firstSceneImageUrl: "/scene.jpg", inputRevision: 3, renderedRevision: 3 }), "/poster.jpg");
  assert.equal(videoPosterUrl({ thumbnailUrl: "/stale.jpg", firstSceneImageUrl: "/scene.jpg", inputRevision: 3, renderedRevision: 2 }), "/scene.jpg");
  assert.equal(videoPosterUrl({ thumbnailUrl: "mock://poster", firstSceneImageUrl: null, inputRevision: 3, renderedRevision: 3 }), null);
});

test("maps known media formats to stable aspect classes", () => {
  assert.equal(mediaAspectClass("story"), "aspect-[9/16]");
  assert.equal(mediaAspectClass("16:9"), "aspect-video");
  assert.equal(mediaAspectClass("4:5"), "aspect-[4/5]");
  assert.equal(mediaAspectClass("feed"), "aspect-square");
});

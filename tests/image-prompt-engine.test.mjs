import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt, scoreImagePrompt } from "../src/lib/image-prompt-engine.ts";

describe("image prompt engine", () => {
  it("builds a structured prompt from caption, service and brand context", () => {
    const result = buildImagePrompt({
      caption: "Khach vua lam facial cham soc da, can anh sach va that",
      serviceName: "Facial cham soc da",
      preset: "ads",
      format: "story",
      brand: { spaName: "AutoSpa", primaryColor: "#2d6a4f", accentColor: "#40c074" },
    });

    assert.equal(result.preset, "ads");
    assert.equal(result.format, "story");
    assert.match(result.finalPrompt, /Facial cham soc da/i);
    assert.match(result.finalPrompt, /Avoid:/);
    assert.match(result.negativePrompt, /deformed hands/);
  });

  it("scores a contextual prompt higher than a generic one", () => {
    const generic = buildImagePrompt({});
    const contextual = buildImagePrompt({
      caption: "Mot goc phong treatment voi may laser va khan sach",
      serviceName: "Triet long laser",
      visualBrief: "Anh that nhu phong spa Viet Nam, anh sang diu",
      brand: { spaName: "AutoSpa", primaryColor: "#2d6a4f" },
      format: "feed",
    });

    assert.ok(scoreImagePrompt(contextual, {
      caption: "Mot goc phong treatment voi may laser va khan sach",
      serviceName: "Triet long laser",
      brand: { spaName: "AutoSpa", primaryColor: "#2d6a4f" },
      format: "feed",
    }).score > scoreImagePrompt(generic, {}).score);
  });

  it("injects staff visual context into the image prompt", () => {
    const result = buildImagePrompt({
      serviceName: "Cham soc da mat",
      preset: "testimonial",
      staffVisual: {
        name: "Linh",
        role: "Ky thuat vien",
        promptDescriptor: "adult Vietnamese spa therapist with tied black hair and gentle professional expression",
        uniformNotes: "sage green spa uniform",
        referenceImageUrl: "https://example.com/staff-linh.jpg",
      },
    });

    assert.match(result.finalPrompt, /Use staff visual reference/i);
    assert.match(result.finalPrompt, /sage green spa uniform/i);
    assert.match(result.negativePrompt, /do not sexualize staff/i);
  });
});

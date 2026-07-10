import assert from "node:assert/strict";
import test from "node:test";
import { contentChangeRatio, scoreHumanWriting } from "../src/lib/content-humanizer.ts";

test("penalizes generic AI marketing language", () => {
  const generic = scoreHumanWriting(
    "Bạn có đang tìm kiếm giải pháp hoàn hảo? Hãy đánh thức vẻ đẹp rạng ngời và tự tin tỏa sáng! Inbox ngay!",
    false,
  );
  assert.equal(generic.score < 80, true);
  assert.equal(generic.issues.some((issue) => issue.code === "ai_phrase"), true);
});

test("rewards concrete human detail over a generic caption", () => {
  const concrete = scoreHumanWriting(
    "Sáng nay chị Lan đến sớm 15 phút. Chị bảo: “Da chị mấy hôm nay căng quá”. Kỹ thuật viên kiểm tra rồi đổi sang bước làm dịu nhẹ hơn, mất khoảng 40 phút.",
    true,
  );
  const generic = scoreHumanWriting(
    "Dịch vụ chăm sóc da mang đến trải nghiệm tuyệt vời. Liên hệ ngay hôm nay để được tư vấn.",
    true,
  );
  assert.equal(concrete.score > generic.score, true);
});

test("measures how much the user changed an AI draft", () => {
  assert.equal(contentChangeRatio("một hai ba", "một hai ba"), 0);
  assert.equal(contentChangeRatio("một hai ba", "bốn năm sáu") > 0.9, true);
});

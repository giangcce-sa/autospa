# AI Video Studio

AI Video Studio biến brief thành storyboard, tạo video/voice/lip-sync theo từng cảnh, render bằng FFmpeg và chỉ cho xuất bản sau khi vượt QA và được duyệt.

## Kiến trúc

- AutoSpa Brain: kịch bản, phân tích video thật và skill đã duyệt.
- Runway: text-to-video và image-to-video.
- ElevenLabs: TTS, clone voice và forced alignment.
- Sync Labs: lip-sync từ ảnh/video và audio.
- FFmpeg: chuẩn hóa cảnh, ghép audio và render MP4.
- PostgreSQL: project, scene, asset, job, consent, skill, version và performance.
- Media storage: local hoặc S3/R2 thông qua `src/lib/media-storage.ts`.

Frontend không nhận API key. Key lưu trong database được mã hóa AES-256-GCM bằng `AUTH_SECRET`; tất cả provider được gọi từ server adapter trong `src/lib/video-studio/providers`.

## Chế độ local

`videoMockMode=true` cho phép kiểm thử toàn bộ state machine mà không gọi provider hoặc phát sinh chi phí. Output mock không thể đăng lên mạng xã hội.

```env
VIDEO_MOCK_MODE=true
VIDEO_BUDGET_USD=25
```

Có thể lưu cấu hình trong tab **Provider**. Environment variables là fallback:

```env
RUNWAY_API_KEY=
RUNWAY_BASE_URL=https://api.dev.runwayml.com
RUNWAY_VIDEO_MODEL=gen4.5
ELEVENLABS_API_KEY=
ELEVENLABS_BASE_URL=https://api.elevenlabs.io
ELEVENLABS_VOICE_MODEL=eleven_multilingual_v2
SYNC_API_KEY=
SYNC_BASE_URL=https://api.sync.so
SYNC_MODEL=sync-3
```

## Luồng sản xuất

1. Tạo project từ brief, nền tảng, thời lượng, nhân viên và style skill.
2. Tạo và duyệt storyboard.
3. Runway tạo từng cảnh.
4. ElevenLabs tạo voice và timestamp cho cảnh nói.
5. Sync Labs đồng bộ khẩu hình cho cảnh nói.
6. QA kiểm tra revision của cảnh, voice, lip-sync và storyboard.
7. Worker dùng FFmpeg để render, trộn nhạc nền, chèn logo BrandKit và tạo `VideoVersion`.
8. QA kỹ thuật đọc file render thật để kiểm tra duration, tỉ lệ, độ phân giải và audio stream.
9. Owner duyệt đúng revision đã render.
10. Worker publish lên Facebook, Instagram Reels hoặc TikTok sau khi kiểm tra lại consent.
11. Cron ghi performance Instagram/TikTok để học tiếp.

## Học video thật

Video upload được tách audio bằng FFmpeg, STT qua AI Gateway và phân tích thành skill `content`, `voice`, `visual`, `editing`, `identity` hoặc `performance`. Skill luôn ở trạng thái `pending`; chỉ khi owner duyệt mới tạo `BrainSkill` có quyền `suggest`.

Không dùng video AI làm dữ liệu học mặc định. Voice clone và lip-sync yêu cầu `VideoConsent` còn hiệu lực với đúng scope.

## Job polling

Runway và Sync Labs chạy bất đồng bộ. Render, learning và publish chạy bằng internal worker có lease, heartbeat, retry và idempotency. Cron xử lý tự động tại:

```text
GET /api/cron/video-jobs
Authorization: Bearer $CRON_SECRET
```

Cron chạy mỗi 2 phút. Job retry tối đa ba lần với backoff và chuyển `failed` khi hết lượt. Job cũ bị từ chối nếu project revision đã thay đổi.

## Render

FFmpeg phải có trong `PATH`. Docker image đã cài package `ffmpeg`. Output được chuẩn hóa H.264/AAC, `yuv420p`, 30fps và theo tỉ lệ project. Có thể upload nhạc nền trong panel hoàn thiện; logo lấy từ BrandKit của Page.

## Cổng an toàn

- Giữ trước chi phí dự kiến và chặn task vượt `videoBudgetUsd` theo project.
- Chặn clone voice hoặc lip-sync khi thiếu consent.
- Chặn duyệt khi render cũ, file chưa được kiểm tra kỹ thuật hoặc QA dưới 75.
- Chặn publish output mock.
- API key được mask và không trả về client.
- URL provider/media được chặn SSRF và chỉ cho phép host cấu hình.
- Upload giới hạn 150MB video, 40MB audio; kiểm tra MIME, extension, magic bytes, checksum và FFprobe.
- Xóa project sẽ xóa media liên quan; cron giữ ba version gần nhất và dọn dữ liệu lỗi/cũ.

## Cron vận hành

- `/api/cron/video-jobs`: worker và provider polling mỗi 2 phút.
- `/api/cron/video-performance`: snapshot Instagram/TikTok mỗi 6 giờ.
- `/api/cron/video-cleanup`: dọn version/asset cũ hàng ngày.

Tất cả cron yêu cầu `Authorization: Bearer $CRON_SECRET`.

## Kiểm tra local

```bash
npm run typecheck
npm run lint
npm test
npx prisma validate
npm run build
```

Để kiểm tra drift của migration, cấu hình `SHADOW_DATABASE_URL` trỏ tới một database PostgreSQL riêng.

Trước khi bật live provider, test kết nối từng provider trong UI và chạy một project ngắn 10-15 giây với ngân sách thấp.

# AutoSpa

Marketing automation và AI operations cho spa. Xem tài liệu [AI Video Studio](docs/AI_VIDEO_STUDIO.md) cho module tạo video, voice, lip-sync và học từ video thật.

## Bảo mật & vận hành

- **Mã hóa secrets trong DB**: API key và access token lưu trong database được mã hóa AES-256-GCM (`enc:v2`). Khóa lấy từ `SECRETS_ENCRYPTION_KEY` (khuyến nghị đặt riêng), fallback `AUTH_SECRET`. Dữ liệu plaintext cũ vẫn đọc được (lazy migration — mã hóa dần khi lưu lại); chạy backfill một lần bằng `node --experimental-strip-types scripts/encrypt-secrets.mjs` (backup trước bằng `npm run db:backup`). Xoay khóa: đặt khóa mới, blob cũ vẫn giải mã được qua chuỗi fallback, chạy lại backfill.
- **Chống brute-force đăng nhập**: chỉ đếm lần thất bại (10 lần/15 phút mỗi email, 30 lần/15 phút mỗi IP); đăng nhập thành công tự reset. Bootstrap giới hạn 5 lần/giờ mỗi IP.
- **Known issue (dev-only)**: `npm audit` báo 9 high đều quy về advisory `brace-expansion <=5.0.7` (GHSA-mh99-v99m-4gvg) trong chuỗi ESLint devDependencies; bản vá chỉ có ở 5.0.8 (major mới) nên chưa override được. Không ảnh hưởng production (`npm audit --omit=dev` sạch); sẽ tự hết khi nâng ESLint major.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy AutoSpa qua SSH

Repo có SSH profile riêng tại `deploy/ssh_config`:

```bash
ssh -F deploy/ssh_config autospa-vps
```

Profile sử dụng VPS `tranapo@34.87.65.200`, private key local
`~/.ssh/qq_vps_new` và bắt buộc kiểm tra host key. Không commit private key
hoặc `.env` vào repo.

Deploy một release:

```bash
scripts/deploy-vps.sh "$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"
```

Mặc định mã nguồn được đồng bộ tới `/opt/autospa`. Script giữ nguyên `.env`,
media và backup trên VPS, sau đó chạy backup PostgreSQL, Prisma migrations,
khởi động riêng service `autospa` và kiểm tra `/api/ready`. Có thể override bằng
`AUTOSPA_SSH_TARGET`, `AUTOSPA_REMOTE_DIR`, `SSH_CONFIG_FILE` hoặc
`SSH_IDENTITY_FILE`.

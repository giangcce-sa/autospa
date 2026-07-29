import * as Sentry from "@sentry/nextjs";
import { redactSentryEvent } from "./src/lib/sentry-redaction";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend: redactSentryEvent,
  });
}

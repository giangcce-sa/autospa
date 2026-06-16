import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Redact sensitive fields from server errors
      if (event.request?.data) {
        event.request.data = "[redacted]";
      }
      if (event.extra) {
        const extra = event.extra as Record<string, unknown>;
        for (const key of Object.keys(extra)) {
          if (/token|key|password|secret/i.test(key)) {
            extra[key] = "[redacted]";
          }
        }
      }
      return event;
    },
  });
}

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      // Strip request body to avoid leaking captions/tokens
      if (event.request?.data) {
        event.request.data = "[redacted]";
      }
      // Strip Authorization headers
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        if (headers.authorization) headers.authorization = "[redacted]";
        if (headers.Authorization) headers.Authorization = "[redacted]";
      }
      return event;
    },
  });
}

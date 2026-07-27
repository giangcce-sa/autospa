// Pure error type for authorization failures — no prisma, no server-only,
// so route helpers and tests can import it freely.

export class AccessError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  return null;
}

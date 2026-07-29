export type GatewayErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN_MODEL"
  | "PROVIDER_NOT_ALLOWED"
  | "COST_TIER_NOT_ALLOWED"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "MODEL_NOT_FOUND"
  | "TASK_NOT_ALLOWED"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "CLIENT_DISCONNECTED"
  | "KIRO_CLI_NOT_FOUND"
  | "KIRO_AUTH_FAILED"
  | "KIRO_TIMEOUT"
  | "KIRO_EXIT_NON_ZERO"
  | "KIRO_OUTPUT_PARSE_FAILED"
  | "QUEUE_FULL";

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: GatewayErrorCode, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function toGatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) {
    return error;
  }

  if (error instanceof Error) {
    return new GatewayError("PROVIDER_ERROR", error.message);
  }

  return new GatewayError("PROVIDER_ERROR", "Unknown gateway error");
}

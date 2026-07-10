import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { execa, ExecaError } from "execa";
import { env } from "../config/env.js";
import { modelRoutes } from "../config/models.js";
import { GatewayError } from "../errors/gateway-error.js";
import { runInKiroQueue } from "../queue/provider-queue.js";
import type { AiProviderAdapter, GatewayChatRequest, GatewayChatResponse, GatewayModel } from "./types.js";

function compilePrompt(request: GatewayChatRequest): string {
  const header = [
    `Request ID: ${request.requestId}`,
    `Client: ${request.clientId}`,
    `Task type: ${request.taskType}`,
    "Return the useful answer only unless the prompt explicitly asks for structured output."
  ];

  const metadata = request.metadata ? [`Metadata: ${JSON.stringify(request.metadata)}`] : [];
  const messages = request.messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`);

  return [...header, ...metadata, ...messages].join("\n\n");
}

function mapKiroError(error: unknown): GatewayError {
  if (error instanceof GatewayError) {
    return error;
  }

  if (error instanceof ExecaError) {
    if (error.timedOut) {
      return new GatewayError("KIRO_TIMEOUT", "kiro-cli command exceeded configured timeout", 504, {
        stderr: error.stderr,
        exitCode: error.exitCode
      });
    }

    if (error.code === "ENOENT") {
      return new GatewayError("KIRO_CLI_NOT_FOUND", "kiro-cli is not installed or not in PATH", 503);
    }

    const stderr = String(error.stderr ?? "");
    if (stderr.toLowerCase().includes("auth") || stderr.toLowerCase().includes("api key")) {
      return new GatewayError("KIRO_AUTH_FAILED", "KIRO_API_KEY is missing or invalid", 401);
    }

    return new GatewayError("KIRO_EXIT_NON_ZERO", "kiro-cli returned a non-zero exit code", 502, {
      stderr: error.stderr,
      exitCode: error.exitCode
    });
  }

  return new GatewayError("PROVIDER_ERROR", "Unknown Kiro CLI error", 502);
}

export class KiroCliAdapter implements AiProviderAdapter {
  readonly provider = "kiro-cli" as const;

  async chat(request: GatewayChatRequest): Promise<GatewayChatResponse> {
    if (!env.KIRO_API_KEY) {
      throw new GatewayError("KIRO_AUTH_FAILED", "KIRO_API_KEY is missing or invalid", 401);
    }

    const started = Date.now();
    const cwd = resolve(env.KIRO_WORKDIR);
    await mkdir(cwd, { recursive: true });

    try {
      return await runInKiroQueue(async () => {
        const result = await execa(env.KIRO_CLI_BIN, ["chat", "--no-interactive", compilePrompt(request)], {
          cwd,
          env: {
            KIRO_API_KEY: env.KIRO_API_KEY
          },
          timeout: env.KIRO_TIMEOUT_SECONDS * 1000,
          reject: true
        });

        const content = result.stdout.trim();
        if (!content) {
          throw new GatewayError("KIRO_OUTPUT_PARSE_FAILED", "kiro-cli output could not be normalized", 502, {
            stderr: result.stderr,
            exitCode: result.exitCode
          });
        }

        return {
          id: request.requestId,
          model: request.model,
          provider: this.provider,
          content,
          usage: {
            input_tokens: null,
            output_tokens: null,
            source: "unavailable"
          },
          latency_ms: Date.now() - started,
          provider_metadata: {
            exit_code: result.exitCode,
            timed_out: false,
            working_directory: cwd
          }
        };
      });
    } catch (error) {
      throw mapKiroError(error);
    }
  }

  async listModels(): Promise<GatewayModel[]> {
    return modelRoutes
      .filter((route) => route.provider === this.provider)
      .map((route) => ({
        id: route.model,
        provider: route.provider,
        provider_model: route.providerModel
      }));
  }
}

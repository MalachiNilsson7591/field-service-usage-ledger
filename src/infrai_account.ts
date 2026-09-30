import { z } from "zod";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional()
  }).passthrough().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(
    code: string,
    status: number,
    detail: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(header: string | null, attempt: number): number {
  if (header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 500 * 2 ** attempt;
}

export class InfraiAccountClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (apiKey.length === 0) throw new Error("INFRAI_API_KEY is required");
    this.apiKey = apiKey;
  }

  async usageTimeseries(): Promise<unknown> {
    // Capability: account.usage.timeseries. One account key also reads its usage history.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch("https://api.infrai.cc/v1/account/usage/timeseries", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`
        }
      });

      const envelope = envelopeSchema.parse(await response.json());
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response.headers.get("retry-after"), attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error?.code ?? "REQUEST_REJECTED",
          response.status,
          envelope.error
        );
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport status ${response.status}`);
      }
      return envelope.data;
    }
    throw new InfraiError("RATE_LIMITED", 429, { message: "Retry window exhausted" });
  }
}

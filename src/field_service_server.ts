import { createServer, type ServerResponse } from "node:http";
import { billingPreviewRequest, previewBilling } from "./billing_policy.ts";
import { InfraiAccountClient, InfraiError } from "./infrai_account.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const account = new InfraiAccountClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/billing-preview") {
    reply(response, 404, { error: "Route not found" });
    return;
  }

  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64 * 1024) {
      reply(response, 413, { error: "Request body is too large" });
      return;
    }
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    reply(response, 400, { error: "Request body must be JSON" });
    return;
  }

  const parsed = billingPreviewRequest.safeParse(json);
  if (!parsed.success) {
    reply(response, 400, { error: parsed.error.flatten() });
    return;
  }

  try {
    const accountUsageTimeseries = await account.usageTimeseries();
    reply(response, 200, {
      preview: previewBilling(parsed.data),
      accountUsageTimeseries
    });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      reply(response, status, { error: { code: error.code, message: error.message } });
      return;
    }
    console.error(error);
    reply(response, 502, { error: "Account usage could not be read" });
  }
}).listen(port, () => {
  console.log(`Field-service billing preview listening on http://localhost:${port}`);
});

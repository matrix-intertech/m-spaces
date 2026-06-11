import type { NextApiRequest, NextApiResponse } from "next";
import { parse as parseQueryString } from "querystring";

process.env.MATRIX_EMBEDDED_BACKEND = "1";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};

function rewriteInternalUrl(url: string | undefined) {
  return (url ?? "/").replace(/^\/api\/_internal/, "") || "/";
}

function shouldPreparseBody(req: NextApiRequest) {
  const method = String(req.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  return contentType.includes("application/json") || contentType.includes("application/x-www-form-urlencoded");
}

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function preparseBody(req: NextApiRequest) {
  if (!shouldPreparseBody(req)) return;

  const rawBody = await readRawBody(req);
  const contentType = String(req.headers["content-type"] || "").toLowerCase();

  try {
    if (!rawBody.trim()) {
      req.body = {};
    } else if (contentType.includes("application/json")) {
      req.body = JSON.parse(rawBody);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      req.body = parseQueryString(rawBody);
    }

    req.headers["x-embedded-body-parsed"] = "1";
  } catch (error) {
    const parsingError = new Error("Invalid request body");
    (parsingError as Error & { cause?: unknown }).cause = error;
    throw parsingError;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rewrittenUrl = rewriteInternalUrl(req.url);

  try {
    await preparseBody(req);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serverApp = require("../../../server/server");

    req.url = rewrittenUrl;
    (req as NextApiRequest & { originalUrl?: string }).originalUrl = rewrittenUrl;

    serverApp(req, res);
    return;
  } catch (error) {
    console.error("[Internal API Bridge] Request failed:", {
      method: req.method,
      originalUrl: req.url,
      rewrittenUrl,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Internal API bridge failure",
        details: error instanceof Error ? error.message : String(error)
      });
    } else {
      res.end();
    }
  }
}

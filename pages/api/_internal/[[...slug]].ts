import type { NextApiRequest, NextApiResponse } from "next";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rewrittenUrl = rewriteInternalUrl(req.url);

  try {
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

import type { ErrorRequestHandler, RequestHandler } from "express";

// Every error response has the same shape (CLAUDE.md section 7):
// { error: { code, message, details? } }
// The frontend translates by `code`.

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `No route for ${req.method} ${req.path}.`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Errors thrown by express.json() when the body is not valid JSON.
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "The request body is not valid JSON." },
    });
    return;
  }

  // express.json() body larger than the configured limit.
  if (err?.type === "entity.too.large") {
    res.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "The request body is too large." },
    });
    return;
  }

  // Anything else is a bug: log it, but never send internal details to the client.
  console.error(err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on the server. Please try again.",
    },
  });
};

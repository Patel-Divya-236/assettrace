import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../lib/AppError";
import { zodDetails } from "./validate";

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
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields are missing or invalid. Please check and try again.",
        details: zodDetails(err),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint, e.g. a second asset type with the same name.
    if (err.code === "P2002") {
      res.status(409).json({
        error: {
          code: "ALREADY_EXISTS",
          message: "A record with this value already exists. Use a different value.",
          details: { fields: err.meta?.target },
        },
      });
      return;
    }
    // Record to update/delete does not exist.
    if (err.code === "P2025") {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "The record was not found." },
      });
      return;
    }
  }

  // Upload problems (file too big, too many files).
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    res.status(tooBig ? 413 : 400).json({
      error: {
        code: tooBig ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
        message: tooBig ? "The file is too large. Use a smaller file." : "The upload was not accepted. Send one file.",
      },
    });
    return;
  }

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

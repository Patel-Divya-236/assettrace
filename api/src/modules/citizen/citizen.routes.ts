import { Router } from "express";
import multer from "multer";
import { AppError } from "../../lib/AppError";
import { currentUser } from "../../middleware/auth";
import { reportLimiter } from "../../middleware/rateLimit";
import { paginationQuery, validate } from "../../middleware/validate";
import { prisma } from "../../db/prisma";
import { createReportBody } from "../public/public.schema";
import { createReport, myReports } from "../public/public.service";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Photos: memory only (stored in Postgres, never on disk), max 2 MB, images only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(400, "INVALID_PHOTO", "The photo must be a JPEG, PNG or WebP image."));
  },
});

// Mounted at /api/citizen behind requireAuth + CITIZEN role.
// Every complaint is tied to the account that filed it.
export const citizenRouter = Router();

citizenRouter.post("/reports", reportLimiter, upload.single("photo"), validate({ body: createReportBody }), async (req, res) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id }, select: { id: true, phone: true } });
  const photo = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : undefined;
  res.status(201).json(await createReport(req.body, photo, me));
});

citizenRouter.get("/reports", validate({ query: paginationQuery }), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  res.json(await myReports(currentUser(req).id, page, pageSize));
});

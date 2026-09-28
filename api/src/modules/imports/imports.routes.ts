import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AppError } from "../../lib/AppError";
import { currentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { idParams, validate } from "../../middleware/validate";
import { getImportJob, runImport } from "./imports.service";

// Memory storage: never write uploads to Render's ephemeral disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

// Mounted at /api/imports behind requireAuth.
export const importsRouter = Router();

importsRouter.post(
  "/",
  requireRole("ADMIN"),
  upload.single("file"),
  validate({ body: z.object({ typeId: z.uuid({ message: "Choose an asset type" }) }) }),
  async (req, res) => {
    if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Choose a CSV file to upload.");
    res.status(201).json(await runImport(req.file.buffer, req.body.typeId, currentUser(req).id));
  },
);

importsRouter.get("/:id", requireRole("ADMIN"), validate({ params: idParams }), async (req, res) => {
  res.json(await getImportJob(req.params.id as string));
});

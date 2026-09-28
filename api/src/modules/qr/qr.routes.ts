import { Router } from "express";
import QRCode from "qrcode";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { notFound } from "../../lib/AppError";
import { idParams, validate } from "../../middleware/validate";

// Mounted at /api/assets behind requireAuth.
export const qrRouter = Router();

/**
 * Returns JSON { assetCode, url, png } where png is a data URL.
 * JSON instead of a raw PNG because staff images must be fetched with the auth
 * header (an <img src> can't send it), and the frontend prints the asset code
 * as text under the image, which is simpler than drawing text into the PNG.
 * The QR holds only a public URL, never data (D-12). Level H survives ~30% damage.
 */
qrRouter.get("/:id/qr", validate({ params: idParams }), async (req, res) => {
  const asset = await prisma.asset.findUnique({
    where: { id: req.params.id as string },
    select: { assetCode: true },
  });
  if (!asset) throw notFound("Asset");

  const url = `${env.FRONTEND_URL}/a/${asset.assetCode}`;
  const png = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", width: 512, margin: 2 });
  res.json({ assetCode: asset.assetCode, url, png });
});

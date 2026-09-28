/**
 * Shrink a phone photo before upload: max 1280 px on the long side, JPEG,
 * lowering quality until it is about 100 KB. A 4 MB camera photo becomes
 * ~100 KB, which uploads in seconds on slow 3G.
 */
export async function compressImage(file: File, maxSide = 1280, targetBytes = 100_000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.8;
  let blob = await toBlob(canvas, quality);
  while (blob.size > targetBytes && quality > 0.35) {
    quality -= 0.15;
    blob = await toBlob(canvas, quality);
  }
  return blob;
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", quality));

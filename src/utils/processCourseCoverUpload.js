const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

/** Макс. размер по длинной стороне после вписывания (достаточно для карточек и Retina). */
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 92;

/**
 * Обложка курса: EXIF, вписывание в рамку без обрезки, без увеличения мелких файлов.
 * JPEG с высоким качеством; PNG с альфой остаётся PNG. SVG и GIF не трогаем.
 * @param {string} absolutePath
 * @returns {Promise<string>} итоговое имя файла в uploads/courses
 */
async function processCourseCoverUpload(absolutePath) {
  const ext = path.extname(absolutePath).toLowerCase();
  const base = path.basename(absolutePath, ext);
  const dir = path.dirname(absolutePath);

  if (ext === '.svg' || ext === '.gif') {
    return path.basename(absolutePath);
  }

  const inputBuffer = await fs.readFile(absolutePath);
  const meta = await sharp(inputBuffer).metadata();

  const pipeline = sharp(inputBuffer)
    .rotate()
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true
    });

  let buf;
  let outExt;

  if (meta.hasAlpha) {
    buf = await pipeline.png({ compressionLevel: 8, effort: 6 }).toBuffer();
    outExt = '.png';
  } else {
    buf = await pipeline
      .jpeg({
        quality: JPEG_QUALITY,
        chromaSubsampling: '4:4:4',
        mozjpeg: true
      })
      .toBuffer();
    outExt = '.jpg';
  }

  const outName = `${base}${outExt}`;
  const outPath = path.join(dir, outName);
  await fs.writeFile(outPath, buf);

  if (path.resolve(absolutePath) !== path.resolve(outPath)) {
    await fs.unlink(absolutePath).catch(() => {});
  }

  return outName;
}

module.exports = {
  processCourseCoverUpload,
  MAX_WIDTH,
  MAX_HEIGHT,
  JPEG_QUALITY
};

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

/** Сторона квадрата после ресайза: хватает для чёткого показа и Retina; ресэмплинг sharp лучше, чем ужимание огромного фото в браузере. */
const AVATAR_EDGE = 768;
const JPEG_QUALITY = 93;

/**
 * Нормализует загруженный аватар: EXIF-поворот, ресэмплинг (lanczos3 внутри sharp),
 * JPEG с высоким качеством и 4:4:4 субдискретизацией цвета (лучше для лиц).
 * @param {string} absolutePath — путь к файлу после multer
 * @returns {Promise<string>} имя итогового файла в папке avatars
 */
async function processAvatarUpload(absolutePath) {
  const inputBuffer = await fs.readFile(absolutePath);
  const dir = path.dirname(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const base = path.basename(absolutePath, ext);
  const outName = `${base}.jpg`;
  const outPath = path.join(dir, outName);

  const buf = await sharp(inputBuffer)
    .rotate()
    .resize(AVATAR_EDGE, AVATAR_EDGE, {
      fit: 'cover',
      position: 'centre'
    })
    .jpeg({
      quality: JPEG_QUALITY,
      chromaSubsampling: '4:4:4',
      mozjpeg: true
    })
    .toBuffer();

  await fs.writeFile(outPath, buf);

  if (path.resolve(absolutePath) !== path.resolve(outPath)) {
    await fs.unlink(absolutePath).catch(() => {});
  }

  return outName;
}

module.exports = { processAvatarUpload, AVATAR_EDGE, JPEG_QUALITY };

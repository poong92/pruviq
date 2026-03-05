import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC = resolve(__dirname, '..', 'public');
const src = resolve(PUBLIC, 'og-image.png');
const outWebp = resolve(PUBLIC, 'og-image.webp');
const outAvif = resolve(PUBLIC, 'og-image.avif');

async function run() {
  try {
    // Try to dynamically import sharp. If it's not installed, skip gracefully.
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    // Ensure source exists
    try {
      await fs.access(src);
    } catch (e) {
      console.log('Source OG image not found, skipping conversion:', src);
      return;
    }

    console.log('Converting og-image.png → og-image.webp / og-image.avif using sharp');

    await sharp(src)
      .webp({ quality: 80 })
      .toFile(outWebp);

    await sharp(src)
      .avif({ quality: 60 })
      .toFile(outAvif);

    console.log('Conversion complete:', outWebp.split('/').pop(), outAvif.split('/').pop());
  } catch (err) {
    console.log('sharp not available or conversion failed — skipping image conversion.');
    // Do not treat as fatal — optional conversion.
  }
}

run().catch(err => {
  console.error('convert-og-image error:', err);
});

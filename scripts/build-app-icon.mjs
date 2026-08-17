import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICO_HEADER_SIZE = 6;
const ICO_DIRECTORY_ENTRY_SIZE = 16;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const masterPath = resolve(
  repositoryRoot,
  "assets/branding/sprout-hollow-valley-master.png",
);
const outputPath = resolve(
  repositoryRoot,
  "assets/branding/sprout-hollow-valley.ico",
);

sharp.cache(false);
sharp.concurrency(1);
sharp.simd(false);

const masterMetadata = await sharp(masterPath).metadata();

if (
  !masterMetadata.width ||
  !masterMetadata.height ||
  masterMetadata.width !== masterMetadata.height
) {
  throw new Error("The application icon master must be a non-empty square image.");
}

if (!masterMetadata.hasAlpha) {
  throw new Error("The application icon master must include an alpha channel.");
}

const frames = await Promise.all(
  ICON_SIZES.map(async (size) => {
    const png = await sharp(masterPath, { failOn: "error" })
      .resize({
        width: size,
        height: size,
        fit: "contain",
        kernel: sharp.kernel.lanczos3,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha()
      .png({
        compressionLevel: 9,
        adaptiveFiltering: false,
        palette: false,
        progressive: false,
        effort: 10,
      })
      .toBuffer();

    if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error(`Generated ${size}x${size} frame is not a PNG image.`);
    }

    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== size || height !== size) {
      throw new Error(
        `Generated frame is ${width}x${height}; expected ${size}x${size}.`,
      );
    }

    return { size, png };
  }),
);

const directorySize = ICO_DIRECTORY_ENTRY_SIZE * frames.length;
const headerAndDirectory = Buffer.alloc(ICO_HEADER_SIZE + directorySize);

headerAndDirectory.writeUInt16LE(0, 0);
headerAndDirectory.writeUInt16LE(1, 2);
headerAndDirectory.writeUInt16LE(frames.length, 4);

let imageOffset = headerAndDirectory.length;

frames.forEach(({ size, png }, index) => {
  const entryOffset = ICO_HEADER_SIZE + index * ICO_DIRECTORY_ENTRY_SIZE;
  const encodedDimension = size === 256 ? 0 : size;

  headerAndDirectory.writeUInt8(encodedDimension, entryOffset);
  headerAndDirectory.writeUInt8(encodedDimension, entryOffset + 1);
  headerAndDirectory.writeUInt8(0, entryOffset + 2);
  headerAndDirectory.writeUInt8(0, entryOffset + 3);
  headerAndDirectory.writeUInt16LE(1, entryOffset + 4);
  headerAndDirectory.writeUInt16LE(32, entryOffset + 6);
  headerAndDirectory.writeUInt32LE(png.length, entryOffset + 8);
  headerAndDirectory.writeUInt32LE(imageOffset, entryOffset + 12);

  imageOffset += png.length;
});

const ico = Buffer.concat([headerAndDirectory, ...frames.map(({ png }) => png)]);

if (ico.length !== imageOffset) {
  throw new Error(`ICO length ${ico.length} does not match final offset ${imageOffset}.`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, ico);

console.log(`Generated ${relative(repositoryRoot, outputPath)} (${ico.length} bytes).`);
console.log(
  `ICO entries: ${frames
    .map(({ size, png }) => `${size}x${size} (${png.length} bytes)`)
    .join(", ")}.`,
);

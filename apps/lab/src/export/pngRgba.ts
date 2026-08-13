/** Tiny uncompressed PNG encoder (RGBA8). Node + browser, no Canvas. */

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a += bytes[i]!;
    if (a >= 65521) a -= 65521;
    b += a;
    if (b >= 65521) b -= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]);
  const crcInput = concat([typeBytes, data]);
  return concat([u32(data.length), crcInput, u32(crc32(crcInput))]);
}

function zlibStore(raw: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  let offset = 0;
  while (offset < raw.length) {
    const remaining = raw.length - offset;
    const size = Math.min(65535, remaining);
    const last = offset + size >= raw.length ? 1 : 0;
    const nlen = 0xffff ^ size;
    const header = new Uint8Array([last, size & 0xff, (size >>> 8) & 0xff, nlen & 0xff, (nlen >>> 8) & 0xff]);
    blocks.push(header, raw.subarray(offset, offset + size));
    offset += size;
  }
  blocks.push(u32(adler32(raw)));
  return concat(blocks);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Encode RGBA pixels as a PNG data URI (Figma-safe single image, not thousands of SVG rects). */
export function rgbaPngDataUri(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number): string {
  const cols = Math.max(1, Math.round(width));
  const rows = Math.max(1, Math.round(height));
  const stride = cols * 4;
  const raw = new Uint8Array((stride + 1) * rows);
  for (let row = 0; row < rows; row += 1) {
    const dest = row * (stride + 1);
    raw[dest] = 0;
    raw.set(pixels.subarray(row * stride, row * stride + stride), dest + 1);
  }
  const ihdr = concat([
    u32(cols),
    u32(rows),
    new Uint8Array([8, 6, 0, 0, 0]), // bit depth 8, RGBA, no interlace
  ]);
  const png = concat([PNG_SIG, chunk("IHDR", ihdr), chunk("IDAT", zlibStore(raw)), chunk("IEND", new Uint8Array(0))]);
  return `data:image/png;base64,${bytesToBase64(png)}`;
}

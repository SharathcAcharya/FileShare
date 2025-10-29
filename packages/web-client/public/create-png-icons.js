import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a minimal PNG with the specified color
function createMinimalPNG(size, r, g, b) {
  // PNG header
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);      // width
  ihdrData.writeUInt32BE(size, 4);      // height
  ihdrData.writeUInt8(8, 8);            // bit depth
  ihdrData.writeUInt8(2, 9);            // color type (RGB)
  ihdrData.writeUInt8(0, 10);           // compression
  ihdrData.writeUInt8(0, 11);           // filter
  ihdrData.writeUInt8(0, 12);           // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // IDAT chunk - simple gradient-like pattern
  const pixels = [];
  for (let y = 0; y < size; y++) {
    pixels.push(0); // filter type
    for (let x = 0; x < size; x++) {
      // Create a simple gradient effect
      const factor = (x + y) / (size * 2);
      pixels.push(Math.floor(r + (124 - r) * factor)); // R
      pixels.push(Math.floor(g + (58 - g) * factor));  // G  
      pixels.push(Math.floor(b + (237 - b) * factor)); // B
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(pixels));
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = calculateCRC(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function calculateCRC(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crc ^ data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return crc ^ 0xFFFFFFFF;
}

// Generate icons
try {
  const icon192 = createMinimalPNG(192, 79, 70, 229);
  fs.writeFileSync(path.join(__dirname, 'icon-192.png'), icon192);
  console.log('Created icon-192.png');
  
  const icon512 = createMinimalPNG(512, 79, 70, 229);
  fs.writeFileSync(path.join(__dirname, 'icon-512.png'), icon512);
  console.log('Created icon-512.png');
  
  console.log('\nPNG icons created successfully!');
} catch (err) {
  console.error('Error creating PNG:', err);
}

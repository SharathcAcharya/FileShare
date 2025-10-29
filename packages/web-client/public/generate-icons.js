/**
 * Generate SVG icons using Node.js
 * Run with: node generate-icons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple SVG-based icon generation
function generateSVGIcon(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  
  <!-- File folder icon -->
  <g transform="translate(${size * 0.2}, ${size * 0.25})">
    <rect width="${size * 0.6}" height="${size * 0.5}" fill="white" opacity="0.9" rx="${size * 0.05}"/>
    <path d="M ${size * 0.05} ${size * 0.05} L ${size * 0.2} ${size * 0.05} L ${size * 0.25} 0 L ${size * 0.55} 0 L ${size * 0.55} ${size * 0.05}" 
          fill="white" opacity="0.9"/>
  </g>
  
  <!-- Share arrows -->
  <g transform="translate(${size * 0.7}, ${size * 0.15})">
    <circle cx="0" cy="0" r="${size * 0.08}" fill="white" opacity="0.9"/>
    <path d="M 0 ${size * 0.08} L ${-size * 0.15} ${size * 0.25} L ${size * 0.15} ${size * 0.25} Z" 
          fill="white" opacity="0.9"/>
  </g>
</svg>`;
}

// Write SVG files
const sizes = [192, 512];
sizes.forEach(size => {
  const svg = generateSVGIcon(size);
  const filename = path.join(__dirname, `icon-${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Created ${filename}`);
});

console.log('\nSVG icons created!');
console.log('To use them as PNG, you can either:');
console.log('1. Reference the SVG directly in the manifest (browsers support this)');
console.log('2. Or use an online converter like https://cloudconvert.com/svg-to-png');

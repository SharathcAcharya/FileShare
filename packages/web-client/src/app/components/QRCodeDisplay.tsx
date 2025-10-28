/**
 * QR Code Display Component
 * Generates and displays QR codes for session sharing
 */

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import './QRCode.css';

interface QRCodeDisplayProps {
  data: string;
  size?: number;
}

export function QRCodeDisplay({ data, size = 256 }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: size,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      }).catch((error) => {
        console.error('[QRCode] Failed to generate QR code:', error);
      });
    }
  }, [data, size]);

  return (
    <div className="qr-code-display">
      <canvas ref={canvasRef} />
    </div>
  );
}

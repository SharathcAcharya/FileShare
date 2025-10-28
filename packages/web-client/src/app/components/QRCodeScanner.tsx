/**
 * QR Code Scanner Component
 * Scans QR codes using device camera
 */

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './QRCode.css';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
}

export function QRCodeScanner({ onScan, onError }: QRCodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode>();
  const elementId = 'qr-reader';

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          console.log('[QRScanner] Scanned:', decodedText);
          onScan(decodedText);
          
          // Stop scanning after successful scan
          scanner.stop().catch(console.error);
          setIsScanning(false);
        },
        (errorMessage) => {
          // Ignore verbose error messages
          if (!errorMessage.includes('NotFoundException')) {
            console.debug('[QRScanner]', errorMessage);
          }
        }
      );

      setIsScanning(true);
    } catch (error) {
      console.error('[QRScanner] Failed to start scanner:', error);
      if (onError) {
        onError('Failed to access camera. Please check permissions.');
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        setIsScanning(false);
      }).catch(console.error);
    }
  };

  return (
    <div className="qr-scanner">
      <div id={elementId} style={{ width: '100%' }}></div>
      
      {!isScanning ? (
        <button className="btn btn-primary" onClick={startScanning}>
          📷 Start Camera
        </button>
      ) : (
        <button className="btn btn-secondary" onClick={stopScanning}>
          ⏹ Stop Scanning
        </button>
      )}
    </div>
  );
}

/**
 * Transfer Progress Component
 * Shows real-time file transfer progress
 */

import './TransferProgress.css';

interface TransferProgressProps {
  fileName: string;
  fileSize: number;
  transferred: number;
  percentage: number;
  speed: number;
  eta: number;
}

export function TransferProgress({
  fileName,
  fileSize,
  transferred,
  percentage,
  speed,
  eta,
}: TransferProgressProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="transfer-progress-container">
      <div className="transfer-info">
        <div className="transfer-icon">📄</div>
        <div className="transfer-details">
          <h3 className="transfer-filename">{fileName}</h3>
          <p className="transfer-size">{formatBytes(fileSize)}</p>
        </div>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="progress-percentage">{percentage}%</span>
      </div>

      <div className="transfer-stats">
        <div className="stat">
          <span className="stat-label">Transferred:</span>
          <span className="stat-value">{formatBytes(transferred)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Speed:</span>
          <span className="stat-value">{formatSpeed(speed)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">ETA:</span>
          <span className="stat-value">{formatTime(eta)}</span>
        </div>
      </div>
    </div>
  );
}

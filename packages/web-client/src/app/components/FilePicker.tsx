/**
 * File Picker Component
 * Drag & drop and click-to-select file picker
 */

import { useState } from 'react';
import './FilePicker.css';

interface FilePickerProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FilePicker({ onFileSelect, disabled = false }: FilePickerProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !disabled) {
      onFileSelect(file);
    }
  };

  return (
    <div
      className={`file-picker ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-input"
        onChange={handleFileChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      
      <label htmlFor="file-input" className="file-picker-label">
        <div className="file-picker-icon">📁</div>
        <h3>Choose a file to send</h3>
        <p>Drag & drop or click to select</p>
        <p className="file-picker-note">Any file type, any size</p>
      </label>
    </div>
  );
}

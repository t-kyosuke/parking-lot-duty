import React, { useCallback } from 'react';
import { parseCsv } from '../lib/parseCsv';
import type { ParsedCsvData } from '../lib/parseCsv';

interface CsvUploaderProps {
  onParsed: (data: ParsedCsvData) => void;
}

const CsvUploader: React.FC<CsvUploaderProps> = ({ onParsed }) => {
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const data = await parseCsv(file);
      onParsed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSVの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="csv-uploader">
      <h3 className="section-title">① CSVアップロード</h3>
      <div
        className={`drop-zone ${dragOver ? 'drop-zone-active' : ''} ${loading ? 'drop-zone-loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        {loading ? (
          <div className="drop-zone-content">
            <div className="spinner" />
            <p>読み込み中...</p>
          </div>
        ) : (
          <div className="drop-zone-content">
            <div className="drop-icon">📁</div>
            <p className="drop-main">調整さんCSVをここにドロップ</p>
            <p className="drop-sub">またはタップして選択</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleChange}
          hidden
        />
      </div>
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default CsvUploader;

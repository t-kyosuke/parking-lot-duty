import React, { useState } from 'react';
import { COACH_ORDER, VIDEO_COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';
import {
  getParkingCounts, saveParkingCounts,
  getVideoCounts, saveVideoCounts,
  getParkingPointer, saveParkingPointer,
  getVideoPointer, saveVideoPointer,
  saveAdminPassword,
  exportAllData, importAllData, resetAllData,
  getGithubToken, saveGithubToken,
} from '../lib/storage';

interface SettingsProps {
  onDataChange: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onDataChange }) => {
  const [parkingPointer, setParkingPointer] = useState(getParkingPointer());
  const [videoPointer, setVideoPointer] = useState(getVideoPointer());
  const [parkingCounts, setParkingCounts] = useState(getParkingCounts());
  const [videoCounts, setVideoCounts] = useState(getVideoCounts());

  const [newPassword, setNewPassword] = useState('');
  const [githubToken, setGithubToken] = useState(getGithubToken());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleParkingPointerChange = (val: number) => {
    setParkingPointer(val);
    saveParkingPointer(val);
    onDataChange();
    showToast('駐車場の次回開始位置を更新しました');
  };

  const handleVideoPointerChange = (val: number) => {
    setVideoPointer(val);
    saveVideoPointer(val);
    onDataChange();
    showToast('ビデオの次回開始位置を更新しました');
  };

  const handleParkingCountChange = (coach: string, value: number) => {
    const newCounts = { ...parkingCounts, [coach]: Math.max(0, value) };
    setParkingCounts(newCounts);
    saveParkingCounts(newCounts);
    onDataChange();
  };

  const handleVideoCountChange = (coach: string, value: number) => {
    const newCounts = { ...videoCounts, [coach]: Math.max(0, value) };
    setVideoCounts(newCounts);
    saveVideoCounts(newCounts);
    onDataChange();
  };

  const handleGithubTokenSave = () => {
    saveGithubToken(githubToken.trim());
    showToast('GitHubトークンを保存しました');
  };

  const handlePasswordChange = () => {
    if (newPassword.length < 3) {
      showToast('パスワードは3文字以上にしてください');
      return;
    }
    saveAdminPassword(newPassword);
    setNewPassword('');
    showToast('パスワードを変更しました');
  };

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `srs-duty-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('データをエクスポートしました');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importAllData(reader.result as string);
        onDataChange();
        showToast('データをインポートしました');
        setParkingPointer(getParkingPointer());
        setVideoPointer(getVideoPointer());
        setParkingCounts(getParkingCounts());
        setVideoCounts(getVideoCounts());
      } catch {
        showToast('インポートに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('全データを削除してリセットしますか？この操作は取り消せません。')) {
      resetAllData();
      onDataChange();
      setParkingPointer(0);
      setVideoPointer(0);
      setParkingCounts({});
      setVideoCounts({});
      showToast('全データをリセットしました');
      // ページを再読み込みして確実にクリーンな状態にする
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <div className="settings">
      {toast && <div className="toast">{toast}</div>}

      {/* GitHub連携 */}
      <div className="settings-section">
        <h3 className="section-title">📡 GitHub連携（公開設定）</h3>
        <p className="settings-desc">スマホで当番を確認できるようにするための設定です。GitHubのPersonal Access Tokenを入力してください。</p>
        <div className="password-change">
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          />
          <button className="btn btn-primary" onClick={handleGithubTokenSave}>
            保存
          </button>
        </div>
        {getGithubToken() && (
          <p className="settings-token-status">✅ トークン設定済み</p>
        )}
      </div>

      {/* 駐車場：次回開始位置 */}
      <div className="settings-section">
        <h3 className="section-title">🅿️ 駐車場当番 - 次回開始位置</h3>
        <select
          className="settings-select"
          value={parkingPointer}
          onChange={(e) => handleParkingPointerChange(Number(e.target.value))}
        >
          {COACH_ORDER.map((coach, idx) => (
            <option key={coach} value={idx}>
              {COACH_LAST_NAMES[coach]}さん（{idx + 1}番目）
            </option>
          ))}
        </select>
      </div>

      {/* ビデオ：次回開始位置 */}
      <div className="settings-section">
        <h3 className="section-title">🎥 ビデオ当番 - 次回開始位置</h3>
        <select
          className="settings-select"
          value={videoPointer}
          onChange={(e) => handleVideoPointerChange(Number(e.target.value))}
        >
          {VIDEO_COACH_ORDER.map((coach, idx) => (
            <option key={coach} value={idx}>
              {COACH_LAST_NAMES[coach]}さん（{idx + 1}番目）
            </option>
          ))}
        </select>
      </div>

      {/* 駐車場：累計回数 */}
      <div className="settings-section">
        <h3 className="section-title">🅿️ 駐車場当番 - 累計回数の調整</h3>
        <div className="count-edit-grid">
          {COACH_ORDER.map(coach => (
            <div key={coach} className="count-edit-row">
              <span>{COACH_LAST_NAMES[coach]}</span>
              <div className="count-edit-controls">
                <button
                  className="btn btn-xs"
                  onClick={() => handleParkingCountChange(coach, (parkingCounts[coach] || 0) - 1)}
                >−</button>
                <span className="count-edit-num">{parkingCounts[coach] || 0}</span>
                <button
                  className="btn btn-xs"
                  onClick={() => handleParkingCountChange(coach, (parkingCounts[coach] || 0) + 1)}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ビデオ：累計回数 */}
      <div className="settings-section">
        <h3 className="section-title">🎥 ビデオ当番 - 累計回数の調整</h3>
        <div className="count-edit-grid">
          {VIDEO_COACH_ORDER.map(coach => (
            <div key={coach} className="count-edit-row">
              <span>{COACH_LAST_NAMES[coach]}</span>
              <div className="count-edit-controls">
                <button
                  className="btn btn-xs"
                  onClick={() => handleVideoCountChange(coach, (videoCounts[coach] || 0) - 1)}
                >−</button>
                <span className="count-edit-num">{videoCounts[coach] || 0}</span>
                <button
                  className="btn btn-xs"
                  onClick={() => handleVideoCountChange(coach, (videoCounts[coach] || 0) + 1)}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* パスワード変更 */}
      <div className="settings-section">
        <h3 className="section-title">パスワード変更</h3>
        <div className="password-change">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新しいパスワード"
          />
          <button className="btn btn-primary" onClick={handlePasswordChange}>
            変更
          </button>
        </div>
      </div>

      {/* データ管理 */}
      <div className="settings-section">
        <h3 className="section-title">データ管理</h3>
        <div className="data-buttons">
          <button className="btn btn-secondary" onClick={handleExport}>
            📤 エクスポート（JSON）
          </button>
          <label className="btn btn-secondary">
            📥 インポート（JSON）
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>
          <button className="btn btn-danger" onClick={handleReset}>
            🗑 全データリセット
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

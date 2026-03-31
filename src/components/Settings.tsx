import React, { useState } from 'react';
import { COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';
import {
  getCumulativeCounts, saveCumulativeCounts,
  getPointer, savePointer,
  saveAdminPassword,
  exportAllData, importAllData, resetAllData,
} from '../lib/storage';

interface SettingsProps {
  onDataChange: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onDataChange }) => {
  const [pointer, setPointer] = useState(getPointer());
  const [counts, setCounts] = useState(getCumulativeCounts());

  const [newPassword, setNewPassword] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handlePointerChange = (val: number) => {
    setPointer(val);
    savePointer(val);
    onDataChange();
    showToast('次回開始位置を更新しました');
  };

  const handleCountChange = (coach: string, value: number) => {
    const newCounts = { ...counts, [coach]: Math.max(0, value) };
    setCounts(newCounts);
    saveCumulativeCounts(newCounts);
    onDataChange();
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
    a.download = `srs-parking-data-${new Date().toISOString().slice(0, 10)}.json`;
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
        // 状態をリフレッシュ
        setPointer(getPointer());
        setCounts(getCumulativeCounts());
      } catch (err) {
        showToast('インポートに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm('全データを削除してリセットしますか？この操作は取り消せません。')) {
      resetAllData();
      onDataChange();
      setPointer(0);
      setCounts({});
      showToast('全データをリセットしました');
    }
  };

  return (
    <div className="settings">
      {toast && <div className="toast">{toast}</div>}

      {/* 次回開始位置 */}
      <div className="settings-section">
        <h3 className="section-title">次回開始位置</h3>
        <select
          className="settings-select"
          value={pointer}
          onChange={(e) => handlePointerChange(Number(e.target.value))}
        >
          {COACH_ORDER.map((coach, idx) => (
            <option key={coach} value={idx}>
              {COACH_LAST_NAMES[coach]}さん（{idx + 1}番目）
            </option>
          ))}
        </select>
      </div>

      {/* 累計回数の手動調整 */}
      <div className="settings-section">
        <h3 className="section-title">累計担当回数の調整</h3>
        <div className="count-edit-grid">
          {COACH_ORDER.map(coach => (
            <div key={coach} className="count-edit-row">
              <span>{COACH_LAST_NAMES[coach]}</span>
              <div className="count-edit-controls">
                <button
                  className="btn btn-xs"
                  onClick={() => handleCountChange(coach, (counts[coach] || 0) - 1)}
                >−</button>
                <span className="count-edit-num">{counts[coach] || 0}</span>
                <button
                  className="btn btn-xs"
                  onClick={() => handleCountChange(coach, (counts[coach] || 0) + 1)}
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

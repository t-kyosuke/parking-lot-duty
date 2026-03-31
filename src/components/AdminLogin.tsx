import React, { useState } from 'react';
import { verifyPassword } from '../lib/storage';

interface AdminLoginProps {
  onLogin: () => void;
  onCancel: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyPassword(password)) {
      sessionStorage.setItem('srs_admin_auth', 'true');
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword('');
    }
  };

  return (
    <div className="login-overlay">
      <div className={`login-card ${shake ? 'shake' : ''}`}>
        <div className="login-icon">🔐</div>
        <h2>管理者ログイン</h2>
        <p className="login-desc">管理機能にアクセスするにはパスワードを入力してください</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="パスワード"
              autoFocus
              className={error ? 'input-error' : ''}
            />
            {error && <p className="error-text">パスワードが正しくありません</p>}
          </div>
          <div className="login-buttons">
            <button type="submit" className="btn btn-primary">
              ログイン
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              戻る
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

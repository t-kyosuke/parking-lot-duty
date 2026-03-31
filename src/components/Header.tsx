import React from 'react';

interface HeaderProps {
  isAdmin: boolean;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isAdmin, onLogout }) => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-title">
          <img
            src="/parking-lot-duty/srs-logo.png"
            alt="SRS ロゴ"
            className="header-logo"
          />
          <div>
            <h1>SRS 駐車場当番</h1>
            <p className="header-subtitle">吹田ラグビースクール</p>
          </div>
        </div>
        {isAdmin && onLogout && (
          <button className="btn btn-outline btn-sm" onClick={onLogout}>
            ログアウト
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;

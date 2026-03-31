import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import PublicView from './components/PublicView';
import AdminLogin from './components/AdminLogin';
import AdminView from './components/AdminView';
import './App.css';

type AppMode = 'public' | 'login' | 'admin';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('public');

  // セッション復帰チェック
  useEffect(() => {
    if (sessionStorage.getItem('srs_admin_auth') === 'true') {
      setMode('admin');
    }
  }, []);

  const handleAdminClick = () => setMode('login');
  const handleLogin = () => setMode('admin');
  const handleLogout = () => {
    sessionStorage.removeItem('srs_admin_auth');
    setMode('public');
  };
  const handleLoginCancel = () => setMode('public');

  return (
    <div className="app">
      <Header isAdmin={mode === 'admin'} onLogout={handleLogout} />

      <main className="app-main">
        {mode === 'public' && <PublicView onAdminClick={handleAdminClick} />}
        {mode === 'login' && <AdminLogin onLogin={handleLogin} onCancel={handleLoginCancel} />}
        {mode === 'admin' && <AdminView />}
      </main>

      <footer className="app-footer">
        <p>SRS Parking Lot Duty © 2026</p>
      </footer>
    </div>
  );
};

export default App;

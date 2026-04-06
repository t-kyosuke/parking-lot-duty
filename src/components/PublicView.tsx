import React, { useState, useMemo, useEffect } from 'react';
import { MONTHS, COACH_LAST_NAMES, DAY_TYPE_LABELS, DEFAULT_SCHEDULE } from '../lib/constants';
import type { DayType } from '../lib/constants';
import { getAllMonthlyData, getSchedule, fetchPublishedData } from '../lib/storage';
import type { MonthlyData } from '../lib/storage';

const HERO_IMAGES = Array.from({ length: 14 }, (_, i) => `/parking-lot-duty/hero-${i + 1}.jpg`);

const PublicView: React.FC<{ onAdminClick: () => void }> = ({ onAdminClick }) => {
  const [heroImage] = React.useState<string>(
    () => HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)]
  );
  // 現在の月を年度ベースで判定
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1; // 1-12
  const initialMonth = `${currentMonthNum}月`;
  const initialIdx = MONTHS.indexOf(initialMonth);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(initialIdx >= 0 ? initialIdx : 0);

  const selectedMonth = MONTHS[selectedMonthIdx];
  const monthNum = parseInt(selectedMonth.replace('月', ''), 10);

  // GitHub公開データ（スマホ対応）
  const [remoteAllData, setRemoteAllData] = useState<Record<string, MonthlyData> | null>(null);
  const [remoteSchedule, setRemoteSchedule] = useState<typeof DEFAULT_SCHEDULE | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(true);

  useEffect(() => {
    fetchPublishedData().then(published => {
      if (published) {
        setRemoteAllData(published.monthlyData);
        setRemoteSchedule(published.schedule);
      }
      setLoadingRemote(false);
    });
  }, []);

  // ローカルデータ優先（管理者PCでは最新のlocalStorage、スマホではリモート）
  const localAllData = getAllMonthlyData();
  const localSchedule = getSchedule();
  const hasLocalData = Object.keys(localAllData).length > 0;
  const allData = hasLocalData ? localAllData : (remoteAllData ?? {});
  const monthData = allData[selectedMonth];
  const savedSchedule = hasLocalData ? localSchedule : (remoteSchedule ?? []);

  // スケジュールデータ：確定済み月データがあればそちらを優先（CSVの土曜等も含む）
  const schedule = useMemo(() => {
    if (monthData?.confirmed && monthData.schedule.length > 0) {
      return monthData.schedule;
    }
    const source = savedSchedule.length > 0 ? savedSchedule : DEFAULT_SCHEDULE;
    return source.filter(d => {
      const m = parseInt(d.date.split('/')[0], 10);
      return m === monthNum;
    });
  }, [savedSchedule, monthNum, monthData]);

  // 今日の日付文字列 "M/D"
  const todayStr = `${now.getMonth() + 1}/${now.getDate()}`;

  const handlePrevMonth = () => {
    setSelectedMonthIdx(prev => (prev > 0 ? prev - 1 : MONTHS.length - 1));
  };
  const handleNextMonth = () => {
    setSelectedMonthIdx(prev => (prev < MONTHS.length - 1 ? prev + 1 : 0));
  };

  // 割り当てデータがあるか
  const hasAssignments = monthData?.confirmed && monthData.assignments.length > 0;

  return (
    <div className="public-view">
      {/* ヒーローバナー */}
      <div className="hero-banner" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-motto">勇気・希望・団結</p>
          <h2 className="hero-title">SUITA RUGBY SCHOOL</h2>
        </div>
      </div>

      {/* 月選択 */}
      <div className="month-selector">
        <button className="month-nav-btn" onClick={handlePrevMonth}>
          <span>◀</span>
        </button>
        <div className="month-display">
          <span className="month-year">2026年度</span>
          <span className="month-name">{selectedMonth}</span>
        </div>
        <button className="month-nav-btn" onClick={handleNextMonth}>
          <span>▶</span>
        </button>
      </div>

      {/* 当番スケジュール */}
      <div className="schedule-card">
        <h2 className="schedule-title">
          <span className="schedule-icon">📅</span>
          当番スケジュール
        </h2>

        {loadingRemote ? (
          <div className="no-data">
            <div className="no-data-icon">⏳</div>
            <p>読み込み中...</p>
          </div>
        ) : hasAssignments ? (
          <div className="assignment-list">
            {schedule.map((day) => {
              const assignment = monthData.assignments.find(a => a.date === day.date);
              const isToday = day.date === todayStr;
              const isPractice = day.type === 'practice' || day.type === 'special';
              const isSaturday = assignment?.isSaturday || day.dayOfWeek === '土';
              const parkingName = assignment?.coach
                ? COACH_LAST_NAMES[assignment.coach] || assignment.coach
                : null;
              const videoName = assignment?.videoCoach
                ? COACH_LAST_NAMES[assignment.videoCoach] || assignment.videoCoach
                : null;

              return (
                <div
                  key={day.date}
                  className={`schedule-row ${isToday ? 'schedule-row-today' : ''} ${!isPractice ? 'schedule-row-inactive' : ''}`}
                >
                  <div className="schedule-date">
                    <span className="date-num">{day.date}</span>
                    <span className={`date-dow ${day.dayOfWeek === '祝' ? 'date-holiday' : ''}`}>
                      ({day.dayOfWeek})
                    </span>
                  </div>
                  <div className="schedule-time">
                    {day.practiceTime || '—'}
                  </div>
                  <div className="schedule-coach">
                    {isPractice ? (
                      <div className="duty-display">
                        <span className="duty-line">
                          <span className="duty-line-label">駐車場▶</span>
                          <span className="duty-line-value">
                            {isSaturday ? <span className="duty-none">ー</span> : parkingName ? <span className="coach-badge">{parkingName}さん</span> : <span className="no-coach">未定</span>}
                          </span>
                        </span>
                        <span className="duty-line">
                          <span className="duty-line-label">ビデオ▶</span>
                          <span className="duty-line-value">
                            {videoName ? <span className="coach-badge">{videoName}さん</span> : <span className="no-coach">未定</span>}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <span className="day-type-badge">
                        {getTypeIcon(day.type)} {DAY_TYPE_LABELS[day.type]}
                      </span>
                    )}
                  </div>
                  {isToday && <span className="today-marker">TODAY</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-data">
            <div className="no-data-icon">📋</div>
            <p>まだ決まっていません</p>
            <p className="no-data-sub">管理者が当番を割り当てるとここに表示されます</p>
          </div>
        )}
      </div>

      {/* お知らせ */}
      <div className="public-notice">
        <p className="public-notice-main">🅿️🎥 今月の当番は上記の通りです。</p>
        <p className="public-notice-sub">
          駐車場当番の役割を終えたコーチは、<strong>黄色のうちわ＆カゴセット</strong>を<br />
          次の駐車場当番の方にお渡しください！
        </p>
        <p className="public-notice-note">※ 空気入れの充電もお願いいたします。</p>
      </div>

      {/* 管理者ログインボタン */}
      <div className="admin-login-area">
        <button className="admin-login-btn" onClick={onAdminClick}>
          🔒 管理者ログイン
        </button>
      </div>
    </div>
  );
};

function getTypeIcon(type: DayType): string {
  switch (type) {
    case 'match': return '⚽';
    case 'camp': return '🏕️';
    case 'off': return '💤';
    case 'special': return '🎌';
    default: return '';
  }
}

export default PublicView;

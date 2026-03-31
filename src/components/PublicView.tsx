import React, { useState, useMemo } from 'react';
import { MONTHS, COACH_LAST_NAMES, DAY_TYPE_LABELS, DEFAULT_SCHEDULE } from '../lib/constants';
import type { DayType } from '../lib/constants';
import { getAllMonthlyData, getSchedule } from '../lib/storage';

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

  // 保存済みデータを取得
  const allData = getAllMonthlyData();
  const monthData = allData[selectedMonth];
  const savedSchedule = getSchedule();

  // スケジュールデータ（保存済みまたはデフォルト）
  const schedule = useMemo(() => {
    const source = savedSchedule.length > 0 ? savedSchedule : DEFAULT_SCHEDULE;
    return source.filter(d => {
      const m = parseInt(d.date.split('/')[0], 10);
      return m === monthNum;
    });
  }, [savedSchedule, monthNum]);

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
          駐車場当番スケジュール
        </h2>

        {hasAssignments ? (
          <div className="assignment-list">
            {schedule.map((day) => {
              const assignment = monthData.assignments.find(a => a.date === day.date);
              const isToday = day.date === todayStr;
              const isPractice = day.type === 'practice' || day.type === 'special';
              const coachName = assignment?.coach
                ? COACH_LAST_NAMES[assignment.coach] || assignment.coach
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
                      coachName ? (
                        <span className="coach-badge">{coachName}さん</span>
                      ) : (
                        <span className="no-coach">未定</span>
                      )
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
        今月の駐車場当番は上記の通りです。役割を終えたコーチは、黄色うちわ&カゴセットを次の担当の方にお渡しください！※空気入れの充電もお願いいたします。
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

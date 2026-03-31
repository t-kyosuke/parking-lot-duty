import React, { useState } from 'react';
import { COACH_ORDER, COACH_LAST_NAMES, DAY_TYPE_LABELS } from '../lib/constants';
import type { AttendanceStatus, DayType } from '../lib/constants';
import type { ParsedCsvData } from '../lib/parseCsv';

interface AttendancePreviewProps {
  csvData: ParsedCsvData;
  schedule: Array<{ date: string; dayOfWeek: string; type: DayType; practiceTime: string }>;
  onConfirm: (
    attendance: Record<string, Record<string, AttendanceStatus>>,
    schedule: Array<{ date: string; dayOfWeek: string; type: DayType; practiceTime: string }>
  ) => void;
}

const AttendancePreview: React.FC<AttendancePreviewProps> = ({ csvData, schedule: initialSchedule, onConfirm }) => {
  const [attendance, setAttendance] = useState(csvData.attendance);
  const [schedule, setSchedule] = useState(initialSchedule);

  const toggleAttendance = (date: string, coach: string) => {
    setAttendance(prev => {
      const current = prev[date]?.[coach] || '△';
      const next: AttendanceStatus = current === '◯' ? '△' : current === '△' ? '×' : '◯';
      return {
        ...prev,
        [date]: { ...prev[date], [coach]: next },
      };
    });
  };

  const updateDayType = (date: string, type: DayType) => {
    setSchedule(prev => prev.map(d => d.date === date ? { ...d, type } : d));
  };

  const updatePracticeTime = (date: string, time: string) => {
    setSchedule(prev => prev.map(d => d.date === date ? { ...d, practiceTime: time } : d));
  };

  const getStatusClass = (status: AttendanceStatus) => {
    switch (status) {
      case '◯': return 'cell-ok';
      case '△': return 'cell-maybe';
      case '×': return 'cell-no';
    }
  };

  return (
    <div className="attendance-preview">
      <h3 className="section-title">② 出欠プレビュー & 日程設定</h3>

      {csvData.duplicateDays.length > 0 && (
        <div className="warning-banner">
          ⚠️ 同日複数行が検出されました（最初の行を使用）：{csvData.duplicateDays.join(', ')}
        </div>
      )}

      {/* 日程種別設定 */}
      <div className="schedule-settings">
        <h4>日程種別 & 練習時間</h4>
        <div className="schedule-type-list">
          {schedule.map(day => (
            <div key={day.date} className={`schedule-type-row ${day.type !== 'practice' && day.type !== 'special' ? 'inactive' : ''}`}>
              <span className="schedule-type-date">{day.date}({day.dayOfWeek})</span>
              <select
                className="schedule-type-select"
                value={day.type}
                onChange={(e) => updateDayType(day.date, e.target.value as DayType)}
              >
                {Object.entries(DAY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <input
                className="schedule-time-input"
                type="text"
                value={day.practiceTime}
                onChange={(e) => updatePracticeTime(day.date, e.target.value)}
                placeholder="時間"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 出欠テーブル */}
      <div className="attendance-table-wrapper">
        <table className="attendance-table">
          <thead>
            <tr>
              <th className="sticky-col">日程</th>
              {COACH_ORDER.map(coach => (
                <th key={coach}>{COACH_LAST_NAMES[coach]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule
              .filter(d => d.type === 'practice' || d.type === 'special')
              .map(day => (
                <tr key={day.date}>
                  <td className="sticky-col date-cell">
                    {day.date}({day.dayOfWeek})
                  </td>
                  {COACH_ORDER.map(coach => {
                    const status = attendance[day.date]?.[coach] || '△';
                    return (
                      <td
                        key={coach}
                        className={`attendance-cell ${getStatusClass(status)}`}
                        onClick={() => toggleAttendance(day.date, coach)}
                      >
                        {status}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="help-text">※ セルをタップして ◯→△→× を切り替えられます</p>

      <button
        className="btn btn-primary btn-lg"
        onClick={() => onConfirm(attendance, schedule)}
      >
        ✅ この出欠データを使う
      </button>
    </div>
  );
};

export default AttendancePreview;

import React, { useState } from 'react';
import { COACH_ORDER, VIDEO_COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';
import type { AssignmentResult } from '../lib/assignParking';
import { addChangeHistory } from '../lib/storage';

interface AssignmentResultProps {
  results: AssignmentResult[];
  month: string;
  onUpdate: (results: AssignmentResult[]) => void;
}

const AssignmentResultView: React.FC<AssignmentResultProps> = ({ results, month, onUpdate }) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'parking' | 'video' | null>(null);

  const handleChange = (idx: number, field: 'parking' | 'video', newCoach: string) => {
    const original = results[idx];
    const updated = [...results];

    if (field === 'parking') {
      const oldCoach = original.coach;
      updated[idx] = { ...original, coach: newCoach || null };
      if (oldCoach) {
        addChangeHistory({
          date: original.date, month,
          originalCoach: oldCoach, newCoach: newCoach || '未定',
          dutyType: 'parking', changedAt: new Date().toISOString(),
        });
      }
    } else {
      const oldCoach = original.videoCoach;
      updated[idx] = { ...original, videoCoach: newCoach || null };
      if (oldCoach) {
        addChangeHistory({
          date: original.date, month,
          originalCoach: oldCoach, newCoach: newCoach || '未定',
          dutyType: 'video', changedAt: new Date().toISOString(),
        });
      }
    }

    onUpdate(updated);
    setEditingIdx(null);
    setEditingField(null);
  };

  const startEdit = (idx: number, field: 'parking' | 'video') => {
    setEditingIdx(idx);
    setEditingField(field);
  };

  return (
    <div className="assignment-result">
      <h3 className="section-title">④ 割り当て結果</h3>
      <div className="result-list">
        {results.map((r, idx) => (
          <div key={r.date} className="result-row result-row-dual">
            <div className="result-date">
              <span>{r.date}({r.dayOfWeek})</span>
              {r.practiceTime && <span className="result-time">{r.practiceTime}</span>}
            </div>
            <div className="result-duties">
              {/* 駐車場当番 */}
              <div className="result-duty">
                <span className="duty-label">駐車場▶</span>
                {r.isSaturday ? (
                  <span className="coach-name-result duty-none">-</span>
                ) : editingIdx === idx && editingField === 'parking' ? (
                  <select
                    className="coach-select"
                    value={r.coach || ''}
                    onChange={(e) => handleChange(idx, 'parking', e.target.value)}
                    onBlur={() => { setEditingIdx(null); setEditingField(null); }}
                    autoFocus
                  >
                    <option value="">（未定）</option>
                    {COACH_ORDER.map(coach => (
                      <option key={coach} value={coach}>
                        {COACH_LAST_NAMES[coach]}さん
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <span className="coach-name-result">
                      {r.coach ? `${COACH_LAST_NAMES[r.coach]}さん` : '該当者なし'}
                    </span>
                    <button className="btn btn-xs btn-ghost" onClick={() => startEdit(idx, 'parking')}>✏️</button>
                  </>
                )}
              </div>
              {/* ビデオ当番 */}
              <div className="result-duty">
                <span className="duty-label">ビデオ▶</span>
                {editingIdx === idx && editingField === 'video' ? (
                  <select
                    className="coach-select"
                    value={r.videoCoach || ''}
                    onChange={(e) => handleChange(idx, 'video', e.target.value)}
                    onBlur={() => { setEditingIdx(null); setEditingField(null); }}
                    autoFocus
                  >
                    <option value="">（未定）</option>
                    {VIDEO_COACH_ORDER.map(coach => (
                      <option key={coach} value={coach}>
                        {COACH_LAST_NAMES[coach]}さん
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <span className="coach-name-result">
                      {r.videoCoach ? `${COACH_LAST_NAMES[r.videoCoach]}さん` : '該当者なし'}
                    </span>
                    <button className="btn btn-xs btn-ghost" onClick={() => startEdit(idx, 'video')}>✏️</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssignmentResultView;

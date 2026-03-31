import React, { useState } from 'react';
import { COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';
import type { AssignmentResult } from '../lib/assignParking';
import { addChangeHistory } from '../lib/storage';

interface AssignmentResultProps {
  results: AssignmentResult[];
  month: string;
  onUpdate: (results: AssignmentResult[]) => void;
}

const AssignmentResultView: React.FC<AssignmentResultProps> = ({ results, month, onUpdate }) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleChange = (idx: number, newCoach: string) => {
    const original = results[idx];
    const updated = [...results];
    updated[idx] = { ...original, coach: newCoach || null };

    if (original.coach) {
      addChangeHistory({
        date: original.date,
        month,
        originalCoach: original.coach,
        newCoach: newCoach || '未定',
        changedAt: new Date().toISOString(),
      });
    }

    onUpdate(updated);
    setEditingIdx(null);
  };

  return (
    <div className="assignment-result">
      <h3 className="section-title">④ 割り当て結果</h3>
      <div className="result-list">
        {results.map((r, idx) => (
          <div key={r.date} className="result-row">
            <div className="result-date">
              <span>{r.date}({r.dayOfWeek})</span>
              {r.practiceTime && <span className="result-time">{r.practiceTime}</span>}
            </div>
            <div className="result-coach">
              {editingIdx === idx ? (
                <select
                  className="coach-select"
                  value={r.coach || ''}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onBlur={() => setEditingIdx(null)}
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
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => setEditingIdx(idx)}
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssignmentResultView;

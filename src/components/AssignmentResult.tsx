import React, { useState } from 'react';
import { COACH_ORDER, VIDEO_COACH_ORDER, KAGO_COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';
import { computeKagoTakeHome } from '../lib/assignParking';
import type { AssignmentResult } from '../lib/assignParking';
import { addChangeHistory } from '../lib/storage';

interface AssignmentResultProps {
  results: AssignmentResult[];
  month: string;
  onUpdate: (results: AssignmentResult[]) => void;
}

const AssignmentResultView: React.FC<AssignmentResultProps> = ({ results, month, onUpdate }) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'parking' | 'video' | 'kago' | null>(null);

  // 各カゴ利用日の「その日の練習後に持ち帰る人」（＝次のカゴ利用日の担当者）
  const takeHomeMap = computeKagoTakeHome(results);

  // 「→終わりに ◯◯さん が持ち帰り」の補足テキスト（無ければ null）
  const takeHomeHint = (r: AssignmentResult): string | null => {
    const th = takeHomeMap[r.date];
    if (!th) return null;
    if (th.carryToNextMonth) return '→終わりに 翌月へ引き継ぎ';
    if (th.needsConfirm) return `→終わりに 要確認${th.holder ? `（今カゴ: ${COACH_LAST_NAMES[th.holder] || th.holder}さん）` : ''}`;
    if (th.coach) return `→終わりに ${COACH_LAST_NAMES[th.coach] || th.coach}さん が持ち帰り`;
    return '→終わりに 未定';
  };

  const handleChange = (idx: number, field: 'parking' | 'video' | 'kago', newCoach: string) => {
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
    } else if (field === 'video') {
      const oldCoach = original.videoCoach;
      updated[idx] = { ...original, videoCoach: newCoach || null };
      if (oldCoach) {
        addChangeHistory({
          date: original.date, month,
          originalCoach: oldCoach, newCoach: newCoach || '未定',
          dutyType: 'video', changedAt: new Date().toISOString(),
        });
      }
    } else {
      const oldCoach = original.kagoCoach;
      // 手動でカゴ係を指定＝明示的な指名。兼任扱い・要確認は解除し、累計に数える対象にする
      updated[idx] = {
        ...original,
        kagoCoach: newCoach || null,
        kagoCarriedByParking: false,
        kagoNeedsConfirm: false,
      };
      if (oldCoach) {
        addChangeHistory({
          date: original.date, month,
          originalCoach: oldCoach, newCoach: newCoach || '未定',
          dutyType: 'kago', changedAt: new Date().toISOString(),
        });
      }
    }

    onUpdate(updated);
    setEditingIdx(null);
    setEditingField(null);
  };

  const startEdit = (idx: number, field: 'parking' | 'video' | 'kago') => {
    setEditingIdx(idx);
    setEditingField(field);
  };

  // カゴ欄（試合日・練習日の両方で使う）。「持ってくる人」を編集でき、下に「持ち帰り」を補足表示
  const kagoCell = (idx: number, r: AssignmentResult, label: string) => (
    <>
    <div className="result-duty">
      <span className="duty-label">{label}</span>
      {editingIdx === idx && editingField === 'kago' ? (
        <select
          className="coach-select"
          value={r.kagoCoach || ''}
          onChange={(e) => handleChange(idx, 'kago', e.target.value)}
          onBlur={() => { setEditingIdx(null); setEditingField(null); }}
          autoFocus
        >
          <option value="">（未定）</option>
          {KAGO_COACH_ORDER.map(coach => (
            <option key={coach} value={coach}>
              {COACH_LAST_NAMES[coach]}さん
            </option>
          ))}
        </select>
      ) : (
        <>
          <span className={`coach-name-result ${r.kagoNeedsConfirm ? 'kago-needs-confirm' : ''}`}>
            {r.kagoCoach
              ? `${COACH_LAST_NAMES[r.kagoCoach]}さん`
              : r.kagoNeedsConfirm
                ? `⚠️要確認${r.kagoHolder ? `（今カゴ: ${COACH_LAST_NAMES[r.kagoHolder] || r.kagoHolder}さん）` : ''}`
                : '該当者なし'}
          </span>
          <button className="btn btn-xs btn-ghost" onClick={() => startEdit(idx, 'kago')}>✏️</button>
        </>
      )}
    </div>
    {takeHomeHint(r) && <div className="kago-takehome-hint">{takeHomeHint(r)}</div>}
    </>
  );

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
              {r.isMatch ? (
                /* カゴ当番（試合日） */
                kagoCell(idx, r, '⚽試合 🧺カゴを持ってくる人▶')
              ) : (
                <>
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
                  {/* カゴ：毎回出す（日曜で駐車場当番が持つ日も、その人の名前を表示） */}
                  {(r.kagoNeedsConfirm || r.kagoCoach) && kagoCell(idx, r, '🧺カゴを持ってくる人▶')}
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

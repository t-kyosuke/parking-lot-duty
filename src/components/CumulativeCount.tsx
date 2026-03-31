import React from 'react';
import { COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';

interface CumulativeCountProps {
  counts: Record<string, number>;
  nextPointer: number;
}

const CumulativeCount: React.FC<CumulativeCountProps> = ({ counts, nextPointer }) => {
  const values = COACH_ORDER.map(c => counts[c] || 0);
  const maxCount = Math.max(...values, 1);
  const minCount = Math.min(...values);

  const nextCoach = COACH_ORDER[nextPointer];

  return (
    <div className="cumulative-count">
      <h3 className="section-title">⑥ 累計担当回数</h3>
      <div className="count-grid">
        {COACH_ORDER.map((coach) => {
          const count = counts[coach] || 0;
          const isMax = count === maxCount && maxCount > minCount;
          const isMin = count === minCount && maxCount > minCount;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div
              key={coach}
              className={`count-row ${isMax ? 'count-max' : ''} ${isMin ? 'count-min' : ''}`}
            >
              <span className="count-name">{COACH_LAST_NAMES[coach]}</span>
              <div className="count-bar-wrapper">
                <div className="count-bar" style={{ width: `${barWidth}%` }} />
              </div>
              <span className="count-num">{count}回</span>
            </div>
          );
        })}
      </div>

      <div className="next-pointer">
        <span className="next-label">⑦ 次回の先頭候補：</span>
        <span className="next-coach">{COACH_LAST_NAMES[nextCoach]}さん</span>
      </div>
    </div>
  );
};

export default CumulativeCount;

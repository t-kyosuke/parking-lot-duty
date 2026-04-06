import React from 'react';
import { COACH_ORDER, VIDEO_COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';

interface CumulativeCountProps {
  parkingCounts: Record<string, number>;
  videoCounts: Record<string, number>;
  parkingPointer: number;
  videoPointer: number;
}

const CountChart: React.FC<{
  title: string;
  coachOrder: string[];
  counts: Record<string, number>;
  pointer: number;
  pointerLabel: string;
}> = ({ title, coachOrder, counts, pointer, pointerLabel }) => {
  const values = coachOrder.map(c => counts[c] || 0);
  const maxCount = Math.max(...values, 1);
  const minCount = Math.min(...values);
  const nextCoach = coachOrder[pointer];

  return (
    <div className="count-section">
      <h4 className="count-section-title">{title}</h4>
      <div className="count-grid">
        {coachOrder.map((coach) => {
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
        <span className="next-label">{pointerLabel}</span>
        <span className="next-coach">{nextCoach ? `${COACH_LAST_NAMES[nextCoach]}さん` : '—'}</span>
      </div>
    </div>
  );
};

const CumulativeCount: React.FC<CumulativeCountProps> = ({
  parkingCounts, videoCounts, parkingPointer, videoPointer,
}) => {
  return (
    <div className="cumulative-count">
      <h3 className="section-title">⑥ 累計担当回数</h3>
      <CountChart
        title="🅿️ 駐車場当番"
        coachOrder={COACH_ORDER}
        counts={parkingCounts}
        pointer={parkingPointer}
        pointerLabel="次回の駐車場先頭候補："
      />
      <CountChart
        title="🎥 ビデオ当番"
        coachOrder={VIDEO_COACH_ORDER}
        counts={videoCounts}
        pointer={videoPointer}
        pointerLabel="次回のビデオ先頭候補："
      />
    </div>
  );
};

export default CumulativeCount;

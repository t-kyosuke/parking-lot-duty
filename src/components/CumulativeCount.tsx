import React from 'react';
import { COACH_ORDER, VIDEO_COACH_ORDER, KAGO_COACH_ORDER, COACH_LAST_NAMES } from '../lib/constants';

interface CumulativeCountProps {
  parkingCounts: Record<string, number>;
  videoCounts: Record<string, number>;
  kagoCounts: Record<string, number>;
}

const CountChart: React.FC<{
  title: string;
  coachOrder: string[];
  counts: Record<string, number>;
  nextLabel: string;
}> = ({ title, coachOrder, counts, nextLabel }) => {
  const values = coachOrder.map(c => counts[c] || 0);
  const maxCount = Math.max(...values, 1);
  const minCount = Math.min(...values);

  // 次に優先されやすい人 ＝ 累計が最も少ない人（同数なら固定順で先頭）
  let nextCoach = coachOrder[0];
  for (const c of coachOrder) {
    if ((counts[c] || 0) < (counts[nextCoach] || 0)) nextCoach = c;
  }

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
        <span className="next-label">{nextLabel}</span>
        <span className="next-coach">{nextCoach ? `${COACH_LAST_NAMES[nextCoach]}さん` : '—'}</span>
      </div>
    </div>
  );
};

const CumulativeCount: React.FC<CumulativeCountProps> = ({
  parkingCounts, videoCounts, kagoCounts,
}) => {
  return (
    <div className="cumulative-count">
      <h3 className="section-title">⑥ 累計担当回数</h3>
      <CountChart
        title="🅿️ 駐車場当番"
        coachOrder={COACH_ORDER}
        counts={parkingCounts}
        nextLabel="次に優先されやすい人（回数が最少）："
      />
      <CountChart
        title="🎥 ビデオ当番"
        coachOrder={VIDEO_COACH_ORDER}
        counts={videoCounts}
        nextLabel="次に優先されやすい人（回数が最少）："
      />
      <CountChart
        title="🧺 カゴ当番（試合日）"
        coachOrder={KAGO_COACH_ORDER}
        counts={kagoCounts}
        nextLabel="次に優先されやすい人（回数が最少）："
      />
    </div>
  );
};

export default CumulativeCount;

import React, { useState } from 'react';
import { COACH_LAST_NAMES } from '../lib/constants';
import { computeKagoTakeHome } from '../lib/assignParking';
import type { AssignmentResult } from '../lib/assignParking';

interface LineAnnouncementProps {
  results: AssignmentResult[];
  month: string;
}

const LineAnnouncement: React.FC<LineAnnouncementProps> = ({ results, month }) => {
  const [copied, setCopied] = useState(false);

  const monthNum = month.replace('月', '');

  // 当番がある日のみ（駐車場・ビデオ・カゴのいずれか）。
  // 試合日(isMatch)はカゴが未定でも必ず出す（結果・閲覧画面と揃える）
  const assignedDays = results.filter(r => r.coach || r.videoCoach || r.kagoCoach || r.isMatch || r.kagoNeedsConfirm);

  // 各カゴ利用日の「その日の練習後にカゴを持ち帰る人」（＝次のカゴ利用日の担当者）
  const takeHomeMap = computeKagoTakeHome(results);

  // カゴ行に出す文字（＝その日の練習後に持ち帰る人）
  const kagoText = (r: AssignmentResult): string | null => {
    const th = takeHomeMap[r.date];
    if (!th) return null;
    if (th.carryToNextMonth) return '翌月へ引き継ぎ';
    if (th.needsConfirm) return `要確認${th.holder ? `（今カゴ:${COACH_LAST_NAMES[th.holder] || th.holder}さん）` : ''}`;
    if (th.coach) return `${COACH_LAST_NAMES[th.coach] || th.coach}さん`;
    return '未定';
  };

  const DOW_MAP: Record<string, string> = {
    '日': '日曜日', '月': '月曜日', '火': '火曜日', '水': '水曜日',
    '木': '木曜日', '金': '金曜日', '土': '土曜日', '祝': '祝日',
  };

  const text = `${monthNum}月の当番は下記でお願いします。

各日の「🧺当日カゴ持ち帰り」の人が、その練習後に黄色うちわ&カゴセットを持ち帰ります。

${assignedDays.map(r => {
    const parts = r.date.split('/');
    const m = parts[0];
    const d = parts[1];
    const dow = DOW_MAP[r.dayOfWeek] || r.dayOfWeek;
    if (r.isMatch) {
      return `${m}月${d}日（${dow}）⚽試合：🧺当日カゴ持ち帰り▶${kagoText(r) ?? '未定'}`;
    }
    const parkingName = r.isSaturday ? '-' : (r.coach ? `${COACH_LAST_NAMES[r.coach] || r.coach}さん` : '未定');
    const videoName = r.videoCoach ? `${COACH_LAST_NAMES[r.videoCoach] || r.videoCoach}さん` : '未定';
    // カゴ：その日の練習後に持ち帰る人（＝次のカゴ利用日の担当者）を毎回出す
    const kago = kagoText(r);
    const kagoPart = kago ? `　/　🧺当日カゴ持ち帰り▶${kago}` : '';
    return `${m}月${d}日（${dow}）：駐車場▶${parkingName}　/　ビデオ▶${videoName}${kagoPart}`;
  }).join('\n')}

よろしくお願いします。`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // フォールバック
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="line-announcement">
      <h3 className="section-title">⑤ LINEアナウンス</h3>
      <div className="announcement-preview">
        <pre>{text}</pre>
      </div>
      <button
        className={`btn btn-lg ${copied ? 'btn-success' : 'btn-accent'}`}
        onClick={handleCopy}
      >
        {copied ? '✅ コピーしました！' : '📋 LINEアナウンス用にコピー'}
      </button>
    </div>
  );
};

export default LineAnnouncement;

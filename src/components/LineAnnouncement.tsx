import React, { useState } from 'react';
import { COACH_LAST_NAMES } from '../lib/constants';
import type { AssignmentResult } from '../lib/assignParking';

interface LineAnnouncementProps {
  results: AssignmentResult[];
  month: string;
}

const LineAnnouncement: React.FC<LineAnnouncementProps> = ({ results, month }) => {
  const [copied, setCopied] = useState(false);

  const monthNum = month.replace('月', '');

  // 当番がある日のみ（駐車場またはビデオのどちらかがアサインされている日）
  const assignedDays = results.filter(r => r.coach || r.videoCoach);

  const DOW_MAP: Record<string, string> = {
    '日': '日曜日', '月': '月曜日', '火': '火曜日', '水': '水曜日',
    '木': '木曜日', '金': '金曜日', '土': '土曜日', '祝': '祝日',
  };

  const text = `${monthNum}月の当番は下記でお願いします。

終わられたコーチは黄色うちわ&カゴセットを次の担当に回していってください！

${assignedDays.map(r => {
    const parts = r.date.split('/');
    const m = parts[0];
    const d = parts[1];
    const dow = DOW_MAP[r.dayOfWeek] || r.dayOfWeek;
    const parkingName = r.isSaturday ? '-' : (r.coach ? `${COACH_LAST_NAMES[r.coach] || r.coach}さん` : '未定');
    const videoName = r.videoCoach ? `${COACH_LAST_NAMES[r.videoCoach] || r.videoCoach}さん` : '未定';
    return `${m}月${d}日（${dow}）：駐車場▶${parkingName}　/　ビデオ▶${videoName}`;
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

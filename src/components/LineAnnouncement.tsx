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

  // 当番がある日のみ（試合等は含めない）
  const assignedDays = results.filter(r => r.coach);

  const text = `駐車場当番🅿️${monthNum}月は下記でお願いします。
終わられたコーチは黄色うちわ&カゴセットを次の担当に回していってください！

${assignedDays.map(r => {
    const dayNum = r.date.split('/')[1];
    const lastName = r.coach ? COACH_LAST_NAMES[r.coach] || r.coach : '未定';
    return `${dayNum}日 ${lastName}さん`;
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

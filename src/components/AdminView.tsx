import React, { useState, useMemo, useCallback } from 'react';
import { MONTHS, COACH_ORDER, VIDEO_COACH_ORDER, KAGO_COACH_ORDER, DEFAULT_SCHEDULE } from '../lib/constants';
import type { AttendanceStatus, DayType } from '../lib/constants';
import { assignDuties, assignKagoChain } from '../lib/assignParking';
import type { AssignmentResult } from '../lib/assignParking';
import type { ParsedCsvData } from '../lib/parseCsv';
import {
  getMonthlyData, saveMonthlyData,
  getCountsForAssignment, getPreviousLastCoach, getPreviousKagoSession,
  getParkingCounts, getVideoCounts, getKagoCounts, recalculateCumulativeCounts,
  getSchedule, saveSchedule,
  getGithubToken, publishToGithub,
} from '../lib/storage';
import type { MonthlyData } from '../lib/storage';
import CsvUploader from './CsvUploader';
import AttendancePreview from './AttendancePreview';
import AssignmentResultView from './AssignmentResult';
import LineAnnouncement from './LineAnnouncement';
import CumulativeCount from './CumulativeCount';
import Settings from './Settings';

const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assign' | 'settings'>('assign');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);
  const [confirmedAttendance, setConfirmedAttendance] = useState<Record<string, Record<string, AttendanceStatus>> | null>(null);
  const [confirmedSchedule, setConfirmedSchedule] = useState<Array<{ date: string; dayOfWeek: string; type: DayType; practiceTime: string }> | null>(null);
  const [assignments, setAssignments] = useState<MonthlyData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handlePublish = async () => {
    const token = getGithubToken();
    if (!token) {
      showToast('⚙️ 設定タブでGitHubトークンを先に登録してください');
      return;
    }
    setPublishing(true);
    try {
      await publishToGithub(token);
      showToast('🌐 スマホでも見られるように公開しました！');
    } catch (e) {
      showToast(`❌ 公開に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}`);
    } finally {
      setPublishing(false);
    }
  };

  const selectedMonth = MONTHS[selectedMonthIdx];
  const monthNum = parseInt(selectedMonth.replace('月', ''), 10);

  // 保存済みデータ
  const savedData = useMemo(() => getMonthlyData(selectedMonth), [selectedMonth, refreshKey]);

  // スケジュール（保存済みまたはデフォルト）
  const currentSchedule = useMemo(() => {
    const saved = getSchedule();
    const source = saved.length > 0 ? saved : DEFAULT_SCHEDULE;
    return source.filter(d => {
      const m = parseInt(d.date.split('/')[0], 10);
      return m === monthNum;
    });
  }, [monthNum, refreshKey]);

  const handleCsvParsed = useCallback((data: ParsedCsvData) => {
    setCsvData(data);
    setConfirmedAttendance(null);
    setConfirmedSchedule(null);
    setAssignments(null);
  }, []);

  const handleAttendanceConfirm = useCallback((
    attendance: Record<string, Record<string, AttendanceStatus>>,
    schedule: Array<{ date: string; dayOfWeek: string; type: DayType; practiceTime: string }>
  ) => {
    setConfirmedAttendance(attendance);
    setConfirmedSchedule(schedule);

    // スケジュールを保存
    const allSchedule = getSchedule().length > 0 ? [...getSchedule()] : [...DEFAULT_SCHEDULE];
    for (const day of schedule) {
      const idx = allSchedule.findIndex(d => d.date === day.date);
      if (idx >= 0) {
        allSchedule[idx] = { ...allSchedule[idx], type: day.type, practiceTime: day.practiceTime };
      }
    }
    saveSchedule(allSchedule);
  }, []);

  const handleAssign = useCallback(() => {
    if (!confirmedAttendance || !confirmedSchedule) return;

    const byDate = (a: { date: string }, b: { date: string }) => {
      const [am, ad] = a.date.split('/').map(Number);
      const [bm, bd] = b.date.split('/').map(Number);
      return am !== bm ? am - bm : ad - bd;
    };

    // 駐車場・ビデオ：練習・運動会等の日（土曜も含む）。※ここは従来どおり・カゴで変えない
    const practiceDays = confirmedSchedule
      .filter(d => d.type === 'practice' || d.type === 'special')
      .map(d => ({ date: d.date, dayOfWeek: d.dayOfWeek, practiceTime: d.practiceTime }));

    // 過去から引き継ぐ累計（この月の確定分は除外）と、直前の当番者（連続防止の起点）
    const parkingCounts = getCountsForAssignment(selectedMonth, 'parking');
    const videoCounts = getCountsForAssignment(selectedMonth, 'video');
    const kagoCounts = getCountsForAssignment(selectedMonth, 'kago');
    const parkingLast = getPreviousLastCoach(selectedMonth, 'parking');
    const videoLast = getPreviousLastCoach(selectedMonth, 'video');

    // ① 駐車場・ビデオを先に確定（カゴはこの結果を読むだけ＝一方通行で公平さを崩さない）
    const { results: pvResults } = assignDuties(
      practiceDays, confirmedAttendance,
      parkingCounts, videoCounts,
      parkingLast, videoLast,
      COACH_ORDER, VIDEO_COACH_ORDER,
    );
    const pvByDate = new Map(pvResults.map(r => [r.date, r]));

    // ② カゴが必要な全セッション（練習・運動会等・試合。合宿/休みは除外）を日付順に
    const baseResults: AssignmentResult[] = confirmedSchedule
      .filter(d => d.type === 'practice' || d.type === 'special' || d.type === 'match')
      .map(d => {
        if (d.type === 'match') {
          return {
            date: d.date, dayOfWeek: d.dayOfWeek,
            coach: null, videoCoach: null, kagoCoach: null,
            practiceTime: d.practiceTime,
            isSaturday: d.dayOfWeek === '土',
            isMatch: true,
          } as AssignmentResult;
        }
        // 練習・運動会等は駐車場/ビデオ確定済みの結果を使う
        return pvByDate.get(d.date) ?? ({
          date: d.date, dayOfWeek: d.dayOfWeek,
          coach: null, videoCoach: null, kagoCoach: null,
          practiceTime: d.practiceTime,
          isSaturday: d.dayOfWeek === '土',
          isMatch: false,
        } as AssignmentResult);
      })
      .sort(byDate);

    // ③ カゴ連鎖を割り当て（前月からの引き継ぎを seed で渡す）
    const seed = getPreviousKagoSession(selectedMonth);
    const { results } = assignKagoChain(
      baseResults, confirmedAttendance,
      kagoCounts, seed?.holder ?? null, seed,
      KAGO_COACH_ORDER,
    );

    const monthData: MonthlyData = {
      month: selectedMonth,
      schedule: confirmedSchedule.map(d => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        type: d.type,
        practiceTime: d.practiceTime,
      })),
      attendance: confirmedAttendance,
      assignments: results,
      confirmed: true,
    };

    saveMonthlyData(selectedMonth, monthData);
    recalculateCumulativeCounts();
    setAssignments(monthData);
    setRefreshKey(k => k + 1);
  }, [confirmedAttendance, confirmedSchedule, selectedMonth]);

  const handleResultUpdate = useCallback((updatedResults: AssignmentResult[]) => {
    const base = assignments || savedData;
    if (!base) return;
    const updated = { ...base, assignments: updatedResults };
    setAssignments(updated);
    saveMonthlyData(selectedMonth, updated);
    recalculateCumulativeCounts();
    setRefreshKey(k => k + 1);
  }, [assignments, savedData, selectedMonth]);

  const handleDataChange = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // CSVからスケジュール情報を生成（選択中の月のみ）
  const csvSchedule = useMemo(() => {
    if (!csvData) return null;
    return csvData.days
      .filter(d => parseInt(d.date.split('/')[0], 10) === monthNum)
      .map(d => {
        const existing = currentSchedule.find(s => s.date === d.date);
        return {
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          type: (d.isMatch ? 'match' : d.isCamp ? 'camp' : existing?.type || 'practice') as DayType,
          practiceTime: d.practiceTime || existing?.practiceTime || '',
        };
      });
  }, [csvData, currentSchedule, monthNum]);

  // CSVから新しく出欠確認中の場合は古い保存データを使わない（ボタン表示バグ防止）
  const displayAssignments = confirmedAttendance ? assignments : (assignments || savedData);
  const parkingCounts = getParkingCounts();
  const videoCounts = getVideoCounts();
  const kagoCounts = getKagoCounts();

  return (
    <div className="admin-view">
      {toast && <div className="toast">{toast}</div>}
      {/* タブ */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'assign' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('assign')}
        >
          📋 当番割り当て
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ 設定
        </button>
      </div>

      {activeTab === 'assign' ? (
        <div className="assign-tab">
          {/* 月選択 */}
          <div className="month-select-admin">
            <label>対象月：</label>
            <select
              value={selectedMonthIdx}
              onChange={(e) => {
                setSelectedMonthIdx(Number(e.target.value));
                setCsvData(null);
                setConfirmedAttendance(null);
                setConfirmedSchedule(null);
                setAssignments(null);
              }}
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          {/* CSVアップロード */}
          <CsvUploader onParsed={handleCsvParsed} />

          {/* 出欠プレビュー */}
          {csvData && csvSchedule && !confirmedAttendance && (
            <AttendancePreview
              csvData={csvData}
              schedule={csvSchedule}
              onConfirm={handleAttendanceConfirm}
            />
          )}

          {/* 割り当てボタン */}
          {confirmedAttendance && assignments === null && (
            <div className="assign-action">
              <button className="btn btn-primary btn-lg btn-assign" onClick={handleAssign}>
                🔄 当番を決定する
              </button>
            </div>
          )}

          {/* 結果表示 */}
          {displayAssignments?.confirmed && (
            <>
              <AssignmentResultView
                results={displayAssignments.assignments}
                month={selectedMonth}
                onUpdate={handleResultUpdate}
              />

              <LineAnnouncement
                results={displayAssignments.assignments}
                month={selectedMonth}
              />

              <CumulativeCount
                parkingCounts={parkingCounts}
                videoCounts={videoCounts}
                kagoCounts={kagoCounts}
              />

              <div className="publish-section">
                <p className="publish-desc">当番が確定したら「公開する」を押してください。スマホでも見られるようになります。</p>
                <button
                  className="btn btn-publish"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? '公開中...' : '🌐 スマホ向けに公開する'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Settings onDataChange={handleDataChange} />
      )}
    </div>
  );
};

export default AdminView;

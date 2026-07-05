import { STORAGE_KEYS, DEFAULT_ADMIN_PASSWORD, COACH_ORDER, VIDEO_COACH_ORDER, KAGO_COACH_ORDER, DEFAULT_SCHEDULE, MONTHS } from './constants';
import type { ScheduleDay, AttendanceStatus } from './constants';
import type { AssignmentResult } from './assignParking';
import { isKagoCounted } from './assignParking';

// ── 型定義 ──

export interface MonthlyData {
  month: string; // "4月" 形式
  schedule: ScheduleDay[];
  attendance: Record<string, Record<string, AttendanceStatus>>;
  assignments: AssignmentResult[];
  confirmed: boolean;
}

export interface CoachConfig {
  coachOrder: string[];
  excludedCoaches: string[];
}

export interface ChangeHistoryEntry {
  date: string;
  month: string;
  originalCoach: string;
  newCoach: string;
  dutyType: 'parking' | 'video' | 'kago';
  changedAt: string;
}

// ── localStorage 操作 ──

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── マイグレーション（旧データ検出→全リセット）──

export function migrateIfNeeded(): void {
  const oldPointer = localStorage.getItem(STORAGE_KEYS._OLD_POINTER);
  const oldCounts = localStorage.getItem(STORAGE_KEYS._OLD_CUMULATIVE_COUNTS);
  if (oldPointer !== null || oldCounts !== null) {
    // 旧形式データを検出 → 全リセット
    resetAllData();
  }
}

/**
 * 林さんを駐車場当番から除外した際の1回限りのマイグレーション処理（2026-04-27 導入）
 *
 * 起動時に一度だけ実行：
 * 1. 林さんの駐車場累計回数を削除
 * 2. 5月以降の割り当て結果（assignments）をクリアし confirmed=false に戻す
 *    （4月の確定済み割り当ては変更しない）
 * 3. 駐車場ポインタを「4月の最後の確定済み当番者の次」に巻き戻す
 *    （4月が未確定なら何もしない＝安全側）
 * 4. 完了フラグを立てて再実行を防止
 */
export function migrateRemoveHayashi(): void {
  if (localStorage.getItem(STORAGE_KEYS.MIGRATION_REMOVE_HAYASHI) === 'done') {
    return;
  }

  // 1. 林さんの累計を削除
  const counts = getParkingCounts();
  if ('林和憲' in counts) {
    delete counts['林和憲'];
    saveParkingCounts(counts);
  }

  // 2. 5月以降の月別データの assignments をクリア
  const allData = getAllMonthlyData();
  const monthsToReset = ['5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
  let monthlyDataChanged = false;
  for (const month of monthsToReset) {
    const data = allData[month];
    if (data && (data.assignments?.length ?? 0) > 0) {
      data.assignments = [];
      data.confirmed = false;
      monthlyDataChanged = true;
    }
  }
  if (monthlyDataChanged) {
    setItem(STORAGE_KEYS.MONTHLY_DATA, allData);
  }

  // 3. ポインタを「4月の最後の確定済み駐車場当番者の次」に巻き戻す
  const aprilData = allData['4月'];
  if (aprilData?.confirmed && aprilData.assignments?.length > 0) {
    let lastParkingCoach: string | null = null;
    for (let i = aprilData.assignments.length - 1; i >= 0; i--) {
      const c = aprilData.assignments[i].coach;
      if (c && c !== '林和憲') {
        lastParkingCoach = c;
        break;
      }
    }
    if (lastParkingCoach) {
      const idx = COACH_ORDER.indexOf(lastParkingCoach);
      if (idx >= 0) {
        const nextIdx = (idx + 1) % COACH_ORDER.length;
        saveParkingPointerState(nextIdx, nextIdx);
      }
    }
  }

  // 4. 累計を再計算して反映（5月以降のクリア分が累計から落ちる）
  recalculateCumulativeCounts();

  // 5. recalculate が過去の確定済みデータから林さんを再構築する可能性があるので念のため再削除
  const finalCounts = getParkingCounts();
  if ('林和憲' in finalCounts) {
    delete finalCounts['林和憲'];
    saveParkingCounts(finalCounts);
  }

  // 6. 完了フラグを立てる
  localStorage.setItem(STORAGE_KEYS.MIGRATION_REMOVE_HAYASHI, 'done');
}

// ── 月別データ ──

export function getMonthlyData(month: string): MonthlyData | null {
  const allData = getItem<Record<string, MonthlyData>>(STORAGE_KEYS.MONTHLY_DATA, {});
  return allData[month] ?? null;
}

export function getAllMonthlyData(): Record<string, MonthlyData> {
  return getItem<Record<string, MonthlyData>>(STORAGE_KEYS.MONTHLY_DATA, {});
}

export function saveMonthlyData(month: string, data: MonthlyData): void {
  const allData = getItem<Record<string, MonthlyData>>(STORAGE_KEYS.MONTHLY_DATA, {});
  allData[month] = data;
  setItem(STORAGE_KEYS.MONTHLY_DATA, allData);
}

// ── コーチ設定 ──

export function getCoachConfig(): CoachConfig {
  return getItem<CoachConfig>(STORAGE_KEYS.COACH_CONFIG, {
    coachOrder: [...COACH_ORDER],
    excludedCoaches: [],
  });
}

export function saveCoachConfig(config: CoachConfig): void {
  setItem(STORAGE_KEYS.COACH_CONFIG, config);
}

// ── 累計担当回数（駐車場・ビデオ独立）──

export function getParkingCounts(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.PARKING_COUNTS, {});
}

export function saveParkingCounts(counts: Record<string, number>): void {
  setItem(STORAGE_KEYS.PARKING_COUNTS, counts);
}

export function getVideoCounts(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.VIDEO_COUNTS, {});
}

export function saveVideoCounts(counts: Record<string, number>): void {
  setItem(STORAGE_KEYS.VIDEO_COUNTS, counts);
}

export function getKagoCounts(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.KAGO_COUNTS, {});
}

export function saveKagoCounts(counts: Record<string, number>): void {
  setItem(STORAGE_KEYS.KAGO_COUNTS, counts);
}

// ── 繰越回数（前年度からの引き継ぎ＋手動調整の恒久化。2026-07-03 A-4）──
// 累計の再計算は「確定月の合計＋この繰越」を保存する。設定画面の±調整は繰越側を
// 書き換えるため、割り当て後の再計算でも消えない（従来は再計算で消えていた）。

export function getParkingCarryover(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.PARKING_CARRYOVER, {});
}

export function saveParkingCarryover(carryover: Record<string, number>): void {
  setItem(STORAGE_KEYS.PARKING_CARRYOVER, carryover);
}

export function getVideoCarryover(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.VIDEO_CARRYOVER, {});
}

export function saveVideoCarryover(carryover: Record<string, number>): void {
  setItem(STORAGE_KEYS.VIDEO_CARRYOVER, carryover);
}

export function getKagoCarryover(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.KAGO_CARRYOVER, {});
}

export function saveKagoCarryover(carryover: Record<string, number>): void {
  setItem(STORAGE_KEYS.KAGO_CARRYOVER, carryover);
}

/** 確定済みの全月データだけから、繰越を含まない素の累計（月合計）を求める */
function computeMonthlyTotals(): { parking: Record<string, number>; video: Record<string, number>; kago: Record<string, number> } {
  const allData = getAllMonthlyData();
  const parking: Record<string, number> = {};
  const video: Record<string, number> = {};
  const kago: Record<string, number> = {};

  for (const coach of COACH_ORDER) {
    parking[coach] = 0;
  }
  for (const coach of VIDEO_COACH_ORDER) {
    video[coach] = 0;
  }
  for (const coach of KAGO_COACH_ORDER) {
    kago[coach] = 0;
  }

  for (const month of Object.values(allData)) {
    if (!month.confirmed) continue;
    for (const assignment of month.assignments) {
      if (assignment.coach) {
        parking[assignment.coach] = (parking[assignment.coach] || 0) + 1;
      }
      if (assignment.videoCoach) {
        video[assignment.videoCoach] = (video[assignment.videoCoach] || 0) + 1;
      }
      // カゴは「カゴ係として指名された日」だけ数える（日曜の駐車場当番がそのまま運ぶ分・要確認は数えない）
      if (isKagoCounted(assignment)) {
        kago[assignment.kagoCoach!] = (kago[assignment.kagoCoach!] || 0) + 1;
      }
    }
  }

  return { parking, video, kago };
}

export function recalculateCumulativeCounts(): { parking: Record<string, number>; video: Record<string, number>; kago: Record<string, number> } {
  const { parking, video, kago } = computeMonthlyTotals();

  // 繰越（前年度引き継ぎ・手動調整）を加算。マイナス繰越でも累計は0で下げ止め
  const pCarry = getParkingCarryover();
  const vCarry = getVideoCarryover();
  const kCarry = getKagoCarryover();
  for (const coach of COACH_ORDER) parking[coach] = Math.max(0, parking[coach] + (pCarry[coach] ?? 0));
  for (const coach of VIDEO_COACH_ORDER) video[coach] = Math.max(0, video[coach] + (vCarry[coach] ?? 0));
  for (const coach of KAGO_COACH_ORDER) kago[coach] = Math.max(0, kago[coach] + (kCarry[coach] ?? 0));

  saveParkingCounts(parking);
  saveVideoCounts(video);
  saveKagoCounts(kago);
  return { parking, video, kago };
}

/**
 * 設定画面の累計調整：そのコーチの累計（＝確定月の合計＋繰越）を desiredTotal に合わせる。
 * 差分を繰越側に保存するため、以後の割り当て・再計算でも調整が消えない。
 * 月合計より小さくしたい場合は繰越がマイナスになる（累計の表示・割り当て入力は0で下げ止め）。
 */
export function setCumulativeCount(
  type: 'parking' | 'video' | 'kago',
  coach: string,
  desiredTotal: number,
): void {
  const target = Math.max(0, desiredTotal);
  const monthly = computeMonthlyTotals()[type][coach] ?? 0;
  const carryover = type === 'parking' ? getParkingCarryover() : type === 'video' ? getVideoCarryover() : getKagoCarryover();
  carryover[coach] = target - monthly;
  if (type === 'parking') saveParkingCarryover(carryover);
  else if (type === 'video') saveVideoCarryover(carryover);
  else saveKagoCarryover(carryover);
  recalculateCumulativeCounts();
}

/**
 * 指定月を割り当てる際に「入力として使う累計回数」を返す。
 *
 * = 現在の累計（getParkingCounts / getVideoCounts）から、その月の確定済み分を差し引いた値。
 * これにより：
 *  - 過去の月の累計はそのまま引き継ぎ
 *  - 同じ月を割り当て直しても二重カウントにならず
 *  - 割り当て直前に設定画面で手動調整した回数も反映される
 */
export function getCountsForAssignment(
  selectedMonth: string,
  type: 'parking' | 'video' | 'kago',
): Record<string, number> {
  const base = type === 'parking' ? getParkingCounts() : type === 'video' ? getVideoCounts() : getKagoCounts();
  const order = type === 'parking' ? COACH_ORDER : type === 'video' ? VIDEO_COACH_ORDER : KAGO_COACH_ORDER;
  const counts: Record<string, number> = {};
  for (const c of order) counts[c] = base[c] ?? 0;

  const data = getMonthlyData(selectedMonth);
  if (data?.confirmed) {
    for (const a of data.assignments) {
      let coach: string | null = null;
      if (type === 'parking') coach = a.coach;
      else if (type === 'video') coach = a.videoCoach;
      else coach = isKagoCounted(a) ? a.kagoCoach : null; // カゴは指名分だけ控除（兼任・要確認は対象外）
      if (coach && coach in counts) counts[coach] = Math.max(0, counts[coach] - 1);
    }
  }
  return counts;
}

/**
 * 指定月より前の「最後に当番した人」を返す（駐車場・ビデオの連続防止の起点）。
 *
 * 年度の月並び（MONTHS）で、選択月より前の確定済み月を新しい順にたどり、
 * 最後の（非null）当番者を返す。見つからなければ null。
 * ※カゴの月またぎ起点は holder ベースの `getPreviousKagoSession` を使う（この関数は使わない）。
 */
export function getPreviousLastCoach(
  selectedMonth: string,
  type: 'parking' | 'video',
): string | null {
  const idx = MONTHS.indexOf(selectedMonth);
  if (idx < 0) return null;
  const allData = getAllMonthlyData();
  for (let i = idx - 1; i >= 0; i--) {
    const data = allData[MONTHS[i]];
    if (!data?.confirmed || !data.assignments?.length) continue;
    for (let j = data.assignments.length - 1; j >= 0; j--) {
      const a = data.assignments[j];
      const coach = type === 'parking' ? a.coach : a.videoCoach;
      if (coach) return coach;
    }
  }
  return null;
}

/**
 * 月またぎのカゴ引き継ぎ情報を返す。
 *
 * 選択月より前の確定済み月を新しい順にたどり、「最後にカゴを運んだ日」を探して
 *  - holder: その日の運び役（＝現在カゴを持っている人）
 *  - lastPresent: その日の出欠（＝次の月初セッションの「前回◯」判定に使う）
 * を返す。見つからなければ null（＝月初は前回条件を緩める＝初回扱い）。
 *
 * 旧フォーマット（試合日だけ kagoCoach がある月）は、練習日の保持者が記録されていないため
 * lastPresent を null にして緩める（holder は連続防止の起点としてだけ使う）。
 */
export function getPreviousKagoSession(
  selectedMonth: string,
): { holder: string | null; lastPresent: Record<string, AttendanceStatus> | null } | null {
  const idx = MONTHS.indexOf(selectedMonth);
  if (idx < 0) return null;
  const allData = getAllMonthlyData();
  for (let i = idx - 1; i >= 0; i--) {
    const data = allData[MONTHS[i]];
    if (!data?.confirmed || !data.assignments?.length) continue;
    // 新フォーマット（カゴ連鎖）の月かを、連鎖が必ず付ける新フラグの有無で判定する。
    // ＝試合のみの月でも前回出欠(attendance)を信頼でき、不要に緩めない。
    const isNewFormat = data.assignments.some(
      (a) => a.kagoCarriedByParking !== undefined || a.kagoNeedsConfirm !== undefined,
    );
    for (let j = data.assignments.length - 1; j >= 0; j--) {
      const a = data.assignments[j];
      if (a.kagoCoach) {
        return {
          holder: a.kagoCoach,
          lastPresent: isNewFormat ? (data.attendance[a.date] ?? null) : null,
        };
      }
    }
    // この月はカゴを運んだ記録なし → さらに前の月へ
  }
  return null;
}

// ── ポインタ状態（旧方式の名残・現在は export/import と過去マイグレーションの互換用のみ）──

export interface PointerState {
  owed: number;       // 次回先頭候補（借り越し中の人）
  searchFrom: number; // 代役を探す開始位置
}

export function getParkingPointerState(): PointerState {
  return getItem<PointerState>(STORAGE_KEYS.PARKING_POINTER, { owed: 0, searchFrom: 0 });
}

export function saveParkingPointerState(owed: number, searchFrom: number): void {
  setItem(STORAGE_KEYS.PARKING_POINTER, { owed, searchFrom });
}

export function getVideoPointerState(): PointerState {
  return getItem<PointerState>(STORAGE_KEYS.VIDEO_POINTER, { owed: 0, searchFrom: 0 });
}

export function saveVideoPointerState(owed: number, searchFrom: number): void {
  setItem(STORAGE_KEYS.VIDEO_POINTER, { owed, searchFrom });
}

// ── 変更履歴 ──

export function getChangeHistory(): ChangeHistoryEntry[] {
  return getItem<ChangeHistoryEntry[]>(STORAGE_KEYS.CHANGE_HISTORY, []);
}

export function addChangeHistory(entry: ChangeHistoryEntry): void {
  const history = getChangeHistory();
  history.push(entry);
  setItem(STORAGE_KEYS.CHANGE_HISTORY, history);
}

// ── スケジュール ──

export function getSchedule(): ScheduleDay[] {
  return getItem<ScheduleDay[]>(STORAGE_KEYS.SCHEDULE, []);
}

export function saveSchedule(schedule: ScheduleDay[]): void {
  setItem(STORAGE_KEYS.SCHEDULE, schedule);
}

export function updateScheduleDay(date: string, updates: Partial<ScheduleDay>): void {
  const schedule = getSchedule();
  const idx = schedule.findIndex(d => d.date === date);
  if (idx >= 0) {
    schedule[idx] = { ...schedule[idx], ...updates };
    saveSchedule(schedule);
  }
}

// ── 管理者パスワード ──

export function getAdminPassword(): string {
  return getItem<string>(STORAGE_KEYS.ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD);
}

export function saveAdminPassword(password: string): void {
  setItem(STORAGE_KEYS.ADMIN_PASSWORD, password);
}

export function verifyPassword(input: string): boolean {
  return input === getAdminPassword();
}

// ── データエクスポート / インポート ──

export function exportAllData(): string {
  const data = {
    monthlyData: getAllMonthlyData(),
    coachConfig: getCoachConfig(),
    parkingCounts: getParkingCounts(),
    videoCounts: getVideoCounts(),
    kagoCounts: getKagoCounts(),
    parkingCarryover: getParkingCarryover(),
    videoCarryover: getVideoCarryover(),
    kagoCarryover: getKagoCarryover(),
    parkingPointer: getParkingPointerState(),
    videoPointer: getVideoPointerState(),
    changeHistory: getChangeHistory(),
    schedule: getSchedule(),
    adminPassword: getAdminPassword(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonString: string): void {
  try {
    const data = JSON.parse(jsonString);

    if (data.monthlyData) setItem(STORAGE_KEYS.MONTHLY_DATA, data.monthlyData);
    if (data.coachConfig) setItem(STORAGE_KEYS.COACH_CONFIG, data.coachConfig);
    if (data.parkingCounts) setItem(STORAGE_KEYS.PARKING_COUNTS, data.parkingCounts);
    if (data.videoCounts) setItem(STORAGE_KEYS.VIDEO_COUNTS, data.videoCounts);
    if (data.kagoCounts) setItem(STORAGE_KEYS.KAGO_COUNTS, data.kagoCounts);
    if (data.parkingCarryover) setItem(STORAGE_KEYS.PARKING_CARRYOVER, data.parkingCarryover);
    if (data.videoCarryover) setItem(STORAGE_KEYS.VIDEO_CARRYOVER, data.videoCarryover);
    if (data.kagoCarryover) setItem(STORAGE_KEYS.KAGO_CARRYOVER, data.kagoCarryover);
    if (data.parkingPointer) setItem(STORAGE_KEYS.PARKING_POINTER, data.parkingPointer);
    if (data.videoPointer) setItem(STORAGE_KEYS.VIDEO_POINTER, data.videoPointer);
    if (data.changeHistory) setItem(STORAGE_KEYS.CHANGE_HISTORY, data.changeHistory);
    if (data.schedule) setItem(STORAGE_KEYS.SCHEDULE, data.schedule);
    if (data.adminPassword) setItem(STORAGE_KEYS.ADMIN_PASSWORD, data.adminPassword);
  } catch {
    throw new Error('JSONデータの形式が正しくありません');
  }
}

export function resetAllData(): void {
  // 新キー
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  // 旧キーも念のため削除
  localStorage.removeItem('srs_cumulative_counts');
  localStorage.removeItem('srs_pointer');
}

// ── GitHub 連携は src/lib/github.ts へ分離（2026-07-05 B-5）──

// ── ユーティリティ ──

export function getMonthNumber(monthStr: string): number {
  const match = monthStr.match(/(\d+)月/);
  return match ? parseInt(match[1], 10) : 0;
}

export function getScheduleForMonth(month: string): ScheduleDay[] {
  const monthNum = getMonthNumber(month);
  const savedSchedule = getSchedule();

  if (savedSchedule.length > 0) {
    return savedSchedule.filter(d => {
      const m = parseInt(d.date.split('/')[0], 10);
      return m === monthNum;
    });
  }

  return DEFAULT_SCHEDULE.filter((d: ScheduleDay) => {
    const m = parseInt(d.date.split('/')[0], 10);
    return m === monthNum;
  });
}

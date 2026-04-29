import { STORAGE_KEYS, DEFAULT_ADMIN_PASSWORD, COACH_ORDER, VIDEO_COACH_ORDER, DEFAULT_SCHEDULE } from './constants';
import type { ScheduleDay, AttendanceStatus } from './constants';
import type { AssignmentResult } from './assignParking';

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
  dutyType: 'parking' | 'video';
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

export function recalculateCumulativeCounts(): { parking: Record<string, number>; video: Record<string, number> } {
  const allData = getAllMonthlyData();
  const parking: Record<string, number> = {};
  const video: Record<string, number> = {};

  for (const coach of COACH_ORDER) {
    parking[coach] = 0;
  }
  for (const coach of VIDEO_COACH_ORDER) {
    video[coach] = 0;
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
    }
  }

  saveParkingCounts(parking);
  saveVideoCounts(video);
  return { parking, video };
}

// ── ポインタ（駐車場・ビデオ独立、各2ポインタ方式）──

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

export function getParkingPointer(): number {
  return getParkingPointerState().owed;
}

export function saveParkingPointer(pointer: number): void {
  saveParkingPointerState(pointer, pointer);
}

export function getVideoPointerState(): PointerState {
  return getItem<PointerState>(STORAGE_KEYS.VIDEO_POINTER, { owed: 0, searchFrom: 0 });
}

export function saveVideoPointerState(owed: number, searchFrom: number): void {
  setItem(STORAGE_KEYS.VIDEO_POINTER, { owed, searchFrom });
}

export function getVideoPointer(): number {
  return getVideoPointerState().owed;
}

export function saveVideoPointer(pointer: number): void {
  saveVideoPointerState(pointer, pointer);
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

// ── GitHub 連携 ──

const GITHUB_TOKEN_KEY = 'srs_github_token';
const GITHUB_REPO = 't-kyosuke/parking-lot-duty';
const GITHUB_DATA_PATH = 'data.json';
const GITHUB_BRANCH = 'gh-pages';

export interface PublishedData {
  monthlyData: Record<string, MonthlyData>;
  schedule: ScheduleDay[];
  updatedAt: string;
}

export function getGithubToken(): string {
  return localStorage.getItem(GITHUB_TOKEN_KEY) ?? '';
}

export function saveGithubToken(token: string): void {
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
}

async function fetchCurrentDataJsonSha(token: string, apiUrl: string): Promise<string | undefined> {
  // クエリにタイムスタンプを付けてキャッシュ回避（GitHub APIのCORSを壊さないようヘッダーは最小限）
  const url = `${apiUrl}?ref=${GITHUB_BRANCH}&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return undefined;
  const fileData = await res.json() as { sha: string };
  return fileData.sha;
}

export async function publishToGithub(token: string): Promise<void> {
  const data: PublishedData = {
    monthlyData: getAllMonthlyData(),
    schedule: getSchedule(),
    updatedAt: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const content = btoa(unescape(encodeURIComponent(jsonStr)));
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`;

  // 1〜2回試行（SHAがキャッシュされていた場合のリカバリ用）
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await fetchCurrentDataJsonSha(token, apiUrl);

    const body: Record<string, string | undefined> = {
      message: `スケジュールデータを更新 (${new Date().toLocaleDateString('ja-JP')})`,
      content,
      branch: GITHUB_BRANCH,
      sha,
    };
    if (!sha) delete body.sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (putRes.ok) {
      return; // 成功
    }

    const err = await putRes.json().catch(() => ({})) as { message?: string };
    lastError = err.message ?? '不明なエラー';

    // SHA不一致エラーなら、最新SHAを取り直して再試行
    const isShaMismatch = putRes.status === 409 ||
      (lastError && lastError.includes('does not match'));
    if (!isShaMismatch) break;
  }

  throw new Error(lastError ?? 'GitHub APIへの公開に失敗しました');
}

export async function fetchPublishedData(): Promise<PublishedData | null> {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/gh-pages/data.json`;
    const res = await fetch(rawUrl);
    if (!res.ok) return null;
    return await res.json() as PublishedData;
  } catch {
    return null;
  }
}

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

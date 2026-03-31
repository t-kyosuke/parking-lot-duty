import { STORAGE_KEYS, DEFAULT_ADMIN_PASSWORD, COACH_ORDER, DEFAULT_SCHEDULE } from './constants';
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

// ── 累計担当回数 ──

export function getCumulativeCounts(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.CUMULATIVE_COUNTS, {});
}

export function saveCumulativeCounts(counts: Record<string, number>): void {
  setItem(STORAGE_KEYS.CUMULATIVE_COUNTS, counts);
}

export function recalculateCumulativeCounts(): Record<string, number> {
  const allData = getAllMonthlyData();
  const counts: Record<string, number> = {};

  for (const coach of COACH_ORDER) {
    counts[coach] = 0;
  }

  for (const month of Object.values(allData)) {
    if (!month.confirmed) continue;
    for (const assignment of month.assignments) {
      if (assignment.coach) {
        counts[assignment.coach] = (counts[assignment.coach] || 0) + 1;
      }
    }
  }

  saveCumulativeCounts(counts);
  return counts;
}

// ── ポインタ ──

export function getPointer(): number {
  return getItem<number>(STORAGE_KEYS.POINTER, 0);
}

export function savePointer(pointer: number): void {
  setItem(STORAGE_KEYS.POINTER, pointer);
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
    cumulativeCounts: getCumulativeCounts(),
    pointer: getPointer(),
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
    if (data.cumulativeCounts) setItem(STORAGE_KEYS.CUMULATIVE_COUNTS, data.cumulativeCounts);
    if (data.pointer !== undefined) setItem(STORAGE_KEYS.POINTER, data.pointer);
    if (data.changeHistory) setItem(STORAGE_KEYS.CHANGE_HISTORY, data.changeHistory);
    if (data.schedule) setItem(STORAGE_KEYS.SCHEDULE, data.schedule);
    if (data.adminPassword) setItem(STORAGE_KEYS.ADMIN_PASSWORD, data.adminPassword);
  } catch {
    throw new Error('JSONデータの形式が正しくありません');
  }
}

export function resetAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
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

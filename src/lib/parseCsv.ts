import { COACH_ORDER, EXCLUDED_COACHES, MATCH_KEYWORDS, CAMP_KEYWORDS } from './constants';
import type { AttendanceStatus } from './constants';

export interface ParsedDay {
  date: string;        // "4/5" 形式
  dayOfWeek: string;    // "日", "土", "祝" 等
  rawLabel: string;     // CSVの元のラベル（例："4/5(日) 13:00-14:20"）
  practiceTime: string; // "13:00-14:20"
  isMatch: boolean;
  isCamp: boolean;
}

export interface ParsedCsvData {
  days: ParsedDay[];
  attendance: Record<string, Record<string, AttendanceStatus>>;
  allCoachNames: string[];
  duplicateDays: string[];
}

/**
 * コーチ名の正規化（スペースを除去して比較用にする）
 */
function normalizeCoachName(name: string): string {
  return name.replace(/\s+/g, '').trim();
}

/**
 * CSVヘッダーのコーチ名と当番候補11名を照合する
 */
function matchCoachName(csvName: string, coachList: string[]): string | null {
  const normalized = normalizeCoachName(csvName);
  for (const coach of coachList) {
    if (normalizeCoachName(coach) === normalized) {
      return coach;
    }
  }
  return null;
}

/**
 * 日程文字列から日付・曜日・時間を抽出する
 * 例: "4/5(日) 13:00-14:20" → { date: "4/5", dayOfWeek: "日", practiceTime: "13:00-14:20" }
 */
function parseDateLabel(label: string): { date: string; dayOfWeek: string; practiceTime: string } | null {
  // "4/5(日) 13:00-14:20" or "4/29(水)" 等のパターン
  const match = label.match(/^(\d{1,2}\/\d{1,2})\(([^)]+)\)\s*(.*)/);
  if (!match) return null;

  const date = match[1];
  const dayOfWeek = match[2];
  const rest = match[3].trim();

  // 時間を抽出（"13:00-14:20" 等のパターン）
  const timeMatch = rest.match(/(\d{1,2}:\d{2}[-–]\d{1,2}:\d{2})/);
  const practiceTime = timeMatch ? timeMatch[1].replace('–', '-') : '';

  return { date, dayOfWeek, practiceTime };
}

/**
 * 出欠記号を正規化する
 */
function normalizeAttendance(value: string): AttendanceStatus {
  const v = value.trim();
  if (v === '◯' || v === '○' || v === 'O' || v === 'o') return '◯';
  if (v === '×' || v === '✗' || v === 'x' || v === 'X') return '×';
  // 空欄・△・その他は全て△（未定）扱い
  return '△';
}

/**
 * 調整さんCSVをパースする
 * UTF-8で読み込みを試みて、失敗した場合はShift_JISにフォールバックする
 */
export async function parseCsv(file: File): Promise<ParsedCsvData> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  let text: string;
  try {
    // まずUTF-8（strict）で試みる。不正バイトがあれば例外が出る
    const decoder = new TextDecoder('utf-8', { fatal: true });
    text = decoder.decode(uint8);
  } catch {
    // UTF-8として読めなかった場合はShift_JISとして読む
    const decoder = new TextDecoder('shift_jis');
    text = decoder.decode(uint8);
  }

  return parseCsvText(text);
}

/**
 * CSV文字列をパースする（テスト用にも使える）
 */
export function parseCsvText(text: string): ParsedCsvData {
  // UTF-8 BOM（\uFEFF）を除去
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error('CSVのフォーマットが正しくありません（行数不足）');
  }

  // 「日程」を含む行を動的に探す（先頭列が「日程」の行）
  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const firstCell = lines[i].split(',')[0].trim();
    if (firstCell === '日程') {
      headerLineIndex = i;
      break;
    }
  }

  if (headerLineIndex === -1) {
    throw new Error('CSVのヘッダーが正しくありません（「日程」が見つかりません）');
  }

  const headerLine = lines[headerLineIndex];
  const headers = headerLine.split(',');

  // コーチ名のインデックスマッピング
  const allCoachNames: string[] = [];
  const coachColumnMap: Array<{ index: number; matchedName: string | null; csvName: string }> = [];

  for (let i = 1; i < headers.length; i++) {
    const csvName = headers[i].trim();
    if (!csvName) continue;

    allCoachNames.push(csvName);

    // 当番候補コーチとの照合
    const matched = matchCoachName(csvName, COACH_ORDER);
    // 除外コーチかどうかチェック
    const isExcluded = matchCoachName(csvName, EXCLUDED_COACHES) !== null;

    coachColumnMap.push({
      index: i,
      matchedName: isExcluded ? null : matched,
      csvName,
    });
  }

  // データ行をパース（最終行の「コメント」を除外）
  const dataLines = lines.slice(headerLineIndex + 1);
  const filteredDataLines = dataLines.filter(line => !line.startsWith('コメント'));

  const days: ParsedDay[] = [];
  const attendance: Record<string, Record<string, AttendanceStatus>> = {};
  const seenDates = new Set<string>();
  const duplicateDays: string[] = [];

  for (const line of filteredDataLines) {
    const cells = line.split(',');
    const dateLabel = cells[0]?.trim();
    if (!dateLabel) continue;

    const parsed = parseDateLabel(dateLabel);
    if (!parsed) continue;

    // 同日複数行チェック
    if (seenDates.has(parsed.date)) {
      duplicateDays.push(parsed.date);
      continue; // 最初の行の出欠を使用
    }
    seenDates.add(parsed.date);

    // 試合・合宿の自動判定
    const isMatch = MATCH_KEYWORDS.some(kw => dateLabel.includes(kw));
    const isCamp = CAMP_KEYWORDS.some(kw => dateLabel.includes(kw));

    days.push({
      date: parsed.date,
      dayOfWeek: parsed.dayOfWeek,
      rawLabel: dateLabel,
      practiceTime: parsed.practiceTime,
      isMatch,
      isCamp,
    });

    // 出欠データ（当番候補コーチのみ）
    attendance[parsed.date] = {};
    for (const col of coachColumnMap) {
      if (col.matchedName) {
        const value = cells[col.index] ?? '';
        attendance[parsed.date][col.matchedName] = normalizeAttendance(value);
      }
    }
  }

  return { days, attendance, allCoachNames, duplicateDays };
}

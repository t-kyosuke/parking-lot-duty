import { COACH_ORDER, VIDEO_COACH_ORDER, KAGO_COACH_ORDER } from './constants';
import type { AttendanceStatus } from './constants';

export interface AssignmentResult {
  date: string;
  dayOfWeek: string;
  coach: string | null;       // 駐車場当番（土曜・試合日は null）
  videoCoach: string | null;  // ビデオ当番（試合日は null）
  kagoCoach: string | null;   // カゴ当番（試合日のみ。練習日は null）
  practiceTime: string;
  isSaturday: boolean;
  isMatch: boolean;           // 試合日かどうか（表示の出し分け用）
}

export interface DutyAssignmentOutput {
  results: AssignmentResult[];
  parkingCounts: Record<string, number>; // 割り当て後の累計（駐車場）
  videoCounts: Record<string, number>;   // 割り当て後の累計（ビデオ）
  parkingLastCoach: string | null;       // 最後の駐車場当番者（次月の連続防止の起点）
  videoLastCoach: string | null;         // 最後のビデオ当番者
}

/**
 * 1か月あたりの当番回数の上限（デフォルト）。
 * 累計0の人が「追いつくため」に単月で偏りすぎる（連続はしないが頻度が高い）のを防ぐ。
 * その月に全員が上限へ達した日は自動で上限を外す（出席者が少ない日対策）。
 */
export const DEFAULT_MONTHLY_LIMIT = 2;

/**
 * 1つの当番枠について、当番者を1人選ぶ（累計回数が少ない人を優先）。
 *
 * 選び方（上から順に絞り込み、空になったらその条件だけ緩める）：
 *  1. 出席（◯）している人だけが候補
 *  2. その日すでに別の役割に就いた人は除外（駐車場とビデオの被り防止）
 *  3. その月すでに上限回数まで当番した人は除外（詰めすぎ防止）
 *  4. 直前に同じ当番をした人は除外（連続防止）
 *  5. 残った候補のうち累計回数が最少の人。同数のときは order（固定順）で先の人
 *
 * @returns 選ばれた当番者。出席者がいなければ null。
 */
function pickByCount(
  order: string[],
  counts: Record<string, number>,
  dayAttendance: Record<string, AttendanceStatus>,
  lastCoach: string | null,
  conflictCoach: string | null,
  monthlyCounts: Record<string, number>,
  monthlyLimit: number,
): string | null {
  // 1〜2. 出席かつ被りなしの人
  const present = order.filter(
    (c) => dayAttendance[c] === '◯' && c !== conflictCoach,
  );
  if (present.length === 0) return null;

  // 3. 月内上限：今月まだ上限に達していない人。全員到達なら緩める。
  let underLimit = present.filter((c) => (monthlyCounts[c] ?? 0) < monthlyLimit);
  if (underLimit.length === 0) underLimit = present;

  // 4. 連続防止：直前の人を除く。除いて 0 人になるなら緩める。
  let candidates = underLimit.filter((c) => c !== lastCoach);
  if (candidates.length === 0) candidates = underLimit;

  // 5. 累計が最少の人を選ぶ。candidates は order 順なので、
  //    「厳密に小さいときだけ更新」すれば同数のときは order で先の人が残る。
  let best = candidates[0];
  for (const c of candidates) {
    if ((counts[c] ?? 0) < (counts[best] ?? 0)) best = c;
  }
  return best;
}

/**
 * 駐車場当番・ビデオ当番を「累計回数が少ない人を優先」で割り当てる。
 *
 * - 駐車場：日曜・祝日のみ（土曜は割り当てなし＝null）
 * - ビデオ：全日（土曜も含む）。同じ日の駐車場当番とは被らない。
 * - 連続防止：直前に同じ当番をした人は次は選ばない（候補が尽きる日は緩める）
 * - 月内上限：同じ人は1か月で `monthlyLimit` 回まで（全員到達した日は緩める）
 * - 累計は引数で引き継ぎ、1人割り当てるたびに加算していく
 *
 * @param parkingCounts  駐車場のこれまでの累計（この呼び出しで加算される）
 * @param videoCounts    ビデオのこれまでの累計
 * @param parkingLastCoach 直前の駐車場当番者（前月末の人など。連続防止の起点）
 * @param videoLastCoach   直前のビデオ当番者
 * @param parkingMonthlyLimit 駐車場の1か月あたり上限（既定 2）
 * @param videoMonthlyLimit   ビデオの1か月あたり上限（既定 2）
 */
export function assignDuties(
  practiceDays: Array<{ date: string; dayOfWeek: string; practiceTime: string }>,
  attendance: Record<string, Record<string, AttendanceStatus>>,
  parkingCounts: Record<string, number>,
  videoCounts: Record<string, number>,
  parkingLastCoach: string | null = null,
  videoLastCoach: string | null = null,
  parkingOrder: string[] = COACH_ORDER,
  videoOrder: string[] = VIDEO_COACH_ORDER,
  parkingMonthlyLimit: number = DEFAULT_MONTHLY_LIMIT,
  videoMonthlyLimit: number = DEFAULT_MONTHLY_LIMIT,
): DutyAssignmentOutput {
  // 累計を複製（引数を壊さない）し、未登録のコーチは 0 で初期化
  const pCounts: Record<string, number> = {};
  const vCounts: Record<string, number> = {};
  for (const c of parkingOrder) pCounts[c] = parkingCounts[c] ?? 0;
  for (const c of videoOrder) vCounts[c] = videoCounts[c] ?? 0;

  // 今月の当番回数（上限判定用・この月だけのカウント）
  const pMonthly: Record<string, number> = {};
  const vMonthly: Record<string, number> = {};
  for (const c of parkingOrder) pMonthly[c] = 0;
  for (const c of videoOrder) vMonthly[c] = 0;

  let pLast = parkingLastCoach;
  let vLast = videoLastCoach;
  const results: AssignmentResult[] = [];

  for (const day of practiceDays) {
    const isSaturday = day.dayOfWeek === '土';
    const dayAtt = attendance[day.date] ?? {};

    // --- 駐車場（土曜はなし）---
    let coach: string | null = null;
    if (!isSaturday) {
      coach = pickByCount(parkingOrder, pCounts, dayAtt, pLast, null, pMonthly, parkingMonthlyLimit);
      if (coach) {
        pCounts[coach]++;
        pMonthly[coach]++;
        pLast = coach;
      }
    }

    // --- ビデオ（全日・同日の駐車場当番とは被らない）---
    const videoCoach = pickByCount(videoOrder, vCounts, dayAtt, vLast, coach, vMonthly, videoMonthlyLimit);
    if (videoCoach) {
      vCounts[videoCoach]++;
      vMonthly[videoCoach]++;
      vLast = videoCoach;
    }

    results.push({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      coach,
      videoCoach,
      kagoCoach: null,   // 練習日はカゴ当番なし
      practiceTime: day.practiceTime,
      isSaturday,
      isMatch: false,
    });
  }

  return {
    results,
    parkingCounts: pCounts,
    videoCounts: vCounts,
    parkingLastCoach: pLast,
    videoLastCoach: vLast,
  };
}

export interface KagoAssignmentOutput {
  results: AssignmentResult[];
  kagoCounts: Record<string, number>; // 割り当て後の累計（カゴ）
  kagoLastCoach: string | null;        // 最後のカゴ当番者（次の連続防止の起点）
}

/**
 * 試合日の「カゴ当番」を「累計回数が少ない人を優先」で割り当てる。
 *
 * カゴ当番 ＝ 試合前の最後の練習でカゴを預かり、試合当日に試合会場へ持っていく役割。
 * - 対象は試合日（type === 'match'）のみ。曜日は問わない（土曜の試合でも割り当てる）。
 * - 駐車場・ビデオとは独立した累計でカウントする。
 * - 出席（◯）している人の中から累計最少を選び、直前のカゴ当番者は連続を避ける。
 * - 累計は引数で引き継ぎ、1人割り当てるたびに加算していく。
 *
 * @param matchDays    試合日（date / dayOfWeek / practiceTime）
 * @param attendance   出欠（日付→コーチ→記号）。試合日の出欠を使う。
 * @param kagoCounts   カゴのこれまでの累計（この呼び出しで加算される）
 * @param kagoLastCoach 直前のカゴ当番者（前の試合の人など。連続防止の起点）
 * @param kagoOrder    カゴ当番候補（既定 KAGO_COACH_ORDER）
 * @param kagoMonthlyLimit 1か月あたり上限（既定 DEFAULT_MONTHLY_LIMIT。試合は月数回なので実質的にはほぼ効かない）
 */
export function assignKagoDuties(
  matchDays: Array<{ date: string; dayOfWeek: string; practiceTime: string }>,
  attendance: Record<string, Record<string, AttendanceStatus>>,
  kagoCounts: Record<string, number>,
  kagoLastCoach: string | null = null,
  kagoOrder: string[] = KAGO_COACH_ORDER,
  kagoMonthlyLimit: number = DEFAULT_MONTHLY_LIMIT,
): KagoAssignmentOutput {
  // 累計を複製（引数を壊さない）し、未登録のコーチは 0 で初期化
  const kCounts: Record<string, number> = {};
  for (const c of kagoOrder) kCounts[c] = kagoCounts[c] ?? 0;

  // 今月のカゴ当番回数（上限判定用・この月だけのカウント）
  const kMonthly: Record<string, number> = {};
  for (const c of kagoOrder) kMonthly[c] = 0;

  let kLast = kagoLastCoach;
  const results: AssignmentResult[] = [];

  for (const day of matchDays) {
    const isSaturday = day.dayOfWeek === '土';
    const dayAtt = attendance[day.date] ?? {};

    const kagoCoach = pickByCount(kagoOrder, kCounts, dayAtt, kLast, null, kMonthly, kagoMonthlyLimit);
    if (kagoCoach) {
      kCounts[kagoCoach]++;
      kMonthly[kagoCoach]++;
      kLast = kagoCoach;
    }

    results.push({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      coach: null,       // 試合日は駐車場・ビデオなし
      videoCoach: null,
      kagoCoach,
      practiceTime: day.practiceTime,
      isSaturday,
      isMatch: true,
    });
  }

  return {
    results,
    kagoCounts: kCounts,
    kagoLastCoach: kLast,
  };
}

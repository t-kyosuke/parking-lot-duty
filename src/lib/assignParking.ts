import { COACH_ORDER, VIDEO_COACH_ORDER } from './constants';
import type { AttendanceStatus } from './constants';

export interface AssignmentResult {
  date: string;
  dayOfWeek: string;
  coach: string | null;
  videoCoach: string | null;
  practiceTime: string;
  isSaturday: boolean;
}

export interface AssignmentOutput {
  results: AssignmentResult[];
  nextPointer: number;     // 次回「先頭候補」（借り越し中の人、または次の順番の人）
  nextSearchFrom: number;  // 次回カバー役を探す開始位置
}

/**
 * 駐車場当番割り当てアルゴリズム（2ポインタ方式）
 *
 * 【owed】借り越し中のコーチ（毎回先頭に試みる）
 * 【searchFrom】owedが欠席の場合、どこから代役を探すか
 *
 * - owedが◯ → 当番確定。借り越し解消。
 *     - 借り越しなし(owed==searchFrom)の場合：owed=searchFrom を +1 ずつ進める
 *     - 借り越しあり(owed!=searchFrom)の場合：owed を searchFrom に合わせる（searchFrom はそのまま）
 * - owedが欠席 → searchFrom 位置から◯を探して代役を立てる。searchFrom を代役の次へ進める。owed はそのまま。
 *
 * この方式により「借り越し中でも代役が毎回同じ人にならない」ため担当回数が均一になる。
 */
export function assignParking(
  practiceDays: Array<{ date: string; dayOfWeek: string; practiceTime: string }>,
  attendance: Record<string, Record<string, AttendanceStatus>>,
  startOwed: number,
  coachOrder: string[] = COACH_ORDER,
  startSearchFrom: number = startOwed
): AssignmentOutput {
  let owed = startOwed;
  let searchFrom = startSearchFrom;
  const n = coachOrder.length;
  const results: AssignmentResult[] = [];

  for (const day of practiceDays) {
    let assigned: string | null = null;

    if (attendance[day.date]?.[coachOrder[owed]] === '◯') {
      // 借り越し中のコーチが出席 → 当番確定、借り越し解消
      assigned = coachOrder[owed];
      if (owed === searchFrom) {
        // 借り越しなし：両方を次へ進める
        const next = (owed + 1) % n;
        owed = next;
        searchFrom = next;
      } else {
        // 借り越しあり：owed を searchFrom に追いつかせる（searchFrom はそのまま）
        owed = searchFrom;
      }
    } else {
      // 借り越し中のコーチが欠席 → searchFrom から代役を探す
      for (let i = 0; i < n; i++) {
        const coverIdx = (searchFrom + i) % n;
        if (attendance[day.date]?.[coachOrder[coverIdx]] === '◯') {
          assigned = coachOrder[coverIdx];
          searchFrom = (coverIdx + 1) % n;
          // owed はそのまま（借り越し継続）
          break;
        }
      }
      // 全員欠席の場合：assigned=null のまま、owed・searchFrom も変えない
    }

    results.push({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      coach: assigned,
      videoCoach: null,
      practiceTime: day.practiceTime,
      isSaturday: day.dayOfWeek === '土',
    });
  }

  return { results, nextPointer: owed, nextSearchFrom: searchFrom };
}

/**
 * ビデオ当番割り当てアルゴリズム（2ポインタ方式 + 被り防止）
 *
 * 駐車場当番と同じ2ポインタ方式で割り当てるが、
 * 同日の駐車場当番と同じ人はスキップ（ポインタ消費なし）する。
 */
export function assignVideo(
  days: AssignmentResult[],
  attendance: Record<string, Record<string, AttendanceStatus>>,
  startOwed: number,
  videoCoachOrder: string[] = VIDEO_COACH_ORDER,
  startSearchFrom: number = startOwed
): AssignmentOutput {
  let owed = startOwed;
  let searchFrom = startSearchFrom;
  const n = videoCoachOrder.length;
  const results: AssignmentResult[] = [];

  for (const day of days) {
    const parkingCoach = day.coach; // 駐車場当番（被り防止用）
    let assigned: string | null = null;

    // 土曜日でもビデオ当番はアサインする（駐車場はnull）

    const owedCoach = videoCoachOrder[owed];
    // 被り防止：owed の人が駐車場当番と同一なら、スキップして代役を探す（owed は変えない）
    if (owedCoach === parkingCoach) {
      // owed と同じ人が駐車場当番 → searchFrom から被りなしの代役を探す
      for (let i = 0; i < n; i++) {
        const coverIdx = (searchFrom + i) % n;
        const candidate = videoCoachOrder[coverIdx];
        if (candidate !== parkingCoach && attendance[day.date]?.[candidate] === '◯') {
          assigned = candidate;
          searchFrom = (coverIdx + 1) % n;
          // owed はそのまま（被りスキップはポインタ消費なし）
          break;
        }
      }
    } else if (attendance[day.date]?.[owedCoach] === '◯') {
      // owed の人が出席で被りなし → 当番確定
      assigned = owedCoach;
      if (owed === searchFrom) {
        const next = (owed + 1) % n;
        owed = next;
        searchFrom = next;
      } else {
        owed = searchFrom;
      }
    } else {
      // owed の人が欠席 → searchFrom から代役を探す（被り防止も考慮）
      for (let i = 0; i < n; i++) {
        const coverIdx = (searchFrom + i) % n;
        const candidate = videoCoachOrder[coverIdx];
        if (candidate !== parkingCoach && attendance[day.date]?.[candidate] === '◯') {
          assigned = candidate;
          searchFrom = (coverIdx + 1) % n;
          break;
        }
      }
    }

    results.push({
      ...day,
      videoCoach: assigned,
    });
  }

  return { results, nextPointer: owed, nextSearchFrom: searchFrom };
}

/**
 * 駐車場当番とビデオ当番を同時に割り当てる統合関数
 *
 * 1. まず駐車場当番を決定（土曜日は駐車場=null）
 * 2. 次にビデオ当番を決定（被り防止あり）
 */
export interface DualAssignmentOutput {
  results: AssignmentResult[];
  parkingNextPointer: number;
  parkingNextSearchFrom: number;
  videoNextPointer: number;
  videoNextSearchFrom: number;
}

export function assignDuties(
  practiceDays: Array<{ date: string; dayOfWeek: string; practiceTime: string }>,
  attendance: Record<string, Record<string, AttendanceStatus>>,
  parkingStartOwed: number,
  parkingStartSearchFrom: number,
  videoStartOwed: number,
  videoStartSearchFrom: number,
  parkingCoachOrder: string[] = COACH_ORDER,
  videoCoachOrder: string[] = VIDEO_COACH_ORDER,
): DualAssignmentOutput {
  // 土曜日は駐車場なし → 駐車場アルゴリズムには日・祝のみ渡す
  const nonSaturdayDays = practiceDays
    .filter(d => d.dayOfWeek !== '土')
    .map(d => ({ date: d.date, dayOfWeek: d.dayOfWeek, practiceTime: d.practiceTime }));

  // 1. 駐車場当番を決定
  const parkingResult = assignParking(
    nonSaturdayDays, attendance, parkingStartOwed, parkingCoachOrder, parkingStartSearchFrom
  );

  // 全日程のAssignmentResultを作成（土曜は駐車場=null）
  const parkingMap = new Map(parkingResult.results.map(r => [r.date, r]));
  const allResults: AssignmentResult[] = practiceDays.map(d => {
    const pr = parkingMap.get(d.date);
    return {
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      coach: pr?.coach ?? null,
      videoCoach: null,
      practiceTime: d.practiceTime,
      isSaturday: d.dayOfWeek === '土',
    };
  });

  // 2. ビデオ当番を決定（全日程対象、被り防止あり）
  const videoResult = assignVideo(
    allResults, attendance, videoStartOwed, videoCoachOrder, videoStartSearchFrom
  );

  return {
    results: videoResult.results,
    parkingNextPointer: parkingResult.nextPointer,
    parkingNextSearchFrom: parkingResult.nextSearchFrom,
    videoNextPointer: videoResult.nextPointer,
    videoNextSearchFrom: videoResult.nextSearchFrom,
  };
}

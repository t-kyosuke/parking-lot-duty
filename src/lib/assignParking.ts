import { COACH_ORDER } from './constants';
import type { AttendanceStatus } from './constants';

export interface AssignmentResult {
  date: string;
  dayOfWeek: string;
  coach: string | null;
  practiceTime: string;
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
      practiceTime: day.practiceTime,
    });
  }

  return { results, nextPointer: owed, nextSearchFrom: searchFrom };
}

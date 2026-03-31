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
  nextPointer: number;
}

/**
 * 駐車場当番割り当てアルゴリズム
 * 
 * 固定順リスト（11名）をポインタで循環的に回す。
 * ポインタ位置から出欠が◯のコーチを探して割り当て、
 * 次回はその次の位置から探す。
 */
export function assignParking(
  practiceDays: Array<{ date: string; dayOfWeek: string; practiceTime: string }>,
  attendance: Record<string, Record<string, AttendanceStatus>>,
  startPointer: number,
  coachOrder: string[] = COACH_ORDER
): AssignmentOutput {
  let pointer = startPointer;
  const results: AssignmentResult[] = [];

  for (const day of practiceDays) {
    let assigned: string | null = null;

    for (let i = 0; i < coachOrder.length; i++) {
      const idx = (pointer + i) % coachOrder.length;
      const coach = coachOrder[idx];

      if (attendance[day.date]?.[coach] === '◯') {
        assigned = coach;
        pointer = (idx + 1) % coachOrder.length;
        break;
      }
    }

    results.push({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      coach: assigned,
      practiceTime: day.practiceTime,
    });
  }

  return { results, nextPointer: pointer };
}

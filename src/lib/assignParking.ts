import { COACH_ORDER, VIDEO_COACH_ORDER, KAGO_COACH_ORDER } from './constants';
import type { AttendanceStatus } from './constants';

export interface AssignmentResult {
  date: string;
  dayOfWeek: string;
  coach: string | null;       // 駐車場当番（土曜・試合日は null）
  videoCoach: string | null;  // ビデオ当番（試合日は null）
  kagoCoach: string | null;   // カゴを持ってくる人（全カゴ必要日。要確認の日は null）
  practiceTime: string;
  isSaturday: boolean;
  isMatch: boolean;           // 試合日かどうか（表示の出し分け用）
  // ── カゴ連鎖用（2026-06-22 追加。旧データには無いので optional）──
  kagoCarriedByParking?: boolean; // true=その日の駐車場当番がそのまま運ぶ（カゴ累計に数えない）
  kagoNeedsConfirm?: boolean;     // true=前回来ていた出席者が今日いない＝引き継ぎ要確認
  kagoHolder?: string | null;     // この日時点でカゴを持っている人（要確認時の連絡先）
}

/**
 * カゴ累計に「数える」割り当てかどうか。
 * = カゴ係として指名された日だけ数える（日曜の駐車場当番がそのまま運ぶ分・要確認は数えない）。
 * 旧データ（試合日のみ kagoCoach あり・新フラグ無し）は true 扱い＝従来どおり数える（後方互換）。
 */
export function isKagoCounted(a: AssignmentResult): boolean {
  return !!a.kagoCoach && !a.kagoCarriedByParking && !a.kagoNeedsConfirm;
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

/** 月またぎの引き継ぎ：月初セッションが参照する「前回のカゴ・セッション」の情報 */
export interface KagoSeed {
  holder: string | null;                                   // 現在カゴを持っている人（前月最後の運び役）
  lastPresent: Record<string, AttendanceStatus> | null;    // 前回セッションの出欠（null=引き継ぎ不明＝初回扱いで緩める）
}

export interface KagoChainOutput {
  results: AssignmentResult[];
  kagoCounts: Record<string, number>; // 割り当て後の累計（カゴ係指名分のみ）
  kagoLastCoach: string | null;        // 最後にカゴを運んだ人（次の連続防止の起点）
  kagoHolder: string | null;           // 月末時点でカゴを持っている人（次月へ引き継ぐ）
}

/**
 * カゴ係を1人選ぶ（候補は「前回も来ていて今日も来ている人」に絞り込み済み）。
 * - 同日の駐車場・ビデオ当番はなるべく避ける（負荷分散。候補が尽きるなら緩める）
 * - 直前に運んだ人は連続を避ける（尽きるなら緩める）
 * - 残った中で累計最少。同数は order（固定順）で先の人
 */
function pickKagoCarrier(
  counts: Record<string, number>,
  pool: string[],
  lastCoach: string | null,
  conflicts: Array<string | null>,
): string | null {
  if (pool.length === 0) return null;
  const conflictSet = new Set(conflicts.filter((c): c is string => !!c));
  let cand = pool.filter((c) => !conflictSet.has(c));
  if (cand.length === 0) cand = pool;
  let noRepeat = cand.filter((c) => c !== lastCoach);
  if (noRepeat.length === 0) noRepeat = cand;
  let best = noRepeat[0];
  for (const c of noRepeat) if ((counts[c] ?? 0) < (counts[best] ?? 0)) best = c;
  return best;
}

/**
 * 「カゴを持ってくる人」を全カゴ必要セッション（練習・運動会等・試合）について日付順に決める。
 *
 * カゴは物理的に1個しかない物（黄色うちわ＋道具）なので、「前回のセッションに来ていた人」しか
 * 次に持って来られない。これを連鎖（バトンリレー）として最後まで筋を通して割り当てる。
 *
 * ルール（各セッション）：
 *  - 候補 ＝ 今日出席◯ かつ「前回セッションにも出席◯」の人（＝前回カゴを受け取れた人）
 *  - 日曜・祝日の練習（駐車場あり）で、駐車場当番が前回も来ていれば → 駐車場当番がそのまま運ぶ
 *    （＝うちわ入りのカゴが必要なので。これは「カゴ係」とは数えない）
 *  - それ以外（土曜・試合・上記で駐車場当番が前回いなかった日）→ カゴ係を1人指名（累計に数える）
 *  - 候補が0人（前回来ていた出席者が今日いない）→ 「要確認」とし、現在の保持者を表示
 *
 * ★駐車場・ビデオの当番者は一切変えない（baseResults を読むだけ・新オブジェクトを返す）。
 *
 * @param baseResults 駐車場/ビデオ確定済み・日付順のベース結果（カゴ欄は未設定）。試合日は coach/videoCoach=null・isMatch=true
 * @param attendance  出欠（日付→コーチ→記号）
 * @param kagoCounts  カゴのこれまでの累計（この呼び出しで加算される）
 * @param kagoLastCoach 直前にカゴを運んだ人（連続防止の起点）
 * @param seed        前月からの引き継ぎ（現在の保持者・前回出欠）。null なら初回扱いで前回条件を緩める
 * @param kagoOrder   カゴ係候補（既定 KAGO_COACH_ORDER）
 */
export function assignKagoChain(
  baseResults: AssignmentResult[],
  attendance: Record<string, Record<string, AttendanceStatus>>,
  kagoCounts: Record<string, number>,
  kagoLastCoach: string | null = null,
  seed: KagoSeed | null = null,
  kagoOrder: string[] = KAGO_COACH_ORDER,
): KagoChainOutput {
  // 累計を複製（引数を壊さない）し、未登録のコーチは 0 で初期化
  const kCounts: Record<string, number> = {};
  for (const c of kagoOrder) kCounts[c] = kagoCounts[c] ?? 0;

  let holder: string | null = seed?.holder ?? null;
  let lastPresent: Record<string, AttendanceStatus> | null = seed?.lastPresent ?? null;
  let lastCarrier: string | null = kagoLastCoach;
  const results: AssignmentResult[] = [];

  for (const base of baseResults) {
    const dayAtt = attendance[base.date] ?? {};
    const todayPresent = kagoOrder.filter((c) => dayAtt[c] === '◯');
    // 候補 ＝ 今日◯ ∩ 前回◯（前回が不明＝lastPresent null なら緩める＝今日◯全員）
    const pool = lastPresent
      ? todayPresent.filter((c) => lastPresent![c] === '◯')
      : todayPresent;

    let kagoCoach: string | null = null;
    let carriedByParking = false;
    let needsConfirm = false;

    const hasParkingRole = !base.isMatch && !base.isSaturday; // 日曜・祝日の練習
    const parkingCoach = base.coach;

    if (
      hasParkingRole &&
      parkingCoach &&
      (lastPresent === null || lastPresent[parkingCoach] === '◯')
    ) {
      // 駐車場当番がカゴ（うちわ）を前回受け取れている → そのまま持参（カゴ係には数えない）
      kagoCoach = parkingCoach;
      carriedByParking = true;
    } else {
      // カゴ係を指名（累計に数える）。同日の駐車場・ビデオはなるべく避ける
      const picked = pickKagoCarrier(kCounts, pool, lastCarrier, [base.coach, base.videoCoach]);
      if (picked) {
        kagoCoach = picked;
        kCounts[picked] = (kCounts[picked] ?? 0) + 1;
      } else {
        needsConfirm = true; // 今日来てる誰も前回カゴを受け取れていない＝物理的に持って来られない
      }
    }

    if (kagoCoach) {
      // カゴが今日ここに来た → 基準（保持者・前回出欠・直前運び手）を更新
      holder = kagoCoach;
      lastPresent = dayAtt;
      lastCarrier = kagoCoach;
    }
    // 要確認の日は holder / lastPresent / lastCarrier を据え置き（カゴは前回成功日の保持者のまま）

    results.push({
      ...base,
      kagoCoach,
      kagoCarriedByParking: carriedByParking,
      kagoNeedsConfirm: needsConfirm,
      kagoHolder: holder,
    });
  }

  return { results, kagoCounts: kCounts, kagoLastCoach: lastCarrier, kagoHolder: holder };
}

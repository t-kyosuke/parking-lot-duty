import { describe, it, expect } from 'vitest';
import { assignDuties, assignKagoDuties } from '../lib/assignParking';
import { COACH_ORDER, VIDEO_COACH_ORDER, KAGO_COACH_ORDER } from '../lib/constants';
import type { AttendanceStatus } from '../lib/constants';

// ── テスト用ヘルパー ──

/** 指定日すべてで全員 ◯ の出欠を作る */
function presentDays(dates: string[]): Record<string, Record<string, AttendanceStatus>> {
  const att: Record<string, Record<string, AttendanceStatus>> = {};
  for (const d of dates) {
    att[d] = {};
    COACH_ORDER.forEach((c) => (att[d][c] = '◯'));
  }
  return att;
}

/** 練習日（曜日・時間つき）を作る */
function days(dates: string[], dayOfWeek = '日') {
  return dates.map((d) => ({ date: d, dayOfWeek, practiceTime: '13:00-16:40' }));
}

/** 全員 0 の累計 */
function zero(order: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  order.forEach((x) => (c[x] = 0));
  return c;
}

describe('assignDuties（累計が少ない人を優先）', () => {
  it('累計が一番少ない人が選ばれること', () => {
    // 国沢だけ 0 回、他は多め → 国沢が選ばれる
    const parking = zero(COACH_ORDER);
    COACH_ORDER.forEach((c) => (parking[c] = 5));
    parking['国沢剛'] = 0;

    const { results } = assignDuties(
      days(['4/5']), presentDays(['4/5']),
      parking, zero(VIDEO_COACH_ORDER),
    );
    expect(results[0].coach).toBe('国沢剛');
  });

  it('累計が同じときは固定順の先頭（塚原）が選ばれること', () => {
    const { results } = assignDuties(
      days(['4/5']), presentDays(['4/5']),
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
    );
    expect(results[0].coach).toBe('塚原匡祐');
  });

  it('直前に当番した人は連続で選ばれないこと', () => {
    // 全員0回・直前が塚原 → 塚原を外して次点（同数なので国沢）
    const { results } = assignDuties(
      days(['4/5']), presentDays(['4/5']),
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
      '塚原匡祐', null,
    );
    expect(results[0].coach).toBe('国沢剛');
  });

  it('同じ日に駐車場とビデオが同一人物にならないこと（被り防止）', () => {
    const { results } = assignDuties(
      days(['4/5']), presentDays(['4/5']),
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
    );
    expect(results[0].coach).toBe('塚原匡祐');     // 駐車場は先頭
    expect(results[0].videoCoach).toBe('国沢剛');  // ビデオは塚原を避けて次点
    expect(results[0].coach).not.toBe(results[0].videoCoach);
  });

  it('出席者が少なく候補が尽きる日は連続防止を緩めること', () => {
    // 塚原だけ出席・直前も塚原 → 緩めて塚原を選ぶ（該当者なしにしない）
    const att: Record<string, Record<string, AttendanceStatus>> = { '4/5': {} };
    COACH_ORDER.forEach((c) => (att['4/5'][c] = '×'));
    att['4/5']['塚原匡祐'] = '◯';

    const { results } = assignDuties(
      days(['4/5']), att,
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
      '塚原匡祐', null,
    );
    expect(results[0].coach).toBe('塚原匡祐');
  });

  it('土曜は駐車場なし・ビデオありになること', () => {
    const { results } = assignDuties(
      days(['4/4'], '土'), presentDays(['4/4']),
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
    );
    expect(results[0].coach).toBeNull();        // 駐車場なし
    expect(results[0].videoCoach).toBe('塚原匡祐'); // ビデオあり
    expect(results[0].isSaturday).toBe(true);
  });

  it('全員欠席の日は駐車場・ビデオとも該当者なしになること', () => {
    const att: Record<string, Record<string, AttendanceStatus>> = { '4/5': {} };
    COACH_ORDER.forEach((c) => (att['4/5'][c] = '×'));

    const { results } = assignDuties(
      days(['4/5']), att,
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
    );
    expect(results[0].coach).toBeNull();
    expect(results[0].videoCoach).toBeNull();
  });

  it('累計を引き継いで加算し、連続日では別の人に回ること', () => {
    const ds = ['4/5', '4/12', '4/19', '4/29', '5/3'];
    const { results, parkingCounts, parkingLastCoach } = assignDuties(
      days(ds), presentDays(ds),
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
    );
    // 全員0からなので、固定順の先頭5人が1回ずつ
    expect(results.map((r) => r.coach)).toEqual([
      '塚原匡祐', '国沢剛', '岸下和樹', '堀本和幸', '濱田広宣',
    ]);
    expect(parkingCounts['塚原匡祐']).toBe(1);
    expect(parkingCounts['濱田広宣']).toBe(1);
    expect(parkingCounts['前里元樹']).toBe(0);
    expect(parkingLastCoach).toBe('濱田広宣');
  });

  it('全員出席で20日まわすと全員ほぼ均等（差1以内）になること', () => {
    const ds = Array.from({ length: 20 }, (_, i) => `d${i}`);
    const { results, parkingCounts, videoCounts } = assignDuties(
      days(ds), presentDays(ds),
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
    );

    // 駐車場：20日 ÷ 10人 = 各2回ぴったり
    const pVals = COACH_ORDER.map((c) => parkingCounts[c]);
    expect(Math.max(...pVals) - Math.min(...pVals)).toBeLessThanOrEqual(1);
    expect(Math.max(...pVals)).toBe(2);

    // ビデオも均等
    const vVals = VIDEO_COACH_ORDER.map((c) => videoCounts[c]);
    expect(Math.max(...vVals) - Math.min(...vVals)).toBeLessThanOrEqual(1);

    // 同じ日に駐車場とビデオが被っていないこと
    for (const r of results) {
      if (r.coach && r.videoCoach) expect(r.coach).not.toBe(r.videoCoach);
    }

    // 連続していないこと（出席者十分なので必ず別人）
    for (let i = 1; i < results.length; i++) {
      if (results[i].coach) expect(results[i].coach).not.toBe(results[i - 1].coach);
    }
  });

  it('1か月の当番回数が上限（2回）を超えないこと', () => {
    // ビデオ：堀本だけ累計0、他は10回 → 堀本が最優先されるが、月2回で頭打ちになるはず
    const vCounts: Record<string, number> = {};
    VIDEO_COACH_ORDER.forEach((c) => (vCounts[c] = 10));
    vCounts['堀本和幸'] = 0;

    const ds = Array.from({ length: 10 }, (_, i) => `d${i}`);
    const { results } = assignDuties(
      days(ds, '土'), presentDays(ds), // 土曜＝駐車場なし・ビデオのみ
      zero(COACH_ORDER), vCounts,
      null, null,
      COACH_ORDER, VIDEO_COACH_ORDER,
      2, 2, // 上限2回
    );
    const horimoto = results.filter((r) => r.videoCoach === '堀本和幸').length;
    expect(horimoto).toBe(2); // 累計0でも月2回まで（一気に追いつかせない）
  });

  it('全員が上限に達する日は上限を緩めて割り当てること', () => {
    // 出席は2人だけ・上限1回・3日 → 2人で3日を回すため3日目は緩める（該当者なしにしない）
    const att: Record<string, Record<string, AttendanceStatus>> = {};
    ['d0', 'd1', 'd2'].forEach((d) => {
      att[d] = {};
      COACH_ORDER.forEach((c) => (att[d][c] = '×'));
      att[d]['塚原匡祐'] = '◯';
      att[d]['国沢剛'] = '◯';
    });
    const { results } = assignDuties(
      days(['d0', 'd1', 'd2'], '土'), att,
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
      null, null,
      COACH_ORDER, VIDEO_COACH_ORDER,
      1, 1, // 上限1回
    );
    expect(results.every((r) => r.videoCoach !== null)).toBe(true);
  });

  it('当番候補に林和憲が含まれないこと（駐車場・ビデオとも10名）', () => {
    expect(COACH_ORDER).not.toContain('林和憲');
    expect(VIDEO_COACH_ORDER).not.toContain('林和憲');
    expect(COACH_ORDER.length).toBe(10);
    expect(VIDEO_COACH_ORDER.length).toBe(10);
  });
});

describe('assignKagoDuties（試合日のカゴ当番・累計が少ない人を優先）', () => {
  it('試合日に累計が一番少ない人が選ばれ、駐車場・ビデオは null になること', () => {
    const kago = zero(KAGO_COACH_ORDER);
    KAGO_COACH_ORDER.forEach((c) => (kago[c] = 5));
    kago['国沢剛'] = 0;

    const { results } = assignKagoDuties(days(['4/26']), presentDays(['4/26']), kago);
    expect(results[0].kagoCoach).toBe('国沢剛');
    expect(results[0].isMatch).toBe(true);
    expect(results[0].coach).toBeNull();
    expect(results[0].videoCoach).toBeNull();
  });

  it('累計が同じときは固定順の先頭（塚原）が選ばれること', () => {
    const { results } = assignKagoDuties(days(['4/26']), presentDays(['4/26']), zero(KAGO_COACH_ORDER));
    expect(results[0].kagoCoach).toBe('塚原匡祐');
  });

  it('直前のカゴ当番者は連続で選ばれないこと', () => {
    const { results } = assignKagoDuties(days(['4/26']), presentDays(['4/26']), zero(KAGO_COACH_ORDER), '塚原匡祐');
    expect(results[0].kagoCoach).toBe('国沢剛');
  });

  it('累計を引き継いで加算し、連続する試合では別の人に回ること', () => {
    const ds = ['4/26', '6/14', '6/28'];
    const { results, kagoCounts, kagoLastCoach } = assignKagoDuties(
      days(ds), presentDays(ds), zero(KAGO_COACH_ORDER),
    );
    expect(results.map((r) => r.kagoCoach)).toEqual(['塚原匡祐', '国沢剛', '岸下和樹']);
    expect(kagoCounts['塚原匡祐']).toBe(1);
    expect(kagoCounts['堀本和幸']).toBe(0);
    expect(kagoLastCoach).toBe('岸下和樹');
    for (let i = 1; i < results.length; i++) {
      expect(results[i].kagoCoach).not.toBe(results[i - 1].kagoCoach);
    }
  });

  it('全員欠席の試合日はカゴ＝該当者なし（null）になること', () => {
    const att: Record<string, Record<string, AttendanceStatus>> = { '4/26': {} };
    KAGO_COACH_ORDER.forEach((c) => (att['4/26'][c] = '×'));

    const { results } = assignKagoDuties(days(['4/26']), att, zero(KAGO_COACH_ORDER));
    expect(results[0].kagoCoach).toBeNull();
    expect(results[0].isMatch).toBe(true);
  });

  it('出席者が少なく候補が尽きる試合日は連続防止を緩めること', () => {
    const att: Record<string, Record<string, AttendanceStatus>> = { '4/26': {} };
    KAGO_COACH_ORDER.forEach((c) => (att['4/26'][c] = '×'));
    att['4/26']['塚原匡祐'] = '◯';

    const { results } = assignKagoDuties(days(['4/26']), att, zero(KAGO_COACH_ORDER), '塚原匡祐');
    expect(results[0].kagoCoach).toBe('塚原匡祐');
  });

  it('カゴはカゴ独自の累計で選ばれること（与えた累計が最少の人＝大串が選ばれる）', () => {
    // 固定順の末尾（大串）だけ累計0、他は高い → 順番ではなく累計で大串が選ばれる
    const kago = zero(KAGO_COACH_ORDER);
    KAGO_COACH_ORDER.forEach((c) => (kago[c] = 3));
    kago['大串洋尚'] = 0;

    const { results } = assignKagoDuties(days(['4/26']), presentDays(['4/26']), kago);
    expect(results[0].kagoCoach).toBe('大串洋尚');
  });

  it('試合日を渡さなければカゴ結果は出ず、assignDuties はカゴ＝null／isMatch＝false のままであること', () => {
    const { results } = assignDuties(
      days(['4/5']), presentDays(['4/5']),
      zero(COACH_ORDER), zero(VIDEO_COACH_ORDER),
    );
    expect(results[0].kagoCoach).toBeNull();
    expect(results[0].isMatch).toBe(false);

    const { results: kagoResults } = assignKagoDuties([], {}, zero(KAGO_COACH_ORDER));
    expect(kagoResults).toEqual([]);
  });

  it('カゴ当番候補も10名で林和憲を含まないこと', () => {
    expect(KAGO_COACH_ORDER).not.toContain('林和憲');
    expect(KAGO_COACH_ORDER.length).toBe(10);
  });
});

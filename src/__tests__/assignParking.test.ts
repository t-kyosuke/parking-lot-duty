import { describe, it, expect } from 'vitest';
import { assignDuties, assignKagoChain, isKagoCounted, computeKagoTakeHome } from '../lib/assignParking';
import type { AssignmentResult } from '../lib/assignParking';
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

describe('assignKagoChain（全セッションのカゴ運びを連鎖で割り当て）', () => {
  // ── カゴ用ヘルパー ──

  /** カゴのベース行（駐車場/ビデオ確定済み・カゴ未設定）を作る */
  function kagoBase(
    date: string,
    kind: 'sun' | 'sat' | 'match',
    opts: { coach?: string | null; videoCoach?: string | null } = {},
  ): AssignmentResult {
    return {
      date,
      dayOfWeek: kind === 'sat' ? '土' : '日',
      coach: kind === 'sun' ? (opts.coach ?? null) : null,
      videoCoach: kind === 'match' ? null : (opts.videoCoach ?? null),
      kagoCoach: null,
      practiceTime: '13:00-16:40',
      isSaturday: kind === 'sat',
      isMatch: kind === 'match',
    };
  }

  /** spec: 日付→出席◯のコーチ配列（それ以外は×） */
  function attFor(spec: Record<string, string[]>): Record<string, Record<string, AttendanceStatus>> {
    const att: Record<string, Record<string, AttendanceStatus>> = {};
    for (const [date, present] of Object.entries(spec)) {
      att[date] = {};
      KAGO_COACH_ORDER.forEach((c) => (att[date][c] = present.includes(c) ? '◯' : '×'));
    }
    return att;
  }

  const ALL = [...KAGO_COACH_ORDER];

  it('日曜：駐車場当番が前回も来ていれば、その人がカゴを運ぶ（カゴ係に数えない）', () => {
    const base = [kagoBase('4/5', 'sun', { coach: '塚原匡祐', videoCoach: '国沢剛' })];
    const seed = { holder: null, lastPresent: attFor({ prev: ALL }).prev };
    const { results, kagoCounts } = assignKagoChain(base, attFor({ '4/5': ALL }), zero(KAGO_COACH_ORDER), null, seed);
    expect(results[0].kagoCoach).toBe('塚原匡祐');         // 駐車場当番がそのまま
    expect(results[0].kagoCarriedByParking).toBe(true);
    expect(isKagoCounted(results[0])).toBe(false);          // 数えない
    expect(kagoCounts['塚原匡祐']).toBe(0);
  });

  it('日曜：駐車場当番が前回いなかった日は、別のカゴ係を指名（数える・当番と別人）', () => {
    const base = [kagoBase('4/12', 'sun', { coach: '塚原匡祐', videoCoach: '国沢剛' })];
    // 前回：塚原だけ欠席、他は出席
    const seed = { holder: null, lastPresent: attFor({ p: ALL.filter((c) => c !== '塚原匡祐') }).p };
    const { results, kagoCounts } = assignKagoChain(base, attFor({ '4/12': ALL }), zero(KAGO_COACH_ORDER), null, seed);
    expect(results[0].kagoCarriedByParking).toBe(false);
    expect(isKagoCounted(results[0])).toBe(true);            // 数える
    expect(results[0].kagoCoach).toBe('岸下和樹');           // 塚原(駐車場)・国沢(ビデオ)を避けた先頭
    expect(results[0].kagoCoach).not.toBe('塚原匡祐');
    expect(results[0].kagoCoach).not.toBe('国沢剛');
    expect(kagoCounts['岸下和樹']).toBe(1);
  });

  it('土曜：駐車場が無いので必ずカゴ係を指名（ビデオ当番は避ける）', () => {
    const base = [kagoBase('4/4', 'sat', { videoCoach: '国沢剛' })];
    const seed = { holder: null, lastPresent: attFor({ p: ALL }).p };
    const { results } = assignKagoChain(base, attFor({ '4/4': ALL }), zero(KAGO_COACH_ORDER), null, seed);
    expect(results[0].kagoCoach).toBe('塚原匡祐');           // 国沢(ビデオ)を避けた先頭
    expect(isKagoCounted(results[0])).toBe(true);
  });

  it('試合：前回セッションに来ていた出席者の中から累計最少（駐車場・ビデオは null）', () => {
    const base = [kagoBase('4/26', 'match')];
    const kago = zero(KAGO_COACH_ORDER);
    KAGO_COACH_ORDER.forEach((c) => (kago[c] = 3));
    kago['大串洋尚'] = 0; // 累計最少
    const seed = { holder: null, lastPresent: attFor({ p: ALL }).p };
    const { results } = assignKagoChain(base, attFor({ '4/26': ALL }), kago, null, seed);
    expect(results[0].kagoCoach).toBe('大串洋尚');
    expect(results[0].isMatch).toBe(true);
    expect(results[0].coach).toBeNull();
    expect(results[0].videoCoach).toBeNull();
  });

  it('前回も今日も来ている人がゼロ → 要確認＋現在の保持者を表示（数えない）', () => {
    const base = [kagoBase('4/4', 'sat', { videoCoach: '岸下和樹' })];
    // 前回は塚原・国沢のみ出席、今日は岸下・堀本のみ出席 → 重なりゼロ
    const seed = { holder: '前里元樹', lastPresent: attFor({ p: ['塚原匡祐', '国沢剛'] }).p };
    const { results } = assignKagoChain(base, attFor({ '4/4': ['岸下和樹', '堀本和幸'] }), zero(KAGO_COACH_ORDER), null, seed);
    expect(results[0].kagoNeedsConfirm).toBe(true);
    expect(results[0].kagoCoach).toBeNull();
    expect(results[0].kagoHolder).toBe('前里元樹');          // 連絡先＝今カゴを持っている人
    expect(isKagoCounted(results[0])).toBe(false);
  });

  it('要確認の日があっても連鎖は途切れず、次の日で再接続される', () => {
    const base = [
      kagoBase('4/4', 'sat', { videoCoach: '岸下和樹' }),
      kagoBase('4/5', 'sun', { coach: '岸下和樹', videoCoach: '堀本和幸' }),
    ];
    const seed = { holder: '前里元樹', lastPresent: attFor({ p: ['塚原匡祐', '国沢剛'] }).p };
    const att = attFor({ '4/4': ['岸下和樹', '堀本和幸'], '4/5': ['塚原匡祐', '岸下和樹'] });
    const { results } = assignKagoChain(base, att, zero(KAGO_COACH_ORDER), null, seed);
    expect(results[0].kagoNeedsConfirm).toBe(true);          // 4/4 は要確認
    // 4/5：駐車場の岸下は前回(=保持者の居た回)に居ないのでフォールバック。
    //      保持者がいた前回出席(塚原・国沢)∩今日(塚原・岸下)＝塚原 が運んで再接続
    expect(results[1].kagoNeedsConfirm).toBe(false);
    expect(results[1].kagoCoach).toBe('塚原匡祐');
  });

  it('引き継ぎ情報が無い（初回）ときは前回条件を緩める＝今日の出席者から選ぶ', () => {
    const base = [kagoBase('4/26', 'match')];
    // seed=null。今日は大串だけ出席 → 緩めて大串
    const { results } = assignKagoChain(base, attFor({ '4/26': ['大串洋尚'] }), zero(KAGO_COACH_ORDER), null, null);
    expect(results[0].kagoCoach).toBe('大串洋尚');
    expect(results[0].kagoNeedsConfirm).toBe(false);
  });

  it('連続でカゴ係を指名するとき、直前の運び手は避ける', () => {
    const base = [kagoBase('4/4', 'sat'), kagoBase('4/11', 'sat')];
    const seed = { holder: null, lastPresent: attFor({ p: ALL }).p };
    const att = attFor({ '4/4': ALL, '4/11': ALL });
    const { results } = assignKagoChain(base, att, zero(KAGO_COACH_ORDER), null, seed);
    expect(results.map((r) => r.kagoCoach)).toEqual(['塚原匡祐', '国沢剛']);
  });

  it('駐車場・ビデオの当番者は一切書き換えない（一方通行）', () => {
    const base = [kagoBase('4/5', 'sun', { coach: '塚原匡祐', videoCoach: '国沢剛' })];
    const seed = { holder: null, lastPresent: attFor({ p: ALL }).p };
    const { results } = assignKagoChain(base, attFor({ '4/5': ALL }), zero(KAGO_COACH_ORDER), null, seed);
    expect(results[0].coach).toBe('塚原匡祐');     // 駐車場 そのまま
    expect(results[0].videoCoach).toBe('国沢剛');  // ビデオ そのまま
  });

  it('前回欠席だった人は、今日来ていてもカゴ係に選ばれない（物理的に持っていない）', () => {
    const base = [kagoBase('4/4', 'sat')];
    // 前回：塚原だけ欠席。今日：全員出席。塚原は累計最少(0)だが前回いないので選ばれない
    const kago = zero(KAGO_COACH_ORDER);
    KAGO_COACH_ORDER.forEach((c) => (kago[c] = 5));
    kago['塚原匡祐'] = 0;
    const seed = { holder: null, lastPresent: attFor({ p: ALL.filter((c) => c !== '塚原匡祐') }).p };
    const { results } = assignKagoChain(base, attFor({ '4/4': ALL }), kago, null, seed);
    expect(results[0].kagoCoach).not.toBe('塚原匡祐');
  });

  it('カゴ係候補も10名で林和憲を含まないこと', () => {
    expect(KAGO_COACH_ORDER).not.toContain('林和憲');
    expect(KAGO_COACH_ORDER.length).toBe(10);
  });
});

describe('computeKagoTakeHome（その日の練習後に持ち帰る人＝次のカゴ利用日の担当者）', () => {
  // 新フォーマット（カゴ連鎖後）の1日分。新フラグを既定で付与＝computeKagoTakeHome が新方式で扱う
  const mk = (
    date: string,
    kagoCoach: string | null,
    extra: Partial<AssignmentResult> = {},
  ): AssignmentResult => ({
    date,
    dayOfWeek: '日',
    coach: null,
    videoCoach: null,
    kagoCoach,
    practiceTime: '13:00-16:40',
    isSaturday: false,
    isMatch: false,
    kagoCarriedByParking: false,
    kagoNeedsConfirm: false,
    ...extra,
  });

  it('各日の持ち帰り人＝次のカゴ利用日の担当者になること', () => {
    const a = [mk('7/4', '塚原匡祐'), mk('7/5', '国沢剛'), mk('7/11', '堀本和幸')];
    const th = computeKagoTakeHome(a);
    expect(th['7/4'].coach).toBe('国沢剛');   // 7/4の練習後は次回(7/5)の担当・国沢が持ち帰る
    expect(th['7/5'].coach).toBe('堀本和幸');
  });

  it('月内で最後のカゴ利用日は「翌月へ引き継ぎ」になること', () => {
    const a = [mk('7/4', '塚原匡祐'), mk('7/26', '松木正和')];
    const th = computeKagoTakeHome(a);
    expect(th['7/26'].carryToNextMonth).toBe(true);
    expect(th['7/26'].coach).toBeNull();
  });

  it('次のカゴ利用日が要確認なら needsConfirm＝true・今の担当者を holder に返すこと', () => {
    const a = [
      mk('7/4', '塚原匡祐'),
      mk('7/5', null, { kagoNeedsConfirm: true, kagoHolder: '塚原匡祐' }),
    ];
    const th = computeKagoTakeHome(a);
    expect(th['7/4'].needsConfirm).toBe(true);
    expect(th['7/4'].coach).toBeNull();
    expect(th['7/4'].holder).toBe('塚原匡祐');
  });

  it('日曜で駐車場当番がそのまま運ぶ日も、その人が持ち帰り先として返ること', () => {
    const a = [
      mk('7/4', '塚原匡祐', { isSaturday: true }),
      mk('7/5', '国沢剛', { coach: '国沢剛', kagoCarriedByParking: true }),
    ];
    const th = computeKagoTakeHome(a);
    expect(th['7/4'].coach).toBe('国沢剛');   // 7/5は国沢が駐車場のままカゴを持つ＝7/4の持ち帰りは国沢
  });

  it('入力の並び順が日付順でなくてもソートして計算すること', () => {
    const a = [mk('7/11', '堀本和幸'), mk('7/4', '塚原匡祐'), mk('7/5', '国沢剛')];
    const th = computeKagoTakeHome(a);
    expect(th['7/4'].coach).toBe('国沢剛');
    expect(th['7/5'].coach).toBe('堀本和幸');
    expect(th['7/11'].carryToNextMonth).toBe(true);
  });

  it('旧フォーマット（カゴ連鎖前・新フラグ無し）は従来どおりその日のカゴ担当を表示し、担当なしの日はエントリを作らない', () => {
    // 練習日は kagoCoach=null、試合日だけ担当あり、新フラグ（kagoCarriedByParking/kagoNeedsConfirm）は一切無い
    const legacy: AssignmentResult[] = [
      { date: '4/5', dayOfWeek: '日', coach: '塚原匡祐', videoCoach: '国沢剛', kagoCoach: null, practiceTime: '', isSaturday: false, isMatch: false },
      { date: '4/26', dayOfWeek: '日', coach: null, videoCoach: null, kagoCoach: '松木正和', practiceTime: '', isSaturday: false, isMatch: true },
      { date: '4/29', dayOfWeek: '祝', coach: '濱田広宣', videoCoach: '前里元樹', kagoCoach: null, practiceTime: '', isSaturday: false, isMatch: false },
    ];
    const th = computeKagoTakeHome(legacy);
    expect(th['4/26'].coach).toBe('松木正和');       // 試合日はその日の担当をそのまま表示
    expect(th['4/26'].carryToNextMonth).toBe(false); // 新方式の「翌月へ引き継ぎ」に退行しない
    expect(th['4/5']).toBeUndefined();                // カゴ担当のいない練習日はエントリ無し＝カゴ行を出さない
    expect(th['4/29']).toBeUndefined();
  });
});

describe('カゴ公平性シミュレーション（1年・出席80%・構造的な偏りあり）', () => {
  it('カゴ係の偏りが許容範囲で、要確認が頻発しないこと', () => {
    const coaches = [...KAGO_COACH_ORDER];

    // 出席を決定的に生成（テストを安定させるため乱数は使わない）
    // ベースは約80%出席。さらに構造的偏り：末尾2人は土曜にほぼ来ない／先頭2人は日曜に来にくい
    const present = (ci: number, si: number, isSat: boolean): boolean => {
      let p = ((ci * 3 + si * 7) % 10) >= 2; // 約80%
      if (isSat && ci >= 8) p = (si % 4) === 0;   // 河井・大串は土曜ほぼ不在
      if (!isSat && ci <= 1) p = (si % 3) === 0;  // 塚原・国沢は日曜来にくい（遠征等の想定）
      return p;
    };

    const WEEKS = 40;
    const base: AssignmentResult[] = [];
    const att: Record<string, Record<string, AttendanceStatus>> = {};
    let si = 0;
    for (let w = 0; w < WEEKS; w++) {
      for (const isSat of [true, false]) {
        const date = `${isSat ? 'S' : 'U'}${w}`;
        const isMatch = !isSat && w % 7 === 6; // たまに日曜が試合
        att[date] = {};
        const presentList: string[] = [];
        coaches.forEach((c, ci) => {
          const ok = present(ci, si, isSat);
          att[date][c] = ok ? '◯' : '×';
          if (ok) presentList.push(c);
        });
        // 駐車場当番（日曜・祝のみ）は出席者から決定的に1人（カゴはこれを読むだけ）
        const parking = !isSat && !isMatch && presentList.length > 0
          ? presentList[w % presentList.length]
          : null;
        const video = presentList.length > 1 ? presentList[(w + 1) % presentList.length] : null;
        base.push(
          isMatch
            ? kagoBaseSim(date, 'match')
            : kagoBaseSim(date, isSat ? 'sat' : 'sun', parking, video),
        );
        si++;
      }
    }

    const { results } = assignKagoChain(base, att, zeroCounts(coaches), null, null);

    // 集計：カゴ係として「数えた」回数
    const counted: Record<string, number> = {};
    coaches.forEach((c) => (counted[c] = 0));
    let needsConfirm = 0;
    let carriedByParking = 0;
    for (const r of results) {
      if (r.kagoNeedsConfirm) needsConfirm++;
      else if (r.kagoCarriedByParking) carriedByParking++;
      else if (r.kagoCoach) counted[r.kagoCoach]++;
    }

    const vals = coaches.map((c) => counted[c]);
    const gap = Math.max(...vals) - Math.min(...vals);

    // 結果を表示（ユーザー向けの「公平性の数字」）
    // eslint-disable-next-line no-console
    console.log('【カゴ公平性シミュレーション】全セッション数:', results.length,
      '/ カゴ係指名:', vals.reduce((a, b) => a + b, 0),
      '/ 駐車場当番が運んだ日:', carriedByParking,
      '/ 要確認:', needsConfirm,
      '\n  指名回数（最多−最少差=' + gap + '）:',
      coaches.map((c) => `${c}:${counted[c]}`).join(' '));

    // 要確認は全セッションの15%未満（構造的偏りを入れても連鎖が概ね保てる）
    expect(needsConfirm).toBeLessThan(results.length * 0.15);
    // カゴ係指名の偏り（最多−最少）が過大でない
    expect(gap).toBeLessThanOrEqual(8);
  });
});

// シミュレーション用ヘルパー（describe外でも使えるよう関数宣言）
function kagoBaseSim(
  date: string,
  kind: 'sun' | 'sat' | 'match',
  coach: string | null = null,
  videoCoach: string | null = null,
): AssignmentResult {
  return {
    date,
    dayOfWeek: kind === 'sat' ? '土' : '日',
    coach: kind === 'sun' ? coach : null,
    videoCoach: kind === 'match' ? null : videoCoach,
    kagoCoach: null,
    practiceTime: '13:00-16:40',
    isSaturday: kind === 'sat',
    isMatch: kind === 'match',
  };
}

function zeroCounts(order: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  order.forEach((x) => (c[x] = 0));
  return c;
}

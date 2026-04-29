import { describe, it, expect } from 'vitest';
import { assignParking, assignVideo, assignDuties } from '../lib/assignParking';
import { COACH_ORDER, VIDEO_COACH_ORDER } from '../lib/constants';
import type { AttendanceStatus } from '../lib/constants';
import type { AssignmentResult } from '../lib/assignParking';

describe('assignParking', () => {
  // 確定版テストデータ（SRS駐車場当番アサイナー_Claude_Code_プロンプト確定版_1.md より）
  // 注：林和憲は2026-04-27時点でCOACH_ORDERから除外（指導専念）。
  //     attendanceには互換のため林の出欠も残しているが、アルゴリズムは無視する。
  const testAttendance: Record<string, Record<string, AttendanceStatus>> = {
    '4/5': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '◯', '前里元樹': '△', '林和憲': '△', '松木正和': '◯',
      '橋戸佑介': '◯', '河井彩登': '◯', '大串洋尚': '◯',
    },
    '4/12': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '◯', '前里元樹': '△', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '◯', '河井彩登': '△', '大串洋尚': '◯',
    },
    '4/19': {
      '塚原匡祐': '◯', '国沢剛': '×', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '◯', '前里元樹': '◯', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '◯', '河井彩登': '×', '大串洋尚': '◯',
    },
    // 4/26 は交流試合のため対象外
    '4/29': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '×', '前里元樹': '◯', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '◯', '河井彩登': '×', '大串洋尚': '△',
    },
    '5/3': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '×',
      '濱田広宣': '×', '前里元樹': '◯', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '△', '河井彩登': '△', '大串洋尚': '△',
    },
    '5/5': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '×', '前里元樹': '◯', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '△', '河井彩登': '△', '大串洋尚': '◯',
    },
    '5/6': {
      '塚原匡祐': '◯', '国沢剛': '×', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '×', '前里元樹': '◯', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '△', '河井彩登': '△', '大串洋尚': '◯',
    },
    '5/10': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '◯', '前里元樹': '◯', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '△', '河井彩登': '△', '大串洋尚': '◯',
    },
    '5/17': {
      '塚原匡祐': '×', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '◯', '前里元樹': '△', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '△', '河井彩登': '△', '大串洋尚': '◯',
    },
    '5/24': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '◯', '前里元樹': '△', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '△', '河井彩登': '△', '大串洋尚': '◯',
    },
    '5/31': {
      '塚原匡祐': '◯', '国沢剛': '◯', '岸下和樹': '◯', '堀本和幸': '◯',
      '濱田広宣': '◯', '前里元樹': '△', '林和憲': '×', '松木正和': '◯',
      '橋戸佑介': '△', '河井彩登': '△', '大串洋尚': '◯',
    },
  };

  const practiceDays = [
    { date: '4/5', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    { date: '4/12', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    { date: '4/19', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    // 4/26 は試合のため含めない
    { date: '4/29', dayOfWeek: '祝', practiceTime: '13:00-16:40' },
    { date: '5/3', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    { date: '5/5', dayOfWeek: '祝', practiceTime: '9:00-12:00' },
    { date: '5/6', dayOfWeek: '祝', practiceTime: '13:00-16:40' },
    { date: '5/10', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    { date: '5/17', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    { date: '5/24', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    { date: '5/31', dayOfWeek: '日', practiceTime: '13:00-16:40' },
  ];

  it('確定版テストデータで期待出力と完全一致すること', () => {
    const { results, nextPointer, nextSearchFrom } = assignParking(practiceDays, testAttendance, 0);

    const expected = [
      { date: '4/5',  coach: '塚原匡祐' },
      { date: '4/12', coach: '国沢剛' },
      { date: '4/19', coach: '岸下和樹' },
      { date: '4/29', coach: '堀本和幸' },
      { date: '5/3',  coach: '前里元樹' },
      { date: '5/5',  coach: '松木正和' },
      { date: '5/6',  coach: '大串洋尚' },
      { date: '5/10', coach: '濱田広宣' },
      { date: '5/17', coach: '国沢剛' },
      { date: '5/24', coach: '塚原匡祐' },
      { date: '5/31', coach: '岸下和樹' },
    ];

    expect(results.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      expect(results[i].date).toBe(expected[i].date);
      expect(results[i].coach).toBe(expected[i].coach);
    }

    expect(nextPointer).toBe(3);
    expect(COACH_ORDER[nextPointer]).toBe('堀本和幸');
    expect(nextSearchFrom).toBe(3);
  });

  it('全員が×の日は該当者なしになること', () => {
    const allAbsent: Record<string, Record<string, AttendanceStatus>> = {
      '4/5': {},
    };
    COACH_ORDER.forEach(coach => {
      allAbsent['4/5'][coach] = '×';
    });

    const days = [{ date: '4/5', dayOfWeek: '日', practiceTime: '13:00-16:40' }];
    const { results } = assignParking(days, allAbsent, 0);

    expect(results[0].coach).toBeNull();
  });

  it('ポインタが正しく引き継がれること', () => {
    const attendance: Record<string, Record<string, AttendanceStatus>> = {
      '4/5': {},
    };
    COACH_ORDER.forEach(coach => {
      attendance['4/5'][coach] = '◯';
    });

    const days = [{ date: '4/5', dayOfWeek: '日', practiceTime: '13:00-16:40' }];
    const { results, nextPointer } = assignParking(days, attendance, 0);

    expect(results[0].coach).toBe('塚原匡祐');
    expect(nextPointer).toBe(1);

    const attendance2: Record<string, Record<string, AttendanceStatus>> = {
      '4/12': {},
    };
    COACH_ORDER.forEach(coach => {
      attendance2['4/12'][coach] = '◯';
    });

    const days2 = [{ date: '4/12', dayOfWeek: '日', practiceTime: '13:00-16:40' }];
    const { results: results2 } = assignParking(days2, attendance2, nextPointer);

    expect(results2[0].coach).toBe('国沢剛');
  });
});

describe('assignVideo（被り防止）', () => {
  it('駐車場当番と同じ人はビデオ当番からスキップされること', () => {
    // 全員出席の場合で、駐車場が塚原 → ビデオも塚原の番だがスキップして国沢になる
    const attendance: Record<string, Record<string, AttendanceStatus>> = {
      '4/5': {},
    };
    // 全員◯にする
    COACH_ORDER.forEach(coach => {
      attendance['4/5'][coach] = '◯';
    });

    // 駐車場当番が塚原のAssignmentResult
    const parkingResults: AssignmentResult[] = [{
      date: '4/5', dayOfWeek: '日', coach: '塚原匡祐', videoCoach: null,
      practiceTime: '13:00-16:40', isSaturday: false,
    }];

    // ビデオもポインタ0（塚原）から開始 → 被りでスキップ → 国沢になるはず
    const { results } = assignVideo(parkingResults, attendance, 0, VIDEO_COACH_ORDER, 0);

    expect(results[0].videoCoach).toBe('国沢剛');
    // 塚原はスキップされただけで、次回もまだ塚原の番（ポインタ消費なし）
  });

  it('被りスキップ後もポインタが正しく動くこと', () => {
    const attendance: Record<string, Record<string, AttendanceStatus>> = {
      '4/5': {}, '4/12': {},
    };
    COACH_ORDER.forEach(coach => {
      attendance['4/5'][coach] = '◯';
      attendance['4/12'][coach] = '◯';
    });

    // 2日間：駐車場は塚原→国沢
    const parkingResults: AssignmentResult[] = [
      { date: '4/5', dayOfWeek: '日', coach: '塚原匡祐', videoCoach: null, practiceTime: '13:00-16:40', isSaturday: false },
      { date: '4/12', dayOfWeek: '日', coach: '国沢剛', videoCoach: null, practiceTime: '13:00-16:40', isSaturday: false },
    ];

    // ビデオもポインタ0（塚原）から
    // 4/5: 塚原と被り → スキップ → 国沢...でも国沢はVIDEO_COACH_ORDERの[1]
    //   searchFromは0→国沢を見つけてsearchFrom=2(岸下)に。owedは0(塚原)のまま
    // 4/12: owedは塚原(0)、駐車場は国沢 → 塚原と被りなし → 塚原が当番。owed=searchFrom? no(0!=2)→owed=2(岸下)
    const { results, nextPointer } = assignVideo(parkingResults, attendance, 0, VIDEO_COACH_ORDER, 0);

    expect(results[0].videoCoach).toBe('国沢剛'); // 塚原被り→国沢
    expect(results[1].videoCoach).toBe('塚原匡祐'); // 塚原の番、国沢と被りなし→塚原OK
    expect(nextPointer).toBe(2); // 次は岸下
  });
});

describe('assignDuties（統合）', () => {
  it('土曜日は駐車場なし・ビデオありになること', () => {
    const attendance: Record<string, Record<string, AttendanceStatus>> = {
      '4/4': {},
    };
    COACH_ORDER.forEach(coach => {
      attendance['4/4'][coach] = '◯';
    });

    const days = [{ date: '4/4', dayOfWeek: '土', practiceTime: '13:00-16:40' }];
    const { results } = assignDuties(days, attendance, 0, 0, 0, 0);

    expect(results[0].coach).toBeNull(); // 駐車場なし
    expect(results[0].videoCoach).toBe('塚原匡祐'); // ビデオあり
    expect(results[0].isSaturday).toBe(true);
  });

  it('日曜日は駐車場あり・ビデオありになること（被り防止あり）', () => {
    const attendance: Record<string, Record<string, AttendanceStatus>> = {
      '4/5': {},
    };
    COACH_ORDER.forEach(coach => {
      attendance['4/5'][coach] = '◯';
    });

    const days = [{ date: '4/5', dayOfWeek: '日', practiceTime: '13:00-16:40' }];
    // 両方ポインタ0（塚原）から開始
    const { results } = assignDuties(days, attendance, 0, 0, 0, 0);

    expect(results[0].coach).toBe('塚原匡祐'); // 駐車場は塚原
    expect(results[0].videoCoach).toBe('国沢剛'); // ビデオは被り防止で国沢
  });

  it('土曜日でも駐車場ポインタは消費されないこと', () => {
    const attendance: Record<string, Record<string, AttendanceStatus>> = {
      '4/4': {}, '4/5': {},
    };
    COACH_ORDER.forEach(coach => {
      attendance['4/4'][coach] = '◯';
      attendance['4/5'][coach] = '◯';
    });

    // 土曜→日曜の順
    const days = [
      { date: '4/4', dayOfWeek: '土', practiceTime: '13:00-16:40' },
      { date: '4/5', dayOfWeek: '日', practiceTime: '13:00-16:40' },
    ];
    const { results, parkingNextPointer } = assignDuties(days, attendance, 0, 0, 0, 0);

    // 土曜は駐車場なし
    expect(results[0].coach).toBeNull();
    // 日曜は塚原（ポインタ0のまま消費されていない）
    expect(results[1].coach).toBe('塚原匡祐');
    // 次回は国沢（1）
    expect(parkingNextPointer).toBe(1);
  });

  it('土曜のビデオ当番は駐車場がnullなので被り防止は不要', () => {
    const attendance: Record<string, Record<string, AttendanceStatus>> = {
      '4/4': {},
    };
    COACH_ORDER.forEach(coach => {
      attendance['4/4'][coach] = '◯';
    });

    const days = [{ date: '4/4', dayOfWeek: '土', practiceTime: '13:00-16:40' }];
    // ビデオポインタ0（塚原）から
    const { results } = assignDuties(days, attendance, 0, 0, 0, 0);

    // 駐車場null→被りなし→塚原がそのままビデオ当番
    expect(results[0].videoCoach).toBe('塚原匡祐');
  });

  it('VIDEO_COACH_ORDERに林和憲が含まれないこと', () => {
    expect(VIDEO_COACH_ORDER).not.toContain('林和憲');
    expect(VIDEO_COACH_ORDER.length).toBe(10);
  });

  it('COACH_ORDER（駐車場）にも林和憲が含まれないこと（2026-04-27 〜）', () => {
    expect(COACH_ORDER).not.toContain('林和憲');
    expect(COACH_ORDER.length).toBe(10);
  });
});

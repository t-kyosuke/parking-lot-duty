import { describe, it, expect } from 'vitest';
import { assignParking } from '../lib/assignParking';
import { COACH_ORDER } from '../lib/constants';
import type { AttendanceStatus } from '../lib/constants';

describe('assignParking', () => {
  // 確定版テストデータ（SRS駐車場当番アサイナー_Claude_Code_プロンプト確定版_1.md より）
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

    // 期待される出力
    // 2ポインタ方式：borrowed(借り越し)中でも代役は毎回異なる人になる
    // 4/29以降、濱田が借り越し状態になるが代役は前里→松木→大串と順番に回る
    const expected = [
      { date: '4/5',  coach: '塚原匡祐' },  // 直接
      { date: '4/12', coach: '国沢剛' },    // 直接
      { date: '4/19', coach: '岸下和樹' },  // 直接
      { date: '4/29', coach: '堀本和幸' },  // 直接 → 次は濱田
      { date: '5/3',  coach: '前里元樹' },  // 濱田×→前里が代役（searchFrom→林へ）
      { date: '5/5',  coach: '松木正和' },  // 濱田×→林×→松木が代役（searchFrom→橋戸へ）
      { date: '5/6',  coach: '大串洋尚' },  // 濱田×→橋戸△・河井△→大串が代役（searchFrom→塚原へ）
      { date: '5/10', coach: '濱田広宣' },  // 濱田◯→借り越し解消（owed→塚原へ）
      { date: '5/17', coach: '国沢剛' },    // 塚原×→国沢が代役（searchFrom→岸下へ）
      { date: '5/24', coach: '塚原匡祐' },  // 塚原◯→借り越し解消（owed→岸下へ）
      { date: '5/31', coach: '岸下和樹' },  // 直接
    ];

    expect(results.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      expect(results[i].date).toBe(expected[i].date);
      expect(results[i].coach).toBe(expected[i].coach);
    }

    // 次回：堀本から（インデックス3）
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
    // 塚原(0)から開始して、塚原が◯なら当番に。次は国沢(1)から。
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

    // 続きから
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

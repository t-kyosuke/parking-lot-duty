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
    const { results, nextPointer } = assignParking(practiceDays, testAttendance, 0);

    // 期待される出力
    const expected = [
      { date: '4/5', coach: '塚原匡祐' },
      { date: '4/12', coach: '国沢剛' },
      { date: '4/19', coach: '岸下和樹' },
      { date: '4/29', coach: '堀本和幸' },
      { date: '5/3', coach: '前里元樹' },   // 濱田×のためスキップ
      { date: '5/5', coach: '松木正和' },   // 林×のためスキップ
      { date: '5/6', coach: '大串洋尚' },   // 橋戸△、河井△のためスキップ
      { date: '5/10', coach: '塚原匡祐' },
      { date: '5/17', coach: '国沢剛' },   // 塚原×のためスキップ
      { date: '5/24', coach: '岸下和樹' },
      { date: '5/31', coach: '堀本和幸' },
    ];

    expect(results.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      expect(results[i].date).toBe(expected[i].date);
      expect(results[i].coach).toBe(expected[i].coach);
    }

    // 次回開始位置: 堀本の次 = 濱田（インデックス4）
    expect(nextPointer).toBe(4); // 濱田のインデックス
    expect(COACH_ORDER[nextPointer]).toBe('濱田広宣');
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

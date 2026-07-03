import { describe, it, expect, beforeEach } from 'vitest';
import { COACH_ORDER } from '../lib/constants';
import type { AssignmentResult } from '../lib/assignParking';
import {
  saveMonthlyData,
  recalculateCumulativeCounts, setCumulativeCount,
  getParkingCounts, getVideoCounts, getKagoCounts,
  getParkingCarryover, saveParkingCarryover, saveKagoCarryover,
  getCountsForAssignment,
  exportAllData, importAllData, resetAllData,
} from '../lib/storage';
import type { MonthlyData } from '../lib/storage';

// storage.ts はブラウザの localStorage を使うため、Node（テスト）環境では簡易版で置き換える
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, String(value)); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
} as Storage;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });

const [C1, C2, C3] = COACH_ORDER; // 塚原・国沢・岸下

const mk = (date: string, over: Partial<AssignmentResult> = {}): AssignmentResult => ({
  date, dayOfWeek: '日', coach: null, videoCoach: null, kagoCoach: null,
  practiceTime: '', isSaturday: false, isMatch: false,
  kagoCarriedByParking: false, kagoNeedsConfirm: false, kagoHolder: null,
  ...over,
});

const month = (name: string, assignments: AssignmentResult[], confirmed = true): MonthlyData => ({
  month: name, schedule: [], attendance: {}, assignments, confirmed,
});

beforeEach(() => {
  store.clear();
});

describe('累計の再計算と繰越（2026-07-03 A-4）', () => {
  it('繰越なし：累計＝確定月の合計（従来どおり・後方互換）', () => {
    saveMonthlyData('4月', month('4月', [
      mk('4/5', { coach: C1 }),
      mk('4/12', { coach: C1, videoCoach: C2 }),
    ]));
    expect(getParkingCarryover()).toEqual({}); // 繰越キーが無い旧データでも動く
    const { parking, video } = recalculateCumulativeCounts();
    expect(parking[C1]).toBe(2);
    expect(parking[C2]).toBe(0);
    expect(video[C2]).toBe(1);
  });

  it('繰越あり：累計＝確定月の合計＋繰越', () => {
    saveMonthlyData('4月', month('4月', [mk('4/5', { coach: C1 })]));
    saveParkingCarryover({ [C1]: 5, [C2]: 2 });
    const { parking } = recalculateCumulativeCounts();
    expect(parking[C1]).toBe(6);
    expect(parking[C2]).toBe(2);
  });

  it('設定画面の調整（setCumulativeCount）は再計算しても消えない（恒久化＝今回の本命）', () => {
    saveMonthlyData('4月', month('4月', [mk('4/5', { coach: C1 })]));
    recalculateCumulativeCounts();

    // 新しいコーチに平均値をセットする等の調整（駐車場・ビデオ・カゴすべて）
    setCumulativeCount('parking', C2, 4);
    setCumulativeCount('video', C3, 2);
    setCumulativeCount('kago', C1, 3);
    expect(getParkingCounts()[C2]).toBe(4);
    expect(getVideoCounts()[C3]).toBe(2);
    expect(getKagoCounts()[C1]).toBe(3);

    // 従来はここ（割り当て時に呼ばれる再計算）で調整が消えていた
    recalculateCumulativeCounts();
    expect(getParkingCounts()[C2]).toBe(4);
    expect(getVideoCounts()[C3]).toBe(2);
    expect(getKagoCounts()[C1]).toBe(3);
    expect(getParkingCounts()[C1]).toBe(1); // 月合計分はそのまま
  });

  it('月合計より小さい値への調整（内部的にマイナス繰越）も維持される', () => {
    saveMonthlyData('4月', month('4月', [
      mk('4/5', { coach: C1 }),
      mk('4/12', { coach: C1 }),
    ]));
    recalculateCumulativeCounts();
    expect(getParkingCounts()[C1]).toBe(2);

    setCumulativeCount('parking', C1, 1); // 「次に優先されやすくする」ため減らす
    expect(getParkingCounts()[C1]).toBe(1);
    recalculateCumulativeCounts();
    expect(getParkingCounts()[C1]).toBe(1);
  });

  it('繰越がマイナス過多でも累計は0未満にならない', () => {
    saveParkingCarryover({ [C1]: -3 });
    const { parking } = recalculateCumulativeCounts();
    expect(parking[C1]).toBe(0);
  });

  it('割り当て入力（getCountsForAssignment）は繰越込みで、当月確定分だけ差し引く', () => {
    saveMonthlyData('4月', month('4月', [mk('4/5', { coach: C1 })]));
    saveParkingCarryover({ [C1]: 3 });
    recalculateCumulativeCounts(); // C1 = 1 + 3 = 4
    expect(getCountsForAssignment('4月', 'parking')[C1]).toBe(3); // 同月の再割り当て＝当月分を除外
    expect(getCountsForAssignment('5月', 'parking')[C1]).toBe(4); // 別の月＝そのまま
  });

  it('カゴ：兼任・要確認は数えず、繰越は加算される（既存ルールとの整合）', () => {
    saveMonthlyData('4月', month('4月', [
      mk('4/5', { kagoCoach: C1 }),                              // 指名＝数える
      mk('4/12', { kagoCoach: C2, kagoCarriedByParking: true }), // 駐車場当番の兼任＝数えない
      mk('4/19', { kagoNeedsConfirm: true }),                    // 要確認＝数えない
    ]));
    saveKagoCarryover({ [C2]: 2 });
    const { kago } = recalculateCumulativeCounts();
    expect(kago[C1]).toBe(1);
    expect(kago[C2]).toBe(2);
  });

  it('エクスポート→全リセット→インポートで繰越が復元される', () => {
    saveParkingCarryover({ [C1]: 7 });
    const json = exportAllData();

    resetAllData();
    expect(getParkingCarryover()).toEqual({});

    importAllData(json);
    expect(getParkingCarryover()).toEqual({ [C1]: 7 });
    recalculateCumulativeCounts();
    expect(getParkingCounts()[C1]).toBe(7);
  });
});

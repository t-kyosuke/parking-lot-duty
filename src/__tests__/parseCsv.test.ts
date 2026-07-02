import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvText } from '../lib/parseCsv';

// ヘッダー：当番候補3名（岸下はスペース入り＝照合テスト用）＋除外コーチ1名（茂木）
const HEADER = '日程,塚原匡祐,国沢剛,岸下 和樹,茂木隼人';

/** 調整さんの実際の出力形式（メタデータ2行＋ヘッダー＋データ行＋コメント行）を再現する */
function chouseisanCsv(rows: string[]): string {
  return [
    '2026年SRS3年コーチ出欠確認',
    'コーチ陣の出欠確認こちらでお願いします',
    HEADER,
    ...rows,
    'コメント,,,,祝日もよろしくお願いします',
  ].join('\n');
}

describe('parseCsvText - 従来挙動の固定（正常系）', () => {
  it('調整さん形式のCSVから日付・曜日・練習時間・出欠を取り込める', () => {
    const result = parseCsvText(chouseisanCsv([
      '4/5(日) 13:00-16:40,◯,△,×,◯',
      '4/11(土) 13:40-16:40,×,◯,△,×',
    ]));

    expect(result.days).toHaveLength(2);
    expect(result.days[0]).toMatchObject({
      date: '4/5',
      dayOfWeek: '日',
      practiceTime: '13:00-16:40',
      isMatch: false,
      isCamp: false,
    });
    expect(result.days[1]).toMatchObject({ date: '4/11', dayOfWeek: '土' });
    expect(result.attendance['4/5']).toEqual({
      '塚原匡祐': '◯',
      '国沢剛': '△',
      '岸下和樹': '×',
    });
    expect(result.duplicateDays).toEqual([]);
  });

  it('スペース入りの名前は正規化して照合し、当番候補以外の出欠は取り込まない', () => {
    const result = parseCsvText(chouseisanCsv(['4/5(日) 13:00-16:40,◯,◯,◯,◯']));

    // 「岸下 和樹」（CSV側）→「岸下和樹」（名簿側）に照合される
    expect(result.attendance['4/5']['岸下和樹']).toBe('◯');
    expect(result.attendance['4/5']).not.toHaveProperty('岸下 和樹');
    // 除外コーチ（茂木）は出欠に含まれないが、全コーチ名一覧には残る
    expect(result.attendance['4/5']).not.toHaveProperty('茂木隼人');
    expect(result.allCoachNames).toEqual(['塚原匡祐', '国沢剛', '岸下 和樹', '茂木隼人']);
  });

  it('先頭のメタデータ行と末尾のコメント行はスキップされる', () => {
    const result = parseCsvText(chouseisanCsv(['4/5(日) 13:00-16:40,◯,◯,◯,◯']));
    expect(result.days).toHaveLength(1);
  });

  it('ヘッダーが1行目にあるCSVでも動く（「日程」行の動的検出）', () => {
    const result = parseCsvText([HEADER, '4/5(日),◯,△,×,◯'].join('\n'));
    expect(result.days).toHaveLength(1);
    expect(result.days[0].practiceTime).toBe(''); // 時間なしは空
  });

  it('空欄・不明な記号は△（未定）として取り込む', () => {
    const result = parseCsvText(chouseisanCsv(['4/5(日),◯,,?,×']));
    expect(result.attendance['4/5']).toEqual({
      '塚原匡祐': '◯',
      '国沢剛': '△',
      '岸下和樹': '△',
    });
  });

  it('記号のバリエーション（○・O・o／x・X・✗）を正規化する', () => {
    // ○=U+25CB（白丸）、✗=U+2717。正規化先の◯はU+25EF（大きな白丸）
    const result = parseCsvText(chouseisanCsv([
      '4/5(日),○,O,o,◯',
      '4/12(日),x,X,✗,◯',
    ]));
    expect(result.attendance['4/5']).toEqual({
      '塚原匡祐': '◯',
      '国沢剛': '◯',
      '岸下和樹': '◯',
    });
    expect(result.attendance['4/12']).toEqual({
      '塚原匡祐': '×',
      '国沢剛': '×',
      '岸下和樹': '×',
    });
  });

  it('同日複数行は最初の行を採用し、重複日として報告する', () => {
    const result = parseCsvText(chouseisanCsv([
      '4/5(日) 13:00-16:40,◯,◯,◯,◯',
      '4/5(日) 9:00-12:00,×,×,×,×',
    ]));
    expect(result.days).toHaveLength(1);
    expect(result.attendance['4/5']['塚原匡祐']).toBe('◯'); // 最初の行
    expect(result.duplicateDays).toEqual(['4/5']);
  });

  it('「試合」「合宿」キーワードで種別を自動判定する', () => {
    const result = parseCsvText(chouseisanCsv([
      '4/26(日) 交流試合,◯,◯,◯,◯',
      '9/13(日) 神鍋合宿,◯,◯,◯,◯',
    ]));
    expect(result.days[0]).toMatchObject({ date: '4/26', isMatch: true, isCamp: false });
    expect(result.days[1]).toMatchObject({ date: '9/13', isMatch: false, isCamp: true });
  });

  it('練習時間の環境依存ダッシュ（–）はハイフンに正規化する', () => {
    const result = parseCsvText(chouseisanCsv(['4/5(日) 13:00–16:40,◯,◯,◯,◯']));
    expect(result.days[0].practiceTime).toBe('13:00-16:40');
  });

  it('UTF-8 BOM付きのテキストも読める', () => {
    const result = parseCsvText('\uFEFF' + chouseisanCsv(['4/5(日),◯,◯,◯,◯']));
    expect(result.days).toHaveLength(1);
  });
});

describe('parseCsvText - 異常系', () => {
  it('空・行数不足のCSVはエラーになる', () => {
    expect(() => parseCsvText('')).toThrow(/行数不足/);
    expect(() => parseCsvText('日程,塚原匡祐')).toThrow(/行数不足/);
  });

  it('「日程」ヘッダーが無いCSVはエラーになる', () => {
    expect(() => parseCsvText('なまえ,こうち\n4/5(日),◯')).toThrow(/日程/);
  });
});

describe('parseCsvText - クォート付きセル対応（2026-07-03追加・列ズレ防止）', () => {
  it('ラベル内にカンマがあっても列がズレず、出欠が正しいコーチに紐づく', () => {
    const result = parseCsvText(chouseisanCsv([
      '"4/26(日) 交流試合,雨天中止",◯,△,×,◯',
    ]));
    expect(result.days[0]).toMatchObject({
      date: '4/26',
      rawLabel: '4/26(日) 交流試合,雨天中止',
      isMatch: true,
    });
    // 列ズレしていれば 塚原=△ になってしまう
    expect(result.attendance['4/26']).toEqual({
      '塚原匡祐': '◯',
      '国沢剛': '△',
      '岸下和樹': '×',
    });
  });

  it('クォート付きのヘッダー名も照合される', () => {
    const csv = [
      '日程,"塚原匡祐","国沢剛","岸下 和樹",茂木隼人',
      '4/5(日),◯,△,×,◯',
    ].join('\n');
    const result = parseCsvText(csv);
    expect(result.attendance['4/5']).toEqual({
      '塚原匡祐': '◯',
      '国沢剛': '△',
      '岸下和樹': '×',
    });
  });

  it('クォート内の "" は " 1文字として扱う', () => {
    const result = parseCsvText(chouseisanCsv([
      '"4/26(日) ""交流試合""",◯,△,×,◯',
    ]));
    expect(result.days[0].rawLabel).toBe('4/26(日) "交流試合"');
    expect(result.days[0].isMatch).toBe(true);
  });

  it('クォートの無い普通のCSVは従来と完全に同じ結果になる', () => {
    const plain = parseCsvText(chouseisanCsv(['4/5(日) 13:00-16:40,◯,△,×,◯']));
    const quoted = parseCsvText(chouseisanCsv(['"4/5(日) 13:00-16:40",◯,△,×,◯']));
    expect(quoted.days).toEqual(plain.days);
    expect(quoted.attendance).toEqual(plain.attendance);
  });
});

describe('parseCsvText - 「〇」（漢数字ゼロ）対応（2026-07-03追加）', () => {
  it('〇（U+3007）を出席◯として扱う', () => {
    const result = parseCsvText(chouseisanCsv(['4/5(日),〇,◯,△,×']));
    expect(result.attendance['4/5']['塚原匡祐']).toBe('◯');
  });
});

describe('parseCsv - ファイル経由（エンコーディング）', () => {
  it('UTF-8（BOM付き）のファイルを読み込める', async () => {
    const text = '\uFEFF' + chouseisanCsv(['4/5(日) 13:00-16:40,◯,△,×,◯']);
    const file = new File([new TextEncoder().encode(text)], 'test.csv', { type: 'text/csv' });
    const result = await parseCsv(file);
    expect(result.days).toHaveLength(1);
    expect(result.attendance['4/5']['塚原匡祐']).toBe('◯');
  });

  it('UTF-8（BOMなし）のファイルも読み込める', async () => {
    const file = new File(
      [new TextEncoder().encode(chouseisanCsv(['4/5(日),◯,◯,◯,◯']))],
      'test.csv',
    );
    const result = await parseCsv(file);
    expect(result.days).toHaveLength(1);
  });
});

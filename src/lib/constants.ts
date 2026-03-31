// 当番候補コーチ（この固定順で循環）
export const COACH_ORDER: string[] = [
  '塚原匡祐',
  '国沢剛',
  '岸下和樹',
  '堀本和幸',
  '濱田広宣',
  '前里元樹',
  '林和憲',
  '松木正和',
  '橋戸佑介',
  '河井彩登',
  '大串洋尚',
];

// コーチの苗字マップ（表示用）
export const COACH_LAST_NAMES: Record<string, string> = {
  '塚原匡祐': '塚原',
  '国沢剛': '国沢',
  '岸下和樹': '岸下',
  '堀本和幸': '堀本',
  '濱田広宣': '濱田',
  '前里元樹': '前里',
  '林和憲': '林',
  '松木正和': '松木',
  '橋戸佑介': '橋戸',
  '河井彩登': '河井',
  '大串洋尚': '大串',
};

// 除外コーチ（駐車場当番にアサインしない）
export const EXCLUDED_COACHES: string[] = [
  '茂木隼人',
  '外山岳',
  '後藤直大',
  '葛野喜嗣',
  '中山義教',
  '梶岡圭太',
  '小松原英',
  '植村始',
  '安岡誠司',
];

// 日程の種別
export type DayType = 'practice' | 'match' | 'camp' | 'off' | 'special';

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  practice: '練習',
  match: '試合',
  camp: '合宿',
  off: '休み',
  special: '運動会等',
};

// 出欠記号
export type AttendanceStatus = '◯' | '△' | '×';

// 年間スケジュール：試合・合宿日（デフォルト設定）
export const DEFAULT_MATCH_DAYS: string[] = [
  '4/26', // 交流試合
  '6/14', // 交流試合
  '6/28', // 交流試合
  '10/12', // 交流試合
  '11/6', // 三校交流試合
  '2/23', // 交流試合
];

export const DEFAULT_CAMP_DAYS: string[] = [
  '9/13', // 神鍋合宿期間中
];

// 試合キーワード
export const MATCH_KEYWORDS = ['試合', '交流試合', 'フェスティバル'];
export const CAMP_KEYWORDS = ['合宿'];

// 2026年度の日曜・祝日カレンダーとデフォルトの練習時間
export interface ScheduleDay {
  date: string;      // "4/5" 形式
  dayOfWeek: string;  // "日" | "祝" 等
  type: DayType;
  practiceTime: string; // "13:00-16:40" 等
}

export const DEFAULT_SCHEDULE: ScheduleDay[] = [
  // 4月
  { date: '4/5', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '4/12', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '4/19', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '4/26', dayOfWeek: '日', type: 'match', practiceTime: '9:00-17:00' },
  { date: '4/29', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  // 5月
  { date: '5/3', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '5/5', dayOfWeek: '祝', type: 'practice', practiceTime: '9:00-12:00' },
  { date: '5/6', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '5/10', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '5/17', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '5/24', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '5/31', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 6月
  { date: '6/7', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '6/14', dayOfWeek: '日', type: 'match', practiceTime: '9:00-17:00' },
  { date: '6/21', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '6/28', dayOfWeek: '日', type: 'match', practiceTime: '9:00-13:30' },
  // 7月
  { date: '7/5', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '7/12', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '7/19', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '7/20', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '7/26', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 8月
  { date: '8/2', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '8/9', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '8/11', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '8/16', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '8/23', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '8/30', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 9月
  { date: '9/6', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '9/13', dayOfWeek: '日', type: 'camp', practiceTime: '' },
  { date: '9/20', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '9/21', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '9/22', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '9/23', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '9/27', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 10月
  { date: '10/4', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '10/11', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '10/12', dayOfWeek: '祝', type: 'match', practiceTime: '9:00-16:40' },
  { date: '10/18', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '10/25', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 11月
  { date: '11/1', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '11/3', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '11/6', dayOfWeek: '日', type: 'match', practiceTime: '9:00-17:00' },
  { date: '11/8', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '11/15', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '11/22', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '11/23', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '11/29', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 12月
  { date: '12/6', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '12/13', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '12/20', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '12/27', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 1月
  { date: '1/1', dayOfWeek: '祝', type: 'off', practiceTime: '' },
  { date: '1/3', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '1/10', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '1/11', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '1/17', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '1/24', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '1/31', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 2月
  { date: '2/7', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '2/11', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '2/14', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '2/21', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '2/23', dayOfWeek: '祝', type: 'match', practiceTime: '9:00-16:40' },
  { date: '2/28', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  // 3月
  { date: '3/7', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '3/14', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '3/20', dayOfWeek: '祝', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '3/21', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
  { date: '3/28', dayOfWeek: '日', type: 'practice', practiceTime: '13:00-16:40' },
];

// 月名リスト（年度ベース）
export const MONTHS = [
  '4月', '5月', '6月', '7月', '8月', '9月',
  '10月', '11月', '12月', '1月', '2月', '3月',
];

// デフォルト管理者パスワード
export const DEFAULT_ADMIN_PASSWORD = 'srs2026';

// localStorage キー
export const STORAGE_KEYS = {
  MONTHLY_DATA: 'srs_monthly_data',
  COACH_CONFIG: 'srs_coach_config',
  CUMULATIVE_COUNTS: 'srs_cumulative_counts',
  POINTER: 'srs_pointer',
  CHANGE_HISTORY: 'srs_change_history',
  ADMIN_PASSWORD: 'srs_admin_password',
  SCHEDULE: 'srs_schedule',
} as const;

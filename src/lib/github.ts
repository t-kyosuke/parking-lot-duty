import { getAllMonthlyData, getSchedule } from './storage';
import type { MonthlyData } from './storage';
import type { ScheduleDay } from './constants';

// ── GitHub 連携（「公開する」＝ data.json を gh-pages ブランチへコミット）──
// storage.ts から分離（2026-07-05 B-5）。トークンは localStorage（srs_github_token）に保持し、
// エクスポート/インポート（storage.ts）には意図的に含めない。

const GITHUB_TOKEN_KEY = 'srs_github_token';
const GITHUB_REPO = 't-kyosuke/parking-lot-duty';
const GITHUB_DATA_PATH = 'data.json';
const GITHUB_BRANCH = 'gh-pages';

export interface PublishedData {
  monthlyData: Record<string, MonthlyData>;
  schedule: ScheduleDay[];
  updatedAt: string;
}

export function getGithubToken(): string {
  return localStorage.getItem(GITHUB_TOKEN_KEY) ?? '';
}

export function saveGithubToken(token: string): void {
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
}

async function fetchCurrentDataJsonSha(token: string, apiUrl: string): Promise<string | undefined> {
  // クエリにタイムスタンプを付けてキャッシュ回避（GitHub APIのCORSを壊さないようヘッダーは最小限）
  const url = `${apiUrl}?ref=${GITHUB_BRANCH}&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return undefined;
  const fileData = await res.json() as { sha: string };
  return fileData.sha;
}

export async function publishToGithub(token: string): Promise<void> {
  const data: PublishedData = {
    monthlyData: getAllMonthlyData(),
    schedule: getSchedule(),
    updatedAt: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const content = btoa(unescape(encodeURIComponent(jsonStr)));
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`;

  // 1〜2回試行（SHAがキャッシュされていた場合のリカバリ用）
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await fetchCurrentDataJsonSha(token, apiUrl);

    const body: Record<string, string | undefined> = {
      message: `スケジュールデータを更新 (${new Date().toLocaleDateString('ja-JP')})`,
      content,
      branch: GITHUB_BRANCH,
      sha,
    };
    if (!sha) delete body.sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (putRes.ok) {
      return; // 成功
    }

    const err = await putRes.json().catch(() => ({})) as { message?: string };
    lastError = err.message ?? '不明なエラー';

    // SHA不一致エラーなら、最新SHAを取り直して再試行
    const isShaMismatch = putRes.status === 409 ||
      (lastError && lastError.includes('does not match'));
    if (!isShaMismatch) break;
  }

  throw new Error(lastError ?? 'GitHub APIへの公開に失敗しました');
}

export async function fetchPublishedData(): Promise<PublishedData | null> {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/gh-pages/data.json`;
    const res = await fetch(rawUrl);
    if (!res.ok) return null;
    return await res.json() as PublishedData;
  } catch {
    return null;
  }
}

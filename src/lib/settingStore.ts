import { isServerMode, backend } from '@/lib/backend';

export const SETTING_KEYS = [
  'ohome.theme.v2', 'ohome.themePresets.v1', 'ohome.fonts.v2', 'ohome.menuset.v1', 'ohome.site.v1',
  'ohome.pagetext.v1', 'ohome.cursor.v1', 'ohome.bgm.v1', 'ohome.boardset.v1', 'ohome.boards.v1',
  'ohome.commset.v1', 'ohome.memoset.v1', 'ohome.threadset.v1', 'ohome.trpgset.v1',
  'ohome.relqsets.v1', 'ohome.main.v1', 'ohome.sched.v1',
  'ohome.membertags.v1', 'ohome.invite.v1', 'ohome.roadnext.v1', 'ohome.repo.v1',
  'ohome.sections.v1', 'ohome.intro.v1', 'ohome.links.v1',
  'ohome.memberroles.v1', // <--- 회원 권한 저장을 위한 설정 키 추가
];

const memoryCache = new Map<string, unknown>();
const unsyncedKeys = new Set<string>();

export function getSetting<T>(key: string, fallback: T): T {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as T;
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // 로컬 스토리지 읽기 실패 시 무시
  }
  return fallback;
}

export function setSetting<T>(key: string, value: T): void {
  memoryCache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (isServerMode()) {
      unsyncedKeys.add(key);
      void syncKeyToServer(key, value);
    }
  } catch {
    // 로컬 스토리지 쓰기 실패 시 무시
  }
}

async function syncKeyToServer(key: string, value: unknown): Promise<void> {
  const be = backend();
  if (!be) return;
  try {
    await be.saveSetting(key, value);
    unsyncedKeys.delete(key);
  } catch {
    // 서버 동기화 실패 시 유지
  }
}

export function unsyncedSettingKeys(): string[] {
  return Array.from(unsyncedKeys);
}

export async function pushLocalSettings(keys: string[]): Promise<number> {
  const be = backend();
  if (!be) return 0;
  let count = 0;
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        await be.saveSetting(k, parsed);
        unsyncedKeys.delete(k);
        count++;
      } catch {
        // 개별 키 업로드 실패 시 계속 진행
      }
    }
  }
  return count;
}

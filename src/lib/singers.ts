import { apiBaseUrl } from './songs';

export type SingerRole = 'viewer' | 'editor' | 'admin';

export interface SingerUser {
  id: string;
  name: string;
  email: string;
  role: SingerRole;
  centerIds: number[];
  editorFor: number[];
}

export interface Singer {
  id: string;
  name: string;
  email?: string;
  gender?: string;
  pitchCount?: number;
  centerIds: number[];
  isAdmin: boolean;
  editorFor: number[];
}

export interface SingerSongPitch {
  id?: string;
  singerId: string;
  singerName?: string;
  singerGender?: string;
  songId: string;
  songName?: string;
  pitch: string;
}

export interface AccountCenter {
  id: number;
  name: string;
  badgeTextColor?: string;
  editorIds?: string[];
  singerCount?: number;
}

export interface SingerInput {
  name: string;
  gender: string;
  email?: string;
  centerIds: number[];
}

export interface CenterInput {
  name: string;
  badgeTextColor: string;
  editorIds: string[];
}

interface SessionResponse {
  authenticated: boolean;
  user?: SingerUser;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The service returned an unexpected response.');
  }
  return value as Record<string, unknown>;
}

function normalizeSingerUser(value: unknown, roleOverride?: unknown): SingerUser {
  const row = asRecord(value);
  const id = row.id ?? row.ID;
  const name = row.name ?? row.NAME;
  const email = row.email ?? row.EMAIL;
  const role = roleOverride ?? row.role ?? row.ROLE;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof email !== 'string') {
    throw new Error('The login service returned an invalid user.');
  }
  if (role !== 'viewer' && role !== 'editor' && role !== 'admin') {
    throw new Error('The login service returned an invalid account role.');
  }
  const centerIds = row.centerIds ?? row.center_ids ?? row.CENTER_IDS;
  const editorFor = row.editorFor ?? row.editor_for ?? row.EDITOR_FOR;

  return {
    id,
    name,
    email,
    role,
    centerIds: Array.isArray(centerIds) ? centerIds.filter((centerId): centerId is number => typeof centerId === 'number') : [],
    editorFor: Array.isArray(editorFor) ? editorFor.filter((centerId): centerId is number => typeof centerId === 'number') : [],
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const message = typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : `The service returned ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

function normalizeSinger(value: unknown): Singer {
  const row = asRecord(value);
  const id = row.id ?? row.ID;
  const name = row.name ?? row.NAME;
  const gender = row.gender ?? row.GENDER;
  const pitchCount = row.pitchCount ?? row.pitch_count ?? row.PITCH_COUNT;
  const email = row.email ?? row.EMAIL;
  const centerIds = row.centerIds ?? row.center_ids ?? row.CENTER_IDS;
  const editorFor = row.editorFor ?? row.editor_for ?? row.EDITOR_FOR;
  const isAdmin = row.isAdmin ?? row.is_admin ?? row.IS_ADMIN;

  if (typeof id !== 'string' || typeof name !== 'string') {
    throw new Error('The singers service returned an invalid record.');
  }

  return {
    id,
    name,
    email: typeof email === 'string' ? email : undefined,
    gender: typeof gender === 'string' ? gender : undefined,
    pitchCount: pitchCount == null ? undefined : Number(pitchCount),
    centerIds: Array.isArray(centerIds) ? centerIds.map(Number).filter(Number.isFinite) : [],
    isAdmin: isAdmin === true || isAdmin === 1 || isAdmin === '1',
    editorFor: Array.isArray(editorFor) ? editorFor.map(Number).filter(Number.isFinite) : [],
  };
}

function normalizeCenter(value: unknown): AccountCenter {
  const row = asRecord(value);
  const rawId = row.id ?? row.ID;
  const id = typeof rawId === 'number' ? rawId : Number(rawId);
  const name = row.name ?? row.NAME;
  const badgeTextColor = row.badgeTextColor ?? row.badge_text_color ?? row.BADGE_TEXT_COLOR;
  const editorIds = row.editorIds ?? row.editor_ids ?? row.EDITOR_IDS;
  const singerCount = row.singerCount ?? row.singer_count ?? row.SINGER_COUNT;
  if (!Number.isFinite(id) || typeof name !== 'string') return { id: Number.NaN, name: '' };
  return {
    id,
    name,
    badgeTextColor: typeof badgeTextColor === 'string' ? badgeTextColor : undefined,
    editorIds: Array.isArray(editorIds) ? editorIds.filter((userId): userId is string => typeof userId === 'string') : [],
    singerCount: singerCount == null ? undefined : Number(singerCount),
  };
}

async function fetchCentersFrom(path: string): Promise<AccountCenter[]> {
  const result = await request<unknown>(path);
  if (!Array.isArray(result)) throw new Error('The centers service returned an unexpected response.');
  return result.map(normalizeCenter).filter((center) => Number.isFinite(center.id));
}

function normalizePitch(value: unknown): SingerSongPitch {
  const row = asRecord(value);
  const singerId = row.singerId ?? row.singer_id ?? row.SINGER_ID;
  const songId = row.songId ?? row.song_id ?? row.SONG_ID;
  const pitch = row.pitch ?? row.PITCH;
  const id = row.id ?? row.ID;
  const singerName = row.singerName ?? row.singer_name ?? row.SINGER_NAME;
  const singerGender = row.singerGender ?? row.singer_gender ?? row.SINGER_GENDER;
  const songName = row.songName ?? row.song_name ?? row.SONG_NAME;

  if (typeof singerId !== 'string' || typeof songId !== 'string' || pitch == null) {
    throw new Error('The pitch service returned an invalid association.');
  }

  return {
    id: typeof id === 'string' ? id : undefined,
    singerId,
    singerName: typeof singerName === 'string' ? singerName : undefined,
    singerGender: typeof singerGender === 'string' ? singerGender : undefined,
    songId,
    songName: typeof songName === 'string' ? songName : undefined,
    pitch: String(pitch),
  };
}

export async function getSingerSession(): Promise<SessionResponse> {
  const value = await request<unknown>('/auth/session');
  const result = asRecord(value);
  if (result.authenticated !== true || !result.user) return { authenticated: false };
  return { authenticated: true, user: normalizeSingerUser(result.user) };
}

export async function requestSingerLoginCode(email: string): Promise<void> {
  await request('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifySingerLoginCode(email: string, code: string): Promise<SingerUser> {
  const value = await request<unknown>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
  const result = asRecord(value);
  if (!result.user) throw new Error('The login service did not return a user.');
  return normalizeSingerUser(result.user, result.role);
}

export async function isReviewLoginAvailable(): Promise<boolean> {
  const value = await request<unknown>('/auth/review-login/config');
  return asRecord(value).enabled === true;
}

export async function verifyReviewLogin(email: string, password: string): Promise<SingerUser> {
  const value = await request<unknown>('/auth/review-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const result = asRecord(value);
  if (!result.user) throw new Error('The review sign-in service did not return a user.');
  return normalizeSingerUser(result.user, result.role);
}

export async function submitFeedback(input: { feedback: string; email?: string; context?: string; category?: 'bug' | 'feature' | 'improvement' | 'question' | 'other' }): Promise<void> {
  await request('/feedback', {
    method: 'POST',
    body: JSON.stringify({
      feedback: input.context ? `[${input.context}] ${input.feedback}` : input.feedback,
      category: input.category || 'other',
      email: input.email || undefined,
      url: 'app://sssbhajanstudio',
    }),
  });
}

export async function logoutSingerSession(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function fetchAccountCenters(): Promise<AccountCenter[]> {
  return fetchCentersFrom('/centers');
}

export async function fetchEditableCenters(): Promise<AccountCenter[]> {
  return fetchCentersFrom('/centers/editable');
}

export async function createAccountCenter(input: CenterInput): Promise<AccountCenter> {
  return normalizeCenter(await request<unknown>('/centers', { method: 'POST', body: JSON.stringify(input) }));
}

export async function updateAccountCenter(centerId: number, input: CenterInput): Promise<AccountCenter> {
  return normalizeCenter(await request<unknown>(`/centers/${centerId}`, { method: 'PUT', body: JSON.stringify(input) }));
}

export async function deleteAccountCenter(centerId: number): Promise<void> {
  await request(`/centers/${centerId}`, { method: 'DELETE' });
}

export async function fetchSingers(): Promise<Singer[]> {
  const result = await request<unknown>('/singers');
  if (!Array.isArray(result)) throw new Error('The singers service returned an unexpected response.');
  return result.map(normalizeSinger).sort((first, second) => first.name.localeCompare(second.name));
}

export async function createSingerProfile(input: SingerInput): Promise<Singer> {
  return normalizeSinger(await request<unknown>('/singers', { method: 'POST', body: JSON.stringify(input) }));
}

export async function updateSingerProfile(singerId: string, input: SingerInput): Promise<void> {
  await request(`/singers/${encodeURIComponent(singerId)}`, { method: 'PUT', body: JSON.stringify(input) });
}

export async function deleteSingerProfile(singerId: string): Promise<void> {
  await request(`/singers/${encodeURIComponent(singerId)}`, { method: 'DELETE' });
}

export async function fetchSingerSongPitches(): Promise<SingerSongPitch[]> {
  const result = await request<unknown>('/pitches');
  if (!Array.isArray(result)) throw new Error('The pitch service returned an unexpected response.');
  return result.map(normalizePitch);
}

export async function createSingerSongPitch(input: { songId: string; singerId: string; pitch: string }): Promise<SingerSongPitch> {
  const result = await request<unknown>('/pitches', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizePitch(result);
}

export async function updateSingerSongPitch(pitchId: string, pitch: string): Promise<void> {
  await request(`/pitches/${encodeURIComponent(pitchId)}`, {
    method: 'PUT',
    body: JSON.stringify({ pitch }),
  });
}

export async function deleteSingerSongPitch(pitchId: string): Promise<void> {
  await request(`/pitches/${encodeURIComponent(pitchId)}`, { method: 'DELETE' });
}
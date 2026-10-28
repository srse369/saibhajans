import { apiBaseUrl } from './songs';

export interface PresentationItem {
  id: string;
  songId: string;
  songName: string;
  singerId?: string;
  singerName?: string;
  singerGender?: string;
  pitch?: string;
  language?: string | null;
  deity?: string | null;
  sequenceOrder: number;
}

export interface PresentationSession {
  id: string;
  name: string;
  description?: string;
  centerIds?: number[];
  createdBy?: string;
  items: PresentationItem[];
}

export interface PresentationTextStyle {
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  zIndex?: number;
}

export interface PresentationBackground {
  type: 'color' | 'image' | 'video';
  value: string;
  opacity?: number;
}

export interface PresentationImageOverlay {
  id: string;
  url: string;
  position?: string;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  opacity?: number;
  zIndex?: number;
  rotation?: number;
}

export interface PresentationTextOverlay extends PresentationTextStyle {
  id: string;
  content: string;
  position?: string;
  opacity?: number;
  rotation?: number;
  maxWidth?: number | string;
}

export interface PresentationTemplateSlide {
  background?: PresentationBackground;
  images?: PresentationImageOverlay[];
  text?: PresentationTextOverlay[];
  songTitleStyle?: PresentationTextStyle;
  songLyricsStyle?: PresentationTextStyle;
  songTranslationStyle?: PresentationTextStyle;
  bottomLeftTextStyle?: PresentationTextStyle;
  bottomRightTextStyle?: PresentationTextStyle;
}

export interface PresentationTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  aspectRatio?: '16:9' | '4:3';
  slides?: PresentationTemplateSlide[];
  referenceSlideIndex?: number;
  background?: PresentationBackground;
  images?: PresentationImageOverlay[];
  text?: PresentationTextOverlay[];
  songTitleStyle?: PresentationTextStyle;
  songLyricsStyle?: PresentationTextStyle;
  songTranslationStyle?: PresentationTextStyle;
  bottomLeftTextStyle?: PresentationTextStyle;
  bottomRightTextStyle?: PresentationTextStyle;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The sessions service returned an unexpected response.');
  }
  return value as Record<string, unknown>;
}

function normalizeItem(value: unknown, index: number): PresentationItem {
  const row = asRecord(value);
  const id = row.id ?? row.ID;
  const songId = row.songId ?? row.song_id ?? row.SONG_ID;
  const songName = row.songName ?? row.song_name ?? row.SONG_NAME;
  const singerId = row.singerId ?? row.singer_id ?? row.SINGER_ID;
  const singerName = row.singerName ?? row.singer_name ?? row.SINGER_NAME;
  const singerGender = row.singerGender ?? row.singer_gender ?? row.SINGER_GENDER;
  const pitch = row.pitch ?? row.PITCH;
  const language = row.songLanguage ?? row.song_language ?? row.SONG_LANGUAGE ?? row.language ?? row.LANGUAGE;
  const deity = row.songDeity ?? row.song_deity ?? row.SONG_DEITY ?? row.deity ?? row.DEITY;
  const sequenceOrder = row.sequenceOrder ?? row.sequence_order ?? row.SEQUENCE_ORDER;

  if (typeof songId !== 'string') {
    throw new Error('A session item is missing its song.');
  }

  return {
    id: typeof id === 'string' ? id : `${songId}-${index}`,
    songId,
    songName: typeof songName === 'string' ? songName : 'Bhajan',
    singerId: typeof singerId === 'string' ? singerId : undefined,
    singerName: typeof singerName === 'string' ? singerName : undefined,
    singerGender: typeof singerGender === 'string' ? singerGender : undefined,
    pitch: pitch == null ? undefined : String(pitch),
    language: typeof language === 'string' ? language : undefined,
    deity: typeof deity === 'string' ? deity : undefined,
    sequenceOrder: typeof sequenceOrder === 'number' ? sequenceOrder : Number(sequenceOrder) || index,
  };
}

function normalizeSession(value: unknown): PresentationSession {
  const row = asRecord(value);
  const id = row.id ?? row.ID;
  const name = row.name ?? row.NAME;
  const description = row.description ?? row.DESCRIPTION;
  const centerIds = row.centerIds ?? row.center_ids ?? row.CENTER_IDS;
  const createdBy = row.createdBy ?? row.created_by ?? row.CREATED_BY;
  const items = row.items ?? row.ITEMS;

  if (typeof id !== 'string' || typeof name !== 'string') {
    throw new Error('The sessions service returned an invalid session.');
  }

  return {
    id,
    name,
    description: typeof description === 'string' ? description : undefined,
    centerIds: Array.isArray(centerIds) ? centerIds.map(Number).filter(Number.isFinite) : [],
    createdBy: typeof createdBy === 'string' ? createdBy : undefined,
    items: Array.isArray(items)
      ? items.map(normalizeItem).sort((first, second) => first.sequenceOrder - second.sequenceOrder)
      : [],
  };
}

async function fetchSessionData(path: string): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`The sessions service returned ${response.status}.`);
  }
  return response.json();
}

async function sendSessionData(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const row = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    throw new Error(typeof row.message === 'string' ? row.message : `The sessions service returned ${response.status}.`);
  }
  return payload;
}

export async function savePresentationSession(
  name: string,
  items: { songId: string; singerId?: string; pitch?: string }[],
): Promise<PresentationSession> {
  const created = asRecord(await sendSessionData('/sessions', 'POST', { name: name.trim(), centerIds: [] }));
  const sessionId = created.id ?? created.ID;
  if (typeof sessionId !== 'string') throw new Error('The sessions service did not return a session ID.');

  try {
    await sendSessionData(`/sessions/${encodeURIComponent(sessionId)}/items`, 'PUT', { items });
  } catch (cause) {
    try {
      await sendSessionData(`/sessions/${encodeURIComponent(sessionId)}`, 'DELETE');
    } catch {
      // Keep the original item-save error.
    }
    throw cause;
  }

  return fetchPresentationSession(sessionId);
}

export async function fetchPresentationSessions(): Promise<PresentationSession[]> {
  const result: unknown = await fetchSessionData('/sessions');
  if (!Array.isArray(result)) throw new Error('The sessions service returned an unexpected response.');
  return result.map(normalizeSession).filter((session) => session.items.length > 0);
}

export async function fetchPresentationSession(sessionId: string): Promise<PresentationSession> {
  const result = await fetchSessionData(`/sessions/${encodeURIComponent(sessionId)}`);
  return normalizeSession(result);
}

export async function deletePresentationSession(sessionId: string): Promise<void> {
  await sendSessionData(`/sessions/${encodeURIComponent(sessionId)}`, 'DELETE');
}

export async function fetchPresentationTemplates(): Promise<PresentationTemplate[]> {
  const result: unknown = await fetchSessionData('/templates');
  if (!Array.isArray(result)) throw new Error('The templates service returned an unexpected response.');
  return result.flatMap((value) => {
    const row = asRecord(value);
    const id = row.id ?? row.ID;
    const name = row.name ?? row.NAME;
    if (typeof id !== 'string' || typeof name !== 'string') return [];
    return [{
      ...row,
      id,
      name,
      isDefault: row.isDefault === true || row.isDefault === 1,
    } as unknown as PresentationTemplate];
  });
}
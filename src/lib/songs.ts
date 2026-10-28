export interface Song {
  id: string;
  name: string;
  createdBy?: string | null;
  externalSourceUrl?: string;
  lyrics?: string | null;
  meaning?: string | null;
  language?: string | null;
  deity?: string | null;
  tempo?: string | null;
  beat?: string | null;
  raga?: string | null;
  level?: string | null;
  songTags?: string | null;
  audioLink?: string | null;
  videoLink?: string | null;
  goldenVoice?: boolean;
  refGents?: string | null;
  refLadies?: string | null;
}

export interface SongInput {
  name: string;
  externalSourceUrl?: string;
  lyrics?: string;
  meaning?: string;
  language?: string;
  deity?: string;
  tempo?: string;
  beat?: string;
  raga?: string;
  level?: string;
  songTags?: string;
  audioLink?: string;
  videoLink?: string;
  goldenVoice?: boolean;
  refGents?: string;
  refLadies?: string;
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const apiBaseUrl = (configuredApiUrl || 'https://saisongs.org/api').replace(/\/$/, '');

export async function fetchSongs(signal?: AbortSignal): Promise<Song[]> {
  const response = await fetch(`${apiBaseUrl}/songs`, { signal });
  if (!response.ok) {
    throw new Error(`The song service returned ${response.status}.`);
  }

  const songs: unknown = await response.json();
  if (!Array.isArray(songs)) {
    throw new Error('The song service returned an unexpected response.');
  }

  const validSongs = songs.filter(
    (song): song is Song =>
      typeof song === 'object' &&
      song !== null &&
      typeof song.id === 'string' &&
      typeof song.name === 'string',
  );

  return validSongs.map((song) => {
    const row = song as unknown as Record<string, unknown>;
    const createdBy = row.createdBy ?? row.created_by ?? row.CREATED_BY;
    return { ...song, createdBy: typeof createdBy === 'string' ? createdBy : null };
  });
}

export async function fetchSong(songId: string, signal?: AbortSignal): Promise<Song> {
  const response = await fetch(`${apiBaseUrl}/songs/${encodeURIComponent(songId)}`, { signal });
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'This song is no longer available.' : `The song service returned ${response.status}.`);
  }

  const song: unknown = await response.json();
  if (typeof song !== 'object' || song === null) {
    throw new Error('The song service returned an unexpected response.');
  }
  const songRecord = song as Record<string, unknown>;
  if (typeof songRecord.id !== 'string' || typeof songRecord.name !== 'string') {
    throw new Error('The song service returned an unexpected response.');
  }

  return {
    ...songRecord,
    createdBy: typeof (songRecord.createdBy ?? songRecord.created_by) === 'string'
      ? String(songRecord.createdBy ?? songRecord.created_by)
      : null,
  } as unknown as Song;
}

async function mutateSong(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: SongInput): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const row = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    throw new Error(typeof row.message === 'string' ? row.message : typeof row.error === 'string' ? row.error : `The song service returned ${response.status}.`);
  }
  return payload;
}

export async function createSong(input: SongInput): Promise<Song | null> {
  const result = await mutateSong('/songs', 'POST', input);
  if (typeof result === 'object' && result !== null && typeof (result as Record<string, unknown>).id === 'string') {
    return result as Song;
  }
  const songs = await fetchSongs();
  return songs.find((song) => song.name === input.name) || null;
}

export async function updateSong(songId: string, input: SongInput): Promise<Song> {
  await mutateSong(`/songs/${encodeURIComponent(songId)}`, 'PUT', input);
  return fetchSong(songId);
}

export async function deleteSong(songId: string): Promise<void> {
  await mutateSong(`/songs/${encodeURIComponent(songId)}`, 'DELETE');
}
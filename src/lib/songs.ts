export interface Song {
  id: string;
  name: string;
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

  return songs.filter(
    (song): song is Song =>
      typeof song === 'object' &&
      song !== null &&
      typeof song.id === 'string' &&
      typeof song.name === 'string',
  );
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

  return songRecord as unknown as Song;
}
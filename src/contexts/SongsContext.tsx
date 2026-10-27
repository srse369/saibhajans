import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { fetchSongs, type Song } from '../lib/songs';

const SAVED_SONGS_KEY = 'sai-bhajans:saved-song-ids';

interface SongsContextValue {
  songs: Song[];
  savedSongIds: string[];
  isLoading: boolean;
  error: string | null;
  refreshSongs: () => Promise<void>;
  toggleSavedSong: (songId: string) => void;
}

const SongsContext = createContext<SongsContextValue | null>(null);

export function SongsProvider({ children }: PropsWithChildren) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [savedSongIds, setSavedSongIds] = useState<string[]>([]);
  const savedSongIdsRef = useRef<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshSongs() {
    setIsLoading(true);
    setError(null);
    try {
      setSongs(await fetchSongs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load songs.');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSavedSong(songId: string) {
    const currentIds = savedSongIdsRef.current;
    const nextIds = currentIds.includes(songId)
      ? currentIds.filter((id) => id !== songId)
      : [...currentIds, songId];

    savedSongIdsRef.current = nextIds;
    setSavedSongIds(nextIds);
    void AsyncStorage.setItem(SAVED_SONGS_KEY, JSON.stringify(nextIds));
  }

  useEffect(() => {
    let isActive = true;
    void fetchSongs()
      .then((loadedSongs) => {
        if (isActive) setSongs(loadedSongs);
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load songs.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    void AsyncStorage.getItem(SAVED_SONGS_KEY).then((storedIds) => {
      if (!isActive) return;
      if (!storedIds) return;
      try {
        const parsedIds: unknown = JSON.parse(storedIds);
        if (Array.isArray(parsedIds) && parsedIds.every((id) => typeof id === 'string')) {
          savedSongIdsRef.current = parsedIds;
          setSavedSongIds(parsedIds);
        }
      } catch {
        void AsyncStorage.removeItem(SAVED_SONGS_KEY);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <SongsContext.Provider
      value={{ songs, savedSongIds, isLoading, error, refreshSongs, toggleSavedSong }}
    >
      {children}
    </SongsContext.Provider>
  );
}

export function useSongs() {
  const context = useContext(SongsContext);
  if (!context) {
    throw new Error('useSongs must be used inside SongsProvider.');
  }
  return context;
}
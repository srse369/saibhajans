import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { fetchSongs, type Song } from '../lib/songs';

const SAVED_SONGS_KEY = 'sai-bhajans:saved-song-ids';

interface SongCatalogValue {
  songs: Song[];
  isLoading: boolean;
  error: string | null;
  refreshSongs: () => Promise<void>;
}

interface FavoriteSongsValue {
  savedSongIds: string[];
  toggleSavedSong: (songId: string) => Promise<void>;
}

const SongCatalogContext = createContext<SongCatalogValue | null>(null);
const FavoriteSongsContext = createContext<FavoriteSongsValue | null>(null);

export function SongsProvider({ children }: PropsWithChildren) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [savedSongIds, setSavedSongIds] = useState<string[]>([]);
  const savedSongIdsRef = useRef<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSongs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSongs(await fetchSongs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load songs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleSavedSong = useCallback(async (songId: string) => {
    const currentIds = savedSongIdsRef.current;
    const nextIds = currentIds.includes(songId)
      ? currentIds.filter((id) => id !== songId)
      : [...currentIds, songId];

    savedSongIdsRef.current = nextIds;
    setSavedSongIds(nextIds);
    await AsyncStorage.setItem(SAVED_SONGS_KEY, JSON.stringify(nextIds));
  }, []);

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

  const catalogValue = useMemo(
    () => ({ songs, isLoading, error, refreshSongs }),
    [songs, isLoading, error, refreshSongs],
  );
  const favoriteValue = useMemo(
    () => ({ savedSongIds, toggleSavedSong }),
    [savedSongIds, toggleSavedSong],
  );

  return (
    <SongCatalogContext.Provider value={catalogValue}>
      <FavoriteSongsContext.Provider value={favoriteValue}>
        {children}
      </FavoriteSongsContext.Provider>
    </SongCatalogContext.Provider>
  );
}

export function useSongCatalog() {
  const context = useContext(SongCatalogContext);
  if (!context) {
    throw new Error('useSongCatalog must be used inside SongsProvider.');
  }
  return context;
}

export function useFavoriteSongs() {
  const context = useContext(FavoriteSongsContext);
  if (!context) {
    throw new Error('useFavoriteSongs must be used inside SongsProvider.');
  }
  return context;
}

export function useSongs() {
  return { ...useSongCatalog(), ...useFavoriteSongs() };
}
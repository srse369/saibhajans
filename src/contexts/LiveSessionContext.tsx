import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Song } from '../lib/songs';

const LIVE_SESSION_KEY = 'sai-bhajans:live-session';

export interface LiveSessionItem {
  songId: string;
  songName: string;
  singerId?: string;
  singerName?: string;
  pitch?: string;
  language?: string | null;
  deity?: string | null;
}

export function liveSessionItemKey(item: Pick<LiveSessionItem, 'songId' | 'singerId'>) {
  return `${item.songId}|${item.singerId || 'none'}`;
}

interface LiveSessionSongDetails {
  singerId?: string;
  singerName?: string;
  pitch?: string;
}

interface LiveSessionValue {
  items: LiveSessionItem[];
  isLoading: boolean;
  addSong: (song: Pick<Song, 'id' | 'name' | 'language' | 'deity'>, details?: LiveSessionSongDetails) => void;
  removeSong: (songId: string, singerId?: string) => void;
  removeItem: (itemKey: string) => void;
  moveSong: (itemKey: string, direction: -1 | 1) => void;
  clearSession: () => void;
}

const LiveSessionContext = createContext<LiveSessionValue | null>(null);

export function LiveSessionProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<LiveSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isActive = true;
    void AsyncStorage.getItem(LIVE_SESSION_KEY)
      .then((storedItems) => {
        if (!isActive || !storedItems) return;
        const parsed: unknown = JSON.parse(storedItems);
        if (!Array.isArray(parsed)) return;
        const validItems = parsed.flatMap((item): LiveSessionItem[] => {
          if (typeof item !== 'object' || item === null) return [];
          const row = item as Partial<LiveSessionItem>;
          if (typeof row.songId !== 'string' || typeof row.songName !== 'string') return [];
          if (row.singerId != null && typeof row.singerId !== 'string') return [];
          return [{
            songId: row.songId,
            songName: row.songName,
            singerId: row.singerId,
            singerName: row.singerName,
            pitch: row.pitch,
            language: row.language,
            deity: row.deity,
          }];
        });
        setItems(validItems);
      })
      .catch(() => {
        void AsyncStorage.removeItem(LIVE_SESSION_KEY);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
          setIsHydrated(true);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) void AsyncStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(items));
  }, [isHydrated, items]);

  function addSong(song: Pick<Song, 'id' | 'name' | 'language' | 'deity'>, details: LiveSessionSongDetails = {}) {
    const nextItem: LiveSessionItem = {
      songId: song.id,
      songName: song.name,
      language: song.language,
      deity: song.deity,
      ...details,
    };
    setItems((current) => {
      const existingIndex = current.findIndex((item) => liveSessionItemKey(item) === liveSessionItemKey(nextItem));
      if (existingIndex < 0) return [...current, nextItem];
      const updated = [...current];
      updated[existingIndex] = { ...updated[existingIndex], ...nextItem, pitch: details.pitch ?? updated[existingIndex].pitch };
      return updated;
    });
  }

  function removeSong(songId: string, singerId?: string) {
    setItems((current) => current.filter((item) => singerId
      ? !(item.songId === songId && item.singerId === singerId)
      : item.songId !== songId));
  }

  function removeItem(itemKey: string) {
    setItems((current) => current.filter((item) => liveSessionItemKey(item) !== itemKey));
  }

  function moveSong(itemKey: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => liveSessionItemKey(item) === itemKey);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
  }

  function clearSession() {
    setItems([]);
  }

  return (
    <LiveSessionContext.Provider value={{ items, isLoading, addSong, removeSong, removeItem, moveSong, clearSession }}>
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSession() {
  const context = useContext(LiveSessionContext);
  if (!context) throw new Error('useLiveSession must be used within LiveSessionProvider.');
  return context;
}
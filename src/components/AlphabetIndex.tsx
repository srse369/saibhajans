import { useCallback, useMemo, useRef, useState } from 'react';
import type { FlatList } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../lib/theme';

export const INDEX_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
export const INDEX_MIN_ITEMS = 15;
const WINDOW_SIZE = 24;
const WINDOW_STEP = 40;

export function indexLetter(title: string) {
  const first = title.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toLocaleUpperCase();
  return first >= 'A' && first <= 'Z' ? first : '#';
}

export function compareNames(first: string, second: string) {
  return first.localeCompare(second, undefined, { sensitivity: 'base' });
}

/**
 * Jumping re-slices the list so the target letter is rendered at the top immediately,
 * then grows the slice as the user scrolls. `items` must be memoized and sorted by name.
 */
export function useAlphabetJump<T>(items: readonly T[], getName: (item: T) => string) {
  const listRef = useRef<FlatList<T>>(null);
  const [windowState, setWindowState] = useState({ source: items, start: 0, end: WINDOW_SIZE });
  const current = useMemo(
    () => (windowState.source === items ? windowState : { source: items, start: 0, end: WINDOW_SIZE }),
    [windowState, items],
  );
  const windowedItems = useMemo(() => items.slice(current.start, current.end), [items, current.start, current.end]);

  const letterStartIndex = useMemo(() => {
    const starts = new Map<string, number>();
    items.forEach((item, position) => {
      const letter = indexLetter(getName(item));
      if (!starts.has(letter)) starts.set(letter, position);
    });
    return starts;
  }, [items, getName]);
  const availableLetters = useMemo(() => new Set(letterStartIndex.keys()), [letterStartIndex]);

  const jumpTo = useCallback((start: number) => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setWindowState({ source: items, start, end: start + WINDOW_SIZE });
  }, [items]);

  const loadEarlier = useCallback(() => {
    if (current.start > 0) setWindowState({ ...current, start: Math.max(0, current.start - WINDOW_STEP) });
  }, [current]);

  const loadLater = useCallback(() => {
    if (current.end < items.length) setWindowState({ ...current, end: Math.min(items.length, current.end + WINDOW_STEP) });
  }, [current, items.length]);

  const scrollToLetter = useCallback((letter: string) => {
    for (let position = INDEX_LETTERS.indexOf(letter); position < INDEX_LETTERS.length; position += 1) {
      const target = letterStartIndex.get(INDEX_LETTERS[position]);
      if (target !== undefined) {
        jumpTo(target);
        return;
      }
    }
    if (items.length) jumpTo(Math.max(0, items.length - 12));
  }, [jumpTo, letterStartIndex, items.length]);

  return {
    listRef,
    windowedItems,
    availableLetters,
    scrollToLetter,
    loadEarlier,
    loadLater,
    showIndex: items.length >= INDEX_MIN_ITEMS,
  };
}

interface AlphabetIndexProps {
  available: ReadonlySet<string>;
  onSelect: (letter: string) => void;
}

export function AlphabetIndex({ available, onSelect }: AlphabetIndexProps) {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [railHeight, setRailHeight] = useState(1);

  function selectAt(locationY: number) {
    const position = Math.min(INDEX_LETTERS.length - 1, Math.max(0, Math.floor((locationY / railHeight) * INDEX_LETTERS.length)));
    const letter = INDEX_LETTERS[position];
    if (letter === activeLetter) return;
    setActiveLetter(letter);
    onSelect(letter);
  }

  return (
    <>
      {activeLetter ? (
        <View pointerEvents="none" style={styles.indexBubble}>
          <Text style={styles.indexBubbleLabel}>{activeLetter}</Text>
        </View>
      ) : null}
      <View
        accessibilityLabel="Alphabet index"
        onLayout={(event) => setRailHeight(event.nativeEvent.layout.height || 1)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => selectAt(event.nativeEvent.locationY)}
        onResponderMove={(event) => selectAt(event.nativeEvent.locationY)}
        onResponderRelease={() => setActiveLetter(null)}
        onResponderTerminate={() => setActiveLetter(null)}
        style={styles.indexRail}
      >
        {INDEX_LETTERS.map((letter) => (
          <Text
            key={letter}
            pointerEvents="none"
            style={[styles.indexLetter, !available.has(letter) && styles.indexLetterDisabled, activeLetter === letter && styles.indexLetterActive]}
          >
            {letter}
          </Text>
        ))}
      </View>
    </>
  );
}

export const alphabetIndexStyles = StyleSheet.create({
  listArea: { flex: 1 },
  listContentWithIndex: { paddingRight: 26 },
});

const styles = StyleSheet.create({
  indexRail: { position: 'absolute', top: 6, bottom: 6, right: 0, width: 24, alignItems: 'center', justifyContent: 'space-between' },
  indexLetter: { color: colors.forest, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  indexLetterDisabled: { color: colors.muted, opacity: 0.4 },
  indexLetterActive: { color: colors.saffron },
  indexBubble: { position: 'absolute', top: '50%', right: 40, marginTop: -28, width: 56, height: 56, borderRadius: 12, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', opacity: 0.92 },
  indexBubbleLabel: { color: '#E6C08B', fontSize: 28, fontWeight: '700' },
});

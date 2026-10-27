import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BookOpen, Check, Heart, Music2, Plus, Search, WifiOff } from 'lucide-react-native';
import { useSongs } from '../contexts/SongsContext';
import { useLiveSession } from '../contexts/LiveSessionContext';
import { coverColors, colors } from '../lib/theme';
import type { Song } from '../lib/songs';

interface SongLibraryProps {
  savedOnly?: boolean;
}

function normalizeLanguage(language: string) {
  return language.trim().toLocaleLowerCase();
}

function formatLabel(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

export function SongLibrary({ savedOnly = false }: SongLibraryProps) {
  const { songs, savedSongIds, isLoading, error, refreshSongs, toggleSavedSong } = useSongs();
  const { items: liveItems, addSong, removeSong } = useLiveSession();
  const [query, setQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const savedSongs = savedOnly ? songs.filter((song) => savedSongIds.includes(song.id)) : songs;
  const languages = [
    'all',
    ...new Set(savedSongs.map((song) => song.language).filter(Boolean).map((language) => normalizeLanguage(language as string))),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSongs = savedSongs.filter((song) => {
    const matchesLanguage = selectedLanguage === 'all' || normalizeLanguage(song.language || '') === selectedLanguage;
    const searchableText = [song.name, song.language, song.deity, song.lyrics, song.meaning]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    return matchesLanguage && searchableText.includes(normalizedQuery);
  });

  function renderSong({ item, index }: { item: Song; index: number }) {
    const isSaved = savedSongIds.includes(item.id);
    const isInLiveSession = liveItems.some((liveItem) => liveItem.songId === item.id);
    const subtitle = [item.deity, item.language].filter(Boolean).map((value) => formatLabel(value as string)).join(' · ');

    return (
      <View style={styles.songRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}
          onPress={() => router.push({ pathname: '/song/[id]', params: { id: item.id } })}
          style={({ pressed }) => [styles.songMain, pressed && styles.pressed]}
        >
          <View style={[styles.songMark, { backgroundColor: coverColors[index % coverColors.length] }]}>
            <Music2 color={colors.forestDeep} size={21} strokeWidth={1.7} />
          </View>
          <View style={styles.songCopy}>
            <Text numberOfLines={1} style={styles.songTitle}>{item.name}</Text>
            <Text numberOfLines={1} style={styles.songSubtitle}>{subtitle || 'Sai bhajan'}</Text>
          </View>
          <BookOpen color={colors.muted} size={18} strokeWidth={1.8} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? `Remove ${item.name} from saved songs` : `Save ${item.name}`}
          onPress={() => toggleSavedSong(item.id)}
          hitSlop={10}
          style={styles.saveButton}
        >
          <Heart color={isSaved ? colors.rose : colors.muted} fill={isSaved ? colors.rose : 'transparent'} size={19} strokeWidth={1.8} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isInLiveSession ? `Remove ${item.name} from Live` : `Add ${item.name} to Live`}
          accessibilityState={{ selected: isInLiveSession }}
          onPress={() => isInLiveSession ? removeSong(item.id) : addSong(item)}
          hitSlop={8}
          style={[styles.liveButton, isInLiveSession && styles.liveButtonSelected]}
        >
          {isInLiveSession
            ? <Check color={colors.white} size={18} strokeWidth={2.2} />
            : <Plus color={colors.forest} size={19} strokeWidth={1.9} />}
        </Pressable>
      </View>
    );
  }

  function renderEmptyState() {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.forest} size="small" />
          <Text style={styles.emptyTitle}>Finding your bhajans</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <WifiOff color={colors.rose} size={24} strokeWidth={1.7} />
          <Text style={styles.emptyTitle}>The library is unavailable</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refreshSongs()} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    if (savedOnly && savedSongs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Heart color={colors.saffron} size={25} strokeWidth={1.7} />
          <Text style={styles.emptyTitle}>Your saved songs will live here</Text>
          <Text style={styles.emptyBody}>Tap the heart beside a bhajan to keep it close.</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Search color={colors.muted} size={24} strokeWidth={1.7} />
        <Text style={styles.emptyTitle}>No bhajans found</Text>
        <Text style={styles.emptyBody}>Try another title, language, or deity.</Text>
      </View>
    );
  }

  return (
    <View style={styles.library}>
      <View>
        <View style={styles.masthead}>
          <Text style={styles.eyebrow}>{savedOnly ? 'YOUR COLLECTION' : 'SING WITH DEVOTION'}</Text>
          <Text style={styles.heading}>{savedOnly ? 'Saved bhajans' : 'Find a bhajan'}</Text>
          <Text style={styles.intro}>
            {savedOnly
              ? `${savedSongs.length} ${savedSongs.length === 1 ? 'song' : 'songs'} kept close.`
              : `${songs.length ? `${songs.length} songs` : 'Songs and lyrics'} for your daily practice.`}
          </Text>
      </View>
        <View style={styles.searchWrap}>
          <Search color={colors.muted} size={19} strokeWidth={1.8} />
          <TextInput
            accessibilityLabel="Search bhajans"
            placeholder="Search title, lyric, deity..."
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {languages.map((language) => {
            const selected = selectedLanguage === language;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={language}
                onPress={() => setSelectedLanguage(language)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
                  {language === 'all' ? 'All' : formatLabel(language)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{savedOnly ? 'Kept for later' : 'The songbook'}</Text>
          <Text style={styles.songCount}>{visibleSongs.length} SONGS</Text>
        </View>
      </View>
      <FlatList
        style={styles.songList}
        data={visibleSongs}
        keyExtractor={(song) => song.id}
        renderItem={renderSong}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.rowGap} />}
        refreshControl={
          <RefreshControl refreshing={isLoading && songs.length > 0} onRefresh={() => void refreshSongs()} tintColor={colors.forest} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  library: { flex: 1, backgroundColor: colors.paper },
  songList: { flex: 1 },
  listContent: { backgroundColor: colors.paper, paddingHorizontal: 16, paddingBottom: 18 },
  masthead: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  eyebrow: { color: '#E6C08B', fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginBottom: 5 },
  heading: { color: '#FFFEFA', fontSize: 25, lineHeight: 30, fontFamily: 'Georgia' },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3 },
  searchWrap: { minHeight: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, marginHorizontal: 16, marginTop: -10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 42, color: colors.ink, fontSize: 13, marginLeft: 8, paddingVertical: 0 },
  filterRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 6 },
  filterChip: { minHeight: 27, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: colors.surface },
  filterChipSelected: { backgroundColor: colors.saffronLight, borderColor: colors.saffronLight },
  filterLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterLabelSelected: { color: colors.forestDeep },
  sectionHeading: { paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontFamily: 'Georgia' },
  songCount: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  songRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58 },
  songMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: 2, paddingRight: 6 },
  pressed: { opacity: 0.72 },
  songMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  songCopy: { flex: 1, marginRight: 6 },
  songTitle: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  songSubtitle: { color: colors.muted, fontSize: 10 },
  saveButton: { width: 38, height: 56, alignItems: 'center', justifyContent: 'center' },
  liveButton: { width: 36, height: 56, alignItems: 'center', justifyContent: 'center' },
  liveButtonSelected: { backgroundColor: colors.forest },
  rowGap: { height: 1, backgroundColor: colors.line },
  emptyState: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 40, paddingBottom: 56 },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 18, textAlign: 'center', marginTop: 14 },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 270 },
  retryButton: { backgroundColor: colors.forest, borderRadius: 6, paddingHorizontal: 18, paddingVertical: 10, marginTop: 17 },
  retryLabel: { color: colors.white, fontSize: 13, fontWeight: '600' },
});
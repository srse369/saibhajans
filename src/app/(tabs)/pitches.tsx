import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Alert, ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, AudioLines, Check, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { useSongCatalog } from '../../contexts/SongsContext';
import { colors, coverColors } from '../../lib/theme';
import { keepProgressVisible } from '../../lib/progress';
import { singerNameColor } from '../../lib/singerColors';
import {
  createSingerSongPitch,
  deleteSingerSongPitch,
  fetchSingers,
  fetchSingerSongPitches,
  type SingerSongPitch,
  type Singer,
  updateSingerSongPitch,
} from '../../lib/singers';
import { PitchEditorModal } from '../../components/PitchEditorModal';

const EMPTY_CENTER_IDS: number[] = [];

interface PitchRowProps {
  item: SingerSongPitch;
  index: number;
  singerGender?: string;
  isInLiveSession: boolean;
  isLiveLoading: boolean;
  showManagementActions: boolean;
  isMutating: boolean;
  addSong: (song: { id: string; name: string }, details: { singerId: string; singerName?: string; singerGender?: string; pitch: string }) => Promise<void>;
  removeSong: (songId: string, singerId?: string) => Promise<void>;
  onEdit: (item: SingerSongPitch) => void;
  onDelete: (item: SingerSongPitch) => void;
}

const PitchRow = memo(function PitchRow({
  item,
  index,
  singerGender,
  isInLiveSession,
  isLiveLoading,
  showManagementActions,
  isMutating,
  addSong,
  removeSong,
  onEdit,
  onDelete,
}: PitchRowProps) {
  const [isLivePending, setIsLivePending] = useState(false);

  async function toggleLive() {
    setIsLivePending(true);
    try {
      await keepProgressVisible(isInLiveSession
        ? removeSong(item.songId, item.singerId)
        : addSong({ id: item.songId, name: item.songName || 'Untitled bhajan' }, { singerId: item.singerId, singerName: item.singerName, singerGender, pitch: item.pitch }));
    } catch (cause) {
      Alert.alert('Unable to update Live queue', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setIsLivePending(false);
    }
  }

  return (
    <View style={styles.pitchRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.songName || 'song'}, sung by ${item.singerName || 'singer'}, pitch ${item.pitch}`}
        onPress={() => router.push({ pathname: '/song/[id]', params: { id: item.songId } })}
        style={({ pressed }) => [styles.pitchMain, pressed && styles.rowPressed]}
      >
        <View style={[styles.songMark, { backgroundColor: coverColors[index % coverColors.length] }]}>
          <AudioLines color={colors.forestDeep} size={19} strokeWidth={1.7} />
        </View>
        <View style={styles.pitchCopy}>
          <Text numberOfLines={1} style={styles.songName}>{item.songName || 'Untitled bhajan'}</Text>
            <Text numberOfLines={1} style={[styles.singerName, { color: singerNameColor(singerGender) }]}>{item.singerName || 'Singer'}</Text>
        </View>
        <View style={styles.pitchBadge}><Text style={styles.pitchLabel}>{item.pitch}</Text></View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isInLiveSession ? `Remove ${item.songName || 'song'} for ${item.singerName || 'singer'} from Live` : `Add ${item.songName || 'song'} for ${item.singerName || 'singer'} to Live`}
        accessibilityState={{ selected: isInLiveSession, disabled: isLivePending || isLiveLoading }}
        disabled={isLivePending || isLiveLoading}
        onPress={() => void toggleLive()}
        style={[styles.liveButton, isInLiveSession && styles.liveButtonSelected]}
      >
        {isLivePending
          ? <ActivityIndicator color={isInLiveSession ? colors.white : colors.forest} size="small" />
          : isInLiveSession ? <Check color={colors.white} size={17} /> : <ArrowRight color={colors.forest} size={18} />}
        <Text style={[styles.actionHint, isInLiveSession && styles.selectedActionHint]}>Live</Text>
      </Pressable>
      {showManagementActions ? (
        <View style={styles.pitchManagementActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit pitch for ${item.songName || 'song'}`}
            disabled={!item.id || isMutating}
            onPress={() => onEdit(item)}
            style={[styles.managementButton, (!item.id || isMutating) && styles.disabledAction]}
          >
            <Pencil color={colors.forest} size={16} />
            <Text style={styles.actionHint}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete pitch for ${item.songName || 'song'}`}
            disabled={!item.id || isMutating}
            onPress={() => onDelete(item)}
            style={[styles.managementButton, (!item.id || isMutating) && styles.disabledAction]}
          >
            {isMutating ? <ActivityIndicator color={colors.rose} size="small" /> : <Trash2 color={colors.rose} size={17} />}
            <Text style={styles.deleteHint}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

export default function PitchesScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { items: liveItems, isLoading: isLiveLoading, addSong, removeSong } = useLiveSession();
  const { songs } = useSongCatalog();
  const [pitches, setPitches] = useState<SingerSongPitch[]>([]);
  const [singers, setSingers] = useState<Singer[]>([]);
  const [query, setQuery] = useState('');
  const [pitchScope, setPitchScope] = useState<'mine' | 'all'>('mine');
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPitchFormVisible, setIsPitchFormVisible] = useState(false);
  const [editingPitch, setEditingPitch] = useState<SingerSongPitch | null>(null);
  const [mutatingPitchId, setMutatingPitchId] = useState<string | null>(null);

  function openAddPitch() {
    setEditingPitch(null);
    setIsPitchFormVisible(true);
  }

  const openEditPitch = useCallback((item: SingerSongPitch) => {
    setEditingPitch(item);
    setIsPitchFormVisible(true);
  }, []);

  async function savePitch(input: { songId: string; singerId: string; pitch: string }, existingPitchId?: string) {
    const pitchId = existingPitchId || editingPitch?.id;
    if (pitchId) {
      await updateSingerSongPitch(pitchId, input.pitch);
    } else {
      await createSingerSongPitch(input);
    }
    setIsPitchFormVisible(false);
    await loadPitches();
  }

  const confirmDeletePitch = useCallback((item: SingerSongPitch) => {
    if (!item.id) return;
    Alert.alert(
      'Delete pitch?',
      `${item.songName || 'This song'} for ${item.singerName || 'this singer'} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMutatingPitchId(item.id || null);
            void deleteSingerSongPitch(item.id as string)
              .then(() => {
                setPitches((current) => current.filter((pitch) => pitch.id !== item.id));
                setError(null);
              })
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to delete pitch.'))
              .finally(() => setMutatingPitchId(null));
          },
        },
      ],
    );
  }, []);

  async function loadPitches() {
    setIsRefreshing(true);
    setError(null);
    try {
      const [loadedPitches, loadedSingers] = await Promise.all([fetchSingerSongPitches(), fetchSingers()]);
      setPitches(loadedPitches);
      setSingers(loadedSingers);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load pitches.';
      if (message.toLocaleLowerCase().includes('authentication')) {
        setError('Your session expired. Sign in again from your profile.');
      } else {
        setError(message);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    void Promise.all([fetchSingerSongPitches(), fetchSingers()])
      .then(([loadedPitches, loadedSingers]) => {
        if (isActive) {
          setPitches(loadedPitches);
          setSingers(loadedSingers);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load pitches.');
      })
      .finally(() => {
        if (isActive) setLoadedForUser(userId);
      });
    return () => {
      isActive = false;
    };
  }, [userId]);

  const isAdmin = user?.role === 'admin';
  const canManageAllPitches = isAdmin || user?.role === 'editor';
  const accessibleCenterIds = useMemo(
    () => user?.role === 'editor' ? user.editorFor : user?.centerIds || EMPTY_CENTER_IDS,
    [user],
  );
  const allPitchSingerIds = useMemo(() => new Set(
    isAdmin
      ? singers.map((singer) => singer.id)
      : singers.filter((singer) => singer.centerIds.some((centerId) => accessibleCenterIds.includes(centerId))).map((singer) => singer.id),
  ), [isAdmin, singers, accessibleCenterIds]);
    const singersById = useMemo(() => new Map(singers.map((singer) => [singer.id, singer])), [singers]);
  const scopedPitches = useMemo(() => pitchScope === 'mine'
    ? pitches.filter((item) => item.singerId === user?.id)
    : isAdmin
      ? pitches
      : pitches.filter((item) => allPitchSingerIds.has(item.singerId)),
  [pitchScope, pitches, user?.id, isAdmin, allPitchSingerIds]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePitches = useMemo(() => scopedPitches.filter((item) =>
    [item.songName, item.singerName, item.pitch]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  ), [scopedPitches, normalizedQuery]);
  const livePitchKeys = useMemo(() => new Set(liveItems.map((item) => `${item.songId}|${item.singerId || ''}`)), [liveItems]);
  const showManagementActions = pitchScope === 'mine' || canManageAllPitches;
  const renderPitch = useCallback(({ item, index }: { item: SingerSongPitch; index: number }) => (
    <PitchRow
      item={item}
      index={index}
      singerGender={singersById.get(item.singerId)?.gender}
      isInLiveSession={livePitchKeys.has(`${item.songId}|${item.singerId}`)}
      isLiveLoading={isLiveLoading}
      showManagementActions={showManagementActions}
      isMutating={mutatingPitchId === item.id}
      addSong={addSong}
      removeSong={removeSong}
      onEdit={openEditPitch}
      onDelete={confirmDeletePitch}
    />
  ), [livePitchKeys, isLiveLoading, showManagementActions, mutatingPitchId, addSong, removeSong, openEditPitch, confirmDeletePitch, singersById]);

  if (isAuthLoading || (user && loadedForUser !== user.id)) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.forest} />
          <Text style={styles.loadingLabel}>Opening pitch book</Text>
        </View>
      </View>
    );
  }

  if (!user) return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.screen}>
      <View>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SONG REFERENCES</Text>
          <Text style={styles.heading}>Pitches</Text>
          <Text style={styles.intro}>
            {pitchScope === 'mine'
              ? `${scopedPitches.length} assignments linked to your profile.`
              : isAdmin
                ? `${scopedPitches.length} assignments across all centers.`
                : `${scopedPitches.length} assignments in your ${user?.role === 'editor' ? 'managed' : 'associated'} centers.`}
          </Text>
        </View>
        <View style={styles.searchWrap}>
          <Search color={colors.muted} size={18} strokeWidth={1.8} />
          <TextInput
            accessibilityLabel="Search pitches"
            onChangeText={setQuery}
            placeholder="Search song, singer, or pitch"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>
          <View accessibilityRole="radiogroup" style={styles.scopeControl}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: pitchScope === 'mine' }}
              onPress={() => setPitchScope('mine')}
              style={[styles.scopeOption, pitchScope === 'mine' && styles.scopeOptionSelected]}
            >
              <Text style={[styles.scopeLabel, pitchScope === 'mine' && styles.scopeLabelSelected]}>My pitches</Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: pitchScope === 'all' }}
              onPress={() => setPitchScope('all')}
              style={[styles.scopeOption, pitchScope === 'all' && styles.scopeOptionSelected]}
            >
              <Text style={[styles.scopeLabel, pitchScope === 'all' && styles.scopeLabelSelected]}>All pitches</Text>
            </Pressable>
          </View>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Assignments</Text>
          <View style={styles.sectionActions}>
            <Text style={styles.sectionCount}>{visiblePitches.length} PITCHES</Text>
            {pitchScope === 'mine' || canManageAllPitches ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add pitch" onPress={openAddPitch} style={styles.addButton}>
                <Plus color={colors.white} size={16} />
                <Text style={styles.addLabel}>Add pitch</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      <FlatList
        style={styles.pitchList}
        data={visiblePitches}
        keyExtractor={(item) => item.id || `${item.songId}-${item.singerId}`}
        renderItem={renderPitch}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isRefreshing ? <ActivityIndicator color={colors.forest} /> : <AudioLines color={colors.saffron} size={23} />}
            <Text style={styles.emptyTitle}>{error || (isRefreshing ? 'Loading pitches' : 'No pitch assignments found')}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadPitches()} tintColor={colors.forest} />}
        showsVerticalScrollIndicator={false}
      />
      {user && isPitchFormVisible ? (
        <PitchEditorModal
          visible
          pitch={editingPitch}
          scope={pitchScope}
          user={user}
          songs={songs}
          singers={pitchScope === 'all' && !isAdmin ? singers.filter((singer) => singer.centerIds.some((centerId) => accessibleCenterIds.includes(centerId))) : singers}
          existingPitches={pitches}
          onClose={() => setIsPitchFormVisible(false)}
          onSubmit={savePitch}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  pitchList: { flex: 1 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingLabel: { color: colors.muted, fontSize: 13, marginTop: 12 },
  header: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  eyebrow: { color: '#E6C08B', fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginBottom: 5 },
  heading: { color: colors.white, fontSize: 25, lineHeight: 30, fontFamily: 'Georgia' },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3 },
  searchWrap: { minHeight: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, marginHorizontal: 16, marginTop: -10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, minHeight: 42, color: colors.ink, fontSize: 13, marginLeft: 8, paddingVertical: 0 },
  scopeControl: { flexDirection: 'row', backgroundColor: colors.sage, borderRadius: 7, padding: 2, marginHorizontal: 16, marginTop: 8 },
  scopeOption: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 5 },
  scopeOptionSelected: { backgroundColor: colors.surface },
  scopeLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  scopeLabelSelected: { color: colors.forest, fontWeight: '700' },
  sectionHeading: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontFamily: 'Georgia' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionCount: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  addButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 7, backgroundColor: colors.forest },
  addLabel: { color: colors.white, fontSize: 11, fontWeight: '700' },
  listContent: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: 16, paddingBottom: 16 },
  pitchRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  pitchMain: { flex: 1, minHeight: 62, paddingLeft: 0, paddingRight: 6, flexDirection: 'row', alignItems: 'center' },
  liveButton: { width: 42, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 },
  liveButtonSelected: { backgroundColor: colors.forest },
  pitchManagementActions: { flexDirection: 'row', alignItems: 'center' },
  managementButton: { width: 38, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionHint: { color: colors.muted, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  selectedActionHint: { color: colors.white },
  deleteHint: { color: colors.rose, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
  disabledAction: { opacity: 0.35 },
  rowPressed: { opacity: 0.72 },
  songMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  pitchCopy: { flex: 1, marginRight: 6 },
  songName: { color: colors.ink, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  singerName: { color: colors.muted, fontSize: 10 },
  pitchBadge: { minWidth: 38, height: 27, borderRadius: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sage, marginRight: 6 },
  pitchLabel: { color: colors.forest, fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: colors.line },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  emptyTitle: { color: colors.ink, fontSize: 14, textAlign: 'center', marginTop: 12 },
});
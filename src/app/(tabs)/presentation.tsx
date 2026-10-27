import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, Clapperboard, Play } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../lib/theme';
import { fetchPresentationSessions, type PresentationSession } from '../../lib/presentation';

export default function PresentationScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [sessions, setSessions] = useState<PresentationSession[]>([]);
  const [loadedForAccount, setLoadedForAccount] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountKey = user?.id || 'public';
  const isLoading = isAuthLoading || loadedForAccount !== accountKey || isRefreshing;

  const loadSessions = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      setSessions(await fetchPresentationSessions());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load presentations.');
    } finally {
      setLoadedForAccount(accountKey);
      setIsRefreshing(false);
    }
  }, [accountKey]);

  useFocusEffect(useCallback(() => {
    if (isAuthLoading) return undefined;
    let isActive = true;
    void fetchPresentationSessions()
      .then((loadedSessions) => {
        if (isActive) {
          setSessions(loadedSessions);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load presentations.');
      })
      .finally(() => {
        if (isActive) setLoadedForAccount(accountKey);
      });
    return () => {
      isActive = false;
    };
  }, [accountKey, isAuthLoading]));

  return (
    <View style={styles.screen}>
      <View>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>READY TO SING</Text>
          <Text style={styles.heading}>Presentation</Text>
          <Text style={styles.intro}>Choose a session to display its songs and lyrics.</Text>
        </View>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Sessions</Text>
          <Text style={styles.sectionCount}>{sessions.length} AVAILABLE</Text>
        </View>
      </View>
      <FlatList
        style={styles.sessionList}
        data={sessions}
        keyExtractor={(session) => session.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Present ${item.name}, ${item.items.length} songs`}
            onPress={() => router.push({ pathname: '/presentation/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
          >
            <View style={styles.sessionIcon}><Clapperboard color={colors.forest} size={21} strokeWidth={1.7} /></View>
            <View style={styles.sessionCopy}>
              <Text numberOfLines={1} style={styles.sessionName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.sessionMeta}>
                {item.items.length} {item.items.length === 1 ? 'song' : 'songs'}{item.description ? `  ·  ${item.description}` : ''}
              </Text>
            </View>
            <View style={styles.presentButton}><Play color={colors.white} fill={colors.white} size={14} /></View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isLoading ? <ActivityIndicator color={colors.forest} /> : <ArrowRight color={colors.saffron} size={22} />}
            <Text style={styles.emptyTitle}>
              {error ? 'Unable to load sessions' : isLoading ? 'Loading sessions' : 'No sessions available'}
            </Text>
            <Text style={styles.emptyBody}>
              {error || (isLoading
                ? ''
                : !user
                  ? 'These sessions are limited to Sai centers. Sign in from the profile button to see the sessions shared with you.'
                  : 'No sessions are currently shared with your account.')}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadSessions()} tintColor={colors.forest} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  sessionList: { flex: 1 },
  listContent: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: 16, paddingBottom: 16 },
  header: { backgroundColor: colors.forest, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  eyebrow: { color: '#E6C08B', fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginBottom: 5 },
  heading: { color: colors.white, fontSize: 25, lineHeight: 30, fontFamily: 'Georgia' },
  intro: { color: '#C3D2C8', fontSize: 12, lineHeight: 16, marginTop: 3 },
  sectionHeading: { paddingHorizontal: 0, paddingTop: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontFamily: 'Georgia' },
  sectionCount: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sessionRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  pressed: { opacity: 0.72 },
  sessionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  sessionCopy: { flex: 1, marginRight: 8 },
  sessionName: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  sessionMeta: { color: colors.muted, fontSize: 10 },
  presentButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  separator: { height: 1, backgroundColor: colors.line },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 38 },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 18, textAlign: 'center', marginTop: 12 },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 280 },
});
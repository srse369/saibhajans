import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Heart, Headphones, Pause, Play, Share2 } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileButton } from '../../components/ProfileDrawer';
import { useSongs } from '../../contexts/SongsContext';
import { fetchSong, type Song } from '../../lib/songs';
import { colors } from '../../lib/theme';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { savedSongIds, toggleSavedSong } = useSongs();
  const [song, setSong] = useState<Song | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const playback = useAudioPlayerStatus(player);
  const [audioError, setAudioError] = useState<string | null>(null);
  const isSaved = song ? savedSongIds.includes(song.id) : false;

  useEffect(() => {
    let isActive = true;
    void fetchSong(id)
      .then((loadedSong) => {
        if (isActive) setSong(loadedSong);
      })
      .catch((cause: unknown) => {
        if (isActive) setDetailError(cause instanceof Error ? cause.message : 'Unable to open this song.');
      });
    return () => {
      isActive = false;
    };
  }, [id]);

  useEffect(() => {
    player.replace(song?.audioLink?.trim() || null);
    return () => {
      player.pause();
      player.clearLockScreenControls();
    };
  }, [player, song?.audioLink]);

  async function togglePlayback() {
    if (!song?.audioLink) return;
    setAudioError(null);
    if (playback.playing) {
      player.pause();
      return;
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      player.setActiveForLockScreen(true, { title: song.name, artist: 'Sai Bhajans' });
      player.play();
    } catch {
      setAudioError('Audio could not be started. Check your connection and try again.');
    }
  }

  if (song?.id !== id) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.loadingScreen}>
        {detailError ? null : <ActivityIndicator color={colors.forest} />}
        <Text style={styles.notFoundTitle}>{detailError ? 'Unable to open song' : 'Opening songbook'}</Text>
        {detailError ? <Text style={styles.loadingText}>{detailError}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backTextButton}>
          <Text style={styles.backText}>{detailError ? 'Return to the songbook' : 'Go back'}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!song) return null;

  const metadata = [song.deity, song.language, song.raga, song.tempo].filter(Boolean);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={colors.ink} size={21} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share song"
            onPress={() => void Share.share({ message: `${song.name}\n${song.externalSourceUrl || ''}` })}
            style={styles.iconButton}
          >
            <Share2 color={colors.ink} size={19} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved songs' : 'Save song'}
            onPress={() => toggleSavedSong(song.id)}
            style={styles.iconButton}
          >
            <Heart color={isSaved ? colors.rose : colors.ink} fill={isSaved ? colors.rose : 'transparent'} size={20} strokeWidth={1.8} />
          </Pressable>
          <ProfileButton />
        </View>
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View style={styles.songIntro}>
          <Text style={styles.songEyebrow}>{song.language?.toLocaleUpperCase() || 'BHAJAN'}</Text>
          <Text style={styles.songTitle}>{song.name}</Text>
          {song.deity ? <Text style={styles.deityName}>A song for {song.deity}</Text> : null}
          {metadata.length > 0 ? (
            <View style={styles.metadataRow}>
              {metadata.map((value, index) => (
                <Text key={`${value}-${index}`} style={styles.metadataText}>{value}</Text>
              ))}
            </View>
          ) : null}
        </View>

        {song.audioLink ? (
          <View style={styles.playerCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playback.playing ? 'Pause bhajan' : 'Play bhajan'}
              onPress={() => void togglePlayback()}
              style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
            >
              {playback.isBuffering ? (
                <ActivityIndicator color={colors.white} />
              ) : playback.playing ? (
                <Pause color={colors.white} fill={colors.white} size={20} />
              ) : (
                <Play color={colors.white} fill={colors.white} size={20} />
              )}
            </Pressable>
            <View style={styles.playerInfo}>
              <Text style={styles.playerTitle}>{playback.playing ? 'Now playing' : 'Listen to this bhajan'}</Text>
              <View style={styles.trackMeta}>
                <Headphones color={colors.muted} size={13} />
                <Text style={styles.trackTime}>{formatTime(playback.currentTime)} / {formatTime(playback.duration)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${playback.duration ? Math.min(100, (playback.currentTime / playback.duration) * 100) : 0}%` }]} />
              </View>
              {audioError || playback.error ? <Text style={styles.audioError}>{audioError || playback.error}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.lyricsHeader}>
          <Text style={styles.lyricsLabel}>LYRICS</Text>
          <View style={styles.lyricsRule} />
        </View>
        {song.lyrics?.trim() ? (
          <Text style={styles.lyricsText}>{song.lyrics.trim()}</Text>
        ) : (
          <Text style={styles.noLyrics}>Lyrics have not been added for this song yet.</Text>
        )}
        {song.meaning?.trim() ? (
          <View style={styles.meaningBlock}>
            <Text style={styles.lyricsLabel}>MEANING</Text>
            <Text style={styles.meaningText}>{song.meaning.trim()}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  detailScroll: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },
  notFoundTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 23 },
  backTextButton: { marginTop: 16, padding: 10 },
  backText: { color: colors.forest, fontSize: 14, fontWeight: '600' },
  topBar: { height: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  detailContent: { paddingHorizontal: 24, paddingBottom: 42 },
  songIntro: { alignItems: 'center', paddingTop: 16, paddingBottom: 27 },
  songEyebrow: { color: colors.saffron, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  songTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 29, lineHeight: 36, textAlign: 'center', marginTop: 8 },
  deityName: { color: colors.muted, fontSize: 13, marginTop: 6 },
  metadataRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  metadataText: { color: colors.forest, backgroundColor: colors.sage, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6, fontSize: 11, overflow: 'hidden' },
  playerCard: { minHeight: 88, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  playButtonPressed: { opacity: 0.75 },
  playerInfo: { flex: 1 },
  playerTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  trackMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  trackTime: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 3, backgroundColor: colors.line, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.saffron },
  audioError: { color: colors.error, fontSize: 11, marginTop: 6 },
  lyricsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 19 },
  lyricsLabel: { color: colors.saffron, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  lyricsRule: { flex: 1, height: 1, backgroundColor: colors.line },
  lyricsText: { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, fontFamily: 'Georgia', fontSize: 19, lineHeight: 34, textAlign: 'center', paddingHorizontal: 19, paddingVertical: 22 },
  noLyrics: { color: colors.muted, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, fontSize: 14, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  meaningBlock: { marginTop: 34, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  meaningText: { color: colors.muted, fontSize: 15, lineHeight: 24, marginTop: 12 },
});
import { router, usePathname } from 'expo-router';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileButton } from './ProfileDrawer';
import { colors } from '../lib/theme';

export function AppHeader() {
  const pathname = usePathname();
  const isSavedScreen = pathname === '/saved';
  const isPresenting = pathname.startsWith('/presentation/');

  function openSavedSongs() {
    if (isSavedScreen) {
      router.replace('/(tabs)');
    } else {
      router.push('/saved');
    }
  }

  if (isPresenting) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bar}>
        <View style={styles.brand}>
          <Image
            accessibilityLabel="Sri Sathya Sai Baba"
            source={require('../../assets/sai.webp')}
            resizeMode="cover"
            style={styles.portrait}
          />
          <Image
            accessibilityLabel="Sai values logo"
            source={require('../../assets/sai-values-logo-transparent.png')}
            resizeMode="contain"
            style={styles.logo}
          />
        </View>
        <View pointerEvents="none" style={styles.titleWrap}>
          <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.title}>Sri Sathya Sai Bhajans</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSavedScreen ? 'Back to songs' : 'Open favorite bhajans'}
            onPress={openSavedSongs}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            {isSavedScreen
              ? <ArrowLeft color={colors.white} size={19} strokeWidth={1.8} />
              : <Heart color={colors.white} size={19} strokeWidth={1.8} />}
          </Pressable>
          <ProfileButton />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.forest },
  bar: { minHeight: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  portrait: { width: 38, height: 38, borderRadius: 19, marginRight: 8 },
  logo: { width: 38, height: 38 },
  titleWrap: { position: 'absolute', left: 110, right: 110, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.white, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
  actionButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#426756', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});

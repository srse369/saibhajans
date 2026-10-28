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
            accessibilityLabel="Sai values logo"
            source={require('../../assets/sai-values-logo-transparent.png')}
            resizeMode="contain"
            style={styles.logo}
          />
          <Text numberOfLines={1} style={styles.title}>Sai Bhajans</Text>
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
  bar: { minHeight: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 34, height: 34, marginRight: 10 },
  title: { color: colors.white, fontFamily: 'Georgia', fontSize: 18, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
  actionButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#426756', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});

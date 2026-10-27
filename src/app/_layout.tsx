import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppHeader } from '../components/AppHeader';
import { AuthProvider } from '../contexts/AuthContext';
import { LiveSessionProvider } from '../contexts/LiveSessionContext';
import { SongsProvider } from '../contexts/SongsContext';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LiveSessionProvider>
          <SongsProvider>
            <StatusBar style="light" />
            <View style={{ flex: 1 }}>
              <AppHeader />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="song/[id]" />
                <Stack.Screen name="singers/[id]" />
                <Stack.Screen name="presentation/[id]" />
                <Stack.Screen name="centers" />
                <Stack.Screen name="saved" />
              </Stack>
            </View>
          </SongsProvider>
        </LiveSessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
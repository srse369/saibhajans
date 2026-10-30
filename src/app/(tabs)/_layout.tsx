import { Tabs } from 'expo-router';
import { AudioLines, ListMusic, Music2, Presentation, UsersRound } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../lib/theme';

export default function TabLayout() {
  const { user, isLoading } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 84,
          paddingTop: 9,
          paddingBottom: 20,
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Songs',
          tabBarIcon: ({ color, size }) => <Music2 color={color} size={size} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="singers"
        options={{
          title: 'Singers',
          href: isLoading || !user ? null : undefined,
          tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          title: 'Pitches',
          href: isLoading || !user ? null : undefined,
          tabBarIcon: ({ color, size }) => <AudioLines color={color} size={size} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live',
          tabBarIcon: ({ color, size }) => <ListMusic color={color} size={size} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="presentation"
        options={{
          title: 'Presentations',
          tabBarIcon: ({ color, size }) => <Presentation color={color} size={size} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}
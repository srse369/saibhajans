import { View } from 'react-native';
import { SongLibrary } from '../../components/SongLibrary';
import { colors } from '../../lib/theme';

export default function DiscoverScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest }}>
      <SongLibrary />
    </View>
  );
}
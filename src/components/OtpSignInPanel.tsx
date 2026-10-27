import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { colors } from '../lib/theme';
import { requestSingerLoginCode, verifySingerLoginCode, type SingerUser } from '../lib/singers';

interface OtpSignInPanelProps {
  description: string;
  onSignedIn: (user: SingerUser) => Promise<void> | void;
}

export function OtpSignInPanel({ description, onSignedIn }: OtpSignInPanelProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const normalizedEmail = email.trim().toLocaleLowerCase();
    if (!normalizedEmail.includes('@')) {
      setError('Enter the email address associated with your Sai center account.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await requestSingerLoginCode(normalizedEmail);
      setEmail(normalizedEmail);
      setCodeSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send a sign-in code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode() {
    if (code.trim().length !== 6) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const user = await verifySingerLoginCode(email, code.trim());
      await onSignedIn(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify the sign-in code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.body}>
      <View style={styles.titleRow}>
        <Mail color={colors.saffron} size={19} strokeWidth={1.8} />
        <Text style={styles.title}>{codeSent ? 'Check your email' : 'Sign in to continue'}</Text>
      </View>
      <Text style={styles.copy}>
        {codeSent ? `Enter the six-digit code sent to ${email}.` : description}
      </Text>
      {codeSent ? (
        <>
          <TextInput
            accessibilityLabel="Six-digit email code"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={code}
          />
          <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void verifyCode()} style={styles.primaryButton}>
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryLabel}>Verify code</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setCodeSent(false); setCode(''); setError(null); }} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Use a different email</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Sai center email address"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
          />
          <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void sendCode()} style={styles.primaryButton}>
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryLabel}>Send sign-in code</Text>}
          </Pressable>
        </>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: colors.ink, fontSize: 19, fontFamily: 'Georgia' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 9, marginBottom: 18 },
  input: { minHeight: 50, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, color: colors.ink, fontSize: 15, paddingHorizontal: 14, marginBottom: 12 },
  primaryButton: { minHeight: 48, backgroundColor: colors.forest, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryLabel: { color: colors.white, fontSize: 14, fontWeight: '600' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { color: colors.forest, fontSize: 13, fontWeight: '600' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
});
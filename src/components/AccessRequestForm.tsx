import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../lib/theme';
import { submitFeedback } from '../lib/singers';

export function AccessRequestForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [name, setName] = useState('');
  const [center, setCenter] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const trimmedEmail = email.trim();
    if (name.trim().length < 2 || center.trim().length < 2) {
      setError('Please enter your name and Sai center.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter the email address you want registered.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const details = `Name: ${name.trim()}\nSai center: ${center.trim()}\nEmail to register: ${trimmedEmail}${notes.trim() ? `\nNotes: ${notes.trim()}` : ''}`;
      await submitFeedback({ feedback: details, email: trimmedEmail, context: 'Access request', category: 'question' });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send your request. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return <Text style={styles.thanks}>Thank you! Your access request was sent. We’ll email you once you’re registered.</Text>;
  }

  return (
    <View style={styles.box}>
      <TextInput accessibilityLabel="Your name" autoComplete="name" onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} style={styles.input} value={name} />
      <TextInput accessibilityLabel="Your Sai center" onChangeText={setCenter} placeholder="Your Sai center" placeholderTextColor={colors.muted} style={styles.input} value={center} />
      <TextInput
        accessibilityLabel="Email to register"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email to register"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={email}
      />
      <TextInput
        accessibilityLabel="Additional notes"
        maxLength={500}
        multiline
        onChangeText={setNotes}
        placeholder="Anything else we should know (optional)"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.multiline]}
        textAlignVertical="top"
        value={notes}
      />
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void send()} style={styles.button}>
        {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonLabel}>Request access</Text>}
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 4 },
  input: { minHeight: 46, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, color: colors.ink, fontSize: 14, paddingHorizontal: 12, marginBottom: 10 },
  multiline: { minHeight: 72, paddingTop: 10 },
  button: { minHeight: 46, backgroundColor: colors.forest, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: '600' },
  thanks: { color: colors.ink, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
});

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../lib/theme';
import { submitFeedback } from '../lib/singers';

interface FeedbackFormProps {
  context: string;
  initialEmail?: string;
  messagePlaceholder?: string;
}

export function FeedbackForm({ context, initialEmail = '', messagePlaceholder = 'Your feedback or suggestion' }: FeedbackFormProps) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const trimmed = message.trim();
    const trimmedEmail = email.trim();
    if (trimmed.length < 5) {
      setError('Please enter a few words of feedback.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address so we can reply.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await submitFeedback({ feedback: trimmed, email: trimmedEmail, context });
      setSent(true);
      setMessage('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send feedback. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.box}>
        <Text style={styles.thanks}>Thank you! Your feedback was sent.</Text>
        <Pressable accessibilityRole="button" onPress={() => setSent(false)} style={styles.linkButton}>
          <Text style={styles.linkLabel}>Send more feedback</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <TextInput
        accessibilityLabel="Feedback message"
        maxLength={2000}
        multiline
        onChangeText={setMessage}
        placeholder={messagePlaceholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.multiline]}
        textAlignVertical="top"
        value={message}
      />
      <TextInput
        accessibilityLabel="Your email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Your email (so we can reply)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={email}
      />
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void send()} style={styles.button}>
        {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonLabel}>Send feedback</Text>}
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 4 },
  input: { minHeight: 46, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, color: colors.ink, fontSize: 14, paddingHorizontal: 12, marginBottom: 10 },
  multiline: { minHeight: 96, paddingTop: 10 },
  button: { minHeight: 46, backgroundColor: colors.forest, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: '600' },
  thanks: { color: colors.ink, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  linkButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { color: colors.forest, fontSize: 13, fontWeight: '600' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
});

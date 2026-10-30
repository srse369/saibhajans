import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ArrowRight, LogIn, MessageSquare, ShieldCheck, UserPlus, X } from 'lucide-react-native';
import { AccessRequestForm } from './AccessRequestForm';
import { FeedbackForm } from './FeedbackForm';
import { colors } from '../lib/theme';
import { isReviewLoginAvailable, requestSingerLoginCode, verifyReviewLogin, verifySingerLoginCode, type SingerUser } from '../lib/singers';

interface OtpSignInPanelProps {
  description: string;
  onSignedIn: (user: SingerUser) => Promise<void> | void;
  onFormLayout?: (y: number) => void;
}

export function OtpSignInPanel({ description, onSignedIn, onFormLayout }: OtpSignInPanelProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [reviewLoginAvailable, setReviewLoginAvailable] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewPassword, setReviewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [helpForm, setHelpForm] = useState<'signin' | 'access' | 'feedback' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const panelWidth = width;
  const [slide] = useState(() => new Animated.Value(0));
  const [collapse] = useState(() => new Animated.Value(1));
  const [formHeight, setFormHeight] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const activePanel = reviewMode ? 'review' : helpForm;

  useEffect(() => {
    if (activePanel) {
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [activePanel, slide]);

  function closePanel() {
    setReviewMode(false);
    setReviewPassword('');
    setCodeSent(false);
    setCode('');
    setHelpForm(null);
    setError(null);
  }

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    Animated.timing(collapse, { toValue: 0, duration: 240, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(() => {
      closePanel();
      setIsClosing(false);
      collapse.setValue(1);
    });
  }

  useEffect(() => {
    let isActive = true;
    void isReviewLoginAvailable()
      .then((enabled) => {
        if (isActive) setReviewLoginAvailable(enabled);
      })
      .catch(() => {
        if (isActive) setReviewLoginAvailable(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

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

  async function signInWithReviewCredentials() {
    if (!email.trim() || !reviewPassword) {
      setError('Enter the review account email and password.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const user = await verifyReviewLogin(email.trim(), reviewPassword);
      await onSignedIn(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in with review credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const options = [
    { key: 'signin', icon: <LogIn color={colors.forest} size={17} />, title: 'Sign in', hint: 'Get a one-time code by email', onPress: () => { setHelpForm('signin'); setError(null); } },
    ...(reviewLoginAvailable ? [{ key: 'review', icon: <ShieldCheck color={colors.forest} size={17} />, title: 'App Store review access', hint: 'For Apple reviewers with supplied credentials', onPress: () => { setReviewMode(true); setError(null); } }] : []),
    { key: 'access', icon: <UserPlus color={colors.forest} size={17} />, title: 'Request access', hint: 'Ask to be registered as a user', onPress: () => { setHelpForm('access'); setError(null); } },
    { key: 'feedback', icon: <MessageSquare color={colors.forest} size={17} />, title: 'Send feedback', hint: 'Share a suggestion or report a problem', onPress: () => { setHelpForm('feedback'); setError(null); } },
  ];

  const formContent = (
    <Animated.View style={{ transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }) }] }}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {activePanel === 'signin' ? 'Sign in' : activePanel === 'review' ? 'App Store review access' : activePanel === 'access' ? 'Request access' : 'Send feedback'}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close form" hitSlop={10} onPress={requestClose} style={styles.closeButton}>
                <X color={colors.muted} size={20} />
              </Pressable>
            </View>
            <View>
              {activePanel === 'signin' ? (
                codeSent ? (
                  <>
                    <Text style={styles.copy}>{`Enter the six-digit code sent to ${email}.`}</Text>
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
                )
              ) : null}
              {activePanel === 'access' ? <AccessRequestForm initialEmail={email} /> : null}
              {activePanel === 'feedback' ? <FeedbackForm context="Feedback" initialEmail={email} messagePlaceholder="Your feedback or suggestion" /> : null}
              {activePanel === 'review' ? (
                <>
                  <Text style={styles.copy}>Use the review credentials supplied for this app.</Text>
          <TextInput
            accessibilityLabel="App review account email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Review account email"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
          />
          <TextInput
            accessibilityLabel="App review password"
            autoCapitalize="none"
            autoComplete="password"
            onChangeText={setReviewPassword}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={reviewPassword}
          />
          <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void signInWithReviewCredentials()} style={styles.primaryButton}>
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryLabel}>Sign in</Text>}
          </Pressable>
                </>
              ) : null}
              {error && activePanel !== null ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            </View>
          </Animated.View>
  );

  return (
    <View style={styles.body}>
      {error && !activePanel ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.noticeText}>Sign-in is limited to pre-registered users. Use the email address connected to your Sai center account.</Text>
      {options.map((option) => (activePanel === option.key ? (
        <Animated.View
          key={option.key}
          style={[styles.notice, isClosing && formHeight > 0 ? { height: collapse.interpolate({ inputRange: [0, 1], outputRange: [62, formHeight] }) } : null]}
          onLayout={(event) => {
            if (isClosing) return;
            setFormHeight(event.nativeEvent.layout.height);
            onFormLayout?.(event.nativeEvent.layout.y);
          }}
        >
          {formContent}
        </Animated.View>
      ) : (
        <Pressable key={option.key} accessibilityRole="button" onPress={option.onPress} style={styles.optionButton}>
          {option.icon}
          <View style={styles.optionCopy}>
            <Text style={styles.optionLabel}>{option.title}</Text>
            <Text style={styles.optionHint}>{option.hint}</Text>
          </View>
          <ArrowRight color={colors.muted} size={16} />
        </Pressable>
      )))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: colors.ink, fontSize: 19, fontFamily: 'Georgia' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 9, marginBottom: 18 },
  input: { minHeight: 50, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, color: colors.ink, fontSize: 15, paddingHorizontal: 14, marginBottom: 12 },
  primaryButton: { minHeight: 48, backgroundColor: colors.forest, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryLabel: { color: colors.white, fontSize: 14, fontWeight: '600' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  optionButton: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface },
  optionCopy: { flex: 1 },
  optionLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  optionHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  formTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { color: colors.forest, fontSize: 13, fontWeight: '600' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  notice: { overflow: 'hidden', backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 14, marginTop: 14 },
  noticeText: { color: colors.ink, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
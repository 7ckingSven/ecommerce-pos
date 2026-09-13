import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { COLORS, SPACING, RADIUS, SHADOW, API_BASE_URL } from '../utils/constants';

export default function EmailOTPScreen({ navigation, route }) {
  const { email } = route.params;
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [seconds,  setSeconds]  = useState(300); // 5 minutes
  const [resendCD, setResendCD] = useState(60);  // 60s cooldown
  const [canResend, setCanResend] = useState(false);
  const inputRef = useRef(null);

  // ── 5-minute OTP countdown ──
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  // ── 60-second resend cooldown ──
  useEffect(() => {
    if (resendCD <= 0) { setCanResend(true); return; }
    const t = setInterval(() => setResendCD(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendCD]);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  const isExpired = seconds <= 0;
  const canVerify = otp.length === 6 && !isExpired;

  async function handleVerify() {
    if (!canVerify) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/auth/verify-email-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        // Navigate to Register with verified email
        navigation.navigate('Register', { verifiedEmail: email });
      } else {
        Alert.alert('Invalid OTP', data.error || 'Incorrect or expired OTP. Please try again.');
        setOtp('');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-email-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      if (res.ok) {
        setSeconds(300);
        setResendCD(60);
        setCanResend(false);
        setOtp('');
        Alert.alert('Sent!', 'A new OTP has been sent to your email.');
      }
    } catch (e) {}
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={COLORS.white}/>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Feather name="shield" size={36} color={COLORS.white}/>
        </View>

        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Text>

        {/* Timer */}
        <View style={[styles.timerWrap, isExpired && styles.timerExpired]}>
          <Feather name="clock" size={16} color={isExpired ? '#ef4444' : COLORS.primary}/>
          <Text style={[styles.timerText, isExpired && styles.timerTextExpired]}>
            {isExpired ? 'OTP Expired' : `Expires in ${formatTime(seconds)}`}
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.label}>6-Digit OTP</Text>
          <TextInput
            ref={inputRef}
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor={COLORS.textMuted}
            value={otp}
            onChangeText={v => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="numeric"
            maxLength={6}
            autoComplete="one-time-code"
          />
          <Text style={styles.hint}>Check your inbox and spam folder.</Text>

          <TouchableOpacity
            style={[styles.btn, !canVerify && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!canVerify || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white}/>
            ) : (
              <View style={styles.btnInner}>
                <Feather name="check-circle" size={16} color={COLORS.white}/>
                <Text style={styles.btnText}>Verify OTP</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive it? </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendLink}>Resend OTP Code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendCooldown}>Resend in {resendCD}s</Text>
            )}
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:            { flex: 1, backgroundColor: COLORS.dark },
  container:       { flexGrow: 1, padding: SPACING.md, paddingTop: SPACING.xxl },
  backBtn:         { marginBottom: SPACING.lg },
  iconWrap:        {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  title:           { fontSize: 24, fontWeight: '700', color: COLORS.white, textAlign: 'center', marginBottom: 8 },
  subtitle:        { fontSize: 13, color: COLORS.grayLight, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.md },
  emailText:       { color: COLORS.primary, fontWeight: '600' },
  timerWrap:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginBottom: SPACING.lg,
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: RADIUS.sm, alignSelf: 'center',
  },
  timerExpired:    { backgroundColor: 'rgba(239,68,68,0.1)' },
  timerText:       { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  timerTextExpired:{ color: '#ef4444' },
  card:            { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.lg },
  label:           { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  otpInput:        {
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg,
    fontSize: 28, fontWeight: '700', textAlign: 'center',
    letterSpacing: 12, padding: 14, color: COLORS.dark,
    marginBottom: 6,
  },
  hint:            { fontSize: 11, color: COLORS.textMuted, marginBottom: SPACING.md },
  btn:             { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: 14, alignItems: 'center', marginBottom: SPACING.md },
  btnDisabled:     { backgroundColor: COLORS.grayLight },
  btnInner:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:         { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  resendRow:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText:      { fontSize: 13, color: COLORS.textSecondary },
  resendLink:      { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  resendCooldown:  { fontSize: 13, color: COLORS.textMuted },
});
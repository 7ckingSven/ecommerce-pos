import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../services/api';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

export default function VerifyOTPScreen({ navigation, route }) {
  const { email }         = route.params;
  const [otp,     setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer,   setTimer]   = useState(300); // 5 minutes
  const [resending, setResending] = useState(false);
  const inputs = useRef([]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function handleOtpChange(val, idx) {
    const newOtp = [...otp];
    newOtp[idx]  = val.replace(/[^0-9]/g, '').slice(-1);
    setOtp(newOtp);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  }

  function handleKeyPress(e, idx) {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('Required', 'Please enter the complete 6-digit OTP.');
      return;
    }
    if (timer === 0) {
      Alert.alert('Expired', 'OTP has expired. Please request a new one.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otp: code });
      navigation.navigate('ResetPassword', { email });
    } catch (e) {
      const msg = e?.response?.data?.error || 'Invalid OTP. Please try again.';
      Alert.alert('Error', msg);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setOtp(['', '', '', '', '', '']);
      setTimer(300);
      inputs.current[0]?.focus();
      Alert.alert('Sent!', 'A new OTP has been sent to your email.');
    } catch (e) {
      Alert.alert('Error', 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>

        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={COLORS.white}/>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Feather name="shield" size={36} color={COLORS.primary}/>
          </View>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.sub}>We sent a 6-digit code to</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={r => inputs.current[idx] = r}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
              value={digit}
              onChangeText={v => handleOtpChange(v, idx)}
              onKeyPress={e => handleKeyPress(e, idx)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Timer */}
        <Text style={[styles.timer, timer === 0 && { color: '#ef4444' }]}>
          {timer > 0 ? `OTP expires in ${formatTimer(timer)}` : 'OTP has expired'}
        </Text>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.btn, otp.join('').length < 6 && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={otp.join('').length < 6 || loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white}/>
            : (
              <View style={styles.btnInner}>
                <Feather name="check-circle" size={16} color={COLORS.white}/>
                <Text style={styles.btnText}>VERIFY OTP</Text>
              </View>
            )
          }
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={resending || timer > 0}
        >
          {resending
            ? <ActivityIndicator color={COLORS.primary} size="small"/>
            : <Text style={[styles.resendText, timer > 0 && styles.resendDisabled]}>
                {timer > 0 ? 'Resend OTP (wait for timer)' : 'Resend OTP'}
              </Text>
          }
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:           { flex: 1, backgroundColor: COLORS.dark },
  container:      { flex: 1, padding: SPACING.md, paddingTop: SPACING.xl },
  backBtn:        { marginBottom: SPACING.lg },
  iconWrap:       { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle:     { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, ...SHADOW.md },
  title:          { fontSize: 24, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  sub:            { fontSize: 13, color: COLORS.grayLight },
  email:          { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 4 },
  otpRow:         { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: SPACING.md },
  otpInput:       { width: 46, height: 56, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.grayBorder, backgroundColor: COLORS.white, textAlign: 'center', fontSize: 22, fontWeight: '700', color: COLORS.dark },
  otpInputFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  timer:          { textAlign: 'center', fontSize: 13, color: COLORS.grayLight, marginBottom: SPACING.lg },
  btn:            { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: 14, alignItems: 'center', marginBottom: SPACING.md },
  btnDisabled:    { backgroundColor: COLORS.grayLight },
  btnInner:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:        { color: COLORS.white, fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  resendBtn:      { alignItems: 'center', padding: SPACING.sm },
  resendText:     { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  resendDisabled: { color: COLORS.textMuted },
});
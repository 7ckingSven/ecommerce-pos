import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import api from '../services/api';

export default function EmailVerifyScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSendOTP() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      // Uses the shared `api` (axios) instance instead of a raw fetch() —
      // that instance carries a 30s timeout meant specifically for Render
      // free-tier cold starts (see api.js). A raw fetch() has no such
      // allowance and could throw "Network request failed" before a
      // sleeping backend even finished waking up.
      await api.post('/auth/send-email-otp', { email: email.trim().toLowerCase() });
      navigation.navigate('EmailOTP', { email: email.trim().toLowerCase() });
    } catch (e) {
      if (e.response) {
        Alert.alert('Error', e.response.data?.error || 'Failed to send OTP. Please try again.');
      } else {
        Alert.alert('Error', 'Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={COLORS.white}/>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Feather name="mail" size={36} color={COLORS.white}/>
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Before creating your account, we need to verify your email address. We'll send you a 6-digit verification code to your email.
        </Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputIcon}>
              <Feather name="mail" size={16} color={COLORS.textMuted}/>
            </View>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleSendOTP}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white}/>
            ) : (
              <View style={styles.btnInner}>
                <Feather name="send" size={16} color={COLORS.white}/>
                <Text style={styles.btnText}>Send Verification Code</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: COLORS.dark },
  container:  { flexGrow: 1, padding: SPACING.md, paddingTop: SPACING.xxl },
  backBtn:    { marginBottom: SPACING.lg },
  iconWrap:   {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  title:      { fontSize: 24, fontWeight: '700', color: COLORS.white, textAlign: 'center', marginBottom: 8 },
  subtitle:   { fontSize: 13, color: COLORS.grayLight, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xl },
  card:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.lg },
  label:      { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  inputRow:   {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg,
    marginBottom: SPACING.md,
  },
  inputIcon:  { paddingHorizontal: 12 },
  input:      { fontSize: 14, color: COLORS.dark, padding: 12 },
  inputFlex:  { flex: 1, paddingLeft: 0 },
  btn:        {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    padding: 14, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: COLORS.grayLight },
  btnInner:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:    { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  loginRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  loginText:  { fontSize: 13, color: COLORS.grayLight },
  loginLink:  { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../services/api';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

export default function ForgotPasswordScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOTP() {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      Alert.alert(
        'OTP Sent!',
        `A 6-digit OTP has been sent to ${email}. Check your inbox.`,
        [{ text: 'OK', onPress: () => navigation.navigate('VerifyOTP', { email: email.trim().toLowerCase() }) }]
      );
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={COLORS.white}/>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Feather name="mail" size={36} color={COLORS.primary}/>
          </View>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.sub}>Enter your email and we'll send you a 6-digit OTP to reset your password.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.fieldWrap}>
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
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, !email.trim() && styles.btnDisabled]}
            onPress={handleSendOTP}
            disabled={!email.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white}/>
              : (
                <View style={styles.btnInner}>
                  <Feather name="send" size={16} color={COLORS.white}/>
                  <Text style={styles.btnText}>SEND OTP</Text>
                </View>
              )
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToLogin} onPress={() => navigation.goBack()}>
            <Text style={styles.backToLoginText}>← Back to Login</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:           { flex: 1, backgroundColor: COLORS.dark },
  container:      { flexGrow: 1, padding: SPACING.md, paddingTop: SPACING.xl },
  backBtn:        { marginBottom: SPACING.lg },
  iconWrap:       { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle:     { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, ...SHADOW.md },
  title:          { fontSize: 24, fontWeight: '700', color: COLORS.white, marginBottom: SPACING.sm },
  sub:            { fontSize: 13, color: COLORS.grayLight, textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACING.lg },
  card:           { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.lg },
  fieldWrap:      { marginBottom: SPACING.md },
  label:          { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  inputRow:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg },
  inputIcon:      { paddingHorizontal: 12 },
  input:          { fontSize: 14, color: COLORS.dark, padding: 12 },
  inputFlex:      { flex: 1, paddingLeft: 0 },
  btn:            { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: 14, alignItems: 'center', marginBottom: SPACING.md },
  btnDisabled:    { backgroundColor: COLORS.grayLight },
  btnInner:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:        { color: COLORS.white, fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  backToLogin:    { alignItems: 'center' },
  backToLoginText:{ fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
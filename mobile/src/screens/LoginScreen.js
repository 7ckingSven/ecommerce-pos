import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { login, isLoggedIn } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW, APP_NAME, APP_SUBTITLE } from '../utils/constants';

export default function LoginScreen({ navigation }) {
  const [loginInput, setLoginInput] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);

  const canSubmit = loginInput.trim() !== '' && password.trim() !== '';

  // Auto-navigate if already logged in
  useEffect(() => {
    isLoggedIn().then(logged => {
      if (logged) navigation.replace('Main');
    });
  }, []);

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await login(loginInput.trim(), password);
      navigation.replace('Main');
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid credentials. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImg}
            resizeMode="cover"
          />
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.appSub}>{APP_SUBTITLE}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSub}>Sign in to continue shopping.</Text>

          {/* Login Input */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email, Username, or Phone</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Feather name="user" size={16} color={COLORS.textMuted}/>
              </View>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Enter your email, username, or phone"
                placeholderTextColor={COLORS.textMuted}
                value={loginInput}
                onChangeText={setLoginInput}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Feather name="lock" size={16} color={COLORS.textMuted}/>
              </View>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Feather name={showPass ? 'eye' : 'eye-off'} size={18} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white}/>
            ) : (
              <View style={styles.btnInner}>
                <Feather name="log-in" size={16} color={COLORS.white}/>
                <Text style={styles.btnText}>LOG IN</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Register */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>No account yet? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>© 2026 Triple E & Fiel Collins General Merchandise</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: COLORS.dark },
  container:    { flexGrow: 1, padding: SPACING.md, paddingTop: SPACING.xxl },
  logoWrap:     { alignItems: 'center', marginBottom: SPACING.lg },
  logoImg:      { width: 80, height: 80, borderRadius: RADIUS.lg, marginBottom: SPACING.sm, ...SHADOW.md },
  appName:      { fontSize: 18, fontWeight: '700', color: COLORS.white, textAlign: 'center' },
  appSub:       { fontSize: 12, color: COLORS.grayLight, textAlign: 'center', marginTop: 2 },
  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.lg },
  cardTitle:    { fontSize: 22, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },
  cardSub:      { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  fieldWrap:    { marginBottom: SPACING.md },
  label:        { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  inputRow:     {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg,
  },
  inputIcon:    { paddingHorizontal: 12 },
  input:        { fontSize: 14, color: COLORS.dark, padding: 12 },
  inputFlex:    { flex: 1, paddingLeft: 0 },
  eyeBtn:       { padding: 12 },
  btn:          {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    padding: 14, alignItems: 'center', marginBottom: SPACING.md,
  },
  btnDisabled:  { backgroundColor: COLORS.grayLight },
  btnInner:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:      { color: COLORS.white, fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  registerRow:  { flexDirection: 'row', justifyContent: 'center' },
  registerText: { fontSize: 13, color: COLORS.textSecondary },
  registerLink: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  footer:       { textAlign: 'center', fontSize: 11, color: COLORS.grayLight, marginTop: SPACING.lg },
});
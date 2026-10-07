import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login, isLoggedIn, getCustomer } from '../services/authService';
import { API_BASE_URL } from '../utils/constants';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { COLORS, SPACING, RADIUS, SHADOW, APP_NAME, APP_SUBTITLE } from '../utils/constants';

// Once a device has completed a successful login, we flag it so this screen
// greets them with "Welcome Back" on future visits. First-time users (or
// anyone who's never completed a login on this device) see plain "Login".
const HAS_LOGGED_IN_KEY = 'has_logged_in_before';

export default function LoginScreen({ navigation, route }) {
  const [loginInput, setLoginInput] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [returningUser, setReturningUser] = useState(false);

  // Set by HomeScreen.js's requireLogin() when the user tapped Add to Cart /
  // Buy Now on a product before they were logged in — lets us resume that
  // exact product after auth instead of just returning to wherever they were.
  const { redirectAfter, redirectParams } = route?.params || {};

  useEffect(() => {
    AsyncStorage.getItem(HAS_LOGGED_IN_KEY).then(val => {
      if (val === 'true') setReturningUser(true);
    });
  }, []);

  const canSubmit = loginInput.trim() !== '' && password.trim() !== '';

  // Go back to wherever the user came from instead of always landing on
  // Home. Login/Register are always pushed on top of an existing 'Main'
  // instance (Splash lands on Main via `replace`, never on Login), so
  // popToTop() reliably returns to that original Main — with its nested
  // screen history (like ProductDetail) intact — even after a multi-step
  // signup detour.
  function goToMainOrBack() {
    if (navigation.canGoBack()) {
      navigation.popToTop();
    } else {
      navigation.replace('Main');
    }
  }

  // If the user was sent here mid-action (tapped Add to Cart / Buy Now on a
  // product from HomeScreen before they'd logged in), land them straight
  // back on that product's ProductDetail screen instead of just dumping
  // them on whatever screen happened to be underneath (usually Home).
  // Falls back to plain goToMainOrBack() when there's nothing to resume.
  function resumeAfterAuth() {
    if ((redirectAfter === 'addToCart' || redirectAfter === 'buyNow') && redirectParams?.product) {
      goToMainOrBack();
      navigation.navigate('Main', {
        screen: 'Home',
        params: {
          screen: 'ProductDetail',
          params: {
            product:  redirectParams.product,
            branchId: redirectParams.branchId || null,
          },
        },
      });
      return;
    }
    goToMainOrBack();
  }

  // Auto-navigate if already logged in
  useEffect(() => {
    isLoggedIn().then(logged => {
      if (logged) resumeAfterAuth();
    });
  }, []);

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await login(loginInput.trim(), password);

      // Remember that this device has completed a login, so future visits
      // to this screen greet them with "Welcome Back" instead of "Login".
      try { await AsyncStorage.setItem(HAS_LOGGED_IN_KEY, 'true'); } catch (_) {}

      // Save FCM token after login
      try {
        const fcm      = getMessaging();
        const token    = await getToken(fcm);
        const customer = await getCustomer();
        if (token && customer?.customer_id) {
          await fetch(`${API_BASE_URL}/customer/fcm-token`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Customer-ID': customer.customer_id,
            },
            body: JSON.stringify({ fcm_token: token }),
          });
          console.log('FCM token saved after login');
        }
      } catch (fcmErr) {
        console.log('FCM token save error:', fcmErr);
      }

      resumeAfterAuth();
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.error || 'Something went wrong. Please try again.';

      if (status === 401 && msg.includes('No account')) {
        // User not found — clear password, keep username
        Alert.alert('User Not Found', msg);
        setPassword('');
      } else if (status === 401 && msg.includes('Incorrect password')) {
        // Wrong password — keep username, clear password
        Alert.alert('Incorrect Password', msg);
        setPassword('');
      } else if (status === 403) {
        Alert.alert('Account Inactive', msg);
        setPassword('');
      } else {
        Alert.alert('Login Failed', msg);
        setPassword('');
      }
      // Username is always retained ✅
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
          <Text style={styles.appName}>TEFC E-Commerce</Text>
          <Text style={styles.appSub}>Triple E & Fiel Collince General Merchandise</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{returningUser ? 'Welcome Back' : 'Login'}</Text>
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

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

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
            <TouchableOpacity onPress={() => navigation.navigate('EmailVerify')}>
              <Text style={styles.registerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>© 2026 Triple E & Fiel Collince General Merchandise</Text>
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
  forgotBtn:    { alignSelf: 'flex-end', marginBottom: SPACING.md, marginTop: -SPACING.sm },
  forgotText:   { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  registerRow:  { flexDirection: 'row', justifyContent: 'center' },
  registerText: { fontSize: 13, color: COLORS.textSecondary },
  registerLink: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  footer:       { textAlign: 'center', fontSize: 11, color: COLORS.grayLight, marginTop: SPACING.lg },
});
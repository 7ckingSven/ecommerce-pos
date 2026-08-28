import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import api from '../services/api';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

export default function ResetPasswordScreen({ navigation, route }) {
  const { email }               = route.params;
  const [newPass,   setNewPass] = useState('');
  const [confirm,   setConfirm] = useState('');
  const [showNew,   setShowNew] = useState(false);
  const [showConf,  setShowConf]= useState(false);
  const [loading,   setLoading] = useState(false);

  async function handleReset() {
    if (!newPass || !confirm) {
      Alert.alert('Required', 'Please fill in all fields.'); return;
    }
    if (newPass.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.'); return;
    }
    if (newPass !== confirm) {
      Alert.alert('Error', 'Passwords do not match.'); return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, new_password: newPass });
      Alert.alert(
        '✅ Password Reset!',
        'Your password has been reset successfully. Please log in with your new password.',
        [{ text: 'Log In', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) }]
      );
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to reset password.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Feather name="lock" size={36} color={COLORS.primary}/>
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.sub}>Create a new password for {email}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* New Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Feather name="lock" size={16} color={COLORS.textMuted}/>
              </View>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Min. 8 characters"
                placeholderTextColor={COLORS.textMuted}
                value={newPass}
                onChangeText={setNewPass}
                secureTextEntry={!showNew}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
                <Feather name={showNew ? 'eye' : 'eye-off'} size={18} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputRow, confirm && newPass !== confirm && { borderColor: '#ef4444' }]}>
              <View style={styles.inputIcon}>
                <Feather name="lock" size={16} color={COLORS.textMuted}/>
              </View>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Re-enter new password"
                placeholderTextColor={COLORS.textMuted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConf}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConf(!showConf)}>
                <Feather name={showConf ? 'eye' : 'eye-off'} size={18} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>
            {confirm && newPass !== confirm && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.btn, (!newPass || !confirm) && styles.btnDisabled]}
            onPress={handleReset}
            disabled={!newPass || !confirm || loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white}/>
              : (
                <View style={styles.btnInner}>
                  <Feather name="check" size={16} color={COLORS.white}/>
                  <Text style={styles.btnText}>RESET PASSWORD</Text>
                </View>
              )
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: COLORS.dark },
  container:  { flexGrow: 1, padding: SPACING.md, paddingTop: SPACING.xl },
  iconWrap:   { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, ...SHADOW.md },
  title:      { fontSize: 24, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  sub:        { fontSize: 13, color: COLORS.grayLight, textAlign: 'center' },
  card:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.lg },
  fieldWrap:  { marginBottom: SPACING.md },
  label:      { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg },
  inputIcon:  { paddingHorizontal: 12 },
  input:      { fontSize: 14, color: COLORS.dark, padding: 12 },
  inputFlex:  { flex: 1, paddingLeft: 0 },
  eyeBtn:     { padding: 12 },
  btn:        { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: 14, alignItems: 'center' },
  btnDisabled:{ backgroundColor: COLORS.grayLight },
  btnInner:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:    { color: COLORS.white, fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  errorText:  { fontSize: 11, color: '#ef4444', marginTop: 4 },
});
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { register } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import PSGCAddressPicker, { psgcToAddressString } from '../components/PSGCAddressPicker';

export default function RegisterScreen({ navigation }) {
  const [step,        setStep]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [psgcAddress, setPsgcAddress] = useState({});
  const [form, setForm] = useState({
    fname: '', mi: '', lname: '',
    email: '', username: '', phone_number: '',
    street: '', barangay: '', city: '', province: '', zip_code: '',
    dob: '', gender: '',
    password: '', confirmPassword: '',
  });

  function update(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function nextStep() {
    if (step === 1) {
      if (!form.fname || !form.lname)
        return Alert.alert('Required', 'Please enter your first and last name.');
    }
    if (step === 2) {
      if (!form.email || !form.username || !form.phone_number)
        return Alert.alert('Required', 'Please fill in all contact details.');
      if (form.phone_number.length !== 11 || !form.phone_number.startsWith('09'))
        return Alert.alert('Invalid', 'Phone number must be 11 digits starting with 09.');
    }
    setStep(step + 1);
  }

  async function handleRegister() {
    if (!form.password || form.password !== form.confirmPassword)
      return Alert.alert('Error', 'Passwords do not match.');
    if (form.password.length < 8)
      return Alert.alert('Error', 'Password must be at least 8 characters.');

    setLoading(true);
    try {
      // Combine address fields into one formatted string
      const addressParts = [
        form.street.trim(),
        form.barangay.trim(),
        form.city.trim(),
        form.province.trim(),
        form.zip_code.trim(),
      ].filter(Boolean);
      const combinedAddress = addressParts.join(', ');

      await register({
        fname:        form.fname,
        mi:           form.mi,
        lname:        form.lname,
        email:        form.email,
        username:     form.username,
        phone_number: form.phone_number,
        address:      combinedAddress,
        dob:          form.dob,
        gender:       form.gender,
        password:     form.password,
      });
      Alert.alert('Success', 'Account created! Please log in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ['Personal', 'Contact', 'Account'];
  const stepIcons  = ['user', 'phone', 'lock'];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
          >
            <Feather name="arrow-left" size={20} color={COLORS.white}/>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={{ width: 36 }}/>
        </View>

        {/* Step Indicators */}
        <View style={styles.steps}>
          {stepLabels.map((label, i) => (
            <View key={i} style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                step > i && styles.stepDotDone,
                step === i + 1 && styles.stepDotCurrent,
              ]}>
                {step > i
                  ? <Feather name="check" size={13} color={COLORS.white}/>
                  : <Feather name={stepIcons[i]} size={13} color={step === i+1 ? COLORS.primaryLight : COLORS.grayLight}/>
                }
              </View>
              <Text style={[styles.stepLabel, step === i+1 && styles.stepLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>

          {/* Step 1 — Personal */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Personal Information</Text>
              {[
                { key:'fname',  label:'First Name *',           icon:'user',  placeholder:'Juan' },
                { key:'mi',     label:'Middle Initial (opt.)',   icon:'user',  placeholder:'S.' },
                { key:'lname',  label:'Last Name *',             icon:'user',  placeholder:'Dela Cruz' },
              ].map(f => (
                <View key={f.key} style={styles.fieldWrap}>
                  <Text style={styles.label}>{f.label}</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}><Feather name={f.icon} size={16} color={COLORS.textMuted}/></View>
                    <TextInput
                      style={[styles.input, styles.inputFlex]}
                      placeholder={f.placeholder}
                      placeholderTextColor={COLORS.textMuted}
                      value={form[f.key]}
                      onChangeText={v => update(f.key, v)}
                    />
                  </View>
                </View>
              ))}

              {/* Gender */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Gender (optional)</Text>
                <View style={styles.genderRow}>
                  {['male','female','prefer_not_to_say'].map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]}
                      onPress={() => update('gender', g)}
                    >
                      <Text style={[styles.genderBtnText, form.gender === g && styles.genderBtnTextActive]}>
                        {g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Prefer not'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Step 2 — Contact */}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Contact Details</Text>
              {[
                { key:'phone_number', label:'Phone Number *', icon:'phone',  placeholder:'09XXXXXXXXX', keyboard:'phone-pad', max:11 },
                { key:'email',        label:'Email Address *', icon:'mail',   placeholder:'juan@email.com', keyboard:'email-address' },
                { key:'username',     label:'Username *',       icon:'at-sign',placeholder:'Choose a username' },
              ].map(f => (
                <View key={f.key} style={styles.fieldWrap}>
                  <Text style={styles.label}>{f.label}</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputIcon}><Feather name={f.icon} size={16} color={COLORS.textMuted}/></View>
                    <TextInput
                      style={[styles.input, styles.inputFlex]}
                      placeholder={f.placeholder}
                      placeholderTextColor={COLORS.textMuted}
                      value={form[f.key]}
                      onChangeText={v => update(f.key, v)}
                      keyboardType={f.keyboard || 'default'}
                      autoCapitalize="none"
                      maxLength={f.max}
                    />
                  </View>
                </View>
              ))}

              <Text style={[styles.label, { marginBottom: 8 }]}>Address (optional)</Text>
              <PSGCAddressPicker
                value={psgcAddress}
                onChange={addr => {
                  setPsgcAddress(addr);
                  update('street',   addr.street || '');
                  update('barangay', addr.barangayName || '');
                  update('city',     addr.cityName || '');
                  update('province', addr.provinceName || '');
                  update('zip_code', addr.zip_code || '');
                }}
              />
            </>
          )}

          {/* Step 3 — Account */}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Account Setup</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputIcon}><Feather name="lock" size={16} color={COLORS.textMuted}/></View>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="At least 8 characters"
                    placeholderTextColor={COLORS.textMuted}
                    value={form.password}
                    onChangeText={v => update('password', v)}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                    <Feather name={showPass ? 'eye' : 'eye-off'} size={18} color={COLORS.textMuted}/>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Confirm Password *</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputIcon}><Feather name="lock" size={16} color={COLORS.textMuted}/></View>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="Re-enter your password"
                    placeholderTextColor={COLORS.textMuted}
                    value={form.confirmPassword}
                    onChangeText={v => update('confirmPassword', v)}
                    secureTextEntry={!showConfirm}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                    <Feather name={showConfirm ? 'eye' : 'eye-off'} size={18} color={COLORS.textMuted}/>
                  </TouchableOpacity>
                </View>
                {form.confirmPassword.length > 0 && (
                  <Text style={{ fontSize: 11, marginTop: 4,
                    color: form.password === form.confirmPassword ? COLORS.primary : COLORS.error }}>
                    {form.password === form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </Text>
                )}
              </View>
            </>
          )}

          {/* Button */}
          <TouchableOpacity
            style={styles.btn}
            onPress={step < 3 ? nextStep : handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white}/>
            ) : (
              <View style={styles.btnInner}>
                <Text style={styles.btnText}>{step < 3 ? 'Continue' : 'Create Account'}</Text>
                <Feather name={step < 3 ? 'arrow-right' : 'check'} size={16} color={COLORS.white}/>
              </View>
            )}
          </TouchableOpacity>

          {step === 1 && (
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:             { flex: 1, backgroundColor: COLORS.dark },
  container:        { flexGrow: 1, padding: SPACING.md, paddingTop: SPACING.lg },
  header:           { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: SPACING.lg },
  backBtn:          { width:36, height:36, alignItems:'center', justifyContent:'center' },
  headerTitle:      { fontSize:16, fontWeight:'700', color: COLORS.white },
  steps:            { flexDirection:'row', justifyContent:'center', gap:32, marginBottom: SPACING.lg },
  stepItem:         { alignItems:'center', gap:6 },
  stepDot:          { width:32, height:32, borderRadius:16, backgroundColor: COLORS.darkMid, borderWidth:1.5, borderColor: COLORS.gray, alignItems:'center', justifyContent:'center' },
  stepDotDone:      { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDotCurrent:   { borderColor: COLORS.primaryLight },
  stepLabel:        { fontSize:10, color: COLORS.grayLight },
  stepLabelActive:  { color: COLORS.primaryLight, fontWeight:'600' },
  card:             { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.lg },
  stepTitle:        { fontSize:18, fontWeight:'700', color: COLORS.dark, marginBottom: SPACING.md },
  fieldWrap:        { marginBottom: SPACING.md },
  label:            { fontSize:12, fontWeight:'600', color: COLORS.dark, marginBottom:6 },
  inputRow:         { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg },
  inputIcon:        { paddingHorizontal:12 },
  input:            { fontSize:14, color: COLORS.dark, padding:12 },
  inputFlex:        { flex:1, paddingLeft:0 },
  eyeBtn:           { padding:12 },
  genderRow:        { flexDirection:'row', gap:8 },
  genderBtn:        { flex:1, padding:10, borderRadius: RADIUS.sm, borderWidth:1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.grayBg, alignItems:'center' },
  genderBtnActive:  { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  genderBtnText:    { fontSize:12, fontWeight:'600', color: COLORS.textSecondary },
  genderBtnTextActive: { color: COLORS.primary },
  btn:              { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding:14, alignItems:'center', marginTop: SPACING.sm },
  btnInner:         { flexDirection:'row', alignItems:'center', gap:8 },
  btnText:          { color: COLORS.white, fontWeight:'700', fontSize:14 },
  loginRow:         { flexDirection:'row', justifyContent:'center', marginTop: SPACING.md },
  loginText:        { fontSize:13, color: COLORS.textSecondary },
  loginLink:        { fontSize:13, color: COLORS.primary, fontWeight:'600' },
});
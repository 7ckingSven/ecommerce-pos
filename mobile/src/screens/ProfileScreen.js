import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Platform, StatusBar,
  RefreshControl,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomer, logout, isLoggedIn } from '../services/authService';
import api from '../services/api';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import PSGCAddressPicker, { psgcToAddressString, addressStringToParts } from '../components/PSGCAddressPicker';
import SkeletonLoader from '../components/SkeletonLoader';
import NetworkBanner from '../components/NetworkBanner';

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={15} color={COLORS.primary}/>
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function formatDob(dob) {
  if (!dob) return null;
  const date = new Date(dob);
  if (isNaN(date)) return dob;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatGender(gender) {
  if (!gender) return null;
  const map = { male:'Male', female:'Female', prefer_not_to_say:'Prefer not to say' };
  return map[gender] || gender.replace(/_/g, ' ');
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [customer,     setCustomer]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState(false);
  const [loggedIn,     setLoggedIn]     = useState(false);
  const [saving,       setSaving]       = useState(false);

  // ─── Edit Modal State ─────────────────────────────────
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editType,       setEditType]       = useState(''); // 'personal' | 'contact' | 'password'
  const [psgcAddress,    setPsgcAddress]    = useState({});
  const [editForm,       setEditForm]       = useState({});
  const [showOldPass,    setShowOldPass]    = useState(false);
  const [showNewPass,    setShowNewPass]    = useState(false);
  const [showConfirmPass,setShowConfirmPass]= useState(false);
  const [legalModal,     setLegalModal]     = useState(null);
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  // Load once whenever the Profile screen gains focus — no background
  // polling (matches the web dashboards: data loads on view, refresh is
  // on-demand). Was previously a plain useEffect([]), so edits made
  // elsewhere (e.g. during registration) wouldn't show here until the app
  // was restarted.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  // Tapping the "Profile" tab while already on it refreshes the profile in
  // place — the mobile equivalent of the web dashboard's manual ↻
  // refresh-section button. Profile is a direct Tab.Screen (not nested in a
  // Stack), so its own navigation prop already belongs to the tab
  // navigator — no getParent() needed.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        loadProfile();
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Pull-to-refresh — separate from the initial `loading` spinner so the
  // RefreshControl actually shows while a manual pull is in flight.
  async function onPullToRefresh() {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }

  async function loadProfile() {
    try {
      setError(false);
      const logged = await isLoggedIn();
      setLoggedIn(logged);
      if (!logged) { setLoading(false); return; }

      const stored = await getCustomer();
      if (!stored?.customer_id) { setLoading(false); return; }

      // Load from AsyncStorage first (instant)
      setCustomer(stored);

      // Then fetch fresh from API
      try {
        const res = await api.get('/customer/profile', {
          headers: { 'X-Customer-ID': stored.customer_id },
        });
        setCustomer(res.data);
      } catch (_) {
        // Keep showing the cached AsyncStorage copy silently — only surface
        // a connection error if there's nothing cached to fall back to.
        if (!stored) setError(true);
      }

    } catch (e) {
      console.error('Profile load error:', e?.message || e);
      try {
        const stored = await getCustomer();
        if (stored) setCustomer(stored);
        else setError(true);
      } catch (_) {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── Open Edit Modal ──────────────────────────────────
  function openEdit(type) {
    setEditType(type);
    if (type === 'personal') {
      setEditForm({
        fname:  customer?.fname  || '',
        mi:     customer?.mi     || '',
        lname:  customer?.lname  || '',
        dob:    customer?.dob    || '',
        gender: customer?.gender || '',
      });
    } else if (type === 'contact') {
      // Only pre-fill street, zip_code, notes (PSGC dropdowns need codes)
      const parts = addressStringToParts(customer?.address || '');
      setEditForm({
        email:        customer?.email        || '',
        phone_number: customer?.phone_number || '',
        username:     customer?.username     || '',
        street:       parts.street           || '',
        barangay:     '',
        city:         '',
        province:     '',
        region:       '',
        zip_code:     parts.zip_code         || '',
        address_note: customer?.address_note || '',
      });
    } else if (type === 'password') {
      setEditForm({ old_password: '', new_password: '', confirm_password: '' });
    }
    setShowEditModal(true);
  }

  function closeEdit() {
    setShowEditModal(false);
    setEditForm({});
    setEditType('');
    setShowOldPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
  }

  function updateField(key, val) {
    setEditForm(prev => ({ ...prev, [key]: val }));
  }

  // ─── Save Changes ─────────────────────────────────────
  async function handleSave() {
    const stored = await getCustomer();
    if (!stored?.customer_id) return;

    // ── Personal Info Validation ──────────────────────────
    if (editType === 'personal') {
      if (!editForm.fname?.trim()) {
        showAlert({ type: 'warning', title: 'Required', message: 'First name is required.' }); return;
      }
      if (!editForm.lname?.trim()) {
        showAlert({ type: 'warning', title: 'Required', message: 'Last name is required.' }); return;
      }
      const nameRegex = /^[A-Za-zÑñ\s-]+$/;
      if (!nameRegex.test(editForm.fname.trim())) {
        showAlert({ type: 'warning', title: 'Invalid First Name', message: 'First name can only contain letters, spaces, and hyphens.' }); return;
      }
      if (!nameRegex.test(editForm.lname.trim())) {
        showAlert({ type: 'warning', title: 'Invalid Last Name', message: 'Last name can only contain letters, spaces, and hyphens.' }); return;
      }
      if (editForm.mi?.trim() && !nameRegex.test(editForm.mi.trim())) {
        showAlert({ type: 'warning', title: 'Invalid Middle Initial', message: 'Middle initial can only contain letters.' }); return;
      }
      if (editForm.dob?.trim()) {
        const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dobRegex.test(editForm.dob.trim())) {
          showAlert({ type: 'warning', title: 'Invalid Date', message: 'Date of birth must be in YYYY-MM-DD format (e.g. 2000-01-25).' }); return;
        }
        const d = new Date(editForm.dob.trim());
        if (isNaN(d.getTime())) {
          showAlert({ type: 'warning', title: 'Invalid Date', message: 'Please enter a valid date of birth.' }); return;
        }
        if (d > new Date()) {
          showAlert({ type: 'warning', title: 'Invalid Date', message: 'Date of birth cannot be in the future.' }); return;
        }
      }
    }

    // ── Contact Info Validation ───────────────────────────
    if (editType === 'contact') {
      if (!editForm.username?.trim()) {
        showAlert({ type: 'warning', title: 'Required', message: 'Username is required.' }); return;
      }
      if (/\s/.test(editForm.username.trim())) {
        showAlert({ type: 'warning', title: 'Invalid Username', message: 'Username cannot contain spaces.' }); return;
      }
      if (!editForm.email?.trim()) {
        showAlert({ type: 'warning', title: 'Required', message: 'Email address is required.' }); return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editForm.email.trim())) {
        showAlert({ type: 'warning', title: 'Invalid Email', message: 'Please enter a valid email address.' }); return;
      }
      if (!editForm.phone_number?.trim()) {
        showAlert({ type: 'warning', title: 'Required', message: 'Phone number is required.' }); return;
      }
      const phoneClean = editForm.phone_number.trim().replace(/\D/g, '');
      if (phoneClean.length !== 11 || !phoneClean.startsWith('09')) {
        showAlert({ type: 'warning', title: 'Invalid Phone', message: 'Phone number must be 11 digits and start with 09.' }); return;
      }
    }

    // ── Password Validation ───────────────────────────────
    if (editType === 'password') {
      if (!editForm.old_password || !editForm.new_password || !editForm.confirm_password) {
        showAlert({ type: 'warning', title: 'Required', message: 'Please fill in all password fields.' }); return;
      }
      if (editForm.new_password.length < 8) {
        showAlert({ type: 'warning', title: 'Too Short', message: 'New password must be at least 8 characters.' }); return;
      }
      if (editForm.new_password !== editForm.confirm_password) {
        showAlert({ type: 'warning', title: 'Mismatch', message: 'New passwords do not match.' }); return;
      }
    }

    setSaving(true);
    try {
      let endpoint = '';
      let payload  = {};

      if (editType === 'personal') {
        endpoint = '/customer/profile';
        payload  = {
          fname:  editForm.fname.trim(),
          mi:     editForm.mi.trim(),
          lname:  editForm.lname.trim(),
          dob:    editForm.dob || null,
          gender: editForm.gender || null,
        };
      } else if (editType === 'contact') {
        endpoint = '/customer/profile';
        const addressParts = [
          editForm.street?.trim(),
          editForm.barangay?.trim(),
          editForm.city?.trim(),
          editForm.province?.trim(),
          editForm.region?.trim(),
          editForm.zip_code?.trim(),
        ].filter(Boolean);
        payload  = {
          email:        editForm.email.trim(),
          phone_number: editForm.phone_number.trim(),
          address:      addressParts.join(', '),
          address_note: editForm.address_note?.trim() || '',
          username:     editForm.username.trim(),
        };
      } else if (editType === 'password') {
        endpoint = '/customer/change-password';
        payload  = {
          old_password: editForm.old_password,
          new_password: editForm.new_password,
        };
      }

      await api.put(endpoint, payload, {
        headers: { 'X-Customer-ID': stored.customer_id },
      });

      showAlert({ type: 'success', title: 'Success', message: editType === 'password' ? 'Password changed successfully!' : 'Profile updated successfully!' });
      closeEdit();
      loadProfile(); // refresh

    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to save. Please try again.';
      showAlert({ type: 'error', title: 'Error', message: msg });
    } finally {
      setSaving(false);
    }
  }

  // ─── Logout ───────────────────────────────────────────
  async function handleLogout() {
    showAlert({
      type:    'confirm',
      title:   'Log Out',
      message: 'Are you sure you want to log out?',
      buttons: [
        { text: 'Cancel' },
        { text: 'Log Out', style: 'danger', onPress: async () => {
          await logout();
          navigation.replace('Login');
        }},
      ]
    });
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: COLORS.grayBg }}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>
      <SkeletonLoader type="profile" />
    </View>
  );

  if (error) return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>
      <View style={styles.emptyWrap}>
        <Feather name="wifi-off" size={48} color={COLORS.grayLight}/>
        <Text style={styles.emptyTitle}>Connection Error</Text>
        <Text style={styles.emptyText}>Could not load your profile. Please check your internet connection.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => { setError(false); setLoading(true); loadProfile(); }}>
          <Text style={styles.loginBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Not Logged In ───────────────────────────────────
  const initials = customer
    ? ((customer.fname?.[0] || '') + (customer.lname?.[0] || '')).toUpperCase()
    : '?';

  if (!loggedIn) return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>
      <View style={styles.emptyWrap}>
        <Feather name="user" size={48} color={COLORS.textMuted}/>
        <Text style={styles.emptyTitle}>Not Logged In</Text>
        <Text style={styles.emptyText}>Please log in to view your profile.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginBtnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loggedIn) return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>
      <NetworkBanner />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: SPACING.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary}/>
        }
      >

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.fullName}>
            {customer?.fname}{customer?.mi ? ' '+customer.mi.trim()+' ' : ' '}{customer?.lname}
          </Text>
          <Text style={styles.email}>{customer?.email}</Text>
        </View>

        {/* Personal Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit('personal')}>
              <Feather name="edit-2" size={13} color={COLORS.primary}/>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <InfoRow icon="user"     label="First Name"     value={customer?.fname}/>
          <InfoRow icon="user"     label="Middle Initial" value={customer?.mi?.trim()||null}/>
          <InfoRow icon="user"     label="Last Name"      value={customer?.lname}/>
          <InfoRow icon="calendar" label="Date of Birth"  value={formatDob(customer?.dob)}/>
          <InfoRow icon="users"    label="Gender"         value={formatGender(customer?.gender)}/>
        </View>

        {/* Contact Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Contact Information</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit('contact')}>
              <Feather name="edit-2" size={13} color={COLORS.primary}/>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <InfoRow icon="at-sign" label="Username"     value={customer?.username}/>
          <InfoRow icon="mail"    label="Email"        value={customer?.email}/>
          <InfoRow icon="phone"   label="Phone Number" value={customer?.phone_number}/>
          <InfoRow icon="map-pin" label="Address"      value={customer?.address}/>
        {customer?.address_note ? (
          <InfoRow icon="navigation" label="Landmark/Notes" value={customer?.address_note}/>
        ) : null}
        </View>

        {/* Security */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          <TouchableOpacity style={styles.actionRow} onPress={() => openEdit('password')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor:'#fef3c7' }]}>
                <Feather name="lock" size={18} color="#d97706"/>
              </View>
              <View>
                <Text style={styles.actionLabel}>Change Password</Text>
                <Text style={styles.actionSub}>Update your account password</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={COLORS.textMuted}/>
          </TouchableOpacity>
        </View>



        {/* Legal */}
        <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 16, overflow:'hidden' }}>
          <Text style={{ fontSize:11, fontWeight:'700', color: COLORS.textMuted, textTransform:'uppercase', letterSpacing:1, padding:12, paddingBottom:4 }}>Legal</Text>
          {[
            { label:'Privacy Policy',      icon:'shield',    type:'privacy' },
            { label:'Terms & Conditions',  icon:'file-text', type:'terms'   },
          ].map((item, i) => (
            <TouchableOpacity
              key={item.type}
              onPress={() => setLegalModal(item.type)}
              style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: COLORS.grayBorder }}
            >
              <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                <Feather name={item.icon} size={16} color={COLORS.primary}/>
                <Text style={{ fontSize:14, color: COLORS.dark, fontWeight:'500' }}>{item.label}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={COLORS.textMuted}/>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={18} color="#ef4444"/>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Legal Modal */}
        {legalModal && (
          <View style={{ position:'absolute', inset:0, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:16, zIndex:999 }}>
            <View style={{ backgroundColor: COLORS.white, borderRadius:16, width:'100%', maxHeight:'80%', overflow:'hidden' }}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder }}>
                <Text style={{ fontSize:16, fontWeight:'700', color: COLORS.dark }}>
                  {legalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
                </Text>
                <TouchableOpacity onPress={() => setLegalModal(null)}>
                  <Feather name="x" size={20} color={COLORS.textMuted}/>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding:16 }}>
                {legalModal === 'terms' ? (
                  <>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>1. Acceptance of Terms</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:12 }}>By using TEFC E-Commerce, you agree to be bound by these Terms and Conditions.</Text>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>2. Account Registration</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:12 }}>You must provide accurate information when creating an account and are responsible for your credentials.</Text>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>3. Orders and Payments</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:12 }}>All orders are subject to availability. We accept Cash and GCash payments.</Text>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>4. Cancellation Policy</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:24 }}>Orders may be cancelled while in Pending status only.</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>1. Information We Collect</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:12 }}>We collect your name, email, phone number, and delivery address when you register or place an order.</Text>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>2. How We Use Your Information</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:12 }}>Your information is used to process orders, manage your account, and send OTP codes.</Text>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>3. Data Security</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:12 }}>Passwords are securely hashed. We take reasonable measures to protect your data.</Text>
                    <Text style={{ fontWeight:'700', color: COLORS.primary, marginBottom:6 }}>4. Contact Us</Text>
                    <Text style={{ fontSize:13, color: COLORS.textSecondary, lineHeight:20, marginBottom:24 }}>Contact us at tripleefielcollince@gmail.com for privacy concerns.</Text>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Extra bottom spacer so the last section can scroll clear of the
            now-floating (position:'absolute') tab bar in AppNavigator. */}
        <View style={{ height: SPACING.xl + 60 + insets.bottom }}/>
      </ScrollView>

      {/* ─── EDIT MODAL ─── */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editType === 'personal'  ? 'Edit Personal Info'  :
                 editType === 'contact'   ? 'Edit Contact Info'   :
                 editType === 'password'  ? 'Change Password'     : 'Edit'}
              </Text>
              <TouchableOpacity onPress={closeEdit}>
                <Feather name="x" size={20} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Personal Info Fields */}
              {editType === 'personal' && (
                <View style={styles.modalBody}>
                  {[
                    { key:'fname',  label:'First Name *',   placeholder:'Juan',       isName:true },
                    { key:'mi',     label:'Middle Initial',  placeholder:'S.',         isName:true },
                    { key:'lname',  label:'Last Name *',     placeholder:'Dela Cruz',  isName:true },
                    { key:'dob',    label:'Date of Birth',   placeholder:'YYYY-MM-DD' },
                  ].map(f => (
                    <View key={f.key} style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={editForm[f.key]}
                        onChangeText={v => updateField(f.key, f.isName ? v.replace(/[^A-Za-zÑñ\s-]/g, '') : v)}
                        placeholder={f.placeholder}
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                  ))}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Gender</Text>
                    <View style={styles.genderRow}>
                      {['male','female','prefer_not_to_say'].map(g => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.genderBtn, editForm.gender===g && styles.genderBtnActive]}
                          onPress={() => updateField('gender', g)}
                        >
                          <Text style={[styles.genderBtnText, editForm.gender===g && styles.genderBtnTextActive]}>
                            {g==='male'?'Male':g==='female'?'Female':'Prefer not'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Contact Info Fields */}
              {editType === 'contact' && (
                <View style={styles.modalBody}>
                  {[
                    { key:'username',     label:'Username *',     placeholder:'your_username',    keyboard:'default' },
                    { key:'email',        label:'Email *',        placeholder:'you@email.com',    keyboard:'email-address' },
                    { key:'phone_number', label:'Phone Number *', placeholder:'09XXXXXXXXX',      keyboard:'phone-pad', max:11 },
                  ].map(f => (
                    <View key={f.key} style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={editForm[f.key]}
                        onChangeText={v => updateField(f.key, v)}
                        placeholder={f.placeholder}
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType={f.keyboard || 'default'}
                        autoCapitalize="none"
                        maxLength={f.max}
                      />
                    </View>
                  ))}

                  {/* Address — PSGC Dropdowns */}
                  <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Address</Text>
                  <PSGCAddressPicker
                    value={{
                      street:   editForm.street   || '',
                      zip_code: editForm.zip_code || '',
                    }}
                    onChange={addr => {
                      setPsgcAddress(addr);
                      updateField('street',   addr.street       || '');
                      updateField('barangay', addr.barangayName || '');
                      updateField('city',     addr.cityName     || '');
                      updateField('province', addr.provinceName || '');
                      updateField('region',   addr.regionName   || '');
                      updateField('zip_code', addr.zip_code     || '');
                    }}
                  />
                  {/* Landmark / Notes */}
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                    Landmark / Notes <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(Optional)</Text>
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Near Jollibee, Blue Gate House"
                    placeholderTextColor={COLORS.textMuted}
                    value={editForm.address_note || ''}
                    onChangeText={v => updateField('address_note', v)}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}

              {/* Password Fields */}
              {editType === 'password' && (
                <View style={styles.modalBody}>
                  {[
                    { key:'old_password',     label:'Current Password', show:showOldPass,     setShow:setShowOldPass },
                    { key:'new_password',     label:'New Password',     show:showNewPass,     setShow:setShowNewPass },
                    { key:'confirm_password', label:'Confirm Password', show:showConfirmPass, setShow:setShowConfirmPass },
                  ].map(f => (
                    <View key={f.key} style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <View style={styles.passRow}>
                        <TextInput
                          style={[styles.fieldInput, { flex:1, marginBottom:0 }]}
                          value={editForm[f.key]}
                          onChangeText={v => updateField(f.key, v)}
                          placeholder="••••••••"
                          placeholderTextColor={COLORS.textMuted}
                          secureTextEntry={!f.show}
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => f.setShow(!f.show)}>
                          <Feather name={f.show?'eye':'eye-off'} size={16} color={COLORS.textMuted}/>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <Text style={styles.passHint}>Password must be at least 8 characters.</Text>
                </View>
              )}

              {/* Save Button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeEdit}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color={COLORS.white} size="small"/>
                    : <Text style={styles.saveBtnText}>Save Changes</Text>
                  }
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomAlert config={alertConfig} onHide={hideAlert}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex:1, backgroundColor: COLORS.grayBg },
  // Header — COLORS.primary so it matches the bottom nav's active-tab
  // green (and HomeScreen's header) instead of drifting to its own shade.
  header:             { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md, shadowColor: '#14532d', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerTitle:        { fontSize:18, fontWeight:'700', color: COLORS.white },
  content:            { padding: SPACING.md, gap: SPACING.md },

  // Avatar
  avatarSection:      { alignItems:'center', paddingVertical: SPACING.lg },
  avatar:             { width:80, height:80, borderRadius:40, backgroundColor: COLORS.primary, alignItems:'center', justifyContent:'center', marginBottom: SPACING.sm, ...SHADOW.md },
  avatarText:         { fontSize:28, fontWeight:'700', color: COLORS.white },
  fullName:           { fontSize:20, fontWeight:'700', color: COLORS.dark },
  email:              { fontSize:13, color: COLORS.textMuted, marginTop:4 },

  // Card
  card:               { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm, gap: SPACING.sm },
  cardHeader:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: SPACING.sm },
  cardTitle:          { fontSize:14, fontWeight:'700', color: COLORS.dark },
  editBtn:            { flexDirection:'row', alignItems:'center', gap:4, backgroundColor: COLORS.primaryBg, paddingHorizontal:10, paddingVertical:5, borderRadius: RADIUS.full, borderWidth:1, borderColor: COLORS.primaryBorder },
  editBtnText:        { fontSize:12, fontWeight:'600', color: COLORS.primary },

  // InfoRow
  infoRow:            { flexDirection:'row', alignItems:'center', gap: SPACING.sm, paddingVertical:6, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  infoIcon:           { width:32, height:32, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryBg, alignItems:'center', justifyContent:'center' },
  infoContent:        { flex:1 },
  infoLabel:          { fontSize:11, color: COLORS.textMuted, fontWeight:'500' },
  infoValue:          { fontSize:13, color: COLORS.dark, fontWeight:'500', marginTop:2 },

  // Action Rows
  actionRow:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  actionLeft:         { flexDirection:'row', alignItems:'center', gap: SPACING.sm },
  actionIcon:         { width:36, height:36, borderRadius: RADIUS.sm, alignItems:'center', justifyContent:'center' },
  actionLabel:        { fontSize:14, fontWeight:'500', color: COLORS.dark },
  actionSub:          { fontSize:11, color: COLORS.textMuted, marginTop:1 },

  // Logout
  logoutBtn:          { flexDirection:'row', alignItems:'center', justifyContent:'center', gap: SPACING.sm, backgroundColor:'#fef2f2', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth:1, borderColor:'#fecaca' },
  logoutText:         { fontSize:14, fontWeight:'700', color:'#ef4444' },

  // Empty / Auth
  emptyWrap:          { flex:1, alignItems:'center', justifyContent:'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle:         { fontSize:18, fontWeight:'700', color: COLORS.dark },
  emptyText:          { fontSize:13, color: COLORS.textSecondary, textAlign:'center' },
  loginBtn:           { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical:12, marginTop: SPACING.sm },
  loginBtnText:       { color: COLORS.white, fontWeight:'700', fontSize:14 },
  registerLink:       { fontSize:13, color: COLORS.primary, fontWeight:'600', marginTop: SPACING.sm },

  // Modal
  modalOverlay:       { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalSheet:         { backgroundColor: COLORS.white, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'90%', paddingBottom: SPACING.xl },
  modalHeader:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding: SPACING.md, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  modalTitle:         { fontSize:16, fontWeight:'700', color: COLORS.dark },
  modalBody:          { padding: SPACING.md, gap: SPACING.sm },
  modalFooter:        { flexDirection:'row', gap: SPACING.sm, padding: SPACING.md, paddingTop:0 },

  // Fields
  fieldWrap:          { marginBottom: SPACING.sm },
  fieldLabel:         { fontSize:12, fontWeight:'600', color: COLORS.dark, marginBottom:5 },
  fieldInput:         { borderWidth:1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, padding:10, fontSize:14, color: COLORS.dark, backgroundColor: COLORS.grayBg, marginBottom: SPACING.sm },
  fieldInputMulti:    { minHeight:70, textAlignVertical:'top' },

  // Gender
  genderRow:          { flexDirection:'row', gap:8 },
  genderBtn:          { flex:1, padding:8, borderRadius: RADIUS.sm, borderWidth:1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.grayBg, alignItems:'center' },
  genderBtnActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  genderBtnText:      { fontSize:12, fontWeight:'600', color: COLORS.textSecondary },
  genderBtnTextActive:{ color: COLORS.primary },

  // Password
  passRow:            { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg, marginBottom: SPACING.sm },
  eyeBtn:             { padding:10 },
  passHint:           { fontSize:11, color: COLORS.textMuted, marginTop:4 },

  // Save/Cancel
  cancelBtn:          { flex:1, padding:12, borderRadius: RADIUS.sm, borderWidth:1.5, borderColor: COLORS.grayBorder, alignItems:'center' },
  cancelBtnText:      { fontSize:14, fontWeight:'600', color: COLORS.textMuted },
  saveBtn:            { flex:2, padding:12, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary, alignItems:'center' },
  saveBtnDisabled:    { backgroundColor: COLORS.grayLight },
  saveBtnText:        { fontSize:14, fontWeight:'700', color: COLORS.white },
});
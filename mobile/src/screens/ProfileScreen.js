import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getCustomer, logout, isLoggedIn } from '../services/authService';
import api from '../services/api';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import PSGCAddressPicker, { psgcToAddressString, addressStringToParts } from '../components/PSGCAddressPicker';

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
  const [customer,     setCustomer]     = useState(null);
  const [loading,      setLoading]      = useState(true);
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

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
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
      } catch (_) {}

    } catch (e) {
      console.error('Profile load error:', e?.message || e);
      try {
        const stored = await getCustomer();
        if (stored) setCustomer(stored);
      } catch (_) {}
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
      // Parse existing address into separate fields
      const addr   = customer?.address || '';
      const parts  = addr.split(', ');
      setEditForm({
        email:        customer?.email        || '',
        phone_number: customer?.phone_number || '',
        username:     customer?.username     || '',
        street:       parts[0] || '',
        barangay:     parts[1] || '',
        city:         parts[2] || '',
        province:     parts[3] || '',
        region:       parts[4] || '',
        zip_code:     parts[5] || '',
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

    if (editType === 'password') {
      if (!editForm.old_password || !editForm.new_password || !editForm.confirm_password) {
        Alert.alert('Required', 'Please fill in all password fields.'); return;
      }
      if (editForm.new_password.length < 8) {
        Alert.alert('Error', 'New password must be at least 8 characters.'); return;
      }
      if (editForm.new_password !== editForm.confirm_password) {
        Alert.alert('Error', 'New passwords do not match.'); return;
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

      Alert.alert('Success', editType === 'password' ? 'Password changed successfully!' : 'Profile updated successfully!');
      closeEdit();
      loadProfile(); // refresh

    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to save. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  // ─── Logout ───────────────────────────────────────────
  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        await logout();
        navigation.replace('Login');
      }}
    ]);
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent:'center', alignItems:'center' }]}>
      <ActivityIndicator color={COLORS.primary} size="large"/>
    </View>
  );

  if (!loggedIn) return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>My Profile</Text></View>
      <View style={styles.emptyWrap}>
        <Feather name="user" size={56} color={COLORS.grayLight}/>
        <Text style={styles.emptyTitle}>Not logged in</Text>
        <Text style={styles.emptyText}>Log in to view and manage your profile.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginBtnText}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.registerLink}>Create an Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const initials = customer
    ? `${customer.fname?.[0]||''}${customer.lname?.[0]||''}`.toUpperCase()
    : 'C';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

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

        {/* Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Orders')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.primaryBg }]}>
                <Feather name="package" size={18} color={COLORS.primary}/>
              </View>
              <Text style={styles.actionLabel}>My Orders</Text>
            </View>
            <Feather name="chevron-right" size={18} color={COLORS.textMuted}/>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Cart')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor:'#eff6ff' }]}>
                <Feather name="shopping-cart" size={18} color="#3b82f6"/>
              </View>
              <Text style={styles.actionLabel}>My Cart</Text>
            </View>
            <Feather name="chevron-right" size={18} color={COLORS.textMuted}/>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={18} color="#ef4444"/>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl }}/>
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
                    { key:'fname',  label:'First Name *',   placeholder:'Juan' },
                    { key:'mi',     label:'Middle Initial',  placeholder:'S.' },
                    { key:'lname',  label:'Last Name *',     placeholder:'Dela Cruz' },
                    { key:'dob',    label:'Date of Birth',   placeholder:'YYYY-MM-DD' },
                  ].map(f => (
                    <View key={f.key} style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={editForm[f.key]}
                        onChangeText={v => updateField(f.key, v)}
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
                      street:       editForm.street    || '',
                      barangayName: editForm.barangay  || '',
                      cityName:     editForm.city      || '',
                      provinceName: editForm.province  || '',
                      regionName:   editForm.region    || '',
                      zip_code:     editForm.zip_code  || '',
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

    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex:1, backgroundColor: COLORS.grayBg },
  header:             { backgroundColor: COLORS.dark, paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
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
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getCustomer, logout, isLoggedIn } from '../services/authService';
import api from '../services/api';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

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

// Format YYYY-MM-DD → readable date
function formatDob(dob) {
  if (!dob) return null;
  const date = new Date(dob);
  if (isNaN(date)) return dob;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// Format gender enum → readable string
function formatGender(gender) {
  if (!gender) return null;
  const map = {
    male:              'Male',
    female:            'Female',
    prefer_not_to_say: 'Prefer not to say',
  };
  return map[gender] || gender.replace(/_/g, ' ');
}

export default function ProfileScreen({ navigation }) {
  const [customer, setCustomer] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const logged = await isLoggedIn();
      setLoggedIn(logged);

      if (!logged) { setLoading(false); return; }

      // Get basic customer info from AsyncStorage
      const stored = await getCustomer();
      if (!stored?.customer_id) { setLoading(false); return; }

      // Fetch FULL profile from API (includes dob, address, gender)
      const res = await api.get('/customer/profile', {
        headers: { 'X-Customer-ID': stored.customer_id },
      });
      setCustomer(res.data);
    } catch (e) {
      console.error('Profile load error:', e);
      // Fallback to stored data if API fails
      const stored = await getCustomer();
      if (stored) setCustomer(stored);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('Login');
        }
      }
    ]);
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent:'center', alignItems:'center' }]}>
      <ActivityIndicator color={COLORS.primary} size="large"/>
    </View>
  );

  if (!loggedIn) {
    return (
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
  }

  const initials = customer
    ? `${customer.fname?.[0] || ''}${customer.lname?.[0] || ''}`.toUpperCase()
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
            {customer?.fname}{customer?.mi ? ' ' + customer.mi.trim() + ' ' : ' '}{customer?.lname}
          </Text>
          <Text style={styles.email}>{customer?.email}</Text>
        </View>

        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <InfoRow icon="user"     label="First Name"     value={customer?.fname}/>
          <InfoRow icon="user"     label="Middle Initial" value={customer?.mi?.trim() || null}/>
          <InfoRow icon="user"     label="Last Name"      value={customer?.lname}/>
          <InfoRow icon="calendar" label="Date of Birth"  value={formatDob(customer?.dob)}/>
          <InfoRow icon="users"    label="Gender"         value={formatGender(customer?.gender)}/>
        </View>

        {/* Contact Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          <InfoRow icon="mail"    label="Email"        value={customer?.email}/>
          <InfoRow icon="phone"   label="Phone Number" value={customer?.phone_number}/>
          <InfoRow icon="map-pin" label="Address"      value={customer?.address}/>
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
              <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex:1, backgroundColor: COLORS.grayBg },
  header:        { backgroundColor: COLORS.dark, paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  headerTitle:   { fontSize:18, fontWeight:'700', color: COLORS.white },
  content:       { padding: SPACING.md, gap: SPACING.md },
  avatarSection: { alignItems:'center', paddingVertical: SPACING.lg },
  avatar:        { width:80, height:80, borderRadius:40, backgroundColor: COLORS.primary, alignItems:'center', justifyContent:'center', marginBottom: SPACING.sm, ...SHADOW.md },
  avatarText:    { fontSize:28, fontWeight:'700', color: COLORS.white },
  fullName:      { fontSize:20, fontWeight:'700', color: COLORS.dark },
  email:         { fontSize:13, color: COLORS.textMuted, marginTop:4 },
  card:          { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm, gap: SPACING.sm },
  cardTitle:     { fontSize:14, fontWeight:'700', color: COLORS.dark, marginBottom: SPACING.sm },
  infoRow:       { flexDirection:'row', alignItems:'center', gap: SPACING.sm, paddingVertical:6, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  infoIcon:      { width:32, height:32, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryBg, alignItems:'center', justifyContent:'center' },
  infoContent:   { flex:1 },
  infoLabel:     { fontSize:11, color: COLORS.textMuted, fontWeight:'500' },
  infoValue:     { fontSize:13, color: COLORS.dark, fontWeight:'500', marginTop:2 },
  actionRow:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  actionLeft:    { flexDirection:'row', alignItems:'center', gap: SPACING.sm },
  actionIcon:    { width:36, height:36, borderRadius: RADIUS.sm, alignItems:'center', justifyContent:'center' },
  actionLabel:   { fontSize:14, fontWeight:'500', color: COLORS.dark },
  logoutBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap: SPACING.sm, backgroundColor:'#fef2f2', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth:1, borderColor:'#fecaca' },
  logoutText:    { fontSize:14, fontWeight:'700', color:'#ef4444' },
  emptyWrap:     { flex:1, alignItems:'center', justifyContent:'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle:    { fontSize:18, fontWeight:'700', color: COLORS.dark },
  emptyText:     { fontSize:13, color: COLORS.textSecondary, textAlign:'center' },
  loginBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical:12, marginTop: SPACING.sm },
  loginBtnText:  { color: COLORS.white, fontWeight:'700', fontSize:14 },
  registerLink:  { fontSize:13, color: COLORS.primary, fontWeight:'600', marginTop: SPACING.sm },
});
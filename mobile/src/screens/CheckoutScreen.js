import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { placeOrder, getProfile, updateProfile } from '../services/orderService';
import { getCustomerId, getCustomer } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

const PAYMENT_METHODS = [
  { id: 'cash_on_delivery', label: 'Cash on Delivery', icon: 'truck',      sub: 'Pay when your order arrives' },
  { id: 'gcash',            label: 'GCash',            icon: 'smartphone', sub: 'Enter reference number after payment' },
];

export default function CheckoutScreen({ route, navigation }) {
  const { cartItems, total } = route.params;

  const [payment,       setPayment]       = useState('cash_on_delivery');
  const [refNo,         setRefNo]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [profileLoading,setProfileLoading]= useState(true);
  const [address,       setAddress]       = useState('');
  const [customerName,  setCustomerName]  = useState('');
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [editAddress,   setEditAddress]   = useState('');
  const [savingAddr,    setSavingAddr]    = useState(false);

  useEffect(() => {
    async function init() {
      const id = await getCustomerId();
      console.log('CheckoutScreen — Customer ID:', id);
      if (!id) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => navigation.replace('Login') }
        ]);
        return;
      }
      loadProfile();
    }
    init();
  }, []);

  async function loadProfile() {
    try {
      // Step 1 — Load instantly from AsyncStorage (cached on login)
      const cached = await getCustomer();
      if (cached && typeof cached === 'object') {
        setAddress(cached.address || '');
        setCustomerName(
          ((cached.fname || '') + ' ' + (cached.lname || '')).trim()
        );
        setProfileLoading(false);
      }

      // Step 2 — Fetch fresh from API in background to get latest address
      try {
        const fresh = await getProfile();
        if (fresh && typeof fresh === 'object') {
          setAddress(fresh.address || '');
          setCustomerName(
            ((fresh.fname || '') + ' ' + (fresh.lname || '')).trim()
          );
        }
      } catch (apiErr) {
        // API failed — keep cached data, no crash
        console.log('Using cached profile data');
      }
    } catch (e) {
      console.log('Profile load error:', e?.message || e);
    } finally {
      setProfileLoading(false);
    }
  }

  // ─── Open Address Edit Modal ──────────────────────────
  function openAddressModal() {
    setEditAddress(address);
    setShowAddrModal(true);
  }

  // ─── Save Address ─────────────────────────────────────
  async function saveAddress() {
    if (!editAddress.trim()) {
      Alert.alert('Required', 'Please enter your delivery address.');
      return;
    }
    setSavingAddr(true);
    try {
      await updateProfile({ address: editAddress.trim() });
      setAddress(editAddress.trim());
      setShowAddrModal(false);
      Alert.alert('Success', 'Address updated successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save address. Please try again.');
    } finally {
      setSavingAddr(false);
    }
  }

  // ─── Remove Address ───────────────────────────────────
  function removeAddress() {
    Alert.alert('Remove Address', 'Are you sure you want to remove your delivery address?', [
      { text: 'Cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await updateProfile({ address: '' });
            setAddress('');
          } catch (e) {
            Alert.alert('Error', 'Failed to remove address.');
          }
        }
      }
    ]);
  }

  // ─── Place Order ──────────────────────────────────────
  async function handlePlaceOrder() {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please add a delivery address before placing your order.', [
        { text: 'Add Address', onPress: openAddressModal },
        { text: 'Cancel' }
      ]);
      return;
    }

    if (payment === 'gcash' && !refNo.trim()) {
      Alert.alert('Required', 'Please enter the GCash reference number.');
      return;
    }

    Alert.alert(
      'Confirm Order',
      `Total: ₱${total.toFixed(2)}\nPayment: ${payment.replace(/_/g, ' ')}\nDeliver to: ${address}`,
      [
        { text: 'Cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const items = cartItems.map(i => {
                const disc       = Array.isArray(i.product?.discount) ? i.product.discount[0] : i.product?.discount;
                const origPrice  = Number(i.product?.price || 0);
                const finalPrice = disc ? origPrice * (1 - disc.percentage / 100) : origPrice;
                return {
                  product_id: i.product_id || i.product?.product_id,
                  cart_id:    (i.cart_id && i.cart_id !== 'buy_now') ? i.cart_id : null,
                  quantity:   i.quantity,
                  price:      finalPrice, // use discounted price if applicable
                };
              });
              const res = await placeOrder(items, payment, refNo.trim());
              Alert.alert(
                '🎉 Order Placed!',
                `Your order has been placed successfully!\nOrder ID: ${res.order_id?.slice(0, 8).toUpperCase()}\n\nThank you for shopping!`,
                [
                  {
                    text: 'View Orders',
                    onPress: () => navigation.reset({
                      index: 0,
                      routes: [{ name: 'Main', params: { screen: 'Orders' } }],
                    })
                  },
                  {
                    text: 'Continue Shopping',
                    onPress: () => navigation.reset({
                      index: 0,
                      routes: [{ name: 'Main', params: { screen: 'Home' } }],
                    })
                  },
                ]
              );
            } catch (e) {
              const msg = e.response?.data?.error || 'Failed to place order. Please try again.';
              Alert.alert('Error', msg);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={COLORS.white}/>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 22 }}/>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── Delivery Address ─── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Feather name="map-pin" size={16} color={COLORS.primary}/>
            <Text style={styles.cardTitle}>Delivery Address</Text>
          </View>

          {profileLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.md }}/>
          ) : address ? (
            <View style={styles.addressWrap}>
              <View style={styles.addressInfo}>
                <Text style={styles.addressName}>{customerName}</Text>
                <Text style={styles.addressText}>{address}</Text>
              </View>
              <View style={styles.addressActions}>
                <TouchableOpacity style={styles.addrActionBtn} onPress={openAddressModal}>
                  <Feather name="edit-2" size={14} color={COLORS.primary}/>
                  <Text style={styles.addrActionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addrActionBtn, styles.addrRemoveBtn]} onPress={removeAddress}>
                  <Feather name="trash-2" size={14} color="#ef4444"/>
                  <Text style={[styles.addrActionText, { color: '#ef4444' }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addAddressBtn} onPress={openAddressModal}>
              <Feather name="plus-circle" size={18} color={COLORS.primary}/>
              <Text style={styles.addAddressText}>Add Delivery Address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Order Summary ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          {cartItems.map((item, idx) => {
            const disc          = Array.isArray(item.product?.discount) ? item.product.discount[0] : item.product?.discount;
            const origPrice     = Number(item.product?.price || 0);
            const finalPrice    = disc ? origPrice * (1 - Number(disc.percentage) / 100) : origPrice;
            const origSubtotal  = origPrice * item.quantity;
            const finalSubtotal = finalPrice * item.quantity;
            return (
              <View key={idx} style={styles.orderItem}>
                <View style={styles.orderItemLeft}>
                  <Text style={styles.orderItemName} numberOfLines={1}>
                    {item.product?.product_name || '—'}
                  </Text>
                  <Text style={styles.orderItemQty}>x{item.quantity}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {disc ? (
                    <>
                      <Text style={styles.orderItemOriginal}>₱{origSubtotal.toFixed(2)}</Text>
                      <Text style={[styles.orderItemPrice, { color: '#ef4444' }]}>₱{finalSubtotal.toFixed(2)}</Text>
                    </>
                  ) : (
                    <Text style={styles.orderItemPrice}>₱{origSubtotal.toFixed(2)}</Text>
                  )}
                </View>
              </View>
            );
          })}
          <View style={styles.divider}/>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalVal}>₱{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* ─── Payment Method ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>
          {PAYMENT_METHODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.payMethod, payment === m.id && styles.payMethodActive]}
              onPress={() => setPayment(m.id)}
            >
              <View style={[styles.payIcon, payment === m.id && styles.payIconActive]}>
                <Feather name={m.icon} size={20} color={payment === m.id ? COLORS.white : COLORS.textMuted}/>
              </View>
              <View style={styles.payInfo}>
                <Text style={[styles.payLabel, payment === m.id && styles.payLabelActive]}>{m.label}</Text>
                <Text style={styles.paySub}>{m.sub}</Text>
              </View>
              <View style={[styles.payRadio, payment === m.id && styles.payRadioActive]}>
                {payment === m.id && <View style={styles.payRadioDot}/>}
              </View>
            </TouchableOpacity>
          ))}

          {payment === 'gcash' && (
            <View style={styles.refWrap}>
              {/* GCash number to send payment to */}
              <View style={styles.gcashNumberBox}>
                <Feather name="smartphone" size={20} color="#1d4ed8"/>
                <View style={{ flex:1 }}>
                  <Text style={styles.gcashNumberLabel}>Send payment to this GCash number:</Text>
                  <Text style={styles.gcashNumber}>09856446102</Text>
                  <Text style={styles.gcashName}>Triple E & Fiel Collins GM</Text>
                </View>
              </View>
              <Text style={styles.refLabel}>GCash Reference Number *</Text>
              <View style={styles.inputRow}>
                <Feather name="hash" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }}/>
                <TextInput
                  style={styles.refInput}
                  placeholder="Enter reference number"
                  placeholderTextColor={COLORS.textMuted}
                  value={refNo}
                  onChangeText={setRefNo}
                  keyboardType="number-pad"
                />
              </View>
              <Text style={styles.refHint}>Complete GCash payment first, then enter the reference number.</Text>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.xl }}/>
      </ScrollView>

      {/* ─── Footer ─── */}
      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalVal}>₱{total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.orderBtn}
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white}/>
          ) : (
            <View style={styles.orderBtnInner}>
              <Feather name="check-circle" size={18} color={COLORS.white}/>
              <Text style={styles.orderBtnText}>Place Order</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Address Modal ─── */}
      <Modal
        visible={showAddrModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddrModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {address ? 'Edit Address' : 'Add Address'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddrModal(false)}>
                <Feather name="x" size={20} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Delivery Address</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="House/Unit No., Street, Barangay, City, Province"
              placeholderTextColor={COLORS.textMuted}
              value={editAddress}
              onChangeText={setEditAddress}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddrModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={saveAddress}
                disabled={savingAddr}
              >
                {savingAddr
                  ? <ActivityIndicator color={COLORS.white} size="small"/>
                  : <Text style={styles.modalSaveText}>Save Address</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.grayBg },
  header:             { backgroundColor: COLORS.dark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  headerTitle:        { fontSize: 18, fontWeight: '700', color: COLORS.white },
  content:            { padding: SPACING.md, gap: SPACING.md },

  // Card
  card:               { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm, gap: SPACING.sm },
  cardTitleRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardTitle:          { fontSize: 15, fontWeight: '700', color: COLORS.dark },

  // Address
  addressWrap:        { gap: SPACING.sm },
  addressInfo:        { gap: 4 },
  addressName:        { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  addressText:        { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  addressActions:     { flexDirection: 'row', gap: SPACING.sm },
  addrActionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  addrRemoveBtn:      { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  addrActionText:     { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  addAddressBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.md, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', justifyContent: 'center' },
  addAddressText:     { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Order Items
  orderItem:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderItemLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderItemName:      { fontSize: 13, color: COLORS.dark, flex: 1 },
  orderItemQty:       { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  orderItemPrice:     { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  orderItemOriginal:  { fontSize: 11, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  divider:            { height: 1, backgroundColor: COLORS.grayBorder, marginVertical: SPACING.sm },
  totalRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:         { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  totalVal:           { fontSize: 18, fontWeight: '700', color: COLORS.dark },

  // Payment
  payMethod:          { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.grayBg },
  payMethodActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  payIcon:            { width: 40, height: 40, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBorder, alignItems: 'center', justifyContent: 'center' },
  payIconActive:      { backgroundColor: COLORS.primary },
  payInfo:            { flex: 1 },
  payLabel:           { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  payLabelActive:     { color: COLORS.primary },
  paySub:             { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  payRadio:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.grayBorder, alignItems: 'center', justifyContent: 'center' },
  payRadioActive:     { borderColor: COLORS.primary },
  payRadioDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  refWrap:            { gap: 6, marginTop: SPACING.sm },
  refLabel:           { fontSize: 12, fontWeight: '600', color: COLORS.dark },
  inputRow:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg, paddingHorizontal: SPACING.sm },
  refInput:           { flex: 1, padding: 10, fontSize: 14, color: COLORS.dark },
  refHint:            { fontSize: 11, color: COLORS.textMuted },

  // Footer
  footer:             { backgroundColor: COLORS.white, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.grayBorder, gap: SPACING.sm },
  footerTotal:        { flexDirection: 'row', justifyContent: 'space-between' },
  footerTotalLabel:   { fontSize: 13, color: COLORS.textSecondary },
  footerTotalVal:     { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  orderBtn:           { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: 14, alignItems: 'center' },
  orderBtnInner:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderBtnText:       { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  // Address Modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:          { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.md },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:         { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  modalLabel:         { fontSize: 12, fontWeight: '600', color: COLORS.dark },
  modalInput:         { borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg, padding: SPACING.sm, fontSize: 14, color: COLORS.dark, minHeight: 100 },
  modalBtns:          { flexDirection: 'row', gap: SPACING.sm },
  modalCancelBtn:     { flex: 1, padding: 13, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.grayBorder, alignItems: 'center' },
  modalCancelText:    { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  modalSaveBtn:       { flex: 2, padding: 13, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary, alignItems: 'center' },
  modalSaveText:      { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
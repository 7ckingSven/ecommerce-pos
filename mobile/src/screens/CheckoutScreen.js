import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Image,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Feather from 'react-native-vector-icons/Feather';
import { placeOrder, getProfile, updateProfile, createGcashIntent, getGcashStatus } from '../services/orderService';
import PSGCAddressPicker, { psgcToAddressString } from '../components/PSGCAddressPicker';
import { getCustomerId, getCustomer } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetworkBanner from '../components/NetworkBanner';

const ALL_PAYMENT_METHODS = [
  { id: 'cash_on_delivery', label: 'Cash on Delivery', icon: 'truck',      sub: 'Pay when your order arrives' },
  { id: 'gcash',            label: 'GCash',            icon: 'smartphone', sub: 'Pay instantly via GCash' },
];

// ─── Shipping & Payment Method zone ──────────────────────
// Within South Cotabato: Cash on Delivery AND Online Payment (GCash) are
// both offered, and shipping is free. Outside South Cotabato: COD is not
// offered — Online Payment (GCash) only — and the existing per-zone
// shipping fee applies (see calculateShipping below).
function isWithinSouthCotabato(addr) {
  const parts = (addr || '').split('|').map(p => p.trim().toLowerCase());
  return parts.some(p => p.includes('south cotabato') || p.includes('southcotabato'));
}

function getAvailablePaymentMethods(addr) {
  if (isWithinSouthCotabato(addr)) return ALL_PAYMENT_METHODS;
  return ALL_PAYMENT_METHODS.filter(m => m.id !== 'cash_on_delivery');
}

export default function CheckoutScreen({ route, navigation }) {
  const { cartItems, total, branchId } = route.params;

  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();

  const [payment,       setPayment]       = useState('cash_on_delivery');
  const [loading,       setLoading]       = useState(false);

  // ─── GCash (PayMongo) payment modal ───────────────────
  // 'idle' | 'loading' | 'webview' | 'confirmed' | 'placing' | 'error'
  const [gcashModalVisible, setGcashModalVisible] = useState(false);
  const [gcashStep,          setGcashStep]          = useState('idle');
  const [gcashRedirectUrl,   setGcashRedirectUrl]   = useState('');
  const [gcashPaymentIntentId, setGcashPaymentIntentId] = useState('');
  const [gcashErrorMsg,     setGcashErrorMsg]       = useState('');
  const gcashPollRef = useRef(null);
  const [shippingFee,   setShippingFee]   = useState(0);
  const [orderLoading,  setOrderLoading]  = useState(false);
  const isSubmitting = React.useRef(false); // prevent double order
  const [profileLoading,setProfileLoading]= useState(true);
  const [address,       setAddress]       = useState('');
  const [addressNote,    setAddressNote]    = useState('');
  const [customerName,  setCustomerName]  = useState('');
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [psgcAddress,   setPsgcAddress]   = useState({});
  const [editAddress,    setEditAddress]    = useState('');
  const [editAddressNote, setEditAddressNote] = useState('');
  // Address handled via PSGCAddressPicker
  const [savingAddr,    setSavingAddr]    = useState(false);

  // ─── Delivery Date Calculation ──────────────────────
  function getDeliveryEstimate(addr) {
    const parts    = (addr || '').split('|');
    const province = parts[3]?.trim().toLowerCase() || '';
    const inSC     = province.includes('south cotabato') ||
                     province.includes('southcotabato');

    const today  = new Date();
    const minDays = inSC ? 2 : 5;
    const maxDays = inSC ? 3 : 7;
    const zone    = inSC ? 'Within South Cotabato' : 'Outside South Cotabato';

    const minDate = new Date(today); minDate.setDate(today.getDate() + minDays);
    const maxDate = new Date(today); maxDate.setDate(today.getDate() + maxDays);

    const fmt = d => d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
    return {
      label:    `${fmt(minDate)} - ${fmt(maxDate)}`,
      zone,
      minDays,
      maxDays,
    };
  }

  // ─── Shipping Fee Calculation ──────────────────────
  function calculateShipping(addr, items) {
    // Get total weight from items (in kg)
    // Convert units: gram → kg, mL → assume 1mL=0.001kg, L → 1kg
    const totalWeight = items.reduce((sum, item) => {
      const w    = Number(item.product?.net_weight || 0);
      const unit = (item.product?.net_weight_unit || 'kg').toLowerCase();
      let wKg    = w;
      if (unit === 'gram') wKg = w / 1000;
      else if (unit === 'ml') wKg = w / 1000;
      else if (unit === 'l') wKg = w;
      return sum + wKg * Number(item.quantity || 1);
    }, 0);

    // Parse address — fixed format: Street|Barangay|City|Province|Region|Zip
    // Search all parts for province/city/region keywords to handle missing fields
    const parts     = (addr || '').split('|').map(p => p.trim().toLowerCase());

    // Detect location from full address string (more reliable than fixed index)
    const inSC  = isWithinSouthCotabato(addr);
    const inR12 = parts.some(p =>
      p.includes('xii') || p.includes('soccsksargen') ||
      p.includes('region 12') || p.includes('region xii')
    );

    console.log('Shipping calc:', { inSC, inR12, totalWeight, parts });

    // Within South Cotabato (Koronadal included — it's a component city of
    // the province) — always free shipping, regardless of weight/subtotal.
    if (inSC) return 0;

    if (inR12) {
      const base  = 120;
      const extra = totalWeight > 5 ? Math.ceil((totalWeight - 5) * 30) : 0;
      return base + extra;
    }
    // Outside Region XII
    const base  = 200;
    const extra = totalWeight > 5 ? Math.ceil((totalWeight - 5) * 35) : 0;
    return base + extra;
  }

  // Stop polling if the screen unmounts mid-payment (e.g. user navigates away)
  useEffect(() => {
    return () => { if (gcashPollRef.current) clearInterval(gcashPollRef.current); };
  }, []);

  useEffect(() => {
    async function init() {
      const id = await getCustomerId();
      console.log('CheckoutScreen — Customer ID:', id);
      if (!id) {
        showAlert({ type: 'warning', title: 'Session Expired', message: 'Please log in again.', buttons: [{ text: 'OK', style: 'primary', onPress: () => navigation.replace('Login') }] });
        return;
      }
      loadProfile();
    }
    init();
  }, []);

  // Reload address when screen comes back into focus (e.g. after editing in ProfileScreen)
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  // Cash on Delivery is only offered within South Cotabato — if the
  // loaded/edited address is outside it and COD is still selected
  // (e.g. it was the default, or the address just changed), fall back
  // to GCash automatically so the selection never goes stale.
  useEffect(() => {
    if (!profileLoading && address && payment === 'cash_on_delivery' && !isWithinSouthCotabato(address)) {
      setPayment('gcash');
    }
  }, [address, profileLoading]);

  async function loadProfile() {
    try {
      // Step 1 — Load instantly from AsyncStorage (cached on login)
      const cached = await getCustomer();
      if (cached && typeof cached === 'object') {
        setAddress(cached.address || '');
        setAddressNote(cached.address_note || '');
        setCustomerName(
          ((cached.fname || '') + ' ' + (cached.lname || '')).trim()
        );
        setProfileLoading(false);
      }

      // Step 2 — Fetch fresh from API in background to get latest address
      try {
        const fresh = await getProfile();
        if (fresh && typeof fresh === 'object') {
          const freshAddr = fresh.address || '';
          setAddress(freshAddr);
          setAddressNote(fresh.address_note || '');
          setCustomerName(
            ((fresh.fname || '') + ' ' + (fresh.lname || '')).trim()
          );
          setShippingFee(calculateShipping(freshAddr, cartItems));
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
    setEditAddressNote(addressNote || '');
    const parts = address.split('|');
    setPsgcAddress({
      street:       parts[0]?.trim() || '',
      barangayName: parts[1]?.trim() || '',
      cityName:     parts[2]?.trim() || '',
      provinceName: parts[3]?.trim() || '',
      regionName:   parts[4]?.trim() || '',
      zip_code:     parts[5]?.trim() || '',
    });
    setShowAddrModal(true);
  }

  // ─── Save Address ─────────────────────────────────────
  async function saveAddress() {
    const combined = psgcToAddressString(psgcAddress) || editAddress;
    if (!combined) {
      showAlert({ type: 'warning', title: 'Required', message: 'Please enter your delivery address.' });
      return;
    }
    setSavingAddr(true);
    try {
      await updateProfile({ address: combined, address_note: editAddressNote.trim() });
      setAddress(combined);
      setAddressNote(editAddressNote.trim());
      setShippingFee(calculateShipping(combined, cartItems));
      setShowAddrModal(false);
      showAlert({ type: 'success', title: 'Success', message: 'Address updated successfully!' });
    } catch (e) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save address. Please try again.' });
    } finally {
      setSavingAddr(false);
    }
  }

  // ─── Remove Address ───────────────────────────────────
  function removeAddress() {
    showAlert({ type: 'confirm', title: 'Remove Address',
      message: 'Are you sure you want to remove your delivery address?',
      buttons: [
        { text: 'Cancel' },
        { text: 'Remove', style: 'danger', onPress: async () => {
          try {
            await updateProfile({ address: '' });
            setAddress('');
          } catch (e) {
            showAlert({ type: 'error', title: 'Error', message: 'Failed to remove address.' });
          }
        }},
      ]
    });
  }

  // ─── Submit the order to the backend ──────────────────
  // Shared by Cash on Delivery (paymentIntentId = '') and the post-GCash
  // confirm step (paymentIntentId = the verified PayMongo intent).
  async function submitOrder(paymentIntentId) {
    setLoading(true);
    try {
      const items = cartItems.map(i => {
        const disc       = Array.isArray(i.product?.discount) ? i.product.discount[0] : i.product?.discount;
        const origPrice  = Number(i.product?.price || 0);
        const finalPrice = disc ? origPrice * (1 - disc.percentage / 100) : origPrice;
        return {
          product_id:       i.product_id || i.product?.product_id,
          cart_id:          (i.cart_id && i.cart_id !== 'buy_now') ? i.cart_id : null,
          quantity:         i.quantity,
          price:            finalPrice,
          selected_options: i.selected_options || {},
        };
      });
      const res = await placeOrder(
        items,
        payment,
        paymentIntentId || '',
        branchId || cartItems[0]?.branch_id || null,
        shippingFee,
        address + (addressNote ? ' | ' + addressNote : '')
      );
      showAlert({ type: 'success', title: 'Order Placed!',
        message: `Your order has been placed!\nOrder ID: ${res.order_id?.slice(0, 8).toUpperCase()}\n\nThank you for shopping!`,
        buttons: [
          { text: 'View Orders', style: 'primary', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Orders' } }] }) },
          { text: 'Continue Shopping', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] }) },
        ] });
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to place order. Please try again.';
      showAlert({ type: 'error', title: 'Error', message: msg });
    } finally {
      setLoading(false);
      setOrderLoading(false);
      isSubmitting.current = false;
    }
  }

  // ─── Place Order (Cash on Delivery) ───────────────────
  async function handlePlaceOrder() {
    if (orderLoading || isSubmitting.current) return;
    isSubmitting.current = true;
    setOrderLoading(true);
    if (!address.trim()) {
      showAlert({ type: 'warning', title: 'Address Required', message: 'Please add a delivery address before placing your order.', buttons: [ { text: 'Add Address', style: 'primary', onPress: openAddressModal }, { text: 'Cancel' } ] });
      setOrderLoading(false);
      isSubmitting.current = false;
      return;
    }

    showAlert({ type: 'confirm', title: 'Confirm Order',
      message: `Subtotal: ₱${total.toFixed(2)}\nShipping: ${shippingFee === 0 ? 'FREE' : '₱' + shippingFee.toFixed(2)}\nTotal: ₱${(total + shippingFee).toFixed(2)}\nPayment: ${payment.replace(/_/g, ' ')}`,
      buttons: [
        { text: 'Cancel', onPress: () => { setOrderLoading(false); isSubmitting.current = false; } },
        { text: 'Confirm', style: 'primary', onPress: () => submitOrder('') },
      ]
    });
  }

  // ─── GCash payment (PayMongo, in-app WebView) ─────────
  function resetGcashPayment() {
    if (gcashPollRef.current) { clearInterval(gcashPollRef.current); gcashPollRef.current = null; }
    setGcashStep('idle');
    setGcashRedirectUrl('');
    setGcashPaymentIntentId('');
    setGcashErrorMsg('');
  }

  async function startGcashPayment() {
    if (orderLoading || isSubmitting.current) return;
    if (!address.trim()) {
      showAlert({ type: 'warning', title: 'Address Required', message: 'Please add a delivery address before placing your order.', buttons: [ { text: 'Add Address', style: 'primary', onPress: openAddressModal }, { text: 'Cancel' } ] });
      return;
    }
    isSubmitting.current = true;
    setOrderLoading(true);
    setGcashModalVisible(true);
    setGcashStep('loading');
    try {
      const amount = total + shippingFee;
      const { payment_intent_id, redirect_url } = await createGcashIntent(amount);
      setGcashPaymentIntentId(payment_intent_id);
      setGcashRedirectUrl(redirect_url);
      setGcashStep('webview');
      gcashPollRef.current = setInterval(() => pollGcashStatus(payment_intent_id), 3000);
    } catch (e) {
      setGcashErrorMsg(e.response?.data?.error || 'Could not start GCash payment. Please try again.');
      setGcashStep('error');
      setOrderLoading(false);
      isSubmitting.current = false;
    }
  }

  async function pollGcashStatus(intentId) {
    try {
      const { status } = await getGcashStatus(intentId);
      if (status === 'succeeded') {
        clearInterval(gcashPollRef.current);
        gcashPollRef.current = null;
        setGcashStep('confirmed');
      }
    } catch (e) {
      // Transient network hiccup — keep polling on the next tick.
    }
  }

  function cancelGcashPayment() {
    resetGcashPayment();
    setGcashModalVisible(false);
    setOrderLoading(false);
    isSubmitting.current = false;
  }

  async function confirmGcashOrder() {
    setGcashStep('placing');
    await submitOrder(gcashPaymentIntentId);
    setGcashModalVisible(false);
    resetGcashPayment();
  }

  return (
    <View style={styles.container}>
      {/* This screen never rendered its own StatusBar before — it just
          inherited whatever the previous screen (Home or Cart) left set,
          which happened to work by coincidence but is fragile. Made
          explicit here: fully transparent/translucent, matching the other
          screens — modern Android (15+/edge-to-edge) ignores
          backgroundColor/translucent anyway, so the header's own
          background (below) is what actually paints this area now. */}
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true}/>
      <NetworkBanner />

      {/* Header background now reaches up through insets.top on every
          platform, painting over the status-bar area itself. */}
      <View style={[styles.header, { paddingTop: SPACING.xl + insets.top }]}>
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
                <Text style={styles.addressText}>{address.split('|').map(s => s.trim()).filter(Boolean).join(', ')}</Text>
                {addressNote ? (
                  <Text style={[styles.addressText, { color: COLORS.textMuted, fontSize: 12, marginTop: 2 }]}>
                    📍 {addressNote}
                  </Text>
                ) : null}
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
                {item.product?.image_url
                  ? <Image source={{ uri: item.product.image_url }} style={styles.checkoutItemImg}/>
                  : <View style={styles.checkoutItemImgPlaceholder}/>
                }
                <View style={styles.orderItemLeft}>
                  <Text style={styles.orderItemName} numberOfLines={1}>
                    {item.product?.product_name || '—'}
                  </Text>
                  {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                    <Text style={styles.orderItemOptions}>
                      {Object.entries(item.selected_options).map(([k,v]) => `${k}: ${v}`).join(' · ')}
                    </Text>
                  )}
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
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalVal}>₱{total.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 6 }]}>
            <Text style={styles.totalLabel}>Shipping Fee</Text>
            <Text style={[styles.totalVal, { color: shippingFee === 0 ? COLORS.primary : COLORS.dark }]}>
              {shippingFee === 0 ? 'FREE' : `₱${shippingFee.toFixed(2)}`}
            </Text>
          </View>
          <View style={styles.divider}/>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontWeight: '700', fontSize: 15 }]}>Total</Text>
            <Text style={[styles.totalVal, { color: COLORS.primary, fontSize: 16 }]}>
              ₱{(total + shippingFee).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ─── Delivery Estimate ─── */}
        {address ? (() => {
          const est = getDeliveryEstimate(address);
          return (
            <View style={[styles.card, { borderLeftWidth:3, borderLeftColor: COLORS.primary }]}>
              <View style={styles.cardTitleRow}>
                <Feather name="truck" size={16} color={COLORS.primary}/>
                <Text style={styles.cardTitle}>Estimated Delivery</Text>
              </View>
              <Text style={styles.deliveryDate}>{est.label}</Text>
              <Text style={styles.deliveryZone}>{est.zone} · {est.minDays}-{est.maxDays} business days</Text>
            </View>
          );
        })() : null}

        {/* ─── Payment Method ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>
          {address && !isWithinSouthCotabato(address) && (
            <View style={styles.codUnavailableBox}>
              <Feather name="info" size={14} color={COLORS.textMuted}/>
              <Text style={styles.codUnavailableText}>
                Cash on Delivery is only available within South Cotabato. Online Payment (GCash) is required for this address.
              </Text>
            </View>
          )}
          {getAvailablePaymentMethods(address).map(m => (
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
              <View style={styles.gcashNumberBox}>
                <Feather name="smartphone" size={20} color="#1d4ed8"/>
                <View style={{ flex:1 }}>
                  <Text style={styles.gcashNumberLabel}>You'll be asked to complete your GCash payment securely after tapping "Pay with GCash" below.</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.xl }}/>
      </ScrollView>

      {/* ─── Footer ─── */}
      {/* Extra bottom padding clears the floating translucent tab bar
          (AppNavigator's tabBarStyle is position: 'absolute' with height
          60 + insets.bottom, so it overlaps whatever sits at the true
          bottom of any screen nested in a tab's stack — Checkout is
          nested in CartStack). */}
      <View style={[styles.footer, { paddingBottom: SPACING.md + 60 + insets.bottom }]}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalVal}>₱{total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.orderBtn}
          onPress={payment === 'gcash' ? startGcashPayment : handlePlaceOrder}
          disabled={orderLoading || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white}/>
          ) : (
            <View style={styles.orderBtnInner}>
              <Feather name={payment === 'gcash' ? 'smartphone' : 'check-circle'} size={18} color={COLORS.white}/>
              <Text style={styles.orderBtnText}>{payment === 'gcash' ? 'Pay with GCash' : 'Place Order'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── GCash Payment Modal ───────────────────────────
          Same state-machine shape as the staff POS GCash modal: loading →
          webview (customer authorizes) → confirmed → placing → done. Only
          this modal's own buttons (Cancel / Confirm Order) close it — no
          backdrop tap, no hardware-back dismissal mid-payment. */}
      <Modal
        visible={gcashModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => { if (gcashStep === 'webview') cancelGcashPayment(); }}
      >
        <View style={styles.gcashModalOverlay}>
          <View style={[styles.gcashModalCard, gcashStep === 'webview' && styles.gcashModalCardWebview]}>

            {gcashStep === 'loading' && (
              <View style={styles.gcashModalCenterPad}>
                <ActivityIndicator color={COLORS.primary} size="large"/>
                <Text style={styles.gcashModalText}>Setting up secure GCash payment…</Text>
              </View>
            )}

            {gcashStep === 'webview' && (
              <>
                <View style={styles.gcashModalHeader}>
                  <Text style={styles.gcashModalTitle}>GCash Payment</Text>
                </View>
                <WebView
                  source={{ uri: gcashRedirectUrl }}
                  style={{ flex: 1 }}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.gcashModalCenterPad}>
                      <ActivityIndicator color={COLORS.primary} size="large"/>
                    </View>
                  )}
                />
                <TouchableOpacity style={styles.gcashModalCancelBtn} onPress={cancelGcashPayment}>
                  <Text style={styles.gcashModalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {gcashStep === 'confirmed' && (
              <View style={styles.gcashModalCenterPad}>
                <Feather name="check-circle" size={48} color={COLORS.primary}/>
                <Text style={[styles.gcashModalText, { fontWeight:'700', fontSize:16, marginTop:10 }]}>Payment Confirmed!</Text>
                <Text style={styles.gcashModalText}>
                  Total: ₱{(total + shippingFee).toFixed(2)}
                </Text>
                <TouchableOpacity style={styles.gcashModalConfirmBtn} onPress={confirmGcashOrder}>
                  <Feather name="check-circle" size={18} color={COLORS.white}/>
                  <Text style={styles.gcashModalConfirmBtnText}>Confirm Order</Text>
                </TouchableOpacity>
              </View>
            )}

            {gcashStep === 'placing' && (
              <View style={styles.gcashModalCenterPad}>
                <ActivityIndicator color={COLORS.primary} size="large"/>
                <Text style={styles.gcashModalText}>Placing your order…</Text>
              </View>
            )}

            {gcashStep === 'error' && (
              <View style={styles.gcashModalCenterPad}>
                <Feather name="alert-circle" size={40} color="#ef4444"/>
                <Text style={[styles.gcashModalText, { color:'#ef4444' }]}>{gcashErrorMsg}</Text>
                <TouchableOpacity style={styles.gcashModalCancelBtn} onPress={cancelGcashPayment}>
                  <Text style={styles.gcashModalCancelBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </Modal>

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

            <PSGCAddressPicker
              value={psgcAddress}
              onChange={addr => {
                setPsgcAddress(addr);
                setEditAddress(psgcToAddressString(addr));
              }}
            />

            {/* Landmark / Notes */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 6 }}>
                Landmark / Notes <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(Optional)</Text>
              </Text>
              <TextInput
                style={{ borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: 8, padding: 10, fontSize: 13, color: COLORS.dark, minHeight: 48 }}
                placeholder="e.g. Near Jollibee, Blue Gate House"
                placeholderTextColor={COLORS.textMuted}
                value={editAddressNote}
                onChangeText={setEditAddressNote}
                multiline
                numberOfLines={2}
              />
            </View>

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

      <CustomAlert config={alertConfig} onHide={hideAlert}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.grayBg },
  header:             { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  headerTitle:        { fontSize: 18, fontWeight: '700', color: COLORS.white },
  content:            { padding: SPACING.md, gap: SPACING.md },

  // Card
  card:               { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm, gap: SPACING.sm },
  cardTitleRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardTitle:          { fontSize: 15, fontWeight: '700', color: COLORS.dark },

  // Address
  addressWrap:        { gap: SPACING.sm },
  addressInfo:        { gap: 4 },
  deliveryDate:       { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginTop: 4 },
  deliveryZone:       { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  addressName:        { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  addressText:        { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  addressActions:     { flexDirection: 'row', gap: SPACING.sm },
  addrActionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  addrRemoveBtn:      { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  addrActionText:     { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  addAddressBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.md, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', justifyContent: 'center' },
  addAddressText:     { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Order Items
  checkoutItemImg:            { width:50, height:50, borderRadius:10, marginRight:12, backgroundColor:'#f0f0f0' },
  checkoutItemImgPlaceholder: { width:50, height:50, borderRadius:10, marginRight:12, backgroundColor:'#f0f0f0' },
  orderItem:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderItemLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderItemOptions:    { fontSize: 11, color: COLORS.primary, marginTop: 2 },
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
  codUnavailableBox:  { flexDirection:'row', alignItems:'flex-start', gap:8, padding:10, borderRadius:RADIUS.sm, backgroundColor:COLORS.grayBg, marginBottom: SPACING.sm },
  codUnavailableText: { flex:1, fontSize:12, color:COLORS.textSecondary, lineHeight:17 },
  gcashNumberBox:     { flexDirection:'row', alignItems:'flex-start', gap:10, padding:12, borderRadius:RADIUS.sm, backgroundColor:'rgba(29,78,216,0.06)', borderWidth:1, borderColor:'rgba(29,78,216,0.2)' },
  gcashNumberLabel:   { fontSize:12, color:COLORS.textSecondary, lineHeight:17 },

  // GCash Payment Modal
  gcashModalOverlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:SPACING.lg },
  gcashModalCard:         { width:'100%', maxWidth:400, maxHeight:'85%', backgroundColor:COLORS.white, borderRadius:RADIUS.xl, overflow:'hidden', ...SHADOW.sm },
  gcashModalCardWebview:  { height:'85%' },
  gcashModalHeader:       { padding:SPACING.md, borderBottomWidth:1, borderBottomColor:COLORS.grayBorder },
  gcashModalTitle:        { fontSize:15, fontWeight:'700', color:COLORS.dark, textAlign:'center' },
  gcashModalCenterPad:    { padding:SPACING.xl, alignItems:'center', gap:8 },
  gcashModalText:         { fontSize:13, color:COLORS.textSecondary, textAlign:'center' },
  gcashModalCancelBtn:    { padding:14, alignItems:'center', borderTopWidth:1, borderTopColor:COLORS.grayBorder },
  gcashModalCancelBtnText:{ fontSize:14, fontWeight:'700', color:'#ef4444' },
  gcashModalConfirmBtn:   { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:COLORS.primary, borderRadius:RADIUS.sm, paddingVertical:12, paddingHorizontal:24, marginTop:14 },
  gcashModalConfirmBtnText: { color:COLORS.white, fontWeight:'700', fontSize:14 },

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
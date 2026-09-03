import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { placeOrder, getProfile, updateProfile } from '../services/orderService';
import PSGCAddressPicker, { psgcToAddressString } from '../components/PSGCAddressPicker';
import { getCustomerId, getCustomer } from '../services/authService';
import { launchImageLibrary } from 'react-native-image-picker';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

const PAYMENT_METHODS = [
  { id: 'cash_on_delivery', label: 'Cash on Delivery', icon: 'truck',      sub: 'Pay when your order arrives' },
  { id: 'gcash',            label: 'GCash',            icon: 'smartphone', sub: 'Enter reference number after payment' },
];

export default function CheckoutScreen({ route, navigation }) {
  const { cartItems, total, branchId } = route.params;

  const [payment,       setPayment]       = useState('cash_on_delivery');
  const [refNo,         setRefNo]         = useState('');
  const [senderNo,      setSenderNo]      = useState('');
  const [gcashMethod,   setGcashMethod]   = useState('details'); // 'details' | 'image'
  const [receiptImage,  setReceiptImage]  = useState(null);  // { uri, base64 }
  const [refNoError,    setRefNoError]    = useState('');
  const [senderError,   setSenderError]   = useState('');
  const [loading,       setLoading]       = useState(false);
  const [shippingFee,   setShippingFee]   = useState(0);
  const [orderLoading,  setOrderLoading]  = useState(false);
  const [profileLoading,setProfileLoading]= useState(true);
  const [address,       setAddress]       = useState('');
  const [customerName,  setCustomerName]  = useState('');
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [psgcAddress,   setPsgcAddress]   = useState({});
  const [editAddress,   setEditAddress]   = useState('');
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
    const fullAddr  = parts.join(' ');

    // Detect location from full address string (more reliable than fixed index)
    const inKoronadal = parts.some(p => p.includes('koronadal'));
    const inSC        = parts.some(p =>
      p.includes('south cotabato') || p.includes('southcotabato')
    );
    const inR12       = parts.some(p =>
      p.includes('xii') || p.includes('soccsksargen') ||
      p.includes('region 12') || p.includes('region xii')
    );

    // Subtotal
    const subtotal = items.reduce((sum, item) => {
      const disc       = Array.isArray(item.product?.discount) ? item.product.discount[0] : item.product?.discount;
      const origPrice  = Number(item.product?.price || 0);
      const finalPrice = disc ? origPrice * (1 - Number(disc.percentage) / 100) : origPrice;
      return sum + finalPrice * Number(item.quantity || 1);
    }, 0);

    console.log('Shipping calc:', { inKoronadal, inSC, inR12, totalWeight, subtotal, parts });

    if (inKoronadal) {
      if (subtotal >= 500) return 0;
      if (totalWeight <= 3) return 0;
      return Math.ceil((totalWeight - 3) * 25);
    }
    if (inSC) {
      const base  = 50;
      const extra = totalWeight > 3 ? Math.ceil((totalWeight - 3) * 25) : 0;
      return base + extra;
    }
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

  // Reload address when screen comes back into focus (e.g. after editing in ProfileScreen)
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

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
          const freshAddr = fresh.address || '';
          setAddress(freshAddr);
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
      Alert.alert('Required', 'Please enter your delivery address.');
      return;
    }
    setSavingAddr(true);
    try {
      await updateProfile({ address: combined });
      setAddress(combined);
      setShippingFee(calculateShipping(combined, cartItems));
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
    if (orderLoading) return;
    setOrderLoading(true);
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please add a delivery address before placing your order.', [
        { text: 'Add Address', onPress: openAddressModal },
        { text: 'Cancel' }
      ]);
      return;
    }

    // GCash validation
    if (payment === 'gcash') {
      if (gcashMethod === 'details') {
        const refClean    = refNo.trim().replace(/\D/g, '');
        const senderClean = senderNo.trim().replace(/\D/g, '');
        let hasError = false;
        if (refClean.length !== 13) {
          setRefNoError('Reference number must be exactly 13 digits.');
          hasError = true;
        } else { setRefNoError(''); }
        if (senderClean.length !== 11 || !senderClean.startsWith('09')) {
          setSenderError('Sender number must be 11 digits starting with 09.');
          hasError = true;
        } else { setSenderError(''); }
        if (hasError) return;
      } else {
        if (!receiptImage) {
          Alert.alert('Required', 'Please upload your GCash receipt image.');
          return;
        }
      }
    }

    Alert.alert(
      'Confirm Order',
      `Subtotal: ₱${total.toFixed(2)}\nShipping: ${shippingFee === 0 ? 'FREE' : '₱' + shippingFee.toFixed(2)}\nGrand Total: ₱${(total + shippingFee).toFixed(2)}\nPayment: ${payment.replace(/_/g, ' ')}\nDeliver to: ${address.split('|').map(s=>s.trim()).filter(Boolean).join(', ')}`,
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
                gcashMethod === 'details' ? refNo.trim() : '',
                branchId || cartItems[0]?.branch_id || null,
                shippingFee,
                address,
                gcashMethod === 'details' ? senderNo.trim() : '',
                gcashMethod === 'image'   ? receiptImage   : null
              );
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
                <Text style={styles.addressText}>{address.split('|').map(s => s.trim()).filter(Boolean).join(', ')}</Text>
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
            <Text style={[styles.totalLabel, { fontWeight: '700', fontSize: 15 }]}>Grand Total</Text>
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
              {/* GCash Store Number */}
              <View style={styles.gcashNumberBox}>
                <Feather name="smartphone" size={20} color="#1d4ed8"/>
                <View style={{ flex:1 }}>
                  <Text style={styles.gcashNumberLabel}>Send payment to this GCash number:</Text>
                  <Text style={styles.gcashNumber}>09856446102</Text>
                  <Text style={styles.gcashName}>Triple E & Fiel Collins GM</Text>
                </View>
              </View>

              {/* Method Toggle */}
              <View style={styles.gcashToggleRow}>
                <TouchableOpacity
                  style={[styles.gcashToggleBtn, gcashMethod === 'details' && styles.gcashToggleActive]}
                  onPress={() => setGcashMethod('details')}
                >
                  <Feather name="edit-2" size={14} color={gcashMethod === 'details' ? '#fff' : COLORS.textMuted}/>
                  <Text style={[styles.gcashToggleText, gcashMethod === 'details' && { color:'#fff' }]}>Enter Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.gcashToggleBtn, gcashMethod === 'image' && styles.gcashToggleActive]}
                  onPress={() => setGcashMethod('image')}
                >
                  <Feather name="image" size={14} color={gcashMethod === 'image' ? '#fff' : COLORS.textMuted}/>
                  <Text style={[styles.gcashToggleText, gcashMethod === 'image' && { color:'#fff' }]}>Upload Receipt</Text>
                </TouchableOpacity>
              </View>

              {/* Option A — Enter Details */}
              {gcashMethod === 'details' && (
                <View>
                  <Text style={styles.refLabel}>Sender's GCash Number *</Text>
                  <View style={[styles.inputRow, senderError ? styles.inputError : null]}>
                    <Feather name="phone" size={16} color={COLORS.textMuted} style={{ marginRight:8 }}/>
                    <TextInput
                      style={styles.refInput}
                      placeholder="09XXXXXXXXX (11 digits)"
                      placeholderTextColor={COLORS.textMuted}
                      value={senderNo}
                      onChangeText={t => {
                        const clean = t.replace(/\D/g,'').slice(0,11);
                        setSenderNo(clean);
                        setSenderError(clean.length === 11 && clean.startsWith('09') ? '' : '');
                      }}
                      keyboardType="number-pad"
                      maxLength={11}
                    />
                  </View>
                  {senderError ? <Text style={styles.inputErrText}>{senderError}</Text> : null}

                  <Text style={[styles.refLabel, { marginTop:12 }]}>Reference Number *</Text>
                  <View style={[styles.inputRow, refNoError ? styles.inputError : null]}>
                    <Feather name="hash" size={16} color={COLORS.textMuted} style={{ marginRight:8 }}/>
                    <TextInput
                      style={styles.refInput}
                      placeholder="13-digit reference number"
                      placeholderTextColor={COLORS.textMuted}
                      value={refNo}
                      onChangeText={t => {
                        const clean = t.replace(/\D/g,'').slice(0,13);
                        setRefNo(clean);
                        setRefNoError(clean.length === 13 ? '' : '');
                      }}
                      keyboardType="number-pad"
                      maxLength={13}
                    />
                  </View>
                  {refNoError ? <Text style={styles.inputErrText}>{refNoError}</Text> : null}
                  <Text style={styles.refHint}>Complete GCash payment first, then enter the details.</Text>
                </View>
              )}

              {/* Option B — Upload Receipt */}
              {gcashMethod === 'image' && (
                <View>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={() => {
                      launchImageLibrary({ mediaType:'photo', quality:0.8, includeBase64:true }, res => {
                        if (res.assets && res.assets[0]) {
                          setReceiptImage(res.assets[0]);
                        }
                      });
                    }}
                  >
                    <Feather name="upload" size={18} color={COLORS.primary}/>
                    <Text style={styles.uploadBtnText}>
                      {receiptImage ? 'Change Receipt Image' : 'Upload GCash Receipt'}
                    </Text>
                  </TouchableOpacity>
                  {receiptImage && (
                    <Image
                      source={{ uri: receiptImage.uri }}
                      style={styles.receiptPreview}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={styles.refHint}>Upload a screenshot of your GCash payment receipt.</Text>
                </View>
              )}
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
          disabled={orderLoading || loading}
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

            <PSGCAddressPicker
              value={psgcAddress}
              onChange={addr => {
                setPsgcAddress(addr);
                setEditAddress(psgcToAddressString(addr));
              }}
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
  gcashToggleRow:    { flexDirection:'row', gap:8, marginBottom:16, marginTop:8 },
  gcashToggleBtn:    { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, padding:10, borderRadius:8, borderWidth:1.5, borderColor:COLORS.border, backgroundColor:COLORS.surface },
  gcashToggleActive: { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  gcashToggleText:   { fontSize:13, fontWeight:'600', color:COLORS.textMuted },
  inputError:        { borderColor:'#ef4444' },
  inputErrText:      { fontSize:11, color:'#ef4444', marginTop:4, marginLeft:4 },
  uploadBtn:         { flexDirection:'row', alignItems:'center', gap:8, padding:14, borderRadius:10, borderWidth:1.5, borderColor:COLORS.primary, backgroundColor:'rgba(22,163,74,0.05)', justifyContent:'center', marginBottom:12 },
  uploadBtnText:     { fontSize:14, fontWeight:'600', color:COLORS.primary },
  receiptPreview:    { width:'100%', height:200, borderRadius:10, marginBottom:8, backgroundColor:COLORS.surface },
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
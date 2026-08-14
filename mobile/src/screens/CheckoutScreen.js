import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { placeOrder } from '../services/orderService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

const PAYMENT_METHODS = [
  { id:'cash_on_delivery', label:'Cash on Delivery', icon:'truck',       sub:'Pay when your order arrives' },
  { id:'gcash',            label:'GCash',             icon:'smartphone',  sub:'Enter reference number after payment' },
];

export default function CheckoutScreen({ route, navigation }) {
  const { cartItems, total } = route.params;
  const [payment,   setPayment]   = useState('cash_on_delivery');
  const [refNo,     setRefNo]     = useState('');
  const [loading,   setLoading]   = useState(false);

  async function handlePlaceOrder() {
    if (payment === 'gcash' && !refNo.trim()) {
      Alert.alert('Required', 'Please enter the GCash reference number.');
      return;
    }

    Alert.alert(
      'Confirm Order',
      `Total: ₱${total.toFixed(2)}\nPayment: ${payment.replace(/_/g,' ')}\n\nPlace this order?`,
      [
        { text: 'Cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const items = cartItems.map(i => ({
                product_id: i.product_id,
                cart_id:    i.cart_id,
                quantity:   i.quantity,
                price:      Number(i.product?.price || 0),
              }));
              const res = await placeOrder(items, payment, refNo.trim());
              Alert.alert('Order Placed!', `Your order has been placed successfully.\nOrder ID: ${res.order_id?.slice(0,8).toUpperCase()}`, [
                { text: 'View Orders', onPress: () => navigation.navigate('Orders') },
                { text: 'Continue Shopping', onPress: () => navigation.navigate('Home') }
              ]);
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
        <View style={{ width:22 }}/>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Order Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          {cartItems.map(item => (
            <View key={item.cart_id} style={styles.orderItem}>
              <View style={styles.orderItemLeft}>
                <Text style={styles.orderItemName} numberOfLines={1}>{item.product?.product_name || '—'}</Text>
                <Text style={styles.orderItemQty}>x{item.quantity}</Text>
              </View>
              <Text style={styles.orderItemPrice}>₱{(Number(item.product?.price || 0) * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider}/>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalVal}>₱{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Method */}
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

          {/* GCash Reference */}
          {payment === 'gcash' && (
            <View style={styles.refWrap}>
              <Text style={styles.refLabel}>GCash Reference Number *</Text>
              <View style={styles.inputRow}>
                <Feather name="hash" size={16} color={COLORS.textMuted} style={{ marginRight:8 }}/>
                <TextInput
                  style={styles.refInput}
                  placeholder="Enter reference number"
                  placeholderTextColor={COLORS.textMuted}
                  value={refNo}
                  onChangeText={setRefNo}
                  keyboardType="number-pad"
                />
              </View>
              <Text style={styles.refHint}>Please complete your GCash payment first, then enter the reference number.</Text>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.xl }}/>
      </ScrollView>

      {/* Place Order Button */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex:1, backgroundColor: COLORS.grayBg },
  header:           { backgroundColor: COLORS.dark, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  headerTitle:      { fontSize:18, fontWeight:'700', color: COLORS.white },
  content:          { padding: SPACING.md, gap: SPACING.md },
  card:             { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm, gap: SPACING.sm },
  cardTitle:        { fontSize:15, fontWeight:'700', color: COLORS.dark, marginBottom: SPACING.sm },
  orderItem:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  orderItemLeft:    { flex:1, flexDirection:'row', alignItems:'center', gap:8 },
  orderItemName:    { fontSize:13, color: COLORS.dark, flex:1 },
  orderItemQty:     { fontSize:12, color: COLORS.textMuted, fontWeight:'600' },
  orderItemPrice:   { fontSize:13, fontWeight:'700', color: COLORS.dark },
  divider:          { height:1, backgroundColor: COLORS.grayBorder, marginVertical: SPACING.sm },
  totalRow:         { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  totalLabel:       { fontSize:14, fontWeight:'600', color: COLORS.textSecondary },
  totalVal:         { fontSize:18, fontWeight:'700', color: COLORS.dark },
  payMethod:        { flexDirection:'row', alignItems:'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.sm, borderWidth:1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.grayBg },
  payMethodActive:  { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  payIcon:          { width:40, height:40, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBorder, alignItems:'center', justifyContent:'center' },
  payIconActive:    { backgroundColor: COLORS.primary },
  payInfo:          { flex:1 },
  payLabel:         { fontSize:13, fontWeight:'600', color: COLORS.dark },
  payLabelActive:   { color: COLORS.primary },
  paySub:           { fontSize:11, color: COLORS.textMuted, marginTop:2 },
  payRadio:         { width:20, height:20, borderRadius:10, borderWidth:2, borderColor: COLORS.grayBorder, alignItems:'center', justifyContent:'center' },
  payRadioActive:   { borderColor: COLORS.primary },
  payRadioDot:      { width:10, height:10, borderRadius:5, backgroundColor: COLORS.primary },
  refWrap:          { gap:6, marginTop: SPACING.sm },
  refLabel:         { fontSize:12, fontWeight:'600', color: COLORS.dark },
  inputRow:         { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg, paddingHorizontal: SPACING.sm },
  refInput:         { flex:1, padding:10, fontSize:14, color: COLORS.dark },
  refHint:          { fontSize:11, color: COLORS.textMuted },
  footer:           { backgroundColor: COLORS.white, padding: SPACING.md, borderTopWidth:1, borderTopColor: COLORS.grayBorder, gap: SPACING.sm },
  footerTotal:      { flexDirection:'row', justifyContent:'space-between' },
  footerTotalLabel: { fontSize:13, color: COLORS.textSecondary },
  footerTotalVal:   { fontSize:18, fontWeight:'700', color: COLORS.dark },
  orderBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding:14, alignItems:'center' },
  orderBtnInner:    { flexDirection:'row', alignItems:'center', gap:8 },
  orderBtnText:     { color: COLORS.white, fontWeight:'700', fontSize:15 },
});
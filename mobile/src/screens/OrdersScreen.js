import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getOrders } from '../services/orderService';
import { isLoggedIn } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

function statusColor(s) {
  const map = { pending:'#eab308', processing:'#3b82f6', out_for_delivery:'#8b5cf6', completed: COLORS.primary, cancelled:'#ef4444' };
  return map[s] || COLORS.textMuted;
}

export default function OrdersScreen({ navigation }) {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    isLoggedIn().then(logged => {
      setLoggedIn(logged);
      if (logged) loadOrders();
      else setLoading(false);
    });
  }, []);

  async function loadOrders() {
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (e) {
      console.error('Orders error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (!loggedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>My Orders</Text></View>
        <View style={styles.emptyWrap}>
          <Feather name="lock" size={48} color={COLORS.grayLight}/>
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptyText}>You need to be logged in to view your orders.</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) return (
    <View style={[styles.container, { justifyContent:'center', alignItems:'center' }]}>
      <ActivityIndicator color={COLORS.primary} size="large"/>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSub}>{orders.length} order(s)</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="package" size={56} color={COLORS.grayLight}/>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Your order history will appear here.</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.order_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={loadOrders}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              {/* Order Header */}
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>Order #{item.order_id?.slice(0,8).toUpperCase()}</Text>
                  <Text style={styles.orderDate}>{new Date(item.date).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                    {item.status === 'out_for_delivery' ? 'Out for Delivery' : item.status?.replace(/_/g,' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Items */}
              <View style={styles.divider}/>
              {(item.order_item || []).map((oi, idx) => (
                <View key={idx} style={styles.orderItem}>
                  <Text style={styles.orderItemName} numberOfLines={1}>{oi.product?.product_name || '—'}</Text>
                  <Text style={styles.orderItemQtyPrice}>x{oi.quantity} · ₱{(Number(oi.price) * oi.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.divider}/>

              {/* Footer */}
              <View style={styles.orderFooter}>
                <View style={styles.orderType}>
                  <Feather name={item.order_type === 'online' ? 'smartphone' : 'monitor'} size={12} color={COLORS.textMuted}/>
                  <Text style={styles.orderTypeText}>{item.order_type === 'online' ? 'Online Order' : 'Walk-in'}</Text>
                </View>
                <Text style={styles.orderTotal}>₱{Number(item.total).toFixed(2)}</Text>
              </View>

              {/* Payment */}
              {item.payment && (
                <View style={styles.paymentRow}>
                  <Feather name="credit-card" size={12} color={COLORS.textMuted}/>
                  <Text style={styles.paymentText}>
                    {item.payment.payment_method?.replace(/_/g,' ')} · {item.payment.status}
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex:1, backgroundColor: COLORS.grayBg },
  header:           { backgroundColor: COLORS.dark, paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  headerTitle:      { fontSize:18, fontWeight:'700', color: COLORS.white },
  headerSub:        { fontSize:12, color: COLORS.grayLight, marginTop:2 },
  list:             { padding: SPACING.md, gap: SPACING.sm },
  orderCard:        { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm, gap: SPACING.sm },
  orderHeader:      { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  orderId:          { fontSize:13, fontWeight:'700', color: COLORS.dark },
  orderDate:        { fontSize:11, color: COLORS.textMuted, marginTop:2 },
  statusBadge:      { borderRadius: RADIUS.full, paddingHorizontal:10, paddingVertical:4 },
  statusText:       { fontSize:10, fontWeight:'700' },
  divider:          { height:1, backgroundColor: COLORS.grayBorder },
  orderItem:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  orderItemName:    { fontSize:12, color: COLORS.dark, flex:1 },
  orderItemQtyPrice:{ fontSize:12, color: COLORS.textMuted, fontWeight:'500' },
  orderFooter:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  orderType:        { flexDirection:'row', alignItems:'center', gap:4 },
  orderTypeText:    { fontSize:11, color: COLORS.textMuted },
  orderTotal:       { fontSize:16, fontWeight:'700', color: COLORS.dark },
  paymentRow:       { flexDirection:'row', alignItems:'center', gap:4 },
  paymentText:      { fontSize:11, color: COLORS.textMuted, textTransform:'capitalize' },
  emptyWrap:        { flex:1, alignItems:'center', justifyContent:'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle:       { fontSize:18, fontWeight:'700', color: COLORS.dark },
  emptyText:        { fontSize:13, color: COLORS.textSecondary, textAlign:'center' },
  shopBtn:          { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical:12, marginTop: SPACING.sm },
  shopBtnText:      { color: COLORS.white, fontWeight:'700', fontSize:14 },
  loginBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical:12, marginTop: SPACING.sm },
  loginBtnText:     { color: COLORS.white, fontWeight:'700', fontSize:14 },
});
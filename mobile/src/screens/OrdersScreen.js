import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getOrders } from '../services/orderService';
import { isLoggedIn } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

// ─── Delivery Estimate Helper ────────────────────────
function getDeliveryEstimate(order) {
  const addr     = order.address || '';
  const parts    = addr.split('|');
  const province = parts[3]?.trim().toLowerCase() || '';
  const inSC     = province.includes('south cotabato');

  const created  = new Date(order.created_at || order.date || Date.now());
  const minDays  = inSC ? 2 : 5;
  const maxDays  = inSC ? 3 : 7;

  const minDate  = new Date(created); minDate.setDate(created.getDate() + minDays);
  const maxDate  = new Date(created); maxDate.setDate(created.getDate() + maxDays);

  const fmt = d => d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
  return {
    label: `${fmt(minDate)} – ${fmt(maxDate)}`,
    zone:  inSC ? 'Within South Cotabato' : 'Outside South Cotabato',
    minDays,
    maxDays,
  };
}

function statusColor(s) {
  const map = { pending:'#eab308', processing:'#3b82f6', out_for_delivery:'#8b5cf6', completed: COLORS.primary, cancelled:'#ef4444' };
  return map[s] || COLORS.textMuted;
}

export default function OrdersScreen({ navigation }) {
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loggedIn,     setLoggedIn]     = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
            <TouchableOpacity style={styles.orderCard} onPress={() => setSelectedOrder(item)} activeOpacity={0.85}>
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
                  <View style={{ flex:1 }}>
                    <Text style={styles.orderItemName} numberOfLines={1}>{oi.product?.product_name || '—'}</Text>
                    {oi.selected_options && Object.keys(oi.selected_options).length > 0 && (
                      <Text style={styles.orderItemOptions} numberOfLines={1}>
                        {Object.entries(oi.selected_options).map(([k,v]) => `${k}: ${v}`).join(' · ')}
                      </Text>
                    )}
                  </View>
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
                <View style={{ alignItems: 'flex-end' }}>
                  {item.shipping_fee != null && item.shipping_fee > 0 && (
                    <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                      +₱{Number(item.shipping_fee).toFixed(2)} shipping
                    </Text>
                  )}
                  {item.shipping_fee != null && item.shipping_fee === 0 && (
                    <Text style={{ fontSize: 11, color: COLORS.primary }}>FREE shipping</Text>
                  )}
                  <Text style={styles.orderTotal}>₱{Number(item.total).toFixed(2)}</Text>
                </View>
              </View>
              {/* Delivery Estimate */}
              {item.status !== 'completed' && item.status !== 'cancelled' && (
                <View style={styles.deliveryRow}>
                  <Feather name="truck" size={11} color={COLORS.primary}/>
                  <Text style={styles.deliveryText}>
                    Est. Delivery: {getDeliveryEstimate(item).label}
                  </Text>
                </View>
              )}

              {/* Payment */}
              {item.payment && (
                <View style={styles.paymentRow}>
                  <Feather name="credit-card" size={12} color={COLORS.textMuted}/>
                  <Text style={styles.paymentText}>
                    {item.payment.payment_method?.replace(/_/g,' ')} · {item.payment.status}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
      {/* ─── Order Detail Modal ─── */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Order Details</Text>
                <Text style={styles.modalOrderId}>#{selectedOrder?.order_id?.slice(0,8).toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <Feather name="x" size={22} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Status */}
              <View style={styles.detailSection}>
                <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor(selectedOrder?.status) + '20' }]}>
                  <Text style={[styles.statusTextLarge, { color: statusColor(selectedOrder?.status) }]}>
                    {selectedOrder?.status === 'out_for_delivery' ? 'Out for Delivery' : selectedOrder?.status?.replace(/_/g,' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Order Info */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Order Info</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{selectedOrder ? new Date(selectedOrder.date || selectedOrder.created_at).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' }) : '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedOrder?.order_type === 'online' ? 'Online Order' : 'Walk-in'}</Text>
                </View>
                {selectedOrder?.branch_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Branch</Text>
                    <Text style={styles.detailValue}>{selectedOrder.branch_name}</Text>
                  </View>
                )}
              </View>

              {/* Items */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Items Ordered</Text>
                {(selectedOrder?.order_item || []).map((oi, idx) => (
                  <View key={idx} style={styles.detailItemRow}>
                    <View style={{ flex:1 }}>
                      <Text style={styles.detailItemName}>{oi.product?.product_name || '—'}</Text>
                      <Text style={styles.detailItemQty}>x{oi.qty || oi.quantity}</Text>
                      {oi.selected_options && Object.keys(oi.selected_options).length > 0 && (
                        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:4, marginTop:4 }}>
                          {Object.entries(oi.selected_options).map(([k,v], i) => (
                            <View key={i} style={styles.optionChip}>
                              <Text style={styles.optionChipText}>{k}: {v}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <Text style={styles.detailItemPrice}>₱{(Number(oi.price) * Number(oi.qty || oi.quantity)).toFixed(2)}</Text>
                  </View>
                ))}
                {selectedOrder?.shipping_fee != null && (
                  <View style={[styles.detailItemRow, { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailItemName}>Shipping Fee</Text>
                    </View>
                    <Text style={[styles.detailItemPrice, { 
                      color: selectedOrder.shipping_fee === 0 ? COLORS.primary : COLORS.dark 
                    }]}>
                      {selectedOrder.shipping_fee === 0 ? 'FREE' : `₱${Number(selectedOrder.shipping_fee).toFixed(2)}`}
                    </Text>
                  </View>
                )}
                <View style={styles.detailTotalRow}>
                  <Text style={styles.detailTotalLabel}>Grand Total</Text>
                  <Text style={styles.detailTotalValue}>₱{Number(selectedOrder?.total || 0).toFixed(2)}</Text>
                </View>
              </View>

              {/* Payment */}
              {selectedOrder?.payment && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Payment</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Method</Text>
                    <Text style={styles.detailValue}>{(Array.isArray(selectedOrder.payment) ? selectedOrder.payment[0] : selectedOrder.payment)?.payment_method?.replace(/_/g,' ')}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={styles.detailValue}>{(Array.isArray(selectedOrder.payment) ? selectedOrder.payment[0] : selectedOrder.payment)?.status}</Text>
                  </View>
                  {(Array.isArray(selectedOrder.payment) ? selectedOrder.payment[0] : selectedOrder.payment)?.ref_no && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Ref No.</Text>
                      <Text style={styles.detailValue}>{(Array.isArray(selectedOrder.payment) ? selectedOrder.payment[0] : selectedOrder.payment)?.ref_no}</Text>
                    </View>
                  )}
                </View>
              )}

            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  deliveryRow:      { flexDirection:'row', alignItems:'center', gap:4, marginTop:6 },
  deliveryText:     { fontSize:11, color: COLORS.primary, fontWeight:'600', flex:1 },
  loginBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical:12, marginTop: SPACING.sm },
  loginBtnText:     { color: COLORS.white, fontWeight:'700', fontSize:14 },

  // Order Detail Modal
  modalOverlay:         { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalCard:            { backgroundColor: COLORS.white, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'90%', padding: SPACING.md },
  modalHeader:          { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  modalTitle:           { fontSize:16, fontWeight:'700', color: COLORS.dark },
  modalOrderId:         { fontSize:12, color: COLORS.textMuted, marginTop:2 },
  detailSection:        { marginBottom: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  detailSectionTitle:   { fontSize:13, fontWeight:'700', color: COLORS.dark, marginBottom: SPACING.sm },
  detailRow:            { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  detailLabel:          { fontSize:13, color: COLORS.textMuted },
  detailValue:          { fontSize:13, color: COLORS.dark, fontWeight:'500', flex:1, textAlign:'right', textTransform:'capitalize' },
  optionChip:           { backgroundColor:'rgba(22,163,74,0.1)', borderRadius:4, paddingHorizontal:6, paddingVertical:2 },
  optionChipText:       { fontSize:10, color: COLORS.primary, fontWeight:'600' },
  orderItemOptions:     { fontSize:11, color: COLORS.primary, marginTop:2 },
  detailItemRow:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:6, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  detailItemName:       { fontSize:13, color: COLORS.dark, fontWeight:'500' },
  detailItemQty:        { fontSize:11, color: COLORS.textMuted, marginTop:2 },
  detailItemPrice:      { fontSize:13, fontWeight:'700', color: COLORS.dark },
  detailTotalRow:       { flexDirection:'row', justifyContent:'space-between', marginTop: SPACING.sm },
  detailTotalLabel:     { fontSize:14, fontWeight:'700', color: COLORS.dark },
  detailTotalValue:     { fontSize:16, fontWeight:'700', color: COLORS.primary },
  statusBadgeLarge:     { alignSelf:'flex-start', borderRadius: RADIUS.full, paddingHorizontal:14, paddingVertical:6 },
  statusTextLarge:      { fontSize:12, fontWeight:'700' },
  closeBtn:             { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding:14, alignItems:'center', marginTop: SPACING.md },
  closeBtnText:         { color: COLORS.white, fontWeight:'700', fontSize:14 },
});
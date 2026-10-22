import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Modal, ScrollView, Image, Alert, StatusBar,
  TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOrders } from '../services/orderService';
import api from '../services/api';
import { getCustomerId } from '../services/authService';
import { isLoggedIn } from '../services/authService';
import { supabase } from '../services/supabase';
import { SPACING, RADIUS, SHADOW } from '../utils/constants';
import { useTheme } from '../utils/ThemeContext';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import SkeletonLoader from '../components/SkeletonLoader';
import NetworkBanner from '../components/NetworkBanner';
import { resolveVariantPricing } from '../utils/variantPricing';

// ─── Delivery Estimate Helper ────────────────────────
function getDeliveryEstimate(order) {
  if (!order) return { label: '—', zone: '', minDays: 0, maxDays: 0 };
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

function statusColor(s, COLORS) {
  const map = { pending:'#eab308', processing:'#3b82f6', out_for_delivery:'#8b5cf6', completed: COLORS.primary, cancelled:'#ef4444' };
  return map[s] || COLORS.textMuted;
}

// ─── Customer Self-Cancel Window ─────────────────────
// Customers can cancel only while an order is still 'pending', and only within
// 2 hours of placing it. This is UX-only — the backend re-checks both before
// actually cancelling.
const CANCEL_WINDOW_HOURS = 2;
function getCancelWindow(order) {
  if (!order || order.status !== 'pending') return { canCancel: false, msRemaining: 0 };
  // Supabase's created_at comes back with no 'Z'/UTC suffix (e.g.
  // "2026-10-08 09:10:00.123456"). On a device set to a timezone ahead of
  // UTC (PH is UTC+8), `new Date()` parses that naive string as LOCAL time,
  // which silently shifts the apparent creation moment hours into the past
  // relative to the real UTC creation time — making a brand-new order look
  // like its 2-hour cancel window already expired. Force it to be read as
  // UTC, same fix already applied to this timestamp format in app.py's
  // duplicate-order check and in admin.js's order date rendering.
  const raw = order.created_at || order.date;
  if (!raw) return { canCancel: false, msRemaining: 0 };
  const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
  const utcStr      = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
  const created     = new Date(utcStr);
  const deadline    = new Date(created.getTime() + CANCEL_WINDOW_HOURS * 60 * 60 * 1000);
  const msRemaining = deadline.getTime() - Date.now();
  return { canCancel: msRemaining > 0, msRemaining };
}
function formatRemaining(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const CANCEL_REASON_OPTIONS = [
  'Changed my mind',
  'Found a better price elsewhere',
  'Ordered by mistake',
  'Wrong item/variant selected',
  'Other',
];

// Orders list hierarchy — active orders (pending/processing/out for delivery)
// always float above Completed/Cancelled, and within the same tier the
// oldest order shows first (FIFO), matching the Staff/Admin web orders view.
const ORDER_STATUS_PRIORITY = { pending: 1, processing: 2, out_for_delivery: 3, completed: 4, cancelled: 4 };
const ORDER_DONE_TIER = 4; // completed/cancelled
function sortOrdersHierarchy(list) {
  return [...list].sort((a, b) => {
    const pa = ORDER_STATUS_PRIORITY[a.status] ?? 5;
    const pb = ORDER_STATUS_PRIORITY[b.status] ?? 5;
    if (pa !== pb) return pa - pb;
    const da = new Date(a.created_at || a.date || 0).getTime();
    const db = new Date(b.created_at || b.date || 0).getTime();
    // Active tiers (pending/processing/out for delivery): oldest first (FIFO).
    // Done tier (completed/cancelled): newest first, so the oldest sinks to the very bottom.
    return pa === ORDER_DONE_TIER ? db - da : da - db;
  });
}

export default function OrdersScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [loggedIn,     setLoggedIn]     = useState(false);
  const [selectedOrder,   setSelectedOrder]   = useState(null);
  const [activeTab,       setActiveTab]       = useState('all');
  const [markingReceived, setMarkingReceived] = useState(false);
  const [showCancelModal,   setShowCancelModal]   = useState(false);
  const [cancelReasonChoice, setCancelReasonChoice] = useState(null);
  const [cancelReasonOther, setCancelReasonOther] = useState('');
  const [cancelling,       setCancelling]       = useState(false);
  const [, forceTick]     = useState(0); // re-render periodically to tick down the cancel window
  const [buyingAgainId, setBuyingAgainId] = useState(null); // order_item_id currently being re-fetched for Buy Again
  const [buyAgainPickerOrder, setBuyAgainPickerOrder] = useState(null); // order whose items are shown in the Buy Again picker (multi-item orders only)

  // "Buy Again" (completed orders only) — the order_item's own nested
  // product is a slim snapshot (just name/images/price/option_groups, taken
  // from the orders API's select — see api_get_orders in app.py) good enough
  // to redisplay the order, but missing fields ProductDetailScreen needs
  // (branch_stock, discount, description, current price). So this re-fetches
  // the CURRENT product by id instead of forwarding that stale snapshot —
  // which also means Buy Again correctly shows today's price/stock, not
  // what was paid last time.
  async function handleBuyAgain(orderItem, branchId) {
    if (!orderItem?.product_id) return;
    setBuyingAgainId(orderItem.order_item_id || orderItem.product_id);
    try {
      const res = await api.get(`/products/${orderItem.product_id}`);
      setSelectedOrder(null);
      navigation.navigate('ProductDetail', { product: res.data, branchId: branchId || null });
    } catch (e) {
      showAlert({ type: 'error', title: 'Unavailable', message: 'This product could not be loaded — it may have been removed.' });
    } finally {
      setBuyingAgainId(null);
    }
  }

  // Load once whenever the Orders screen gains focus, then open a Realtime
  // subscription scoped to this customer's own orders — a status change made
  // from Admin/Staff (e.g. pending -> processing) now reflects here within a
  // second or two instead of waiting for the next manual refresh. The
  // subscription only ever triggers a refetch via the existing Flask
  // getOrders() call (never trusts the realtime payload directly), so Flask
  // stays the single source of truth for computed fields. Closed again on
  // blur/unmount so navigating away doesn't leak an open socket.
  useFocusEffect(
    useCallback(() => {
      let channel = null;
      let active  = true;

      (async () => {
        const logged = await isLoggedIn();
        if (!active) return;
        setLoggedIn(logged);
        if (!logged) { setLoading(false); return; }

        await loadOrders();
        if (!active) return;

        const customerId = await getCustomerId();
        if (!active || !customerId) return;

        channel = supabase
          .channel('order-' + customerId)
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'order', filter: `customer_id=eq.${customerId}` },
            () => { if (active) loadOrders(); }
          )
          .subscribe();
      })();

      return () => {
        active = false;
        if (channel) supabase.removeChannel(channel);
      };
    }, [])
  );

  // Tapping the "Orders" tab while already on it refreshes the list — the
  // mobile equivalent of the web dashboard's manual ↻ refresh-section button.
  // Orders is a direct Tab.Screen (not nested in a Stack), so its own
  // navigation prop already belongs to the tab navigator — no getParent() needed.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        isLoggedIn().then(logged => { if (logged) loadOrders(); });
      }
    });
    return unsubscribe;
  }, [navigation]);

  const TABS = [
    { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' }, { key: 'out_for_delivery', label: 'Delivery' },
    { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' },
  ];
  const filteredOrders = sortOrdersHierarchy(activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab));

  async function markAsReceived(orderId) {
    setMarkingReceived(true);
    try {
      const customerId = await getCustomerId();
      const res = await api.post(`/orders/${orderId}/received`, {}, {
        headers: { 'X-Customer-ID': customerId }
      });
      showAlert({ type: 'success', title: 'Thank You!', message: 'Your order has been marked as received!' });
      setSelectedOrder(prev => prev ? { ...prev, status: 'completed' } : null);
      await loadOrders();
    } catch (e) {
      showAlert({ type: 'error', title: 'Error', message: e.response?.data?.error || 'Failed to update order.' });
    } finally {
      setMarkingReceived(false);
    }
  }

  async function loadOrders() {
    try {
      setError(false);
      const data = await getOrders();
      setOrders(data);
    } catch (e) {
      console.error('Orders error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Tick every 30s so the "cancel window" countdown and button visibility stay accurate
  useEffect(() => {
    const t = setInterval(() => forceTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function cancelOrder(orderId) {
    const reason = cancelReasonChoice === 'Other'
      ? cancelReasonOther.trim()
      : (cancelReasonChoice || '');
    setCancelling(true);
    try {
      const customerId = await getCustomerId();
      await api.post(`/orders/${orderId}/cancel`, { reason }, {
        headers: { 'X-Customer-ID': customerId }
      });
      setShowCancelModal(false);
      setCancelReasonChoice(null);
      setCancelReasonOther('');
      setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
      showAlert({ type: 'success', title: 'Order Cancelled', message: 'Your order has been cancelled.' });
      await loadOrders();
    } catch (e) {
      showAlert({ type: 'error', title: 'Error', message: e.response?.data?.error || 'Failed to cancel order.' });
    } finally {
      setCancelling(false);
    }
  }

  if (!loggedIn) {
    return (
      <View style={styles.container}>
        {/* Modern Android (15+/edge-to-edge) ignores StatusBar's
          backgroundColor/translucent props entirely, so we draw this
          area ourselves instead: StatusBar stays fully transparent, and
          the header's own background extends up through insets.top. */}
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
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
    <View style={{ flex: 1, backgroundColor: COLORS.grayBg }}>
      {/* Modern Android (15+/edge-to-edge) ignores StatusBar's
          backgroundColor/translucent props entirely, so we stop relying
          on the OS to paint that area and draw it ourselves instead:
          StatusBar stays fully transparent, and the header's own
          background now extends up through insets.top on every
          platform, so there's no seam for the OS to get wrong. */}
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>
      <SkeletonLoader type="order" count={5} />
    </View>
  );

  if (error) return (
    <View style={styles.container}>
      {/* Modern Android (15+/edge-to-edge) ignores StatusBar's
          backgroundColor/translucent props entirely, so we stop relying
          on the OS to paint that area and draw it ourselves instead:
          StatusBar stays fully transparent, and the header's own
          background now extends up through insets.top on every
          platform, so there's no seam for the OS to get wrong. */}
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>
      <View style={styles.emptyWrap}>
        <Feather name="wifi-off" size={48} color={COLORS.grayLight}/>
        <Text style={styles.emptyTitle}>Connection Error</Text>
        <Text style={styles.emptyText}>Could not load your orders. Please check your internet connection.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => { setError(false); setLoading(true); loadOrders(); }}>
          <Text style={styles.loginBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Modern Android (15+/edge-to-edge) ignores StatusBar's
          backgroundColor/translucent props entirely, so we stop relying
          on the OS to paint that area and draw it ourselves instead:
          StatusBar stays fully transparent, and the header's own
          background now extends up through insets.top on every
          platform, so there's no seam for the OS to get wrong. */}
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true}/>
      <View style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>
      <NetworkBanner />

      {/* Tab Bar — flat segmented style: plain text, thin vertical dividers
          between items, active tab in bold primary color with an underline.
          No per-item box/border, just a tinted bar behind the whole row. */}
      <View style={{ backgroundColor: COLORS.primaryBg }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal:16, alignItems:'center' }}
          style={{ maxHeight: 44, minHeight: 44 }}
        >
          {TABS.map((tab, idx) => {
            const count = tab.key==='all' ? orders.length : orders.filter(o=>o.status===tab.key).length;
            const active = activeTab === tab.key;
            return (
              <React.Fragment key={tab.key}>
                {idx > 0 && <View style={styles.tabFlatDivider}/>}
                <TouchableOpacity
                  onPress={() => setActiveTab(tab.key)}
                  style={styles.tabFlat}
                  activeOpacity={0.7}
                >
                  <Text numberOfLines={1} style={[styles.tabFlatText, active && styles.tabFlatTextActive]}>
                    {tab.label}{count>0 ? ` (${count})` : ''}
                  </Text>
                  {active && <View style={styles.tabFlatUnderline}/>}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>

      {/* Content - fills remaining space */}
      {filteredOrders.length === 0 ? (
        <View style={{ alignItems:'center', paddingTop:60, padding:24, gap:12 }}>
          <Feather name="package" size={56} color={COLORS.grayLight}/>
          <Text style={styles.emptyTitle}>{activeTab==='all' ? 'No orders yet' : `No ${activeTab.replace(/_/g,' ')} orders`}</Text>
          <Text style={styles.emptyText}>{activeTab==='all' ? 'Your order history will appear here.' : 'Nothing to show here.'}</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.order_id}
          // Extra bottom padding so the last card can scroll clear of the
          // now-floating (position:'absolute') tab bar in AppNavigator.
          contentContainerStyle={[styles.list, { paddingBottom: SPACING.md + 60 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          onRefresh={loadOrders}
          refreshing={loading}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.orderCard} onPress={() => setSelectedOrder(item)} activeOpacity={0.85}>
              {/* Order Header */}
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>Order #{item.order_id?.slice(0,8).toUpperCase()}</Text>
                  <Text style={styles.orderDate}>{item.date || item.created_at ? new Date(item.date || item.created_at).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '—'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status, COLORS) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status, COLORS) }]}>
                    {item.status === 'out_for_delivery' ? 'Out for Delivery' : item.status?.replace(/_/g,' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Items */}
              <View style={styles.divider}/>
              {(item.order_item || []).map((oi, idx) => {
                // oi.price is the price actually charged (resolved at checkout
                // time); the photo shown here is resolved the same way so it
                // matches whichever variant choice/combo was ordered.
                const itemImage = resolveVariantPricing(oi.product, oi.selected_options || {}).image;
                return (
                  <View key={idx} style={styles.orderItem}>
                    {itemImage
                      ? <Image source={{ uri: itemImage }} style={styles.orderItemImg}/>
                      : <View style={styles.orderItemImgPlaceholder}><Feather name="image" size={14} color={COLORS.textMuted}/></View>
                    }
                    <View style={{ flex:1 }}>
                      <Text style={styles.orderItemName} numberOfLines={1}>{oi.product?.product_name || '—'}</Text>
                      {oi.selected_options && Object.keys(oi.selected_options).length > 0 && (
                        <Text style={styles.orderItemOptions} numberOfLines={1}>
                          {Object.entries(oi.selected_options).map(([k,v]) => `${k}: ${v}`).join(' · ')}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.orderItemQtyPrice}>x{oi.qty || oi.quantity || 0} · ₱{(Number(oi.price || 0) * Number(oi.qty || oi.quantity || 0)).toFixed(2)}</Text>
                  </View>
                );
              })}
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
                      +₱{Number(item.shipping_fee || 0).toFixed(2)} shipping
                    </Text>
                  )}
                  {(item.shipping_fee === 0) && (
                    <Text style={{ fontSize: 11, color: COLORS.primary }}>FREE shipping</Text>
                  )}
                  <Text style={styles.orderTotal}>₱{Number(item.total || 0).toFixed(2)}</Text>
                  {/* "Buy Again" — a single item re-fetches it fresh (current
                      price/stock, not the order's stale snapshot) and opens
                      it directly; more than one opens a picker so you choose
                      which product to buy again. See handleBuyAgain above. */}
                  {item.status === 'completed' && (() => {
                    const eligible = (item.order_item || []).filter(oi => oi.product_id);
                    if (eligible.length === 0) return null;
                    const single = eligible.length === 1;
                    const busy = single && buyingAgainId === (eligible[0].order_item_id || eligible[0].product_id);
                    return (
                      <TouchableOpacity
                        style={[styles.buyAgainBtn, { alignSelf: 'flex-end' }, busy && { opacity: 0.6 }]}
                        activeOpacity={0.8}
                        disabled={busy}
                        onPress={() => single ? handleBuyAgain(eligible[0], item.branch_id) : setBuyAgainPickerOrder(item)}
                      >
                        {busy
                          ? <ActivityIndicator size="small" color={COLORS.primary} />
                          : <Text style={styles.buyAgainBtnText}>Buy Again</Text>
                        }
                      </TouchableOpacity>
                    );
                  })()}
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
                    {item.payment.payment_method?.replace(/_/g,' ')} · {item.status?.replace(/_/g,' ')}
                  </Text>
                </View>
              )}

              {/* Bottom-right action button — Mark as Received / Cancel Order */}
              {(item.status === 'out_for_delivery' || getCancelWindow(item).canCancel) && (
                <View style={styles.cardActionRow}>
                  {item.status === 'out_for_delivery' && (
                    <TouchableOpacity
                      style={[styles.cardReceivedBtn, markingReceived && { opacity: 0.7 }]}
                      onPress={() => markAsReceived(item.order_id)}
                      disabled={markingReceived}
                      activeOpacity={0.8}
                    >
                      {markingReceived
                        ? <ActivityIndicator color={COLORS.white} size="small" />
                        : <>
                            <Feather name="check-circle" size={13} color={COLORS.white} />
                            <Text style={styles.cardReceivedBtnText}>Order Received</Text>
                          </>
                      }
                    </TouchableOpacity>
                  )}

                  {getCancelWindow(item).canCancel && (
                    <TouchableOpacity
                      style={styles.cardCancelBtn}
                      onPress={() => { setSelectedOrder(item); setShowCancelModal(true); }}
                      activeOpacity={0.8}
                    >
                      <Feather name="x-circle" size={13} color="#ef4444" />
                      <Text style={styles.cardCancelBtnText}>Cancel Order</Text>
                    </TouchableOpacity>
                  )}
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

              {/* Shopee-Style Progress Tracker */}
              <View style={styles.trackerWrap}>
                {[
                  { key:'pending',          label:'Pending',     icon:'clock'      },
                  { key:'processing',       label:'Processing',  icon:'settings'   },
                  { key:'out_for_delivery', label:'On the Way',  icon:'truck'      },
                  { key:'completed',        label:'Completed',   icon:'check-circle'},
                ].map((step, i, arr) => {
                  const statuses   = ['pending','processing','out_for_delivery','completed'];
                  const curIdx     = statuses.indexOf(selectedOrder?.status === 'cancelled' ? 'pending' : selectedOrder?.status);
                  const stepIdx    = statuses.indexOf(step.key);
                  const isDone     = curIdx >= stepIdx;
                  const isCurrent  = curIdx === stepIdx;
                  const isCancelled = selectedOrder?.status === 'cancelled';
                  const color      = isCancelled ? '#ef4444' : isDone ? COLORS.primary : COLORS.grayBorder;
                  return (
                    <View key={step.key} style={styles.trackerStep}>
                      {i > 0 && (
                        <View style={[styles.trackerLine, { backgroundColor: isCancelled ? '#ef4444' : (curIdx >= stepIdx ? COLORS.primary : COLORS.grayBorder) }]}/>
                      )}
                      <View style={[styles.trackerDot, { backgroundColor: isDone || isCancelled ? color : COLORS.surface, borderColor: color }]}>
                        <Feather name={isCancelled && i === 0 ? 'x' : step.icon} size={12} color={isDone ? COLORS.white : color}/>
                      </View>
                      <Text style={[styles.trackerLabel, { color: isCurrent ? COLORS.primary : COLORS.textMuted, fontWeight: isCurrent ? '700' : '400' }]}>
                        {isCancelled && i === 0 ? 'Cancelled' : step.label}
                      </Text>
                    </View>
                  );
                })}
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
                {(() => {
                  const branchObj  = Array.isArray(selectedOrder?.branch) ? selectedOrder?.branch[0] : selectedOrder?.branch;
                  const branchName = branchObj?.branch_name || selectedOrder?.branch_name;
                  return branchName ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Branch</Text>
                      <Text style={styles.detailValue}>{branchName}</Text>
                    </View>
                  ) : null;
                })()}
                {selectedOrder?.status === 'cancelled' && selectedOrder?.cancel_reason && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cancellation Reason</Text>
                    <Text style={[styles.detailValue, { color:'#ef4444' }]}>{selectedOrder.cancel_reason}</Text>
                  </View>
                )}
              </View>

              {/* Items */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Items Ordered</Text>
                {(selectedOrder?.order_item || []).map((oi, idx) => {
                  const itemImage = resolveVariantPricing(oi.product, oi.selected_options || {}).image;
                  return (
                    <View key={idx} style={styles.detailItemRow}>
                      {itemImage
                        ? <Image source={{ uri: itemImage }} style={styles.detailItemImg}/>
                        : <View style={styles.detailItemImgPlaceholder}><Feather name="image" size={16} color={COLORS.textMuted}/></View>
                      }
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
                      <Text style={styles.detailItemPrice}>₱{(Number(oi.price || 0) * Number(oi.qty || oi.quantity || 0)).toFixed(2)}</Text>
                    </View>
                  );
                })}
                {selectedOrder?.shipping_fee != null && (
                  <View style={[styles.detailItemRow, { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailItemName}>Shipping Fee</Text>
                    </View>
                    <Text style={[styles.detailItemPrice, {
                      color: selectedOrder.shipping_fee === 0 ? COLORS.primary : COLORS.dark
                    }]}>
                      {Number(selectedOrder.shipping_fee || 0) === 0 ? 'FREE' : `₱${Number(selectedOrder.shipping_fee || 0).toFixed(2)}`}
                    </Text>
                  </View>
                )}
                <View style={styles.detailTotalRow}>
                  <Text style={styles.detailTotalLabel}>Total</Text>
                  <Text style={styles.detailTotalValue}>₱{Number(selectedOrder?.total || 0).toFixed(2)}</Text>
                </View>
              </View>

              {/* Payment */}
              {selectedOrder?.payment && (() => {
                const pmt    = Array.isArray(selectedOrder.payment) ? selectedOrder.payment[0] : selectedOrder.payment;
                const isGcash = pmt?.payment_method === 'gcash';
                return (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Payment</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Method</Text>
                      <Text style={styles.detailValue}>{pmt?.payment_method?.replace(/_/g,' ')}</Text>
                    </View>

                    {isGcash && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={[styles.detailValue, pmt?.status === 'paid' && { color: COLORS.primary, fontWeight:'700' }]}>
                          {pmt?.status === 'paid' ? 'Paid (Verified)' : pmt?.status}
                        </Text>
                      </View>
                    )}

                    {pmt?.ref_no && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{isGcash ? 'PayMongo Reference' : 'Ref No.'}</Text>
                        <Text style={styles.detailValue}>{pmt.ref_no}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}

            </ScrollView>

            {/* Mark as Order Received Button */}
            {selectedOrder?.status === 'out_for_delivery' && (
              <TouchableOpacity
                style={[styles.receivedBtn, markingReceived && { opacity: 0.7 }]}
                onPress={() => markAsReceived(selectedOrder.order_id)}
                disabled={markingReceived}
                activeOpacity={0.85}
              >
                {markingReceived
                  ? <ActivityIndicator color={COLORS.white} />
                  : <>
                      <Feather name="check-circle" size={18} color={COLORS.white} />
                      <Text style={styles.receivedBtnText}>Mark as Order Received</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            {/* Cancel Order Button — pending + within 2hr window only */}
            {selectedOrder && getCancelWindow(selectedOrder).canCancel && (
              <View style={{ marginBottom: SPACING.sm }}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowCancelModal(true)}
                  activeOpacity={0.85}
                >
                  <Feather name="x-circle" size={18} color="#ef4444" />
                  <Text style={styles.cancelBtnText}>Cancel Order</Text>
                </TouchableOpacity>
                <Text style={styles.cancelWindowText}>
                  You can cancel for {formatRemaining(getCancelWindow(selectedOrder).msRemaining)} more
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Cancel Reason Modal ─── */}
      <Modal
        visible={showCancelModal}
        animationType="fade"
        transparent
        onRequestClose={() => !cancelling && setShowCancelModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.cancelModalOverlay}
        >
          <View style={styles.cancelModalCard}>
            <Text style={styles.cancelModalTitle}>Cancel this order?</Text>
            <Text style={styles.cancelModalSub}>
              Let us know why (optional). Your items and payment will be refunded/returned.
            </Text>

            <View style={{ gap: 8 }}>
              {CANCEL_REASON_OPTIONS.map(opt => {
                const selected = cancelReasonChoice === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.cancelReasonRow, selected && styles.cancelReasonRowSelected]}
                    onPress={() => setCancelReasonChoice(opt)}
                    disabled={cancelling}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.cancelReasonRadio, selected && styles.cancelReasonRadioSelected]}>
                      {selected && <View style={styles.cancelReasonRadioDot}/>}
                    </View>
                    <Text style={[styles.cancelReasonRowText, selected && styles.cancelReasonRowTextSelected]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {cancelReasonChoice === 'Other' && (
              <TextInput
                style={styles.cancelReasonInput}
                placeholder="Please specify..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={cancelReasonOther}
                onChangeText={setCancelReasonOther}
                editable={!cancelling}
                autoFocus
              />
            )}

            <View style={styles.cancelModalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelModalBtn, styles.cancelModalBtnGhost]}
                onPress={() => { setShowCancelModal(false); setCancelReasonChoice(null); setCancelReasonOther(''); }}
                disabled={cancelling}
              >
                <Text style={styles.cancelModalBtnGhostText}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelModalBtn, styles.cancelModalBtnSolid, cancelling && { opacity: 0.7 }]}
                onPress={() => cancelOrder(selectedOrder.order_id)}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator color={COLORS.white} size="small" />
                  : <Text style={styles.cancelModalBtnSolidText}>Yes, Cancel</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Buy Again — item picker (multi-item orders only) ─── */}
      <Modal
        visible={!!buyAgainPickerOrder}
        animationType="slide"
        transparent
        onRequestClose={() => setBuyAgainPickerOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buy Again</Text>
              <TouchableOpacity onPress={() => setBuyAgainPickerOrder(null)}>
                <Feather name="x" size={20} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {((buyAgainPickerOrder?.order_item || []).filter(oi => oi.product_id)).map((oi, idx) => {
                const itemImage = resolveVariantPricing(oi.product, oi.selected_options || {}).image;
                const busy = buyingAgainId === (oi.order_item_id || oi.product_id);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.buyAgainPickRow, busy && { opacity: 0.6 }]}
                    activeOpacity={0.8}
                    disabled={busy}
                    onPress={() => {
                      const branchId = buyAgainPickerOrder.branch_id;
                      setBuyAgainPickerOrder(null);
                      handleBuyAgain(oi, branchId);
                    }}
                  >
                    {itemImage
                      ? <Image source={{ uri: itemImage }} style={styles.buyAgainPickImg}/>
                      : <View style={styles.buyAgainPickImgPlaceholder}><Feather name="image" size={16} color={COLORS.textMuted}/></View>
                    }
                    <View style={{ flex:1 }}>
                      <Text style={styles.buyAgainPickName} numberOfLines={1}>{oi.product?.product_name || '—'}</Text>
                      {oi.selected_options && Object.keys(oi.selected_options).length > 0 && (
                        <Text style={styles.buyAgainPickOptions} numberOfLines={1}>
                          {Object.entries(oi.selected_options).map(([k,v]) => `${k}: ${v}`).join(' · ')}
                        </Text>
                      )}
                    </View>
                    {busy
                      ? <ActivityIndicator size="small" color={COLORS.primary} />
                      : <Feather name="chevron-right" size={18} color={COLORS.textMuted}/>
                    }
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert config={alertConfig} onHide={hideAlert}/>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container:        { flex:1, backgroundColor: COLORS.grayBg },
  // Header — COLORS.primary so it matches the bottom nav's active-tab
  // green (and HomeScreen's header) instead of drifting to its own shade.
  header:           { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md, shadowColor: '#14532d', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerTitle:      { fontSize:18, fontWeight:'700', color: COLORS.white },

  // Flat segmented tab bar
  tabFlat:          { paddingHorizontal:10, paddingVertical:10, alignItems:'center' },
  tabFlatText:      { fontSize:13, fontWeight:'500', color: COLORS.textMuted },
  tabFlatTextActive:{ color: COLORS.primary, fontWeight:'700' },
  tabFlatUnderline: { height:3, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignSelf:'stretch', marginTop:4 },
  tabFlatDivider:   { width:1, height:16, backgroundColor: COLORS.grayBorder },
  headerSub:        { fontSize:12, color: COLORS.grayLight, marginTop:2 },
  list:             { padding: SPACING.md, gap: SPACING.sm },
  orderCard:        { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm, gap: SPACING.sm },
  orderHeader:      { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  orderId:          { fontSize:13, fontWeight:'700', color: COLORS.dark },
  orderDate:        { fontSize:11, color: COLORS.textMuted, marginTop:2 },
  statusBadge:      { borderRadius: RADIUS.full, paddingHorizontal:10, paddingVertical:4 },
  statusText:       { fontSize:10, fontWeight:'700' },
  divider:          { height:1, backgroundColor: COLORS.grayBorder },
  orderItemImg:            { width:40, height:40, borderRadius:8, marginRight:10, backgroundColor:COLORS.border },
  orderItemImgPlaceholder:  { width:40, height:40, borderRadius:8, marginRight:10, backgroundColor:COLORS.surface, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:COLORS.border },
  detailItemImg:            { width:50, height:50, borderRadius:10, marginRight:12, backgroundColor:COLORS.border },
  detailItemImgPlaceholder: { width:50, height:50, borderRadius:10, marginRight:12, backgroundColor:COLORS.surface, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:COLORS.border },
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
  modalCard:            { backgroundColor: COLORS.surface, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'90%', padding: SPACING.md },
  modalHeader:          { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  modalTitle:           { fontSize:16, fontWeight:'700', color: COLORS.dark },
  modalOrderId:         { fontSize:12, color: COLORS.textMuted, marginTop:2 },

  // Buy Again — item picker rows
  buyAgainPickRow:            { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  buyAgainPickImg:            { width:44, height:44, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg },
  buyAgainPickImgPlaceholder: { width:44, height:44, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg, alignItems:'center', justifyContent:'center' },
  buyAgainPickName:           { fontSize:13, fontWeight:'600', color: COLORS.dark },
  buyAgainPickOptions:        { fontSize:11, color: COLORS.textMuted, marginTop:2 },
  detailSection:        { marginBottom: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth:1, borderBottomColor: COLORS.grayBorder },
  detailSectionTitle:   { fontSize:13, fontWeight:'700', color: COLORS.dark, marginBottom: SPACING.sm },
  detailRow:            { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  detailLabel:          { fontSize:13, color: COLORS.textMuted },
  detailValue:          { fontSize:13, color: COLORS.dark, fontWeight:'500', flex:1, textAlign:'right', textTransform:'capitalize' },
  trackerWrap:       { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingHorizontal:8, paddingVertical:16, marginBottom:8 },
  trackerStep:       { alignItems:'center', flex:1, position:'relative' },
  trackerLine:       { position:'absolute', top:12, right:'50%', left:'-50%', height:2, zIndex:0 },
  trackerDot:        { width:26, height:26, borderRadius:13, borderWidth:2, alignItems:'center', justifyContent:'center', zIndex:1, marginBottom:6 },
  trackerLabel:      { fontSize:9, textAlign:'center', lineHeight:12 },
  receivedBtn:       { backgroundColor:COLORS.primary, borderRadius:RADIUS.sm, padding:14, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8, marginBottom:SPACING.sm },
  receivedBtnText:   { color:COLORS.white, fontWeight:'700', fontSize:14 },
  optionChip:           { backgroundColor:'rgba(22,163,74,0.1)', borderRadius:4, paddingHorizontal:6, paddingVertical:2 },
  optionChipText:       { fontSize:10, color: COLORS.primary, fontWeight:'600' },
  buyAgainBtn:          { flexDirection:'row', alignItems:'center', gap:5, alignSelf:'flex-start', borderWidth:1.5, borderColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical:5, paddingHorizontal:12, marginTop:8 },
  buyAgainBtnText:      { fontSize:11, color: COLORS.primary, fontWeight:'700' },
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

  // Card action row — bottom-right, compact pill buttons
  cardActionRow:         { flexDirection:'row', justifyContent:'flex-end', marginTop:8 },
  cardReceivedBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical:7, paddingHorizontal:14, flexDirection:'row', alignItems:'center', gap:5 },
  cardReceivedBtnText:   { fontSize:12, color: COLORS.white, fontWeight:'700' },
  cardCancelBtn:         { borderWidth:1.5, borderColor:'#ef4444', borderRadius: RADIUS.full, paddingVertical:7, paddingHorizontal:14, flexDirection:'row', alignItems:'center', gap:5 },
  cardCancelBtnText:     { fontSize:12, color:'#ef4444', fontWeight:'700' },
  cancelBtn:            { borderWidth:1.5, borderColor:'#ef4444', borderRadius: RADIUS.sm, padding:14, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 },
  cancelBtnText:         { color:'#ef4444', fontWeight:'700', fontSize:14 },
  cancelWindowText:      { fontSize:11, color: COLORS.textMuted, textAlign:'center', marginTop:6 },
  cancelModalOverlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding: SPACING.lg },
  cancelModalCard:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.lg, width:'100%', gap: SPACING.sm },
  cancelModalTitle:      { fontSize:16, fontWeight:'700', color: COLORS.dark },
  cancelModalSub:        { fontSize:12, color: COLORS.textMuted, lineHeight:17 },
  cancelReasonInput:     { borderWidth:1, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, padding:10, fontSize:13, color: COLORS.dark, minHeight:70, textAlignVertical:'top' },
  cancelReasonRow:          { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, paddingHorizontal:12, paddingVertical:11 },
  cancelReasonRowSelected:  { borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.06)' },
  cancelReasonRowText:      { fontSize:13, color: COLORS.textSecondary, flex:1 },
  cancelReasonRowTextSelected: { color: COLORS.dark, fontWeight:'600' },
  cancelReasonRadio:        { width:18, height:18, borderRadius:9, borderWidth:1.5, borderColor: COLORS.grayBorder, alignItems:'center', justifyContent:'center' },
  cancelReasonRadioSelected:{ borderColor:'#ef4444' },
  cancelReasonRadioDot:     { width:9, height:9, borderRadius:4.5, backgroundColor:'#ef4444' },
  cancelModalBtnRow:     { flexDirection:'row', gap: SPACING.sm, marginTop: SPACING.xs },
  cancelModalBtn:        { flex:1, borderRadius: RADIUS.sm, padding:13, alignItems:'center', justifyContent:'center' },
  cancelModalBtnGhost:   { borderWidth:1.5, borderColor: COLORS.grayBorder },
  cancelModalBtnGhostText: { color: COLORS.textSecondary, fontWeight:'700', fontSize:13 },
  cancelModalBtnSolid:     { backgroundColor:'#ef4444' },
  cancelModalBtnSolidText: { color: COLORS.white, fontWeight:'700', fontSize:13 },
});
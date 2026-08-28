import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  FlatList, Image, Alert, ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getCart, updateCartItem, removeFromCart } from '../services/cartService';
import api from '../services/api';
import { isLoggedIn } from '../services/authService';
import { useCart } from '../utils/CartContext';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

export default function CartScreen({ navigation }) {
  const [cart,       setCart]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loggedIn,   setLoggedIn]   = useState(false);
  const [selected,   setSelected]   = useState({}); // { cart_id: true/false }

  const { refreshCartCount } = useCart();

  // useFocusEffect — runs every time screen comes into focus
  // This ensures cart refreshes when navigating back from HomeScreen
  useFocusEffect(
    useCallback(() => {
      isLoggedIn().then(logged => {
        setLoggedIn(logged);
        if (logged) loadCart();
        else setLoading(false);
      });
    }, [])
  );

  async function loadCart() {
    try {
      const data = await getCart();
      console.log('Cart data:', JSON.stringify(data?.slice(0,1)));

      // Normalize — handle product as array or object
      const normalized = (data || []).map(item => ({
        ...item,
        product: Array.isArray(item.product)
          ? (item.product[0] || null)
          : (item.product || null),
      }));

      setCart(normalized);
      // Default: all items selected
      const sel = {};
      normalized.forEach(item => { sel[item.cart_id] = true; });
      setSelected(sel);
      // Sync global cart count badge
      refreshCartCount();
    } catch (e) {
      console.error('Cart error:', e);
      Alert.alert('Error', 'Failed to load cart. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Selection Logic ──────────────────────────────────
  const allChecked   = cart.length > 0 && cart.every(i => selected[i.cart_id]);
  const someChecked  = cart.some(i => selected[i.cart_id]);
  const selectedItems = cart.filter(i => selected[i.cart_id]);

  function toggleAll() {
    const newVal = !allChecked;
    const sel = {};
    cart.forEach(i => { sel[i.cart_id] = newVal; });
    setSelected(sel);
  }

  function toggleItem(cartId) {
    setSelected(prev => ({ ...prev, [cartId]: !prev[cartId] }));
  }

  // ─── Total (selected items only) ─────────────────────
  const total = selectedItems.reduce(
    (s, i) => {
    const p = Array.isArray(i.product) ? i.product[0] : i.product;
    const disc = Array.isArray(p?.discount) ? p.discount[0] : p?.discount;
    const fp = disc ? Number(p?.price || 0) * (1 - Number(disc.percentage || 0) / 100) : Number(p?.price || 0);
    return s + fp * i.quantity;
  }, 0
  );

  // ─── Quantity Update ──────────────────────────────────
  async function handleUpdateQty(cartId, qty, maxStock) {
    if (qty < 1) { handleRemove(cartId); return; }
    if (maxStock && qty > maxStock) {
      Alert.alert('Maximum Stock', `Only ${maxStock} unit(s) available.`);
      return;
    }
    try {
      await updateCartItem(cartId, qty);
      setCart(prev => prev.map(i => i.cart_id === cartId ? { ...i, quantity: qty } : i));
    } catch (e) {
      Alert.alert('Error', 'Failed to update quantity.');
    }
  }

  function handleQtyInputCart(cartId, val, maxStock) {
    const num = parseInt(val.replace(/[^0-9]/g, '')) || 1;
    if (num > maxStock) {
      Alert.alert('Maximum Stock', `Only ${maxStock} unit(s) available.`);
      handleUpdateQty(cartId, maxStock, maxStock);
    } else {
      handleUpdateQty(cartId, num, maxStock);
    }
  }

  // ─── Update Cart Item Options ────────────────────────
  async function updateCartItemOptions(cartId, options) {
    await api.put(`/cart/${cartId}`, { selected_options: options });
  }

  // ─── Remove ───────────────────────────────────────────
  async function handleRemove(cartId) {
    Alert.alert('Remove Item', 'Remove this item from your cart?', [
      { text: 'Cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await removeFromCart(cartId);
            setCart(prev => prev.filter(i => i.cart_id !== cartId));
            setSelected(prev => {
              const s = { ...prev };
              delete s[cartId];
              return s;
            });
          } catch (e) {
            Alert.alert('Error', 'Failed to remove item.');
          }
        }
      }
    ]);
  }

  // ─── Checkout ─────────────────────────────────────────
  function handleCheckout() {
    if (!someChecked) return;
    navigation.navigate('Checkout', {
      cartItems: selectedItems,
      total,
    });
  }

  // ─── Not Logged In ────────────────────────────────────
  if (!loggedIn) return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>My Cart</Text></View>
      <View style={styles.emptyWrap}>
        <Feather name="lock" size={48} color={COLORS.grayLight}/>
        <Text style={styles.emptyTitle}>Please log in</Text>
        <Text style={styles.emptyText}>You need to be logged in to view your cart.</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.actionBtnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return (
    <View style={[styles.container, styles.centered]}>
      <ActivityIndicator color={COLORS.primary} size="large"/>
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Cart</Text>
        {cart.length > 0 && (
          <Text style={styles.headerSub}>{cart.length} item(s)</Text>
        )}
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="shopping-cart" size={56} color={COLORS.grayLight}/>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>Add products to get started.</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.actionBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Select All Row */}
          <TouchableOpacity style={styles.selectAllRow} onPress={toggleAll} activeOpacity={0.7}>
            <View style={[styles.checkbox, allChecked && styles.checkboxChecked]}>
              {allChecked && <Feather name="check" size={12} color={COLORS.white}/>}
              {!allChecked && someChecked && (
                <View style={styles.checkboxPartial}/>
              )}
            </View>
            <Text style={styles.selectAllText}>
              {allChecked ? 'Deselect All' : 'Select All'}
            </Text>
            <Text style={styles.selectAllCount}>
              {selectedItems.length}/{cart.length} selected
            </Text>
          </TouchableOpacity>

          {/* Cart Items */}
          <FlatList
            data={cart}
            keyExtractor={item => item.cart_id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onRefresh={loadCart}
            refreshing={loading}
            renderItem={({ item }) => {
              const isSelected = !!selected[item.cart_id];
              // Safely get product — handle array or object from Supabase
              const product    = Array.isArray(item.product) ? item.product[0] : item.product;
              const price      = Number(product?.price || 0);

              // Discounted price if applicable
              const disc       = Array.isArray(product?.discount) ? product.discount[0] : product?.discount;
              const finalPrice = disc
                ? price * (1 - Number(disc.percentage || 0) / 100)
                : price;
              const finalSub   = finalPrice * item.quantity;

              return (
                <TouchableOpacity
                  style={[styles.cartItem, isSelected && styles.cartItemSelected]}
                  onPress={() => toggleItem(item.cart_id)}
                  activeOpacity={0.85}
                >
                  {/* Checkbox */}
                  <TouchableOpacity
                    style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                    onPress={() => toggleItem(item.cart_id)}
                  >
                    {isSelected && <Feather name="check" size={12} color={COLORS.white}/>}
                  </TouchableOpacity>

                  {/* Product Image */}
                  {product?.image_url
                    ? <Image source={{ uri: product.image_url }} style={styles.itemImg} resizeMode="cover"/>
                    : <View style={styles.itemImgPlaceholder}>
                        <Feather name="shopping-bag" size={22} color={COLORS.primary}/>
                      </View>
                  }

                  {/* Item Info */}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {product?.product_name || '—'}
                    </Text>
                    {product?.brand
                      ? <Text style={styles.itemBrand}>{product.brand}</Text>
                      : null
                    }

                    {/* Selected Options + Edit Button */}
                    {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                      <TouchableOpacity
                        style={styles.optionEditBtn}
                        onPress={() => {
                          setEditItem(item);
                          setEditOptions(item.selected_options || {});
                        }}
                      >
                        <Text style={styles.optionEditText}>
                          {Object.entries(item.selected_options).map(([k,v]) => `${k}: ${v}`).join(' · ')}
                        </Text>
                        <Feather name="chevron-down" size={11} color={COLORS.primary}/>
                      </TouchableOpacity>
                    )}

                    {/* Price */}
                    {disc ? (
                      <View style={styles.priceRow}>
                        <Text style={styles.itemPriceOriginal}>₱{price.toFixed(2)}</Text>
                        <Text style={styles.itemPriceDiscount}>₱{finalPrice.toFixed(2)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.itemPrice}>₱{price.toFixed(2)}</Text>
                    )}

                    {/* Quantity Controls */}
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleUpdateQty(item.cart_id, item.quantity - 1, item.product?.quantity)}
                      >
                        <Feather name="minus" size={13} color={COLORS.dark}/>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyInput}
                        value={String(item.quantity)}
                        onChangeText={v => handleQtyInputCart(item.cart_id, v, item.product?.quantity)}
                        keyboardType="number-pad"
                        maxLength={4}
                        selectTextOnFocus
                      />
                      <TouchableOpacity
                        style={[styles.qtyBtn, item.quantity >= item.product?.quantity && styles.qtyBtnDisabled]}
                        onPress={() => handleUpdateQty(item.cart_id, item.quantity + 1, item.product?.quantity)}
                        disabled={item.quantity >= item.product?.quantity}
                      >
                        <Feather name="plus" size={13} color={item.quantity >= item.product?.quantity ? COLORS.grayLight : COLORS.dark}/>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemove(item.cart_id)}
                      >
                        <Feather name="trash-2" size={14} color="#ef4444"/>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Item Subtotal */}
                  <Text style={styles.itemTotal}>₱{finalSub.toFixed(2)}</Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Footer */}
          <View style={styles.footer}>
            {/* Selected count */}
            <View style={styles.footerInfo}>
              <Text style={styles.footerCount}>
                {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
              </Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalVal}>₱{total.toFixed(2)}</Text>
              </View>
            </View>

            {/* Checkout Button */}
            <TouchableOpacity
              style={[styles.checkoutBtn, !someChecked && styles.checkoutBtnDisabled]}
              onPress={handleCheckout}
              disabled={!someChecked}
              activeOpacity={0.85}
            >
              <Feather name="credit-card" size={18} color={COLORS.white}/>
              <Text style={styles.checkoutBtnText}>
                Checkout ({selectedItems.length})
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      {/* ─── Edit Options Modal ─── */}
      <Modal
        visible={!!editItem}
        animationType="slide"
        transparent
        onRequestClose={() => setEditItem(null)}
      >
        <View style={styles.optModalOverlay}>
          <View style={styles.optModalCard}>
            <View style={styles.optModalHeader}>
              <Text style={styles.optModalTitle}>Edit Options</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Feather name="x" size={20} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>

            {/* Product name */}
            <Text style={styles.optModalProduct} numberOfLines={1}>
              {Array.isArray(editItem?.product) ? editItem.product[0]?.product_name : editItem?.product?.product_name}
            </Text>

            {/* Option Groups */}
            {(editItem?.product?.option_groups || []).map((group, gi) => (
              <View key={gi} style={styles.optGroup}>
                <Text style={styles.optGroupLabel}>{group.label}</Text>
                <View style={styles.optChoicesRow}>
                  {group.choices.map((choice, ci) => {
                    const isSelected = editOptions[group.label] === choice;
                    return (
                      <TouchableOpacity
                        key={ci}
                        style={[styles.optChip, isSelected && styles.optChipSelected]}
                        onPress={() => setEditOptions(prev => ({ ...prev, [group.label]: choice }))}
                      >
                        <Text style={[styles.optChipText, isSelected && styles.optChipTextSelected]}>
                          {choice}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.optConfirmBtn}
              onPress={async () => {
                if (editItem) {
                  // Update selected_options via API
                  try {
                    await updateCartItemOptions(editItem.cart_id, editOptions);
                    setCart(prev => prev.map(i =>
                      i.cart_id === editItem.cart_id
                        ? { ...i, selected_options: editOptions }
                        : i
                    ));
                    setEditItem(null);
                  } catch (e) {
                    Alert.alert('Error', 'Failed to update options.');
                  }
                }
              }}
            >
              <Text style={styles.optConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: COLORS.grayBg },
  centered:            { justifyContent: 'center', alignItems: 'center' },

  // Header
  header:              { backgroundColor: COLORS.dark, paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  headerTitle:         { fontSize: 18, fontWeight: '700', color: COLORS.white },
  headerSub:           { fontSize: 12, color: COLORS.grayLight, marginTop: 2 },

  // Select All
  selectAllRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  selectAllText:       { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.dark },
  selectAllCount:      { fontSize: 12, color: COLORS.textMuted },

  // Checkbox
  checkbox:            { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.grayBorder, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxPartial:     { width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.primary },

  // Cart List
  list:                { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 0 },
  cartItem:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.sm, ...SHADOW.sm, borderWidth: 1.5, borderColor: 'transparent' },
  cartItemSelected:    { borderColor: COLORS.primary },

  // Item
  itemImg:             { width: 65, height: 65, borderRadius: RADIUS.sm },
  itemImgPlaceholder:  { width: 65, height: 65, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },
  itemInfo:            { flex: 1 },
  itemName:            { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 2 },
  itemBrand:           { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  itemPrice:           { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  priceRow:            { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  itemPriceOriginal:   { fontSize: 10, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  itemPriceDiscount:   { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  itemTotal:           { fontSize: 13, fontWeight: '700', color: COLORS.dark, minWidth: 60, textAlign: 'right' },

  // Qty Controls
  qtyRow:              { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn:              { width: 26, height: 26, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg, borderWidth: 1, borderColor: COLORS.grayBorder, alignItems: 'center', justifyContent: 'center' },
  qtyVal:              { fontSize: 13, fontWeight: '700', color: COLORS.dark, minWidth: 20, textAlign: 'center' },
  removeBtn:           { marginLeft: 4, padding: 4 },

  // Footer
  footer:              { backgroundColor: COLORS.white, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.grayBorder, gap: SPACING.sm },
  footerInfo:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerCount:         { fontSize: 12, color: COLORS.textMuted },
  totalRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalLabel:          { fontSize: 14, color: COLORS.textSecondary },
  totalVal:            { fontSize: 20, fontWeight: '700', color: COLORS.dark },
  checkoutBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkoutBtnDisabled: { backgroundColor: COLORS.grayLight },
  checkoutBtnText:     { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  // Empty
  optionEditBtn:    { flexDirection:'row', alignItems:'center', gap:4, marginTop:4, backgroundColor:'rgba(22,163,74,0.08)', borderRadius:6, paddingHorizontal:8, paddingVertical:4, alignSelf:'flex-start', borderWidth:1, borderColor:'rgba(22,163,74,0.2)' },
  optionEditText:   { fontSize:11, color: COLORS.primary, fontWeight:'600', flex:1 },
  optModalOverlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  optModalCard:     { backgroundColor: COLORS.white, borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, maxHeight:'80%' },
  optModalHeader:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  optModalTitle:    { fontSize:16, fontWeight:'700', color: COLORS.dark },
  optModalProduct:  { fontSize:13, color: COLORS.textMuted, marginBottom:16 },
  optGroup:         { marginBottom:16 },
  optGroupLabel:    { fontSize:13, fontWeight:'700', color: COLORS.dark, marginBottom:8 },
  optChoicesRow:    { flexDirection:'row', flexWrap:'wrap', gap:8 },
  optChip:          { borderRadius:999, paddingHorizontal:14, paddingVertical:7, borderWidth:1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.white },
  optChipSelected:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optChipText:      { fontSize:13, color: COLORS.dark, fontWeight:'500' },
  optChipTextSelected: { color: COLORS.white, fontWeight:'700' },
  optConfirmBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding:14, alignItems:'center', marginTop:8 },
  optConfirmText:   { color: COLORS.white, fontWeight:'700', fontSize:14 },
  emptyWrap:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle:          { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  emptyText:           { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  actionBtn:           { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.sm },
  actionBtnText:       { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import { getCart, updateCartItem, removeFromCart } from '../services/cartService';
import { isLoggedIn } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

export default function CartScreen({ navigation }) {
  const [cart,     setCart]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    isLoggedIn().then(logged => {
      setLoggedIn(logged);
      if (logged) loadCart();
      else setLoading(false);
    });
  }, []);

  // Refresh cart every time screen is focused (e.g., after adding items)
  useFocusEffect(
    useCallback(() => {
      if (loggedIn) loadCart();
    }, [loggedIn])
  );

  async function loadCart() {
    try {
      const data = await getCart();
      setCart(data);
    } catch (e) {
      console.error('Cart error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateQty(cartId, qty) {
    if (qty < 1) {
      handleRemove(cartId);
      return;
    }
    try {
      await updateCartItem(cartId, qty);
      setCart(prev => prev.map(i => i.cart_id === cartId ? { ...i, quantity: qty } : i));
    } catch (e) { Alert.alert('Error', 'Failed to update quantity.'); }
  }

  async function handleRemove(cartId) {
    Alert.alert('Remove Item', 'Remove this item from your cart?', [
      { text: 'Cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFromCart(cartId);
            setCart(prev => prev.filter(i => i.cart_id !== cartId));
          } catch (e) { Alert.alert('Error', 'Failed to remove item.'); }
        }
      }
    ]);
  }

  const total = cart.reduce((s, i) => s + Number(i.product?.price || 0) * i.quantity, 0);

  if (!loggedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Feather name="lock" size={48} color={COLORS.grayLight}/>
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptyText}>You need to be logged in to view your cart.</Text>
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
          <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={item => item.cart_id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                {item.product?.image_url
                  ? <Image source={{ uri: item.product.image_url }} style={styles.itemImg} resizeMode="cover"/>
                  : <View style={styles.itemImgPlaceholder}>
                      <Feather name="shopping-bag" size={24} color={COLORS.primary}/>
                    </View>
                }
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.product?.product_name || '—'}</Text>
                  {item.product?.brand ? <Text style={styles.itemBrand}>{item.product.brand}</Text> : null}
                  <Text style={styles.itemPrice}>₱{Number(item.product?.price || 0).toFixed(2)}</Text>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => handleUpdateQty(item.cart_id, item.quantity - 1)}>
                      <Feather name="minus" size={14} color={COLORS.dark}/>
                    </TouchableOpacity>
                    <Text style={styles.qtyVal}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => handleUpdateQty(item.cart_id, item.quantity + 1)}>
                      <Feather name="plus" size={14} color={COLORS.dark}/>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.cart_id)}>
                      <Feather name="trash-2" size={14} color="#ef4444"/>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.itemTotal}>₱{(Number(item.product?.price || 0) * item.quantity).toFixed(2)}</Text>
              </View>
            )}
          />

          {/* Checkout Footer */}
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>₱{total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={() => navigation.navigate('Checkout', { cartItems: cart, total })}
            >
              <Feather name="credit-card" size={18} color={COLORS.white}/>
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex:1, backgroundColor: COLORS.grayBg },
  header:               { backgroundColor: COLORS.dark, paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  headerTitle:          { fontSize:18, fontWeight:'700', color: COLORS.white },
  headerSub:            { fontSize:12, color: COLORS.grayLight, marginTop:2 },
  list:                 { padding: SPACING.md, gap: SPACING.sm },
  cartItem:             { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.sm, flexDirection:'row', alignItems:'center', gap: SPACING.sm, ...SHADOW.sm },
  itemImg:              { width:70, height:70, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryBg },
  itemImgPlaceholder:   { width:70, height:70, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryBg, alignItems:'center', justifyContent:'center' },
  itemInfo:             { flex:1 },
  itemName:             { fontSize:13, fontWeight:'600', color: COLORS.dark, marginBottom:2 },
  itemBrand:            { fontSize:11, color: COLORS.textMuted, marginBottom:2 },
  itemPrice:            { fontSize:13, fontWeight:'700', color: COLORS.primary, marginBottom:6 },
  qtyRow:               { flexDirection:'row', alignItems:'center', gap:8 },
  qtyBtn:               { width:28, height:28, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg, borderWidth:1, borderColor: COLORS.grayBorder, alignItems:'center', justifyContent:'center' },
  qtyVal:               { fontSize:14, fontWeight:'700', color: COLORS.dark, minWidth:24, textAlign:'center' },
  removeBtn:            { marginLeft:4, padding:4 },
  itemTotal:            { fontSize:13, fontWeight:'700', color: COLORS.dark },
  emptyWrap:            { flex:1, alignItems:'center', justifyContent:'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle:           { fontSize:18, fontWeight:'700', color: COLORS.dark },
  emptyText:            { fontSize:13, color: COLORS.textSecondary, textAlign:'center' },
  shopBtn:              { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical:12, marginTop: SPACING.sm },
  shopBtnText:          { color: COLORS.white, fontWeight:'700', fontSize:14 },
  loginBtn:             { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical:12, marginTop: SPACING.sm },
  loginBtnText:         { color: COLORS.white, fontWeight:'700', fontSize:14 },
  footer:               { backgroundColor: COLORS.white, padding: SPACING.md, borderTopWidth:1, borderTopColor: COLORS.grayBorder, gap: SPACING.sm },
  totalRow:             { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  totalLabel:           { fontSize:14, color: COLORS.textSecondary },
  totalVal:             { fontSize:20, fontWeight:'700', color: COLORS.dark },
  checkoutBtn:          { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  checkoutBtnText:      { color: COLORS.white, fontWeight:'700', fontSize:15 },
});
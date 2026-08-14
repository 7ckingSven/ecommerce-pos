import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { addToCart } from '../services/cartService';
import { isLoggedIn } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';

// ─── Discount Helper ──────────────────────────────────
function getDiscountedPrice(product) {
  const disc = product.discount;
  if (!disc || !disc.percentage) return null;
  return product.price * (1 - disc.percentage / 100);
}

export default function ProductDetailScreen({ route, navigation }) {
  const { product }          = route.params;
  const [quantity, setQty]   = useState(1);
  const [loading, setLoading] = useState(false);

  const discountedPrice = getDiscountedPrice(product);
  const hasDiscount     = discountedPrice !== null;
  const effectivePrice  = hasDiscount ? discountedPrice : product.price;
  const disc            = product.discount;
  const inStock         = product.quantity > 0;

  function increment() { if (quantity < product.quantity) setQty(q => q + 1); }
  function decrement() { if (quantity > 1) setQty(q => q - 1); }

  async function handleAddToCart() {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      Alert.alert('Login Required', 'Please log in to add items to your cart.', [
        { text: 'Cancel' },
        { text: 'Log In', onPress: () => navigation.navigate('Login') }
      ]);
      return;
    }
    setLoading(true);
    try {
      // Pass discounted price so cart and order reflect correct amount
      await addToCart(product.product_id, quantity, effectivePrice);
      Alert.alert('Added to Cart', `${product.product_name} (x${quantity}) added to your cart.`, [
        { text: 'Continue Shopping' },
        { text: 'View Cart', onPress: () => navigation.navigate('Cart') }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to add to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>

      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Feather name="arrow-left" size={22} color={COLORS.white}/>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Product Image */}
        {product.image_url
          ? <Image source={{ uri: product.image_url }} style={styles.productImg} resizeMode="cover"/>
          : <View style={styles.productImgPlaceholder}>
              <Feather name="shopping-bag" size={60} color={COLORS.primary}/>
            </View>
        }

        <View style={styles.content}>

          {/* Category, Brand & Discount Badge */}
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{product.category}</Text>
            </View>
            {product.brand
              ? <View style={styles.tag}><Text style={styles.tagText}>{product.brand}</Text></View>
              : null
            }
            {hasDiscount && (
              <View style={styles.discountTag}>
                <Feather name="tag" size={10} color={COLORS.white} style={{ marginRight: 3 }}/>
                <Text style={styles.discountTagText}>{disc.discount_name} — {disc.percentage}% OFF</Text>
              </View>
            )}
          </View>

          {/* Product Name */}
          <Text style={styles.name}>{product.product_name}</Text>

          {/* Price Block */}
          {hasDiscount ? (
            <View style={styles.priceBlock}>
              <Text style={styles.originalPrice}>₱{Number(product.price).toFixed(2)}</Text>
              <Text style={styles.discountedPrice}>₱{discountedPrice.toFixed(2)}</Text>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>Save ₱{(product.price - discountedPrice).toFixed(2)}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.price}>₱{Number(product.price).toFixed(2)}</Text>
          )}

          {/* Stock */}
          <View style={styles.stockRow}>
            <Feather
              name={inStock ? 'check-circle' : 'x-circle'}
              size={14}
              color={inStock ? COLORS.primary : COLORS.error}
            />
            <Text style={[styles.stockText, { color: inStock ? COLORS.primary : COLORS.error }]}>
              {inStock ? `In Stock (${product.quantity} available)` : 'Out of Stock'}
            </Text>
          </View>

          {/* Description */}
          {product.description ? (
            <View style={styles.descWrap}>
              <Text style={styles.descTitle}>Description</Text>
              <Text style={styles.desc}>{product.description}</Text>
            </View>
          ) : null}

          {/* Quantity Selector */}
          {inStock && (
            <View style={styles.qtyWrap}>
              <Text style={styles.qtyLabel}>Quantity</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={decrement}>
                  <Feather name="minus" size={16} color={COLORS.dark}/>
                </TouchableOpacity>
                <Text style={styles.qtyVal}>{quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={increment}>
                  <Feather name="plus" size={16} color={COLORS.dark}/>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Total — uses effective (discounted) price */}
          {inStock && (
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total</Text>
                {hasDiscount && quantity > 1 && (
                  <Text style={styles.totalOriginal}>
                    Original: ₱{(product.price * quantity).toFixed(2)}
                  </Text>
                )}
              </View>
              <Text style={styles.totalVal}>₱{(effectivePrice * quantity).toFixed(2)}</Text>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Add to Cart Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cartBtn, !inStock && styles.cartBtnDisabled]}
          onPress={handleAddToCart}
          disabled={!inStock || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white}/>
          ) : (
            <View style={styles.cartBtnInner}>
              <Feather name="shopping-cart" size={18} color={COLORS.white}/>
              <Text style={styles.cartBtnText}>{inStock ? 'Add to Cart' : 'Out of Stock'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:             { flex:1, backgroundColor: COLORS.grayBg },
  backBtn:               { position:'absolute', top: SPACING.xl, left: SPACING.md, zIndex:10, backgroundColor:'rgba(0,0,0,0.4)', borderRadius: RADIUS.full, padding:8 },

  // Image
  productImg:            { width:'100%', height:280 },
  productImgPlaceholder: { width:'100%', height:280, backgroundColor: COLORS.primaryBg, alignItems:'center', justifyContent:'center' },

  content:               { padding: SPACING.md },

  // Tags row
  tagRow:                { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom: SPACING.sm },
  tag:                   { backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.full, paddingHorizontal:12, paddingVertical:4, borderWidth:1, borderColor: COLORS.primaryBorder },
  tagText:               { fontSize:11, fontWeight:'600', color: COLORS.primary },

  // Discount tag
  discountTag:           { flexDirection:'row', alignItems:'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal:10, paddingVertical:4 },
  discountTagText:       { fontSize:11, fontWeight:'700', color: COLORS.white },

  // Product name
  name:                  { fontSize:22, fontWeight:'700', color: COLORS.dark, marginBottom: SPACING.sm },

  // Price — no discount
  price:                 { fontSize:24, fontWeight:'700', color: COLORS.primary, marginBottom: SPACING.sm },

  // Price — with discount
  priceBlock:            { marginBottom: SPACING.sm },
  originalPrice:         { fontSize:15, color: COLORS.textMuted, textDecorationLine:'line-through', marginBottom:2 },
  discountedPrice:       { fontSize:26, fontWeight:'700', color: COLORS.primary, marginBottom:4 },
  savingsBadge:          { alignSelf:'flex-start', backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.sm, paddingHorizontal:10, paddingVertical:3, borderWidth:1, borderColor: COLORS.primaryBorder },
  savingsText:           { fontSize:12, fontWeight:'600', color: COLORS.primary },

  // Stock
  stockRow:              { flexDirection:'row', alignItems:'center', gap:6, marginBottom: SPACING.md },
  stockText:             { fontSize:13, fontWeight:'600' },

  // Description
  descWrap:              { marginBottom: SPACING.md },
  descTitle:             { fontSize:14, fontWeight:'700', color: COLORS.dark, marginBottom:6 },
  desc:                  { fontSize:13, color: COLORS.textSecondary, lineHeight:20 },

  // Quantity
  qtyWrap:               { marginBottom: SPACING.md },
  qtyLabel:              { fontSize:13, fontWeight:'600', color: COLORS.dark, marginBottom:8 },
  qtyRow:                { flexDirection:'row', alignItems:'center', gap: SPACING.md },
  qtyBtn:                { width:36, height:36, borderRadius: RADIUS.sm, backgroundColor: COLORS.white, borderWidth:1.5, borderColor: COLORS.grayBorder, alignItems:'center', justifyContent:'center', ...SHADOW.sm },
  qtyVal:                { fontSize:18, fontWeight:'700', color: COLORS.dark, minWidth:30, textAlign:'center' },

  // Total
  totalRow:              { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, ...SHADOW.sm, marginBottom: SPACING.xl },
  totalLabel:            { fontSize:14, fontWeight:'600', color: COLORS.textSecondary },
  totalOriginal:         { fontSize:11, color: COLORS.textMuted, textDecorationLine:'line-through', marginTop:2 },
  totalVal:              { fontSize:20, fontWeight:'700', color: COLORS.dark },

  // Footer
  footer:                { padding: SPACING.md, backgroundColor: COLORS.white, borderTopWidth:1, borderTopColor: COLORS.grayBorder },
  cartBtn:               { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding:14, alignItems:'center' },
  cartBtnDisabled:       { backgroundColor: COLORS.grayLight },
  cartBtnInner:          { flexDirection:'row', alignItems:'center', gap:8 },
  cartBtnText:           { color: COLORS.white, fontWeight:'700', fontSize:15 },
});
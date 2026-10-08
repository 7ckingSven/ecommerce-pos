import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, Alert, ActivityIndicator, FlatList, Dimensions,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import { isLoggedIn } from '../services/authService';
import { addToCart } from '../services/cartService';
import api from '../services/api';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetworkBanner from '../components/NetworkBanner';

// ─── Discount Helper ──────────────────────────────────
function getDiscountedPrice(product) {
  const disc = Array.isArray(product.discount) ? product.discount[0] : product.discount;
  if (!disc || !disc.percentage) return null;
  const pct = Number(disc.percentage);
  if (!pct || pct <= 0 || pct > 100) return null;
  return Number(product.price) * (1 - pct / 100);
}

export default function ProductDetailScreen({ route, navigation }) {
  const { product, branchId, fromSearch } = route.params;
  // Get branch-specific stock
  const branchStock = branchId
    ? (product.branch_stock || []).find(b => b.branch_id === branchId)
    : (product.branch_stock || [])[0];
  const branchQty  = branchStock?.quantity ?? product._branchQty ?? product.quantity ?? 0;
  const branchName = branchStock?.branch?.branch_name || product._branchName || null;
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();

  const [quantity, setQty]   = useState(1);
  const [qtyText,  setQtyText] = useState('1');
  const [loadingCart, setLoadingCart] = useState(false);
  const [loadingBuy,  setLoadingBuy]  = useState(false);
  const [activeIdx,       setActiveIdx]       = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [variantStock,    setVariantStock]    = useState(null); // null=unchecked, number=qty

  // When Login Required cuts off Add to Cart / Buy Now, we remember which
  // one was pending so it can auto-resume the moment this screen regains
  // focus logged in — popToTop() in LoginScreen returns to this exact
  // ProductDetailScreen instance, so quantity/selectedOptions are preserved,
  // we just need to re-fire the action ourselves.
  const pendingActionRef    = useRef(null); // 'addToCart' | 'buyNow' | null
  const handleAddToCartRef  = useRef(null);
  const handleBuyNowRef     = useRef(null);
  const { width } = Dimensions.get('window');
  const images = product.image_urls?.length
    ? product.image_urls
    : product.image_url ? [product.image_url] : [];

  const discountedPrice = getDiscountedPrice(product);
  const hasDiscount     = discountedPrice !== null;
  const effectivePrice  = hasDiscount ? discountedPrice : product.price;
  const disc            = product.discount;
  // Branch-specific stock (branchQty, computed above) — not product.quantity,
  // which is the aggregate across all branches.
  const inStock          = branchQty > 0;
  const hasVariants      = (product.option_groups || []).length > 0;
  const allOptsSelected  = hasVariants && Object.keys(selectedOptions).length === (product.option_groups || []).length;
  const variantOutOfStock = allOptsSelected && variantStock === 0;

  function increment() {
    if (quantity >= branchQty) {
      showAlert({ type: 'warning', title: 'Maximum Stock', message: `Only ${branchQty} unit(s) available.` });
      return;
    }
    const next = quantity + 1;
    setQty(next);
    setQtyText(String(next));
  }
  function decrement() {
    if (quantity > 1) {
      const next = quantity - 1;
      setQty(next);
      setQtyText(String(next));
    }
  }

  // Clear the field on focus so typing starts fresh instead of appending
  // to the existing value (classic controlled-TextInput append bug on
  // Android even with selectTextOnFocus), then parse/clamp on blur/submit.
  function handleQtyFocus() {
    setQtyText('');
  }
  function handleQtyChangeText(val) {
    setQtyText(val.replace(/[^0-9]/g, ''));
  }
  function commitQtyText() {
    const num = parseInt(qtyText, 10) || 0;
    let final = num;
    if (num > branchQty) {
      showAlert({ type: 'warning', title: 'Maximum Stock', message: `Only ${branchQty} unit(s) available.` });
      final = branchQty;
    } else if (num < 1) {
      final = 1;
    }
    setQty(final);
    setQtyText(String(final));
  }

  async function handleAddToCart() {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      pendingActionRef.current = 'addToCart';
      showAlert({ type: 'warning', title: 'Login Required', message: 'Please log in to add items to your cart.', buttons: [ { text: 'Cancel', onPress: () => { pendingActionRef.current = null; } }, { text: 'Log In', style: 'primary', onPress: () => navigation.navigate('Login') } ] });
      return;
    }
    // Validate all option groups selected
    for (const g of (product.option_groups || [])) {
      if (!selectedOptions[g.label]) {
        showAlert({ type: 'warning', title: 'Required', message: `Please select a ${g.label}.` });
        return;
      }
    }
    setLoadingCart(true);
    try {
      await addToCart(product.product_id, quantity, branchId || null, selectedOptions);
      showAlert({ type: 'success', title: 'Added to Cart!', message: `${product.product_name} (x${quantity}) added to your cart.`, buttons: [ { text: 'Continue Shopping', onPress: () => navigation.goBack() }, { text: 'View Cart', style: 'primary', onPress: () => navigation.navigate('Cart') } ] });
    } catch (e) {
      console.error('Add to cart error:', e);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to add to cart. Please try again.' });
    } finally {
      setLoadingCart(false);
    }
  }

  async function handleBuyNow() {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      pendingActionRef.current = 'buyNow';
      showAlert({ type: 'warning', title: 'Login Required', message: 'Please log in to complete your purchase.', buttons: [ { text: 'Cancel', onPress: () => { pendingActionRef.current = null; } }, { text: 'Log In', style: 'primary', onPress: () => navigation.navigate('Login') } ] });
      return;
    }
    // Validate all option groups selected
    for (const g of (product.option_groups || [])) {
      if (!selectedOptions[g.label]) {
        showAlert({ type: 'warning', title: 'Required', message: `Please select a ${g.label}.` });
        return;
      }
    }
    // Buy Now — go directly to Checkout with only this product
    // Does NOT add to cart — cart stays untouched
    const effectivePrice = hasDiscount ? discountedPrice : product.price;
    // Normalize discount — ensure it's a plain object not array
    const normalizedDiscount = Array.isArray(product.discount)
      ? product.discount[0] || null
      : product.discount || null;

    const buyNowItem = [{
      cart_id:          'buy_now',
      product_id:       product.product_id,
      quantity,
      selected_options: selectedOptions,
      product: {
        product_name: product.product_name,
        price:        Number(product.price),
        image_url:    product.image_url,
        image_urls:   product.image_urls || [],
        brand:        product.brand,
        discount:     normalizedDiscount,
        net_weight:   product.net_weight || 0,
        net_weight_unit: product.net_weight_unit || 'kg',
      },
    }];
    const buyNowTotal = effectivePrice * quantity;
    // Navigate directly to Checkout without going through Cart tab
    navigation.navigate('Checkout', {
      cartItems: buyNowItem,
      total:     buyNowTotal,
      isBuyNow:  true,
      branchId:  branchId || null,
    });
  }


  async function checkVariantStock(options) {
    if (!product.option_groups?.length) return;
    // Only check if all options selected
    if (Object.keys(options).length < product.option_groups.length) {
      setVariantStock(null);
      return;
    }
    try {
      const res = await api.post('/variant-stock/check', {
        product_id: product.product_id,
        branch_id:  branchId || null,
        options,
      });
      setVariantStock(res.data.quantity ?? 0);
    } catch (e) {
      setVariantStock(null);
    }
  }

  // Was previously defined but never invoked, so the "out of stock for this
  // variant" check and the Add to Cart/Buy Now block never actually fired.
  useEffect(() => {
    checkVariantStock(selectedOptions);
  }, [selectedOptions]);

  // Keep refs pointed at the latest handleAddToCart/handleBuyNow (they're
  // plain function declarations recreated every render, so a stale ref
  // would otherwise replay an old quantity/selectedOptions snapshot).
  useEffect(() => { handleAddToCartRef.current = handleAddToCart; });
  useEffect(() => { handleBuyNowRef.current    = handleBuyNow; });

  // Resume a pending Add to Cart / Buy Now the moment this screen regains
  // focus logged in (e.g. the user tapped Log In on the alert above,
  // logged in, and popToTop() brought them straight back here).
  useFocusEffect(
    useCallback(() => {
      if (!pendingActionRef.current) return;
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      (async () => {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) return;
        if (action === 'addToCart') handleAddToCartRef.current?.();
        if (action === 'buyNow')    handleBuyNowRef.current?.();
      })();
    }, [])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NetworkBanner />

      {/* Back Button */}
      <TouchableOpacity style={[styles.backBtn, { top: SPACING.xl + insets.top }]} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeMain')}>
        <Feather name="arrow-left" size={22} color={COLORS.white}/>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Product Image Carousel */}
        {images.length === 0 ? (
          <View style={styles.productImgPlaceholder}>
            <Feather name="shopping-bag" size={60} color={COLORS.primary}/>
          </View>
        ) : (
          <View style={{ width:'100%', height:280, backgroundColor: COLORS.white }}>
            <FlatList
              data={images}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveIdx(idx);
              }}
              renderItem={({ item }) => (
                // "contain" instead of "cover" — shows the whole product
                // image letterboxed rather than cropping off whichever
                // edges don't match this screen's fixed 280px-tall frame.
                <Image
                  source={{ uri: item }}
                  style={{ width, height:280 }}
                  resizeMode="contain"
                />
              )}
            />
            {/* Dots indicator */}
            {images.length > 1 && (
              <View style={styles.dotsWrap}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === activeIdx && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

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
            {(() => {
              const bs = (product.branch_stock || []).find(b => b.quantity > 0);
              const branchName = bs?.branch?.branch_name;
              return branchName ? (
                <View style={[styles.tag, { backgroundColor: 'rgba(22,163,74,0.1)', borderColor: 'rgba(22,163,74,0.3)' }]}>
                <Text style={styles.tagText}>{branchName}</Text>
                </View>
              ) : null;
            })()}
          {hasDiscount && (
              <View style={styles.discountTag}>
                <Feather name="tag" size={10} color={COLORS.white} style={{ marginRight: 3 }}/>
                <Text style={styles.discountTagText}>{disc.discount_name} — {disc.percentage}% OFF</Text>
              </View>
            )}
          </View>

          {/* Product Name */}
          <Text style={styles.name}>{product.product_name}</Text>

          {/* Sold Count */}
          <Text style={styles.soldCount}>
            {Number(product.total_sold || 0).toLocaleString()} sold
          </Text>

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
              {inStock ? `In Stock (${branchQty} available)` : 'Out of Stock'}
            </Text>
          </View>

          {/* Description */}
          {product.description ? (
            <View style={styles.descWrap}>
              <Text style={styles.descTitle}>Description</Text>
              <Text
                style={styles.desc}
                numberOfLines={showFullDesc ? undefined : 3}
              >
                {product.description}
              </Text>
              {product.description.length > 100 && (
                <TouchableOpacity
                  onPress={() => setShowFullDesc(!showFullDesc)}
                  style={{ marginTop: 4 }}
                >
                  <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600' }}>
                    {showFullDesc ? 'View Less ▲' : 'View More ▼'}
                  </Text>
                </TouchableOpacity>
              )}
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
                <TextInput
                  style={styles.qtyInput}
                  value={qtyText}
                  onFocus={handleQtyFocus}
                  onChangeText={handleQtyChangeText}
                  onBlur={commitQtyText}
                  onSubmitEditing={commitQtyText}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={[styles.qtyBtn, quantity >= branchQty && styles.qtyBtnDisabled]}
                  onPress={increment}
                  disabled={quantity >= branchQty}
                >
                  <Feather name="plus" size={16} color={quantity >= branchQty ? COLORS.grayLight : COLORS.dark}/>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Option Groups */}
          {(product.option_groups?.length > 0) && (
            <View style={styles.optionsWrap}>
              {product.option_groups.map((group, gi) => (
                <View key={gi} style={styles.optionGroup}>
                  <Text style={styles.optionGroupLabel}>
                    {`Select ${group.label}`}
                    {!selectedOptions[group.label] && <Text style={{color:'#ef4444'}}> *</Text>}
                  </Text>
                  <View style={styles.optionChoicesRow}>
                    {group.choices.map((choice, ci) => {
                      const isSelected = selectedOptions[group.label] === choice;
                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                          onPress={() => setSelectedOptions(prev => ({ ...prev, [group.label]: choice }))}
                        >
                          <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                            {choice}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
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

      {/* Variant Stock Indicator */}
      {allOptsSelected && variantStock !== null && (
        <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:SPACING.md, paddingBottom:8 }}>
          <Feather name={variantStock > 0 ? 'check-circle' : 'x-circle'} size={14} color={variantStock > 0 ? COLORS.primary : COLORS.error}/>
          <Text style={{ fontSize:12, fontWeight:'600', color: variantStock > 0 ? COLORS.primary : COLORS.error }}>
            {variantStock > 0 ? `${variantStock} units available for this variant` : 'Out of stock for this variant'}
          </Text>
        </View>
      )}

      {/* Action Buttons — extra bottom padding clears the floating
          translucent tab bar (AppNavigator's tabBarStyle is position:
          'absolute' with height 60 + insets.bottom, so it overlaps
          whatever sits at the true bottom of the screen). */}
      <View style={[styles.footer, { paddingBottom: SPACING.md + 60 + insets.bottom }]}>
        <View style={styles.buttonRow}>
          {/* Add to Cart Button */}
          <TouchableOpacity
            style={[styles.btn, styles.btnCart, !inStock && styles.btnDisabled]}
            onPress={handleAddToCart}
            disabled={!inStock || loadingCart || loadingBuy || variantOutOfStock}
            activeOpacity={0.85}
          >
            {loadingCart ? (
              <ActivityIndicator color={COLORS.white} size="small"/>
            ) : (
              <>
                <Feather name="shopping-cart" size={16} color={COLORS.white}/>
                <Text style={styles.btnText}>Add to Cart</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Buy Now Button */}
          <TouchableOpacity
            style={[styles.btn, styles.btnBuy, !inStock && styles.btnDisabled]}
            onPress={handleBuyNow}
            disabled={!inStock || loadingCart || loadingBuy || variantOutOfStock}
            activeOpacity={0.85}
          >
            {loadingBuy ? (
              <ActivityIndicator color={COLORS.white} size="small"/>
            ) : (
              <>
                <Feather name="credit-card" size={16} color={COLORS.white}/>
                <Text style={styles.btnText}>Buy Now</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <CustomAlert config={alertConfig} onHide={hideAlert}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container:             { flex:1, backgroundColor: COLORS.grayBg },
  backBtn:               { position:'absolute', left: SPACING.md, zIndex:10, backgroundColor:'rgba(0,0,0,0.4)', borderRadius: RADIUS.full, padding:8 },

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
  soldCount:      { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
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
  buttonRow:             { flexDirection:'row', gap: SPACING.md },
  btn:                   { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', borderRadius: RADIUS.sm, padding:14, gap:6 },
  btnCart:               { backgroundColor: COLORS.primary },
  btnBuy:                { backgroundColor: COLORS.primary },
  btnDisabled:           { backgroundColor: COLORS.grayLight },
  btnText:               { color: COLORS.white, fontWeight:'700', fontSize:14 },

  // Old styles (keeping for backward compatibility if needed)
  cartBtn:               { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, padding:14, alignItems:'center' },
  cartBtnDisabled:       { backgroundColor: COLORS.grayLight },
  cartBtnInner:          { flexDirection:'row', alignItems:'center', gap:8 },
  cartBtnText:           { color: COLORS.white, fontWeight:'700', fontSize:15 },

  // ─── Option Groups ───────────────────────────────
  optionsWrap:            { marginBottom: SPACING.md },
  optionGroup:            { marginBottom: SPACING.md },
  optionGroupLabel:       { fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 8 },
  optionChoicesRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip:             {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
  },
  optionChipSelected:     {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionChipText:         { fontSize: 13, color: COLORS.dark, fontWeight: '500' },
  optionChipTextSelected: { color: COLORS.white, fontWeight: '700' },
});
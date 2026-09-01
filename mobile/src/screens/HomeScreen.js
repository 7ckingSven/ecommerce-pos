import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, Image, Alert,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getProducts, searchProducts } from '../services/productService';
import { addToCart } from '../services/cartService';
import { isLoggedIn } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import { useFocusEffect } from '@react-navigation/native';
import { useCart } from '../utils/CartContext';

function ProductCard({ product, onPress, onAddToCart, onBuyNow }) {
  const inStock = product.quantity > 0;

  // Calculate discounted price if discount exists
  const discountedPrice = product.discount
    ? product.price * (1 - product.discount.percentage / 100)
    : null;

  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => onPress(product)}
      activeOpacity={0.85}
    >
      {/* Product Image */}
      {(product.image_urls?.length ? product.image_urls[0] : product.image_url)
        ? <Image source={{ uri: product.image_urls?.length ? product.image_urls[0] : product.image_url }} style={styles.productImg} resizeMode="cover"/>
        : <View style={styles.productImgPlaceholder}>
            <Feather name="shopping-bag" size={32} color={COLORS.primary}/>
          </View>
      }

      {/* Discount Badge */}
      {product.discount && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>-{product.discount.percentage}%</Text>
        </View>
      )}

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.product_name}</Text>
        {product.brand ? <Text style={styles.productBrand}>{product.brand}</Text> : null}
        <Text style={styles.productCat}>{product.category}</Text>
        {product.branch_name ? (
          <View style={styles.branchTag}>
            <Text style={styles.branchTagText}>🏪 {product.branch_name}</Text>
          </View>
        ) : null}

        {/* Sold Count */}
        <Text style={styles.soldCount}>
          {Number(product.total_sold || 0).toLocaleString()} sold
        </Text>

        {/* Price */}
        {discountedPrice ? (
          <View style={styles.priceRow}>
            <Text style={styles.productPriceOriginal}>₱{Number(product.price).toFixed(2)}</Text>
            <Text style={styles.productPriceDiscount}>₱{discountedPrice.toFixed(2)}</Text>
          </View>
        ) : (
          <Text style={styles.productPrice}>₱{Number(product.price).toFixed(2)}</Text>
        )}

        {/* Out of stock label */}
        {!inStock && (
          <Text style={styles.outOfStock}>Out of Stock</Text>
        )}

        {/* Action Buttons */}
        {inStock && (
          <View style={styles.actionRow}>
            {/* Cart Icon Button */}
            <TouchableOpacity
              style={styles.cartIconBtn}
              onPress={() => onAddToCart(product)}
              activeOpacity={0.8}
            >
              <Feather name="shopping-cart" size={14} color={COLORS.primary}/>
            </TouchableOpacity>

            {/* Buy Now Button */}
            <TouchableOpacity
              style={styles.buyBtn}
              onPress={() => onBuyNow(product)}
              activeOpacity={0.8}
            >
              <Text style={styles.buyBtnText}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const [products,    setProducts]    = useState([]);
  const [allProducts, setAllProducts] = useState([]); // store all for filtering
  const [categories,  setCategories]  = useState([]);
  const [brands,      setBrands]      = useState([]);
  const [selectedCat,   setSelectedCat]   = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const { cartCount, refreshCartCount } = useCart();
  const [loggedIn,    setLoggedIn]    = useState(false);

  // Auto-refresh every 10 seconds when screen is focused
  useFocusEffect(
    useCallback(() => {
      isLoggedIn().then(setLoggedIn);
      loadProducts();

      const timer = setInterval(() => {
        loadProducts();
      }, 10000); // 10 seconds

      return () => clearInterval(timer); // cleanup on blur
    }, [])
  );

  // ─── Auth Guard with redirect back ───────────────────
  async function requireLogin(action, params = {}) {
    const logged = await isLoggedIn();
    if (!logged) {
      // Navigate to Login and pass where to go back after login
      navigation.navigate('Login', {
        redirectAfter: action,
        redirectParams: params,
      });
      return false;
    }
    return true;
  }

  async function loadProducts() {
    try {
      // Always fetch ALL products — filter client-side to preserve chip list
      const data = await getProducts('');
      setAllProducts(data);
      setProducts(data);

      // Build category and brand lists from full dataset
      const cats   = [...new Set(data.map(p => p.category?.trim()).filter(Boolean))].sort();
      const brnds  = [...new Set(data.map(p => p.brand?.trim()).filter(Boolean))].sort();
      setCategories(cats);
      setBrands(brnds);
    } catch (e) {
      console.error('Load products error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Apply filters client-side — never loses chip list
  function applyFilters(cat, brand, q) {
    let filtered = allProducts;
    if (cat)   filtered = filtered.filter(p => p.category?.trim() === cat);
    if (brand) filtered = filtered.filter(p => p.brand?.trim() === brand);
    if (q)     filtered = filtered.filter(p =>
      p.product_name?.toLowerCase().includes(q.toLowerCase()) ||
      p.brand?.toLowerCase().includes(q.toLowerCase()) ||
      p.category?.toLowerCase().includes(q.toLowerCase())
    );
    setProducts(filtered);
  }

  function handleSearch(q) {
    setSearch(q);
    applyFilters(selectedCat, selectedBrand, q);
  }

  function selectCategory(cat) {
    setSelectedCat(cat);
    setSearch('');
    applyFilters(cat, selectedBrand, '');
  }

  function selectBrand(brand) {
    setSelectedBrand(brand);
    setSearch('');
    applyFilters(selectedCat, brand, '');
  }

  // ─── Add to Cart (requires login) ────────────────────
  async function handleAddToCart(product) {
    const ok = await requireLogin('addToCart', { product_id: product.product_id });
    if (!ok) return;
    // Go to ProductDetail so customer can select option groups first
    navigation.navigate('ProductDetail', { product, branchId: product.branch_id || null });
  }

  // ─── Buy Now (requires login → ProductDetail) ────────
  async function handleBuyNow(product) {
    const ok = await requireLogin('buyNow', { product });
    if (!ok) return;
    // Navigate to ProductDetail — customer selects options then buys
    navigation.navigate('ProductDetail', { product, branchId: product.branch_id || null });
  }

  function onRefresh() {
    setRefreshing(true);
    setSelectedCat('');
    setSelectedBrand('');
    setSearch('');
    loadProducts();
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Welcome! 👋</Text>
          <Text style={styles.headerTitle}>Triple E & Fiel Collins</Text>
        </View>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => navigation.navigate('Cart')}
        >
          <Feather name="shopping-cart" size={22} color={COLORS.white}/>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 6 }}/>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={handleSearch}
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => { setSearch(''); loadProducts(selectedCat); }}>
            <Feather name="x" size={16} color={COLORS.textMuted}/>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Category</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '', name: 'All' }, ...categories.map(c => ({ id: c, name: c }))]}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.catContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.catChip, selectedCat === item.id && styles.catChipActive]}
              onPress={() => selectCategory(item.id)}
            >
              <Text style={[styles.catText, selectedCat === item.id && styles.catTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Brand Filter */}
      {brands.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Brand</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: '', name: 'All' }, ...brands.map(b => ({ id: b, name: b }))]}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.catContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.catChip, selectedBrand === item.id && styles.catChipActive]}
                onPress={() => selectBrand(item.id)}
              >
                <Text style={[styles.catText, selectedBrand === item.id && styles.catTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Products */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }}/>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.product_id}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary}/>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="search" size={40} color={COLORS.grayLight}/>
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={p => navigation.navigate('ProductDetail', { product: p, branchId: p.branch_id || null })}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: COLORS.grayBg },

  // Header
  header:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.dark, paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  headerGreeting:         { fontSize: 12, color: COLORS.grayLight },
  headerTitle:            { fontSize: 16, fontWeight: '700', color: COLORS.white },
  cartBtn:                { position: 'relative', padding: 4 },
  cartBadge:              { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText:          { fontSize: 9, color: COLORS.white, fontWeight: '700' },

  // Search
  searchWrap:             { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.grayBorder, ...SHADOW.sm },
  searchInput:            { flex: 1, padding: 10, fontSize: 14, color: COLORS.dark },

  // Categories
  catScroll:              { maxHeight: 44 }, // kept for compatibility
  catContent:             { paddingHorizontal: SPACING.md, gap: 8, alignItems: 'center' },
  filterSection:          { marginBottom: 6 },
  filterLabel:            { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, paddingHorizontal: SPACING.md, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  catChip:                { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.grayBorder },
  catChipActive:          { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText:                { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  catTextActive:          { color: COLORS.white },

  // Products
  productList:            { padding: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm },
  productRow:             { gap: SPACING.sm },
  productCard:            { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md, overflow: 'hidden', ...SHADOW.sm },
  productImg:             { height: 110, width: '100%' },
  productImgPlaceholder:  { height: 110, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },

  // Discount badge
  discountBadge:          { position: 'absolute', top: 8, left: 8, backgroundColor: '#ef4444', borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText:      { fontSize: 9, fontWeight: '700', color: COLORS.white },

  // Product info
  productInfo:            { padding: SPACING.sm },
  productName:            { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 2 },
  productBrand:           { fontSize: 10, color: COLORS.textMuted, marginBottom: 1 },
  productCat:             { fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },

  // Price
  productPrice:           { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 6 },
  priceRow:               { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  productPriceOriginal:   { fontSize: 10, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  productPriceDiscount:   { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  soldCount:              { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  outOfStock:             { fontSize: 10, color: '#ef4444', fontWeight: '600', marginBottom: 4 },

  // Action Buttons
  actionRow:              { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartIconBtn:            {
    width: 32, height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryBg,
  },
  buyBtn:                 {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnText:             { fontSize: 11, fontWeight: '700', color: COLORS.white },

  // Empty
  emptyWrap:              { alignItems: 'center', marginTop: SPACING.xxl, gap: SPACING.sm },
  emptyText:              { fontSize: 14, color: COLORS.textMuted },
});
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, Image, Alert,
  StatusBar, Keyboard,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getProducts, searchProducts } from '../services/productService';
import { addToCart } from '../services/cartService';
import { isLoggedIn } from '../services/authService';
import { COLORS, SPACING, RADIUS, SHADOW } from '../utils/constants';
import { useFocusEffect } from '@react-navigation/native';
import { useCart } from '../utils/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

function ProductCard({ product, onPress, onAddToCart, onBuyNow }) {
  const inStock    = (product._branchQty || product.quantity || 0) > 0;
  const branchName = product._branchName || null;

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
{branchName ? (
          <View style={styles.branchTag}>
            <Text style={styles.branchTagText}>🏪 {branchName}</Text>
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
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

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
  const [loggedIn,      setLoggedIn]      = useState(false);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [searchHistory,  setSearchHistory]  = useState([]);
  const [suggestions,    setSuggestions]    = useState([]);
  const [suggPage,       setSuggPage]       = useState(1);
  const [suggLoading,    setSuggLoading]    = useState(false);
  const SUGG_PER_PAGE = 10;
  const searchRef = useRef(null);

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
      // Expand products by branch — one card per branch with stock
      const expanded = [];
      data.forEach(p => {
        const branches = (p.branch_stock || []).filter(bs => bs.quantity > 0);
        if (branches.length === 0) {
          expanded.push({ ...p, _branchId: null, _branchName: null, _branchQty: 0 });
        } else {
          branches.forEach(bs => {
            expanded.push({
              ...p,
              _branchId:   bs.branch_id,
              _branchName: bs.branch?.branch_name || null,
              _branchQty:  bs.quantity,
              quantity:    bs.quantity,
            });
          });
        }
      });
      setAllProducts(expanded);
      setProducts(expanded);

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
    let filtered = allProducts; // already expanded by branch
    if (cat)   filtered = filtered.filter(p => p.category?.trim() === cat);
    if (brand) filtered = filtered.filter(p => p.brand?.trim() === brand);
    if (q)     filtered = filtered.filter(p =>
      p.product_name?.toLowerCase().includes(q.toLowerCase()) ||
      p.brand?.toLowerCase().includes(q.toLowerCase()) ||
      p.category?.toLowerCase().includes(q.toLowerCase())
    );
    setProducts(filtered);
  }


  function updateSuggestions(q, page = 1) {
    const filtered = q.trim()
      ? allProducts.filter(p =>
          p.product_name?.toLowerCase().includes(q.toLowerCase()) ||
          p.brand?.toLowerCase().includes(q.toLowerCase()) ||
          p.category?.toLowerCase().includes(q.toLowerCase())
        )
      : allProducts;
    setSuggestions(filtered.slice(0, page * 10));
    setSuggPage(page);
  }

  function loadMoreSuggestions() {
    if (suggLoading) return;
    const filtered = search.trim()
      ? allProducts.filter(p =>
          p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.brand?.toLowerCase().includes(search.toLowerCase()) ||
          p.category?.toLowerCase().includes(search.toLowerCase())
        )
      : allProducts;
    if (suggestions.length >= filtered.length) return;
    setSuggLoading(true);
    setTimeout(() => {
      const nextPage = suggPage + 1;
      setSuggestions(filtered.slice(0, nextPage * 10));
      setSuggPage(nextPage);
      setSuggLoading(false);
    }, 600);
  }

  async function loadSearchHistory() {
    try {
      const history = await AsyncStorage.getItem('search_history');
      if (history) setSearchHistory(JSON.parse(history));
    } catch (e) {}
  }

  async function saveSearchTerm(term) {
    if (!term.trim()) return;
    try {
      const prev    = [...searchHistory];
      const updated = [term, ...prev.filter(h => h !== term)].slice(0, 8);
      setSearchHistory(updated);
      await AsyncStorage.setItem('search_history', JSON.stringify(updated));
    } catch (e) {}
  }

  async function deleteHistoryItem(term) {
    try {
      const updated = searchHistory.filter(h => h !== term);
      setSearchHistory(updated);
      await AsyncStorage.setItem('search_history', JSON.stringify(updated));
    } catch (e) {}
  }

  async function clearHistory() {
    try {
      setSearchHistory([]);
      await AsyncStorage.removeItem('search_history');
    } catch (e) {}
  }

  function handleSearch(q) {
    setSearch(q);
    applyFilters(selectedCat, selectedBrand, q);
    updateSuggestions(q, 1);
  }

  function handleSearchSubmit() {
    if (search.trim()) {
      saveSearchTerm(search.trim());
      setSearchFocused(false);
      Keyboard.dismiss();
    }
  }

  function handleHistoryTap(term) {
    setSearch(term);
    applyFilters(selectedCat, selectedBrand, term);
    updateSuggestions(term, 1);
    saveSearchTerm(term);
  }

  function handleSuggestionTap(prod) {
    saveSearchTerm(prod.product_name);
    Keyboard.dismiss();
    // Keep searchFocused=true so back button returns to search
    navigation.navigate('ProductDetail', {
      product: prod,
      branchId:       (prod.branch_stock || []).find(b => b.quantity > 0)?.branch_id || null,
      fromSearch:     true,
    });
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
    navigation.navigate('ProductDetail', { product, branchId: (product.branch_stock || []).find(b => b.quantity > 0)?.branch_id || null });
  }

  // ─── Buy Now (requires login → ProductDetail) ────────
  async function handleBuyNow(product) {
    const ok = await requireLogin('buyNow', { product });
    if (!ok) return;
    // Navigate to ProductDetail — customer selects options then buys
    navigation.navigate('ProductDetail', { product, branchId: (product.branch_stock || []).find(b => b.quantity > 0)?.branch_id || null });
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

      {/* Status Bar — green to match header */}
      <StatusBar backgroundColor="#16a34a" barStyle="light-content" translucent={false}/>

      {/* Header — Compact */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {searchFocused ? (
            <TouchableOpacity onPress={() => {
              setSearchFocused(false);
              setSearch('');
              setSuggestions([]);
              Keyboard.dismiss();
              loadProducts(selectedCat);
            }} style={{ padding: 4, marginRight: 4 }}>
              <Feather name="arrow-left" size={20} color="#fff"/>
            </TouchableOpacity>
          ) : (
            <Text style={styles.headerTitle}>TEFC</Text>
          )}
          <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
            <Feather name="search" size={14} color={COLORS.textMuted} style={{ marginRight: 4 }}/>
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={handleSearch}
              onFocus={() => {
                setSearchFocused(true);
                updateSuggestions(search, 1);
              }}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {search !== '' && (
              <TouchableOpacity onPress={() => {
                setSearch('');
                setSuggestions([]);
                loadProducts(selectedCat);
              }}>
                <Feather name="x" size={14} color={COLORS.textMuted}/>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Search Overlay */}
      {searchFocused && (
        <View style={styles.searchOverlay}>
          <FlatList
            data={suggestions}
            keyExtractor={item => `${item.product_id}_${item._branchId || 'none'}`}
            keyboardShouldPersistTaps="handled"
            numColumns={2}
            columnWrapperStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.md }}
            contentContainerStyle={{ paddingBottom: SPACING.xl }}
            onEndReached={loadMoreSuggestions}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              <View>
                {/* Search History */}
                {searchHistory.length > 0 && (
                  <View>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyTitle}>Recent Searches</Text>
                      <TouchableOpacity onPress={clearHistory}>
                        <Text style={styles.clearAll}>Clear All</Text>
                      </TouchableOpacity>
                    </View>
                    {searchHistory.map((term, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.historyItem}
                        onPress={() => handleHistoryTap(term)}
                      >
                        <Feather name="clock" size={14} color={COLORS.textMuted} style={{ marginRight: 10 }}/>
                        <Text style={styles.historyText}>{term}</Text>
                        <TouchableOpacity onPress={() => deleteHistoryItem(term)} style={{ marginLeft: 'auto' }}>
                          <Feather name="x" size={14} color={COLORS.textMuted}/>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* Suggestions Title */}
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>
                    {search.trim() ? `Results for "${search}"` : 'Suggestions'}
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.noHistory}>
                <Feather name="search" size={32} color={COLORS.grayLight}/>
                <Text style={styles.noHistoryText}>No results for "{search}"</Text>
              </View>
            }
            ListFooterComponent={
              suggLoading ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator color={COLORS.primary} size="small"/>
                  <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>Loading...</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const discount  = item.discount;
              const dispPrice = discount
                ? item.price * (1 - discount.percentage / 100)
                : item.price;
              return (
                <TouchableOpacity
                  style={styles.suggCard}
                  onPress={() => handleSuggestionTap(item)}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.suggCardImg}/>
                  ) : (
                    <View style={[styles.suggCardImg, { backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' }]}>
                      <Feather name="image" size={24} color={COLORS.grayLight}/>
                    </View>
                  )}
                  <View style={{ padding: 8 }}>
                    <Text style={styles.suggName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.suggBrand} numberOfLines={1}>{item.brand}</Text>
                    <Text style={styles.suggPrice}>
                      ₱{Number(dispPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Text>
                    {discount && (
                      <Text style={{ fontSize: 10, color: COLORS.textMuted, textDecorationLine: 'line-through' }}>
                        ₱{Number(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

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
              onPress={p => navigation.navigate('ProductDetail', {
                product:  p,
                branchId: p._branchId || (p.branch_stock || []).find(b => b.quantity > 0)?.branch_id || null
              })}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />
          )}
        />
      )}
      <CustomAlert config={alertConfig} onHide={hideAlert}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: COLORS.grayBg },

  // Header
  header:                 { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.sm, backgroundColor: '#16a34a', shadowColor: '#14532d', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerTop:              { flexDirection: 'row', alignItems: 'center', gap: 10 },

  headerGreeting:         { fontSize: 12, color: COLORS.grayLight },
  headerTitle:            { fontSize: 16, fontWeight: '900', color: '#fff', flexShrink: 0, letterSpacing: 1.5, textTransform: 'uppercase' },
  headerSub:              { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  cartBtn:                { position: 'relative', padding: 4 },
  cartBadge:              { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText:          { fontSize: 9, color: COLORS.white, fontWeight: '700' },

  // Search
  searchWrap:             { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  searchWrapFocused:      { borderColor: COLORS.primary, borderWidth: 1.5 },
  searchOverlay:          { position: 'absolute', top: 50, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, zIndex: 999, paddingTop: 8 },
  historyHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  historyTitle:           { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  clearAll:               { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  historyItem:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  historyText:            { fontSize: 13, color: COLORS.dark, flex: 1 },
  noHistory:              { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.sm },
  noHistoryText:          { fontSize: 13, color: COLORS.textMuted },
  suggItem:               { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder, gap: 12 },
  suggImg:                { width: 48, height: 48, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg },
  suggCard:               { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: SPACING.sm, ...SHADOW.sm },
  suggCardImg:            { width: '100%', height: 110 },
  suggName:               { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  suggBrand:              { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  suggPrice:              { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  searchInput:            { flex: 1, paddingVertical: 4, paddingHorizontal: 4, fontSize: 13, color: COLORS.dark },

  // Categories
  catScroll:              { maxHeight: 44 }, // kept for compatibility
  catContent:             { paddingHorizontal: SPACING.md, gap: 8, alignItems: 'center' },
  filterSection:          { marginBottom: 6, marginTop: SPACING.sm },
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
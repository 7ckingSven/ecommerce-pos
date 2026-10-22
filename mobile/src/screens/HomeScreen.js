import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, Image, Alert,
  StatusBar, Keyboard, Modal, ScrollView, Animated, PanResponder, Dimensions,
  Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { getProducts, searchProducts } from '../services/productService';
import { addToCart } from '../services/cartService';
import { isLoggedIn } from '../services/authService';
import { SPACING, RADIUS, SHADOW } from '../utils/constants';
import { useTheme } from '../utils/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { useCart } from '../utils/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import api from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import NetworkBanner from '../components/NetworkBanner';

// Memoized so a HomeScreen re-render (typing in search, a refresh tick, etc.)
// doesn't force every visible card to re-render — only cards whose own
// product data actually changed re-render.
const ProductCard = React.memo(function ProductCard({ product, onPress, onAddToCart, onBuyNow }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
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
      {/* Product Image — resizeMode="contain" inside a fixed-size, centered
          wrap so the whole product shows (letterboxed if needed) instead of
          "cover" cropping off whichever edges don't match the card's
          aspect ratio. */}
      {(product.image_urls?.length ? product.image_urls[0] : product.image_url)
        ? <View style={styles.productImgWrap}>
            <Image source={{ uri: product.image_urls?.length ? product.image_urls[0] : product.image_url }} style={styles.productImg} resizeMode="contain"/>
          </View>
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
});

// Same critical-stock reserve threshold now used backend-side (app.py's
// CRITICAL_STOCK_LEVEL) and in the POS screen — a product/branch at or
// below this many units is treated as unavailable here too, not just
// literal zero, so the shop keeps a small buffer instead of selling a
// branch all the way down to its last unit.
const CRITICAL_STOCK_LEVEL = 5;

// ─── Sort Options (M4) ────────────────────────────────
const SORT_OPTIONS = [
  { id: 'relevance',    name: 'Relevance' },
  { id: 'price_asc',    name: 'Price: Low to High' },
  { id: 'price_desc',   name: 'Price: High to Low' },
  { id: 'best_selling', name: 'Best Selling' },
];

function sortProducts(list, sort) {
  const arr = [...list];
  if (sort === 'price_asc')    arr.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'price_desc')   arr.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === 'best_selling') arr.sort((a, b) => Number(b.total_sold || 0) - Number(a.total_sold || 0));
  return arr; // 'relevance' — keep the default/unsorted order
}

export default function HomeScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();

  const [products,    setProducts]    = useState([]);
  const [allProducts, setAllProducts] = useState([]); // store all for filtering
  const [categories,  setCategories]  = useState([]);
  const [brands,      setBrands]      = useState([]);
  const [selectedCat,   setSelectedCat]   = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(false);
  const { cartCount, refreshCartCount } = useCart();
  const [loggedIn,      setLoggedIn]      = useState(false);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [searchHistory,  setSearchHistory]  = useState([]);
  const [suggestions,    setSuggestions]    = useState([]);
  const [suggPage,       setSuggPage]       = useState(1);
  const [suggLoading,    setSuggLoading]    = useState(false);
  const [filterVisible,  setFilterVisible]  = useState(false);
  const [tempCat,        setTempCat]        = useState('');
  const [tempBrand,      setTempBrand]      = useState('');
  const [selectedSort,   setSelectedSort]   = useState('relevance');
  const [tempSort,       setTempSort]       = useState('relevance');
  const SUGG_PER_PAGE = 10;
  const searchRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // ─── Draggable filter sheet ───────────────────────────
  // The sheet opens at a comfortable default height and can be dragged up
  // by its handle to expand all the way to the top of the screen (leaving
  // just the safe-area inset clear), or dragged down to dismiss.
  const screenHeight          = Dimensions.get('window').height;
  const FILTER_SHEET_COLLAPSED = Math.round(screenHeight * 0.62);
  const FILTER_SHEET_EXPANDED  = screenHeight - insets.top - 16;
  const filterSheetHeight     = useRef(new Animated.Value(FILTER_SHEET_COLLAPSED)).current;
  const filterSheetHeightRef  = useRef(FILTER_SHEET_COLLAPSED);
  const filterDragStartHeight = useRef(FILTER_SHEET_COLLAPSED);

  useEffect(() => {
    const id = filterSheetHeight.addListener(({ value }) => { filterSheetHeightRef.current = value; });
    return () => filterSheetHeight.removeListener(id);
  }, []);

  function openFilterModal() {
    // Always reopen at the default (collapsed) height, not wherever it was
    // left expanded/dragged to last time.
    filterSheetHeight.setValue(FILTER_SHEET_COLLAPSED);
    filterSheetHeightRef.current = FILTER_SHEET_COLLAPSED;
    setTempCat(selectedCat);
    setTempBrand(selectedBrand);
    setTempSort(selectedSort);
    setFilterVisible(true);
  }

  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        filterDragStartHeight.current = filterSheetHeightRef.current;
      },
      onPanResponderMove: (_, g) => {
        // Dragging UP (negative dy) grows the sheet; dragging DOWN shrinks it.
        const next    = filterDragStartHeight.current - g.dy;
        const clamped = Math.max(FILTER_SHEET_COLLAPSED * 0.5, Math.min(FILTER_SHEET_EXPANDED, next));
        filterSheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const finalHeight = filterDragStartHeight.current - g.dy;
        // Dragged down far enough (or flung down fast) → dismiss, same as
        // swiping away a bottom sheet.
        if (finalHeight < FILTER_SHEET_COLLAPSED * 0.55 || g.vy > 1.2) {
          Animated.timing(filterSheetHeight, {
            toValue:      FILTER_SHEET_COLLAPSED * 0.3,
            duration:     150,
            useNativeDriver: false,
          }).start(() => setFilterVisible(false));
          return;
        }
        // Otherwise snap to whichever anchor (collapsed/fully expanded) is
        // closer — a fast upward flick always snaps to fully expanded.
        const midpoint    = (FILTER_SHEET_COLLAPSED + FILTER_SHEET_EXPANDED) / 2;
        const goToExpanded = g.vy < -0.5 || finalHeight > midpoint;
        Animated.spring(filterSheetHeight, {
          toValue:         goToExpanded ? FILTER_SHEET_EXPANDED : FILTER_SHEET_COLLAPSED,
          useNativeDriver: false,
          bounciness:      4,
        }).start();
      },
    })
  ).current;

  // Kept as a ref (not plain state) so loadProductsSilent — called from the
  // tabPress listener below, which may be holding an older closure — always
  // reads the LATEST filter/sort values instead of whatever existed when
  // that listener was created.
  const liveFiltersRef = useRef({ cat: '', brand: '', search: '', sort: 'relevance' });
  useEffect(() => {
    liveFiltersRef.current = { cat: selectedCat, brand: selectedBrand, search, sort: selectedSort };
  }, [selectedCat, selectedBrand, search, selectedSort]);

  // Load once whenever the Home screen gains focus — no background polling
  // (matches the web dashboards: data loads on view, refresh is on-demand).
  useFocusEffect(
    useCallback(() => {
      isLoggedIn().then(setLoggedIn);
      loadProducts();
      loadSearchHistory(); // Bug fix: was never called
    }, [])
  );

  // Tapping the "Home" tab while already on it refreshes the data in place
  // (filters/sort preserved) — the mobile equivalent of the web dashboard's
  // manual ↻ refresh-section button. Home is nested in a Stack inside the
  // Tab navigator, so the tabPress event lives on the parent (tab) navigator.
  useEffect(() => {
    const unsubscribe = navigation.getParent()?.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        loadProductsSilent();
      }
    });
    return unsubscribe;
  }, [navigation]);

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
      setError(false);
      // Always fetch ALL products — filter client-side to preserve chip list
      const data = await getProducts('');
      // Expand products by branch — one card per branch with stock above
      // the critical reserve level. A branch at or below that level is
      // skipped entirely (no card at all), not just shown as "Out of
      // Stock" — if a product has no qualifying branch, it doesn't appear
      // in the list at all.
      const expanded = [];
      data.forEach(p => {
        const branches = (p.branch_stock || []).filter(bs => bs.quantity > CRITICAL_STOCK_LEVEL);
        branches.forEach(bs => {
          expanded.push({
            ...p,
            _branchId:   bs.branch_id,
            _branchName: bs.branch?.branch_name || null,
            _branchQty:  bs.quantity,
            quantity:    bs.quantity,
          });
        });
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
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Apply filters client-side — never loses chip list
  // Silent refresh - preserves filters
  async function loadProductsSilent() {
    try {
      const res  = await api.get('/products');
      const data = res.data || [];
      const expanded = [];
      data.forEach(p => {
        const branches = (p.branch_stock || []).filter(bs => bs.quantity > CRITICAL_STOCK_LEVEL);
        branches.forEach(bs => {
          expanded.push({
            ...p,
            _branchId:   bs.branch_id,
            _branchName: bs.branch?.branch_name || null,
            _branchQty:  bs.quantity,
            quantity:    bs.quantity,
          });
        });
      });
      setAllProducts(expanded);
      // Re-apply current filters silently — read from the ref (always live),
      // not the closed-over state vars, which may be stale inside this timer.
      const { cat, brand, search: q, sort } = liveFiltersRef.current;
      applyFilters(cat, brand, q, expanded, sort);
    } catch (e) {
      // Silent fail - don't disrupt user
    }
  }

  function applyFilters(cat, brand, q, sourceProducts, sort) {
    let filtered = sourceProducts || allProducts; // already expanded by branch
    if (cat)   filtered = filtered.filter(p => p.category?.trim() === cat);
    if (brand) filtered = filtered.filter(p => p.brand?.trim() === brand);
    if (q)     filtered = filtered.filter(p =>
      p.product_name?.toLowerCase().includes(q.toLowerCase()) ||
      p.brand?.toLowerCase().includes(q.toLowerCase()) ||
      p.category?.toLowerCase().includes(q.toLowerCase())
    );
    filtered = sortProducts(filtered, sort !== undefined ? sort : selectedSort);
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
      branchId:       (prod.branch_stock || []).find(b => b.quantity > CRITICAL_STOCK_LEVEL)?.branch_id || null,
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
    const branchId = (product.branch_stock || []).find(b => b.quantity > CRITICAL_STOCK_LEVEL)?.branch_id || null;
    // Pass the full product (not just its id) + branchId so LoginScreen can
    // resume straight into ProductDetail for this exact product after login.
    const ok = await requireLogin('addToCart', { product, branchId });
    if (!ok) return;
    // Go to ProductDetail so customer can select option groups first
    navigation.navigate('ProductDetail', { product, branchId });
  }

  // ─── Buy Now (requires login → ProductDetail) ────────
  async function handleBuyNow(product) {
    const branchId = (product.branch_stock || []).find(b => b.quantity > CRITICAL_STOCK_LEVEL)?.branch_id || null;
    const ok = await requireLogin('buyNow', { product, branchId });
    if (!ok) return;
    // Navigate to ProductDetail — customer selects options then buys
    navigation.navigate('ProductDetail', { product, branchId });
  }

  function onRefresh() {
    setRefreshing(true);
    setSelectedCat('');
    setSelectedBrand('');
    setSelectedSort('relevance');
    setSearch('');
    loadProducts();
  }

  function handleProductPress(p) {
    navigation.navigate('ProductDetail', {
      product:  p,
      branchId: p._branchId || (p.branch_stock || []).find(b => b.quantity > CRITICAL_STOCK_LEVEL)?.branch_id || null
    });
  }

  // Stable function identities so the memoized ProductCard doesn't re-render
  // just because HomeScreen re-rendered for an unrelated reason.
  const renderProductItem = useCallback(({ item }) => (
    <ProductCard
      product={item}
      onPress={handleProductPress}
      onAddToCart={handleAddToCart}
      onBuyNow={handleBuyNow}
    />
  ), []);

  return (
    <View style={styles.container}>

      {/* Status Bar — fully transparent/translucent. Modern Android
          (15+/edge-to-edge) ignores backgroundColor/translucent props
          entirely, so instead of relying on the OS to paint this area we
          draw it ourselves: the header's own background now extends up
          through insets.top below, so there's no seam left for the OS to
          get wrong. */}
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true}/>

      {/* Header — Compact */}
      <View
        // Header background now reaches up through insets.top on every
        // platform (paints over the status-bar area itself), since we can
        // no longer count on the native StatusBar component to color it.
        style={[styles.header, { paddingTop: SPACING.sm + insets.top }]}
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      >
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
          {/* Bug fix: filter button always visible, not just when searchFocused */}
          <TouchableOpacity
            onPress={openFilterModal}
            style={styles.filterIconBtn}
          >
            <Feather name="sliders" size={18} color="#fff"/>
            {(selectedCat || selectedBrand || selectedSort !== 'relevance') && (
              <View style={styles.filterDot}/>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Overlay — Bug fix: top dynamically uses measured header height */}
      {searchFocused && (
        <View style={[styles.searchOverlay, { top: headerHeight }]}>
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
                    <View style={[styles.suggCardImg, { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}>
                      <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain"/>
                    </View>
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

      {/* Active Filter Tags */}
      {(selectedCat || selectedBrand || selectedSort !== 'relevance') && (
        <View style={styles.activeFiltersRow}>
          {selectedSort !== 'relevance' && (
            <TouchableOpacity style={styles.activeTag} onPress={() => { setSelectedSort('relevance'); applyFilters(selectedCat, selectedBrand, search, null, 'relevance'); }}>
              <Text style={styles.activeTagText}>{SORT_OPTIONS.find(s => s.id === selectedSort)?.name}</Text>
              <Feather name="x" size={11} color={COLORS.primary}/>
            </TouchableOpacity>
          )}
          {selectedCat && (
            <TouchableOpacity style={styles.activeTag} onPress={() => { setSelectedCat(''); applyFilters('', selectedBrand, search); }}>
              <Text style={styles.activeTagText}>{selectedCat}</Text>
              <Feather name="x" size={11} color={COLORS.primary}/>
            </TouchableOpacity>
          )}
          {selectedBrand && (
            <TouchableOpacity style={styles.activeTag} onPress={() => { setSelectedBrand(''); applyFilters(selectedCat, '', search); }}>
              <Text style={styles.activeTagText}>{selectedBrand}</Text>
              <Feather name="x" size={11} color={COLORS.primary}/>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { setSelectedCat(''); setSelectedBrand(''); setSelectedSort('relevance'); applyFilters('', '', search, null, 'relevance'); }}>
            <Text style={{ fontSize: 11, color: COLORS.error, fontWeight: '600' }}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Network Banner */}
      <NetworkBanner />

      {/* Products */}
      {loading ? (
        <SkeletonLoader type="product" count={6} />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Feather name="wifi-off" size={56} color={COLORS.grayLight}/>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>Could not load products. Please check your internet connection.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setError(false); setLoading(true); loadProducts(); }}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          // Products are expanded one card per branch (see loadProducts), so
          // the same product_id can appear more than once in this list.
          // Keying by product_id alone gave duplicate keys, which breaks
          // React's ability to diff/recycle rows correctly in the
          // VirtualizedList — this was the real cause behind the "large
          // list that is slow to update" warning, not raw list size.
          keyExtractor={item => `${item.product_id}_${item._branchId || 'none'}`}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          // Extra bottom padding so the last row can scroll clear of the
          // now-floating (position:'absolute') tab bar in AppNavigator.
          contentContainerStyle={[styles.productList, { paddingBottom: SPACING.md + 60 + insets.bottom }]}
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
          renderItem={renderProductItem}
        />
      )}
      <CustomAlert config={alertConfig} onHide={hideAlert}/>

      {/* ─── Filter Modal — Shopee-style chip layout ─── */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setFilterVisible(false)}/>
        <Animated.View style={[styles.filterModal, { height: filterSheetHeight }]}>
          {/* Drag handle — grab and pull up to expand the sheet to the top
              of the screen, or pull down to dismiss it. */}
          <View {...filterPanResponder.panHandlers} style={styles.filterDragZone}>
            <View style={styles.filterHandle}/>
          </View>

          {/* Title row — just the close button; Reset lives in the footer
              next to Apply, matching Shopee's filter-panel footer. */}
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalTitle}>Filters</Text>
            <TouchableOpacity style={styles.filterCloseBtn} onPress={() => setFilterVisible(false)}>
              <Feather name="x" size={18} color={COLORS.dark}/>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.filterScroll}>
            {/* Sort By */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>SORT BY</Text>
              <View style={styles.filterChipRow}>
                {SORT_OPTIONS.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.filterChip, tempSort === item.id && styles.filterChipActive]}
                    onPress={() => setTempSort(item.id)}
                  >
                    <Text style={[styles.filterChipText, tempSort === item.id && styles.filterChipTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Category — filtered by selected brand */}
            {(() => {
              const availableCats = tempBrand
                ? [...new Set(allProducts.filter(p => p.brand?.trim() === tempBrand).map(p => p.category?.trim()).filter(Boolean))].sort()
                : categories;
              return (
                <View style={styles.filterSection}>
                  <View style={styles.filterSectionTitleRow}>
                    <Text style={styles.filterSectionTitle}>CATEGORY</Text>
                    {tempBrand ? <Text style={styles.filterDropCount}>{availableCats.length} available</Text> : null}
                  </View>
                  <View style={styles.filterChipRow}>
                    {[{ id: '', name: 'All' }, ...availableCats.map(c => ({ id: c, name: c }))].map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.filterChip, tempCat === item.id && styles.filterChipActive]}
                        onPress={() => setTempCat(item.id)}
                      >
                        <Text style={[styles.filterChipText, tempCat === item.id && styles.filterChipTextActive]}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Brand — filtered by selected category */}
            {(() => {
              const availableBrands = tempCat
                ? [...new Set(allProducts.filter(p => p.category?.trim() === tempCat).map(p => p.brand?.trim()).filter(Boolean))].sort()
                : brands;
              return (
                <View style={[styles.filterSection, styles.filterSectionLast]}>
                  <View style={styles.filterSectionTitleRow}>
                    <Text style={styles.filterSectionTitle}>BRAND</Text>
                    {tempCat ? <Text style={styles.filterDropCount}>{availableBrands.length} available</Text> : null}
                  </View>
                  <View style={styles.filterChipRow}>
                    {[{ id: '', name: 'All' }, ...availableBrands.map(b => ({ id: b, name: b }))].map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.filterChip, tempBrand === item.id && styles.filterChipActive]}
                        onPress={() => {
                          setTempBrand(item.id);
                          if (item.id && tempCat) {
                            const catsForBrand = [...new Set(allProducts.filter(p => p.brand?.trim() === item.id).map(p => p.category?.trim()).filter(Boolean))];
                            if (!catsForBrand.includes(tempCat)) setTempCat('');
                          }
                        }}
                      >
                        <Text style={[styles.filterChipText, tempBrand === item.id && styles.filterChipTextActive]}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })()}
          </ScrollView>

          {/* Footer — Reset (outline) + Apply (filled, badge count) */}
          <View style={styles.filterBtnRow}>
            <TouchableOpacity
              style={styles.filterCancelBtn}
              onPress={() => { setTempCat(''); setTempBrand(''); setTempSort('relevance'); }}
            >
              <Text style={styles.filterCancelText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterApplyBtn}
              onPress={() => {
                setSelectedCat(tempCat);
                setSelectedBrand(tempBrand);
                setSelectedSort(tempSort);
                applyFilters(tempCat, tempBrand, search, null, tempSort);
                setFilterVisible(false);
              }}
            >
              <Text style={styles.filterApplyText}>Apply</Text>
              {(tempCat || tempBrand || tempSort !== 'relevance') ? (
                <View style={styles.filterApplyBadge}>
                  <Text style={styles.filterApplyBadgeText}>
                    {(tempCat ? 1 : 0) + (tempBrand ? 1 : 0) + (tempSort !== 'relevance' ? 1 : 0)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container:              { flex: 1, backgroundColor: COLORS.grayBg },

  // Header
  header:                 { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.sm, backgroundColor: COLORS.primary, shadowColor: '#14532d', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerTop:              { flexDirection: 'row', alignItems: 'center', gap: 10 },

  headerGreeting:         { fontSize: 12, color: COLORS.grayLight },
  headerTitle:            { fontSize: 16, fontWeight: '900', color: '#fff', flexShrink: 0, letterSpacing: 1.5, textTransform: 'uppercase' },
  headerSub:              { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  cartBtn:                { position: 'relative', padding: 4 },
  cartBadge:              { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText:          { fontSize: 9, color: COLORS.white, fontWeight: '700' },

  // Search
  searchWrap:             { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  searchWrapFocused:      { borderColor: COLORS.primary, borderWidth: 1.5 },
  searchOverlay:          { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.surface, zIndex: 999, paddingTop: 8 },
  historyHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  historyTitle:           { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  clearAll:               { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  historyItem:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  historyText:            { fontSize: 13, color: COLORS.dark, flex: 1 },
  noHistory:              { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.sm },
  noHistoryText:          { fontSize: 13, color: COLORS.textMuted },
  suggItem:               { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder, gap: 12 },
  suggImg:                { width: 48, height: 48, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayBg },
  suggCard:               { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: SPACING.sm, ...SHADOW.sm },
  suggCardImg:            { width: '100%', height: 110 },
  suggName:               { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  suggBrand:              { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  suggPrice:              { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  searchInput:            { flex: 1, paddingVertical: 4, paddingHorizontal: 4, fontSize: 13, color: COLORS.dark },

  // Categories
  catScroll:              { maxHeight: 44 }, // kept for compatibility
  catContent:             { paddingHorizontal: SPACING.md, gap: 8, alignItems: 'center' },
  filterIconBtn:          { padding: 6, marginLeft: 6, position: 'relative' },
  filterDot:              { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  activeFiltersRow:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: SPACING.md, paddingVertical: 6, gap: 6, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  activeTag:              { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.primaryBorder },
  activeTagText:          { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  filterOverlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  // Shopee-style filter panel: clean bottom sheet, uppercase section
  // labels, and chip grids in place of the old boxed dropdown lists.
  // No maxHeight here — the sheet's height is driven by the animated
  // filterSheetHeight value instead, so dragging the handle can expand it
  // all the way to the top of the screen.
  filterModal:            { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.md, paddingBottom: 20, overflow: 'hidden', ...SHADOW.lg },
  filterDragZone:         { paddingTop: SPACING.sm, paddingBottom: SPACING.sm, alignItems: 'center' },
  filterHandle:           { width: 40, height: 4, backgroundColor: COLORS.grayBorder, borderRadius: 2 },
  filterModalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.grayBg },
  filterModalTitle:       { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  filterCloseBtn:         { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.grayBg, alignItems: 'center', justifyContent: 'center' },
  // flex: 1 instead of a fixed maxHeight so it grows/shrinks along with the
  // sheet's animated height as it's dragged.
  filterScroll:           { flex: 1 },
  // Each filter group — uppercase muted label, chip grid, light divider
  // between groups instead of the old heavy bordered boxes.
  filterSection:          { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.grayBg },
  filterSectionLast:      { borderBottomWidth: 0, paddingBottom: SPACING.xs },
  filterSectionTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  filterSectionTitle:     { fontSize: 11, fontWeight: '700', color: COLORS.gray, letterSpacing: 0.6, marginBottom: SPACING.sm },
  filterDropCount:        { fontSize: 11, fontWeight: '400', color: COLORS.textMuted },
  filterChipRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:             { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full, borderWidth: 1.3, borderColor: COLORS.grayBorder, backgroundColor: COLORS.surface },
  filterChipActive:       { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  filterChipText:         { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive:   { color: COLORS.primary, fontWeight: '700' },
  filterBtnRow:           { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
  filterCancelBtn:        { flex: 1, paddingVertical: 13, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.grayBorder, alignItems: 'center' },
  filterCancelText:       { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  filterApplyBtn:         { flex: 2, paddingVertical: 14, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  filterApplyText:        { fontSize: 14, fontWeight: '700', color: '#fff' },
  filterApplyBadge:       { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  filterApplyBadgeText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  filterLabel:            { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, paddingHorizontal: SPACING.md, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  catChip:                { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.grayBorder },
  catChipActive:          { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText:                { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  catTextActive:          { color: COLORS.white },

  // Products
  productList:            { padding: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm },
  productRow:             { gap: SPACING.sm },
  productCard:            { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, overflow: 'hidden', ...SHADOW.sm },
  productImgWrap:         { height: 110, width: '100%', backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productImg:             { height: '100%', width: '100%' },
  productImgPlaceholder:  { height: 110, backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center' },

  // Discount badge
  discountBadge:          { position: 'absolute', top: 8, left: 8, backgroundColor: '#ef4444', borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText:      { fontSize: 9, fontWeight: '700', color: COLORS.white },

  // Product info
  productInfo:            { padding: SPACING.sm },
  productName:            { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 2 },
  productBrand:           { fontSize: 10, color: COLORS.textMuted, marginBottom: 1 },
  productCat:             { fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },
  // branchTag/branchTagText were referenced above (the 🏪 branch-name tag
  // on each card) but never actually defined anywhere in this stylesheet —
  // a pre-existing bug. An undefined style falls back to RN's default text
  // color (plain black), which happened to be unnoticeable on a white card
  // in light mode but is stark black-on-dark-card now that dark mode exists.
  branchTag:              { alignSelf: 'flex-start', backgroundColor: COLORS.primaryBg, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  branchTagText:          { fontSize: 10, color: COLORS.primary, fontWeight: '600' },

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

  // Connection Error
  errorWrap:              { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  errorTitle:             { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  errorText:              { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn:               { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.sm },
  retryBtnText:           { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});
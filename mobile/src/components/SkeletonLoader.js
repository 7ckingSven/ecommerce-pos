import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../utils/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Shimmer base ────────────────────────────────────────
// `color` is passed down from the top (SkeletonLoader) instead of each
// sub-component reading its own useTheme() — a single theme read shared by
// every shimmer box on screen, rather than one per box.
function ShimmerBox({ style, color }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Animated.View style={[{ backgroundColor: color, borderRadius: 6 }, style, { opacity }]} />
  );
}

// ─── Product card skeleton (matches HomeScreen 2-col grid) ──
function ProductCardSkeleton({ styles, shimmerColor }) {
  return (
    <View style={styles.productCard}>
      <ShimmerBox style={styles.productImg} color={shimmerColor} />
      <View style={styles.productBody}>
        <ShimmerBox style={styles.line100} color={shimmerColor} />
        <ShimmerBox style={[styles.line60, { marginTop: 5 }]} color={shimmerColor} />
        <ShimmerBox style={[styles.line40, { marginTop: 5 }]} color={shimmerColor} />
        <ShimmerBox style={[styles.line50, { marginTop: 8 }]} color={shimmerColor} />
        <ShimmerBox style={[styles.btnBar, { marginTop: 10 }]} color={shimmerColor} />
      </View>
    </View>
  );
}

// ─── Order card skeleton (matches OrdersScreen list) ────────
function OrderCardSkeleton({ styles, shimmerColor }) {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardTop}>
        <ShimmerBox style={styles.line50} color={shimmerColor} />
        <ShimmerBox style={styles.statusBadge} color={shimmerColor} />
      </View>
      <ShimmerBox style={[styles.line80, { marginTop: 8 }]} color={shimmerColor} />
      <ShimmerBox style={[styles.line60, { marginTop: 6 }]} color={shimmerColor} />
      <View style={styles.orderCardBottom}>
        <ShimmerBox style={styles.line40} color={shimmerColor} />
        <ShimmerBox style={styles.smallBtn} color={shimmerColor} />
      </View>
    </View>
  );
}

// ─── Cart item skeleton (matches CartScreen list) ────────────
function CartItemSkeleton({ styles, shimmerColor }) {
  return (
    <View style={styles.cartItem}>
      <ShimmerBox style={styles.cartImg} color={shimmerColor} />
      <View style={styles.cartBody}>
        <ShimmerBox style={styles.line80} color={shimmerColor} />
        <ShimmerBox style={[styles.line50, { marginTop: 6 }]} color={shimmerColor} />
        <ShimmerBox style={[styles.line40, { marginTop: 6 }]} color={shimmerColor} />
      </View>
    </View>
  );
}

// ─── Profile skeleton (matches ProfileScreen) ────────────────
function ProfileSkeleton({ styles, shimmerColor }) {
  return (
    <View style={styles.profileWrap}>
      {/* Avatar */}
      <ShimmerBox style={styles.avatar} color={shimmerColor} />
      <ShimmerBox style={[styles.line50, { alignSelf: 'center', marginTop: 12 }]} color={shimmerColor} />
      <ShimmerBox style={[styles.line30, { alignSelf: 'center', marginTop: 6 }]} color={shimmerColor} />
      {/* Info rows */}
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={styles.infoRow}>
          <ShimmerBox style={styles.infoIcon} color={shimmerColor} />
          <View style={{ flex: 1, gap: 5 }}>
            <ShimmerBox style={styles.line30} color={shimmerColor} />
            <ShimmerBox style={styles.line60} color={shimmerColor} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Public API ──────────────────────────────────────────────
export default function SkeletonLoader({ type = 'product', count = 6 }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  // Mid-tone gray that reads as "loading" against either a white or a dark
  // slate card — reuses the grayLight token rather than a new fixed hex.
  const shimmerColor = COLORS.grayLight;

  if (type === 'product') {
    const pairs = Math.ceil(count / 2);
    return (
      <View style={styles.productGrid}>
        {Array.from({ length: pairs }).map((_, i) => (
          <View key={i} style={styles.productRow}>
            <ProductCardSkeleton styles={styles} shimmerColor={shimmerColor} />
            <ProductCardSkeleton styles={styles} shimmerColor={shimmerColor} />
          </View>
        ))}
      </View>
    );
  }

  if (type === 'order') {
    return (
      <View style={styles.listWrap}>
        {Array.from({ length: count }).map((_, i) => (
          <OrderCardSkeleton key={i} styles={styles} shimmerColor={shimmerColor} />
        ))}
      </View>
    );
  }

  if (type === 'cart') {
    return (
      <View style={styles.listWrap}>
        {Array.from({ length: count }).map((_, i) => (
          <CartItemSkeleton key={i} styles={styles} shimmerColor={shimmerColor} />
        ))}
      </View>
    );
  }

  if (type === 'profile') {
    return <ProfileSkeleton styles={styles} shimmerColor={shimmerColor} />;
  }

  return null;
}

// ─── Styles ──────────────────────────────────────────────────
const CARD_W = (SCREEN_W - 16 * 2 - 8) / 2; // matches HomeScreen productRow gap

const makeStyles = (COLORS) => StyleSheet.create({
  // Product grid
  productGrid: { padding: 16, paddingTop: 8 },
  productRow:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  productCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  productImg:  { height: 110, width: '100%', borderRadius: 0 },
  productBody: { padding: 8, gap: 2 },

  // Order card
  listWrap:    { padding: 16, gap: 12 },
  orderCard:   {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusBadge:     { width: 70, height: 20, borderRadius: 10 },
  smallBtn:        { width: 80, height: 28, borderRadius: 6 },

  // Cart item
  cartItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cartImg:  { width: 72, height: 72, borderRadius: 8 },
  cartBody: { flex: 1, gap: 0 },

  // Profile
  profileWrap: { padding: 20 },
  avatar:      { width: 80, height: 80, borderRadius: 40, alignSelf: 'center' },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  infoIcon:    { width: 32, height: 32, borderRadius: 8 },

  // Generic lines
  line100: { height: 13, width: '100%' },
  line80:  { height: 13, width: '80%' },
  line60:  { height: 12, width: '60%' },
  line50:  { height: 12, width: '50%' },
  line40:  { height: 11, width: '40%' },
  line30:  { height: 11, width: '30%' },
  btnBar:  { height: 28, width: '100%', borderRadius: 6 },
});
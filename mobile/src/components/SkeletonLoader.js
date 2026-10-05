import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Shimmer base ────────────────────────────────────────
function ShimmerBox({ style }) {
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
    <Animated.View style={[styles.shimmer, style, { opacity }]} />
  );
}

// ─── Product card skeleton (matches HomeScreen 2-col grid) ──
function ProductCardSkeleton() {
  return (
    <View style={styles.productCard}>
      <ShimmerBox style={styles.productImg} />
      <View style={styles.productBody}>
        <ShimmerBox style={styles.line100} />
        <ShimmerBox style={[styles.line60, { marginTop: 5 }]} />
        <ShimmerBox style={[styles.line40, { marginTop: 5 }]} />
        <ShimmerBox style={[styles.line50, { marginTop: 8 }]} />
        <ShimmerBox style={[styles.btnBar, { marginTop: 10 }]} />
      </View>
    </View>
  );
}

// ─── Order card skeleton (matches OrdersScreen list) ────────
function OrderCardSkeleton() {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardTop}>
        <ShimmerBox style={styles.line50} />
        <ShimmerBox style={styles.statusBadge} />
      </View>
      <ShimmerBox style={[styles.line80, { marginTop: 8 }]} />
      <ShimmerBox style={[styles.line60, { marginTop: 6 }]} />
      <View style={styles.orderCardBottom}>
        <ShimmerBox style={styles.line40} />
        <ShimmerBox style={styles.smallBtn} />
      </View>
    </View>
  );
}

// ─── Cart item skeleton (matches CartScreen list) ────────────
function CartItemSkeleton() {
  return (
    <View style={styles.cartItem}>
      <ShimmerBox style={styles.cartImg} />
      <View style={styles.cartBody}>
        <ShimmerBox style={styles.line80} />
        <ShimmerBox style={[styles.line50, { marginTop: 6 }]} />
        <ShimmerBox style={[styles.line40, { marginTop: 6 }]} />
      </View>
    </View>
  );
}

// ─── Profile skeleton (matches ProfileScreen) ────────────────
function ProfileSkeleton() {
  return (
    <View style={styles.profileWrap}>
      {/* Avatar */}
      <ShimmerBox style={styles.avatar} />
      <ShimmerBox style={[styles.line50, { alignSelf: 'center', marginTop: 12 }]} />
      <ShimmerBox style={[styles.line30, { alignSelf: 'center', marginTop: 6 }]} />
      {/* Info rows */}
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={styles.infoRow}>
          <ShimmerBox style={styles.infoIcon} />
          <View style={{ flex: 1, gap: 5 }}>
            <ShimmerBox style={styles.line30} />
            <ShimmerBox style={styles.line60} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Public API ──────────────────────────────────────────────
export default function SkeletonLoader({ type = 'product', count = 6 }) {
  if (type === 'product') {
    const pairs = Math.ceil(count / 2);
    return (
      <View style={styles.productGrid}>
        {Array.from({ length: pairs }).map((_, i) => (
          <View key={i} style={styles.productRow}>
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </View>
        ))}
      </View>
    );
  }

  if (type === 'order') {
    return (
      <View style={styles.listWrap}>
        {Array.from({ length: count }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (type === 'cart') {
    return (
      <View style={styles.listWrap}>
        {Array.from({ length: count }).map((_, i) => (
          <CartItemSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (type === 'profile') {
    return <ProfileSkeleton />;
  }

  return null;
}

// ─── Styles ──────────────────────────────────────────────────
const CARD_W = (SCREEN_W - 16 * 2 - 8) / 2; // matches HomeScreen productRow gap

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: '#d1d5db',
    borderRadius: 6,
  },

  // Product grid
  productGrid: { padding: 16, paddingTop: 8 },
  productRow:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
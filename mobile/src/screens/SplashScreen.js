import React, { useEffect } from 'react';
import {
  View, Image, Text, StyleSheet, Animated,
} from 'react-native';
import { COLORS, APP_NAME, APP_SUBTITLE } from '../utils/constants';

export default function SplashScreen({ navigation }) {
  const fadeAnim  = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Fade in + scale up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue:        1,
        duration:       800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue:        1,
        friction:       5,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to Home after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Main');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.logoWrap,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.appSub}>{APP_SUBTITLE}</Text>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={styles.footerText}>
          © 2026 Triple E & Fiel Collins General Merchandise
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoWrap: {
    alignItems: 'center',
    gap:        16,
  },
  logo: {
    width:        110,
    height:       110,
    borderRadius: 24,
    shadowColor:  COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation:    10,
  },
  appName: {
    fontSize:   22,
    fontWeight: '700',
    color:      COLORS.white,
    textAlign:  'center',
    marginTop:  8,
  },
  appSub: {
    fontSize:  13,
    color:     COLORS.grayLight,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom:   32,
  },
  footerText: {
    fontSize: 11,
    color:    COLORS.grayLight,
    opacity:  0.6,
  },
});
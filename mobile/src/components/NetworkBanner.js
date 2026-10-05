import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Feather from 'react-native-vector-icons/Feather';

export default function NetworkBanner() {
  const [isConnected, setIsConnected] = useState(true);
  const [showBack,    setShowBack]    = useState(false); // show "Back online" briefly
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const prevConnected = useRef(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable !== false;

      if (!connected && prevConnected.current) {
        // Just went offline
        setIsConnected(false);
        setShowBack(false);
        slide('in');
      } else if (connected && !prevConnected.current) {
        // Just came back online
        setIsConnected(true);
        setShowBack(true);
        // Auto-hide "Back online" after 2.5 s
        setTimeout(() => slide('out', () => setShowBack(false)), 2500);
      }

      prevConnected.current = connected;
    });

    return () => unsub();
  }, []);

  function slide(direction, cb) {
    Animated.timing(slideAnim, {
      toValue:        direction === 'in' ? 0 : -60,
      duration:       300,
      useNativeDriver: true,
    }).start(cb);
  }

  // Nothing to show — fully hidden
  if (isConnected && !showBack) return null;

  const offline  = !isConnected;
  const bg       = offline ? '#ef4444' : '#22c55e';
  const icon     = offline ? 'wifi-off' : 'wifi';
  const message  = offline ? 'No internet connection' : 'Back online';

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
      <Feather name={icon} size={14} color="#fff" style={{ marginRight: 6 }}/>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  text: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '600',
  },
});
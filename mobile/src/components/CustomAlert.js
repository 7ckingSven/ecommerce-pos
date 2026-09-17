/**
 * CustomAlert — Reusable styled alert modal
 * ==========================================
 * Replaces plain Alert.alert() with beautiful branded modals
 *
 * Usage:
 *   const { alertConfig, showAlert, hideAlert } = useCustomAlert();
 *   <CustomAlert config={alertConfig} onHide={hideAlert} />
 *
 *   showAlert({
 *     type: 'success',           // 'success' | 'error' | 'warning' | 'confirm' | 'info'
 *     title: 'Added to Cart!',
 *     message: 'Item added successfully.',
 *     buttons: [
 *       { text: 'Continue', onPress: () => {} },
 *       { text: 'View Cart', onPress: () => {}, style: 'primary' },
 *     ]
 *   });
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { COLORS, RADIUS, SPACING } from '../utils/constants';

const { width } = Dimensions.get('window');

// ─── Alert Type Config ────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  success: {
    icon:      '✅',
    color:     COLORS.primary,
    bgColor:   '#f0fdf4',
    iconColor: COLORS.primary,
  },
  error: {
    icon:      '❌',
    color:     COLORS.error,
    bgColor:   '#fef2f2',
    iconColor: COLORS.error,
  },
  warning: {
    icon:      '⚠️',
    color:     COLORS.warning,
    bgColor:   '#fffbeb',
    iconColor: COLORS.warning,
  },
  confirm: {
    icon:      '❓',
    color:     '#3b82f6',
    bgColor:   '#eff6ff',
    iconColor: '#3b82f6',
  },
  info: {
    icon:      'ℹ️',
    color:     '#6b7280',
    bgColor:   '#f9fafb',
    iconColor: '#6b7280',
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCustomAlert() {
  const [alertConfig, setAlertConfig] = useState(null);

  function showAlert({ type = 'info', title, message, buttons = [{ text: 'OK' }] }) {
    setAlertConfig({ type, title, message, buttons });
  }

  function hideAlert() {
    setAlertConfig(null);
  }

  return { alertConfig, showAlert, hideAlert };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CustomAlert({ config, onHide }) {
  const scaleAnim  = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (config) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1, useNativeDriver: true,
          tension: 100, friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1, duration: 200, useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [config]);

  if (!config) return null;

  const tc      = TYPE_CONFIG[config.type] || TYPE_CONFIG.info;
  const buttons = config.buttons || [{ text: 'OK' }];

  function handlePress(btn) {
    onHide();
    if (btn.onPress) btn.onPress();
  }

  return (
    <Modal transparent visible={!!config} animationType="none" onRequestClose={onHide}>
      <View style={styles.overlay}>
        <Animated.View style={[
          styles.modal,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim }
        ]}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: tc.bgColor }]}>
            <Text style={styles.icon}>{tc.icon}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{config.title}</Text>

          {/* Message */}
          {config.message ? (
            <Text style={styles.message}>{config.message}</Text>
          ) : null}

          {/* Buttons */}
          <View style={[
            styles.btnRow,
            buttons.length === 1 && { justifyContent: 'center' }
          ]}>
            {buttons.map((btn, i) => {
              const isPrimary  = btn.style === 'primary';
              const isDanger   = btn.style === 'danger';
              const isDefault  = !isPrimary && !isDanger;

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    buttons.length === 1 && { flex: 0, minWidth: 120 },
                    isPrimary && { backgroundColor: tc.color, borderColor: tc.color },
                    isDanger  && { backgroundColor: COLORS.error, borderColor: COLORS.error },
                    isDefault && { backgroundColor: 'transparent', borderColor: COLORS.grayBorder },
                  ]}
                  onPress={() => handlePress(btn)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.btnText,
                    isPrimary && { color: '#fff' },
                    isDanger  && { color: '#fff' },
                    isDefault && { color: COLORS.textSecondary },
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         SPACING.lg,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius:    RADIUS.lg,
    padding:         SPACING.lg,
    width:           Math.min(width - 48, 340),
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.15,
    shadowRadius:    24,
    elevation:       12,
  },
  iconWrap: {
    width:         64,
    height:        64,
    borderRadius:  32,
    alignItems:    'center',
    justifyContent:'center',
    marginBottom:  SPACING.md,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize:   17,
    fontWeight: '700',
    color:      COLORS.dark,
    textAlign:  'center',
    marginBottom: 6,
  },
  message: {
    fontSize:     13,
    color:        COLORS.textSecondary,
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: SPACING.md,
  },
  btnRow: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     SPACING.sm,
    width:         '100%',
  },
  btn: {
    flex:           1,
    paddingVertical:11,
    paddingHorizontal: SPACING.sm,
    borderRadius:   RADIUS.sm,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize:   13,
    fontWeight: '600',
  },
});
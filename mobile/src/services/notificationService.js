import { Platform, PermissionsAndroid } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import api from './api';
import { getCustomerId } from './authService';

// Your installed version (@react-native-firebase/messaging ^26.x) is on
// the newer modular API — functions take the messaging instance as their
// first argument, instead of the old callable messaging() singleton.
const messagingInstance = getMessaging(getApp());

// ─── Permission ─────────────────────────────────────────
// Android 13+ (API 33+) requires an explicit runtime permission before
// ANY notification can show — this was almost certainly the single
// biggest reason notifications never appeared at all: nothing in the
// app was ever asking for it, so the OS silently suppressed every one.
export async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    } catch (e) {
      console.warn('Notification permission request failed:', e);
    }
  }
  // FCM's own permission gate — required on iOS, a harmless no-op
  // confirmation on Android.
  try {
    await requestPermission(messagingInstance);
  } catch (e) {
    console.warn('FCM permission request failed:', e);
  }
}

// ─── Token registration ─────────────────────────────────
// Fetches this device's FCM token and saves it to the customer record
// via /api/customer/fcm-token so admin_update_order() can find it later.
export async function registerFcmToken() {
  try {
    const customerId = await getCustomerId();
    if (!customerId) return; // not logged in yet
    const token = await getToken(messagingInstance);
    if (!token) return;
    await api.post(
      '/customer/fcm-token',
      { fcm_token: token },
      { headers: { 'X-Customer-ID': customerId } }
    );
    console.log('FCM token registered.');
  } catch (e) {
    console.warn('FCM token registration failed:', e);
  }
}

// Firebase occasionally rotates the token — keep the backend's copy current.
export function listenForTokenRefresh() {
  return onTokenRefresh(messagingInstance, async (token) => {
    try {
      const customerId = await getCustomerId();
      if (!customerId) return;
      await api.post(
        '/customer/fcm-token',
        { fcm_token: token },
        { headers: { 'X-Customer-ID': customerId } }
      );
    } catch (e) {
      console.warn('FCM token refresh save failed:', e);
    }
  });
}

// ─── Foreground messages ────────────────────────────────
// FCM deliberately does NOT auto-display a system notification while
// the app is open in the foreground (only in background/killed states),
// so this Alert stands in as the visible confirmation. Swap for a
// nicer in-app banner (or add `notifee` for a real system-style
// foreground notification) whenever you want something fancier.
export function listenForForegroundMessages(onMessageCallback) {
  return onMessage(messagingInstance, async (remoteMessage) => {
    if (onMessageCallback) onMessageCallback(remoteMessage);
  });
}

// ─── Tapped-notification navigation ─────────────────────
// Lets tapping a notification (from background OR a fully killed app)
// route the user straight to a screen, e.g. Orders.
export function setupNotificationOpenHandlers(onNotificationTap) {
  const unsubscribeOpened = onNotificationOpenedApp(messagingInstance, (remoteMessage) => {
    if (remoteMessage && onNotificationTap) onNotificationTap(remoteMessage);
  });

  getInitialNotification(messagingInstance).then((remoteMessage) => {
    if (remoteMessage && onNotificationTap) onNotificationTap(remoteMessage);
  });

  return unsubscribeOpened;
}
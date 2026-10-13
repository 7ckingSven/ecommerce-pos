/**
 * @format
 */
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Must be registered here, outside the component tree, before the app
// component is registered — this is what lets FCM notifications be
// handled while the app is backgrounded or fully killed. Without this,
// React Native Firebase never wires up background delivery at all.
setBackgroundMessageHandler(getMessaging(getApp()), async remoteMessage => {
  console.log('FCM background message:', remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
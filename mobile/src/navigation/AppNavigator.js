import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Feather from 'react-native-vector-icons/Feather';

import SplashScreen        from '../screens/SplashScreen';
import LoginScreen         from '../screens/LoginScreen';
import RegisterScreen      from '../screens/RegisterScreen';
import HomeScreen          from '../screens/HomeScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen          from '../screens/CartScreen';
import CheckoutScreen      from '../screens/CheckoutScreen';
import OrdersScreen        from '../screens/OrdersScreen';
import ProfileScreen       from '../screens/ProfileScreen';

import { COLORS } from '../utils/constants';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── Home Stack ───────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain"       component={HomeScreen}/>
      <Stack.Screen name="ProductDetail"  component={ProductDetailScreen}/>
    </Stack.Navigator>
  );
}

// ─── Cart Stack ───────────────────────────────────────
function CartStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CartMain"  component={CartScreen}/>
      <Stack.Screen name="Checkout"  component={CheckoutScreen}/>
    </Stack.Navigator>
  );
}

// ─── Main Tabs ────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor:  COLORS.white,
          borderTopWidth:   1,
          borderTopColor:   COLORS.grayBorder,
          height:           65,
          paddingBottom:    8,
          paddingTop:       8,
        },
        tabBarShowLabel:      true,
        tabBarLabelStyle:     { fontSize: 10, fontWeight: '600' },
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarIcon: ({ color }) => {
          const icons = {
            Home:    'home',
            Cart:    'shopping-cart',
            Orders:  'package',
            Profile: 'user',
          };
          return <Feather name={icons[route.name]} size={22} color={color}/>;
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeStack}/>
      <Tab.Screen name="Cart"    component={CartStack}/>
      <Tab.Screen name="Orders"  component={OrdersScreen}/>
      <Tab.Screen name="Profile" component={ProfileScreen}/>
    </Tab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        {/* Splash — shows first, auto navigates to Main */}
        <Stack.Screen name="Splash"   component={SplashScreen}/>

        {/* Auth screens */}
        <Stack.Screen name="Login"    component={LoginScreen}/>
        <Stack.Screen name="Register" component={RegisterScreen}/>

        {/* Main app with bottom tabs */}
        <Stack.Screen name="Main"     component={MainTabs}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
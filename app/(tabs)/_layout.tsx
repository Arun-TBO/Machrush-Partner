import { Tabs } from 'expo-router';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { SuspendedScreen } from '@/components/SuspendedScreen';
import { useSuspendedAccountGuard } from '@/hooks/use-suspended-account-guard';

const homeTabImage = require('@/assets/images/home-tab-home.png');
const deliveriesTabImage = require('@/assets/images/home-tab-deliveries.png');
const profileTabImage = require('@/assets/images/home-tab-profile.png');

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isSuspended = useSuspendedAccountGuard();

  if (isSuspended) {
    return <SuspendedScreen />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0055cc',
        tabBarInactiveTintColor: '#606060',
        headerShown: false,
        tabBarButton: HapticTab,
        sceneStyle: styles.scene,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 85 + insets.bottom,
            paddingBottom: 12 + insets.bottom,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIconSlot,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Image source={homeTabImage} style={[styles.tabIcon, { tintColor: color }]} resizeMode="contain" />
          ),
        }}
      />
      <Tabs.Screen
        name="my-deliveries"
        options={{
          title: 'My Deliveries',
          tabBarIcon: ({ color }) => (
            <Image source={deliveriesTabImage} style={[styles.tabIcon, { tintColor: color }]} resizeMode="contain" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Image source={profileTabImage} style={[styles.tabIcon, { tintColor: color }]} resizeMode="contain" />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: '#eff2f6',
  },
  tabBar: {
    height: 85,
    borderTopWidth: 1,
    borderTopColor: '#a4cbff',
    backgroundColor: '#eff2f6',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  tabIconSlot: {
    marginTop: 4,
  },
  tabIcon: {
    width: 28,
    height: 28,
  },
  tabLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
});

import { Tabs } from 'expo-router';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { SuspendedScreen } from '@/components/SuspendedScreen';
import { useSuspendedAccountGuard } from '@/hooks/use-suspended-account-guard';

const homeTabImage = require('@/assets/images/home-tab-home.png');
const inActiveHome = require('@/assets/images/inActiveHome.png');
const deliveriesTabImage = require('@/assets/images/home-tab-deliveries.png');
const profileTabImage = require('@/assets/images/home-tab-profile.png');
const tabProfileActive = require('@/assets/images/profile/tab-profile-active.png')
const inActiveProfile =  require('@/assets/images/inActiveProfile.png');
const tab2 = require('@/assets/images/Yes.png')
const tab2Inactive = require('@/assets/images/tab2.png')

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isSuspended = useSuspendedAccountGuard();

  if (isSuspended) {
    return <SuspendedScreen />;
  }

  return (
    <Tabs
  screenOptions={{
    headerShown: false,

    tabBarActiveTintColor: '#0055CC',
    tabBarInactiveTintColor: '#9CA3AF',

    tabBarStyle: [
      styles.tabBar,
      {
        height: 85 + insets.bottom,
        paddingBottom: 12 + insets.bottom,
      },
    ],

    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: '500',
    },
  }}
>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
         tabBarIcon: ({ focused, color }) => (

 

  <Image
    source={ focused ?  homeTabImage : inActiveHome}
    resizeMode="contain"
    style={[
      styles.tabIcon,
      
    ]}
  />
),
        }}
      />
      <Tabs.Screen
        name="my-deliveries"
        options={{
          title: 'My Deliveries',
          tabBarIcon: ({focused , color }) => (
            focused ?  <Image source={ tab2} style={[styles.tabIcon2]} resizeMode="contain" /> :

            
            <Image source={deliveriesTabImage} style={[styles.tabIcon]} resizeMode="contain" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({focused , color }) => (
            <Image source={ focused ? tabProfileActive :inActiveProfile } style={[styles.tabIcon]} resizeMode="contain" />
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
    width: 22,
    height: 22,
  },
  tabIcon2: {
    width: 35,
    height: 35,
  },
  tabLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
});

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { getDriverProfile, OnboardingData } from '@/lib/firestoreOnboardingService';

const backImage = require('@/assets/images/profile/back.png');
const closedBodyImage = require('@/assets/images/vehicle-details/closed-body.png');
const openedBodyImage = require('@/assets/images/vehicle-details/opened-body.png');

type VehicleFieldProps = {
  label: string;
  value: string;
};

type BodyTypeCardProps = {
  label: string;
  image: ImageSourcePropType;
  selected: boolean;
  imageStyle?: object;
};

function TopNav() {
  const router = useRouter();

  return (
    <View style={styles.navShell}>
      <View style={styles.statusSpacer} />
      <View style={styles.topNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Image source={backImage} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.navTitle}>Vehicle details</Text>
      </View>
    </View>
  );
}

function VehicleField({ label, value }: VehicleFieldProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.valueBox}>
        <Text style={styles.valueText} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function BodyTypeCard({ label, image, selected, imageStyle }: BodyTypeCardProps) {
  return (
    <View style={styles.bodyTypeCard}>
      <View style={[styles.bodyImageFrame, selected ? styles.bodyImageFrameSelected : null]}>
        <Image source={image} style={[styles.bodyImage, imageStyle]} resizeMode="contain" />
      </View>
      <Text style={styles.bodyTypeLabel}>{label}</Text>
    </View>
  );
}

const normalizeBodyType = (value: string | undefined) => value?.trim().toLowerCase() || '';

export default function VehicleDetailsProfileScreen() {
  const [driverProfile, setDriverProfile] = React.useState<OnboardingData | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadDriverProfile = async () => {
        const [storedUid, storedIdToken] = await Promise.all([
          AsyncStorage.getItem('firebaseUid'),
          AsyncStorage.getItem('firebaseIdToken'),
        ]);
        const uid = auth.currentUser?.uid || storedUid;

        if (!uid) {
          if (isActive) {
            setDriverProfile(null);
          }
          return;
        }

        const profile = await getDriverProfile(uid, storedIdToken);

        if (isActive) {
          setDriverProfile(profile);
        }
      };

      loadDriverProfile();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const selectedBodyType = normalizeBodyType(driverProfile?.bodyType);
  const isClosedSelected = selectedBodyType.includes('closed');
  const isOpenedSelected = selectedBodyType.includes('open') || !isClosedSelected;

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Vehicle details</Text>
          <Text style={styles.description}>These details are verified and can’t be edited</Text>
        </View>

        <View style={styles.fields}>
          <VehicleField
            label="Vehicle Number"
            value={driverProfile?.vehicleNumber || 'e.g.TN 01 AB 1234'}
          />
          <VehicleField label="Vehicle type" value={driverProfile?.vehicleType || 'Pickup 9ft'} />
          <VehicleField
            label="Enter vehicle capacity"
            value={driverProfile?.vehicleCapacity || '500kg'}
          />

          <View style={styles.bodyTypeSection}>
            <Text style={styles.fieldLabel}>Select Body type</Text>
            <View style={styles.bodyTypesRow}>
              <BodyTypeCard
                label="Closed Body"
                image={closedBodyImage}
                selected={isClosedSelected}
                imageStyle={styles.closedBodyImage}
              />
              <BodyTypeCard
                label="Opened Body"
                image={openedBodyImage}
                selected={isOpenedSelected}
                imageStyle={styles.openedBodyImage}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  navShell: {
    backgroundColor: '#ffffff',
  },
  statusSpacer: {
    height: 52,
  },
  topNav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  navTitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    gap: 8,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -1,
  },
  description: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  fields: {
    width: '100%',
    gap: 24,
    marginTop: 24,
  },
  fieldBlock: {
    width: '100%',
    gap: 16,
  },
  fieldLabel: {
    width: '100%',
    color: '#a4a4a4',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  valueBox: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a4a4a4',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  valueText: {
    width: '100%',
    color: '#a4a4a4',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyTypeSection: {
    width: '100%',
    gap: 16,
  },
  bodyTypesRow: {
    width: 264,
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
      marginBottom : 20
  },
  bodyTypeCard: {
    flex: 1,
    minWidth: 0,
    gap: 12,
    alignItems: 'center',
  },
  bodyImageFrame: {
    width: 116,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#e8e8e8',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyImageFrameSelected: {
    borderWidth: 2.5,
    borderColor: '#0055cc',
  },
  bodyImage: {
    width: 151,
    height: 88,
  },
  closedBodyImage: {
    width: 190,
    height: 98,
    marginLeft: -70,
    marginTop: 18,
  },
  openedBodyImage: {
    width: 151,
    height: 86,
    marginLeft: -34,
    marginTop: 10,
  },
  bodyTypeLabel: {
    color: '#2c2c2c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    textAlign: 'center',
  },
});

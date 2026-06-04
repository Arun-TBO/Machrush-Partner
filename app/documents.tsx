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
const verifiedStatusImage = require('@/assets/images/documents/verified-status.png');
const uploadFilesImage = require('@/assets/images/documents/upload-files.png');
const vehiclePhotoOneImage = require('@/assets/images/documents/vehicle-photo-1.png');
const vehiclePhotoTwoImage = require('@/assets/images/documents/vehicle-photo-2.png');
const vehiclePhotoThreeImage = require('@/assets/images/documents/vehicle-photo-3.png');

const fallbackVehiclePhotos = [
  vehiclePhotoOneImage,
  vehiclePhotoTwoImage,
  vehiclePhotoThreeImage,
  vehiclePhotoThreeImage,
];

const toImageSource = (uri: string | undefined, fallback: ImageSourcePropType) => {
  return uri ? { uri } : fallback;
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
        <Text style={styles.navTitle}>Documents</Text>
      </View>
    </View>
  );
}

function VerifiedStatus() {
  return (
    <View style={styles.statusRow}>
      <Image source={verifiedStatusImage} style={styles.statusIcon} resizeMode="contain" />
      <Text style={styles.statusText}>Verified</Text>
    </View>
  );
}

function DocumentRow({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image: ImageSourcePropType;
}) {
  return (
    <View style={styles.documentRow}>
      <View style={styles.documentTextBlock}>
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentDescription}>{description}</Text>
        <VerifiedStatus />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} document`}
        style={styles.uploadButton}
      >
        <Image source={image} style={styles.uploadImage} resizeMode="cover" />
      </Pressable>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

function VehiclePhotosRow({ photos }: { photos: ImageSourcePropType[] }) {
  return (
    <View style={styles.vehiclePhotosRow}>
      {photos.map((photo, index) => (
        <View key={`${index}`} style={styles.vehiclePhotoFrame}>
          <Image source={photo} style={styles.vehiclePhoto} resizeMode="cover" />
        </View>
      ))}
    </View>
  );
}

function VehiclePhotosDocument({ photos }: { photos: ImageSourcePropType[] }) {
  return (
    <View style={styles.vehiclePhotosDocument}>
      <View style={styles.vehiclePhotoTextBlock}>
        <Text style={styles.documentTitle}>Vehicle photos</Text>
        <Text style={styles.documentDescription}>Your vehicle photos are verified</Text>
        <VerifiedStatus />
      </View>
      <VehiclePhotosRow photos={photos} />
    </View>
  );
}

export default function DocumentsScreen() {
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

  const personalDocuments = React.useMemo(
    () => [
      {
        id: 'driving-license',
        title: 'Driving License',
        description: 'Your license is verified',
        image: toImageSource(driverProfile?.drivingLicenseUri, uploadFilesImage),
      },
      {
        id: 'identity-proof',
        title: 'Identity Proof',
        description: 'Your identity is verified',
        image: toImageSource(driverProfile?.identityProofUri, uploadFilesImage),
      },
    ],
    [driverProfile]
  );

  const vehicleDocuments = React.useMemo(
    () => [
      {
        id: 'rc-book',
        title: 'RC Book',
        description: 'Your RC book is verified',
        image: toImageSource(driverProfile?.rcBookUri, uploadFilesImage),
      },
      {
        id: 'insurance',
        title: 'Insurance',
        description: 'Your Insurance is verified',
        image: toImageSource(driverProfile?.insuranceUri, uploadFilesImage),
      },
    ],
    [driverProfile]
  );

  const vehiclePhotos = React.useMemo(() => {
    const uploadedPhotos =
      driverProfile?.vehiclePhotoUris
        ?.filter((uri): uri is string => Boolean(uri))
        .slice(0, 4)
        .map((uri) => ({ uri })) || [];

    return fallbackVehiclePhotos.map((fallback, index) => uploadedPhotos[index] || fallback);
  }, [driverProfile]);

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Your Documents">
          {personalDocuments.map((document) => (
            <DocumentRow
              key={document.id}
              title={document.title}
              description={document.description}
              image={document.image}
            />
          ))}
        </Section>

        <Section title="Vehicle Documents">
          {vehicleDocuments.map((document) => (
            <DocumentRow
              key={document.id}
              title={document.title}
              description={document.description}
              image={document.image}
            />
          ))}
          <VehiclePhotosDocument photos={vehiclePhotos} />
        </Section>
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
    fontFamily: 'Poppins',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
    color: '#1c1c1c',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 40,
  },
  section: {
    width: '100%',
    gap: 16,
  },
  sectionTitle: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#1c1c1c',
  },
  sectionRows: {
    width: '100%',
  },
  documentRow: {
    width: '100%',
    minHeight: 113,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    paddingHorizontal: 8,
    paddingVertical: 24,
  },
  documentTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'flex-start',
  },
  documentTitle: {
    fontFamily: 'Poppins',
    fontSize: 18,
    fontWeight: '500',
    color: '#1c1c1c',
  },
  documentDescription: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#606060',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIcon: {
    width: 16,
    height: 16,
  },
  statusText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#1fc16b',
  },
  uploadButton: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  vehiclePhotosDocument: {
    width: '100%',
    justifyContent: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 12,
  },
  vehiclePhotoTextBlock: {
    width: '100%',
    gap: 4,
    alignItems: 'flex-start',
  },
  vehiclePhotosRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  vehiclePhotoFrame: {
    flex: 1,
    aspectRatio: 1,
    minWidth: 0,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  vehiclePhoto: {
    width: '100%',
    height: '100%',
  },
});

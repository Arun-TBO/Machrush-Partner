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
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '@/lib/firebase';
import {
  generateDriverDocumentPreview,
  getDriverProfile,
  OnboardingData,
} from '@/lib/firestoreOnboardingService';

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

// ---------------------------------------------------------------------------
// Non-image document helpers — PDFs (and other document formats) cannot be
// rendered by RN's Image component. The backend generates a first-page PNG
// preview for PDFs (`<field>PreviewUri`); until one exists we show a file
// badge, and tapping it opens the document in the system viewer.
// ---------------------------------------------------------------------------

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'dwg',
  'dxf',
  'step',
  'stp',
]);

const getPathExtension = (uri?: string | null) => {
  if (!uri) return '';
  const path = String(uri).split('?')[0];
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1].toLowerCase() : '';
};

const openDocumentExternally = async (targetUri?: string | null) => {
  if (!targetUri) return;
  try {
    await WebBrowser.openBrowserAsync(targetUri);
  } catch (error) {
    console.warn('Failed to open document:', error);
  }
};

function DocumentFileBadge({ label, style }: { label: string; style?: object }) {
  return (
    <View style={[styles.fileBadge, style]}>
      <Ionicons name="document-text" size={26} color="#e53935" />
      <Text style={styles.fileBadgeLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function DocumentThumbnail({
  uri,
  previewUri,
  fallback,
  style,
}: {
  uri?: string | null;
  previewUri?: string | null;
  fallback: ImageSourcePropType;
  style?: object;
}) {
  const [loadFailed, setLoadFailed] = React.useState(false);
  const extension = getPathExtension(uri);
  const isDocumentFile = DOCUMENT_EXTENSIONS.has(extension);
  const showFileBadge = isDocumentFile || (!!uri && loadFailed);

  if (showFileBadge) {
    const label = extension ? extension.toUpperCase().slice(0, 4) : 'FILE';
    return <DocumentFileBadge label={label} style={style} />;
  }

  if (previewUri) {
    return (
      <Image
        source={{ uri: previewUri }}
        style={style}
        resizeMode="cover"
        onError={() => setLoadFailed(true)}
      />
    );
  }

  return (
    <Image
      source={uri ? { uri } : fallback}
      style={style}
      resizeMode="cover"
      onError={() => {
        if (uri) setLoadFailed(true);
      }}
    />
  );
}

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
      <Text style={styles.statusText} numberOfLines={1}>Verified</Text>
    </View>
  );
}

function DocumentRow({
  title,
  description,
  uri,
  previewUri,
}: {
  title: string;
  description: string;
  uri?: string | null;
  previewUri?: string | null;
}) {
  return (
    <View style={styles.documentRow}>
      <View style={styles.documentTextBlock}>
        <Text style={styles.documentTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.documentDescription} numberOfLines={1}>{description}</Text>
        <VerifiedStatus />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} document`}
        style={styles.uploadButton}
        disabled={!uri}
        onPress={() => openDocumentExternally(uri)}
      >
        <DocumentThumbnail
          uri={uri}
          previewUri={previewUri}
          fallback={uploadFilesImage}
          style={styles.uploadImage}
        />
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
        <Text style={styles.documentTitle} numberOfLines={1}>Vehicle photos</Text>
        <Text style={styles.documentDescription} numberOfLines={1}>Your vehicle photos are verified</Text>
        <VerifiedStatus />
      </View>
      <VehiclePhotosRow photos={photos} />
    </View>
  );
}

export default function DocumentsScreen() {
  const [driverProfile, setDriverProfile] = React.useState<OnboardingData | null>(null);
  // Tracks which document fields we already asked the backend to backfill a
  // first-page preview for, so the 5s polling loop never retries endlessly.
  const previewBackfillAttemptedRef = React.useRef<Set<string>>(new Set());

  const requestMissingPreviews = React.useCallback(async (profile: OnboardingData | null) => {
    if (!profile) return;
    const uid = auth.currentUser?.uid || (await AsyncStorage.getItem('firebaseUid'));
    if (!uid) return;
    const storedIdToken = await AsyncStorage.getItem('firebaseIdToken');

    const documentFields: (
      | ['drivingLicenseUri' | 'identityProofUri' | 'rcBookUri' | 'insuranceUri', string | undefined]
    )[] = [
      ['drivingLicenseUri', profile.drivingLicensePreviewUri],
      ['identityProofUri', profile.identityProofPreviewUri],
      ['rcBookUri', profile.rcBookPreviewUri],
      ['insuranceUri', profile.insurancePreviewUri],
    ];

    let generatedAny = false;
    for (const [field, previewUri] of documentFields) {
      const documentUri = profile[field];
      if (!documentUri || previewUri) continue;
      // Only ask for previews of non-image files; images render directly.
      if (!DOCUMENT_EXTENSIONS.has(getPathExtension(documentUri))) continue;
      const backfillKey = `${uid}:${field}`;
      if (previewBackfillAttemptedRef.current.has(backfillKey)) continue;
      previewBackfillAttemptedRef.current.add(backfillKey);

      const generatedPreviewUri = await generateDriverDocumentPreview(uid, field, storedIdToken);
      if (generatedPreviewUri) generatedAny = true;
    }

    if (generatedAny) {
      const refreshedProfile = await getDriverProfile(uid, storedIdToken);
      setDriverProfile((current) => refreshedProfile || current);
    }
  }, []);

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
          // Fire-and-forget: backfill first-page previews for stored PDFs.
          requestMissingPreviews(profile);
        }
      };

      loadDriverProfile();
      const interval = setInterval(loadDriverProfile, 5000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [requestMissingPreviews])
  );

  const personalDocuments = React.useMemo(
    () => [
      {
        id: 'driving-license',
        title: 'Driving License',
        description: 'Your license is verified',
        uri: driverProfile?.drivingLicenseUri || '',
        previewUri: driverProfile?.drivingLicensePreviewUri || '',
      },
      {
        id: 'identity-proof',
        title: 'Identity Proof',
        description: 'Your identity is verified',
        uri: driverProfile?.identityProofUri || '',
        previewUri: driverProfile?.identityProofPreviewUri || '',
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
        uri: driverProfile?.rcBookUri || '',
        previewUri: driverProfile?.rcBookPreviewUri || '',
      },
      {
        id: 'insurance',
        title: 'Insurance',
        description: 'Your Insurance is verified',
        uri: driverProfile?.insuranceUri || '',
        previewUri: driverProfile?.insurancePreviewUri || '',
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
              uri={document.uri}
              previewUri={document.previewUri}
            />
          ))}
        </Section>

        <Section title="Vehicle Documents">
          {vehicleDocuments.map((document) => (
            <DocumentRow
              key={document.id}
              title={document.title}
              description={document.description}
              uri={document.uri}
              previewUri={document.previewUri}
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
    minHeight: 64,
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
    flex: 1,
    minWidth: 0,
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
    maxWidth: 412,
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
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -1,
  },
  sectionRows: {
    width: '100%',
  },
  documentRow: {
    width: '100%',
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
    flexShrink: 1,
    gap: 4,
    alignItems: 'flex-start',
  },
  documentTitle: {
    minWidth: 0,
    flexShrink: 1,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    fontWeight: '500',
  },
  documentDescription: {
    minWidth: 0,
    flexShrink: 1,
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  statusIcon: {
    width: 16,
    height: 16,
  },
  statusText: {
    minWidth: 0,
    flexShrink: 1,
    color: '#1fc16b',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  uploadButton: {
    width: 64,
    minHeight: 64,
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
  fileBadge: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  fileBadgeLabel: {
    maxWidth: 56,
    color: '#e53935',
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
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

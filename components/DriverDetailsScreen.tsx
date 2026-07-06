import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Animated,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/lib/theme';
import { fs } from '@/lib/responsive';
import { useAppAlert } from './AppAlertModal';

const uploadIcon = require('@/assets/images/uploadIcon.png');
const CloseButton = require('@/assets/images/Close button.png');

const isPdfFile = (uri?: string) => {
  return Boolean(uri && /\.pdf($|\?)/i.test(uri));
};

interface DriverDetailsScreenProps {
  onContinue?: (data: DriverDetailsData) => void;
  onBack?: () => void;
  initialData?: Partial<DriverDetailsData> | null;
}

interface DriverDetailsData {
  fullName: string;
  photoUri?: string;
  drivingLicenseUri?: string;
  identityProofUri?: string;
}

export const DriverDetailsScreen: React.FC<DriverDetailsScreenProps> = ({
  onContinue,
  onBack,
  initialData,
}) => {
  const insets = useSafeAreaInsets();
  const { alertModal, showAlert } = useAppAlert();
  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [photoUri, setPhotoUri] = useState<string | undefined>(initialData?.photoUri);
  const [drivingLicenseUri, setDrivingLicenseUri] = useState<string | undefined>(
    initialData?.drivingLicenseUri
  );
  const [identityProofUri, setIdentityProofUri] = useState<string | undefined>(
    initialData?.identityProofUri
  );
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation on mount
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!initialData) {
      return;
    }

    setFullName(initialData.fullName || '');
    setPhotoUri(initialData.photoUri);
    setDrivingLicenseUri(initialData.drivingLicenseUri);
    setIdentityProofUri(initialData.identityProofUri);
  }, [initialData]);

  const pickImage = async (type: 'photo' | 'license' | 'identity') => {
    try {
      if (type !== 'photo') {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          multiple: false,
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets?.[0]) {
          const uri = result.assets[0].uri;
          if (type === 'license') {
            setDrivingLicenseUri(uri);
          } else {
            setIdentityProofUri(uri);
          }
        }

        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== 'granted') {
        showAlert('Permission Required', 'Permission to access camera is required.');
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
      };

      const result = await ImagePicker.launchCameraAsync(pickerOptions);

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setPhotoUri(uri);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      showAlert('Upload Failed', 'Failed to pick file. Please try again.');
    }
  };

  const removeImage = (type: 'photo' | 'license' | 'identity') => {
    if (type === 'photo') {
      setPhotoUri(undefined);
    } else if (type === 'license') {
      setDrivingLicenseUri(undefined);
    } else if (type === 'identity') {
      setIdentityProofUri(undefined);
    }
  };

  const isFormValid = Boolean(
    fullName.trim() && photoUri && drivingLicenseUri && identityProofUri
  );

  const handleContinue = async () => {
    if (!isFormValid) {
      showAlert('Incomplete Form', 'Please fill in all required fields and upload all documents.');
      return;
    }

    setIsLoading(true);
    try {
      if (onContinue) {
        onContinue({
          fullName: fullName.trim(),
          photoUri,
          drivingLicenseUri,
          identityProofUri,
        });
      }
    } catch (error) {
      console.error('Error submitting driver details:', error);
      showAlert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  

  return ( 
    <SafeAreaView style={styles.container}>
      <View style={styles.statusSpacer} />

      {/* Header */}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Onboarding</Text>
      </View>

      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        {/* Main Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.contentContainer,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
          >
            {/* Title and Description */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Fill your details</Text>
              <Text style={styles.subtitle}>Complete 3 more steps to start earning</Text>
            </View>

            {/* Form Container */}
            <View style={styles.formContainer}>
              {/* Full Name Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.nameInput}
                    placeholder="Enter your name"
                    placeholderTextColor={Colors.neutral700}
                    value={fullName}
                    onChangeText={setFullName}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Upload Documents Section */}
              <View style={styles.documentsSection}>
                <Text style={styles.documentsLabel}>Upload documents</Text>

                {/* Your Photo */}
                <DocumentUploadItem
                  title="Your Photo"
                  description="Please check and upload again"
                  hasError={!photoUri}
                  imageUri={photoUri}
                  onUpload={() => pickImage('photo')}
                  onRemove={() => removeImage('photo')}
                  isLoading={isLoading}
                />

                {/* Driving License */}
                <DocumentUploadItem
                  title="Driving License"
                  description="Upload a clear photo or PDF of your driving license"
                  hasError={!drivingLicenseUri}
                  imageUri={drivingLicenseUri}
                  onUpload={() => pickImage('license')}
                  onRemove={() => removeImage('license')}
                  isLoading={isLoading}
                />

                {/* Identity Proof */}
                <DocumentUploadItem
                  title="Identity Proof"
                  description="Upload Aadhaar or PAN card photo or PDF"
                  hasError={!identityProofUri}
                  imageUri={identityProofUri}
                  onUpload={() => pickImage('identity')}
                  onRemove={() => removeImage('identity')}
                  isLoading={isLoading}
                />
              </View>

              {/* Continue Button */}
              <Pressable
                style={[
                  styles.continueButton,
                  (!isFormValid || isLoading) && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!isFormValid || isLoading}
              >
                <Text style={styles.continueButtonText}>
                  {isLoading ? 'Processing...' : 'Continue'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
      {alertModal}
    </SafeAreaView>
  );
};

interface DocumentUploadItemProps {
  title: string;
  description: string;
  hasError: boolean;
  imageUri?: string;
  onUpload: () => void;
  onRemove: () => void;
  isLoading: boolean;
}

const DocumentUploadItem: React.FC<DocumentUploadItemProps> = ({
  title,
  description,
  hasError,
  imageUri,
  onUpload,
  onRemove,
  isLoading,
}) => {
  return (
    <View style={styles.documentItem}>
      {/* Left side: Info */}
      <View style={styles.documentInfo}>
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentDescription}>{description}</Text>
        {hasError && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Upload ${title}`}
            style={styles.errorContainer}
            onPress={onUpload}
            disabled={isLoading}
          >
             <Image source={uploadIcon} style={{height : 20 , width  : 20}}/>
            <Text style={styles.errorText}>Upload</Text>
          </Pressable>
        )}
      </View>

      {/* Right side: Upload box or Image */}
      <View style={styles.documentUploadBox}>
        {imageUri ? (
          <View style={styles.uploadedImageContainer}>
            {isPdfFile(imageUri) ? (
              <View style={styles.pdfPreview}>
                <Text style={styles.pdfPreviewText}>PDF</Text>
              </View>
            ) : (
              <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
            )}
            <Pressable
              style={styles.removeButton}
              onPress={onRemove}
              disabled={isLoading}
            >
              <Image source={CloseButton} style={styles.removeButtonIcon}/>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.uploadButton}
            onPress={onUpload}
            disabled={isLoading}
          >
            <Text style={styles.uploadButtonText}>Upload</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  statusSpacer: {
    height: 52,
    backgroundColor: '#ffffff',
  },

  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#ffffff',
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
  },
  // Content Wrapper
  contentWrapper: {
    flex: 1,
  },

  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 412,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 24,
  },

  // Title Container
  titleContainer: {
    gap: 12,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(40),
    fontWeight: '500',
    lineHeight: 48,
  },
  subtitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },

  // Form Container
  formContainer: {
    gap: 24,
  },

  // Field Group
  fieldGroup: {
    gap: 16,
  },
  fieldLabel: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  inputWrapper: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#8e8e8e',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nameInput: {
    minHeight: 56,
    color: '#1c1c1c',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },

  // Documents Section
  documentsSection: {
    gap: 16,
  },
  documentsLabel: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },

  // Document Item
  documentItem: {
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentInfo: {
    gap: 4,
    flex: 1,
    minWidth: 0,
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
  errorContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  retryIcon: {
    color: '#0055cc',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
  },
  errorText: {
    minWidth: 0,
    flexShrink: 1,
    color: '#0055cc',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Document Upload Box
  documentUploadBox: {
    
  },
  uploadButton: {
    width: 64,
    height: 64,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#a4a4a4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  uploadedImageContainer: {
    width: 64,
    height: 64,
   position: 'relative',
  alignSelf: 'flex-start',
  overflow: 'visible',
    borderRadius: 12,

  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  pdfPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d2d2d2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPreviewText: {
    color: '#0055cc',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    top: -1,
    right: -5,
    zIndex: 10,
      elevation: 5, // Android
  },
  removeButtonIcon: {
    height : 20,
    width : 20
  },

  // Continue Button
  continueButton: {
    backgroundColor: '#05c',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    flexShrink: 1,
    color: 'white',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.5,
  },
});

export default DriverDetailsScreen;

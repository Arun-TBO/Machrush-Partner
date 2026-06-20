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
import { Colors } from '@/lib/theme';

const backImage = require('@/assets/images/profile/back.png');
const uploadIcon = require('@/assets/images/uploadIcon.png');
const CloseButton = require('@/assets/images/Close button.png');
import { fs, hit, rs, vs } from '@/lib/responsive';

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

  const pickImage = async (
    type: 'photo' | 'license' | 'identity',
  ) => {
    try {
      const permission =
        type === 'photo'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        alert(
          type === 'photo'
            ? 'Permission to access camera is required!'
            : 'Permission to access media library is required!'
        );
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
      };

      const result =
        type === 'photo'
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (type === 'photo') {
          setPhotoUri(uri);
        } else if (type === 'license') {
          setDrivingLicenseUri(uri);
        } else if (type === 'identity') {
          setIdentityProofUri(uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert('Failed to pick image');
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

  const isFormValid =
    fullName.trim().length > 0 && photoUri && drivingLicenseUri && identityProofUri;

  const handleContinue = async () => {
    if (!isFormValid) {
      alert('Please fill all required fields');
      return;
    }

    setIsLoading(true);
    try {
      if (onContinue) {
        onContinue({
          fullName,
          photoUri,
          drivingLicenseUri,
          identityProofUri,
        });
      }
    } catch (error) {
      console.error('Error submitting driver details:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  

  return ( 
    <SafeAreaView style={styles.container}>
      <View style={styles.statusSpacer} />

      {/* Header */}

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={styles.backButton}
        >
          <Image source={backImage} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.headerTitle}>Onboarding</Text>
      </View>

      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        {/* Main Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
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
                  description="Upload a clear photo of your driving license"
                  hasError={!drivingLicenseUri}
                  imageUri={drivingLicenseUri}
                  onUpload={() => pickImage('license')}
                  onRemove={() => removeImage('license')}
                  isLoading={isLoading}
                />

                {/* Identity Proof */}
                <DocumentUploadItem
                  title="Identity Proof"
                  description="Upload Aadhaar or PAN card"
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
          <View style={styles.errorContainer}>
             <Image source={uploadIcon} style={{height : 20 , width  : 20}}/>
            <Text style={styles.errorText}>Upload</Text>
          </View>
        )}
      </View>

      {/* Right side: Upload box or Image */}
      <View style={styles.documentUploadBox}>
        {imageUri ? (
          <View style={styles.uploadedImageContainer}>
            <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
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
    paddingHorizontal: 4,
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
    gap: 40,
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
    gap: 40,
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
    minHeight: 56,
    backgroundColor: '#05c',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom : 15
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

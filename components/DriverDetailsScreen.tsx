import { Colors } from '@/lib/theme';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ICONS from '../constants/icons';

interface DriverDetailsScreenProps {
  onContinue?: (data: DriverDetailsData) => void;
  onBack?: () => void;
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
}) => {
  const [fullName, setFullName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [drivingLicenseUri, setDrivingLicenseUri] = useState<string | undefined>();
  const [identityProofUri, setIdentityProofUri] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();
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

  // Request permissions
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access media library is required!');
      }
    })();
  }, []);

  const pickImage = async (
    type: 'photo' | 'license' | 'identity',
  ) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
      });

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
      {/* Top Container */}
   
    <View style={styles.headerTopContainer} >
    
    </View>
     
      {/* Header */}
      <View style={styles.header}>

        <Pressable onPress={onBack} style={styles.backButton}>
         <Image source={ICONS.LeftArrow} style={styles.backButtonIcon} />
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

            </View>
          </View>
        </ScrollView>
            <View style={styles.contentContainer }>
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
             
      </Animated.View>

      {/* Navigation Handle */}
   
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
    <TouchableOpacity style={styles.documentItem}  onPress={onUpload}>
      {/* Left side: Info */}
      <View style={styles.documentInfo} >
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentDescription}>{description}</Text>
        {hasError && (
          <View style={styles.errorContainer}>
            <Image source={ICONS.UploadIcon } style={styles.uploadIcon} />
            <Text style={styles.uploadText}>Upload</Text>
          </View>
        )}
      </View>

      {/* Right side: Upload box or Image */}
      <View style={styles.documentUploadBox}>
        {imageUri ? (
            <View style={styles.uploadedCanelContainer}>

                 <View style={styles.uploadedImageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
                
          </View>

           <Pressable
              style={styles.removeButton}
              onPress={onRemove}
              disabled={isLoading}
            >
              <Text style={styles.removeButtonIcon}>{'✕'}</Text>
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },

  
  // Header
  headerTopContainer : {
    height: 36,
    backgroundColor : 'white'
  },
  header: {
    height: 64,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 2,
  },
  backButton: {
    width: 48,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
   backButtonIcon: {
    width: 41,
    height: 41
  },
  backButtonText: {
    fontSize: 24,
    color: '#1c1c1c',
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    textAlign: 'center',
    flex: -1,
    alignSelf: 'center',
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
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 40,
  },

  // Title Container
  titleContainer: {
    gap: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
   
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
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
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
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
    height: 56,
    fontSize: 16,
    fontWeight: '400',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 24,
  },

  // Documents Section
  documentsSection: {
    gap: 16,
  },
  documentsLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
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
    alignItems: 'flex-start',
  },
  documentInfo: {
    gap: 4,
    flex: 1,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  documentDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  uploadIcon: {
    width: 12,
    height: 12,
    // tintColor: '#d00416',
  },
  uploadText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#0055CC',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },

  // Document Upload Box
  documentUploadBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
  },
  uploadButton: {
    width: 64,
    height: 64,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#a4a4a4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
uploadedCanelContainer : {
   flexDirection: 'row',
},
  uploadedImageContainer: {
    width: 70,
    height: 64,
    position: 'relative',
    borderRadius: 8,
    overflow: 'visible',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -0,
    right: -0,
    width: 22,
    height: 22,
    borderRadius: 20,
    backgroundColor: '#d00416',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  removeButtonIcon: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    fontFamily: 'Poppins',
  },

  // Continue Button
  continueButton: {
    height: 56,
    backgroundColor: '#05c',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  continueButtonDisabled: {
    backgroundColor: '#a4a4a4',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    fontFamily: 'Poppins',
    lineHeight: 20,
    letterSpacing: -0.5,
  },

  // Navigation Handle
  navigationHandle: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: '#eff2f6',
  },
  handleBar: {
    width: 108,
    height: 4,
    backgroundColor: '#1d1b20',
    borderRadius: 12,
  },
});

export default DriverDetailsScreen;

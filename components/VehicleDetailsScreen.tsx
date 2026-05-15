import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Modal,
  FlatList,
  SafeAreaView,
  Animated,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/lib/theme';

interface VehicleDetailsScreenProps {
  onContinue?: (vehicleData: VehicleDetailsData) => void;
  onBack?: () => void;
}

interface VehicleDetailsData {
  vehicleNumber: string;
  vehicleType: string;
  vehicleCapacity: string;
  bodyType: string;
  rcBook: string | null;
  insurance: string | null;
  vehiclePhotos: string[];
}

const VEHICLE_TYPES = ['2-Wheeler', '3-Wheeler', 'Auto', 'Car', 'Truck', 'Mini Truck'];
const BODY_TYPES = [
  { id: 'closed', label: 'Closed Body', image: 'closed-vehicle' },
  { id: 'open', label: 'Opened Body', image: 'open-vehicle' },
];

export const VehicleDetailsScreen: React.FC<VehicleDetailsScreenProps> = ({
  onContinue,
  onBack,
}) => {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('');
  const [selectedBodyType, setSelectedBodyType] = useState('');
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  const [isRCExpanded, setIsRCExpanded] = useState(false);
  const [isInsuranceExpanded, setIsInsuranceExpanded] = useState(false);
  const [isPhotosExpanded, setIsPhotosExpanded] = useState(false);
  
  // File URIs
  const [rcBookUri, setRcBookUri] = useState<string | null>(null);
  const [rcBookFileName, setRcBookFileName] = useState<string>('');
  const [insuranceUri, setInsuranceUri] = useState<string | null>(null);
  const [insuranceFileName, setInsuranceFileName] = useState<string>('');
  const [vehiclePhotoUris, setVehiclePhotoUris] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);

  const insets = useSafeAreaInsets();

  // Request permissions and open image picker
  const requestMediaPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need permission to access your photo library');
      return false;
    }
    return true;
  };

  // Pick single file for RC book or Insurance
  const pickSingleFile = async (type: 'rc' | 'insurance') => {
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'file';
        
        if (type === 'rc') {
          setRcBookUri(asset.uri);
          setRcBookFileName(fileName);
        } else {
          setInsuranceUri(asset.uri);
          setInsuranceFileName(fileName);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Pick multiple images for vehicle photos
  const pickMultiplePhotos = async () => {
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const uris = result.assets.map((asset) => asset.uri);
        setVehiclePhotoUris((prev) => [...prev, ...uris].slice(0, 4)); // Max 4 photos
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick photos');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove RC book
  const removeRcBook = () => {
    setRcBookUri(null);
    setRcBookFileName('');
  };

  // Remove insurance
  const removeInsurance = () => {
    setInsuranceUri(null);
    setInsuranceFileName('');
  };

  // Remove vehicle photo
  const removeVehiclePhoto = (index: number) => {
    setVehiclePhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVehicleTypeSelect = (type: string) => {
    setVehicleType(type);
    setShowVehicleTypeModal(false);
  };

  const isFormValid = vehicleNumber && vehicleType && vehicleCapacity && selectedBodyType && rcBookUri && insuranceUri && vehiclePhotoUris.length > 0;

  const handleContinue = () => {
    if (!isFormValid) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields and upload all documents');
      return;
    }

    if (onContinue) {
      onContinue({
        vehicleNumber,
        vehicleType,
        vehicleCapacity,
        bodyType: selectedBodyType,
        rcBook: rcBookUri,
        insurance: insuranceUri,
        vehiclePhotos: vehiclePhotoUris,
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.navTitle}>Onboarding</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Vehicle details</Text>
          <Text style={styles.subtitle}>Complete 3 more steps to start earning</Text>
        </View>

        {/* Vehicle Number Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Vehicle Number</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. TN 01 AB 1234"
            placeholderTextColor={Colors.neutral800}
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
          />
        </View>

        {/* Vehicle Type Dropdown */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Vehicle type</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setShowVehicleTypeModal(true)}
          >
            <Text
              style={[
                styles.dropdownText,
                { color: vehicleType ? Colors.neutral900 : Colors.neutral800 },
              ]}
            >
              {vehicleType || 'Select Vehicle type'}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </Pressable>
        </View>

        {/* Vehicle Capacity Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Enter vehicle capacity</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 500kg"
            placeholderTextColor={Colors.neutral800}
            value={vehicleCapacity}
            onChangeText={setVehicleCapacity}
          />
        </View>

        {/* Body Type Selection */}
        <View style={styles.bodyTypeSection}>
          <Text style={styles.inputLabel}>Select Body type</Text>
          <View style={styles.bodyTypeContainer}>
            {BODY_TYPES.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.bodyTypeCard,
                  selectedBodyType === type.id && styles.bodyTypeCardSelected,
                ]}
                onPress={() => setSelectedBodyType(type.id)}
              >
                <View style={styles.bodyTypeImage}>
                  <View
                    style={[
                      styles.vehicleImagePlaceholder,
                      { backgroundColor: Colors.neutral200 },
                    ]}
                  >
                    <Text style={styles.imageText}>🚚</Text>
                  </View>
                </View>
                <Text style={styles.bodyTypeLabel}>{type.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upload Documents Section */}
        <View style={styles.documentsSection}>
          <Text style={styles.inputLabel}>Upload documents</Text>

          {/* RC Book */}
          <View style={styles.documentItem}>
            <View style={styles.documentContent}>
              <Text style={styles.documentTitle}>RC book</Text>
              <Text style={styles.documentSubtitle}>Upload RC book photo or PDF</Text>
              {!rcBookUri && (
                <View style={styles.errorContainer}>
                  <Text style={styles.retryIcon}>↻</Text>
                  <Text style={styles.errorText}>Upload again</Text>
                </View>
              )}
              {rcBookUri && (
                <View style={styles.uploadedFileContainer}>
                  <Text style={styles.uploadedFileName}>✓ {rcBookFileName}</Text>
                </View>
              )}
            </View>
            {!rcBookUri ? (
              <Pressable
                style={styles.uploadButtonSmall}
                onPress={() => pickSingleFile('rc')}
                disabled={isLoading}
              >
                <Text style={styles.uploadButtonSmallText}>Upload</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.uploadButtonSmall, styles.removeButton]}
                onPress={removeRcBook}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Insurance */}
          <View style={styles.documentItem}>
            <View style={styles.documentContent}>
              <Text style={styles.documentTitle}>Insurance</Text>
              <Text style={styles.documentSubtitle}>Upload insurance photo or PDF</Text>
              {!insuranceUri && (
                <View style={styles.errorContainer}>
                  <Text style={styles.retryIcon}>↻</Text>
                  <Text style={styles.errorText}>Upload again</Text>
                </View>
              )}
              {insuranceUri && (
                <View style={styles.uploadedFileContainer}>
                  <Text style={styles.uploadedFileName}>✓ {insuranceFileName}</Text>
                </View>
              )}
            </View>
            {!insuranceUri ? (
              <Pressable
                style={styles.uploadButtonSmall}
                onPress={() => pickSingleFile('insurance')}
                disabled={isLoading}
              >
                <Text style={styles.uploadButtonSmallText}>Upload</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.uploadButtonSmall, styles.removeButton]}
                onPress={removeInsurance}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Vehicle Photos */}
          <Pressable
            style={[styles.documentItem, styles.vehiclePhotosItem]}
            onPress={() => setIsPhotosExpanded(!isPhotosExpanded)}
          >
            <View style={styles.documentContent}>
              <Text style={styles.documentTitle}>Vehicle photos</Text>
              <Text style={styles.documentSubtitle}>Front, back & side photos</Text>
              {vehiclePhotoUris.length > 0 && (
                <Text style={styles.uploadedCount}>✓ {vehiclePhotoUris.length} photo(s) uploaded</Text>
              )}
            </View>
            <Text style={[styles.expandIcon, isPhotosExpanded && styles.expandIconOpen]}>
              ›
            </Text>
          </Pressable>

          {isPhotosExpanded && (
            <View style={styles.photoThumbnailsContainer}>
              {vehiclePhotoUris.length === 0 ? (
                <Pressable
                  style={styles.addPhotoButton}
                  onPress={pickMultiplePhotos}
                  disabled={isLoading}
                >
                  <Text style={styles.addPhotoIcon}>+</Text>
                  <Text style={styles.addPhotoText}>Add Photos</Text>
                </Pressable>
              ) : (
                <>
                  {vehiclePhotoUris.map((uri, index) => (
                    <View key={index} style={styles.photoThumbnail}>
                      <Image source={{ uri }} style={styles.photoImage} />
                      <Pressable
                        style={styles.removePhotoButton}
                        onPress={() => removeVehiclePhoto(index)}
                      >
                        <Text style={styles.removePhotoIcon}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                  {vehiclePhotoUris.length < 4 && (
                    <Pressable
                      style={styles.addMorePhotoButton}
                      onPress={pickMultiplePhotos}
                      disabled={isLoading}
                    >
                      <Text style={styles.addMorePhotoIcon}>+</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* Continue Button */}
        <Pressable
          style={[styles.continueButton, !isFormValid && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!isFormValid}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Vehicle Type Modal */}
      <Modal
        visible={showVehicleTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVehicleTypeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowVehicleTypeModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle Type</Text>
              <Pressable onPress={() => setShowVehicleTypeModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              data={VEHICLE_TYPES}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalOption}
                  onPress={() => handleVehicleTypeSelect(item)}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Navigation Handle */}
   
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },

  // Top Navigation
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    height: 64,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#1c1c1c',
  },
  navTitle: {
    fontSize: 30,
    fontWeight: '600',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 32,
    textAlign: 'center',
    flex: -1,
    alignSelf: 'center',
  },

  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 24,
    gap: 24,
  },

  // Header Section
  headerSection: {
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 48,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 24,
  },

  // Input Section
  inputSection: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 24,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8e8e8e',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: '400',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 24,
    height: 56,
  },

  // Dropdown
  dropdownButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8e8e8e',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'Poppins',
    lineHeight: 24,
    flex: 1,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#606060',
  },

  // Body Type Section
  bodyTypeSection: {
    gap: 16,
  },
  bodyTypeContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  bodyTypeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  bodyTypeCardSelected: {
    borderColor: '#05c',
  },
  bodyTypeImage: {
    width: '100%',
    aspectRatio: 1.16,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  vehicleImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageText: {
    fontSize: 32,
  },
  bodyTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c2c2c',
    fontFamily: 'Poppins',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Documents Section
  documentsSection: {
    marginBottom: Spacing.lg,
    gap: 24,
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    gap: 12,
  },
  vehiclePhotosItem: {
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0,
  },
  documentContent: {
    flex: 1,
    gap: 4,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  documentSubtitle: {
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
  retryIcon: {
    fontSize: 12,
    fontWeight: '400',
    color: '#d00416',
    fontFamily: 'Poppins',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#d00416',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  uploadedFileContainer: {
    marginTop: 4,
  },
  uploadedFileName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#05c',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  uploadedCount: {
    fontSize: 12,
    fontWeight: '400',
    color: '#05c',
    fontFamily: 'Poppins',
    lineHeight: 18,
    marginTop: 4,
  },
  expandIcon: {
    fontSize: 20,
    color: '#606060',
    transform: [{ rotate: '0deg' }],
  },
  expandIconOpen: {
    transform: [{ rotate: '90deg' }],
  },

  // Upload Button Small (inline)
  uploadButtonSmall: {
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
  uploadButtonSmallText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#606060',
    fontFamily: 'Poppins',
    lineHeight: 18,
  },
  removeButton: {
    backgroundColor: '#d00416',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 20,
    fontWeight: '400',
    color: 'white',
    fontFamily: 'Poppins',
  },

  // Vehicle Photos Thumbnails
  photoThumbnailsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    flexWrap: 'wrap',
  },
  photoThumbnail: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    backgroundColor: '#d00416',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoIcon: {
    fontSize: 16,
    fontWeight: '400',
    color: 'white',
    fontFamily: 'Poppins',
  },
  addPhotoButton: {
    width: '100%',
    aspectRatio: 1.5,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoIcon: {
    fontSize: 32,
    color: '#606060',
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#606060',
    fontFamily: 'Poppins',
  },
  addMorePhotoButton: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePhotoIcon: {
    fontSize: 28,
    color: '#606060',
  },

  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  photoPlaceholderText: {
    fontSize: 32,
  },

  // Upload Prompt (old - keeping for reference)
  uploadPrompt: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.neutral100,
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral100,
    fontFamily: 'Poppins',
  },

  // Continue Button
  continueButton: {
    backgroundColor: '#05c',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 24,
    height: 56,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    fontFamily: 'Poppins',
    lineHeight: 20,
    letterSpacing: -0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.neutral100,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.neutral900,
    fontFamily: 'Poppins',
  },
  closeIcon: {
    fontSize: 24,
    color: Colors.neutral800,
  },
  modalOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutral900,
    fontFamily: 'Poppins',
  },

  // Navigation Handle
  navigationHandle: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  handleBar: {
    width: 108,
    height: 4,
    backgroundColor: Colors.neutral900,
    borderRadius: 12,
  },
});

export default VehicleDetailsScreen;

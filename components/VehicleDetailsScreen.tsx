import React, { useEffect, useState } from 'react';
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
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius } from '@/lib/theme';

const backImage = require('@/assets/images/profile/back.png');
const closedBodyImage = require('@/assets/images/vehicle-details/closed-body.png');
const openedBodyImage = require('@/assets/images/vehicle-details/opened-body.png');

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

interface VehicleOption {
  id: string;
  name: string;
  capacity: string;
}

const BODY_TYPES = [
  { id: 'closed', label: 'Closed Body', image: closedBodyImage },
  { id: 'open', label: 'Opened Body', image: openedBodyImage },
];

const getApiBaseUrl = () => {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
};

const getVehicleName = (vehicle: Record<string, any>) => {
  return (
    vehicle.name ||
    vehicle.vehicleName ||
    vehicle.title ||
    vehicle.type ||
    vehicle.vehicleType ||
    ''
  ).toString();
};

const getVehicleCapacity = (vehicle: Record<string, any>) => {
  const capacity =
    vehicle.capacity ||
    vehicle.vehicleCapacity ||
    vehicle.loadCapacity ||
    vehicle.maxCapacity ||
    vehicle.weightCapacity ||
    '';

  return capacity ? capacity.toString() : '';
};

export const VehicleDetailsScreen: React.FC<VehicleDetailsScreenProps> = ({
  onContinue,
  onBack,
}) => {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('');
  const [selectedBodyType, setSelectedBodyType] = useState('');
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  
  // File URIs
  const [rcBookUri, setRcBookUri] = useState<string | null>(null);
  const [rcBookFileName, setRcBookFileName] = useState<string>('');
  const [insuranceUri, setInsuranceUri] = useState<string | null>(null);
  const [insuranceFileName, setInsuranceFileName] = useState<string>('');
  const [vehiclePhotoUris, setVehiclePhotoUris] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadVehicleOptions = async () => {
      try {
        setIsLoadingVehicles(true);
        const response = await fetch(`${getApiBaseUrl()}/api/deliveries/vehicles`);
        const responseBody = await response.json().catch(() => null);

        if (!response.ok || !responseBody?.success || !Array.isArray(responseBody.data)) {
          throw new Error(responseBody?.error || 'Failed to load vehicle types');
        }

        const options = responseBody.data
          .map((vehicle: Record<string, any>) => ({
            id: (vehicle.id || getVehicleName(vehicle)).toString(),
            name: getVehicleName(vehicle),
            capacity: getVehicleCapacity(vehicle),
          }))
          .filter((vehicle: VehicleOption) => vehicle.id && vehicle.name);

        if (isMounted) {
          setVehicleOptions(options);
        }
      } catch (error) {
        console.error('Error loading vehicle types:', error);
        if (isMounted) {
          setVehicleOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingVehicles(false);
        }
      }
    };

    loadVehicleOptions();

    return () => {
      isMounted = false;
    };
  }, []);

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

  // Pick one image for a specific vehicle photo slot
  const pickVehiclePhoto = async (slotIndex: number) => {
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setVehiclePhotoUris((prev) => {
          const next = [...prev];
          next[slotIndex] = uri;
          return next.slice(0, 4);
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick photo');
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
    setVehiclePhotoUris((prev) => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
  };

  const handleVehicleTypeSelect = (vehicle: VehicleOption) => {
    setVehicleType(vehicle.name);
    setVehicleCapacity(vehicle.capacity);
    setShowVehicleTypeModal(false);
  };

  const uploadedVehiclePhotos = vehiclePhotoUris.filter(Boolean);

  const isFormValid = vehicleNumber && vehicleType && vehicleCapacity && selectedBodyType && rcBookUri && insuranceUri && uploadedVehiclePhotos.length > 0;

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
        vehiclePhotos: uploadedVehiclePhotos,
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusSpacer} />

      {/* Top Navigation */}
      <View style={styles.topNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={onBack}
        >
          <Image source={backImage} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.navTitle}>Onboarding</Text>
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
            style={[styles.dropdownButton, isLoadingVehicles && styles.dropdownButtonDisabled]}
            onPress={() => setShowVehicleTypeModal(true)}
            disabled={isLoadingVehicles}
          >
            <Text
              style={[
                styles.dropdownText,
                { color: vehicleType ? Colors.neutral900 : Colors.neutral800 },
              ]}
            >
              {vehicleType || (isLoadingVehicles ? 'Loading vehicle types...' : 'Select Vehicle type')}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </Pressable>
        </View>

        {/* Vehicle Capacity Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Enter vehicle capacity</Text>
          <TextInput
            style={[styles.textInput, styles.readOnlyInput]}
            placeholder="Select vehicle type first"
            placeholderTextColor={Colors.neutral800}
            value={vehicleCapacity}
            editable={false}
          />
        </View>

        {/* Body Type Selection */}
        <View style={styles.bodyTypeSection}>
          <Text style={styles.inputLabel}>Select Body type</Text>
          <View style={styles.bodyTypeContainer}>
            {BODY_TYPES.map((type) => (
              <Pressable
                key={type.id}
                style={styles.bodyTypeCard}
                onPress={() => setSelectedBodyType(type.id)}
              >
                <View
                  style={[
                    styles.bodyTypeImage,
                    selectedBodyType === type.id && styles.bodyTypeCardSelected,
                  ]}
                >
                  <Image
                    source={type.image}
                    style={[
                      styles.bodyTypeVehicleImage,
                      type.id === 'closed' ? styles.closedBodyImage : styles.openedBodyImage,
                    ]}
                    resizeMode="contain"
                  />
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

          <View style={styles.vehiclePhotosBlock}>
            <View style={styles.vehiclePhotoTextBlock}>
              <Text style={styles.documentTitle}>Vehicle photos</Text>
              <Text style={styles.documentSubtitle}>Front, back & side photos</Text>
            </View>

            <View style={styles.vehiclePhotosGrid}>
              {[0, 1, 2, 3].map((slotIndex) => {
                const photoUri = vehiclePhotoUris[slotIndex];

                return photoUri ? (
                  <View key={slotIndex} style={styles.vehiclePhotoPanel}>
                    <Image source={{ uri: photoUri }} style={styles.vehiclePhotoImage} />
                    <Pressable
                      style={styles.removePhotoButton}
                      onPress={() => removeVehiclePhoto(slotIndex)}
                      disabled={isLoading}
                    >
                      <Text style={styles.removePhotoIcon}>x</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    key={slotIndex}
                    style={styles.vehiclePhotoPanel}
                    onPress={() => pickVehiclePhoto(slotIndex)}
                    disabled={isLoading}
                  >
                    <Text style={styles.vehiclePhotoPlus}>+</Text>
                    <Text style={styles.vehiclePhotoUploadText}>Upload</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
                <Text style={styles.closeIcon}>x</Text>
              </Pressable>
            </View>

            {isLoadingVehicles ? (
              <Text style={styles.modalEmptyText}>Loading vehicle types...</Text>
            ) : vehicleOptions.length === 0 ? (
              <Text style={styles.modalEmptyText}>No vehicle types found</Text>
            ) : (
              <FlatList
                data={vehicleOptions}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.modalOption}
                    onPress={() => handleVehicleTypeSelect(item)}
                  >
                    <View style={styles.modalOptionTextGroup}>
                      <Text style={styles.modalOptionText}>{item.name}</Text>
                      {item.capacity ? (
                        <Text style={styles.modalOptionSubtext}>{item.capacity}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
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

  // Top Navigation
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    height: 64,
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
  navTitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 32,
  },

  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  scrollContent: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 24,
  },

  // Header Section
  headerSection: {
    gap: 12,
  },
  title: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 40,
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

  // Input Section
  inputSection: {
    gap: 16,
  },
  inputLabel: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#8e8e8e',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#1c1c1c',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    height: 56,
  },
  readOnlyInput: {
    backgroundColor: '#f8f8f8',
    color: '#606060',
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
  dropdownButtonDisabled: {
    opacity: 0.7,
  },
  dropdownText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
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
    width: 264,
  },
  bodyTypeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  bodyTypeImage: {
    width: 116,
    height: 100,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bodyTypeCardSelected: {
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#05c',
  },
  bodyTypeVehicleImage: {
    width: 120,
    height: 98,
  },
  closedBodyImage: {
    width: 190,
    height: 98,
    marginLeft: -70,
    marginTop: 18,
  },
  openedBodyImage: {
    width: 117,
    height: 85,
    marginLeft: -34,
    marginTop: 10,
  },
  bodyTypeLabel: {
    color: '#2c2c2c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Documents Section
  documentsSection: {
    gap: 24,
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    gap: 12,
  },
  documentContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  documentTitle: {
    color: '#1c1c1c',
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 18,
  },
  documentSubtitle: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
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
    color: '#0055cc',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  uploadedFileContainer: {
    marginTop: 4,
  },
  uploadedFileName: {
    color: '#05c',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  vehiclePhotosBlock: {
    width: '100%',
    justifyContent: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  vehiclePhotoTextBlock: {
    width: '100%',
    gap: 4,
  },
  vehiclePhotosGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  vehiclePhotoPanel: {
    flex: 1,
    minWidth: 0,
    height: 86,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  vehiclePhotoImage: {
    width: '100%',
    height: '100%',
  },
  vehiclePhotoPlus: {
    fontSize: 28,
    color: '#606060',
    lineHeight: 32,
  },
  vehiclePhotoUploadText: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Upload Button Small (inline)
  uploadButtonSmall: {
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
  uploadButtonSmallText: {
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
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

  // Continue Button
  continueButton: {
    backgroundColor: '#05c',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    fontWeight: '500',
    color: Colors.neutral900,
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
  modalOptionTextGroup: {
    gap: 4,
  },
  modalOptionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutral900,
  },
  modalOptionSubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    fontWeight: '400',
    color: '#606060',
    lineHeight: 18,
  },
  modalEmptyText: {
    paddingVertical: Spacing.lg,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    fontWeight: '400',
    color: '#606060',
    textAlign: 'center',
  },
});

export default VehicleDetailsScreen;

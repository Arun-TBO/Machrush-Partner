import { Colors, Radius, Spacing } from '@/lib/theme';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ICONS from '../constants/icons';
import IMAGES from '../constants/images';

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
  { id: 'closed', label: 'Closed Body', Activeimage: IMAGES.NonActiveTrck , nonActiveImage: IMAGES.ActiveTrck },
  { id: 'open', label: 'Opened Body', Activeimage: IMAGES.BodyOpenNonActiveTrak , nonActiveImage: IMAGES.BodyOpenActiveTrak },
];

const AddVehiclePhotosData = [{
     id : 'front',
     text : 'Front side',}
     ,
     {
      id : 'Left',
     text : 'Left side ',
     },
     {
      id : 'Right',
     text : 'Right side ',
     },
     {
      id : 'Back',
     text : 'Back side',
     }
    ]

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
  
  // Vehicles Images state
  const [frontImg, setFrontImg] = useState<string | null>(null);
  const [leftImg, setLeftImg] = useState<string | null>(null);
  const [rightImg, setRightImg] = useState<string | null>(null);
  const [backImg, setBackImg] = useState<string | null>(null);

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
   const pickImage = async (
    value: 'front' | 'left' | 'right' | 'back'
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
          if (value === 'front') {
            setFrontImg(uri);
          } else if (value === 'left') {
            setLeftImg(uri);
          } else if (value === 'right') {
            setRightImg(uri);
          } else if (value === 'back') {
            setBackImg(uri);
          }
        }
      } catch (error) {
        console.error('Error picking image:', error);
        alert('Failed to pick image');
      }
    };
  
    const removeImage = (value: 'front' | 'left' | 'right' | 'back') => {
      if (value === 'front') {
        setFrontImg(null);
      } else if (value === 'left') {
        setLeftImg(null);
      } else if (value === 'right') {
        setRightImg(null);
      } else if (value === 'back') {
        setBackImg(null);
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

  const isFormValid = vehicleNumber && vehicleType && vehicleCapacity && selectedBodyType && rcBookUri && insuranceUri && frontImg && leftImg && rightImg && backImg;

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
    <View style={[styles.container]}>
      {/* Top Navigation */}
       <View style={styles.headerTopContainer} >
          
          </View>
      <View style={styles.topNav}>
        <Pressable style={styles.backButton} onPress={onBack}>
             <Image source={ICONS.LeftArrow} style={styles.backButtonIcon} />
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
                    <Image
                      source={
                        selectedBodyType === type.id
                          ? type.nonActiveImage
                          : type.Activeimage
                      }
                      style={{ width: 120, height: 100 }}
                    />
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
                <View style={styles.uploadContainer}>
                 <Image source={ICONS.UploadIcon } style={styles.uploadIcon} />
                  <Text style={styles.uploadText}>Upload</Text>
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

                <View style={styles.uploadedCanelContainer}>
              
                               <View style={styles.uploadedImageContainer}>
                                <Image source={{ uri: rcBookUri }} style={styles.uploadedImage} />
                              
                        </View>
              
                         <Pressable
                            style={styles.removeButton}
                            onPress={removeRcBook}
                            disabled={isLoading}
                          >
                            <Text style={styles.removeButtonIcon}>✕</Text>
                          </Pressable>
                          </View>
                           
            )}
          </View>

          {/* Insurance */}
          <View style={styles.documentItem}>
            <View style={styles.documentContent}>
              <Text style={styles.documentTitle}>Insurance</Text>
              <Text style={styles.documentSubtitle}>Upload insurance photo or PDF</Text>
              {!insuranceUri && (
                <View style={styles.uploadContainer}>
                  <Image source={ICONS.UploadIcon } style={styles.uploadIcon } />
                  <Text style={styles.uploadText}>Upload</Text>
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
              
                <View style={styles.uploadedCanelContainer}>
              
                               <View style={styles.uploadedImageContainer}>
                                <Image source={{ uri: insuranceUri }} style={styles.uploadedImage} />
                              
                        </View>
              
                         <Pressable
                            style={styles.removeButton}
                            onPress={removeInsurance}
                            disabled={isLoading}
                          >
                            <Text style={styles.removeButtonIcon}>✕</Text>
                          </Pressable>
                          </View>
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
             
              
              {/* {vehiclePhotoUris.length > 0 && (
                <Text style={styles.uploadedCount}>✓ {vehiclePhotoUris.length} photo(s) uploaded</Text>
              )} */}
            </View>
            {/* <Text style={[styles.expandIcon, isPhotosExpanded && styles.expandIconOpen]}>
              ›
            </Text> */}
          </Pressable>

         
          {/* {isPhotosExpanded && (
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
          )} */}


        {/* // add new vechicle photo upload section with thumbnails and remove option */}
         
         <View style={styles.vehiclePhotosContainer}>
           {/* {
            AddVehiclePhotosData.map(eachTYpe => (

                <Pressable
                 key={eachTYpe.id}
                 style={styles.addNewPhotoButton}
                 onPress={pickMultiplePhotos}
                 disabled={isLoading}
                    >
                      <Text style={styles.addMorePhotoIcon}>+</Text>
                      <Text style={styles.addMorePhotoText}>{eachTYpe.text}</Text>
          </Pressable>

            ))
           } */}

            <VehiclePhotoUploadItem
              title="Front side"
              imageUri={frontImg || undefined}
              onUpload={() => pickImage('front')}
              onRemove={() => removeImage('front')}
              />

              <VehiclePhotoUploadItem
              title="Left side"
              imageUri={leftImg || undefined}
              onUpload={() => pickImage('left')}
              onRemove={() => removeImage('left')}
              />
             
             <VehiclePhotoUploadItem
              title="Right side"
              imageUri={rightImg || undefined}
              onUpload={() => pickImage('right')}
              onRemove={() => removeImage('right')}
              />

              <VehiclePhotoUploadItem
              title="Back side"
              imageUri={backImg || undefined}
              onUpload={() => pickImage('back')}
              onRemove={() => removeImage('back')}
  
              />
              
         </View>

          
        
        
        </View>



       

       
      </ScrollView>
         
        {/* Continue Button */}
        <Pressable
          style={[styles.continueButton, !isFormValid && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!isFormValid}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
       

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
                <Text style={styles.closeIcon}>{'✕'}</Text>
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



interface VehiclePhotsUploadItemProps {
  title: string;
  imageUri?: string;
  onUpload: () => void;
  onRemove: () => void;
}

const VehiclePhotoUploadItem: React.FC<VehiclePhotsUploadItemProps> = ({
  title,
  imageUri,
  onUpload,
  onRemove,
}) => {
  return (
         <>
          {imageUri ? (
             

                <View style={styles.uploadedCanelContainer}>
             
                              <View style={styles.uploadedImageContainer}>
                               <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
                             
                       </View>
             
                        <Pressable
                           style={styles.removeButton}
                           onPress={onRemove}
  
                         >
                            <Text style={styles.removeButtonIcon}>{'✕'}</Text>
                           
                         </Pressable>
                         </View>

        ) : (
          <Pressable
                 style={styles.addNewPhotoButton}
                 onPress={onUpload}
                    >
                      <Text style={styles.addMorePhotoIcon}>+</Text>
                      <Text style={styles.addMorePhotoText}>{title}</Text>
          </Pressable>
        )}
      </>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },

  // Top Navigation
   headerTopContainer : {
    height: 36,
    backgroundColor : 'white'
  },

  topNav: {
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
  navTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#1c1c1c',
    fontFamily: 'Poppins',
    textAlign: 'center',
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
    fontWeight: '600',
    color: '#1c1c1c',
    fontFamily: 'Poppins Medium',
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
  uploadContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  uploadIcon: {
    width: 12,
    height: 12,
    // tintColor: '#0055CC',
  },
  uploadText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#0055CC',
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
  // removeButton: {
  //   backgroundColor: '#d00416',
  //   borderWidth: 0,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
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
    marginBottom: 40,
    height: 56,
    paddingBottom: 24,
    margin: 16,
  },
  buttonDisabled: {
    backgroundColor: '#a4a4a4',
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

  // Additional styles can be added here
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
  
  // Additional styles can be added here
  vehiclePhotosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 2,
  },
  addNewPhotoButton: {
    height : 64,
    width: '24%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePhotoText: {
    fontFamily : 'regular',
    fontSize: 12,
    color: '#606060',
  },
});

export default VehicleDetailsScreen;

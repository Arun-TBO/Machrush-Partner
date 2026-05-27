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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface VehicleDetailsScreenProps {
  onContinue?: (vehicleData: VehicleDetailsData) => void;
  onBack?: () => void;
}

interface VehicleDetailsData {
  vehicleNumber: string;
  vehicleType: {
    category: string;
    imageKey: string;
    name: string;
  };
  vehicleCapacity: string;
  bodyType: string;
  rcBook: string | null;
  insurance: string | null;
  vehiclePhotos: string[];
}

interface VehicleMasterItem {
  id: string;
  name: string;
  capacity: string;
  category: string;
  imageKey: string;
}

const BODY_TYPES = [
  { id: 'closed', label: 'Closed Body' },
  { id: 'open', label: 'Opened Body' },
];

export const VehicleDetailsScreen: React.FC<VehicleDetailsScreenProps> = ({
  onContinue,
  onBack,
}) => {
  const insets = useSafeAreaInsets();

  // Form States
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleMasterItem | null>(null);
  const [vehicleCapacity, setVehicleCapacity] = useState('');
  const [selectedBodyType, setSelectedBodyType] = useState('');

  // UI States
  const [vehicleMasterList, setVehicleMasterList] = useState<VehicleMasterItem[]>([]);
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  const [isPhotosExpanded, setIsPhotosExpanded] = useState(false);

  // File States
  const [rcBookUri, setRcBookUri] = useState<string | null>(null);
  const [rcBookFileName, setRcBookFileName] = useState<string>('');
  const [insuranceUri, setInsuranceUri] = useState<string | null>(null);
  const [insuranceFileName, setInsuranceFileName] = useState<string>('');
  const [vehiclePhotoUris, setVehiclePhotoUris] = useState<string[]>([]);

  // 1. Fetch Master List from Firebase
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'vehicles'));
        const list = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as VehicleMasterItem[];
        setVehicleMasterList(list);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      }
    };
    fetchVehicles();
  }, []);

  // 2. Selection Handler
  const handleVehicleSelect = (item: VehicleMasterItem) => {
    setSelectedVehicleType(item);
    setVehicleCapacity(item.capacity); // Auto-fill capacity from Firebase doc
    setShowVehicleTypeModal(false);
  };

  // 3. Image Picker Logic
  const pickImage = async (type: 'rc' | 'insurance' | 'photos') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access gallery is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: type === 'photos',
      quality: 0.7,
    });

    if (!result.canceled) {
      if (type === 'rc') {
        setRcBookUri(result.assets[0].uri);
        setRcBookFileName(result.assets[0].uri.split('/').pop() || 'rc_book.jpg');
      } else if (type === 'insurance') {
        setInsuranceUri(result.assets[0].uri);
        setInsuranceFileName(result.assets[0].uri.split('/').pop() || 'insurance.jpg');
      } else {
        const newUris = result.assets.map(a => a.uri);
        setVehiclePhotoUris(prev => [...prev, ...newUris].slice(0, 4));
      }
    }
  };

  const isFormValid = 
    vehicleNumber.length > 5 && 
    selectedVehicleType && 
    vehicleCapacity && 
    selectedBodyType && 
    rcBookUri && 
    insuranceUri && 
    vehiclePhotoUris.length > 0;

  const handleContinue = () => {
    if (!isFormValid) return;
    if (onContinue && selectedVehicleType) {
      onContinue({
        vehicleNumber,
        vehicleType: {
          category: selectedVehicleType.category,
          imageKey: selectedVehicleType.imageKey,
          name: selectedVehicleType.name,
        },
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
      {/* Top Nav */}
      <View style={styles.topNav}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.navTitle}>Onboarding</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Vehicle details</Text>
          <Text style={styles.subtitle}>Complete 3 more steps to start earning</Text>
        </View>

        {/* Vehicle Number */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Vehicle Number</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. TN 01 AB 1234"
            placeholderTextColor="#8e8e8e"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            autoCapitalize="characters"
          />
        </View>

        {/* Vehicle Type (Selection Modal) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Vehicle type</Text>
          <Pressable style={styles.dropdownButton} onPress={() => setShowVehicleTypeModal(true)}>
            <Text style={[styles.dropdownText, !selectedVehicleType && { color: '#8e8e8e' }]}>
              {selectedVehicleType ? selectedVehicleType.name : 'Select Vehicle type'}
            </Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </Pressable>
        </View>

        {/* Vehicle Capacity (Auto-filled) */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Vehicle capacity</Text>
          <View style={[styles.textInput, styles.disabledInput]}>
             <Text style={styles.dropdownText}>{vehicleCapacity || 'e.g. 500kg'}</Text>
          </View>
        </View>

        {/* Body Type Selection */}
        <View style={styles.bodyTypeSection}>
          <Text style={styles.inputLabel}>Select Body type</Text>
          <View style={styles.bodyTypeContainer}>
            {BODY_TYPES.map((type) => (
              <Pressable
                key={type.id}
                style={[styles.bodyTypeCard, selectedBodyType === type.id && styles.bodyTypeCardSelected]}
                onPress={() => setSelectedBodyType(type.id)}
              >
                <View style={styles.bodyTypeImage}>
                  <Text style={{ fontSize: 32 }}>{type.id === 'closed' ? '🚚' : '🚛'}</Text>
                </View>
                <Text style={styles.bodyTypeLabel}>{type.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upload Documents Section */}
        <View style={styles.documentsSection}>
          <Text style={styles.inputLabel}>Upload documents</Text>

          {/* RC Book Item */}
          <DocumentItem 
            title="RC book" 
            subtitle="Upload RC book photo" 
            uri={rcBookUri} 
            fileName={rcBookFileName} 
            onUpload={() => pickImage('rc')}
            onRemove={() => { setRcBookUri(null); setRcBookFileName(''); }}
          />

          {/* Insurance Item */}
          <DocumentItem 
            title="Insurance" 
            subtitle="Upload insurance photo" 
            uri={insuranceUri} 
            fileName={insuranceFileName} 
            onUpload={() => pickImage('insurance')}
            onRemove={() => { setInsuranceUri(null); setInsuranceFileName(''); }}
          />

          {/* Vehicle Photos Item */}
          <Pressable style={styles.documentItem} onPress={() => setIsPhotosExpanded(!isPhotosExpanded)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.documentTitle}>Vehicle photos</Text>
              <Text style={styles.documentSubtitle}>Front, back & side photos</Text>
              {vehiclePhotoUris.length > 0 && <Text style={styles.uploadedFileName}>✓ {vehiclePhotoUris.length} photos added</Text>}
            </View>
            <Text style={[styles.expandIcon, isPhotosExpanded && { transform: [{ rotate: '90deg' }] }]}>›</Text>
          </Pressable>

          {isPhotosExpanded && (
            <View style={styles.photoThumbnailsContainer}>
              {vehiclePhotoUris.map((uri, idx) => (
                <View key={idx} style={styles.photoThumbnail}>
                  <Image source={{ uri }} style={styles.photoImage} />
                  <Pressable style={styles.removePhotoButton} onPress={() => setVehiclePhotoUris(prev => prev.filter((_, i) => i !== idx))}>
                    <Text style={{ color: 'white' }}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {vehiclePhotoUris.length < 4 && (
                <Pressable style={styles.addMorePhotoButton} onPress={() => pickImage('photos')}>
                  <Text style={styles.addMorePhotoIcon}>+</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

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
      <Modal visible={showVehicleTypeModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowVehicleTypeModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle Type</Text>
              <Pressable onPress={() => setShowVehicleTypeModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>
            <FlatList
              data={vehicleMasterList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable style={styles.modalOption} onPress={() => handleVehicleSelect(item)}>
                  <View>
                    <Text style={styles.modalOptionText}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: '#606060' }}>{item.category} • {item.capacity}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

// Sub-component for Document Rows
const DocumentItem = ({ title, subtitle, uri, fileName, onUpload, onRemove }: any) => (
  <View style={styles.documentItem}>
    <View style={{ flex: 1 }}>
      <Text style={styles.documentTitle}>{title}</Text>
      <Text style={styles.documentSubtitle}>{subtitle}</Text>
      {uri ? (
        <Text style={styles.uploadedFileName}>✓ {fileName}</Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: '#d00416', fontSize: 12 }}>↻ Upload again</Text>
        </View>
      )}
    </View>
    <Pressable style={[styles.uploadButtonSmall, uri && { backgroundColor: '#d00416', borderStyle: 'solid' }]} onPress={uri ? onRemove : onUpload}>
      <Text style={[styles.uploadButtonSmallText, uri && { color: 'white' }]}>{uri ? '✕' : 'Upload'}</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff2f6' },
  topNav: { height: 64, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 24, color: '#1c1c1c' },
  navTitle: { fontSize: 20, fontWeight: '600', color: '#1c1c1c', flex: 1, textAlign: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 24 },
  headerSection: { gap: 8 },
  title: { fontSize: 32, fontWeight: '600', color: '#1c1c1c' },
  subtitle: { fontSize: 16, color: '#606060' },
  inputSection: { gap: 8 },
  inputLabel: { fontSize: 16, color: '#606060' },
  textInput: { height: 56, backgroundColor: 'white', borderWidth: 1, borderColor: '#8e8e8e', borderRadius: 4, paddingHorizontal: 12, justifyContent: 'center', fontSize: 16 },
  disabledInput: { backgroundColor: '#e8e8e8', borderColor: '#d2d2d2' },
  dropdownButton: { height: 56, backgroundColor: 'white', borderWidth: 1, borderColor: '#8e8e8e', borderRadius: 4, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 16, color: '#1c1c1c' },
  dropdownIcon: { fontSize: 12, color: '#606060' },
  bodyTypeSection: { gap: 16 },
  bodyTypeContainer: { flexDirection: 'row', gap: 16 },
  bodyTypeCard: { flex: 1, alignItems: 'center', gap: 8, borderWidth: 2.5, borderColor: 'transparent', borderRadius: 12, paddingBottom: 8 },
  bodyTypeCardSelected: { borderColor: '#0055cc' },
  bodyTypeImage: { width: '100%', aspectRatio: 1.2, backgroundColor: '#e8e8e8', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bodyTypeLabel: { fontSize: 14, fontWeight: '500' },
  documentsSection: { gap: 16 },
  documentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#d2d2d2' },
  documentTitle: { fontSize: 18, fontWeight: '500' },
  documentSubtitle: { fontSize: 12, color: '#606060' },
  uploadedFileName: { fontSize: 12, color: '#0055cc', marginTop: 4 },
  uploadButtonSmall: { width: 60, height: 60, borderWidth: 1, borderColor: '#a4a4a4', borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  uploadButtonSmallText: { fontSize: 12, color: '#606060' },
  expandIcon: { fontSize: 24, color: '#606060' },
  photoThumbnailsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoThumbnail: { width: '23%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  removePhotoButton: { position: 'absolute', top: 2, right: 2, backgroundColor: '#d00416', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  addMorePhotoButton: { width: '23%', aspectRatio: 1, borderWidth: 1, borderColor: '#a4a4a4', borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  addMorePhotoIcon: { fontSize: 24, color: '#606060' },
  continueButton: { height: 56, backgroundColor: '#0055cc', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600' },
  closeIcon: { fontSize: 24 },
  modalOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalOptionText: { fontSize: 18 },
});

export default VehicleDetailsScreen;

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '@/lib/firebase';
import { submitDriverReport } from '@/lib/firestoreOnboardingService';

const backImage = require('@/assets/images/profile/back.png');

const reportCategories = [
  {
    label: 'Payment Issue',
    issues: [
      'Payment not received',
      'Wrong amount credited',
      'Payment delayed',
      'Payment deducted wrongly',
      'Other payment issue',
    ],
  },
  {
    label: 'Delivery Issue',
    issues: [
      'Pickup location incorrect',
      'Drop location incorrect',
      'Material not ready at pickup',
      'Receiver not available',
      'Delivery cancelled without notice',
      'Other delivery issue',
    ],
  },
  {
    label: 'Sender Issue',
    issues: [
      'Sender not responding',
      'Sender gave wrong details',
      'Sender behaviour issue',
      'Other sender issue',
    ],
  },
  {
    label: 'App Issue',
    issues: [
      'Map not working',
      'Job request not loading',
      'Cannot go online',
      'Notification not received',
      'Other app issue',
    ],
  },
  {
    label: 'Document Issue',
    issues: [
      'Documents rejected wrongly',
      'Verification taking too long',
      'Wrong status showing',
      'Other document issue',
    ],
  },
  {
    label: 'Other',
    issues: [
      'Safety concern',
      'Something else',
    ],
  },
];

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
        <Text style={styles.navTitle}>Report problem</Text>
      </View>
    </View>
  );
}

function DownIcon() {
  return (
    <View style={styles.downIcon}>
      <View style={styles.downLineLeft} />
      <View style={styles.downLineRight} />
    </View>
  );
}

function ArrowIcon() {
  return (
    <View style={styles.arrowIcon}>
      <View style={styles.arrowLine} />
      <View style={styles.arrowHeadTop} />
      <View style={styles.arrowHeadBottom} />
    </View>
  );
}

function WarningIcon() {
  return (
    <View style={styles.warningIcon}>
      <Text style={styles.warningIconText}>!</Text>
    </View>
  );
}

function SelectField({
  label,
  value,
  expanded,
  options,
  onPress,
  onSelect,
}: {
  label: string;
  value: string;
  expanded: boolean;
  options: string[];
  onPress: () => void;
  onSelect: (option: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" style={styles.selectBox} onPress={onPress}>
        <Text style={styles.inputValue}>{value}</Text>
        <DownIcon />
      </Pressable>
      {expanded ? (
        <View style={styles.dropdownMenu}>
          {options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              style={styles.dropdownOption}
              onPress={() => onSelect(option)}
            >
              <Text style={styles.dropdownOptionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ImageSlot({
  imageUri,
  onPress,
}: {
  imageUri?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={imageUri ? 'Change image' : 'Add image'}
      style={styles.imageSlot}
      onPress={onPress}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="cover" />
      ) : (
        <>
          <Text style={styles.plusText}>+</Text>
          <Text style={styles.addImageText}>Add image</Text>
        </>
      )}
    </Pressable>
  );
}

export default function ReportProblemScreen() {
  const router = useRouter();
  const [description, setDescription] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('');
  const [selectedIssue, setSelectedIssue] = React.useState('');
  const [openDropdown, setOpenDropdown] = React.useState<'category' | 'issue' | null>(null);
  const [selectedImages, setSelectedImages] = React.useState<(string | null)[]>([null, null, null]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const selectedCategoryConfig = reportCategories.find(
    (category) => category.label === selectedCategory
  );
  const issueOptions = selectedCategoryConfig?.issues || [];

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSelectedIssue('');
    setOpenDropdown(null);
  };

  const handleIssuePress = () => {
    if (!selectedCategory) {
      setOpenDropdown('category');
      return;
    }

    setOpenDropdown(openDropdown === 'issue' ? null : 'issue');
  };

  const handlePickImage = async (slotIndex: number) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow gallery access to add report images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];
      const selectedUri = selectedAsset?.base64
        ? `data:${selectedAsset.mimeType || 'image/jpeg'};base64,${selectedAsset.base64}`
        : selectedAsset?.uri;

      if (!selectedUri) {
        return;
      }

      setSelectedImages((currentImages) =>
        currentImages.map((imageUri, index) => (index === slotIndex ? selectedUri : imageUri))
      );
    } catch (error) {
      console.error('Error selecting report image:', error);
      Alert.alert('Image failed', 'Could not add this image. Please try again.');
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedCategory) {
      Alert.alert('Select category', 'Please choose a report category.');
      return;
    }

    if (!selectedIssue) {
      Alert.alert('Select issue', 'Please choose a specific issue.');
      return;
    }

    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      Alert.alert('Describe problem', 'Please describe your problem briefly.');
      return;
    }

    try {
      setIsSubmitting(true);

      const [storedUid, storedIdToken] = await Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]);
      let uid = auth.currentUser?.uid || storedUid;
      let idToken = storedIdToken;

      if (!uid) {
        Alert.alert('Login required', 'Please login again before submitting a report.');
        router.replace('/phone-number');
        return;
      }

      // Refresh the ID token to ensure it's not expired
      if (auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken(true);
          await AsyncStorage.setItem('firebaseIdToken', idToken);
        } catch (error) {
          console.warn('Could not refresh idToken for report, using stored:', error);
        }
      }

      const reportResult = await submitDriverReport(
        uid,
        {
          category: selectedCategory,
          issueType: selectedIssue,
          description: trimmedDescription,
          imageUris: selectedImages.filter((imageUri): imageUri is string => Boolean(imageUri)),
        },
        idToken
      );

      if (!reportResult.success) {
        Alert.alert('Submit failed', reportResult.error || 'Could not submit report.');
        return;
      }

      Alert.alert('Report submitted', 'Our team will review your report within 24 hours.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Submit failed', 'Could not submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Report your quality issue</Text>
            <Text style={styles.subtitle}>Describe the problem with the finished product</Text>
          </View>

          <SelectField
            label="Category"
            value={selectedCategory || 'Select Category'}
            expanded={openDropdown === 'category'}
            options={reportCategories.map((category) => category.label)}
            onPress={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
            onSelect={handleCategorySelect}
          />
          <SelectField
            label="Specific issue"
            value={selectedIssue || 'Select issue'}
            expanded={openDropdown === 'issue'}
            options={issueOptions}
            onPress={handleIssuePress}
            onSelect={(issue) => {
              setSelectedIssue(issue);
              setOpenDropdown(null);
            }}
          />

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Describe your problem</Text>
            <TextInput
              multiline
              maxLength={300}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your problem briefly"
              placeholderTextColor="#606060"
              style={styles.textArea}
              textAlignVertical="top"
            />
            <Text style={styles.characterLimit}>300 characters max</Text>
          </View>

          <View style={styles.imagesBlock}>
            <Text style={styles.label}>Add images (Optional)</Text>
            <View style={styles.imageSlotsRow}>
              {selectedImages.map((imageUri, index) => (
                <ImageSlot
                  key={`${index}`}
                  imageUri={imageUri || undefined}
                  onPress={() => handlePickImage(index)}
                />
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.reviewText}>
          Our team will review and contact both parties within 24 hours.
        </Text>

        <View style={styles.warningBar}>
          <WarningIcon />
          <Text style={styles.warningText}>False reports may resultin account suspension</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : null]}
          onPress={handleSubmitReport}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Text style={styles.submitText}>Submit Report</Text>
              <ArrowIcon />
            </>
          )}
        </Pressable>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 104,
    gap: 40,
  },
  formContent: {
    width: '100%',
    gap: 24,
  },
  header: {
    width: '100%',
    gap: 8,
  },
  title: {
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#1c1c1c',
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  fieldBlock: {
    width: '100%',
    gap: 16,
  },
  label: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  selectBox: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#8e8e8e',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  inputValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  dropdownMenu: {
    width: '100%',
    marginTop: -8,
    borderWidth: 1,
    borderColor: '#8e8e8e',
    borderRadius: 4,
    backgroundColor: '#eff2f6',
    overflow: 'hidden',
  },
  dropdownOption: {
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  dropdownOptionText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  downIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  downLineLeft: {
    position: 'absolute',
    left: 6,
    top: 10,
    width: 9,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#bbbbbb',
    transform: [{ rotate: '45deg' }],
  },
  downLineRight: {
    position: 'absolute',
    right: 6,
    top: 10,
    width: 9,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#bbbbbb',
    transform: [{ rotate: '-45deg' }],
  },
  textArea: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#8e8e8e',
    borderRadius: 4,
    padding: 8,
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  characterLimit: {
    width: '100%',
    marginTop: -12,
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#8e8e8e',
    textAlign: 'right',
  },
  imagesBlock: {
    width: '100%',
    gap: 16,
  },
  imageSlotsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  imageSlot: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#bbbbbb',
    borderRadius: 8,
    padding: 10,
    overflow: 'hidden',
  },
  selectedImage: {
    width: 86,
    height: 86,
    borderRadius: 8,
  },
  plusText: {
    fontFamily: 'Poppins',
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 24,
    color: '#8e8e8e',
  },
  addImageText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#606060',
    textAlign: 'center',
  },
  reviewText: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#606060',
  },
  warningBar: {
    width: '100%',
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(204, 119, 0, 0.25)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  warningIcon: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#cc7700',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  warningIconText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 14,
    color: '#cc7700',
    transform: [{ rotate: '-45deg' }],
  },
  warningText: {
    flexShrink: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    color: '#cc7700',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
  },
  submitButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#0055cc',
    paddingHorizontal: 24,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#ffffff',
    textAlign: 'center',
  },
  arrowIcon: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  arrowLine: {
    position: 'absolute',
    left: 4,
    top: 9,
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ffffff',
  },
  arrowHeadTop: {
    position: 'absolute',
    right: 4,
    top: 5,
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '45deg' }],
  },
  arrowHeadBottom: {
    position: 'absolute',
    right: 4,
    bottom: 5,
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '-45deg' }],
  },
});

import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '@/lib/firebase';
import { submitDriverReport } from '@/lib/firestoreOnboardingService';
import { fs, hit, rs, vs } from '@/lib/responsive';
const CloseButton = require('@/assets/images/Close button.png');
// import { Color } from 'react-native/types_generated/Libraries/Animated/AnimatedExports';
const chevronDown = require('@/assets/images/chevron-down.png');
const down = require('@/assets/images/down.png');
const backImage = require('@/assets/images/profile/back.png');
const reviewWarning = require('@/assets/images/profile/review-warning.png');
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
  valueColor = '#606060',
  expanded,
  options,
  onPress,
  onSelect,
  fontBold
}: {
  label: string;
  value: string;
  valueColor?: string;
  expanded: boolean;
  options: string[];
  onPress: () => void;
  onSelect: (option: string) => void;
  fontBold?: string
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.label ,  { color: expanded ? '#1C1C1C' : '#606060' } ]}>{label}</Text>
      <Pressable accessibilityRole="button" style={[styles.selectBox ,  { borderColor : expanded ? '#1C1C1C' : '#8e8e8e' , borderWidth: expanded ? 1 : 1}]} onPress={onPress}>
        <Text style={[styles.inputValue, { color: valueColor , fontWeight  :  fontBold ? 600 : 400 } ]}>{value}</Text>
       <Image source={ expanded ? down : chevronDown}  style={styles.downArrow}/>
      </Pressable>
      {expanded ? (
        <View style={[styles.dropdownMenu ,  { borderColor : expanded ? '#1C1C1C' : '#8e8e8e' ,  borderWidth: expanded ? 1 : 1 }] }>
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
  onRemove
}: {
  imageUri?: string;
  onPress: () => void;
  onRemove : () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={imageUri ? 'Change image' : 'Add image'}
      // style={styles.imageSlot}
      onPress={onPress}
    >
      {imageUri ? (
        <View style={styles.uploadedImageContainer}>
              <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="cover" />
              
              <Pressable
                            style={styles.removeButton}
                            onPress={onRemove}
                          
                          >
              <Image source={CloseButton} style={styles.removeButtonIcon}/>
              </Pressable>
        </View>
       
      ) : (
        <View style={styles.imageSlot}>
          <Text style={styles.plusText}>+</Text>
          <Text style={styles.addImageText}>Add image</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function ReportProblemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    deliveryId,
    deliveryTitle,
    prefillCategory,
  } = useLocalSearchParams<{
    deliveryId?: string;
    deliveryTitle?: string;
    prefillCategory?: string;
  }>();
  const initialDescription =
    deliveryId || deliveryTitle
      ? `Delivery: ${deliveryTitle || deliveryId}${deliveryId ? `\nDelivery ID: ${deliveryId}` : ''}\n`
      : '';
  const [description, setDescription] = React.useState(initialDescription);
  const [selectedCategory, setSelectedCategory] = React.useState(prefillCategory || '');
  const [selectedIssue, setSelectedIssue] = React.useState('');
  const [openDropdown, setOpenDropdown] = React.useState<'category' | 'issue' | null>(null);
  const [selectedImages, setSelectedImages] = React.useState<(string | null)[]>([null, null, null]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
 
  const [isFiledError , setFiled] = useState<boolean>(false)
  const [filedError , setError] = useState<string | undefined>('')
  const [isReportSubmit , setReportSubmit] = useState(false)
  
  const [isFocused, setIsFocused] = useState(false);


  const selectedCategoryConfig = reportCategories.find(
    (category) => category.label === selectedCategory
  );
  const issueOptions = selectedCategoryConfig?.issues || [];

    const removeImage = (index: number) => {
  setSelectedImages(prev => {
    const updated = [...prev];
    updated[index] = null;
    return updated;
  });
};

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
         setError("Permission needed', 'Please allow gallery access to add report images.")
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        allowsEditing: false,
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
        setError("Image failed', 'Could not add this image. Please try again.")
    }
  };

  const handleSubmitReport = async () => {
   

    if (!selectedCategory) {
         setFiled(true)
       setError("Select category,Please choose a report category.")
   
      return;
    }

    if (!selectedIssue) {
       setFiled(true)
       setError("Select issue,Please choose a specific issue.")

      return;
    }

    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
       setFiled(true)
         setError("Describe problem,Please describe your problem briefly.")
      return;
    }

    try {
      setIsSubmitting(true);

      const [storedUid, storedIdToken] = await Promise.all([
        AsyncStorage.getItem('firebaseUid'),
        AsyncStorage.getItem('firebaseIdToken'),
      ]);
      const uid = auth.currentUser?.uid || storedUid;

      if (!uid) {
        setError("Login required,Please login again before submitting a report.")
        router.replace('/phone-number');
        return;
      }

      const reportResult = await submitDriverReport(
        uid,
        {
          category: selectedCategory,
          issueType: selectedIssue,
          description: trimmedDescription,
          imageUris: selectedImages.filter((imageUri): imageUri is string => Boolean(imageUri)),
        },
        storedIdToken
      );

      if (!reportResult.success) {
        setError( reportResult.error || "Could not submit report." )
        return;
      }
       
      setError("Report submitted,Our team will review your report within 24 hours.")
       setFiled(true) 
      //  onPress: ,
      setReportSubmit(true)
    } catch (error) {
      console.error('Error submitting report:', error);
      setError("Submit failed,Could not submit report. Please try again")
    } finally {
      setIsSubmitting(false);
    }
  };
  



  function FiledErrorModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent  statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.supportSheet} onPress={(event) => event.stopPropagation()}>
          {/* <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
          </View> */}

          <View style={styles.supportIntro}>
            <Text style={styles.supportTitle}>{filedError?.split(",")[0]}</Text>
            <Text style={styles.supportSubtitle}>
              {filedError?.split(",")[1]}
            </Text>
          </View>
            
          {
            isReportSubmit ? (

              <Pressable
              style={ styles.doneBtn}
              accessibilityRole="button"
              onPress={() => router.back()}
            > 
             
              <Text style={styles.goBackButtonText}>Done</Text>
            </Pressable>
                
            ) : (
                <Pressable
              style={styles.goBackButton}
              accessibilityRole="button"
              onPress={onClose}
            > 
             
              <Text style={styles.goBackButtonText}>Ok</Text>
            </Pressable>
            )
          }
          


            

        </Pressable>
      </Pressable>
    </Modal>
  );
}


  return (
    <SafeAreaView style={styles.container}>
      <TopNav />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 72 + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Report your quality issue</Text>
            <Text style={styles.subtitle}>
              {deliveryTitle
                ? `Describe the problem for ${deliveryTitle}`
                : 'Describe the problem with the finished product'}
            </Text>
          </View>

          <SelectField
            label="Category"
            value={selectedCategory || 'Select Category'}
            valueColor={selectedCategory ? '#1c1c1c' : '#606060'}
            expanded={openDropdown === 'category'}
            options={reportCategories.map((category) => category.label)}
            onPress={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
            onSelect={handleCategorySelect}
            fontBold ={selectedCategory}
          />
          <SelectField
            label="Specific issue"
            value={selectedIssue || 'Select issue'}
            valueColor={selectedIssue ? '#1c1c1c' : '#606060'}
            expanded={openDropdown === 'issue'}
            options={issueOptions}
            onPress={handleIssuePress}
            onSelect={(issue) => {
              setSelectedIssue(issue);
              setOpenDropdown(null);
            }}
             fontBold ={selectedIssue}
          />

          <View style={styles.fieldBlock}>
            <Text style={[styles.label , { color :  isFocused ? '#1C1C1C' : '#606060' }]}>Describe your problem</Text>
            <TextInput
              multiline 
              maxLength={300}
              value={description}
              onChangeText={setDescription}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Describe your problem briefly"
              placeholderTextColor="#606060"
              style={[
                styles.textArea,
                {
                  borderColor: isFocused ? '#1C1C1C' : '#8e8e8e',
                  borderWidth: isFocused ? 1 : 1 ,
                  fontWeight :  isFocused ?  700 : 400
                },
              ]}
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
                   onRemove={() => removeImage(index)}
                />
        
                

              ))}
            </View>
          </View>
        </View>

        <Text style={styles.reviewText}>
          Our team will review and contact both parties within 24 hours.
        </Text>

        <View style={styles.warningBar}>
          <Image source={reviewWarning} style={styles.warningIcon}/>
          <Text style={styles.warningText}>False reports may resultin account suspension</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
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
             {/* <View style={styles.navigation}></View> */}
      </View> 
 
      <FiledErrorModal visible={isFiledError} onClose={() => setFiled(false)} />
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
    height: vs(52),
  },
  topNav: {
    minHeight: vs(64),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(4),
    paddingVertical: vs(8),
  },
  backButton: {
    width: hit(48),
    height: hit(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: rs(24),
    height: rs(24),
  },
  navTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20, 17, 22),
    lineHeight: fs(32, 26, 34),
    color: '#1c1c1c',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: rs(16),
    paddingTop: vs(16),
    paddingBottom: 120,
    gap: vs(32),
  },
  formContent: {
    width: '100%',
    gap: vs(24),
  },
  header: {
    width: '100%',
    gap: vs(8),
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    lineHeight: fs(28),
    letterSpacing: -1,
    color: '#1c1c1c',
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: fs(24),
    color: '#606060',
  },
  fieldBlock: {
    width: '100%',
    gap: vs(16),
  },
  label: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 16,
    lineHeight: fs(24),
    // color: '#606060',
    fontWeight : 500
  },
  selectBox: {
    width: '100%',
    minHeight: hit(56),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    borderWidth: 1,
    // borderColor: '#8e8e8e',
    borderRadius: 4,
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
    overflow: 'hidden',
  },
  inputValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: '',
    fontSize: 16,
    lineHeight: fs(24),
    fontWeight  : 600
  },
  dropdownMenu: {
    width: '100%',
    marginTop: -8,
    // borderWidth: 1,
    // borderColor: '#8e8e8e',
    borderRadius: 4,
    backgroundColor: '#eff2f6',
    overflow: 'hidden',
  },
  dropdownOption: {
    width: '100%',
    minHeight: hit(44),
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    paddingHorizontal: rs(8),
    paddingVertical: vs(10),
  },
  dropdownOptionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: fs(24),
    color: '#606060',
  },
  downIcon: {
    width: rs(24),
    height: rs(24),
    position: 'relative',
  },
  downLineLeft: {
    position: 'absolute',
    left: 6,
    top: 10,
    width: rs(9),
    height: rs(3),
    borderRadius: 2,
    backgroundColor: '#bbbbbb',
    transform: [{ rotate: '45deg' }],
  },
  downLineRight: {
    position: 'absolute',
    right: 6,
    top: 10,
    width: rs(9),
    height: rs(3),
    borderRadius: 2,
    backgroundColor: '#bbbbbb',
    transform: [{ rotate: '-45deg' }],
  },
  textArea: {
    width: '100%',
    minHeight: vs(120),
    // borderWidth: 1,
    // borderColor: '#8e8e8e',
    borderRadius: 4,
    padding: rs(8),
    fontFamily: 'Poppins',
    fontSize: 16,
    lineHeight: fs(24),
    color: '#1C1C1C',
    //  fontWeight  : 600

  },
  characterLimit: {
    width: '100%',
    marginTop: -12,
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: '#8e8e8e',
    textAlign: 'right',
  },
  imagesBlock: {
    width: '100%',
    gap: vs(16),
  },
  imageSlotsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(12),
    flexWrap: 'wrap',
  },
  imageSlot: {
    width: rs(86, 72, 92),
    height: rs(86, 72, 92),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#bbbbbb',
    borderRadius: rs(8),
    padding: rs(10),
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  plusText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(24, 20, 26),
    lineHeight: fs(24),
    color: '#8e8e8e',
  },
  addImageText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 10, 13),
    lineHeight: fs(18),
    color: '#606060',
    textAlign: 'center',
  },
  reviewText: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: fs(24),
    color: '#606060',
  },
  warningBar: {
    width: '100%',
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    borderRadius: 4,
    backgroundColor: 'rgba(204, 119, 0, 0.25)',
    paddingVertical: vs(4),
    paddingHorizontal: rs(8),
  },
  warningIcon: {
    width: rs(17),
    height: rs(15),
  },
  downArrow: {
    height : 20,
    width : 20
  },
  warningIconText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(14),
    color: '#cc7700',
    transform: [{ rotate: '-45deg' }],
  },
  warningText: {
    fontFamily: 'Poppins_400Regular',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: fs(13, 11, 14),
    color: '#cc7700',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: rs(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: rs(16),
  },
  submitButton: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#0055cc',
    paddingHorizontal: rs(20),
    paddingVertical: vs(16),
    overflow: 'hidden',
   
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitText: {
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: fs(18),
    letterSpacing: -0.5,
    color: '#ffffff',
    textAlign: 'center',
  },
  arrowIcon: {
    width: rs(20),
    height: rs(20),
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
  modalBackdrop: {
    flexDirection: 'column',
    alignItems : 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    height : '100%'

  },
  supportSheet: {
    borderRadius : 20,
    backgroundColor: '#ffffff',
  
    width : 300,
    padding : 20
  },
  sheetHeader: {
    width: '100%',
    alignItems: 'center',
    padding: 16,
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: '#79747e',
  },
  supportIntro: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  supportTitle: {
    width: '100%',
    color: '#29292b',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -1,
    textAlign: 'center',
  },
  supportSubtitle: {
    width: '100%',
    color: '#606060',
    fontFamily: 'Poppins_400Regular',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  goBackButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0055cc',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    overflow: 'hidden',
    backgroundColor : '#0055cc',
    marginTop : 20
  },
  doneBtn : {
     backgroundColor : '#1FC16B',
      width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1FC16B',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    overflow: 'hidden',
    marginTop : 20
  },
  goBackButtonText: {
    color: '#ffffff',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  navigation: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
    removeButtonIcon: {
    height : 20,
    width : 20
  },
  uploadedImageContainer: {
  width: 64,
  height: 64,
  position: 'relative',
  alignSelf: 'flex-start',
  overflow: 'visible',
  borderRadius: 12,
  },
  removeButton: {
  position: 'absolute',
  top: -1,
  right: -5,
  zIndex: 10,
  elevation: 5, // Android
  },
});

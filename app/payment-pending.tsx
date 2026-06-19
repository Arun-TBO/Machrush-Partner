import React , {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fs, hit, rs, vs } from '@/lib/responsive';

const paymentThumbImage = require('@/assets/images/delivery/payment-detail-thumb.png');
const tablelocation = require('@/assets/images/profile/tablelocation.png')
type DeliveryTimestamp =
  | string
  | number
  | Date
  | {
      seconds?: number;
      _seconds?: number;
      toDate?: () => Date;
    };

type DeliveryDetails = {
  id?: string;
  status?: string;
  sender?: {
    photoUri?: string;
    profilePhotoUrl?: string;
  } | null;
  receiver?: {
    photoUri?: string;
    profilePhotoUrl?: string;
  } | null;
  pickupTime?: string | null;
  dropoffTime?: string | null;
  locations?: {
    pickup?: {
      address?: string;
    } | null;
    dropoff?: {
      address?: string;
    } | null;
  };
  pricing?: {
    tripFare?: number | string;
    total?: number | string;
    platformFee?: number | string;
    serviceFee?: number | string;
    commission?: number | string;
    distanceKm?: number | string;
    distance?: number | string;
  };
  timestamps?: {
    createdAt?: DeliveryTimestamp;
    assignedAt?: DeliveryTimestamp;
    inTransitAt?: DeliveryTimestamp;
    deliveredAt?: DeliveryTimestamp;
  };
};

const getApiBaseUrl = () => {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
};

const readTimestampMs = (value: DeliveryTimestamp | undefined) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const toNumber = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const formatCurrency = (value: unknown) => {
  const amount = toNumber(value);
  return `\u20b9${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
};

const formatDate = (value: DeliveryTimestamp | undefined) => {
  const timestamp = readTimestampMs(value);
  const date = timestamp ? new Date(timestamp) : new Date();

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getAddressParts = (address: string) => {
  const [primary, ...rest] = address.split(',').map((part) => part.trim()).filter(Boolean);
  return {
    primary: primary || 'Address unavailable',
    secondary: rest.join(', '),
  };
};

const getProfileImageUri = (delivery: DeliveryDetails | null) => {
  return (
    delivery?.sender?.photoUri ||
    delivery?.sender?.profilePhotoUrl ||
    delivery?.receiver?.photoUri ||
    delivery?.receiver?.profilePhotoUrl ||
    ''
  );
};

const formatDuration = (delivery: DeliveryDetails | null) => {
  const deliveredAt = readTimestampMs(delivery?.timestamps?.deliveredAt);
  const startedAt = readTimestampMs(
    delivery?.timestamps?.inTransitAt ||
      delivery?.timestamps?.assignedAt ||
      delivery?.timestamps?.createdAt
  );

  if (!deliveredAt || !startedAt || deliveredAt <= startedAt) {
    return delivery?.dropoffTime || 'Time unavailable';
  }

  const totalMinutes = Math.max(1, Math.round((deliveredAt - startedAt) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} mins`;
  }

  return minutes > 0 ? `${hours} h ${minutes} mins` : `${hours} h`;
};

function TopNav() {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.statusSpacer} />
      <View style={styles.topNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1c1c1c" />
        </Pressable>
        <Text style={styles.navTitle}>Payment details</Text>
      </View>
    </View>
  );
}

function RoutePoint({
  title,
  address,
}: {
  title: string;
  address: string;
}) {
  const parts = getAddressParts(address);

  return (
    <View style={styles.routePoint}>
    
      <View style={styles.routeText}>
        <Text style={styles.routePointTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.routePrimary} numberOfLines={1}>
          {parts.primary}
        </Text>
        {parts.secondary ? (
          <Text style={styles.routeSecondary} numberOfLines={1}>
            {parts.secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PaymentLine({
  label,
  value,
  strong,
  showInfo,
}: {
  label: string;
  value: string;
  strong?: boolean;
  showInfo?: boolean;
}) {
  return (
    <View style={styles.paymentLine}>
      <View style={styles.paymentLabelRow}>
        <Text style={[styles.paymentLabel, strong ? styles.paymentLabelStrong : null]} numberOfLines={1}>{label}</Text>
        {showInfo ? <Ionicons name="information-circle-outline" size={21} color="#8e8e8e" /> : null}
      </View>
      <Text style={[styles.paymentValue, strong ? styles.paymentValueStrong : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function PaymentPendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deliveryId } = useLocalSearchParams<{ deliveryId?: string }>();
  const [delivery, setDelivery] = React.useState<DeliveryDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const hasLoadedDeliveryRef = React.useRef(false);

  React.useEffect(() => {
    let isActive = true;

    const loadDelivery = async () => {
      if (!deliveryId) {
        setIsLoading(false);
        return;
      }

      try {
        if (!hasLoadedDeliveryRef.current) {
          setIsLoading(true);
        }
        const response = await fetch(`${getApiBaseUrl()}/api/deliveries/${deliveryId}`);
        const body = (await response.json().catch(() => null)) as {
          success?: boolean;
          data?: DeliveryDetails;
          error?: string;
        } | null;

        if (!response.ok || body?.success === false) {
          throw new Error(body?.error || 'Unable to load payment details');
        }

        if (isActive) {
          setDelivery(body?.data || null);
        }
      } catch (error) {
        console.error('Error loading payment details:', error);
      } finally {
        if (isActive) {
          hasLoadedDeliveryRef.current = true;
          setIsLoading(false);
        }
      }
    };

    loadDelivery();
    const interval = setInterval(loadDelivery, 5000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [deliveryId]);

  const pickupAddress = delivery?.locations?.pickup?.address || 'Pickup address unavailable';
  const dropAddress = delivery?.locations?.dropoff?.address || 'Drop address unavailable';
  const pickupParts = getAddressParts(pickupAddress);
  const distance = toNumber(delivery?.pricing?.distanceKm ?? delivery?.pricing?.distance);
  const distanceLabel = distance > 0 ? `Drop ${Math.round(distance)}km` : 'Drop';
  const earnedAmount = toNumber(delivery?.pricing?.tripFare ?? delivery?.pricing?.total);
  const platformFee = toNumber(
    delivery?.pricing?.platformFee ?? delivery?.pricing?.serviceFee ?? delivery?.pricing?.commission
  );
  const receivedAmount = Math.max(earnedAmount - platformFee, 0);
  const deliveredDate = formatDate(delivery?.timestamps?.deliveredAt || delivery?.timestamps?.createdAt);
  const title = `${pickupParts.primary}${pickupParts.secondary ? `, ${pickupParts.secondary}` : ''}`;
  const routeDuration = formatDuration(delivery);
  const profileImageUri = getProfileImageUri(delivery);
 
  const tableLocationImage = require('@/assets/images/profile/tablelocation.png');
  const pickAndDropIcon = require('@/assets/images/pickAndDropIcon1.png');
  const [isTransactionDetails , setTransactionDetails] = useState(true)

  const handleReportIssue = () => {
    router.push({
      pathname: '/report-problem',
      params: {
        deliveryId,
        deliveryTitle: title,
        prefillCategory: 'Payment Issue',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#05c" />
          <Text style={styles.loadingText}>Loading payment details...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryBlock}>
            <View style={styles.deliveryHeaderRow}>
              <Image
                source={profileImageUri ? { uri: profileImageUri } : paymentThumbImage}
                style={styles.deliveryThumb}
                resizeMode="cover"
              />
              <View style={styles.deliveryHeaderCopy}>
                <Text style={styles.deliveryTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.deliveryMeta} numberOfLines={1}>
                  {deliveredDate} {'\u2022'} {formatCurrency(earnedAmount)} earned
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.paymentStatusRow}>
              <Text style={styles.earnedTitle}>{formatCurrency(earnedAmount)} earning</Text>
              <View style={styles.paymentCompleteRow}>
                <Ionicons name="time" size={20} color="#e0ad00" />
                <Text style={styles.paymentCompleteText} numberOfLines={1}>Payment pending</Text>
              </View>
            </View>

            <View style={styles.routeCard}>
              <View style={styles.routeHeader}>
                <Image source={tableLocationImage} style={styles.headingTitleIcon} resizeMode="contain" />
                <Text style={styles.routeTitle}>Route</Text>
              </View>
            
         
         
         
              <View style={styles.routeBox}>
                
               <Image source={ pickAndDropIcon } style={styles.routeIcon}  />

               <View>
                     
                     <RoutePoint title="Pickup" address={pickupAddress} />
               
                  <View style={styles.routeSeparator} />
               
                <RoutePoint title={distanceLabel} address={dropAddress} />
                <Text style={styles.routeTotal} numberOfLines={1}>
                  Total {distance > 0 ? `${Math.round(distance)} kms` : 'distance unavailable'} {'\u2022'} {routeDuration}
                </Text>

               </View>
                 
              </View>
            
            
            
            </View>
          </View>

          <View style={styles.paymentSummaryCard}>
            <View style={styles.paymentSummaryHeader}>
              <View style={styles.summaryIconCircle}>
                <Ionicons name="trending-down" size={16} color="#7aa7e8" />
              </View>
              <Text style={styles.paymentSummaryTitle}>Payment summary</Text>
            </View>

            <View style={styles.paymentAmountBox}>
              <PaymentLine label="Amount earned" value={formatCurrency(earnedAmount)} />
              <PaymentLine
                label="Platform fee"
                value={`-${formatCurrency(platformFee)}`}
                showInfo
              />
              <PaymentLine label="Amount received" value={formatCurrency(receivedAmount)} strong />
            </View>

            <View style={styles.transactionBlock}>
              <Pressable style={styles.transactionHeader}
                onPress={() => setTransactionDetails(!isTransactionDetails)}
              >
                <Text style={styles.transactionTitle}>Transaction Details</Text>
                  <Ionicons name={ isTransactionDetails ? "chevron-up"  :  "chevron-down"} size={24} color="#8e8e8e" />
              </Pressable>
             { isTransactionDetails && (
                     
                     <>
                      <PaymentLine label="Send by" value="MachRush Admin" />
                      <PaymentLine label="Expected settlement" value="Processing" />
                     </>

              )}
             
              
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report payment issue"
            style={styles.reportButton}
            onPress={handleReportIssue}
          >
            <Text style={styles.reportButtonText}>Report an issue</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding : 18
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: '#e8e8e8',
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
  navTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20, 17, 22),
    lineHeight: fs(32, 26, 34),
    color: '#1c1c1c',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(10),
    paddingTop: vs(116),
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(14),
    lineHeight: fs(21),
    color: '#606060',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: rs(412, 320, 430),
    alignSelf: 'center',
    paddingTop: vs(116),
    paddingBottom: vs(24),
    gap: vs(24),
    alignItems: 'center',
  },
  summaryBlock: {
    width: '100%',
    gap: vs(16),
  },
  deliveryHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
  },
  deliveryThumb: {
    width: rs(48),
    height: rs(48),
    borderRadius: rs(8),
    backgroundColor: '#000000',
  },
  deliveryHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: vs(8),
  },
  deliveryTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: fs(20, 17, 22),
    lineHeight: fs(32, 26, 34),
    color: '#1c1c1c',
  },
  deliveryMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(14, 12, 15),
    lineHeight: fs(21),
    color: '#606060',
  },
  divider: {
    height: 1,
    backgroundColor: '#d2d2d2',
  },
  paymentStatusRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    minWidth: 0,
  },
  earnedTitle: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    minWidth: 0,
    fontSize: fs(22, 18, 24),
    color: '#1c1c1c',
  },
  paymentCompleteRow: {
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  paymentCheck: {
    width: rs(24),
    height: rs(24),
  },
  paymentCompleteText: {
    flexShrink: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: fs(24),
    color: '#000000',
  },
  routeCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: rs(12),
    paddingHorizontal: rs(8),
    paddingVertical: vs(12),
    gap: vs(12),
    overflow: 'hidden',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  routeTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: fs(18),
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  routeBox: {
     position: 'relative',
    backgroundColor: '#eff2f6',
    width: '100%',
    borderRadius: rs(12),
    padding: rs(12),
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(14),
  },
  routePoint: {
     minHeight: vs(64),
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    marginTop : vs(5),
    marginBottom : vs(5)
  },
  routeIconWrap: {
    width: rs(20),
    height: rs(20),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  routeIconOuter: {
    width: rs(20),
    height: rs(20),
    borderRadius: rs(10),
    backgroundColor: '#9fc9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIconInner: {
    width: rs(10),
    height: rs(10),
    borderRadius: rs(5),
    backgroundColor: '#0055cc',
  },
  routeText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    padding : rs(4),
  },
  routePointTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: fs(18),
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  routePrimary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: fs(24),
    color: '#616161',
  },
  routeSecondary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: '#616161',
  },
  routeDivider: {
    height: 1,
    marginLeft: rs(44, 32, 46),
    borderTopWidth: 1,
    borderStyle: 'dotted',
    borderColor: '#0055cc',
  },
  routeConnector: {
    position: 'absolute',
    left: rs(21),
    top: vs(48),
    height: vs(88),
    borderLeftWidth: 2,
    borderStyle: 'dotted',
    borderColor: '#0055cc',
  },
  routeTotal: {
    minWidth: 0,
    flexShrink: 1,
    marginLeft: rs(5),
    fontFamily: 'Poppins_400Regular',
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: '#1c1c1c',
  },
  paymentSummaryCard: {
    width: '100%',
    maxWidth: rs(380, 320, 420),
    borderRadius: rs(12),
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    paddingHorizontal: rs(4),
    paddingTop: vs(12),
    paddingBottom: vs(8),
    gap: vs(12),
    overflow: 'hidden',
    alignSelf: 'center',
  },
  paymentSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    paddingHorizontal: rs(4),
  },
  summaryIconCircle: {
    width: rs(24),
    height: rs(24),
    borderRadius: rs(12),
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSummaryTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: fs(18),
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  paymentAmountBox: {
    width: '100%',
    borderRadius: rs(8),
    backgroundColor: '#ffffff',
    paddingVertical: vs(8),
  },
  paymentLine: {
    width: '100%',
    minHeight: hit(40),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(12),
    paddingVertical: vs(8),
    gap: rs(10),
  },
  paymentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: rs(4),
    minWidth: 0,
  },
  paymentLabel: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: fs(24),
    color: '#8e8e8e',
  },
  paymentLabelStrong: {
    color: '#1c1c1c',
  },
  paymentValue: {
    fontFamily: 'Poppins_500Medium',
    maxWidth: '45%',
    flexShrink: 1,
    fontSize: 16,
    lineHeight: fs(18),
    color: '#606060',
    textAlign: 'right',
  },
  paymentValueStrong: {
    color: '#1c1c1c',
  },
  transactionBlock: {
    width: '100%',
    gap: vs(4),
  },
  transactionHeader: {
    width: '100%',
    minHeight: hit(40),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(12),
    paddingVertical: vs(8),
  },
  transactionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: fs(18),
    letterSpacing: -0.5,
    color: '#8e8e8e',
  },
  reportButton: {
    width: '100%',
    maxWidth: 380,
    minHeight: 53,
    borderWidth: 1,
    borderColor: '#05c',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignSelf: 'center',
  },
  reportButtonText: {
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: -0.5,
    color: '#d00416',
    textAlign: 'center',
  },
   headingTitleIcon: {
    width: 20,
    height: 20,
  },
  routeIcon: {
    width: 30,
    height: '70%',
  },routeSeparator: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d6d6d6',
  }
});

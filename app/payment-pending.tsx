import React from 'react';
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

const paymentThumbImage = require('@/assets/images/delivery/payment-detail-thumb.png');

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
      <View style={styles.routeIconWrap}>
        <View style={styles.routeIconOuter}>
          <View style={styles.routeIconInner} />
        </View>
      </View>
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
        <Text style={[styles.paymentLabel, strong ? styles.paymentLabelStrong : null]}>{label}</Text>
        {showInfo ? <Ionicons name="information-circle-outline" size={21} color="#8e8e8e" /> : null}
      </View>
      <Text style={[styles.paymentValue, strong ? styles.paymentValueStrong : null]}>{value}</Text>
    </View>
  );
}

export default function PaymentPendingScreen() {
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId?: string }>();
  const [delivery, setDelivery] = React.useState<DeliveryDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isActive = true;

    const loadDelivery = async () => {
      if (!deliveryId) {
        setIsLoading(false);
        return;
      }

      try {
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
        if (isActive) {
          setDelivery(null);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadDelivery();

    return () => {
      isActive = false;
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
          contentContainerStyle={styles.content}
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
                <Text style={styles.paymentCompleteText}>Payment pending</Text>
              </View>
            </View>

            <View style={styles.routeCard}>
              <View style={styles.routeHeader}>
                <Ionicons name="navigate" size={20} color="#1c1c1c" />
                <Text style={styles.routeTitle}>Route</Text>
              </View>
              <View style={styles.routeBox}>
                <View style={styles.routeConnector} />
                <RoutePoint title="Pickup" address={pickupAddress} />
                <View style={styles.routeDivider} />
                <RoutePoint title={distanceLabel} address={dropAddress} />
                <Text style={styles.routeTotal}>
                  Total {distance > 0 ? `${Math.round(distance)} kms` : 'distance unavailable'} {'\u2022'} {routeDuration}
                </Text>
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
              <View style={styles.transactionHeader}>
                <Text style={styles.transactionTitle}>Transaction Details</Text>
                <Ionicons name="chevron-up" size={24} color="#8e8e8e" />
              </View>
              <PaymentLine label="Send by" value="MachRush Admin" />
              <PaymentLine label="Expected settlement" value="Processing" />
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
  navTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    lineHeight: 32,
    color: '#1c1c1c',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 116,
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#606060',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 412,
    alignSelf: 'center',
    paddingTop: 116,
    paddingBottom: 24,
    gap: 24,
    alignItems: 'center',
  },
  summaryBlock: {
    width: '100%',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  deliveryHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveryThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  deliveryHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  deliveryTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    lineHeight: 32,
    color: '#1c1c1c',
  },
  deliveryMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
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
    gap: 8,
  },
  earnedTitle: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1,
    color: '#1c1c1c',
  },
  paymentCompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentCheck: {
    width: 24,
    height: 24,
  },
  paymentCompleteText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  routeCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 12,
    overflow: 'hidden',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  routeBox: {
    position: 'relative',
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#eff2f6',
    padding: 12,
    gap: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    minHeight: 54,
  },
  routeIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  routeIconOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9fc9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIconInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0055cc',
  },
  routeText: {
    flex: 1,
    minWidth: 0,
  },
  routePointTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  routePrimary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#616161',
  },
  routeSecondary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#616161',
  },
  routeDivider: {
    height: 1,
    marginLeft: 44,
    borderTopWidth: 1,
    borderStyle: 'dotted',
    borderColor: '#0055cc',
  },
  routeConnector: {
    position: 'absolute',
    left: 21,
    top: 48,
    height: 88,
    borderLeftWidth: 2,
    borderStyle: 'dotted',
    borderColor: '#0055cc',
  },
  routeTotal: {
    marginLeft: 44,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#1c1c1c',
  },
  paymentSummaryCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 12,
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  paymentSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  summaryIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(27, 124, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentSummaryTitle: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  paymentAmountBox: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
  },
  paymentLine: {
    width: '100%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  paymentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  paymentLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#8e8e8e',
  },
  paymentLabelStrong: {
    color: '#1c1c1c',
  },
  paymentValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
    color: '#606060',
    textAlign: 'right',
  },
  paymentValueStrong: {
    color: '#1c1c1c',
  },
  transactionBlock: {
    width: '100%',
    gap: 4,
  },
  transactionHeader: {
    width: '100%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transactionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
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
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: -0.5,
    color: '#d00416',
    textAlign: 'center',
  },
});

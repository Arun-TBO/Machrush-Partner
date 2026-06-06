import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';

const deliveryThumbImage = require('@/assets/images/delivery/delivery-list-thumb.png');

type DeliveryTimestamp =
  | string
  | number
  | Date
  | {
      seconds?: number;
      _seconds?: number;
      toDate?: () => Date;
    };

type DeliveryRecord = {
  id?: string;
  status?: string;
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
  };
  timestamps?: {
    createdAt?: DeliveryTimestamp;
    assignedAt?: DeliveryTimestamp;
    inTransitAt?: DeliveryTimestamp;
    deliveredAt?: DeliveryTimestamp;
  };
};

type PaymentFilter = 'paid' | 'pending';

type DeliveryListItem = {
  id: string;
  title: string;
  amount: number;
  date: string;
  status: PaymentFilter;
  source?: DeliveryRecord;
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getApiBaseUrl = () => {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
};

const formatCurrency = (value: unknown) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return '\u20b90';
  }

  return `\u20b9${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
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

const getStartOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getWeekDays = () => {
  const today = getStartOfDay(new Date());
  const day = today.getDay();
  const daysFromMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
};

const isSameLocalDay = (leftMs: number, right: Date) => {
  if (!leftMs) return false;
  const left = new Date(leftMs);

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

const isWithinWeek = (timestampMs: number, weekDays: Date[]) => {
  if (!timestampMs) return false;
  const weekStart = weekDays[0].getTime();
  const weekEnd = weekDays[6].getTime() + 24 * 60 * 60 * 1000;
  return timestampMs >= weekStart && timestampMs < weekEnd;
};

const formatShortDate = (value: Date) => {
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatListDate = (value: DeliveryTimestamp | undefined) => {
  const timestamp = readTimestampMs(value);
  const date = timestamp ? new Date(timestamp) : new Date();

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const isPaidDelivery = (status?: string) => {
  return status === 'delivered' || status === 'completed' || status === 'paid';
};

const toAmount = (delivery: DeliveryRecord) => {
  const amount = Number(delivery.pricing?.tripFare ?? delivery.pricing?.total);
  return Number.isFinite(amount) ? amount : 0;
};

const getDeliveryCompletedMs = (delivery: DeliveryRecord) => {
  return readTimestampMs(delivery.timestamps?.deliveredAt || delivery.timestamps?.createdAt);
};

const getActiveDurationMs = (delivery: DeliveryRecord) => {
  const deliveredAt = readTimestampMs(delivery.timestamps?.deliveredAt);
  const startedAt = readTimestampMs(
    delivery.timestamps?.inTransitAt ||
      delivery.timestamps?.assignedAt ||
      delivery.timestamps?.createdAt
  );

  if (!deliveredAt || !startedAt || deliveredAt <= startedAt) {
    return 0;
  }

  return deliveredAt - startedAt;
};

const formatDuration = (durationMs: number) => {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} m`;
  }

  return `${hours} h ${minutes} m`;
};

const getDeliveryTitle = (delivery: DeliveryRecord) => {
  const address = delivery.locations?.pickup?.address || delivery.locations?.dropoff?.address;
  const [primary, secondary] = (address || 'Delivery location unavailable')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (primary && secondary) {
    return `${primary}, ${secondary}`;
  }

  return primary || 'Delivery location unavailable';
};

function TopSummary({
  weekLabel,
  totalEarned,
  onPreviousWeek,
  onNextWeek,
  canGoNext,
}: {
  weekLabel: string;
  totalEarned: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  canGoNext: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.statusSpacer} />
      <View style={styles.topNav}>
        <Text style={styles.navTitle}>Weekly breakdown</Text>
      </View>

      <View style={styles.weekSummary}>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <View style={styles.weekAmountRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show previous week"
            style={styles.weekNavButton}
            onPress={onPreviousWeek}
          >
            <Ionicons name="caret-back" size={18} color="#606060" />
          </Pressable>
          <Text style={styles.weekAmount}>{totalEarned}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show next week"
            style={[styles.weekNavButton, !canGoNext ? styles.weekNavButtonDisabled : null]}
            disabled={!canGoNext}
            onPress={onNextWeek}
          >
            <Ionicons name="caret-forward" size={18} color="#606060" />
          </Pressable>
        </View>
        <Text style={styles.weekCaption}>Total earned</Text>
      </View>
    </View>
  );
}

function WeeklyChart({
  bars,
  days,
  activeIndex,
  peakAmount,
}: {
  bars: number[];
  days: Date[];
  activeIndex: number;
  peakAmount: string;
}) {
  return (
    <View style={styles.chartSection}>
      <Text style={styles.peakAmount}>{peakAmount}</Text>
      <View style={styles.chartGrid}>
        {bars.map((height, index) => (
          <View
            key={`${days[index].toISOString()}-${index}`}
            style={[
              styles.chartBar,
              { height },
              index === activeIndex ? styles.chartBarActive : null,
            ]}
          />
        ))}
      </View>
      <View style={styles.dayRow}>
        {days.map((date, index) => (
          <Text
            key={date.toISOString()}
            style={[styles.dayLabel, index === activeIndex ? styles.dayLabelActive : null]}
          >
            {date.getDate()}
            {'\n'}
            {weekdayLabels[index]}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StatsBlock({
  completedCount,
  activeDuration,
}: {
  completedCount: number;
  activeDuration: string;
}) {
  return (
    <View style={styles.statsSection}>
      <Text style={styles.sectionTitle}>Stats</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Trip completed</Text>
          <Text style={styles.statValue}>{completedCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Active Hours </Text>
          <Text style={styles.statValue}>{activeDuration}</Text>
        </View>
      </View>
    </View>
  );
}

function SegmentedFilter({
  value,
  onChange,
}: {
  value: PaymentFilter;
  onChange: (value: PaymentFilter) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      <Pressable
        accessibilityRole="button"
        style={[styles.segment, value === 'paid' ? styles.segmentActive : null]}
        onPress={() => onChange('paid')}
      >
        <Text style={[styles.segmentText, value === 'paid' ? styles.segmentTextActive : null]}>
          Paid
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={[styles.segment, value === 'pending' ? styles.segmentActive : null]}
        onPress={() => onChange('pending')}
      >
        <Text style={[styles.segmentText, value === 'pending' ? styles.segmentTextActive : null]}>
          Pending
        </Text>
      </Pressable>
    </View>
  );
}

function DeliveryRow({
  item,
  thumbnail,
  onPress,
}: {
  item: DeliveryListItem;
  thumbnail: ImageSourcePropType;
  onPress?: () => void;
}) {
  const isPaid = item.status === 'paid';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.deliveryRow}
      onPress={onPress}
    >
      <Image source={thumbnail} style={styles.deliveryThumb} resizeMode="cover" />
      <View style={styles.deliveryCopy}>
        <Text style={styles.deliveryTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.deliveryMeta} numberOfLines={1}>
          {formatCurrency(item.amount)} earned  •  {item.date}
        </Text>
      </View>
      <View style={[styles.statusBadge, isPaid ? styles.paidBadge : styles.pendingBadge]}>
        <Text style={[styles.statusBadgeText, isPaid ? styles.paidBadgeText : styles.pendingBadgeText]}>
          {isPaid ? 'Paid' : 'Pending'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#d2d2d2" />
    </Pressable>
  );
}

function EmptyList({ filter }: { filter: PaymentFilter }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyTitle}>
        {filter === 'paid' ? 'No paid deliveries yet' : 'No pending deliveries'}
      </Text>
    </View>
  );
}

export default function MyDeliveriesScreen() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<PaymentFilter>('paid');
  const [deliveries, setDeliveries] = React.useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [weekOffset, setWeekOffset] = React.useState(0);
  const currentWeekDays = React.useMemo(getWeekDays, []);
  const weekDays = React.useMemo(() => {
    return currentWeekDays.map((date) => {
      const shiftedDate = new Date(date);
      shiftedDate.setDate(date.getDate() + weekOffset * 7);
      return shiftedDate;
    });
  }, [currentWeekDays, weekOffset]);
  const todayIndex = Math.max(0, weekDays.findIndex((date) => isSameLocalDay(Date.now(), date)));
  const canGoNextWeek = weekOffset < 0;

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadDriverDeliveries = async () => {
        try {
          setIsLoading(true);
          const storedUid = await AsyncStorage.getItem('firebaseUid');
          const uid = auth.currentUser?.uid || storedUid;

          if (!uid) {
            if (isActive) {
              setDeliveries([]);
            }
            return;
          }

          const response = await fetch(
            `${getApiBaseUrl()}/api/deliveries/driver/${encodeURIComponent(uid)}?type=all`
          );
          const body = (await response.json().catch(() => null)) as {
            success?: boolean;
            data?: DeliveryRecord[];
            error?: string;
          } | null;

          if (!response.ok || body?.success === false) {
            throw new Error(body?.error || 'Unable to load deliveries');
          }

          const items = Array.isArray(body?.data) ? body.data : [];
          items.sort((a, b) => {
            const aTime = readTimestampMs(a.timestamps?.deliveredAt || a.timestamps?.createdAt);
            const bTime = readTimestampMs(b.timestamps?.deliveredAt || b.timestamps?.createdAt);
            return bTime - aTime;
          });

          if (isActive) {
            setDeliveries(items);
          }
        } catch (error) {
          console.error('Error loading my deliveries:', error);
          if (isActive) {
            setDeliveries([]);
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      loadDriverDeliveries();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const completedDeliveries = deliveries.filter((delivery) => isPaidDelivery(delivery.status));
  const weeklyCompletedDeliveries = completedDeliveries.filter((delivery) =>
    isWithinWeek(getDeliveryCompletedMs(delivery), weekDays)
  );
  const weeklyTotalEarnings = weeklyCompletedDeliveries.reduce((sum, delivery) => {
    return sum + toAmount(delivery);
  }, 0);
  const weeklyAmounts = weekDays.map((day) => {
    return weeklyCompletedDeliveries
      .filter((delivery) =>
        isSameLocalDay(
          getDeliveryCompletedMs(delivery),
          day
        )
      )
      .reduce((sum, delivery) => sum + toAmount(delivery), 0);
  });
  const maxWeeklyAmount = Math.max(...weeklyAmounts, 0);
  const chartBars =
    maxWeeklyAmount > 0
      ? weeklyAmounts.map((amount) => Math.max(36, Math.round((amount / maxWeeklyAmount) * 140)))
      : weeklyAmounts.map(() => 0);
  const peakAmount = formatCurrency(maxWeeklyAmount);
  const weekLabel = `${formatShortDate(weekDays[0])} - ${formatShortDate(weekDays[6])}`;
  const activeDuration = formatDuration(
    weeklyCompletedDeliveries.reduce((sum, delivery) => sum + getActiveDurationMs(delivery), 0)
  );
  const listItems = deliveries.map((delivery, index) => {
    const status: PaymentFilter = isPaidDelivery(delivery.status) ? 'paid' : 'pending';

    return {
      id: delivery.id || `delivery-${index}`,
      title: getDeliveryTitle(delivery),
      amount: toAmount(delivery),
      date: formatListDate(delivery.timestamps?.deliveredAt || delivery.timestamps?.createdAt),
      status,
      source: delivery,
    };
  });
  const visibleItems = listItems.filter((item) => item.status === filter);

  return (
    <SafeAreaView style={styles.container}>
      <TopSummary
        weekLabel={weekLabel}
        totalEarned={formatCurrency(weeklyTotalEarnings)}
        onPreviousWeek={() => setWeekOffset((current) => current - 1)}
        onNextWeek={() => setWeekOffset((current) => Math.min(current + 1, 0))}
        canGoNext={canGoNextWeek}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <WeeklyChart
          bars={chartBars}
          days={weekDays}
          activeIndex={todayIndex}
          peakAmount={peakAmount}
        />
        <StatsBlock
          completedCount={weeklyCompletedDeliveries.length}
          activeDuration={activeDuration}
        />

        <View style={styles.deliveriesSection}>
          <View style={styles.deliveriesHeader}>
            <Text style={styles.sectionTitle}>My Deliveries</Text>
            <SegmentedFilter value={filter} onChange={setFilter} />
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#0055cc" />
              <Text style={styles.loadingText}>Loading deliveries...</Text>
            </View>
          ) : visibleItems.length > 0 ? (
            <View style={styles.deliveryList}>
              {visibleItems.map((item) => (
                <DeliveryRow
                  key={item.id}
                  item={item}
                  thumbnail={deliveryThumbImage}
                  onPress={
                    item.source?.id
                      ? () =>
                          router.push({
                            pathname: item.status === 'paid' ? '/payment-received' : '/payment-pending',
                            params: {
                              deliveryId: item.source?.id,
                            },
                          })
                      : undefined
                  }
                />
              ))}
            </View>
          ) : (
            <EmptyList filter={filter} />
          )}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff2f6',
  },
  header: {
    backgroundColor: '#dbe6f7',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  statusSpacer: {
    height: 52,
  },
  topNav: {
    height: 64,
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 8,
  },
  navTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    lineHeight: 32,
    color: '#1c1c1c',
  },
  weekSummary: {
    width: '100%',
    maxWidth: 412,
    alignSelf: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    gap: 4,
  },
  weekLabel: {
    width: '100%',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    letterSpacing: -0.5,
    color: '#1c1c1c',
    textAlign: 'center',
  },
  weekAmountRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  weekNavButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavButtonDisabled: {
    opacity: 0.35,
  },
  weekAmount: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 40,
    lineHeight: 48,
    color: '#1c1c1c',
    textAlign: 'center',
  },
  weekCaption: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#606060',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 412,
    alignSelf: 'center',
    paddingBottom: 94,
  },
  chartSection: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  peakAmount: {
    width: '100%',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    letterSpacing: -0.5,
    color: '#1c1c1c',
    textAlign: 'center',
    marginBottom: 4,
  },
  chartGrid: {
    height: 141,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(51, 51, 51, 0.5)',
  },
  chartBar: {
    flex: 1,
    minWidth: 1,
    maxWidth: 44,
    borderRadius: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 51, 51, 0.5)',
    backgroundColor: '#76b0ff',
  },
  chartBarActive: {
    backgroundColor: '#0055cc',
  },
  dayRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  dayLabel: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#606060',
    textAlign: 'center',
  },
  dayLabelActive: {
    color: '#1c1c1c',
  },
  statsSection: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  sectionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1,
    color: '#1c1c1c',
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#606060',
  },
  statValue: {
    width: '100%',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -1,
    color: '#1c1c1c',
  },
  deliveriesSection: {
    width: '100%',
    paddingTop: 24,
    gap: 24,
  },
  deliveriesHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  segmentedControl: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#bbbbbb',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eff2f6',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
  },
  segmentText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#606060',
  },
  segmentTextActive: {
    color: '#1c1c1c',
  },
  loadingRow: {
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d2d2d2',
    backgroundColor: '#eff2f6',
    paddingHorizontal: 16,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#606060',
  },
  deliveryList: {
    width: '100%',
  },
  deliveryRow: {
    width: '100%',
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  deliveryThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  deliveryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  deliveryTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: -0.5,
    color: '#1c1c1c',
  },
  deliveryMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#606060',
  },
  statusBadge: {
    minHeight: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  paidBadge: {
    backgroundColor: '#1fc16b',
  },
  pendingBadge: {
    backgroundColor: '#ffdb43',
  },
  statusBadgeText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  paidBadgeText: {
    color: '#ffffff',
  },
  pendingBadgeText: {
    color: '#1c1c1c',
  },
  emptyRow: {
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d2d2d2',
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  emptyTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#606060',
    textAlign: 'center',
  },
});

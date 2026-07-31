import { auth } from "@/lib/firebase";
import { fs, hit, isCompactPhone, rs, vs } from "@/lib/responsive";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const deliveryThumbImage = require("@/assets/images/delivery/delivery-list-thumb.png");

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
  senderId?: string | null;
  status?: string;
  pricingStatus?: string | null;
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
    pricingStatus?: string | null;
    paymentStatus?: string | null;
  };
  paymentStatus?: string | null;
  timestamps?: {
    createdAt?: DeliveryTimestamp;
    assignedAt?: DeliveryTimestamp;
    inTransitAt?: DeliveryTimestamp;
    deliveredAt?: DeliveryTimestamp;
  };
};

type PaymentFilter = "paid" | "pending";

type DeliveryListItem = {
  id: string;
  title: string;
  amount: number;
  date: string;
  status: PaymentFilter;
  profileImageUri: string;
  source?: DeliveryRecord;
};

type CustomerProfileResponse = {
  success?: boolean;
  data?: {
    profilePhotoUrl?: string;
    photoUri?: string;
  } | null;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getApiBaseUrl = () => {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:5000"
  ).replace(/\/$/, "");
};

const getDriverAuthContext = async () => {
  const [storedUid, storedIdToken] = await Promise.all([
    AsyncStorage.getItem("firebaseUid"),
    AsyncStorage.getItem("firebaseIdToken"),
  ]);
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid || storedUid;
  let idToken = storedIdToken;

  if (currentUser) {
    const refreshedToken = await currentUser.getIdToken().catch(() => null);
    if (refreshedToken) {
      idToken = refreshedToken;
      await AsyncStorage.multiSet([
        ["firebaseUid", currentUser.uid],
        ["firebaseIdToken", refreshedToken],
      ]);
    }
  }

  return { uid, idToken };
};

const getDeliveryHeaders = (idToken?: string | null) => ({
  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
});

const getCustomerProfilePhotoUrl = async (
  senderId: string,
  idToken?: string | null,
) => {
  const response = await fetch(
    `${getApiBaseUrl()}/api/firestore/customers/${encodeURIComponent(senderId)}`,
    {
      headers: getDeliveryHeaders(idToken),
    },
  );
  const body = (await response
    .json()
    .catch(() => null)) as CustomerProfileResponse | null;

  if (!response.ok || body?.success === false) {
    return "";
  }

  const photoUrl = body?.data?.profilePhotoUrl || body?.data?.photoUri || "";
  return photoUrl.startsWith("http") ? photoUrl : "";
};

const formatCurrency = (value: unknown) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "\u20b90";
  }

  return `\u20b9${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
};

const readTimestampMs = (value: DeliveryTimestamp | undefined) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value._seconds === "number") return value._seconds * 1000;
  if (typeof value.seconds === "number") return value.seconds * 1000;
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
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const formatListDate = (value: DeliveryTimestamp | undefined) => {
  const timestamp = readTimestampMs(value);
  const date = timestamp ? new Date(timestamp) : new Date();

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isPaidDelivery = (delivery: DeliveryRecord) => {
  const pricingStatus = String(
    delivery.pricingStatus ||
      delivery.pricing?.pricingStatus ||
      delivery.paymentStatus ||
      delivery.pricing?.paymentStatus ||
      "",
  ).toLowerCase();
  return pricingStatus === "completed" || pricingStatus === "paid";
};

const toAmount = (delivery: DeliveryRecord) => {
  const amount = Number(delivery.pricing?.tripFare ?? delivery.pricing?.total);
  return Number.isFinite(amount) ? amount : 0;
};

const getDeliveryCompletedMs = (delivery: DeliveryRecord) => {
  return readTimestampMs(
    delivery.timestamps?.deliveredAt || delivery.timestamps?.createdAt,
  );
};

const getActiveDurationMs = (delivery: DeliveryRecord) => {
  const deliveredAt = readTimestampMs(delivery.timestamps?.deliveredAt);
  const startedAt = readTimestampMs(delivery.timestamps?.inTransitAt);

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
  const address =
    delivery.locations?.pickup?.address || delivery.locations?.dropoff?.address;
  const [primary, secondary] = (address || "Delivery location unavailable")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (primary && secondary) {
    return `${primary}, ${secondary}`;
  }

  return primary || "Delivery location unavailable";
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
            style={[
              styles.weekNavButton,
              !canGoNext ? styles.weekNavButtonDisabled : null,
            ]}
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
  amounts,
  days,
  activeIndex,
  peakAmount,
}: {
  bars: number[];
  amounts: string[];
  days: Date[];
  activeIndex: number | null;
  peakAmount: string;
}) {
  return (
    <View style={styles.chartSection}>
      <Text style={styles.peakAmount}>{peakAmount}</Text>
      {/* <View style={styles.routeSeparator} /> */}
      <View style={styles.chartGrid}>
        {bars.map((height, index) => (
          <View
            key={`${days[index].toISOString()}-${index}`}
            style={styles.chartColumn}
          >
            <Text
              style={[
                styles.chartAmount,
                index === activeIndex ? styles.chartAmountActive : null,
              ]}
            >
              {amounts[index]}
            </Text>
            <View
              style={[
                styles.chartBar,
                { height },
                index === activeIndex ? styles.chartBarActive : null,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.dayRow}>
        {days.map((date, index) => (
          <Text
            key={date.toISOString()}
            style={[
              styles.dayLabel,
              index === activeIndex ? styles.dayLabelActive : null,
            ]}
          >
            {date.getDate()}
            {"\n"}
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
        style={[styles.segment, value === "paid" ? styles.segmentActive : null]}
        onPress={() => onChange("paid")}
      >
        <Text
          style={[
            styles.segmentText,
            value === "paid" ? styles.segmentTextActive : null,
          ]}
        >
          Paid
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={[
          styles.segment,
          value === "pending" ? styles.segmentActive : null,
        ]}
        onPress={() => onChange("pending")}
      >
        <Text
          style={[
            styles.segmentText,
            value === "pending" ? styles.segmentTextActive : null,
          ]}
        >
          Pending
        </Text>
      </Pressable>
    </View>
  );
}

function DeliveryRow({
  item,
  onPress,
}: {
  item: DeliveryListItem;
  onPress?: () => void;
}) {
  const isPaid = item.status === "paid";
  const imageSource = item.profileImageUri
    ? { uri: item.profileImageUri }
    : deliveryThumbImage;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      style={styles.deliveryRow}
      onPress={onPress}
    >
      <Image
        source={imageSource}
        style={styles.deliveryThumb}
        resizeMode="cover"
      />
      <View style={styles.deliveryCopy}>
        <Text style={styles.deliveryTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.deliveryMeta} numberOfLines={1}>
          {formatCurrency(item.amount)} earned • {item.date}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          isPaid ? styles.paidBadge : styles.pendingBadge,
        ]}
      >
        <Text
          style={[
            styles.statusBadgeText,
            isPaid ? styles.paidBadgeText : styles.pendingBadgeText,
          ]}
          numberOfLines={1}
        >
          {isPaid ? "Paid" : "Pending"}
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
        {filter === "paid" ? "No paid deliveries yet" : "No pending deliveries"}
      </Text>
    </View>
  );
}

export default function MyDeliveriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<PaymentFilter>("paid");
  const [deliveries, setDeliveries] = React.useState<DeliveryRecord[]>([]);
  const [senderPhotoById, setSenderPhotoById] = React.useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [weekOffset, setWeekOffset] = React.useState(0);
  const hasLoadedDeliveriesRef = React.useRef(false);
  const currentWeekDays = React.useMemo(getWeekDays, []);
  const weekDays = React.useMemo(() => {
    return currentWeekDays.map((date) => {
      const shiftedDate = new Date(date);
      shiftedDate.setDate(date.getDate() + weekOffset * 7);
      return shiftedDate;
    });
  }, [currentWeekDays, weekOffset]);
  const todayIndex = weekDays.findIndex((date) =>
    isSameLocalDay(Date.now(), date),
  );
  const activeDayIndex = todayIndex >= 0 ? todayIndex : null;
  const canGoNextWeek = weekOffset < 0;

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadDriverDeliveries = async () => {
        try {
          if (!hasLoadedDeliveriesRef.current) {
            setIsLoading(true);
          }
          const { uid, idToken } = await getDriverAuthContext();

          if (!uid) {
            if (isActive) {
              setDeliveries([]);
              setSenderPhotoById({});
            }
            return;
          }

          const response = await fetch(
            `${getApiBaseUrl()}/api/deliveries/driver/${encodeURIComponent(uid)}?type=all`,
            {
              headers: getDeliveryHeaders(idToken),
            },
          );
          const body = (await response.json().catch(() => null)) as {
            success?: boolean;
            data?: DeliveryRecord[];
            error?: string;
          } | null;

          if (!response.ok || body?.success === false) {
            throw new Error(body?.error || "Unable to load deliveries");
          }

          const items = Array.isArray(body?.data) ? body.data : [];
          items.sort((a, b) => {
            const aTime = readTimestampMs(
              a.timestamps?.deliveredAt || a.timestamps?.createdAt,
            );
            const bTime = readTimestampMs(
              b.timestamps?.deliveredAt || b.timestamps?.createdAt,
            );
            return bTime - aTime;
          });
          const senderIds = Array.from(
            new Set(
              items
                .map((delivery) => delivery.senderId)
                .filter((senderId): senderId is string => Boolean(senderId)),
            ),
          );
          const senderPhotoEntries = await Promise.all(
            senderIds.map(async (senderId) => {
              const photoUrl = await getCustomerProfilePhotoUrl(
                senderId,
                idToken,
              ).catch((error) => {
                console.error("Error loading sender profile photo:", error);
                return "";
              });
              return [senderId, photoUrl] as const;
            }),
          );

          if (isActive) {
            setSenderPhotoById(Object.fromEntries(senderPhotoEntries));
            setDeliveries(items);
          }
        } catch (error) {
          console.error("Error loading my deliveries:", error);
        } finally {
          if (isActive) {
            hasLoadedDeliveriesRef.current = true;
            setIsLoading(false);
          }
        }
      };

      loadDriverDeliveries();
      const interval = setInterval(loadDriverDeliveries, 5000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, []),
  );

  const completedDeliveries = deliveries.filter((delivery) =>
    isPaidDelivery(delivery),
  );
  const weeklyCompletedDeliveries = completedDeliveries.filter((delivery) =>
    isWithinWeek(getDeliveryCompletedMs(delivery), weekDays),
  );
  const weeklyTotalEarnings = weeklyCompletedDeliveries.reduce(
    (sum, delivery) => {
      return sum + toAmount(delivery);
    },
    0,
  );
  const weeklyAmounts = weekDays.map((day) => {
    return weeklyCompletedDeliveries
      .filter((delivery) =>
        isSameLocalDay(getDeliveryCompletedMs(delivery), day),
      )
      .reduce((sum, delivery) => sum + toAmount(delivery), 0);
  });
  const maxWeeklyAmount = Math.max(...weeklyAmounts, 0);
  const chartBars =
    maxWeeklyAmount > 0
      ? weeklyAmounts.map((amount) =>
          Math.max(36, Math.round((amount / maxWeeklyAmount) * 112)),
        )
      : weeklyAmounts.map(() => 0);
  const chartAmounts = weeklyAmounts.map((amount) => formatCurrency(amount));
  const peakAmount = formatCurrency(maxWeeklyAmount);
  const weekLabel = `${formatShortDate(weekDays[0])} - ${formatShortDate(weekDays[6])}`;
  const activeDuration = formatDuration(
    weeklyCompletedDeliveries.reduce(
      (sum, delivery) => sum + getActiveDurationMs(delivery),
      0,
    ),
  );
  const listItems = deliveries.map((delivery, index) => {
    const status: PaymentFilter = isPaidDelivery(delivery) ? "paid" : "pending";

    return {
      id: delivery.id || `delivery-${index}`,
      title: getDeliveryTitle(delivery),
      amount: toAmount(delivery),
      date: formatListDate(
        delivery.timestamps?.deliveredAt || delivery.timestamps?.createdAt,
      ),
      status,
      profileImageUri: delivery.senderId
        ? senderPhotoById[delivery.senderId] || ""
        : "",
      source: delivery,
    };
  });
  const visibleItems = listItems.filter((item) => item.status === filter);

  return (
    <SafeAreaView style={styles.container}>
      <TopSummary
        weekLabel={weekLabel}
        totalEarned={isLoading ? "..." : formatCurrency(weeklyTotalEarnings)}
        onPreviousWeek={() => setWeekOffset((current) => current - 1)}
        onNextWeek={() => setWeekOffset((current) => Math.min(current + 1, 0))}
        canGoNext={canGoNextWeek}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#0055cc" />
            <Text style={styles.loadingText}>Loading deliveries...</Text>
          </View>
        ) : (
          <>
            <WeeklyChart
              bars={chartBars}
              amounts={chartAmounts}
              days={weekDays}
              activeIndex={activeDayIndex}
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

              {visibleItems.length > 0 ? (
                <View style={styles.deliveryList}>
                  {visibleItems.map((item) => (
                    <DeliveryRow
                      key={item.id}
                      item={item}
                      onPress={
                        item.source?.id
                          ? () =>
                              router.push({
                                pathname:
                                  item.status === "paid"
                                    ? "/payment-received"
                                    : "/payment-pending",
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dbe6f7",
  },
  header: {
    backgroundColor: "#dbe6f7",
    borderBottomLeftRadius: rs(24),
    borderBottomRightRadius: rs(24),
    overflow: "hidden",
  },
  topNav: {
    minHeight: vs(56),
    justifyContent: "center",
    paddingLeft: rs(16),
    paddingRight: rs(4),
    paddingVertical: vs(4),
  },
  navTitle: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: fs(20, 17, 22),
    lineHeight: fs(32, 26, 34),
    color: "#1c1c1c",
  },
  weekSummary: {
    width: "100%",
    maxWidth: rs(412, 320, 430),
    alignSelf: "center",
    paddingTop: vs(24),
    paddingBottom: vs(24),
    gap: vs(4),
  },
  weekLabel: {
    width: "100%",
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    letterSpacing: -0.5,
    color: "#1c1c1c",
    textAlign: "center",
  },
  weekAmountRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: rs(40, 24, 44),
  },
  weekNavButton: {
    width: hit(44),
    height: hit(44),
    alignItems: "center",
    justifyContent: "center",
  },
  weekNavButtonDisabled: {
    opacity: 0.35,
  },
  weekAmount: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: fs(40, 30, 42),
    lineHeight: fs(48, 36, 50),
    color: "#1c1c1c",
    textAlign: "center",
  },
  weekCaption: {
    width: "100%",
    fontFamily: "Poppins_400Regular",
    fontSize: 16,
    lineHeight: fs(24),
    color: "#606060",
    textAlign: "center",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#eff2f6",
  },
  content: {
    width: "100%",
    maxWidth: rs(412, 320, 430),
    alignSelf: "center",
    paddingBottom: 30,
  },
  chartSection: {
    width: "100%",
    backgroundColor: "#ffffff",
    paddingHorizontal: rs(16, 12, 18),
    paddingTop: vs(24),
    paddingBottom: vs(16),
  },
  peakAmount: {
    width: "100%",
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    letterSpacing: -0.5,
    color: "#1c1c1c",
    textAlign: "center",
    marginBottom: 4,
  },
  chartGrid: {
    height: vs(141, 126, 150),
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: rs(12, 6, 12),
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d6d6d6",
  },
  chartColumn: {
    flex: 1,
    height: "100%",
    minWidth: 1,
    maxWidth: rs(44, 34, 46),
    alignItems: "center",
    justifyContent: "flex-end",
    gap: vs(4),
  },
  chartAmount: {
    width: "100%",
    fontFamily: "Poppins_500Medium",
    fontSize: fs(10, 9, 11),
    lineHeight: fs(14, 12, 15),
    color: "#606060",
    textAlign: "center",
  },
  chartAmountActive: {
    color: "#0055cc",
  },
  chartBar: {
    width: "100%",
    borderRadius: rs(4),
    borderBottomWidth: 1,
    borderBottomColor: "#33333380",
    backgroundColor: "#76b0ff",
  },
  chartBarActive: {
    backgroundColor: "#0055cc",
  },
  dayRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: rs(16, 6, 16),
  },
  dayLabel: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: fs(13),
    lineHeight: fs(21, 17, 22),
    color: "#606060",
    textAlign: "center",
  },
  dayLabelActive: {
    color: "#1c1c1c",
  },
  statsSection: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#d2d2d2",
    paddingHorizontal: rs(16),
    paddingTop: vs(16),
    paddingBottom: vs(24),
    gap: vs(16),
  },
  sectionTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: fs(20, 17, 22),
    color: "#1c1c1c",
  },
  statsRow: {
    width: "100%",
    flexDirection: "row",
    gap: rs(16, 10, 16),
    flexWrap: isCompactPhone ? "wrap" : "nowrap",
  },
  statItem: {
    flex: 1,
    minWidth: isCompactPhone ? "46%" : 0,
    gap: vs(4),
  },
  statLabel: {
    width: "100%",
    fontFamily: "Poppins_400Regular",
    fontSize: fs(14, 12, 15),
    lineHeight: fs(21),
    color: "#606060",
  },
  statValue: {
    width: "100%",
    fontFamily: "Poppins_500Medium",
    fontSize: fs(24, 20, 26),
    lineHeight: fs(26),
    letterSpacing: -1,
    color: "#1c1c1c",
  },
  deliveriesSection: {
    width: "100%",
    paddingTop: vs(24),
    gap: vs(24),
  },
  deliveriesHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: rs(16),
    gap: rs(12),
    flexWrap: "wrap",
  },
  segmentedControl: {
    height: hit(32),
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#bbbbbb",
    borderRadius: rs(8),
    overflow: "hidden",
    backgroundColor: "#eff2f6",
  },
  segment: {
    alignItems: "center",
    justifyContent: "center",

    width: rs(85, 72, 90),
  },
  segmentActive: {
    backgroundColor: "#ffffff",
  },
  segmentText: {
    fontFamily: "Poppins_400Regular",
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    color: "#606060",
  },
  segmentTextActive: {
    color: "#1c1c1c",
  },
  loadingRow: {
    width: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d2d2d2",
    backgroundColor: "#eff2f6",
    paddingHorizontal: rs(16),
    paddingVertical: vs(24),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: fs(14),
    lineHeight: fs(21),
    color: "#606060",
  },
  deliveryList: {
    width: "100%",
  },
  deliveryRow: {
    width: "100%",
    minHeight: vs(88),
    flexDirection: "row",
    alignItems: "center",
    gap: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: "#d2d2d2",
    paddingHorizontal: rs(16),
    paddingVertical: vs(20),
  },
  deliveryThumb: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(8),
    backgroundColor: "#000000",
  },
  deliveryCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: vs(4),
  },
  deliveryTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    lineHeight: fs(18),
    letterSpacing: -0.5,
    color: "#1c1c1c",
  },
  deliveryMeta: {
    fontFamily: "Poppins_400Regular",
    fontSize: fs(14, 12, 15),
    lineHeight: fs(21),
    color: "#606060",
  },
  statusBadge: {
    maxWidth: "28%",
    flexShrink: 0,
    minHeight: hit(24),
    borderRadius: rs(4),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
  },
  paidBadge: {
    backgroundColor: "#1fc16b",
  },
  pendingBadge: {
    backgroundColor: "#ffdb43",
  },
  statusBadgeText: {
    maxWidth: "100%",
    fontFamily: "Poppins_400Regular",
    fontSize: fs(12, 11, 13),
    lineHeight: fs(18),
    textAlign: "center",
  },
  paidBadgeText: {
    color: "#ffffff",
  },
  pendingBadgeText: {
    color: "#1c1c1c",
  },
  emptyRow: {
    width: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d2d2d2",
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  emptyTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: "#606060",
    textAlign: "center",
  },
  routeSeparator: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d6d6d6",
    width: "100%",
  },
});

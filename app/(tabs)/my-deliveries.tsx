import React, { useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, Image,
  RefreshControl, ActivityIndicator, Pressable, Dimensions
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { getDriverAssignedDeliveries, type Delivery } from '@/lib/deliveryService';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const companyImage = require('@/assets/images/my-delivery-company.png');
const homeTabImage = require('@/assets/images/home-tab-home.png');
const deliveriesTabImage = require('@/assets/images/home-tab-deliveries1.png');
const profileTabImage = require('@/assets/images/home-tab-profile.png');

const chartLabels = [
  { date: '30', day: 'Mon' },
  { date: '1', day: 'Tue' },
  { date: '2', day: 'Wed' },
  { date: '3', day: 'Thu' },
  { date: '4', day: 'Fri' },
  { date: '5', day: 'Sat' },
  { date: '6', day: 'Sun' },
];

// --- HELPERS ---
function toDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal.toDate) return dateVal.toDate();
  if (dateVal instanceof Date) return dateVal;
  if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
  return new Date(dateVal);
}

function formatDate(dateVal: any): string {
  const date = toDate(dateVal);
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount = 0): string {
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

export default function MyDeliveriesApp() {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'details'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'paid' | 'pending'>('paid');

  // --- BACKEND SYNC ---
  const loadDeliveries = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const uid = auth.currentUser?.uid || (await AsyncStorage.getItem('firebaseUid'));
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : await AsyncStorage.getItem('firebaseIdToken');
      if (!uid) { setDeliveries([]); return; }
      const d = await getDriverAssignedDeliveries(uid, idToken);
      setDeliveries(d);
    } catch (error) {
      console.error('Error loading my deliveries:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadDeliveries(false); }, []));

  const stats = useMemo(() => {
    const history = deliveries.filter(d => d.status === 'delivered');
    const pending = deliveries.filter(d => d.status !== 'delivered' && d.status !== 'cancelled');
    const totalEarned = history.reduce((sum, d) => sum + (d.pricing?.total || 0), 0);
    
    // Dynamic Chart Logic: Group earnings by day of week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const chart = days.map((label, index) => {
        const dayTotal = deliveries
            .filter(d => toDate(d.timestamps?.createdAt)?.getDay() === index)
            .reduce((sum, d) => sum + (d.pricing?.total || 0), 0);
        return { label, val: dayTotal, day: index + 1 };
    });
    return { history, pending, totalEarned, chart };
  }, [deliveries]);

  const selectedDelivery = useMemo(() => deliveries.find(d => d.id === selectedId), [selectedId, deliveries]);

  // --- RENDER PARTS ---

  if (view === 'details' && selectedDelivery) {
    const isPaid = selectedDelivery.status === 'delivered';
    return (
      <SafeAreaView style={[s.container, {backgroundColor: '#F9FAFB'}]}>
        {/* DYNAMIC HEADER: Green for Paid, White for Pending */}
        <View style={[s.detailsHeader, { backgroundColor: isPaid ? '#22C55E' : '#FFF' }]}>
          <Pressable onPress={() => setView('list')} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={isPaid ? '#FFF' : '#333'} />
          </Pressable>
          <Text style={[s.detailsHeaderTitle, { color: isPaid ? '#FFF' : '#333' }]}>
            {isPaid ? 'Delivery details' : 'Payment details'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.compRow}>
            <View style={s.logoSquare}><MaterialCommunityIcons name="alpha-a-box" size={24} color="white" /></View>
            <View>
              <Text style={s.compMain}>{selectedDelivery.locations?.pickup?.address.split(',')[0]}</Text>
              <Text style={s.compSub}>{formatDate(selectedDelivery.timestamps?.createdAt)} • ₹{selectedDelivery.pricing?.total?.toLocaleString()} earned</Text>
            </View>
          </View>

          <View style={s.statusRow}>
            <Text style={s.earnAmount}>₹{selectedDelivery.pricing?.total?.toLocaleString()} earning</Text>
            <View style={s.statusBadge}>
              <Ionicons name={isPaid ? "checkmark-circle" : "time"} size={18} color={isPaid ? "#22C55E" : "#FBBF24"} />
              <Text style={[s.statusText, {color: isPaid ? "#22C55E" : "#111"}]}>
                {isPaid ? 'Payment completed' : 'Payment pending'}
              </Text>
            </View>
          </View>

          {/* ROUTE CARD */}
          <View style={s.card}>
            <View style={s.cardHeader}><Feather name="navigation" size={16} color="#333" /><Text style={s.cardTitle}>Route</Text></View>
            <View style={s.timelineBox}>
              <View style={s.timelineLine} />
              <View style={s.stop}>
                <View style={s.dotBlue} />
                <View style={s.stopInfo}>
                  <Text style={s.stopLabel}>Pickup</Text>
                  <Text style={s.stopAddr}>{selectedDelivery.locations?.pickup?.address.split(',')[0]}</Text>
                  <Text style={s.stopSub}>{selectedDelivery.locations?.pickup?.address}</Text>
                </View>
              </View>
              <View style={[s.stop, {marginTop: 24}]}>
                <View style={s.arrowDownCircle}><Ionicons name="chevron-down" size={10} color="#0055FF" /></View>
                <View style={s.stopInfo}>
                  <Text style={s.stopLabel}>Drop 35km</Text>
                  <Text style={s.stopAddr}>{selectedDelivery.locations?.dropoff?.address.split(',')[0]}</Text>
                  <Text style={s.stopSub}>{selectedDelivery.locations?.dropoff?.address}</Text>
                </View>
              </View>
              <Text style={s.totalKms}>Total 35 kms • 48 mins</Text>
            </View>
          </View>

          {/* PAYMENT SUMMARY */}
          <View style={s.card}>
            <View style={s.summaryBlueHeader}>
               <MaterialCommunityIcons name="sync" size={16} color="#0055FF" />
               <Text style={s.cardTitle}>Payment summary</Text>
            </View>
            <View style={s.priceRow}><Text style={s.pLabel}>Amount earned</Text><Text style={s.pValue}>₹{selectedDelivery.pricing?.total}</Text></View>
            <View style={s.priceRow}>
              <View style={{flexDirection:'row', alignItems:'center'}}><Text style={s.pLabel}>Platform fee </Text><Ionicons name="information-circle-outline" size={14} color="#888" /></View>
              <Text style={s.pValue}>-₹200</Text>
            </View>
            <View style={[s.priceRow, {marginTop: 8, borderTopWidth: 0.5, borderTopColor: '#EEE', paddingTop: 8}]}>
              <Text style={s.pTotalLabel}>Amount received</Text><Text style={s.pTotalValue}>₹{(selectedDelivery.pricing?.total || 0) - 200}</Text>
            </View>
          </View>

          {/* ACCORDION */}
          <View style={s.card}>
            <View style={s.accordionHeader}><Text style={s.accTitle}>Transaction Details</Text><Ionicons name="chevron-up" size={18} color="#CCC" /></View>
            <View style={s.accRow}><Text style={s.accLabel}>Send by</Text><Text style={s.accVal}>MachRush Admin</Text></View>
            <View style={s.accRow}><Text style={s.accLabel}>{isPaid ? 'Received date' : 'Expected settlement'}</Text><Text style={s.accVal}>{isPaid ? '16 Apr 2026' : 'Processing'}</Text></View>
            {isPaid && <View style={s.accRow}><Text style={s.accLabel}>Credited to</Text><Text style={s.accVal}>XXXXXXXXXX1034</Text></View>}
          </View>

          <Pressable style={s.reportBtn}><Text style={s.reportBtnText}>Report an issue</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const visibleDeliveries = activeTab === 'paid' ? stats.history : stats.pending;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadDeliveries(true)} colors={['#05c']} />}
      >
        <View style={s.weeklySection}>
          <View style={s.statusBarSpacer} />
          <Text style={s.weeklyTitle}>Weekly breakdown</Text>
          <View style={s.earningsNav}>
            <Ionicons name="caret-back" size={24} color="#606060" />
            <View style={{ alignItems: 'center' }}>
              <Text style={s.dateRange}>Sep 30 - Oct 6</Text>
              <Text style={s.totalAmount}>{formatCurrency(stats.totalEarned)}</Text>
              <Text style={s.totalLabel}>Total earned</Text>
            </View>
            <Ionicons name="caret-forward" size={24} color="#606060" />
          </View>
        </View>

        <View style={s.chartSection}>
          <View style={s.chartContainer}>
            <View style={s.chartGridLine} />
            <Text style={s.chartLimitText}>{'\u20B9'}4,000</Text>
            <View style={s.barsRow}>
              {stats.chart.map((item, i) => {
                const max = Math.max(...stats.chart.map(o => o.val)) || 1;
                const h = (item.val / max) * 140;
                const isPeak = item.val === max && max > 0;
                const label = chartLabels[i] || { date: String(item.day), day: item.label };
                return (
                  <View key={i} style={s.barWrapper}>
                    <View style={[s.bar, { height: Math.max(h, 40), backgroundColor: isPeak ? '#05c' : '#76b0ff' }]} />
                    <Text style={[s.barDayNum, isPeak && s.barDayActive]}>{label.date}</Text>
                    <Text style={[s.barDayLabel, isPeak && s.barDayActive]}>{label.day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={s.statsContainer}>
          <Text style={s.sectionHeader}>Stats</Text>
          <View style={s.statsRow}>
            <View style={s.statBox}><Text style={s.statLabel}>Total Trip completed</Text><Text style={s.statValue}>{stats.history.length}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Active Hours</Text><Text style={s.statValue}>70 h 57 m</Text></View>
          </View>
        </View>

        <View style={s.listHeaderRow}>
          <Text style={s.sectionHeader}>My Deliveries</Text>
          <View style={s.tabContainer}>
            <Pressable onPress={() => setActiveTab('paid')} style={[s.tabButton, s.tabButtonLeft, activeTab === 'paid' && s.tabButtonActive]}><Text style={[s.tabTextMain, activeTab === 'paid' && s.tabTextActive]}>Paid</Text></Pressable>
            <Pressable onPress={() => setActiveTab('pending')} style={[s.tabButton, s.tabButtonRight, activeTab === 'pending' && s.tabButtonActive]}><Text style={[s.tabTextMain, activeTab === 'pending' && s.tabTextActive]}>Pending</Text></Pressable>
          </View>
        </View>

        <View style={s.deliveryList}>
          {isLoading ? <ActivityIndicator style={{ marginTop: 50 }} color="#0055FF" /> :
           visibleDeliveries.length === 0 ? (
            <View style={s.emptyList}>
              <Text style={s.emptyTitle}>No {activeTab} deliveries</Text>
              <Text style={s.emptyText}>Pull down to refresh when new deliveries are available.</Text>
            </View>
           ) : visibleDeliveries.map((delivery) => {
            const isActive = delivery.status === 'assigned' || delivery.status === 'in_transit';
            return (
            <Pressable key={delivery.id} style={s.deliveryItem} onPress={() => {
              if (isActive) {
                const route = `/(tabs)/DeliverStepsConfirmation?deliveryId=${encodeURIComponent(delivery.id)}`;
                router.push(route as any);
              } else {
                setSelectedId(delivery.id);
                setView('details');
              }
            }}>
              <View style={s.itemLeft}>
                <Image source={companyImage} style={s.logoContainer} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={s.companyName} numberOfLines={1}>{delivery.locations?.pickup?.address.split(',')[0]}</Text>
                  <Text style={s.itemSubText} numberOfLines={1}>{formatCurrency(delivery.pricing?.total || 0)} earned {'\u2022'} {formatDate(delivery.timestamps?.createdAt)}</Text>
                </View>
              </View>
              <View style={s.itemRight}>
                {isActive ? (
                  <View style={[s.statusPill, { backgroundColor: '#DBEAFE' }]}>
                    <Text style={[s.statusPillText, { color: '#2563EB' }]}>Track</Text>
                  </View>
                ) : (
                  <View style={[s.statusPill, activeTab === 'paid' ? s.badgePaid : s.badgePending]}>
                    <Text style={[s.statusPillText, activeTab === 'paid' ? s.textPaid : s.textPending]}>{activeTab === 'paid' ? 'Paid' : 'Pending'}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={24} color="#bbbbbb" />
              </View>
            </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.bottomNav}>
         <Pressable style={s.navItem} onPress={() => router.push('/(tabs)')}><Image source={homeTabImage} style={s.navIcon} resizeMode="contain" /><Text style={s.navText}>Home</Text></Pressable>
         <Pressable style={s.navItem} onPress={() => {}}><Image source={deliveriesTabImage} style={s.navIcon} resizeMode="contain" /><Text style={s.navTextActive}>{"My delivery's"}</Text></Pressable>
         <Pressable style={s.navItem} onPress={() => router.push('/profile')}><Image source={profileTabImage} style={s.navIcon} resizeMode="contain" /><Text style={s.navText}>Profile</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff2f6' },
  // Dashboard
  scrollContent: { paddingBottom: 94 },
  weeklySection: { backgroundColor: '#dbe6f7', paddingHorizontal: 16, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  statusBarSpacer: { height: 52 },
  weeklyTitle: { fontSize: 20, fontWeight: '500', color: '#1c1c1c', fontFamily: 'Poppins', lineHeight: 32 },
  earningsNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 24 },
  totalAmount: { fontSize: 40, fontWeight: '500', color: '#1c1c1c', fontFamily: 'Poppins', lineHeight: 48 },
  dateRange: { fontSize: 16, color: '#1c1c1c', fontWeight: '500', fontFamily: 'Poppins', letterSpacing: -0.5 },
  totalLabel: { fontSize: 16, color: '#606060', fontFamily: 'Poppins', lineHeight: 24 },
  chartSection: { backgroundColor: '#ffffff', paddingHorizontal: 13, paddingTop: 24, paddingBottom: 16 },
  chartContainer: { height: 191, justifyContent: 'flex-end' },
  chartGridLine: { position: 'absolute', top: 37, left: 0, right: 0, borderTopWidth: 1, borderColor: 'rgba(51,51,51,0.5)', borderStyle: 'dashed' },
  chartLimitText: { position: 'absolute', top: 0, width: '100%', textAlign: 'center', fontSize: 16, color: '#1c1c1c', fontWeight: '500', fontFamily: 'Poppins', letterSpacing: -0.5 },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: 'rgba(51,51,51,0.5)', borderStyle: 'dashed', paddingTop: 30 },
  barWrapper: { alignItems: 'center', width: (width - 26 - 72) / 7 },
  bar: { width: '100%', borderRadius: 4, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(51,51,51,0.5)' },
  barDayNum: { fontSize: 14, color: '#606060', fontFamily: 'Poppins', lineHeight: 21 },
  barDayLabel: { fontSize: 14, color: '#606060', fontFamily: 'Poppins', lineHeight: 21 },
  barDayActive: { color: '#1c1c1c' },
  statsContainer: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#d2d2d2' },
  sectionHeader: { fontSize: 24, fontWeight: '500', color: '#1c1c1c', fontFamily: 'Poppins', letterSpacing: -1 },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 16 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 14, color: '#606060', fontFamily: 'Poppins', lineHeight: 21 },
  statValue: { fontSize: 24, fontWeight: '500', color: '#1c1c1c', fontFamily: 'Poppins', letterSpacing: -1, marginTop: 4 },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 18 },
  tabContainer: { width: 152, height: 30, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderColor: '#bbbbbb', borderTopWidth: 1, borderBottomWidth: 1 },
  tabButtonLeft: { borderLeftWidth: 1, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  tabButtonRight: { borderWidth: 1, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  tabButtonActive: { backgroundColor: '#ffffff' },
  tabTextMain: { fontSize: 12, fontWeight: '400', color: '#606060', fontFamily: 'Poppins', lineHeight: 18 },
  tabTextActive: { color: '#1c1c1c' },
  deliveryList: { paddingBottom: 6 },
  deliveryItem: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#d2d2d2', alignItems: 'center' },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  logoContainer: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#000000' },
  companyName: { fontSize: 16, fontWeight: '500', color: '#1c1c1c', fontFamily: 'Poppins', letterSpacing: -0.5 },
  itemSubText: { fontSize: 14, color: '#606060', fontFamily: 'Poppins', lineHeight: 21, marginTop: 4 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusPill: { minHeight: 24, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  statusPillText: { fontSize: 12, fontWeight: '400', fontFamily: 'Poppins', lineHeight: 18 },
  badgePaid: { backgroundColor: '#1fc16b' },
  badgePending: { backgroundColor: '#ffdb43' },
  textPaid: { color: '#ffffff' },
  textPending: { color: '#1c1c1c' },
  emptyList: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36, borderTopWidth: 1, borderTopColor: '#d2d2d2' },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#1c1c1c', fontFamily: 'Poppins' },
  emptyText: { fontSize: 14, color: '#606060', fontFamily: 'Poppins', textAlign: 'center', marginTop: 6 },
  bottomNav: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#a4cbff', backgroundColor: '#eff2f6', position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  navItem: { flex: 1, alignItems: 'center', gap: 8 },
  navIcon: { width: 28, height: 28 },
  navText: { fontSize: 14, color: '#606060', fontFamily: 'Poppins', lineHeight: 21 },
  navTextActive: { fontSize: 14, color: '#1c1c1c', fontWeight: '500', fontFamily: 'Poppins', lineHeight: 21 },

  // Details UI
  detailsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 40, height: 90 },
  backBtn: { padding: 5 },
  detailsHeaderTitle: { fontSize: 18, fontWeight: '700', marginLeft: 15 },
  compRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoSquare: { width: 44, height: 44, backgroundColor: '#000', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  compMain: { fontSize: 18, fontWeight: '700' },
  compSub: { fontSize: 13, color: '#666', marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  earnAmount: { fontSize: 20, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  timelineBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 15 },
  timelineLine: { position: 'absolute', left: 21, top: 40, bottom: 80, width: 1, borderLeftWidth: 1, borderColor: '#0055FF', borderStyle: 'dashed' },
  stop: { flexDirection: 'row', gap: 12 },
  dotBlue: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0055FF', marginTop: 4, borderWidth: 2, borderColor: '#FFF' },
  arrowDownCircle: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#E8EFFF', alignItems:'center', justifyContent:'center', marginTop: 4 },
  stopInfo: { flex: 1 },
  stopLabel: { fontSize: 12, fontWeight: '700' },
  stopAddr: { fontSize: 14, fontWeight: '500', color: '#333', marginTop: 2 },
  stopSub: { fontSize: 11, color: '#888' },
  totalKms: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 15 },
  summaryBlueHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F0F7FF', margin: -12, borderTopLeftRadius: 12, borderTopRightRadius: 12, marginBottom: 15 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pLabel: { fontSize: 14, color: '#666' },
  pValue: { fontSize: 14, fontWeight: '600' },
  pTotalLabel: { fontSize: 15, fontWeight: '800' },
  pTotalValue: { fontSize: 15, fontWeight: '800' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  accTitle: { fontSize: 14, color: '#888', fontWeight: '600' },
  accRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  accLabel: { fontSize: 14, color: '#888' },
  accVal: { fontSize: 14, fontWeight: '500' },
  reportBtn: { borderWidth: 1, borderColor: '#0055FF', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 10 },
  reportBtnText: { color: '#EE4444', fontWeight: '800' }
});

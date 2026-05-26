import React, { useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  RefreshControl, ActivityIndicator, Pressable, Dimensions
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { getDriverAssignedDeliveries, type Delivery } from '@/lib/deliveryService';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

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

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadDeliveries(true)} />}>
        {/* WEEKLY BREAKDOWN */}
        <View style={s.weeklySection}>
          <Text style={s.weeklyTitle}>Weekly breakdown</Text>
          <View style={s.earningsNav}>
            <Ionicons name="chevron-back" size={20} color="#555" />
            <View style={{ alignItems: 'center' }}>
              <Text style={s.dateRange}>Sep 30 - Oct 6</Text>
              <Text style={s.totalAmount}>₹{stats.totalEarned.toLocaleString('en-IN')}</Text>
              <Text style={s.totalLabel}>Total earned</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </View>

          <View style={s.chartContainer}>
             <View style={s.chartGridLine} />
             <Text style={s.chartLimitText}>₹4,000</Text>
             <View style={s.barsRow}>
                {stats.chart.map((item, i) => {
                  const max = Math.max(...stats.chart.map(o => o.val)) || 1;
                  const h = (item.val / max) * 100;
                  return (
                    <View key={i} style={s.barWrapper}>
                      <View style={[s.bar, { height: Math.max(h, 5), backgroundColor: item.val === max && max > 0 ? '#0055FF' : '#8EBAFF' }]} />
                      <Text style={s.barDayNum}>{item.day}</Text>
                      <Text style={s.barDayLabel}>{item.label}</Text>
                    </View>
                  );
                })}
             </View>
          </View>
        </View>

        {/* STATS */}
        <View style={s.statsContainer}>
          <Text style={s.sectionHeader}>Stats</Text>
          <View style={s.statsRow}>
            <View style={s.statBox}><Text style={s.statLabel}>Total Trip completed</Text><Text style={s.statValue}>{stats.history.length}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Active Hours</Text><Text style={s.statValue}>70 h 57 m</Text></View>
          </View>
        </View>

        {/* LIST TABS */}
        <View style={s.listHeaderRow}>
          <Text style={s.sectionHeader}>My Deliveries</Text>
          <View style={s.tabContainer}>
            <Pressable onPress={() => setActiveTab('paid')} style={[s.tabButton, activeTab === 'paid' && s.tabButtonActive]}><Text style={[s.tabTextMain, activeTab === 'paid' && s.tabTextActive]}>Paid</Text></Pressable>
            <Pressable onPress={() => setActiveTab('pending')} style={[s.tabButton, activeTab === 'pending' && s.tabButtonActive]}><Text style={[s.tabTextMain, activeTab === 'pending' && s.tabTextActive]}>Pending</Text></Pressable>
          </View>
        </View>

        {/* DYNAMIC LIST */}
        <View style={{ paddingBottom: 100 }}>
          {isLoading ? <ActivityIndicator style={{marginTop: 50}} color="#0055FF" /> :
           (activeTab === 'paid' ? stats.history : stats.pending).map((delivery) => {
            // Active deliveries (assigned/in_transit) navigate to the live tracking flow
            const isActive = delivery.status === 'assigned' || delivery.status === 'in_transit';
            return (
            <Pressable key={delivery.id} style={s.deliveryItem} onPress={() => {
              if (isActive) {
                // Navigate to live DeliverStepsConfirmation flow with deliveryId
                const route = `/(tabs)/DeliverStepsConfirmation?deliveryId=${encodeURIComponent(delivery.id)}`;
                router.push(route as any);
              } else {
                setSelectedId(delivery.id);
                setView('details');
              }
            }}>
              <View style={s.itemLeft}>
                <View style={s.logoContainer}><MaterialCommunityIcons name="alpha-a-box" size={24} color="white" /></View>
                <View style={{flex: 1}}>
                  <Text style={s.companyName} numberOfLines={1}>{delivery.locations?.pickup?.address.split(',')[0]}</Text>
                  <Text style={s.itemSubText}>₹{delivery.pricing?.total?.toLocaleString()} earned • {formatDate(delivery.timestamps?.createdAt)}</Text>
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
                <Ionicons name="chevron-forward" size={18} color="#CCC" />
              </View>
            </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={s.bottomNav}>
         <Pressable style={s.navItem} onPress={() => router.push('/(tabs)')}><Ionicons name="home-outline" size={22} color="#888" /><Text style={s.navText}>Home</Text></Pressable>
         <Pressable style={s.navItem} onPress={() => {}}><Ionicons name="chatbubble" size={22} color="#0055FF" /><Text style={[s.navText, {color: '#0055FF'}]}>My delivery's</Text></Pressable>
         <Pressable style={s.navItem} onPress={() => router.push('/profile')}><Ionicons name="person-outline" size={22} color="#888" /><Text style={s.navText}>Profile</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  // Dashboard
  weeklySection: { backgroundColor: '#E8EFFF', padding: 20 },
  weeklyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  earningsNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 },
  totalAmount: { fontSize: 32, fontWeight: '800', color: '#111' },
  dateRange: { fontSize: 12, color: '#666' },
  totalLabel: { fontSize: 11, color: '#666' },
  chartContainer: { height: 120, marginTop: 20, justifyContent: 'flex-end' },
  chartGridLine: { position: 'absolute', top: 20, left: 0, right: 0, borderTopWidth: 1, borderColor: '#CCC', borderStyle: 'dashed' },
  chartLimitText: { position: 'absolute', top: 0, width: '100%', textAlign: 'center', fontSize: 12, color: '#444', fontWeight: '600' },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barWrapper: { alignItems: 'center', width: (width - 60) / 7 },
  bar: { width: 30, borderRadius: 4, marginBottom: 5 },
  barDayNum: { fontSize: 10, fontWeight: '700' },
  barDayLabel: { fontSize: 10, color: '#888' },
  statsContainer: { padding: 20 },
  sectionHeader: { fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', marginTop: 15, gap: 20 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 22, fontWeight: '700', marginTop: 5 },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F2', paddingBottom: 10 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 20, padding: 3 },
  tabButton: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 18 },
  tabButtonActive: { backgroundColor: '#FFF', elevation: 2 },
  tabTextMain: { fontSize: 12, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#111' },
  deliveryItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center' },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logoContainer: { width: 36, height: 36, backgroundColor: '#000', borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  companyName: { fontSize: 14, fontWeight: '600' },
  itemSubText: { fontSize: 12, color: '#888', marginTop: 2 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  badgePaid: { backgroundColor: '#E6F7F0' },
  badgePending: { backgroundColor: '#FFF9E6' },
  textPaid: { color: '#10B981' },
  textPending: { color: '#FBBF24' },
  bottomNav: { flexDirection: 'row', height: 70, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF', position: 'absolute', bottom: 0, width: '100%' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 10, marginTop: 4, fontWeight: '600' },

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
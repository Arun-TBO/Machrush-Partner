import { assignDriverToDelivery, getDriverAssignedDeliveries } from '@/lib/deliveryService';
import { auth } from '@/lib/firebase';
import { getDriverProfile } from '@/lib/firestoreOnboardingService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function DeliveryDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Route params may be missing depending on how navigation was triggered.
  // Coerce to safe display defaults to avoid broken UI.
  const safe = {
    deliveryId: (params.deliveryId as string) || '',
    earnings: (params.earnings as string) ?? '₹0',

    pickupDist: (params.pickupDist as string) ?? '—',
    pickupName: (params.pickupName as string) ?? 'Pickup',
    pickupAddr: (params.pickupAddr as string) ?? '—',

    dropDist: (params.dropDist as string) ?? '—',
    dropTime: (params.dropTime as string) ?? '—',
    dropName: (params.dropName as string) ?? 'Dropoff',
    dropAddr: (params.dropAddr as string) ?? '—',

    baseFare: (params.baseFare as string) ?? '₹0',
    distanceFare: (params.distanceFare as string) ?? '₹0',
    fuelCost: (params.fuelCost as string) ?? '₹0',
    total: (params.total as string) ?? '₹0',
  };


  // Function to handle the actual database assignment
  const onFinalAccept = async () => {
    setIsSubmitting(true);
    try {
      const deliveryId = params.deliveryId as string;
      const uid = auth.currentUser?.uid || await AsyncStorage.getItem('firebaseUid');
      const idToken = auth.currentUser
        ? await auth.currentUser.getIdToken().catch(() => null)
        : await AsyncStorage.getItem('firebaseIdToken');

      if (!uid || !deliveryId) {
        Alert.alert('Error', 'Session expired. Please log in again.');
        return;
      }

      const assignedDeliveries = await getDriverAssignedDeliveries(uid, idToken);
      const activeDelivery = assignedDeliveries.find(
        (item) => item.status === 'assigned' || item.status === 'in_transit'
      );

      if (activeDelivery && activeDelivery.id !== deliveryId) {
        Alert.alert('Active delivery already running', 'Please finish your current delivery before accepting another trip.', [
          {
            text: 'Open active trip',
            onPress: () => router.replace(`/(tabs)/DeliverStepsConfirmation?deliveryId=${encodeURIComponent(activeDelivery.id)}`),
          },
        ]);
        return;
      }

      if (activeDelivery?.id === deliveryId) {
        router.replace(`/(tabs)/DeliverStepsConfirmation?deliveryId=${encodeURIComponent(deliveryId)}`);
        return;
      }

      // 1. Fetch driver profile info
      const driverProfile = await getDriverProfile(uid, idToken).catch(() => null);

      // 2. Perform the assignment in Firestore
      await assignDriverToDelivery(deliveryId, uid, {
        fullName: driverProfile?.fullName || 'Driver',

        phoneNumber: driverProfile?.phoneNumber || '',
        photoUri: driverProfile?.profilePhotoUrl || driverProfile?.photoUri || '',
        vehicleNumber: driverProfile?.vehicleNumber || '',
      });

      Alert.alert('Success', 'Delivery accepted successfully!', [
        { text: 'OK', onPress: () => {
          // Use replace with string URL format for cross-navigator navigation
          // from root stack (delivery-details) to tabs (DeliverStepsConfirmation)
          // This ensures delivery-details is removed from the stack
          router.replace(`/(tabs)/DeliverStepsConfirmation?deliveryId=${encodeURIComponent(deliveryId)}`);
        }}
      ]);
    } catch (error) {
      console.error('Error accepting delivery:', error);
      Alert.alert('Error', 'Failed to accept delivery. It might have been taken by another driver.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* UI Header (keep navigation header hidden via Stack options={{ headerShown: false }}) */}
      <View style={[styles.header, { backgroundColor: '#FFF' }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Delivery details</Text>
          <Text style={styles.headerSubtitle}>
            {safe.pickupName} • ₹{safe.total} total
          </Text>
        </View>
      </View>

      {/* Delivery details under header */}
      <View style={styles.detailsSummaryRow}>
        <View style={styles.summaryDotWrap}>
          <Ionicons name="home" size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryMain}>
            To Pickup {safe.pickupDist}
          </Text>
          <Text style={styles.summarySub} numberOfLines={1}>
            {safe.pickupAddr}
          </Text>
        </View>
      </View>

      <View style={styles.detailsSummaryRow}>
        <View style={[styles.summaryDotWrap, { backgroundColor: '#0052cc' }]}>
          <Ionicons name="pin" size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryMain}>
            Drop {safe.dropDist} • {safe.dropTime}
          </Text>
          <Text style={styles.summarySub} numberOfLines={1}>
            {safe.dropAddr}
          </Text>
        </View>
      </View>


      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Earnings Section */}
        <View style={styles.earningsSection}>
          <Text style={styles.estimatedLabel}>Estimated earnings</Text>
          <Text style={styles.earningsValue}>{safe.earnings}</Text>
        </View>


        {/* Route Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <Ionicons name="navigate" size={18} color="#1c1c1c" />
             <Text style={styles.cardTitle}>Route</Text>
          </View>
          
          <View style={styles.routeContainer}>
            <View style={styles.lineTrack}>
                <View style={styles.dotBlue} />
                <View style={styles.dashedLine} />
                <View style={styles.arrowContainer}>
                     <View style={styles.dotLightBlue} />
                     <Ionicons name="caret-down" size={12} color="#0052cc" style={{marginTop: -4}} />
                </View>
            </View>

            <View style={styles.routeDetails}>
              <View style={styles.routePoint}>
                <Text style={styles.pointHeader}>To Pickup {safe.pickupDist}</Text>
                <Text style={styles.pointName}>{safe.pickupName}</Text>
                <Text style={styles.pointAddr}>{safe.pickupAddr}</Text>

              </View>

              <View style={styles.horizontalDashedLine} />

              <View style={styles.routePoint}>
                <View style={styles.dropHeaderRow}>
                    <Text style={styles.pointHeader}>Drop {safe.dropDist}</Text>
                    <Text style={styles.timeHighlight}>{safe.dropTime}</Text>

                </View>
                <Text style={styles.pointName}>{safe.dropName}</Text>
                <Text style={styles.pointAddr}>{safe.dropAddr}</Text>

              </View>
            </View>
          </View>
        </View>

        {/* Fare Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={styles.breakdownTitle}>Fare Breakdown</Text>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Base fare 50km</Text>
            <Text style={styles.breakdownValue}>{safe.baseFare}</Text>
          </View>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Distance fare</Text>
            <Text style={styles.breakdownValue}>{safe.distanceFare}</Text>

          </View>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Fuel Cost</Text>
            <Text style={styles.breakdownValue}>{safe.fuelCost}</Text>

          </View>

          <View style={styles.totalDashedLine} />

          <View style={styles.breakdownRow}>
            <Text style={styles.totalLabel}>Total earning</Text>
            <Text style={styles.totalValue}>{safe.total}</Text>

          </View>
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <Pressable 
          style={styles.rejectBtn} 
          onPress={() => router.back()}
          disabled={isSubmitting}
        >
          <Text style={styles.rejectBtnText}>Reject</Text>
        </Pressable>
        <Pressable 
          style={styles.acceptBtn} 
          onPress={onFinalAccept}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptBtnText}>Accept</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginTop: 40 },
  backButton: { padding: 4 },
  headerTextWrap: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1c1c1c', fontFamily: 'Poppins' },
  headerSubtitle: { marginTop: 4, fontSize: 12, color: '#606060', fontFamily: 'Poppins' },

  detailsSummaryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  summaryDotWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1c1c1c', alignItems: 'center', justifyContent: 'center' },
  summaryMain: { fontSize: 14, fontWeight: '600', color: '#1c1c1c', fontFamily: 'Poppins' },
  summarySub: { fontSize: 12, fontWeight: '400', color: '#606060', fontFamily: 'Poppins' },

  scrollContent: { padding: 20 },

  earningsSection: { marginBottom: 24 },
  estimatedLabel: { fontSize: 14, color: '#606060', marginBottom: 4, fontFamily: 'Poppins' },
  earningsValue: { fontSize: 42, fontWeight: '600', color: '#1c1c1c', fontFamily: 'Poppins' },
  card: { backgroundColor: '#f8fafd', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#eceef2' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1c1c1c', fontFamily: 'Poppins' },
  routeContainer: { flexDirection: 'row' },
  lineTrack: { alignItems: 'center', width: 30, paddingTop: 8 },
  dotBlue: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0052cc', borderWidth: 2, borderColor: '#a4cbff' },
  dashedLine: { width: 1, height: 60, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#0052cc' },
  arrowContainer: { alignItems: 'center' },
  dotLightBlue: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#a4cbff', borderWidth: 2, borderColor: '#0052cc' },
  routeDetails: { flex: 1, marginLeft: 10 },
  routePoint: { paddingVertical: 4 },
  pointHeader: { fontSize: 16, fontWeight: '600', color: '#1c1c1c', fontFamily: 'Poppins' },
  pointName: { fontSize: 16, color: '#606060', marginTop: 2, fontFamily: 'Poppins' },
  pointAddr: { fontSize: 12, color: '#8e8e8e', fontFamily: 'Poppins' },
  horizontalDashedLine: { height: 1, width: '100%', borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#d6d6d6', marginVertical: 12 },
  dropHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeHighlight: { color: '#0052cc', fontSize: 12, fontWeight: '500' },
  breakdownSection: { marginTop: 32 },
  breakdownTitle: { fontSize: 18, fontWeight: '600', color: '#1c1c1c', marginBottom: 16, fontFamily: 'Poppins' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  breakdownLabel: { fontSize: 16, color: '#606060', fontFamily: 'Poppins' },
  breakdownValue: { fontSize: 16, fontWeight: '600', color: '#1c1c1c', fontFamily: 'Poppins' },
  totalDashedLine: { height: 1, width: '100%', borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#d6d6d6', marginVertical: 12 },
  totalLabel: { fontSize: 16, color: '#8e8e8e', fontFamily: 'Poppins' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#1c1c1c', fontFamily: 'Poppins' },
  footer: { flexDirection: 'row', padding: 20, gap: 12 },
  rejectBtn: { flex: 1, height: 54, borderRadius: 12, borderWidth: 1, borderColor: '#0052cc', alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { color: '#606060', fontSize: 18, fontWeight: '500', fontFamily: 'Poppins' },
  acceptBtn: { flex: 2, height: 54, borderRadius: 12, backgroundColor: '#1fc16b', alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#ffffff', fontSize: 18, fontWeight: '500', fontFamily: 'Poppins' },
});

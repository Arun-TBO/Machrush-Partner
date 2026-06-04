import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';

import { getVerificationStatus } from '@/lib/firestoreOnboardingService';

export function useSuspendedAccountGuard() {
  const [isSuspended, setIsSuspended] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const checkStatus = async () => {
        const [storedUid, storedIdToken] = await Promise.all([
          AsyncStorage.getItem('firebaseUid'),
          AsyncStorage.getItem('firebaseIdToken'),
        ]);

        if (!storedUid) {
          if (isActive) {
            setIsSuspended(false);
          }
          return;
        }

        const verificationStatus = await getVerificationStatus(storedUid, storedIdToken || undefined);

        if (isActive) {
          setIsSuspended(verificationStatus?.status === 'suspended');
        }
      };

      checkStatus();

      return () => {
        isActive = false;
      };
    }, [])
  );

  return isSuspended;
}

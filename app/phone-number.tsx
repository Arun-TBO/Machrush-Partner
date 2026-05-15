import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { MobileNumberVerification } from '@/components/MobileNumberVerification';

export default function PhoneNumberScreen() {
  const router = useRouter();

  const handleVerify = async () => {
    await AsyncStorage.setItem('walkthroughCompleted', 'true');
    router.replace('/(tabs)');
  };

  return <MobileNumberVerification onVerify={handleVerify} />;
}

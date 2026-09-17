import { useRouter } from 'expo-router';

import { MobileNumberVerification } from '@/components/MobileNumberVerification';

export default function PhoneNumberScreen() {
  const router = useRouter();

  const handleVerify = () => {
    // MobileNumberVerification only completes after backend approval.
    router.replace('/(tabs)');
  };

  return <MobileNumberVerification onVerify={handleVerify} />;
}

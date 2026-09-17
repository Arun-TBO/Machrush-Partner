import { resolveDriverVerificationStatus } from './firestoreOnboardingService';
import type { OnboardingData } from './firestoreOnboardingService';

export type DriverEntryScreen = 'details' | 'review' | 'home' | 'suspended';
export type OnboardingSession = {
  uid: string;
  idToken: string;
  phoneNumber: string;
  screen: DriverEntryScreen;
};

// A walkthrough flag or Firebase sign-in is not proof of a submitted profile.
export function getDriverEntryScreen(profile: OnboardingData | null): DriverEntryScreen {
  const status = resolveDriverVerificationStatus(profile);
  if (status === 'suspended') return 'suspended';
  if (status === 'verified') return 'home';
  const hasSubmittedProfile = Boolean(profile?.submittedAt || (
    profile?.fullName && profile.vehicleNumber && profile.bankName &&
    profile.accountNumber && profile.ifscCode && profile.drivingLicenseUri &&
    profile.identityProofUri && profile.rcBookUri && profile.insuranceUri
  ));
  if (hasSubmittedProfile && (status === 'pending' || status === 'rejected')) return 'review';
  return 'details';
}

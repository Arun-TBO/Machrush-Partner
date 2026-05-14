# Firebase Phone Authentication OTP Implementation Guide

## Overview
This document explains the complete Firebase phone authentication flow for the Macrush mobile app.

## Flow Architecture

### 1. **Walkthrough Screen** (Initial Entry Point)
   - User sees 3 onboarding screens with app features
   - On the last screen, user taps "Get Started" button
   - This triggers the Mobile Number Verification screen

### 2. **Mobile Number Verification** 
   - User enters their 10-digit mobile number
   - Valid format: `[0-9]{10}` (Indian numbers)
   - Clicking "Verify & Continue" button:
     - Validates the phone number
     - Calls Firebase's `sendOTP()` function
     - Sends OTP to `+91{mobileNumber}` format
     - Shows OTP Verification screen on success

### 3. **OTP Verification**
   - User receives 6-digit OTP via SMS
   - Enters OTP in 6 input fields
   - Each field accepts only 1 digit
   - Auto-focuses to next field after digit entry
   - Clicking "Verify & Continue" button:
     - Calls Firebase's `verifyOTP()` function
     - Validates the 6-digit code against Firebase
     - On success: Shows Driver Details screen (Onboarding)
     - On failure: Shows error alert, user can retry
   - Resend option with 30-second cooldown timer

### 4. **Driver Details Screen** (Onboarding)
   - User enters additional profile information
   - After submission, walkthrough completes
   - Main app navigation begins

## Component Files

### Created Files
1. **`lib/firebaseAuthService.ts`** - Firebase phone auth service
2. This file contains all OTP logic

### Updated Files
1. **`components/MobileNumberVerification.tsx`** - Now calls `sendOTP()`
2. **`components/OTPVerification.tsx`** - Now calls `verifyOTP()` and `resendOTP()`
3. **`components/WalkthroughScreen.tsx`** - Already configured with proper flow

## Service Functions

### `firebaseAuthService.ts` Exports

#### 1. `sendOTP(phoneNumber: string)`
```typescript
// Sends 6-digit OTP to the phone number
await sendOTP('+919876543210');
```
- **Input:** Phone number in format `+91XXXXXXXXXX`
- **Output:** Promise that resolves when OTP is sent
- **Errors:**
  - `Invalid phone number format` - Wrong format
  - `Phone authentication is not enabled` - Firebase setup issue
  - `Too many requests` - Rate limited
  - Generic Firebase error messages

#### 2. `verifyOTP(otp: string)`
```typescript
// Verifies the 6-digit OTP entered by user
const result = await verifyOTP('123456');
// Returns: { uid, phoneNumber, idToken, user }
```
- **Input:** 6-digit OTP code
- **Output:** User credential object with:
  - `uid` - Firebase user ID
  - `phoneNumber` - Verified phone number
  - `idToken` - JWT token for API calls
  - `user` - Firebase user object
- **Errors:**
  - `Invalid OTP` - Wrong code
  - `OTP has expired` - Too long waiting
  - Generic Firebase error messages

#### 3. `resendOTP()`
```typescript
// Resends OTP to the same number
await resendOTP();
```
- Automatically manages resend within same session
- 30-second cooldown between resends

#### 4. `clearAuthState()`
- Clears the Firebase session (for logout)

#### 5. `signOutUser()`
- Signs out the user from Firebase

## Environment Setup

### Required Environment Variables (in `.env.local`)
```
EXPO_PUBLIC_FIREBASE_PROJECT_ID=machrush01-d7e32
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=machrush01-d7e32.firebasestorage.app
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyBk03FYCkbx0tTd5v4rBzcSMHbBsTKUHag
EXPO_PUBLIC_FIREBASE_APP_ID=1:477270481801:android:2f842534a52a9627591f58
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=477270481801
```

## Firebase Console Setup

### Prerequisites (Already Configured)
1. Project ID: `machrush01-d7e32`
2. Phone authentication enabled in Firebase Console
3. Test phone numbers configured (for testing without real SMS)

### Test Phone Numbers
If testing in development:
1. Go to Firebase Console → Authentication → Sign-in method → Phone
2. Add test phone numbers: +919876543210, +919999999999, etc.
3. Firebase will auto-generate OTPs for testing

### Production Notes
- In production, real SMS are sent via Firebase
- Free tier: 100 verification requests per month
- Paid plans available for higher volumes

## Implementation Checklist

✅ Firebase configuration in place
✅ `firebaseAuthService.ts` created with all OTP functions
✅ `MobileNumberVerification.tsx` updated to send OTP
✅ `OTPVerification.tsx` updated to verify OTP (6-digit)
✅ Error handling with user alerts
✅ Resend functionality with 30-second timer
✅ Navigation flow properly connected
✅ Phone number validation (10-digit Indian format)

## Testing the Flow

### Step 1: Launch App
```bash
cd Frontend/macrush-mobile
npm start
```

### Step 2: Accept Walkthrough
- See 3 onboarding screens
- Tap "Get Started" on last screen

### Step 3: Enter Mobile Number
- Enter valid 10-digit number (e.g., 9876543210)
- Tap "Verify & Continue"
- Should see "Sending OTP..." loading state

### Step 4: Enter OTP
- Test OTP (from Firebase console): Usually shown in console logs
- Or use pre-configured test numbers if using emulator
- Enter 6-digit OTP
- Tap "Verify & Continue"

### Step 5: Complete Onboarding
- Fill driver details
- Submit to complete walkthrough
- Main app navigation begins

## Error Scenarios & Handling

### Scenario 1: Invalid Phone Number
```
User enters: "12345"
Alert: "Please enter a valid 10-digit mobile number"
```

### Scenario 2: OTP Not Sent (Network/Firebase Error)
```
Alert: "Failed to send verification code. Please try again."
Reason: Network issue, Firebase not configured, or service disabled
```

### Scenario 3: Wrong OTP Entered
```
User enters: "000000"
Alert: "Invalid OTP. Please check and try again."
```

### Scenario 4: OTP Expired
```
Alert: "OTP has expired. Please request a new one."
Tap "Resend OTP" to get a new code
```

### Scenario 5: Too Many Attempts
```
Alert: "Too many requests. Please try again later."
Wait ~15 minutes before retrying
```

## Console Logs

The implementation logs important events for debugging:

```
📱 Sending OTP to: +919876543210
✅ OTP sent successfully
🔐 Verifying OTP...
✅ OTP verified successfully
User UID: user_123456
Phone Number: +919876543210
```

## Security Considerations

1. **ID Token Storage** (if needed for API calls)
   - The `idToken` returned from `verifyOTP()` can be stored for authenticated requests
   - Store in AsyncStorage with encryption
   - Pass as `Bearer {idToken}` in Authorization header

2. **Phone Number Validation**
   - Only accepts Indian format (+91)
   - 10-digit requirement prevents typos

3. **OTP Security**
   - 6-digit OTP (1 million combinations)
   - Time-limited validity (typically 10 minutes)
   - Rate limiting on resend attempts

4. **Session Management**
   - Clear auth state on logout
   - Firebase automatically handles session expiry
   - No sensitive data stored locally

## Troubleshooting

### Issue: "Firebase configuration is incomplete"
**Solution:** Check `.env.local` has all required Firebase variables

### Issue: "Phone authentication is not enabled"
**Solution:** 
1. Go to Firebase Console
2. Authentication → Sign-in method → Phone
3. Enable it

### Issue: SMS not received
**Solution:**
1. Check phone number format (+91XXXXXXXXXX)
2. Verify it's a test number if in development
3. Check if Firebase quota exceeded
4. Try with different phone number

### Issue: OTP verification fails but SMS was received
**Solution:**
1. Ensure OTP is entered correctly (check for spaces)
2. OTP might have expired (resend a new one)
3. Check Firebase console logs for errors

## Next Steps

1. ✅ OTP flow is fully implemented
2. After OTP verification, user proceeds to Driver Details screen
3. After driver details, user completes onboarding
4. Main app navigation begins

## API Integration (Future)

After OTP verification, you'll have:
- `uid` - Firebase user ID
- `idToken` - JWT token for backend API calls
- `phoneNumber` - Verified phone number

These can be used to authenticate API requests to your backend:

```typescript
const response = await fetch('http://localhost:5000/api/driver/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    uid,
    phoneNumber,
    // ... other driver details
  }),
});
```

## Files Structure

```
Frontend/macrush-mobile/
├── lib/
│   ├── firebase.ts (Firebase initialization)
│   └── firebaseAuthService.ts (✨ NEW - OTP logic)
├── components/
│   ├── WalkthroughScreen.tsx (Updated flow)
│   ├── MobileNumberVerification.tsx (Updated - sends OTP)
│   ├── OTPVerification.tsx (Updated - verifies OTP, 6-digit)
│   └── DriverDetailsScreen.tsx (Onboarding form)
```

---

**Implementation Date:** May 14, 2026
**Status:** ✅ COMPLETE & READY FOR TESTING

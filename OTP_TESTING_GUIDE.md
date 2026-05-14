# Firebase OTP Testing Guide

## Quick Start - Test the Complete OTP Flow

### Prerequisites
✅ Firebase project configured
✅ Phone authentication enabled in Firebase Console
✅ All environment variables in `.env.local` set correctly

## Testing Steps

### 1. Start the App
```bash
cd Frontend/macrush-mobile
npm start
```

### 2. Follow the Complete Flow

#### Step 1: See Walkthrough Screens
- App launches showing 3 onboarding screens
- Swipe or tap "Continue" to navigate
- Read about the app features

#### Step 2: Tap "Get Started" Button
- On screen 3 (last screen), tap "Get Started"
- Mobile Number Verification screen appears

#### Step 3: Enter Mobile Number
```
Example: 9876543210 (10 digits)
```
- Text input field for phone number
- Country code shows "+91" automatically
- Tap "Verify & Continue" button

#### Step 4: Wait for OTP
- Button shows "Verifying..." state
- Firebase sends 6-digit OTP via SMS
- OR if using test number: OTP appears in Firebase Console

#### Step 5: Enter OTP Code
- 6 input fields appear
- Enter each digit (auto-focuses to next field)
- Example test OTP: 123456 (for configured test numbers)

#### Step 6: Tap "Verify & Continue"
- App verifies OTP with Firebase
- On success: Driver Details screen shows
- On error: Alert with error message, can retry

#### Step 7: Fill Driver Details & Submit
- Complete the onboarding form
- Submit to finish walkthrough
- Main app navigation begins ✅

## Testing Different Scenarios

### Scenario A: Successful OTP Flow
1. Enter valid mobile: `9876543210`
2. Tap "Verify & Continue"
3. Wait for SMS with OTP
4. Enter OTP code
5. Tap "Verify & Continue"
6. ✅ Success - Driver Details screen shown

### Scenario B: Wrong OTP
1. Enter valid mobile
2. Receive OTP
3. Enter wrong code: `000000`
4. Tap "Verify & Continue"
5. ❌ Alert: "Invalid OTP. Please check and try again."
6. OTP fields clear
7. Can retry with correct OTP

### Scenario C: Resend OTP
1. Enter valid mobile
2. Receive OTP
3. Look at Resend OTP button (bottom right, blue text)
4. First resend is disabled (shows timer: 30s)
5. After 30 seconds, "Resend OTP" becomes clickable
6. Tap "Resend OTP"
7. New OTP sent to same number
8. Enter new OTP and verify

### Scenario D: Change Mobile Number
1. On OTP Verification screen
2. Tap on the phone number (blue underlined text)
3. Returns to Mobile Number Verification
4. Can enter different number
5. Tap "Verify & Continue" to send OTP to new number

### Scenario E: Invalid Mobile Number
1. Enter less than 10 digits: `123456`
2. Tap "Verify & Continue"
3. ❌ Alert: "Please enter a valid 10-digit mobile number"

## Testing with Test Phone Numbers

### In Development - Configure Test Numbers

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com
   - Select project: `machrush01-d7e32`
   - Authentication → Sign-in method → Phone

2. **Add Test Phone Numbers**
   - Click "Phone numbers for testing"
   - Add phone number: `+919876543210`
   - Firebase generates test OTP (e.g., `123456`)

3. **Use in App**
   - Enter: `9876543210`
   - Tap "Verify & Continue"
   - Use test OTP: `123456`
   - ✅ Verification succeeds instantly

### Using Real Phone Numbers
- No test configuration needed
- Real SMS sent to the phone
- Wait for actual SMS to arrive
- Enter received OTP

## Debugging

### Check Console Logs
Open VS Code Debug Console to see logs:

```
📱 Sending OTP to: +919876543210
✅ OTP sent successfully, showing verification screen
🔐 Verifying OTP...
✅ OTP verified successfully
User UID: 7d8f9k2L3m4nOpQrStUvWxYz
Phone Number: +919876543210
```

### Common Issues

#### Issue: "Firebase configuration is incomplete"
```
Solution: Check Frontend/macrush-mobile/.env.local has all variables
```

#### Issue: App crashes on OTP screen
```
Check: Are there TypeScript errors?
Run: npm run build (to catch build errors)
```

#### Issue: OTP verification fails but SMS received
```
Possible causes:
1. Wrong OTP typed (check spaces/typos)
2. OTP expired (resend new one)
3. Firebase not configured for phone auth
```

#### Issue: SMS not received
```
Possible causes:
1. Phone number format wrong (must be 10 digits)
2. Firebase quota exceeded
3. Network issues
Solutions:
- Try with different phone number
- Check Firebase billing/quota
- Try test phone numbers if available
```

## Firebase Console Verification

### To See Sent OTPs (in development)
1. Firebase Console → Authentication
2. Phone numbers for testing section
3. OTP shown for each test number

### To Monitor Sign-ins
1. Firebase Console → Authentication
2. "Users" tab
3. Should see new user after verification

## Code Location

Test flow code is in:
```
Frontend/macrush-mobile/
├── lib/
│   └── firebaseAuthService.ts (OTP logic)
├── components/
│   ├── WalkthroughScreen.tsx (Entry point)
│   ├── MobileNumberVerification.tsx (Phone input)
│   ├── OTPVerification.tsx (OTP verification)
│   └── DriverDetailsScreen.tsx (Onboarding)
```

## Next: API Integration

After OTP verification, the app has:
- `uid` - Firebase user ID
- `phoneNumber` - Verified number
- `idToken` - JWT for backend API calls

These can be used for backend authentication:

```typescript
// Example in DriverDetailsScreen or next screen
const authData = {
  uid,
  phoneNumber,
  idToken
};

// Send to backend
const response = await fetch('http://localhost:5000/api/driver/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  },
  body: JSON.stringify(authData),
});
```

## Success Indicators ✅

- [x] OTP sent successfully to phone
- [x] 6-digit OTP received via SMS
- [x] OTP verification works
- [x] User proceeds to Driver Details
- [x] Walkthrough completes
- [x] App navigation begins
- [x] Error handling for invalid OTP
- [x] Resend functionality works
- [x] Phone number change functionality works

---

**Implementation Complete!** 🎉

Ready to test the Firebase OTP flow in your app.

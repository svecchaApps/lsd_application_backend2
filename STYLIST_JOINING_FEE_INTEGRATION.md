# Stylist Joining Fee — Mobile Integration Guide

This document covers the complete **Razorpay joining fee payment flow** for the Professional Stylist onboarding. The stylist pays a one-time joining fee at the end of onboarding before their account is activated.

---

## Table of Contents

1. [Flow Overview](#1-flow-overview)
2. [Base URL & Headers](#2-base-url--headers)
3. [Step 1 — Initiate Joining Fee](#3-step-1--initiate-joining-fee)
4. [Step 2 — Open Razorpay Payment Sheet](#4-step-2--open-razorpay-payment-sheet)
5. [Step 3 — Verify Payment](#5-step-3--verify-payment)
6. [Complete Flutter Implementation](#6-complete-flutter-implementation)
7. [Error Handling](#7-error-handling)
8. [Screen Flow Map](#8-screen-flow-map)
9. [Testing](#9-testing)

---

## 1. Flow Overview

```
Onboarding Step 5 — Review & Pay screen
          │
          ▼
POST /stylist/joining-fee/initiate
(sends all profile data + Firebase token)
          │
          ▼
Backend creates PENDING profile + Razorpay order
Returns: { profileId, orderId, razorpayKeyId, amount }
          │
          ▼
App opens Razorpay payment sheet
          │
    ┌─────┴──────┐
    │            │
  paid        cancelled / failed
    │            │
    ▼            ▼
POST /stylist    Show error
/joining-fee     Allow retry
/verify
    │
    ▼
Backend verifies signature → activates profile
Returns: { accessToken, refreshToken, user }
    │
    ▼
Store tokens → Navigate to Stylist Dashboard
```

---

## 2. Base URL & Headers

```
Base URL: https://lsd-application-backend2.vercel.app
```

| Endpoint | Auth header needed |
|----------|-------------------|
| `POST /stylist/joining-fee/initiate` | None (firebaseIdToken is in the body) |
| `POST /stylist/joining-fee/verify` | None (uses profileId + Razorpay fields) |

---

## 3. Step 1 — Initiate Joining Fee

Call this when the stylist taps **"Pay & Activate Account"** on the final onboarding screen.

```
POST /stylist/joining-fee/initiate
Content-Type: application/json
```

### Request Body

Send the full profile data collected across all onboarding steps:

```json
{
  "phoneNumber": "+919999999232",
  "firebaseIdToken": "eyJhbGci...",
  "fullName": "Rajat Saxena",
  "shortBio": "Fashion stylist with 6+ years helping clients build confident wardrobes.",
  "specialties": ["Bridal", "Corporate", "Casual"],
  "yearsOfExperience": "4-6 yrs",
  "portfolioLink": "https://instagram.com/rajatstylist",
  "baseSessionFee": "₹1000 / 60 min",
  "addOnServices": ["Wardrobe Audit", "Event Styling"],
  "paymentModes": ["UPI", "Credit Card"],
  "dayAvailability": {
    "Monday": true,
    "Tuesday": true,
    "Wednesday": false,
    "Thursday": true,
    "Friday": true,
    "Saturday": true,
    "Sunday": false
  },
  "startTime": "10:00 AM",
  "endTime": "7:00 PM",
  "profilePictureUrl": "https://firebasestorage.googleapis.com/..."
}
```

**Required:** `phoneNumber`, `firebaseIdToken`, `fullName`
**Optional:** everything else (collected during onboarding steps)

### Success Response `200`

```json
{
  "success": true,
  "message": "Joining fee order created. Complete payment to activate your account.",
  "data": {
    "profileId": "64abc123def456789...",
    "joiningFee": 499,
    "currency": "INR",
    "razorpayKeyId": "rzp_live_xxxxxxxxxx",
    "orderId": "order_PxxxxxxxxxxxxxxX",
    "amount": 49900,
    "amountInRupees": 499,
    "prefill": {
      "name": "Rajat Saxena",
      "contact": "+919999999232",
      "email": ""
    },
    "description": "Stylist Professional Account — Joining Fee"
  }
}
```

**Save these from the response:**
- `data.profileId` — needed for verification step
- `data.orderId` — pass to Razorpay SDK
- `data.razorpayKeyId` — Razorpay key to initialise SDK
- `data.amount` — amount in paise (integer)

### Error Responses

| Status | Cause |
|--------|-------|
| `400` | Missing required fields or phone mismatch |
| `401` | Invalid Firebase token |
| `409` | Already registered as professional stylist |
| `500` | Razorpay order creation failed |

---

## 4. Step 2 — Open Razorpay Payment Sheet

Use the `razorpay_flutter` package to open the payment sheet with the order details returned in Step 1.

### pubspec.yaml dependency

```yaml
dependencies:
  razorpay_flutter: ^1.3.6
```

### Flutter code

```dart
import 'package:razorpay_flutter/razorpay_flutter.dart';

class JoiningFeePayment {
  late Razorpay _razorpay;

  // Called once — typically in initState
  void initRazorpay({
    required Function(PaymentSuccessResponse) onSuccess,
    required Function(PaymentFailureResponse) onFailure,
    required Function(ExternalWalletResponse) onWallet,
  }) {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, onFailure);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, onWallet);
  }

  // Call after receiving initiate response
  void openPaymentSheet({
    required String razorpayKeyId,
    required String orderId,
    required int amountInPaise,
    required String name,
    required String contact,
    required String email,
    required String description,
  }) {
    final options = {
      'key': razorpayKeyId,
      'order_id': orderId,
      'amount': amountInPaise,
      'currency': 'INR',
      'name': 'LSD Stylist',
      'description': description,
      'prefill': {
        'name': name,
        'contact': contact,
        'email': email,
      },
      'theme': {'color': '#000000'},
      'retry': {'enabled': true, 'max_count': 3},
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('Razorpay open error: $e');
    }
  }

  void dispose() {
    _razorpay.clear();
  }
}
```

---

## 5. Step 3 — Verify Payment

Call this inside the `EVENT_PAYMENT_SUCCESS` callback with the response from Razorpay.

```
POST /stylist/joining-fee/verify
Content-Type: application/json
```

### Request Body

```json
{
  "profileId": "64abc123def456789...",
  "razorpay_order_id": "order_PxxxxxxxxxxxxxxX",
  "razorpay_payment_id": "pay_PxxxxxxxxxxxxxxX",
  "razorpay_signature": "abc123def456..."
}
```

| Field | Where to get it |
|-------|----------------|
| `profileId` | Saved from Step 1 response (`data.profileId`) |
| `razorpay_order_id` | `PaymentSuccessResponse.orderId` |
| `razorpay_payment_id` | `PaymentSuccessResponse.paymentId` |
| `razorpay_signature` | `PaymentSuccessResponse.signature` |

### Success Response `200`

```json
{
  "success": true,
  "message": "Payment verified. Your professional stylist account is now active!",
  "user": {
    "id": "64abc123def456789...",
    "phoneNumber": "+919999999232",
    "email": null,
    "name": "Rajat Saxena",
    "displayName": "Rajat Saxena",
    "role": "stylist"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": "100d",
  "payment": {
    "razorpayOrderId": "order_PxxxxxxxxxxxxxxX",
    "razorpayPaymentId": "pay_PxxxxxxxxxxxxxxX",
    "amount": 499,
    "currency": "INR",
    "paidAt": "2026-03-29T10:30:00.000Z"
  }
}
```

**After receiving this response:**
1. Save `accessToken`, `refreshToken`, `user.id` (as `stylistId`) to secure storage
2. Navigate to Stylist Dashboard

### Error Responses

| Status | Cause |
|--------|-------|
| `400` | Missing fields or **invalid Razorpay signature** (payment tampered) |
| `404` | Profile not found or order ID mismatch |
| `500` | Server error |

---

## 6. Complete Flutter Implementation

### Full screen widget

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String baseUrl = 'https://lsd-application-backend2.vercel.app';

class JoiningFeeScreen extends StatefulWidget {
  // All onboarding data collected in previous steps
  final Map<String, dynamic> onboardingData;
  final String firebaseIdToken;

  const JoiningFeeScreen({
    super.key,
    required this.onboardingData,
    required this.firebaseIdToken,
  });

  @override
  State<JoiningFeeScreen> createState() => _JoiningFeeScreenState();
}

class _JoiningFeeScreenState extends State<JoiningFeeScreen> {
  late Razorpay _razorpay;

  bool _isLoading = false;
  String? _profileId;
  int _joiningFee = 499;

  @override
  void initState() {
    super.initState();
    _initRazorpay();
  }

  void _initRazorpay() {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  // ── Step 1: Initiate joining fee ─────────────────────────────────────────

  Future<void> _initiatePayment() async {
    setState(() => _isLoading = true);

    try {
      final body = {
        ...widget.onboardingData,
        'firebaseIdToken': widget.firebaseIdToken,
      };

      final response = await http.post(
        Uri.parse('$baseUrl/stylist/joining-fee/initiate'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final paymentData = data['data'];

        // Save profileId for verification step
        _profileId = paymentData['profileId'];
        _joiningFee = paymentData['joiningFee'] ?? 499;

        // Open Razorpay payment sheet
        _openRazorpaySheet(paymentData);
      } else {
        // Handle specific errors
        if (response.statusCode == 409) {
          _showError('You are already registered as a professional stylist.');
        } else {
          _showError(data['message'] ?? 'Failed to initiate payment. Please try again.');
        }
      }
    } catch (e) {
      _showError('Network error. Please check your connection and try again.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ── Step 2: Open Razorpay sheet ──────────────────────────────────────────

  void _openRazorpaySheet(Map<String, dynamic> paymentData) {
    final options = {
      'key': paymentData['razorpayKeyId'],
      'order_id': paymentData['orderId'],
      'amount': paymentData['amount'],          // already in paise
      'currency': 'INR',
      'name': 'LSD Stylist',
      'description': paymentData['description'],
      'prefill': {
        'name': paymentData['prefill']['name'],
        'contact': paymentData['prefill']['contact'],
        'email': paymentData['prefill']['email'],
      },
      'theme': {'color': '#000000'},
      'retry': {'enabled': true, 'max_count': 3},
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      _showError('Could not open payment. Please try again.');
    }
  }

  // ── Step 3: Verify payment ───────────────────────────────────────────────

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    setState(() => _isLoading = true);

    try {
      final verifyResponse = await http.post(
        Uri.parse('$baseUrl/stylist/joining-fee/verify'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'profileId': _profileId,
          'razorpay_order_id': response.orderId,
          'razorpay_payment_id': response.paymentId,
          'razorpay_signature': response.signature,
        }),
      );

      final data = jsonDecode(verifyResponse.body);

      if (verifyResponse.statusCode == 200 && data['success'] == true) {
        // Save tokens and user info
        await _saveSession(data);

        // Navigate to Stylist Dashboard
        if (mounted) {
          Navigator.of(context).pushNamedAndRemoveUntil(
            '/stylist-dashboard',
            (route) => false,
          );
        }
      } else {
        _showError(data['message'] ?? 'Payment verification failed. Contact support.');
      }
    } catch (e) {
      // Payment was taken but verification failed — very important to handle
      _showError(
        'Payment was received but verification failed. '
        'Please contact support with payment ID: ${response.paymentId}',
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    final code = response.code;
    final message = response.message ?? 'Payment failed';

    if (code == Razorpay.PAYMENT_CANCELLED) {
      _showError('Payment cancelled. Tap "Pay Now" to try again.');
    } else {
      _showError('Payment failed: $message. Please try again.');
    }
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    // Handle external wallet (e.g. Paytm, PhonePe)
    debugPrint('External wallet selected: ${response.walletName}');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  Future<void> _saveSession(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', data['accessToken']);
    await prefs.setString('refreshToken', data['refreshToken']);
    await prefs.setString('stylistId', data['user']['id'].toString());
    await prefs.setString('displayName', data['user']['displayName'] ?? '');
    await prefs.setString('phoneNumber', data['user']['phoneNumber'] ?? '');
    await prefs.setString('role', data['user']['role']);
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Activate Account')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.workspace_premium, size: 80, color: Colors.black),
            const SizedBox(height: 24),
            const Text(
              'One-time Joining Fee',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text(
              '₹$_joiningFee',
              style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text(
              'Pay once to activate your Professional Stylist account.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _initiatePayment,
                style: ElevatedButton.styleFrom(backgroundColor: Colors.black),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'Pay & Activate Account',
                        style: TextStyle(fontSize: 16, color: Colors.white),
                      ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Secured by Razorpay',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 7. Error Handling

### Initiate endpoint errors

```dart
Future<void> _handleInitiateError(http.Response response) async {
  final data = jsonDecode(response.body);

  switch (response.statusCode) {
    case 400:
      // Missing fields — should not happen if onboarding is complete
      _showError('Incomplete profile data. Please go back and fill all fields.');
      break;
    case 401:
      // Firebase token expired — user needs to re-verify OTP
      _showError('Session expired. Please verify your phone number again.');
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (r) => false);
      break;
    case 409:
      // Already registered — just log them in
      _showError('Account already exists. Please log in.');
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (r) => false);
      break;
    default:
      _showError(data['message'] ?? 'Something went wrong. Please try again.');
  }
}
```

### Verify endpoint errors

```dart
// If verification fails after payment is taken:
// CRITICAL — do not lose the payment details
Future<void> _handleVerifyError(
  http.Response response,
  PaymentSuccessResponse rzpResponse,
) async {
  final data = jsonDecode(response.body);

  if (response.statusCode == 400) {
    // Invalid signature — possible tampering
    _showError('Security verification failed. Please contact support.');
  } else {
    // Store payment details locally so user can retry or contact support
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pendingVerification', jsonEncode({
      'profileId': _profileId,
      'razorpay_order_id': rzpResponse.orderId,
      'razorpay_payment_id': rzpResponse.paymentId,
      'razorpay_signature': rzpResponse.signature,
    }));

    _showError(
      'Payment received but activation failed. '
      'We will activate your account shortly. '
      'Payment ID: ${rzpResponse.paymentId}',
    );
  }
}
```

### Retry on app relaunch

If verification failed but payment was taken, retry on next app launch:

```dart
Future<void> retryPendingVerification() async {
  final prefs = await SharedPreferences.getInstance();
  final pending = prefs.getString('pendingVerification');

  if (pending == null) return;

  final body = jsonDecode(pending);

  final response = await http.post(
    Uri.parse('$baseUrl/stylist/joining-fee/verify'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode(body),
  );

  final data = jsonDecode(response.body);

  if (response.statusCode == 200 && data['success'] == true) {
    await prefs.remove('pendingVerification');
    await _saveSession(data);
    // Navigate to dashboard
  }
}
```

---

## 8. Screen Flow Map

```
Onboarding Step 1 — Professional Info
  fullName, shortBio, specialties, yearsOfExperience, portfolioLink
          │
          ▼
Onboarding Step 2 — Profile Picture
  profilePictureUrl (upload to Firebase Storage → get URL)
          │
          ▼
Onboarding Step 3 — Pricing
  baseSessionFee, addOnServices, paymentModes
          │
          ▼
Onboarding Step 4 — Availability
  dayAvailability, startTime, endTime
          │
          ▼
Onboarding Step 5 — Review & Pay   ← JoiningFeeScreen goes here
  Shows summary + ₹499 fee
  Tap "Pay & Activate Account"
          │
          ├── POST /stylist/joining-fee/initiate (all collected data)
          │
          ├── Razorpay sheet opens
          │
          ├── Payment success → POST /stylist/joining-fee/verify
          │
          └── Navigate to Stylist Dashboard
```

### Passing data between screens

Accumulate all onboarding data in a single map as the user progresses:

```dart
// In your state management (provider/bloc/riverpod)
Map<String, dynamic> onboardingData = {};

// Step 1
onboardingData.addAll({
  'phoneNumber': phoneNumber,
  'fullName': fullNameController.text,
  'shortBio': bioController.text,
  'specialties': selectedSpecialties,
  'yearsOfExperience': selectedExperience,
  'portfolioLink': portfolioController.text,
});

// Step 2
onboardingData['profilePictureUrl'] = uploadedImageUrl;

// Step 3
onboardingData.addAll({
  'baseSessionFee': selectedFee,
  'addOnServices': selectedAddOns,
  'paymentModes': selectedPaymentModes,
});

// Step 4
onboardingData.addAll({
  'dayAvailability': dayAvailabilityMap,
  'startTime': startTime,
  'endTime': endTime,
});

// Step 5 — pass onboardingData to JoiningFeeScreen
Navigator.push(context, MaterialPageRoute(
  builder: (_) => JoiningFeeScreen(
    onboardingData: onboardingData,
    firebaseIdToken: firebaseIdToken, // from OTP verification
  ),
));
```

---

## 9. Testing

### Test card details (Razorpay test mode)

| Field | Value |
|-------|-------|
| Card number | `4111 1111 1111 1111` |
| Expiry | Any future date |
| CVV | Any 3 digits |
| OTP | `1234` |

### UPI test (Razorpay test mode)
```
success@razorpay   → simulates success
failure@razorpay   → simulates failure
```

### Verify test mode is active

The `razorpayKeyId` returned by the backend will start with `rzp_test_` in test mode and `rzp_live_` in production. Make sure your Razorpay dashboard and `.env` keys match.

```env
# .env on backend
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxx
STYLIST_JOINING_FEE=499
```

### Quick API test (without Flutter)

```bash
# Step 1 — Initiate
curl -X POST https://lsd-application-backend2.vercel.app/stylist/joining-fee/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919999999232",
    "firebaseIdToken": "YOUR_FIREBASE_TOKEN",
    "fullName": "Test Stylist",
    "shortBio": "Test bio",
    "specialties": ["Casual"],
    "yearsOfExperience": "1-3 yrs",
    "baseSessionFee": "₹500 / 30 min"
  }'

# Step 2 — Verify (use real values from Razorpay response)
curl -X POST https://lsd-application-backend2.vercel.app/stylist/joining-fee/verify \
  -H "Content-Type: application/json" \
  -d '{
    "profileId": "PROFILE_ID_FROM_STEP1",
    "razorpay_order_id": "order_xxx",
    "razorpay_payment_id": "pay_xxx",
    "razorpay_signature": "SIGNATURE"
  }'
```

---

## Quick Reference

| Step | What to do | Endpoint |
|------|-----------|----------|
| 1 | Send full profile + Firebase token | `POST /stylist/joining-fee/initiate` |
| 2 | Open Razorpay using `orderId` + `razorpayKeyId` from response | Razorpay SDK (client only) |
| 3 | On payment success, send 4 fields to backend | `POST /stylist/joining-fee/verify` |
| 4 | Save `accessToken` + `stylistId` → go to dashboard | — |

**Joining fee:** `₹499` (set by backend, use `data.amountInRupees` from Step 1 response to display in UI — never hardcode it)

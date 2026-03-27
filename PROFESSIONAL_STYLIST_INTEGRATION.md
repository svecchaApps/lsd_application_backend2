# Professional Stylist — App Integration Guide

This document is the single source of truth for integrating the **Professional Stylist** portal into the mobile application. It covers the full login flow, onboarding, dashboard, video sessions, and every request/response shape.

---

## Table of Contents

1. [Base URL & Headers](#1-base-url--headers)
2. [Auth Flow Overview](#2-auth-flow-overview)
3. [Firebase OTP Setup (Client Side)](#3-firebase-otp-setup-client-side)
4. [Auth Endpoints](#4-auth-endpoints)
   - [4.1 Check Professional Stylist](#41-check-professional-stylist)
   - [4.2 Register Professional Stylist](#42-register-professional-stylist)
   - [4.3 Login (Shared)](#43-login-shared)
5. [Dashboard Endpoints](#5-dashboard-endpoints)
   - [5.1 Get Dashboard Stats](#51-get-dashboard-stats)
   - [5.2 Get Stylist Bookings](#52-get-stylist-bookings)
   - [5.3 Get Stylist Clients](#53-get-stylist-clients)
   - [5.4 Update Booking Status](#54-update-booking-status)
   - [5.5 Update Stylist Profile](#55-update-stylist-profile)
   - [5.6 Update Stylist Availability](#56-update-stylist-availability)
6. [Video Call — Agora Integration](#6-video-call--agora-integration)
   - [6.1 Start Video Call](#61-start-video-call)
   - [6.2 End Video Call](#62-end-video-call)
7. [JWT Token Handling](#7-jwt-token-handling)
8. [Session Storage Strategy](#8-session-storage-strategy)
9. [Full Login Flow Diagram](#9-full-login-flow-diagram)
10. [Onboarding Screen Map](#10-onboarding-screen-map)
11. [Error Handling](#11-error-handling)
12. [Enum Reference](#12-enum-reference)

---

## 1. Base URL & Headers

```
Base URL: https://lsd-application-backend2.vercel.app
```

### Standard Headers

```
Content-Type: application/json
Accept: application/json
```

### Authorization — Two token types

| When | Header |
|------|--------|
| Check + Register (before JWT exists) | `Authorization: Bearer <firebase_id_token>` |
| All dashboard calls (after login/register) | `Authorization: Bearer <jwt_access_token>` |

---

## 2. Auth Flow Overview

```
User taps "Stylist" tab on login screen
        │
        ▼
Enter phone number → Firebase sends OTP
        │
        ▼
User enters OTP → Firebase verifies → Firebase ID Token issued to app
        │
        ▼
App calls → GET /stylist/check-professional/:phoneNumber
            Header: Bearer <firebase_id_token>
        │
        ├── isProfessionalStylist: true
        │       │
        │       ▼
        │   App calls → POST /auth/login
        │               Body: { phoneNumber, firebaseIdToken }
        │       │
        │       ▼
        │   Receive JWT (role: "stylist", expires: 100d)
        │       │
        │       ▼
        │   Navigate → Stylist Dashboard
        │
        └── isProfessionalStylist: false
                │
                ▼
            5-Step Onboarding
                │
                ▼
            App calls → POST /stylist/register-professional
                        Header: Bearer <firebase_id_token>
                │
                ▼
            Receive JWT (role: "stylist", expires: 100d)
                │
                ▼
            Navigate → Stylist Dashboard
```

---

## 3. Firebase OTP Setup (Client Side)

The backend never sends or verifies OTPs. Firebase handles it entirely. After OTP verification, Firebase gives you a **Firebase ID Token** — pass this to every auth endpoint.

```js
// React Native / Flutter — send OTP
await auth().signInWithPhoneNumber(phoneNumber);

// After user enters OTP
const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
const userCredential = await confirmation.confirm(otpCode);

// Get the Firebase ID Token — send this to the backend
const firebaseIdToken = await userCredential.user.getIdToken();
```

---

## 4. Auth Endpoints

### 4.1 Check Professional Stylist

**When to call:** Immediately after OTP verification when the user is on the Stylist login tab. Determines if this phone number already has a stylist account.

```
GET /stylist/check-professional/:phoneNumber
Authorization: Bearer <firebase_id_token>
```

**Path param:** `phoneNumber` — URL-encoded with country code
- Raw: `+919876543210`
- Encoded: `%2B919876543210`

**Encoding (React Native):**
```js
const encoded = encodeURIComponent(phoneNumber); // "+919876543210" → "%2B919876543210"
const url = `/stylist/check-professional/${encoded}`;
```

**Response — Found** `200`
```json
{
  "success": true,
  "isProfessionalStylist": true,
  "message": "Professional stylist found"
}
```

**Response — Not Found** `200`
```json
{
  "success": true,
  "isProfessionalStylist": false,
  "message": "Professional stylist not found"
}
```

**Response — Firebase token invalid** `401`
```json
{
  "success": false,
  "message": "Invalid Firebase token"
}
```

**App logic:**
```js
if (response.isProfessionalStylist) {
  // Call POST /auth/login → go to Stylist Dashboard
} else {
  // Navigate to 5-step onboarding
}
```

---

### 4.2 Register Professional Stylist

**When to call:** On the last step of the 5-step onboarding after the stylist has filled in all their details.

```
POST /stylist/register-professional
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

**Request Body**
```json
{
  "phoneNumber": "+919876543210",
  "firebaseIdToken": "eyJhbGci...",
  "fullName": "Priya Sharma",
  "shortBio": "Fashion stylist with 6+ years helping clients build confident wardrobes.",
  "specialties": ["Bridal", "Corporate", "Casual"],
  "yearsOfExperience": "4-6 yrs",
  "portfolioLink": "https://instagram.com/priyastylist",
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

**Required fields:** `phoneNumber`, `firebaseIdToken`, `fullName`, `shortBio`, `specialties`, `yearsOfExperience`, `baseSessionFee`, `dayAvailability`, `startTime`, `endTime`

**Optional fields:** `portfolioLink`, `addOnServices`, `paymentModes`, `profilePictureUrl`

**Success Response** `201`
```json
{
  "success": true,
  "message": "Professional stylist registered successfully",
  "user": {
    "id": "64abc123def456789...",
    "phoneNumber": "+919876543210",
    "email": null,
    "name": "Priya Sharma",
    "displayName": "Priya Sharma",
    "role": "stylist"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": "100d"
}
```

**Error responses:**

| Code | Cause |
|------|-------|
| `400` | Missing required fields |
| `400` | Phone number doesn't match Firebase token |
| `401` | Invalid Firebase token |
| `409` | Phone already registered as professional stylist |

**App logic after success:**
```js
// Store tokens and user
await AsyncStorage.setItem('accessToken', response.accessToken);
await AsyncStorage.setItem('refreshToken', response.refreshToken);
await AsyncStorage.setItem('stylistId', response.user.id);
// Navigate to Stylist Dashboard
```

---

### 4.3 Login (Shared)

**When to call:** After `check-professional` returns `isProfessionalStylist: true`.

```
POST /auth/login
Content-Type: application/json
```

> No Authorization header needed — Firebase token is in the body.

**Request Body**
```json
{
  "phoneNumber": "+919876543210",
  "firebaseIdToken": "eyJhbGci..."
}
```

**Success Response** `200`
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "64abc123def456789...",
    "_id": "64abc123def456789...",
    "phoneNumber": "+919876543210",
    "email": null,
    "name": "Priya Sharma",
    "displayName": "Priya Sharma",
    "role": "stylist",
    "is_creator": false
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": "100d"
}
```

**Error responses:**

| Code | Cause |
|------|-------|
| `400` | Missing phoneNumber or firebaseIdToken |
| `401` | Invalid Firebase token |
| `404` | Phone not registered → redirect to onboarding |

**Role-based routing:**
```js
const { user, accessToken } = response;
if (user.role === 'stylist') {
  navigateTo('StylistDashboard');
} else if (user.role === 'User') {
  navigateTo('ClientHome');
}
```

**JWT payload (decoded):**
```json
{
  "id": "64abc123def456789...",
  "phoneNumber": "+919876543210",
  "role": "stylist",
  "iat": 1711584000,
  "exp": 1720224000
}
```

---

## 5. Dashboard Endpoints

> All dashboard endpoints require `Authorization: Bearer <jwt_access_token>`.
> The `stylistId` path param = `user.id` from the JWT / login response.

---

### 5.1 Get Dashboard Stats

**When to call:** When the stylist opens the Dashboard tab (overview cards).

```
GET /stylist/dashboard-stats/:stylistId
Authorization: Bearer <jwt_access_token>
```

**Success Response** `200`
```json
{
  "success": true,
  "data": {
    "totalClients": 47,
    "upcomingSessions": 3,
    "totalSessions": 120,
    "completedSessions": 117,
    "pendingRequests": 5,
    "totalEarnings": 84500.00,
    "rating": 4.8
  }
}
```

**UI mapping:**
```
totalClients       → "Clients" card
upcomingSessions   → "Upcoming" card
pendingRequests    → "Pending" badge / card
totalEarnings      → "Earnings" card
rating             → Star rating display
```

---

### 5.2 Get Stylist Bookings

**When to call:** Dashboard bookings list, filterable by status.

```
GET /stylist/:stylistId/bookings?page=1&limit=10&status=pending
Authorization: Bearer <jwt_access_token>
```

**Query params:**

| Param | Type | Default | Values |
|-------|------|---------|--------|
| `page` | int | `1` | Any positive int |
| `limit` | int | `10` | Any positive int |
| `status` | string | all | `pending` `confirmed` `completed` `cancelled` `rejected` |

**Success Response** `200`
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "_id": "64booking1abc...",
        "clientId": {
          "_id": "64client1...",
          "displayName": "Rahul Mehta",
          "phoneNumber": "+919876543210"
        },
        "stylistId": "64stylistprofile1...",
        "scheduledAt": "2026-04-05T14:00:00.000Z",
        "durationMinutes": 60,
        "status": "pending",
        "sessionType": "video",
        "baseAmount": 1000,
        "addOnServices": ["Wardrobe Audit"],
        "totalAmount": 1500,
        "currency": "INR",
        "notes": "Looking for a complete office wardrobe revamp",
        "createdAt": "2026-03-28T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 23,
      "totalPages": 3
    }
  }
}
```

**Booking status values and UI labels:**

| status | UI label | Action buttons |
|--------|----------|----------------|
| `pending` | Pending | Accept / Decline |
| `confirmed` | Confirmed | Complete / Cancel |
| `completed` | Completed | — |
| `rejected` | Declined | — |
| `cancelled` | Cancelled | — |

---

### 5.3 Get Stylist Clients

**When to call:** When the stylist opens the My Clients tab.

```
GET /stylist/:stylistId/clients?page=1&limit=20
Authorization: Bearer <jwt_access_token>
```

**Query params:**

| Param | Default |
|-------|---------|
| `page` | `1` |
| `limit` | `20` |

**Success Response** `200`
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "clientId": "64client1...",
        "displayName": "Rahul Mehta",
        "phoneNumber": "+919876543210",
        "profilePictureUrl": null,
        "totalBookings": 4,
        "lastBookingDate": "2026-03-15T10:00:00.000Z",
        "totalSpent": 5500
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47,
      "totalPages": 3
    }
  }
}
```

---

### 5.4 Update Booking Status

**When to call:** When the stylist taps Accept, Decline, or Complete on a booking card.

```
PUT /booking/:bookingId/status
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
```

**Request Body**
```json
{
  "status": "confirmed",
  "reason": ""
}
```

**`reason`** is optional but should be sent when declining or cancelling — it is shown to the client in the push notification.

**Valid transitions:**

| Current | Can move to |
|---------|------------|
| `pending` | `confirmed`, `rejected` |
| `confirmed` | `completed`, `cancelled` |
| `completed` | — terminal |
| `rejected` | — terminal |
| `cancelled` | — terminal |

**Success Response** `200`
```json
{
  "success": true,
  "message": "Booking status updated to confirmed",
  "data": {
    "_id": "64booking1abc...",
    "status": "confirmed",
    "updatedAt": "2026-03-28T12:00:00.000Z"
  }
}
```

**Error responses:**

| Code | Cause |
|------|-------|
| `400` | Invalid status transition |
| `403` | JWT stylist doesn't own this booking |
| `404` | Booking not found |

**Side effects (handled by backend):**
- `confirmed` → FCM push to client: "Your booking has been confirmed"
- `rejected` → FCM push to client: "Your booking was declined: {reason}"
- `completed` → FCM push to client: "Your styling session has been marked as completed"
- `cancelled` → FCM push to client: "Your booking has been cancelled: {reason}"

---

### 5.5 Update Stylist Profile

**When to call:** From the Profile tab when the stylist edits their professional info.

```
PUT /stylist/:stylistId/profile
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
```

**Request Body** — all fields are optional, send only what changed:
```json
{
  "fullName": "Priya Sharma",
  "shortBio": "Updated bio here...",
  "specialties": ["Bridal", "Casual", "Minimalist"],
  "yearsOfExperience": "7-10 yrs",
  "portfolioLink": "https://instagram.com/priyastylist",
  "baseSessionFee": "₹1500 / 90 min",
  "addOnServices": ["Wardrobe Audit", "Color Consultation"],
  "paymentModes": ["UPI", "Credit Card"],
  "profilePictureUrl": "https://firebasestorage.googleapis.com/..."
}
```

**Success Response** `200`
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "64stylistprofile...",
    "fullName": "Priya Sharma",
    "shortBio": "Updated bio here...",
    "specialties": ["Bridal", "Casual", "Minimalist"],
    "yearsOfExperience": "7-10 yrs",
    "portfolioLink": "https://instagram.com/priyastylist",
    "baseSessionFee": "₹1500 / 90 min",
    "addOnServices": ["Wardrobe Audit", "Color Consultation"],
    "paymentModes": ["UPI", "Credit Card"],
    "profilePictureUrl": "https://firebasestorage.googleapis.com/...",
    "updatedAt": "2026-03-28T12:30:00.000Z"
  }
}
```

**Error responses:**

| Code | Cause |
|------|-------|
| `403` | JWT id doesn't match stylistId |
| `404` | Stylist profile not found |

---

### 5.6 Update Stylist Availability

**When to call:** From the Schedule tab when the stylist updates their working days/hours.

```
PUT /stylist/:stylistId/availability
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
```

**Request Body**
```json
{
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
  "breaks": [
    { "start": "1:00 PM", "end": "2:00 PM" }
  ]
}
```

**Required:** `dayAvailability`, `startTime`, `endTime`
**Optional:** `breaks` (defaults to `[]`)

**Success Response** `200`
```json
{
  "success": true,
  "message": "Availability updated successfully",
  "data": {
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
    "breaks": [
      { "start": "1:00 PM", "end": "2:00 PM" }
    ],
    "updatedAt": "2026-03-28T12:45:00.000Z"
  }
}
```

---

## 6. Video Call — Agora Integration

Video sessions use **Agora RTC** (video) + **Agora RTM** (chat/messaging). The backend generates tokens; the app joins the channel using the Agora SDK.

### 6.1 Start Video Call

**When to call:** When the stylist (or client) taps "Start Session" on a confirmed booking.

```
POST /stylist-booking/start-video-call/:bookingId
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
```

**Request Body** — send the caller's userId
```json
{
  "userId": "64abc123def456789..."
}
```

**Success Response** `200`
```json
{
  "success": true,
  "message": "Video call session started",
  "data": {
    "appId": "your-agora-app-id",
    "channelName": "session_BOOK_1711584000_abc123",
    "rtcToken": "006your-rtc-token...",
    "rtmToken": "006your-rtm-token...",
    "rtcUid": 12345678,
    "rtmUid": "stylist_64abc123...",
    "expiresAt": 1711587600,
    "expiresIn": 3600,
    "bookingId": "64booking1abc...",
    "sessionType": "video"
  }
}
```

**Agora SDK — Join channel (React Native):**
```js
import RtcEngine from 'react-native-agora';

const engine = await RtcEngine.create(data.appId);
await engine.enableVideo();
await engine.joinChannel(data.rtcToken, data.channelName, null, data.rtcUid);
```

### 6.2 End Video Call

**When to call:** When either party ends the session.

```
POST /stylist-booking/end-video-call/:bookingId
Authorization: Bearer <jwt_access_token>
```

**Success Response** `200`
```json
{
  "success": true,
  "message": "Video call session ended",
  "data": {
    "bookingId": "64booking1abc...",
    "videoCallDuration": 45,
    "videoCallEndedAt": "2026-03-28T15:45:00.000Z"
  }
}
```

**App cleanup after ending:**
```js
await engine.leaveChannel();
await engine.destroy();
// Navigate back to booking detail
```

---

## 7. JWT Token Handling

The JWT is a base64url-encoded token. You can decode the payload (middle part) to read user info without making an API call.

**Token expiry:** 100 days for professional stylists.

**Decoding the payload (React Native):**
```js
const decodeJWT = (token) => {
  const payload = token.split('.')[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
};

const payload = decodeJWT(accessToken);
// payload.id        → stylistId to use in all dashboard API calls
// payload.role      → "stylist"
// payload.exp       → Unix timestamp — check if token is expired
```

**Check if expired:**
```js
const isTokenExpired = (token) => {
  const { exp } = decodeJWT(token);
  return Date.now() / 1000 >= exp;
};
```

**On app launch:**
```js
const accessToken = await AsyncStorage.getItem('accessToken');
if (!accessToken || isTokenExpired(accessToken)) {
  // Clear session and navigate to login
  await AsyncStorage.clear();
  navigateTo('Login');
}
```

---

## 8. Session Storage Strategy

Store these items in `AsyncStorage` (or your preferred secure storage) immediately after login or registration:

```js
// After successful login / register
await AsyncStorage.multiSet([
  ['accessToken',  response.accessToken],
  ['refreshToken', response.refreshToken],
  ['stylistId',    response.user.id],        // Use in all :stylistId URL params
  ['displayName',  response.user.displayName],
  ['phoneNumber',  response.user.phoneNumber],
  ['role',         response.user.role],       // "stylist"
]);
```

**Reading stylistId for API calls:**
```js
const stylistId = await AsyncStorage.getItem('stylistId');
const stats = await fetch(`/stylist/dashboard-stats/${stylistId}`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

**Logout / clear session:**
```js
await AsyncStorage.multiRemove([
  'accessToken', 'refreshToken', 'stylistId',
  'displayName', 'phoneNumber', 'role'
]);
navigateTo('Login');
```

---

## 9. Full Login Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Login Screen                             │
│   [ User Tab ]   [ Stylist Tab ]  ← user selects Stylist   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              Enter Phone Number
                          │
                Firebase SDK: sendOTP
                          │
              User enters OTP code
                          │
                Firebase SDK: confirmOTP
                          │
                Returns firebaseIdToken
                          │
                          ▼
        GET /stylist/check-professional/:phoneNumber
        Header: Bearer <firebaseIdToken>
                          │
            ┌─────────────┴──────────────┐
            │                            │
   isProfessionalStylist: true   isProfessionalStylist: false
            │                            │
            ▼                            ▼
   POST /auth/login              Onboarding Step 1
   Body: { phoneNumber,          (Professional Info)
           firebaseIdToken }             │
            │                   Onboarding Step 2
            ▼                   (Profile Picture)
   Receive JWT (100d)                    │
            │                   Onboarding Step 3
            ▼                   (Pricing)
   Store tokens                          │
   Navigate →                  Onboarding Step 4
   Stylist Dashboard           (Availability)
                                         │
                                Onboarding Step 5
                                (Welcome / Submit)
                                         │
                                POST /stylist/register-professional
                                Header: Bearer <firebaseIdToken>
                                         │
                                Receive JWT (100d)
                                         │
                                Store tokens
                                Navigate →
                                Stylist Dashboard
```

---

## 10. Onboarding Screen Map

Each screen maps to fields in `POST /stylist/register-professional`:

| Step | Screen | Fields collected |
|------|--------|-----------------|
| 1 | Professional Info | `fullName`, `shortBio`, `specialties`, `yearsOfExperience`, `portfolioLink` |
| 2 | Profile Picture | `profilePictureUrl` (upload to Firebase Storage first, then pass the URL) |
| 3 | Pricing | `baseSessionFee`, `addOnServices`, `paymentModes` |
| 4 | Availability | `dayAvailability`, `startTime`, `endTime` |
| 5 | Review & Submit | Collect `phoneNumber` + `firebaseIdToken`, call register endpoint |

**Firebase Storage upload (profile picture):**
```js
import storage from '@react-native-firebase/storage';

const uploadProfilePicture = async (localUri, phoneNumber) => {
  const ref = storage().ref(`stylist-profiles/${phoneNumber}/profile.jpg`);
  await ref.putFile(localUri);
  const url = await ref.getDownloadURL();
  return url; // pass this as profilePictureUrl
};
```

---

## 11. Error Handling

All error responses share this shape:

```json
{
  "success": false,
  "message": "Human-readable description"
}
```

**Global error handler (axios interceptor):**
```js
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || 'Something went wrong';

    if (status === 401) {
      // Token invalid or expired — force logout
      clearSessionAndGoToLogin();
    } else if (status === 403) {
      showAlert('Access denied');
    } else if (status === 404) {
      // For /auth/login: not registered — go to onboarding
      // For other endpoints: resource not found
    } else if (status === 409) {
      showAlert('Already registered', message);
    } else if (status === 400) {
      showAlert('Invalid input', message);
    } else {
      showAlert('Error', message);
    }

    return Promise.reject(err);
  }
);
```

**HTTP status code reference:**

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (registration) |
| `400` | Bad request — missing or invalid fields |
| `401` | Firebase token or JWT invalid / missing |
| `403` | Authenticated but not authorised (wrong stylist) |
| `404` | Not found — for login means "go to onboarding" |
| `409` | Conflict — already registered |
| `500` | Server error |

---

## 12. Enum Reference

Use these exact string values in requests and for rendering UI:

### specialties
```
"Bridal", "Corporate", "Casual", "Streetwear", "Traditional",
"Western Fusion", "Party Wear", "Minimalist", "Color Analysis",
"Wardrobe Audit", "Personal Shopping"
```

### yearsOfExperience
```
"Less than 1 yr", "1-3 yrs", "4-6 yrs", "7-10 yrs", "10+ yrs"
```

### baseSessionFee
```
"₹500 / 30 min", "₹1000 / 60 min", "₹1500 / 90 min",
"₹2000 / 120 min", "₹2500 / 150 min", "₹3000 / 180 min"
```

### addOnServices
```
"Wardrobe Audit", "Event Styling", "Personal Shopping",
"Color Consultation", "Virtual Styling"
```

### paymentModes
```
"UPI", "Credit Card", "Debit Card", "Net Banking", "Cash"
```

### booking status
```
"pending", "confirmed", "completed", "rejected", "cancelled"
```

### sessionType
```
"video", "in-person"
```

---

## Quick Reference — All Endpoints

| # | Method | Endpoint | Auth Type | Purpose |
|---|--------|----------|-----------|---------|
| 1 | GET | `/stylist/check-professional/:phoneNumber` | Firebase token | Check if phone is a registered stylist |
| 2 | POST | `/stylist/register-professional` | Firebase token (in body) | Register + onboard new professional stylist |
| 3 | POST | `/auth/login` | Firebase token (in body) | Login — role in JWT decides routing |
| 4 | GET | `/stylist/dashboard-stats/:stylistId` | JWT | Dashboard overview cards |
| 5 | GET | `/stylist/:stylistId/bookings` | JWT | List bookings (paginated, filterable) |
| 6 | GET | `/stylist/:stylistId/clients` | JWT | List unique clients with stats |
| 7 | PUT | `/booking/:bookingId/status` | JWT | Accept / reject / complete a booking |
| 8 | PUT | `/stylist/:stylistId/profile` | JWT | Update professional profile fields |
| 9 | PUT | `/stylist/:stylistId/availability` | JWT | Update weekly schedule |
| 10 | POST | `/stylist-booking/start-video-call/:bookingId` | JWT | Start Agora video session |
| 11 | POST | `/stylist-booking/end-video-call/:bookingId` | JWT | End Agora video session |

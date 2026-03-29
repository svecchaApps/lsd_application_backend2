# Stylist App — UI Changes & Data Format Guide

This document covers every backend change that affects what the mobile app displays, how data is read from the API, and how forms should be structured. Share this with any developer working on the stylist-facing screens.

---

## Table of Contents

1. [Registration Flow Changes](#1-registration-flow-changes)
2. [Joining Fee Payment Screen](#2-joining-fee-payment-screen)
3. [Profile Document — Exact Field Reference](#3-profile-document--exact-field-reference)
4. [Field Mapping — Old vs New Names](#4-field-mapping--old-vs-new-names)
5. [Onboarding Form Fields & Validation](#5-onboarding-form-fields--validation)
6. [Dashboard Stats Screen](#6-dashboard-stats-screen)
7. [Bookings Screen](#7-bookings-screen)
8. [Clients Screen](#8-clients-screen)
9. [Profile Edit Screen](#9-profile-edit-screen)
10. [Availability Edit Screen](#10-availability-edit-screen)
11. [Enum Values for Dropdowns & Chips](#11-enum-values-for-dropdowns--chips)
12. [Token & Session Storage](#12-token--session-storage)

---

## 1. Registration Flow Changes

The onboarding now has **two paths** — with and without joining fee.

### Path A — Direct Registration (no payment gate)
```
POST /stylist/register-professional
→ Returns accessToken immediately
→ Navigate to Stylist Dashboard
```

### Path B — With Joining Fee (recommended production flow)
```
POST /stylist/joining-fee/initiate   ← send all profile data here
→ Open Razorpay payment sheet
→ POST /stylist/joining-fee/verify
→ Returns accessToken
→ Navigate to Stylist Dashboard
```

### Login check before showing onboarding
Always call this first after OTP:
```
GET /stylist/check-professional/:phoneNumber
Header: Authorization: Bearer <firebase_id_token>
```
- `isProfessionalStylist: true` → skip onboarding → call `POST /auth/login` → Dashboard
- `isProfessionalStylist: false` → show onboarding screens

---

## 2. Joining Fee Payment Screen

This screen appears as **Step 5 (final step)** of onboarding.

### What to display

```
┌────────────────────────────────────┐
│         ✦  One-time Fee            │
│                                    │
│            ₹499                    │
│   (use data.amountInRupees         │
│    from initiate response)         │
│                                    │
│  Pay once to activate your         │
│  Professional Stylist account      │
│                                    │
│  [ Pay & Activate Account ]        │
│                                    │
│       🔒 Secured by Razorpay       │
└────────────────────────────────────┘
```

> **Important:** Never hardcode `₹499`. Always read `data.amountInRupees` from the initiate response. The admin can change the fee from the backend.

### Initiate API call

```
POST /stylist/joining-fee/initiate
Body: { all onboarding fields + phoneNumber + firebaseIdToken }
```

**Response fields to use:**

| Response field | Used for |
|----------------|----------|
| `data.amountInRupees` | Display price on screen `"₹499"` |
| `data.amount` | Pass to Razorpay SDK (in paise, e.g. `49900`) |
| `data.orderId` | Pass to Razorpay SDK |
| `data.razorpayKeyId` | Initialise Razorpay SDK |
| `data.profileId` | **Save this** — needed for verify step |
| `data.prefill.name` | Pre-fills name in Razorpay sheet |
| `data.prefill.contact` | Pre-fills phone in Razorpay sheet |
| `data.description` | Razorpay sheet description text |

### After payment success — verify call

```
POST /stylist/joining-fee/verify
Body: {
  profileId,               ← saved from initiate response
  razorpay_order_id,       ← from Razorpay success callback
  razorpay_payment_id,     ← from Razorpay success callback
  razorpay_signature       ← from Razorpay success callback
}
```

**On success:** save `accessToken`, `refreshToken`, `user.id` (as `stylistId`) → navigate to Dashboard.

---

## 3. Profile Document — Exact Field Reference

This is what the stored stylist profile document now looks like. Use these field names when reading API responses.

### Core identity fields

| Field | Type | Example value | Display as |
|-------|------|---------------|-----------|
| `_id` | string | `"64abc123..."` | Internal ID — store as `stylistProfileId` |
| `userId` | string | `"64abc120..."` | Internal — this is the `User._id`, store as `stylistId` |
| `fullName` | string | `"Rajat Saxena"` | Profile name, header title |
| `shortBio` | string | `"Fashion stylist with 6+ years..."` | Bio section |
| `profilePictureUrl` | string | `"https://firebase..."` | Profile avatar |
| `specialties` | string[] | `["Bridal", "Corporate"]` | Chips/tags on profile card |
| `yearsOfExperience` | string | `"4-6 yrs"` | Experience badge |
| `portfolioLink` | string | `"https://instagram.com/..."` | Tappable link — only set if starts with `http` |
| `baseSessionFee` | string | `"₹1500 / 90 min"` | Fee display on profile |
| `addOnServices` | string[] | `["Wardrobe Audit"]` | Add-on chips |
| `paymentModes` | string[] | `["UPI", "Credit Card"]` | Payment method icons |

### Legacy fields (also present — use for fallback)

| Legacy field | New equivalent | Note |
|---|---|---|
| `stylistName` | `fullName` | Same value — use `fullName` preferably |
| `stylistBio` | `shortBio` | Same value |
| `stylistImage` | `profilePictureUrl` | Same value |
| `stylistSkills` | `specialties` | Same array |
| `stylistExperience` | `yearsOfExperience` | Same value |
| `stylistPrice` | parsed from `baseSessionFee` | Number only e.g. `1500` |
| `stylistAvailability` | `professionalAvailability` | Formatted string e.g. `"Mon, Tue: 10:00 AM - 7:00 PM"` |
| `stylistPortfolio` | `portfolioLink` | Array of URLs only (empty if no valid URL given) |
| `stylistRating` | `bookingStats.averageRating` | Initialised to `0` on registration |

### Availability fields

| Field | Type | Example |
|-------|------|---------|
| `stylistAvailability` | string | `"Mon, Tue, Thu, Fri: 10:00 AM - 7:00 PM"` — use this for a quick one-line display |
| `professionalAvailability.dayAvailability` | object | `{ "Monday": true, "Tuesday": false, ... }` — use this for the schedule toggle UI |
| `professionalAvailability.startTime` | string | `"10:00 AM"` |
| `professionalAvailability.endTime` | string | `"7:00 PM"` |
| `professionalAvailability.breaks` | array | `[{ "start": "1:00 PM", "end": "2:00 PM" }]` |

### Booking stats (for dashboard cards)

| Field | Type | Display as |
|-------|------|-----------|
| `bookingStats.totalBookings` | number | Total sessions count |
| `bookingStats.completedBookings` | number | Completed sessions |
| `bookingStats.cancelledBookings` | number | Cancelled count |
| `bookingStats.averageRating` | number | Star rating (0.0 – 5.0) |
| `bookingStats.totalEarnings` | number | Total earnings in ₹ |

### Status fields

| Field | Values | Meaning |
|-------|--------|---------|
| `applicationStatus` | `"approved"` / `"payment_pending"` | `"approved"` = account active |
| `isApproved` | `true` / `false` | Check this before showing dashboard |
| `paymentStatus` | `"pending"` / `"completed"` | Joining fee payment status |
| `isTopStylist` | `true` / `false` | Show "Top Stylist" badge if true |

---

## 4. Field Mapping — Old vs New Names

If your Flutter models use old field names, here is the exact rename map:

| Old Flutter field | New API field | Change needed |
|---|---|---|
| `stylistName` | `fullName` | Rename in model + display widgets |
| `stylistBio` | `shortBio` | Rename in bio display |
| `stylistImage` | `profilePictureUrl` | Rename in avatar widget |
| `stylistSkills` | `specialties` | Rename in chips widget |
| `stylistExperience` | `yearsOfExperience` | Rename in experience display |
| `stylistPrice` (int) | `baseSessionFee` (string) | Display the string directly, not the number |
| `stylistPortfolio` (array) | `portfolioLink` (single string) | Change to single URL field |
| `stylistAvailability` (string) | `professionalAvailability` (object) | Use object for editable form, string for display |

### Reading the fee

```dart
// OLD — was a number
Text('₹${stylist.stylistPrice}')

// NEW — already formatted string
Text(stylist.baseSessionFee)  // "₹1500 / 90 min"

// If you still need the number (e.g. for calculations)
int price = stylist.stylistPrice; // still present, parsed automatically
```

### Reading availability for display

```dart
// Quick one-line display (profile card, list item)
Text(stylist.stylistAvailability)
// Shows: "Mon, Tue, Thu, Fri: 10:00 AM - 7:00 PM"

// For the schedule edit screen (toggles per day)
final days = stylist.professionalAvailability.dayAvailability;
// { "Monday": true, "Tuesday": false, ... }
```

---

## 5. Onboarding Form Fields & Validation

### Step 1 — Professional Info

| Form field | Sends as | Type | Required | Validation |
|-----------|----------|------|----------|-----------|
| Full Name | `fullName` | string | yes | Min 2 chars |
| Short Bio | `shortBio` | string | yes | Min 10 chars, max 500 |
| Specialties | `specialties` | string[] | yes | Min 1 selected |
| Years of Experience | `yearsOfExperience` | string | yes | Must be from enum |
| Portfolio Link | `portfolioLink` | string | no | Must start with `http` if provided |

### Step 2 — Profile Picture

| Form field | Sends as | Type | Note |
|-----------|----------|------|------|
| Profile Image | `profilePictureUrl` | string | Upload to Firebase Storage first, then send the download URL |

### Step 3 — Pricing

| Form field | Sends as | Type | Required |
|-----------|----------|------|----------|
| Base Session Fee | `baseSessionFee` | string | yes — pick from enum |
| Add-on Services | `addOnServices` | string[] | no |
| Payment Modes | `paymentModes` | string[] | no |

### Step 4 — Availability

| Form field | Sends as | Type | Required |
|-----------|----------|------|----------|
| Day toggles | `dayAvailability` | object | yes — all 7 keys required |
| Start Time | `startTime` | string | yes — format `"HH:MM AM/PM"` |
| End Time | `endTime` | string | yes — format `"HH:MM AM/PM"` |

### Step 5 — Joining Fee Payment

No form fields. Just display the fee and trigger payment.
All data collected in Steps 1–4 is sent in the initiate call.

---

## 6. Dashboard Stats Screen

Call this when the stylist opens the Dashboard tab.

```
GET /stylist/dashboard-stats/:stylistId
Authorization: Bearer <jwt_access_token>
```

`stylistId` = the `user.id` value saved after login/register.

### Response → UI mapping

```json
{
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

| Response field | Display card | Format |
|----------------|-------------|--------|
| `totalClients` | "Total Clients" | Plain number `47` |
| `upcomingSessions` | "Upcoming" | Plain number `3` |
| `pendingRequests` | "Pending" | Show as badge/alert if > 0 |
| `completedSessions` | "Completed" | Plain number `117` |
| `totalEarnings` | "Total Earnings" | `"₹84,500"` |
| `rating` | Star rating | `4.8 ★` |

---

## 7. Bookings Screen

```
GET /stylist/:stylistId/bookings?page=1&limit=10&status=pending
Authorization: Bearer <jwt_access_token>
```

### Booking card fields

```json
{
  "_id": "64booking...",
  "clientId": {
    "_id": "64client...",
    "displayName": "Rahul Mehta",
    "phoneNumber": "+919876543210"
  },
  "scheduledAt": "2026-04-05T14:00:00.000Z",
  "durationMinutes": 60,
  "status": "pending",
  "sessionType": "video",
  "baseAmount": 1000,
  "addOnServices": ["Wardrobe Audit"],
  "totalAmount": 1500,
  "currency": "INR",
  "notes": "Looking for office wardrobe help",
  "createdAt": "2026-03-29T10:00:00.000Z"
}
```

### Status → UI

| `status` | Label colour | Action buttons |
|----------|-------------|----------------|
| `pending` | Amber/Orange | **Accept** + **Decline** |
| `confirmed` | Green | **Complete** + **Cancel** |
| `completed` | Blue/Grey | — (show receipt icon) |
| `rejected` | Red | — |
| `cancelled` | Red/Grey | — |

### Updating booking status

```
PUT /booking/:bookingId/status
Authorization: Bearer <jwt_access_token>
Body: { "status": "confirmed", "reason": "" }
```

`reason` field: show a text input dialog when stylist taps **Decline** or **Cancel** — the reason is sent to the client via push notification.

### Valid transitions (enforce in UI — disable buttons accordingly)

| Current status | Buttons to show |
|----------------|----------------|
| `pending` | Accept → `confirmed`, Decline → `rejected` |
| `confirmed` | Complete → `completed`, Cancel → `cancelled` |
| `completed` | No buttons |
| `rejected` | No buttons |
| `cancelled` | No buttons |

---

## 8. Clients Screen

```
GET /stylist/:stylistId/clients?page=1&limit=20
Authorization: Bearer <jwt_access_token>
```

### Client card fields

```json
{
  "clientId": "64client...",
  "displayName": "Rahul Mehta",
  "phoneNumber": "+919876543210",
  "profilePictureUrl": null,
  "totalBookings": 4,
  "lastBookingDate": "2026-03-15T10:00:00.000Z",
  "totalSpent": 5500
}
```

| Field | Display as |
|-------|-----------|
| `displayName` | Client name |
| `phoneNumber` | Tappable — opens dialler |
| `profilePictureUrl` | Avatar (use placeholder if `null`) |
| `totalBookings` | `"4 sessions"` |
| `lastBookingDate` | `"Last seen: Mar 15"` |
| `totalSpent` | `"₹5,500 spent"` |

---

## 9. Profile Edit Screen

```
PUT /stylist/:stylistId/profile
Authorization: Bearer <jwt_access_token>
Body: { only the fields that changed }
```

### Editable fields

| Field | Input type | Validation |
|-------|-----------|-----------|
| `fullName` | Text field | Required, min 2 chars |
| `shortBio` | Multi-line text | Max 500 chars, show character counter |
| `specialties` | Multi-select chips | Min 1 |
| `yearsOfExperience` | Dropdown | Must be from enum |
| `portfolioLink` | Text field | Must start with `http` |
| `baseSessionFee` | Dropdown | Must be from enum |
| `addOnServices` | Multi-select chips | Optional |
| `paymentModes` | Multi-select chips | Optional |
| `profilePictureUrl` | Image picker | Upload to Firebase first, then send URL |

**Send only changed fields** — don't send the whole profile on every save. This prevents overwriting unchanged data.

```dart
// Example — only send what changed
Map<String, dynamic> changes = {};
if (nameController.text != originalName) changes['fullName'] = nameController.text;
if (bioController.text != originalBio) changes['shortBio'] = bioController.text;
// ... etc
await api.put('/stylist/$stylistId/profile', changes);
```

### Success response

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "...",
    "fullName": "Priya Sharma",
    "shortBio": "Updated bio...",
    "specialties": ["Bridal", "Casual"],
    "yearsOfExperience": "7-10 yrs",
    "portfolioLink": "https://instagram.com/...",
    "baseSessionFee": "₹1500 / 90 min",
    "addOnServices": ["Wardrobe Audit"],
    "paymentModes": ["UPI"],
    "profilePictureUrl": "https://firebase...",
    "updatedAt": "2026-03-29T12:30:00.000Z"
  }
}
```

Update the local state with `data` from this response.

---

## 10. Availability Edit Screen

```
PUT /stylist/:stylistId/availability
Authorization: Bearer <jwt_access_token>
Body: { dayAvailability, startTime, endTime, breaks }
```

### Request body

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

### UI components needed

```
[ Mon ]  [ Tue ]  [ Wed ]  [ Thu ]  [ Fri ]  [ Sat ]  [ Sun ]
 ✓        ✓        ✗        ✓        ✓        ✓        ✗
 (toggle chips — green = true, grey = false)

Start Time: [ 10:00 AM ▾ ]    End Time: [ 7:00 PM ▾ ]

Breaks (optional):
  + Add Break
  [ 1:00 PM ] → [ 2:00 PM ]  🗑

[ Save Availability ]
```

All 7 day keys must be sent even if false. Do not send partial objects.

### Success response

```json
{
  "success": true,
  "data": {
    "dayAvailability": { ... },
    "startTime": "10:00 AM",
    "endTime": "7:00 PM",
    "breaks": [{ "start": "1:00 PM", "end": "2:00 PM" }],
    "updatedAt": "2026-03-29T12:45:00.000Z"
  }
}
```

---

## 11. Enum Values for Dropdowns & Chips

Use these **exact strings** in all form fields. Any other value will cause inconsistent display.

### specialties (multi-select chips)
```
Bridal, Corporate, Casual, Streetwear, Traditional,
Western Fusion, Party Wear, Minimalist, Color Analysis,
Wardrobe Audit, Personal Shopping
```

### yearsOfExperience (dropdown — pick one)
```
Less than 1 yr
1-3 yrs
4-6 yrs
7-10 yrs
10+ yrs
```

### baseSessionFee (dropdown — pick one)
```
₹500 / 30 min
₹1000 / 60 min
₹1500 / 90 min
₹2000 / 120 min
₹2500 / 150 min
₹3000 / 180 min
```

### addOnServices (multi-select chips)
```
Wardrobe Audit, Event Styling, Personal Shopping,
Color Consultation, Virtual Styling
```

### paymentModes (multi-select chips)
```
UPI, Credit Card, Debit Card, Net Banking, Cash
```

### dayAvailability keys (must use these exact keys)
```
Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
```

### Time format
```
"10:00 AM", "10:30 AM", "11:00 AM" ... "9:00 PM"
Use 12-hour format with AM/PM. Separate hours and minutes with colon.
```

---

## 12. Token & Session Storage

### What to store after login or registration

```dart
await prefs.setString('accessToken',  data['accessToken']);
await prefs.setString('refreshToken', data['refreshToken']);
await prefs.setString('stylistId',    data['user']['id'].toString());
await prefs.setString('displayName',  data['user']['displayName'] ?? '');
await prefs.setString('phoneNumber',  data['user']['phoneNumber'] ?? '');
await prefs.setString('role',         data['user']['role']);  // always "stylist"
```

### Using stylistId in API calls

```dart
final stylistId = prefs.getString('stylistId');

// All dashboard endpoints
GET  /stylist/dashboard-stats/$stylistId
GET  /stylist/$stylistId/bookings
GET  /stylist/$stylistId/clients
PUT  /stylist/$stylistId/profile
PUT  /stylist/$stylistId/availability
```

### Token expiry

JWT expires in **100 days**. Check on app launch:

```dart
bool isTokenExpired(String token) {
  final parts = token.split('.');
  final payload = jsonDecode(
    utf8.decode(base64Url.decode(base64Url.normalize(parts[1])))
  );
  final exp = payload['exp'] as int;
  return DateTime.now().millisecondsSinceEpoch / 1000 >= exp;
}

// On app launch
final token = prefs.getString('accessToken');
if (token == null || isTokenExpired(token)) {
  // Clear storage and go to login
  await prefs.clear();
  navigateTo('/login');
}
```

### Role-based routing after login

```dart
final role = data['user']['role'];
if (role == 'stylist') {
  navigateTo('/stylist-dashboard');
} else if (role == 'User') {
  navigateTo('/client-home');
}
```

---

## Quick Summary of All Endpoint URLs

| Screen | Method | URL |
|--------|--------|-----|
| Check if stylist exists | GET | `/stylist/check-professional/:phoneNumber` |
| Register (no payment) | POST | `/stylist/register-professional` |
| Login | POST | `/auth/login` |
| Initiate joining fee | POST | `/stylist/joining-fee/initiate` |
| Verify joining fee payment | POST | `/stylist/joining-fee/verify` |
| Dashboard stats | GET | `/stylist/dashboard-stats/:stylistId` |
| Bookings list | GET | `/stylist/:stylistId/bookings` |
| Clients list | GET | `/stylist/:stylistId/clients` |
| Update booking status | PUT | `/booking/:bookingId/status` |
| Update profile | PUT | `/stylist/:stylistId/profile` |
| Update availability | PUT | `/stylist/:stylistId/availability` |
| Start video call | POST | `/stylist-booking/start-video-call/:bookingId` |
| End video call | POST | `/stylist-booking/end-video-call/:bookingId` |

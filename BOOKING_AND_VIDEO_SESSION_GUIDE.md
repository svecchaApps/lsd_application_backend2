# Complete Booking and Video Session Flow Guide

This guide covers the complete flow from creating a booking to joining a video call session using Agora.

## Base URLs

- **Development**: `http://localhost:5000`
- **Production**: `https://your-production-url.com`

All endpoints are prefixed with `/api` except where noted.

---

## Flow Overview

1. **Create Booking & Initiate Payment** → Get booking ID and payment options
2. **Verify Payment** → Confirm booking (booking status changes to "confirmed")
3. **Join Video Session** → Get Agora tokens for video call (Agora is triggered here)

---

## Step 1: Create Booking and Initiate Payment

**Endpoint**: `POST /stylist-booking/create-and-pay`  
**Authentication**: Required (Bearer Token)  
**Description**: Creates a booking and immediately initiates Razorpay payment in one step.

### Request Headers
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Request Body
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "stylistId": "507f1f77bcf86cd799439012",
  "bookingType": "consultation",
  "bookingTitle": "Hair Styling Consultation",
  "bookingDescription": "Looking for advice on a new hairstyle",
  "scheduledDate": "2024-01-15",
  "scheduledTime": "14:00",
  "duration": 60,
  "customerName": "John Doe",
  "customerEmail": "john.doe@example.com",
  "customerPhone": "+919876543210"
}
```

### Required Fields
- `userId` (String/ObjectId): User ID creating the booking
- `stylistId` (String/ObjectId): Stylist ID for the booking
- `bookingTitle` (String): Title of the booking
- `bookingDescription` (String): Description of the booking
- `scheduledDate` (String): Date in YYYY-MM-DD format
- `scheduledTime` (String): Time in HH:MM format (24-hour)

### Optional Fields
- `bookingType` (String): Type of booking - "consultation", "styling_session", "makeover", "custom" (default: "consultation")
- `duration` (Number): Duration in minutes (default: 60)
- `customerName` (String): Customer name for payment
- `customerEmail` (String): Customer email for payment
- `customerPhone` (String): Customer phone for payment

### Response (201 Created)
```json
{
  "success": true,
  "message": "Booking created and payment initiated successfully",
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "bookingIdString": "BOOK_1703123456789_abc123def",
    "orderId": "order_ABC123XYZ",
    "amount": 2000,
    "currency": "INR",
    "paymentOptions": {
      "key": "rzp_test_xxxxx",
      "amount": 200000,
      "currency": "INR",
      "name": "IndigoRhapsody",
      "description": "Stylist Booking - Hair Styling Consultation",
      "order_id": "order_ABC123XYZ",
      "prefill": {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "contact": "+919876543210"
      },
      "theme": {
        "color": "#3399cc"
      }
    },
    "expiresIn": 1800,
    "bookingDetails": {
      "bookingTitle": "Hair Styling Consultation",
      "bookingType": "consultation",
      "scheduledDate": "2024-01-15T00:00:00.000Z",
      "scheduledTime": "14:00",
      "duration": 60,
      "stylistName": "Sarah's Fashion Studio",
      "status": "pending",
      "paymentStatus": "processing"
    },
    "nextStep": "Complete payment to confirm your booking"
  }
}
```

### cURL Example
```bash
curl -X POST http://localhost:5000/stylist-booking/create-and-pay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "stylistId": "507f1f77bcf86cd799439012",
    "bookingType": "consultation",
    "bookingTitle": "Hair Styling Consultation",
    "bookingDescription": "Looking for advice on a new hairstyle",
    "scheduledDate": "2024-01-15",
    "scheduledTime": "14:00",
    "duration": 60,
    "customerName": "John Doe",
    "customerEmail": "john.doe@example.com",
    "customerPhone": "+919876543210"
  }'
```

---

## Step 2: Verify Payment

**Endpoint**: `POST /stylist-booking/payment/verify` or `POST /stylist-booking/payment/callback`  
**Authentication**: Not required (Public endpoint)  
**Description**: Verifies Razorpay payment and confirms the booking. This is called after the user completes payment on Razorpay.

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "razorpay_order_id": "order_ABC123XYZ",
  "razorpay_payment_id": "pay_DEF456UVW",
  "razorpay_signature": "abc123def456..."
}
```

### Required Fields
- `razorpay_order_id` (String): Order ID from Razorpay
- `razorpay_payment_id` (String): Payment ID from Razorpay
- `razorpay_signature` (String): Payment signature from Razorpay

### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment verified successfully. Booking confirmed!",
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "bookingIdString": "BOOK_1703123456789_abc123def",
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "paymentId": "pay_DEF456UVW",
    "orderId": "order_ABC123XYZ",
    "bookingDetails": {
      "bookingTitle": "Hair Styling Consultation",
      "bookingType": "consultation",
      "scheduledDate": "2024-01-15T00:00:00.000Z",
      "scheduledTime": "14:00",
      "duration": 60,
      "stylistName": "Sarah's Fashion Studio",
      "paymentAmount": 2000
    },
    "confirmedAt": "2024-01-10T10:30:00.000Z"
  }
}
```

### cURL Example
```bash
curl -X POST http://localhost:5000/stylist-booking/payment/verify \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_ABC123XYZ",
    "razorpay_payment_id": "pay_DEF456UVW",
    "razorpay_signature": "abc123def456..."
  }'
```

---

## Step 3: Join Video Session (Agora Triggered Here)

**Endpoint**: `POST /booking-video/bookings/:bookingId/join-session`  
**Authentication**: Not required (currently commented out, but can be enabled)  
**Description**: Joins the video call session. **This is where Agora tokens are generated and returned.** The AgoraService generates RTC and RTM tokens for video and chat functionality.

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "role": "user"
}
```

### Required Fields
- `userId` (String/ObjectId): User ID joining the session
- `role` (String): Role of the user - "user" or "stylist"

### URL Parameters
- `bookingId` (String/ObjectId): Booking ID from Step 1

### Response (200 OK)
```json
{
  "success": true,
  "message": "Session joined",
  "data": {
    "appId": "316bc1b489614e9da4b83b5d62dbbe00",
    "channelName": "session_BOOK_1767524375389_9qa7l65qy",
    "rtcToken": "006316bc1b489614e9da4b83b5d62dbbe00IACJqixoBoBtpfe4T81boArbmmcnPt9+mXnpw+3gJmG0oZ2OUZ9/Gn0/IgCQeVP4P8dkaQQAAQAg0FppAgAg0FppAwAg0FppBAAg0Fpp",
    "rtmToken": "006316bc1b489614e9da4b83b5d62dbbe00IAAqmblDPXHILkTtAsXPkJ9nPKpovCKMH+7hC75Fgh46T2nHSxUAAAAAEACQeVP4P8dkaQEA6AMg0Fpp",
    "rtcUid": 175162216,
    "rtmUid": "user_507f1f77bcf86cd799439011",
    "expiresAt": 1767559200,
    "expiresIn": 3600
  }
}
```

### Response Fields Explained
- `appId`: Agora Application ID
- `channelName`: Agora channel name (unique per booking)
- `rtcToken`: Agora RTC token for video/audio streaming
- `rtmToken`: Agora RTM token for chat/messaging
- `rtcUid`: Numeric UID for RTC (generated from user ObjectId)
- `rtmUid`: String UID for RTM (format: "role_userId")
- `expiresAt`: Unix timestamp when tokens expire
- `expiresIn`: Seconds until token expiration

### Prerequisites
- Booking must have `paymentStatus` = "completed" or "test"
- Booking must have `status` = "confirmed" or "in_progress"

### cURL Example
```bash
curl -X POST http://localhost:5000/booking-video/bookings/507f1f77bcf86cd799439011/join-session \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "role": "user"
  }'
```

### For Stylist to Join
```bash
curl -X POST http://localhost:5000/booking-video/bookings/507f1f77bcf86cd799439011/join-session \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439012",
    "role": "stylist"
  }'
```

---

## Where Agora is Triggered

**Agora tokens are generated in the `joinSession` endpoint** (`POST /booking-video/bookings/:bookingId/join-session`).

### Flow in Code:

1. **Controller**: `src/controllers/videoSessionController..js` → `joinSession()` function
   - Validates booking exists
   - Checks payment status and booking status
   - Calls AgoraService to generate tokens

2. **Service**: `src/service/agoraService.js` → `generateBookingSessionTokens()` method
   - Generates RTC token using `RtcTokenBuilder.buildTokenWithUid()`
   - Generates RTM token using `RtmTokenBuilder.buildToken()`
   - Creates channel name from booking ID
   - Calculates expiration times
   - Returns all tokens and configuration

3. **Key Agora Service Methods**:
   - `generateRtcToken()`: Creates RTC token for video/audio
   - `generateRtmToken()`: Creates RTM token for chat
   - `generateNumericUid()`: Converts ObjectId to numeric UID for RTC
   - `generateChannelName()`: Creates unique channel name per booking

### Agora Configuration Required

Make sure these environment variables are set:
```env
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

---

## Complete Flow Example (JavaScript/Flutter/Dart)

### 1. Create Booking
```javascript
const createBooking = async () => {
  const response = await fetch('http://localhost:5000/stylist-booking/create-and-pay', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: "507f1f77bcf86cd799439011",
      stylistId: "507f1f77bcf86cd799439012",
      bookingType: "consultation",
      bookingTitle: "Hair Styling Consultation",
      bookingDescription: "Looking for advice on a new hairstyle",
      scheduledDate: "2024-01-15",
      scheduledTime: "14:00",
      duration: 60,
      customerName: "John Doe",
      customerEmail: "john.doe@example.com",
      customerPhone: "+919876543210"
    })
  });
  
  const data = await response.json();
  return data.data; // Contains bookingId, orderId, paymentOptions
};
```

### 2. Complete Payment (Client-side with Razorpay SDK)
```javascript
// Use Razorpay SDK to complete payment
// After payment success, call verifyPayment
```

### 3. Verify Payment
```javascript
const verifyPayment = async (orderId, paymentId, signature) => {
  const response = await fetch('http://localhost:5000/stylist-booking/payment/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    })
  });
  
  const data = await response.json();
  return data.data; // Contains bookingId, bookingStatus: "confirmed"
};
```

### 4. Join Video Session (Agora Triggered)
```javascript
const joinVideoSession = async (bookingId, userId, role) => {
  const response = await fetch(`http://localhost:5000/booking-video/bookings/${bookingId}/join-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: userId,
      role: role // "user" or "stylist"
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Use Agora tokens to join video call
    const { appId, channelName, rtcToken, rtmToken, rtcUid, rtmUid } = data.data;
    
    // Initialize Agora SDK with these tokens
    // appId, channelName, rtcToken, rtcUid for video
    // rtmToken, rtmUid for chat
  }
  
  return data.data;
};
```

---

## Error Responses

### Common Error Responses

**400 Bad Request** - Missing or invalid fields
```json
{
  "success": false,
  "message": "All required fields must be provided: userId, stylistId, bookingTitle, bookingDescription, scheduledDate, scheduledTime"
}
```

**404 Not Found** - Booking not found
```json
{
  "success": false,
  "message": "Booking not found"
}
```

**400 Payment Not Completed** - Trying to join session before payment
```json
{
  "success": false,
  "message": "Payment not completed"
}
```

**400 Session Not Active** - Booking not confirmed
```json
{
  "success": false,
  "message": "Session not active"
}
```

---

## Notes

1. **Payment Status**: Booking must have `paymentStatus` = "completed" or "test" to join video session
2. **Booking Status**: Booking must have `status` = "confirmed" or "in_progress" to join video session
3. **Token Expiration**: Agora tokens expire based on the booking's scheduled end time
4. **Channel Name**: Each booking has a unique channel name: `session_BOOK_{bookingId}`
5. **UID Generation**: RTC UID is numeric (generated from ObjectId), RTM UID is string (format: "role_userId")
6. **Session Start**: When first user joins, booking status changes to "in_progress" and `videoCallStartedAt` is set

# Razorpay Stylist Booking Payment System

## Overview

This guide explains the Razorpay payment integration for stylist bookings. The system allows users to create bookings and make payments through Razorpay, with automatic booking confirmation upon successful payment.

## Files Created/Updated

### 1. **New Controller: `src/controllers/razorpayBookingController.js`**
   - Dedicated Razorpay payment controller for stylist bookings
   - Handles payment initiation, verification, and booking confirmation
   - Includes combined create-and-pay endpoint

### 2. **Updated Routes: `src/routes/stylistBookingRoutes.js`**
   - Added new payment endpoints
   - Maintains backward compatibility with existing routes

## API Endpoints

### 1. Initiate Payment for Existing Booking
**Endpoint:** `POST /api/stylist-booking/payment/initiate/:bookingId`  
**Authentication:** Required (Bearer Token)

**Description:** Initiates Razorpay payment for an existing booking.

**Request:**
```bash
POST /api/stylist-booking/payment/initiate/507f1f77bcf86cd799439011
Headers:
  Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "orderId": "order_ABC123XYZ",
    "amount": 2000,
    "currency": "INR",
    "paymentOptions": {
      "key": "rzp_test_...",
      "amount": 200000,
      "currency": "INR",
      "name": "IndigoRhapsody",
      "description": "Stylist Booking - Hair Styling Consultation",
      "order_id": "order_ABC123XYZ",
      "prefill": {
        "name": "John Doe",
        "email": "john@example.com",
        "contact": "+1234567890"
      }
    },
    "expiresIn": 1800,
    "bookingDetails": {
      "bookingTitle": "Hair Styling Consultation",
      "bookingType": "consultation",
      "scheduledDate": "2024-01-15T00:00:00.000Z",
      "scheduledTime": "14:00",
      "duration": 60,
      "stylistName": "Sarah's Fashion Studio"
    }
  }
}
```

---

### 2. Verify Payment (Payment Callback)
**Endpoint:** `POST /api/stylist-booking/payment/verify`  
**Authentication:** Not Required (Public endpoint for Razorpay callback)

**Description:** Verifies Razorpay payment signature and confirms booking upon successful payment.

**Request:**
```bash
POST /api/stylist-booking/payment/verify
Content-Type: application/json

{
  "razorpay_order_id": "order_ABC123XYZ",
  "razorpay_payment_id": "pay_DEF456UVW",
  "razorpay_signature": "abc123def456..."
}
```

**Response:**
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

---

### 3. Create Booking and Initiate Payment (Combined)
**Endpoint:** `POST /api/stylist-booking/create-and-pay`  
**Authentication:** Required (Bearer Token)

**Description:** Creates a new booking and immediately initiates Razorpay payment in one step.

**Request:**
```bash
POST /api/stylist-booking/create-and-pay
Headers:
  Authorization: Bearer <token>
Content-Type: application/json

{
  "stylistId": "507f191e810c19729de860ea",
  "bookingType": "consultation",
  "bookingTitle": "Hair Styling Consultation",
  "bookingDescription": "Looking for advice on a new hairstyle",
  "scheduledDate": "2024-01-15",
  "scheduledTime": "14:00",
  "duration": 60
}
```

**Response:**
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
      "key": "rzp_test_...",
      "amount": 200000,
      "currency": "INR",
      "name": "IndigoRhapsody",
      "description": "Stylist Booking - Hair Styling Consultation",
      "order_id": "order_ABC123XYZ",
      "prefill": {
        "name": "John Doe",
        "email": "john@example.com",
        "contact": "+1234567890"
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

---

### 4. Get Payment Status
**Endpoint:** `GET /api/stylist-booking/payment/status/:bookingId`  
**Authentication:** Required (Bearer Token)

**Description:** Retrieves the current payment status for a booking.

**Request:**
```bash
GET /api/stylist-booking/payment/status/507f1f77bcf86cd799439011
Headers:
  Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "bookingIdString": "BOOK_1703123456789_abc123def",
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "paymentAmount": 2000,
    "paymentCurrency": "INR",
    "razorpayOrderId": "order_ABC123XYZ",
    "razorpayPaymentId": "pay_DEF456UVW",
    "paymentCompletedAt": "2024-01-10T10:30:00.000Z",
    "razorpayPaymentDetails": {
      "paymentId": "pay_DEF456UVW",
      "amount": 200000,
      "currency": "INR",
      "status": "captured",
      "method": "card"
    },
    "canRetryPayment": false,
    "bookingDetails": {
      "bookingTitle": "Hair Styling Consultation",
      "scheduledDate": "2024-01-15T00:00:00.000Z",
      "scheduledTime": "14:00",
      "stylistName": "Sarah's Fashion Studio"
    }
  }
}
```

---

## Payment Flow

### Flow 1: Create Booking First, Then Pay
1. **Create Booking:** `POST /api/stylist-booking/create`
   - Creates a booking with status `pending`
   - Payment status is `pending`

2. **Initiate Payment:** `POST /api/stylist-booking/payment/initiate/:bookingId`
   - Creates Razorpay order
   - Updates booking with `razorpayOrderId`
   - Returns payment options for client-side integration

3. **Complete Payment:** User completes payment on Razorpay checkout

4. **Verify Payment:** `POST /api/stylist-booking/payment/verify`
   - Razorpay redirects to this endpoint with payment details
   - Verifies payment signature
   - Updates booking status to `confirmed`
   - Updates payment status to `completed`
   - Sends notifications to user and stylist

### Flow 2: Create and Pay in One Step
1. **Create and Pay:** `POST /api/stylist-booking/create-and-pay`
   - Creates booking
   - Immediately creates Razorpay order
   - Returns payment options

2. **Complete Payment:** User completes payment on Razorpay checkout

3. **Verify Payment:** `POST /api/stylist-booking/payment/verify`
   - Same verification process as Flow 1

---

## Client-Side Integration

### Using Razorpay Checkout

```javascript
// After receiving paymentOptions from the API
const options = {
  key: paymentOptions.key,
  amount: paymentOptions.amount,
  currency: paymentOptions.currency,
  name: paymentOptions.name,
  description: paymentOptions.description,
  order_id: paymentOptions.order_id,
  prefill: paymentOptions.prefill,
  handler: function (response) {
    // Send payment verification to backend
    fetch('/api/stylist-booking/payment/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Payment successful, booking confirmed
        console.log('Booking confirmed!', data.data);
        // Redirect to booking confirmation page
      } else {
        // Payment verification failed
        console.error('Payment verification failed:', data.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
  },
  modal: {
    ondismiss: function() {
      // User closed the payment modal
      console.log('Payment cancelled');
    }
  }
};

const razorpay = new Razorpay(options);
razorpay.open();
```

---

## Booking Status Flow

1. **Pending** → Booking created, payment not initiated
2. **Processing** → Payment order created, awaiting payment
3. **Confirmed** → Payment completed, booking confirmed
4. **In Progress** → Video call started
5. **Completed** → Session finished
6. **Cancelled** → Booking cancelled (refund processed if payment was completed)

---

## Payment Status Flow

1. **Pending** → No payment initiated
2. **Processing** → Razorpay order created, payment in progress
3. **Completed** → Payment successful, booking confirmed
4. **Failed** → Payment failed
5. **Refunded** → Payment refunded (on cancellation)

---

## Error Handling

### Common Error Responses

**Invalid Booking ID:**
```json
{
  "success": false,
  "message": "Invalid booking ID format"
}
```

**Booking Not Found:**
```json
{
  "success": false,
  "message": "Booking not found"
}
```

**Access Denied:**
```json
{
  "success": false,
  "message": "Access denied. This booking does not belong to you."
}
```

**Payment Already Completed:**
```json
{
  "success": false,
  "message": "Payment already completed for this booking"
}
```

**Invalid Payment Signature:**
```json
{
  "success": false,
  "message": "Invalid payment signature. Payment verification failed."
}
```

---

## Notifications

Upon successful payment verification, the system automatically:
1. Sends notification to the user confirming the booking
2. Sends notification to the stylist about the new booking
3. Updates booking status to `confirmed`
4. Records payment completion timestamp

---

## Environment Variables Required

Make sure these are set in your `.env` file:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=... (optional, for webhook verification)
```

---


## Testing

### Test Payment Flow

1. Create a booking or use the create-and-pay endpoint
2. Use Razorpay test credentials:
   - Card: `4111 1111 1111 1111`
   - CVV: Any 3 digits
   - Expiry: Any future date
   - Name: Any name

3. Complete payment and verify booking confirmation

---

## Notes

- All payment amounts are in **INR (Indian Rupees)**
- Razorpay amounts are in **paise** (multiply by 100)
- Payment orders expire after **30 minutes** (1800 seconds)
- Bookings are only confirmed after successful payment verification
- The system verifies payment signatures to prevent fraud
- Both user and stylist receive notifications upon booking confirmation


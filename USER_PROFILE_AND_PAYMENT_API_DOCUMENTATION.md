# User Profile and Payment History API Documentation

This document describes the endpoints for managing user profiles and retrieving payment histories for both regular users and stylists.

## Base URL

- **Development**: `http://localhost:5000`
- **Production**: `https://your-production-url.com`

All endpoints are prefixed with `/user`.

---

## 1. Get User Profile

**Endpoint**: `GET /user/profile/:userId`  
**Authentication**: Not required (Public endpoint)  
**Description**: Retrieves user profile information including stylist profile if the user is a stylist.

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String/ObjectId | Yes | User ID |

### Response (200 OK)

```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "displayName": "John Doe",
      "email": "john.doe@example.com",
      "phoneNumber": "+919876543210",
      "role": "User",
      "is_creator": false,
      "address": [
        {
          "nick_name": "Home",
          "city": "Mumbai",
          "pincode": 400001,
          "state": "Maharashtra",
          "street_details": "123 Main Street"
        }
      ],
      "recentlyViewedProducts": [],
      "createdAt": "2024-01-01T10:00:00.000Z",
      "lastLoggedIn": "2024-01-15T14:30:00.000Z"
    },
    "stylistProfile": {
      "_id": "507f1f77bcf86cd799439012",
      "stylistName": "Sarah's Fashion Studio",
      "stylistImage": "https://example.com/image.jpg",
      "stylistEmail": "sarah@example.com",
      "stylistPhone": "+919876543211",
      "stylistBio": "Professional stylist",
      "isApproved": true,
      "approvalStatus": "approved"
    }
  }
}
```

**Note**: `stylistProfile` will be `null` if the user is not a stylist.

### Error Responses

**400 Bad Request** - Invalid userId format
```json
{
  "success": false,
  "message": "Invalid userId format"
}
```

**404 Not Found** - User not found
```json
{
  "success": false,
  "message": "User not found"
}
```

### cURL Example

```bash
curl -X GET "http://localhost:5000/user/profile/507f1f77bcf86cd799439011"
```

---

## 2. Update User Profile

**Endpoint**: `PUT /user/profile/:userId`  
**Authentication**: Not required (Public endpoint)  
**Description**: Updates user profile information. Validates email and phone number uniqueness.

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String/ObjectId | Yes | User ID |

### Request Body

```json
{
  "displayName": "John Doe Updated",
  "email": "john.updated@example.com",
  "phoneNumber": "+919876543210",
  "address": [
    {
      "nick_name": "Home",
      "city": "Mumbai",
      "pincode": 400001,
      "state": "Maharashtra",
      "street_details": "123 Main Street"
    },
    {
      "nick_name": "Office",
      "city": "Mumbai",
      "pincode": 400002,
      "state": "Maharashtra",
      "street_details": "456 Business Park"
    }
  ]
}
```

### Request Fields

All fields are optional. Only provided fields will be updated:

- `displayName` (String): User's display name
- `email` (String): User's email (validated for uniqueness)
- `phoneNumber` (String): User's phone number (validated for uniqueness)
- `address` (Array/Object): User's address(es)
  - If array: Replaces entire address array
  - If object: Adds new address to existing array

### Response (200 OK)

```json
{
  "success": true,
  "message": "User profile updated successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "displayName": "John Doe Updated",
      "email": "john.updated@example.com",
      "phoneNumber": "+919876543210",
      "role": "User",
      "is_creator": false,
      "address": [
        {
          "nick_name": "Home",
          "city": "Mumbai",
          "pincode": 400001,
          "state": "Maharashtra",
          "street_details": "123 Main Street"
        }
      ],
      "recentlyViewedProducts": [],
      "createdAt": "2024-01-01T10:00:00.000Z",
      "lastLoggedIn": "2024-01-15T14:30:00.000Z"
    }
  }
}
```

### Error Responses

**400 Bad Request** - Email or phone already taken
```json
{
  "success": false,
  "message": "Email is already taken by another user"
}
```

**404 Not Found** - User not found
```json
{
  "success": false,
  "message": "User not found"
}
```

### cURL Example

```bash
curl -X PUT "http://localhost:5000/user/profile/507f1f77bcf86cd799439011" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "John Doe Updated",
    "email": "john.updated@example.com",
    "phoneNumber": "+919876543210"
  }'
```

---

## 3. Get Payment History

**Endpoint**: `GET /user/payment-history/:userId`  
**Authentication**: Not required (Public endpoint)  
**Description**: Retrieves payment history for both regular users and stylists. Includes booking payments and order payments.

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String/ObjectId | Yes | User ID |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | `1` | Page number for pagination |
| `limit` | Number | No | `20` | Number of results per page (max: 100) |
| `paymentType` | String | No | `'all'` | Filter by payment type: `'all'`, `'booking'`, or `'order'` |

### Payment Types

- `all` - Returns both booking and order payments (default)
- `booking` - Returns only stylist booking payments
- `order` - Returns only order/product payments

### Response (200 OK)

```json
{
  "success": true,
  "message": "Payment history retrieved successfully",
  "data": {
    "payments": [
      {
        "paymentId": "507f1f77bcf86cd799439011",
        "transactionId": "pay_DEF456UVW",
        "type": "booking",
        "amount": 2000,
        "currency": "INR",
        "paymentMethod": "razorpay",
        "paymentStatus": "completed",
        "status": "confirmed",
        "description": "Booking: Hair Styling Consultation",
        "bookingDetails": {
          "bookingId": "507f1f77bcf86cd799439011",
          "bookingIdString": "BOOK_1703123456789_abc123def",
          "bookingTitle": "Hair Styling Consultation",
          "bookingType": "consultation",
          "scheduledDate": "2024-01-15T00:00:00.000Z",
          "scheduledTime": "14:00",
          "duration": 60
        },
        "participant": {
          "_id": "507f1f77bcf86cd799439012",
          "stylistName": "Sarah's Fashion Studio",
          "stylistEmail": "sarah@example.com",
          "stylistPhone": "+919876543211"
        },
        "createdAt": "2024-01-10T10:30:00.000Z",
        "completedAt": "2024-01-10T10:30:00.000Z"
      },
      {
        "paymentId": "507f1f77bcf86cd799439013",
        "transactionId": "TXN123456789",
        "type": "order",
        "amount": 5000,
        "currency": "INR",
        "paymentMethod": "razorpay",
        "paymentStatus": "Completed",
        "status": "completed",
        "description": "Order payment: ORD123456",
        "orderDetails": {
          "orderId": "ORD123456",
          "paymentReferenceId": "REF123456",
          "cartId": "507f1f77bcf86cd799439014",
          "totalAmount": 5000
        },
        "customerDetails": {
          "name": "John Doe",
          "email": "john.doe@example.com",
          "phone": "+919876543210"
        },
        "createdAt": "2024-01-05T10:00:00.000Z",
        "completedAt": "2024-01-05T10:05:00.000Z"
      }
    ],
    "summary": {
      "totalPayments": 15,
      "totalBookings": 8,
      "totalOrders": 7,
      "totalAmount": 45000
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalPayments": 15,
      "limit": 20,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Payment Object Structure

#### Booking Payment
- `type`: `"booking"`
- `bookingDetails`: Contains booking information
- `participant`: The other party (stylist if user, user if stylist)

#### Order Payment
- `type`: `"order"`
- `orderDetails`: Contains order information
- `customerDetails`: Customer information

### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "success": false,
  "message": "Invalid userId format"
}
```

**404 Not Found** - User not found
```json
{
  "success": false,
  "message": "User not found"
}
```

### cURL Examples

#### Get All Payments
```bash
curl -X GET "http://localhost:5000/user/payment-history/507f1f77bcf86cd799439011"
```

#### Get Only Booking Payments
```bash
curl -X GET "http://localhost:5000/user/payment-history/507f1f77bcf86cd799439011?paymentType=booking"
```

#### Get Only Order Payments
```bash
curl -X GET "http://localhost:5000/user/payment-history/507f1f77bcf86cd799439011?paymentType=order"
```

#### With Pagination
```bash
curl -X GET "http://localhost:5000/user/payment-history/507f1f77bcf86cd799439011?page=1&limit=10"
```

---

## Usage Examples

### Get User Profile

```javascript
const getUserProfile = async (userId) => {
  const response = await fetch(`/user/profile/${userId}`);
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

### Update User Profile

```javascript
const updateUserProfile = async (userId, profileData) => {
  const response = await fetch(`/user/profile/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
};

// Usage
await updateUserProfile('507f1f77bcf86cd799439011', {
  displayName: 'John Doe Updated',
  email: 'john.updated@example.com'
});
```

### Get Payment History

```javascript
const getPaymentHistory = async (userId, filters = {}) => {
  const { page = 1, limit = 20, paymentType = 'all' } = filters;
  
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    paymentType
  });
  
  const response = await fetch(`/user/payment-history/${userId}?${params.toString()}`);
  const data = await response.json();
  
  if (data.success) {
    return data.data;
  } else {
    throw new Error(data.message);
  }
};

// Usage
const history = await getPaymentHistory('507f1f77bcf86cd799439011', {
  paymentType: 'booking',
  page: 1,
  limit: 10
});
```

---

## Important Notes

### 1. User Profile Endpoints
- Both endpoints work for all user roles (User, Stylist, Admin, Designer)
- Stylist profile information is included if the user is a stylist
- Password and Firebase UID are excluded from responses

### 2. Profile Update Validation
- Email uniqueness is validated (cannot use email already taken by another user)
- Phone number uniqueness is validated (cannot use phone already taken by another user)
- Only provided fields are updated (partial updates supported)

### 3. Payment History
- **For Regular Users**: Returns their booking payments (as customer) and order payments
- **For Stylists**: Returns their booking payments (as stylist) and order payments
- Only completed payments are included in booking payments
- Payments are sorted by completion date (most recent first)
- Combines both booking and order payments in a single response

### 4. Payment Types
- **Booking Payments**: From stylist bookings (StylistBooking model)
- **Order Payments**: From product orders (PaymentDetails model)

### 5. Pagination
- Default page size: 20
- Maximum page size: 100
- Page numbers start at 1

---

## Flutter/Dart Implementation Examples

### Get User Profile

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> getUserProfile(String userId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/user/profile/$userId')
  );
  
  final data = jsonDecode(response.body);
  
  if (data['success'] == true) {
    return data['data'];
  } else {
    throw Exception(data['message']);
  }
}
```

### Update User Profile

```dart
Future<Map<String, dynamic>> updateUserProfile(
  String userId,
  Map<String, dynamic> profileData
) async {
  final response = await http.put(
    Uri.parse('$baseUrl/user/profile/$userId'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode(profileData)
  );
  
  final data = jsonDecode(response.body);
  
  if (data['success'] == true) {
    return data['data'];
  } else {
    throw Exception(data['message']);
  }
}
```

### Get Payment History

```dart
Future<Map<String, dynamic>> getPaymentHistory(
  String userId, {
  int page = 1,
  int limit = 20,
  String paymentType = 'all',
}) async {
  final uri = Uri.parse('$baseUrl/user/payment-history/$userId')
      .replace(queryParameters: {
    'page': page.toString(),
    'limit': limit.toString(),
    'paymentType': paymentType,
  });
  
  final response = await http.get(uri);
  final data = jsonDecode(response.body);
  
  if (data['success'] == true) {
    return data['data'];
  } else {
    throw Exception(data['message']);
  }
}
```

---

## Summary

### Endpoints Created

1. **GET /user/profile/:userId** - Get user profile
   - Returns user information
   - Includes stylist profile if user is a stylist
   - Excludes sensitive information (password, Firebase UID)

2. **PUT /user/profile/:userId** - Update user profile
   - Supports partial updates
   - Validates email and phone uniqueness
   - Updates display name, email, phone, and address

3. **GET /user/payment-history/:userId** - Get payment history
   - Works for both users and stylists
   - Combines booking and order payments
   - Supports filtering by payment type
   - Includes pagination and summary statistics

All endpoints are ready to use and fully documented!

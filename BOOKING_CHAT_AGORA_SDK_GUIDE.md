# Booking Chat Implementation with Agora Chat SDK (RTM)

**Client integration (endpoints, `connection` object, participant rules):** see **`AGORA_VIDEO_CHAT_CLIENT_INTEGRATION.md`**.

This guide explains how chat functionality is implemented using Agora Chat SDK (RTM - Real-Time Messaging) for booking sessions.

## Overview

Chat functionality for booking sessions is implemented using **Agora Chat SDK (RTM)**. The backend provides RTM tokens and configuration, while actual messaging happens client-side through Agora's infrastructure.

### Key Points:
- ✅ Messages are sent/received through Agora's RTM infrastructure (client-side)
- ✅ Backend only provides RTM tokens and channel configuration
- ✅ No message storage in database - all handled by Agora
- ✅ Real-time messaging with low latency
- ✅ Chat available only for active bookings (confirmed/in_progress)
- ✅ **Same RTM token can be used for both video session and chat** (no need for separate tokens)

---

## API Endpoints

### 1. Get RTM Configuration for Booking Chat

**Endpoint**: `POST /booking-chat/booking/:bookingId/rtm-config`  
**Description**: Returns Agora RTM tokens and channel configuration for chat

#### Request Headers
```
Content-Type: application/json
```

#### Request Body
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "role": "user"
}
```

#### Required Fields
- `userId` (String/ObjectId): User ID
- `role` (String): Role - "user" or "stylist"

#### Response (200 OK)
```json
{
  "success": true,
  "message": "RTM configuration retrieved successfully",
  "data": {
    "appId": "316bc1b489614e9da4b83b5d62dbbe00",
    "rtmToken": "006316bc1b489614e9da4b83b5d62dbbe00IAAqmblDPXHILkTtAsXPkJ9nPKpovCKMH+7hC75Fgh46T2nHSxUAAAAAEACQeVP4P8dkaQEA6AMg0Fpp",
    "rtmUid": "user_507f1f77bcf86cd799439011",
    "channelName": "session_BOOK_1767524375389_9qa7l65qy",
    "expiresAt": 1767559200,
    "expiresIn": 3600,
    "booking": {
      "bookingId": "507f1f77bcf86cd799439011",
      "bookingIdString": "BOOK_1767524375389_9qa7l65qy",
      "status": "confirmed",
      "paymentStatus": "completed",
      "scheduledDate": "2024-01-15T00:00:00.000Z",
      "scheduledTime": "14:00"
    }
  }
}
```

#### cURL Example
```bash
curl -X POST http://localhost:5000/booking-chat/booking/507f1f77bcf86cd799439011/rtm-config \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "role": "user"
  }'
```

---

### 2. Get User's Active Booking Chats

**Endpoint**: `GET /booking-chat/user/:userId/chats`  
**Description**: Returns list of active bookings with chat access

#### Query Parameters
- `page` (Number, optional): Page number (default: 1)
- `limit` (Number, optional): Results per page (default: 20, max: 50)
- `status` (String, optional): Filter by status - "confirmed" or "in_progress"

#### Response (200 OK)
```json
{
  "success": true,
  "message": "User chats retrieved successfully",
  "data": {
    "chats": [
      {
        "bookingId": "507f1f77bcf86cd799439011",
        "bookingIdString": "BOOK_1767524375389_9qa7l65qy",
        "channelName": "session_BOOK_1767524375389_9qa7l65qy",
        "participant": {
          "_id": "507f1f77bcf86cd799439012",
          "stylistName": "Sarah's Fashion Studio",
          "stylistImage": "https://...",
          "stylistEmail": "sarah@example.com"
        },
        "booking": {
          "bookingTitle": "Hair Styling Consultation",
          "bookingType": "consultation",
          "scheduledDate": "2024-01-15T00:00:00.000Z",
          "scheduledTime": "14:00",
          "duration": 60,
          "status": "confirmed",
          "paymentStatus": "completed"
        },
        "createdAt": "2024-01-10T10:00:00.000Z",
        "updatedAt": "2024-01-10T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalBookings": 1,
      "limit": 20,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### cURL Example
```bash
curl -X GET "http://localhost:5000/booking-chat/user/507f1f77bcf86cd799439011/chats?page=1&limit=20&status=confirmed"
```

---

### 3. Refresh RTM Token

**Endpoint**: `POST /booking-chat/booking/:bookingId/refresh-rtm-token`  
**Description**: Refreshes RTM token when current one is about to expire

#### Request Body
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "role": "user"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "RTM token refreshed successfully",
  "data": {
    "rtmToken": "006316bc1b489614e9da4b83b5d62dbbe00IAAqmblDPXHILkTtAsXPkJ9nPKpovCKMH+7hC75Fgh46T2nHSxUAAAAAEACQeVP4P8dkaQEA6AMg0Fpp",
    "rtmUid": "user_507f1f77bcf86cd799439011",
    "expiresAt": 1767559200,
    "expiresIn": 3600
  }
}
```

---

## Client-Side Implementation

### Flutter/Dart Implementation

```dart
import 'package:agora_rtm/agora_rtm.dart';

class BookingChatService {
  AgoraRtmClient? _client;
  AgoraRtmChannel? _channel;
  String? _channelName;
  String? _rtmToken;
  String? _rtmUid;

  // Initialize Agora RTM
  Future<void> initializeRTM(String appId) async {
    _client = await AgoraRtmClient.createInstance(appId);
  }

  // Get RTM configuration from backend
  Future<Map<String, dynamic>> getRtmConfig(String bookingId, String userId, String role) async {
    final response = await http.post(
      Uri.parse('$baseUrl/booking-chat/booking/$bookingId/rtm-config'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'userId': userId,
        'role': role,
      }),
    );

    final data = jsonDecode(response.body);
    if (data['success']) {
      return data['data'];
    }
    throw Exception('Failed to get RTM config: ${data['message']}');
  }

  // Login to RTM
  Future<void> login(String rtmToken, String rtmUid) async {
    if (_client == null) {
      throw Exception('RTM client not initialized');
    }
    await _client!.login(rtmToken, rtmUid);
    _rtmToken = rtmToken;
    _rtmUid = rtmUid;
  }

  // Join chat channel
  Future<void> joinChannel(String channelName) async {
    if (_client == null) {
      throw Exception('RTM client not initialized');
    }

    _channel = await _client!.createChannel(channelName);
    
    // Set up channel event handlers
    _channel!.onMemberJoined = (AgoraRtmMember member) {
      print('Member joined: ${member.userId}');
    };

    _channel!.onMemberLeft = (AgoraRtmMember member) {
      print('Member left: ${member.userId}');
    };

    _channel!.onMessageReceived = (AgoraRtmMessage message, AgoraRtmMember member) {
      print('Message received: ${message.text} from ${member.userId}');
      // Handle received message
    };

    await _channel!.join();
    _channelName = channelName;
  }

  // Send message
  Future<void> sendMessage(String text) async {
    if (_channel == null) {
      throw Exception('Not in a channel');
    }

    final message = AgoraRtmMessage.fromText(text);
    await _channel!.sendMessage(message);
  }

  // Leave channel
  Future<void> leaveChannel() async {
    if (_channel != null) {
      await _channel!.leave();
      _channel = null;
    }
  }

  // Logout
  Future<void> logout() async {
    if (_client != null) {
      await _client!.logout();
      await _client!.destroy();
      _client = null;
    }
  }
}
```

---

### JavaScript/Web Implementation

```javascript
import AgoraRTM from 'agora-rtm-sdk';

class BookingChatService {
  constructor() {
    this.client = null;
    this.channel = null;
    this.channelName = null;
    this.rtmToken = null;
    this.rtmUid = null;
  }

  // Initialize Agora RTM
  async initializeRTM(appId) {
    this.client = AgoraRTM.createInstance(appId);
  }

  // Get RTM configuration from backend
  async getRtmConfig(bookingId, userId, role) {
    const response = await fetch(`${baseUrl}/booking-chat/booking/${bookingId}/rtm-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        role
      })
    });

    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    throw new Error(`Failed to get RTM config: ${data.message}`);
  }

  // Login to RTM
  async login(rtmToken, rtmUid) {
    if (!this.client) {
      throw new Error('RTM client not initialized');
    }
    await this.client.login({ token: rtmToken, uid: rtmUid });
    this.rtmToken = rtmToken;
    this.rtmUid = rtmUid;
  }

  // Join chat channel
  async joinChannel(channelName) {
    if (!this.client) {
      throw new Error('RTM client not initialized');
    }

    this.channel = this.client.createChannel(channelName);

    // Set up channel event handlers
    this.channel.on('MemberJoined', (memberId) => {
      console.log('Member joined:', memberId);
    });

    this.channel.on('MemberLeft', (memberId) => {
      console.log('Member left:', memberId);
    });

    this.channel.on('ChannelMessage', (message, memberId) => {
      console.log('Message received:', message.text, 'from:', memberId);
      // Handle received message
    });

    await this.channel.join();
    this.channelName = channelName;
  }

  // Send message
  async sendMessage(text) {
    if (!this.channel) {
      throw new Error('Not in a channel');
    }

    const message = this.client.createMessage({ text, messageType: 'TEXT' });
    await this.channel.sendMessage(message);
  }

  // Leave channel
  async leaveChannel() {
    if (this.channel) {
      await this.channel.leave();
      this.channel = null;
    }
  }

  // Logout
  async logout() {
    if (this.client) {
      await this.client.logout();
      this.client = null;
    }
  }
}
```

---

## Complete Flow Example

### 1. User wants to chat with stylist for a booking

```javascript
// Step 1: Get RTM configuration
const chatService = new BookingChatService();
await chatService.initializeRTM('your_agora_app_id');

const config = await chatService.getRtmConfig(bookingId, userId, 'user');

// Step 2: Login to RTM
await chatService.login(config.rtmToken, config.rtmUid);

// Step 3: Join channel
await chatService.joinChannel(config.channelName);

// Step 4: Send messages
await chatService.sendMessage('Hello stylist!');

// Step 5: Listen for messages (handled in event handlers)

// Step 6: When done, leave and logout
await chatService.leaveChannel();
await chatService.logout();
```

---

## Important Notes

### 1. Channel Name
- Channel name is the same as video channel: `session_BOOK_{bookingId}`
- Both user and stylist join the same channel for chat

### 2. RTM UID Format
- User: `user_{userId}`
- Stylist: `stylist_{userId}` (where userId is the stylist's user ID)

### 3. Token Expiration
- RTM tokens expire based on booking's scheduled end time
- Refresh tokens before expiration using `/refresh-rtm-token` endpoint

### 4. Chat Availability
- Chat is only available for bookings with status: `confirmed` or `in_progress`
- Chat access is validated on the backend

### 5. Message Storage
- Messages are **NOT stored** in the database
- All messages are handled through Agora's RTM infrastructure
- For message history, you may need to implement client-side storage or use Agora's message history API (if available)

### 6. Security
- RTM tokens are validated on the backend
- Only authorized users (user or stylist of the booking) can get RTM tokens
- Channel names are unique per booking

---

## Integration with Video Session

### Using Same RTM Token for Video and Chat

**Important**: You **DO NOT need separate RTM tokens** for video and chat. The same RTM token can be used for both!

The `joinSession` endpoint (`POST /booking-video/bookings/:bookingId/join-session`) already provides RTM tokens along with RTC tokens. You can use the same RTM token for chat:

```javascript
// Get video + chat tokens together from joinSession endpoint
const session = await fetch(`/booking-video/bookings/${bookingId}/join-session`, {
  method: 'POST',
  body: JSON.stringify({ userId, role: 'user' })
});

const { rtcToken, rtmToken, channelName, rtcUid, rtmUid, appId } = session.data.data;

// Use rtcToken for video calls
await videoClient.join(channelName, rtcToken, rtcUid);

// Use the SAME rtmToken for chat (no need for separate token!)
await rtmClient.login(rtmToken, rtmUid);
await rtmChannel.join(channelName);

// Use the same channelName for both video and chat
```

### When to Use `/rtm-config` Endpoint

The `/booking-chat/booking/:bookingId/rtm-config` endpoint is useful when:
- You only need chat (not video) for a booking
- You want to get chat configuration separately
- You need to refresh tokens without joining the video session

But for most cases, **use the RTM token from `/join-session` endpoint** - it's more efficient!

---

## Error Handling

### Common Errors

**400 Bad Request** - Invalid booking or user
```json
{
  "success": false,
  "message": "Chat is only available for confirmed or active bookings"
}
```

**403 Forbidden** - Unauthorized access
```json
{
  "success": false,
  "message": "Unauthorized: You don't have access to this booking chat"
}
```

**404 Not Found** - Booking not found
```json
{
  "success": false,
  "message": "Booking not found"
}
```

---

## Environment Variables Required

```env
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

---

## Client SDK Installation

### Flutter
```yaml
dependencies:
  agora_rtm: ^latest_version
```

### JavaScript/Web
```bash
npm install agora-rtm-sdk
```

### React Native
```bash
npm install react-native-agora-rtm
```

---

## Summary

- ✅ Chat uses Agora Chat SDK (RTM) for real-time messaging
- ✅ Backend provides RTM tokens and configuration only
- ✅ All messaging happens client-side through Agora's infrastructure
- ✅ No database message storage required
- ✅ Low latency, real-time messaging
- ✅ Secure token-based authentication
- ✅ Chat available only for active bookings

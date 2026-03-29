# Agora Video Call & Chat Integration Guide

> Hand this file to the mobile developer to integrate video sessions and in-booking chat into the Flutter app.

---

## Overview

- **Video call** uses Agora RTC (Real-Time Communication)
- **In-session chat** uses Agora RTM (Real-Time Messaging)
- Both use the **same channel name** — one API call (`join-session`) gives you tokens for both
- Sessions are **tied to a booking** — no booking = no session
- Tokens expire when the booking session ends (minimum 1 hour TTL)

### Prerequisites for a session to start
| Condition | Value |
|-----------|-------|
| `booking.status` | `confirmed` or `in_progress` |
| `booking.paymentStatus` | `completed` or `test` |
| Caller | Must be the booking's client OR the stylist |

---

## Environment Setup

Add to `.env` on the backend (already configured):
```
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

Add to Flutter `pubspec.yaml`:
```yaml
dependencies:
  agora_rtc_engine: ^6.x.x    # video call
  agora_rtm: ^1.x.x            # chat / messaging
```

---

## API Endpoints

### 1. Join Session (Video + Chat)

**POST** `/bookings/:bookingId/join-session`

Call this when either the client or the stylist taps "Join Session". Returns tokens for both video and chat.

**Request body:**
```json
{
  "userId": "<User._id from login>",
  "role": "user"
}
```

| Field | Values | Notes |
|-------|--------|-------|
| `userId` | User `_id` string | The logged-in user's `_id` |
| `role` | `"user"` or `"stylist"` | Must match who is calling |

**Success response (200):**
```json
{
  "success": true,
  "message": "Session joined.",
  "data": {
    "bookingIdString": "BOOK_1234567890_abc123",
    "appId": "agora_app_id",
    "channelName": "session_BOOK_1234567890_abc123",
    "rtcToken": "<RTC token for video>",
    "rtmToken": "<RTM token for chat>",
    "rtcUid": 1234567890,
    "rtmUid": "user_<userId>",
    "expiresAt": 1234567890,
    "expiresIn": 7200,
    "connection": {
      "sameChannelForVideoAndChat": true,
      "channelName": "session_BOOK_...",
      "video": {
        "appId": "...",
        "channelName": "session_BOOK_...",
        "token": "<rtcToken>",
        "uid": 1234567890
      },
      "chat": {
        "appId": "...",
        "channelName": "session_BOOK_...",
        "token": "<rtmToken>",
        "uid": "user_<userId>"
      }
    }
  }
}
```

> **Note:** `bookingId` in the URL is the MongoDB `_id` (e.g. `68abc123...`), NOT the `bookingIdString` (`BOOK_...`).

---

### 2. End Session (Stylist / Admin only)

**POST** `/bookings/:bookingId/end-session`

Call this when the stylist ends the session early. Auth required — only stylist or admin can call this.

**Headers:**
```
Authorization: Bearer <JWT token>
```

**Request body:** _(none)_

**Success response (200):**
```json
{
  "success": true,
  "message": "Session ended successfully"
}
```

After this call, `booking.status` becomes `completed`.

---

### 3. Session Status (Polling)

**GET** `/bookings/:bookingId/session-status`

Use this to poll whether a session is currently live, and when it starts/ends.

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "status": "in_progress",
    "bookingStatus": "in_progress",
    "now": "2026-03-29T10:00:00.000Z",
    "start": "2026-03-29T10:00:00.000Z",
    "end": "2026-03-29T11:30:00.000Z",
    "isLive": true
  }
}
```

| `status` values | Meaning |
|-----------------|---------|
| `not_started` | Session hasn't begun yet |
| `in_progress` | Live right now |
| `ended` | Ended by stylist or admin |

---

### 4. Get RTM Config (Chat only, without video)

**POST** `/booking-chat/booking/:bookingId/rtm-config`

Use this if you only want to open the chat panel (without the video call). Returns the same channel tokens.

**Request body:**
```json
{
  "userId": "<User._id>",
  "role": "user"
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "...",
    "rtmToken": "...",
    "rtmUid": "user_<userId>",
    "channelName": "session_BOOK_...",
    "rtcToken": "...",
    "rtcUid": 1234567890,
    "expiresAt": 1234567890,
    "expiresIn": 7200,
    "connection": { ... },
    "booking": {
      "bookingId": "<mongo _id>",
      "bookingIdString": "BOOK_...",
      "status": "confirmed",
      "paymentStatus": "completed",
      "scheduledDate": "2026-03-29T...",
      "scheduledTime": "10:00"
    }
  }
}
```

---

### 5. Refresh RTM Token

**POST** `/booking-chat/booking/:bookingId/refresh-rtm-token`

Call this before the token expires to get a fresh one (check `expiresIn` field).

**Request body:**
```json
{
  "userId": "<User._id>",
  "role": "user"
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "...",
    "channelName": "session_BOOK_...",
    "rtmToken": "<new token>",
    "rtmUid": "user_<userId>",
    "rtcToken": "<new token>",
    "rtcUid": 1234567890,
    "expiresAt": 1234567890,
    "expiresIn": 7200,
    "connection": { ... }
  }
}
```

---

### 6. Get User's Chat List

**GET** `/booking-chat/user/:userId/chats?page=1&limit=20`

Returns all active bookings (confirmed or in_progress) for the user, with their channel info.

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "bookingId": "<mongo _id>",
        "bookingIdString": "BOOK_...",
        "channelName": "session_BOOK_...",
        "participant": {
          "_id": "...",
          "displayName": "Priya Sharma",
          "stylistImage": "https://..."
        },
        "booking": {
          "bookingTitle": "Bridal Consultation",
          "bookingType": "consultation",
          "scheduledDate": "2026-03-29T...",
          "scheduledTime": "10:00",
          "duration": 60,
          "status": "confirmed",
          "paymentStatus": "completed"
        },
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalBookings": 15,
      "limit": 20,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## Flutter Integration

### Step 1 — Join Session and Store Tokens

```dart
class SessionService {
  static const String baseUrl = 'https://your-api.com';

  static Future<SessionTokens?> joinSession({
    required String bookingMongoId,  // MongoDB _id, NOT bookingIdString
    required String userId,
    required String role,             // "user" or "stylist"
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/bookings/$bookingMongoId/join-session'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'userId': userId, 'role': role}),
    );

    final data = jsonDecode(res.body);
    if (res.statusCode == 200 && data['success'] == true) {
      return SessionTokens.fromJson(data['data']);
    }
    throw Exception(data['message'] ?? 'Failed to join session');
  }
}

class SessionTokens {
  final String appId;
  final String channelName;
  final String rtcToken;
  final String rtmToken;
  final int rtcUid;
  final String rtmUid;
  final int expiresAt;

  SessionTokens.fromJson(Map<String, dynamic> json)
      : appId = json['appId'],
        channelName = json['channelName'],
        rtcToken = json['rtcToken'],
        rtmToken = json['rtmToken'],
        rtcUid = json['rtcUid'],
        rtmUid = json['rtmUid'],
        expiresAt = json['expiresAt'];
}
```

---

### Step 2 — Video Call Screen (Agora RTC)

```dart
import 'package:agora_rtc_engine/agora_rtc_engine.dart';

class VideoCallScreen extends StatefulWidget {
  final SessionTokens tokens;
  final String bookingMongoId;
  final String userId;

  const VideoCallScreen({
    required this.tokens,
    required this.bookingMongoId,
    required this.userId,
  });

  @override
  State<VideoCallScreen> createState() => _VideoCallScreenState();
}

class _VideoCallScreenState extends State<VideoCallScreen> {
  late RtcEngine _engine;
  bool _joined = false;
  bool _isMuted = false;
  bool _isCameraOff = false;
  final List<int> _remoteUids = [];

  @override
  void initState() {
    super.initState();
    _initAgora();
  }

  Future<void> _initAgora() async {
    _engine = createAgoraRtcEngine();

    await _engine.initialize(RtcEngineContext(
      appId: widget.tokens.appId,
      channelProfile: ChannelProfileType.channelProfileCommunication,
    ));

    _engine.registerEventHandler(RtcEngineEventHandler(
      onJoinChannelSuccess: (connection, elapsed) {
        setState(() => _joined = true);
      },
      onUserJoined: (connection, remoteUid, elapsed) {
        setState(() => _remoteUids.add(remoteUid));
      },
      onUserOffline: (connection, remoteUid, reason) {
        setState(() => _remoteUids.remove(remoteUid));
      },
    ));

    await _engine.enableVideo();
    await _engine.startPreview();

    await _engine.joinChannel(
      token: widget.tokens.rtcToken,
      channelId: widget.tokens.channelName,
      uid: widget.tokens.rtcUid,
      options: const ChannelMediaOptions(
        clientRoleType: ClientRoleType.clientRoleBroadcaster,
        channelProfile: ChannelProfileType.channelProfileCommunication,
      ),
    );
  }

  @override
  void dispose() {
    _engine.leaveChannel();
    _engine.release();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Remote video (full screen)
          if (_remoteUids.isNotEmpty)
            AgoraVideoView(
              controller: VideoViewController.remote(
                rtcEngine: _engine,
                canvas: VideoCanvas(uid: _remoteUids.first),
                connection: RtcConnection(channelId: widget.tokens.channelName),
              ),
            )
          else
            const Center(child: Text('Waiting for other participant...', style: TextStyle(color: Colors.white))),

          // Local video (picture-in-picture)
          Positioned(
            top: 16,
            right: 16,
            width: 120,
            height: 160,
            child: AgoraVideoView(
              controller: VideoViewController(
                rtcEngine: _engine,
                canvas: const VideoCanvas(uid: 0),
              ),
            ),
          ),

          // Controls
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Mute toggle
                IconButton(
                  icon: Icon(_isMuted ? Icons.mic_off : Icons.mic, color: Colors.white, size: 32),
                  onPressed: () {
                    _engine.muteLocalAudioStream(!_isMuted);
                    setState(() => _isMuted = !_isMuted);
                  },
                ),
                const SizedBox(width: 24),
                // End call
                IconButton(
                  icon: const Icon(Icons.call_end, color: Colors.red, size: 40),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                const SizedBox(width: 24),
                // Camera toggle
                IconButton(
                  icon: Icon(_isCameraOff ? Icons.videocam_off : Icons.videocam, color: Colors.white, size: 32),
                  onPressed: () {
                    _engine.muteLocalVideoStream(!_isCameraOff);
                    setState(() => _isCameraOff = !_isCameraOff);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

### Step 3 — Chat Screen (Agora RTM)

```dart
import 'package:agora_rtm/agora_rtm.dart';

class BookingChatScreen extends StatefulWidget {
  final SessionTokens tokens;
  final String displayName;

  const BookingChatScreen({required this.tokens, required this.displayName});

  @override
  State<BookingChatScreen> createState() => _BookingChatScreenState();
}

class _BookingChatScreenState extends State<BookingChatScreen> {
  AgoraRtmClient? _client;
  AgoraRtmChannel? _channel;
  final List<ChatMessage> _messages = [];
  final TextEditingController _textCtrl = TextEditingController();
  bool _connected = false;

  @override
  void initState() {
    super.initState();
    _initRtm();
  }

  Future<void> _initRtm() async {
    _client = await AgoraRtmClient.createInstance(widget.tokens.appId);

    _client!.onMessageReceived = (message, peerId) {
      // Direct messages (not used here — use channel)
    };

    _client!.onConnectionStateChanged = (state, reason) {
      if (state == 1) setState(() => _connected = false);
      if (state == 5) setState(() => _connected = true);
    };

    // Login with RTM UID and token
    await _client!.login(widget.tokens.rtmToken, widget.tokens.rtmUid);

    // Join the booking channel
    _channel = await _client!.createChannel(widget.tokens.channelName);

    _channel!.onMessageReceived = (message, member) {
      setState(() {
        _messages.add(ChatMessage(
          senderId: member.userId,
          text: message.text,
          isMe: member.userId == widget.tokens.rtmUid,
          timestamp: DateTime.now(),
        ));
      });
    };

    _channel!.onMemberJoined = (member) {
      // Optional: show "X joined" notification
    };

    await _channel!.join();
    setState(() => _connected = true);
  }

  Future<void> _sendMessage() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty || _channel == null) return;

    final message = AgoraRtmMessage.fromText(text);
    await _channel!.sendMessage(message);

    setState(() {
      _messages.add(ChatMessage(
        senderId: widget.tokens.rtmUid,
        text: text,
        isMe: true,
        timestamp: DateTime.now(),
      ));
    });
    _textCtrl.clear();
  }

  @override
  void dispose() {
    _channel?.leave();
    _channel?.release();
    _client?.logout();
    _client?.release();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Session Chat'),
        actions: [
          Icon(
            _connected ? Icons.circle : Icons.circle_outlined,
            color: _connected ? Colors.green : Colors.grey,
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return Align(
                  alignment: msg.isMe ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: msg.isMe ? Colors.blue[100] : Colors.grey[200],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(msg.text),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Type a message...',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ChatMessage {
  final String senderId;
  final String text;
  final bool isMe;
  final DateTime timestamp;

  ChatMessage({
    required this.senderId,
    required this.text,
    required this.isMe,
    required this.timestamp,
  });
}
```

---

### Step 4 — Launch Session Screen (Entry Point)

```dart
// How to navigate from a booking card to the session

Future<void> launchSession(BuildContext context, Booking booking) async {
  try {
    // Show loading
    showDialog(context: context, builder: (_) => const Center(child: CircularProgressIndicator()));

    final tokens = await SessionService.joinSession(
      bookingMongoId: booking.id,        // MongoDB _id
      userId: AuthService.currentUserId,
      role: AuthService.isStylest ? 'stylist' : 'user',
    );

    Navigator.of(context).pop(); // dismiss loading

    // Navigate to video screen (which includes chat tab)
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => SessionScreen(tokens: tokens!, booking: booking),
    ));
  } catch (e) {
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(e.toString())),
    );
  }
}
```

---

### Step 5 — Token Refresh (Before Expiry)

```dart
// Check and refresh tokens every ~5 minutes
Timer.periodic(const Duration(minutes: 5), (timer) async {
  final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  final timeLeft = tokens.expiresAt - nowSec;

  if (timeLeft < 600) { // less than 10 minutes left
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/booking-chat/booking/${booking.id}/refresh-rtm-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userId': userId, 'role': role}),
      );

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        // Renew tokens in RTC engine
        await _engine.renewToken(data['data']['rtcToken']);
        // Renew token in RTM client
        await _client?.renewToken(data['data']['rtmToken']);
      }
    } catch (e) {
      debugPrint('Token refresh failed: $e');
    }
  }
});
```

---

## Full Session Flow

```
1. Client opens booking details → booking.status == "confirmed"
2. Client taps "Join Session"
   → POST /bookings/:bookingId/join-session  { userId, role: "user" }
   → Get back: appId, channelName, rtcToken, rtmToken, rtcUid, rtmUid
3. App joins Agora RTC channel (video) using rtcToken + rtcUid
4. App joins Agora RTM channel (chat) using rtmToken + rtmUid
   → SAME channelName for both
5. Stylist taps "Join Session" (same call, role: "stylist")
   → booking.videoCallStatus → "in_progress" (set on first join)
6. Session runs (video + chat active on same channel)
7. Stylist ends session manually
   → POST /bookings/:bookingId/end-session
   → booking.status → "completed", booking.videoCallStatus → "ended"
   OR session auto-expires when expiresAt is reached
8. App leaves Agora channels, navigates back
```

---

## Error Reference

| HTTP | Message | Fix |
|------|---------|-----|
| 400 | `userId and role are required` | Add both fields to body |
| 400 | `Invalid role` | Use exactly `"user"` or `"stylist"` |
| 400 | `Payment not completed` | Booking `paymentStatus` must be `completed` or `test` |
| 400 | `Session not active` | Booking `status` must be `confirmed` or `in_progress` |
| 400 | `Booking schedule information is incomplete` | Booking missing `scheduledDate` or `scheduledTime` |
| 403 | `Unauthorized: You are not a participant` | `userId` does not match the booking's client or stylist |
| 404 | `Booking not found` | Wrong `bookingId` — use MongoDB `_id` not `bookingIdString` |
| 500 | `Agora credentials not configured` | Backend missing `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` env vars |

---

## Key Rules

- **`bookingId` in URL = MongoDB `_id`** (looks like `68abc123def456...`), NOT the `BOOK_...` string
- **Same channel for video and chat** — `channelName` is identical for RTC and RTM
- **RTC UID is numeric** (`rtcUid`) — pass as `int` to Agora RTC
- **RTM UID is a string** (`rtmUid`, format: `"user_<userId>"` or `"stylist_<userId>"`) — pass as `String` to Agora RTM
- **Token expiry** = booking end time (minimum 1 hour) — always check `expiresIn` and refresh proactively
- **Only stylist or admin can call `end-session`** — client side should just leave the channel on their end

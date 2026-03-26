# Agora video + chat — client integration guide

This document explains how to use the **booking-video** and **booking-chat** APIs in your app so users get a **live RTC call** and **RTM channel messaging** on the **same Agora channel** for a booking.

**Backend responsibilities:** issue `appId`, `channelName`, RTC token, RTM token, and UIDs.  
**Your app responsibilities:** initialize Agora RTC Engine and Agora RTM SDK, join the **same** `channelName` for both products.

---

## Base URL

| Environment | Example |
|-------------|---------|
| Local | `http://localhost:5000` |
| Production | Your deployed API origin (no `/api` prefix on these routes) |

Routes used below:

- `POST /booking-video/bookings/:bookingId/join-session`
- `GET  /booking-video/bookings/:bookingId/session-status`
- `POST /booking-video/bookings/:bookingId/end-session` (stylist/admin flow; often uses auth middleware)
- `POST /booking-chat/booking/:bookingId/rtm-config`
- `POST /booking-chat/booking/:bookingId/refresh-rtm-token`
- `GET  /booking-chat/user/:userId/chats`

---

## Concepts

| Piece | Purpose |
|-------|---------|
| **RTC** (`rtcToken`, `rtcUid`) | Video and audio (live call). |
| **RTM** (`rtmToken`, `rtmUid`) | Real-time messaging: login, then join an **RTM channel** for text/signaling. |
| **`channelName`** | One string per booking, shared by **both** RTC and RTM. **Must match** for both sides of the session. |

The backend sets `channelName` to `session_<bookingIdString>` where `bookingIdString` is the booking’s human-readable id (e.g. `BOOK_xxx`), not the MongoDB `_id`.

---

## Prerequisites (server-side checks)

Before tokens are returned, the booking must satisfy:

- `paymentStatus` is `completed` or `test`
- `status` is `confirmed` or `in_progress`
- `bookingId` (string), `scheduledDate`, `scheduledTime`, and `duration` must be valid

**Who can join**

- **`role`: `"user"`** — `userId` must be the booking’s **client** (`booking.userId`).
- **`role`: `"stylist"`** — `userId` must be the **stylist’s User id** (the user linked to `StylistProfile`, not the stylist profile `_id`).

Wrong `userId`/`role` combinations return **403**.

---

## Recommended flow: one call for video + chat

### `POST /booking-video/bookings/:bookingId/join-session`

**Path parameter:** `bookingId` — MongoDB `_id` of the booking (24-char hex).

**Body:**

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "role": "user"
}
```

- `userId`: string (ObjectId of the **User**).
- `role`: `"user"` or `"stylist"`.

**Success (200)** — shape you should rely on:

```json
{
  "success": true,
  "message": "Session joined. Use connection.video for RTC (live call) and connection.chat for RTM on the same channel.",
  "data": {
    "appId": "YOUR_AGORA_APP_ID",
    "channelName": "session_BOOK_1767524375389_9qa7l65qy",
    "rtcToken": "...",
    "rtmToken": "...",
    "rtcUid": 175162216,
    "rtmUid": "user_507f1f77bcf86cd799439011",
    "expiresAt": 1767559200,
    "expiresIn": 3600,
    "connection": {
      "sameChannelForVideoAndChat": true,
      "channelName": "session_BOOK_1767524375389_9qa7l65qy",
      "video": {
        "appId": "YOUR_AGORA_APP_ID",
        "channelName": "session_BOOK_1767524375389_9qa7l65qy",
        "token": "...",
        "uid": 175162216
      },
      "chat": {
        "appId": "YOUR_AGORA_APP_ID",
        "channelName": "session_BOOK_1767524375389_9qa7l65qy",
        "token": "...",
        "uid": "user_507f1f77bcf86cd799439011"
      }
    }
  }
}
```

Use either the top-level fields (`rtcToken`, `channelName`, …) or the nested `connection.video` / `connection.chat` — they are the same values.

**Typical client order**

1. **RTC (live call)**  
   - Create/join the channel with `appId`, `channelName`, `rtcToken`, and numeric `rtcUid` (publisher role).  
   - Enable local audio/video and subscribe to remote users per Agora RTC docs.

2. **RTM (chat)**  
   - Create RTM client with `appId`.  
   - **Login** with `rtmToken` and your `rtmUid` (string).  
   - **Join** the RTM channel whose name equals **`channelName`** (same as video).  
   - Send/receive messages on that channel.

Both participants must use the **same** `channelName` and their **own** tokens/UIDs from **their own** `join-session` response.

---

## Optional: chat-only or token refresh

### `POST /booking-chat/booking/:bookingId/rtm-config`

Same body as `join-session` (`userId`, `role`). Returns RTM fields plus **`rtcToken` / `rtcUid`** and the same **`connection`** object so chat and video stay aligned. **Use when** you need chat config without joining the video route first.

Same payment/status and participant rules as join-session.

### `POST /booking-chat/booking/:bookingId/refresh-rtm-token`

Use when `expiresIn` is low or before expiry. Body: `userId`, `role`. Returns new tokens plus `connection` block.

### `GET /booking-chat/user/:userId/chats`

Lists active bookings with `channelName` per booking for inbox UI.

---

## Session lifecycle (optional)

| Endpoint | Method | Notes |
|----------|--------|--------|
| `/booking-video/bookings/:bookingId/session-status` | GET | Poll `videoCallStatus`, window, `isLive`. |
| `/booking-video/bookings/:bookingId/end-session` | POST | Ends session (stylist/admin); ensure your app uses whatever auth the server enforces. |

---

## Common errors

| HTTP | Meaning |
|------|---------|
| 400 | Payment not completed, session not active, invalid schedule/duration, etc. |
| 403 | `userId`/`role` does not match booking participant. |
| 404 | Booking not found. |
| 500 | Token generation failure (often missing Agora env on server). |

---

## Environment (server only)

Your **backend** must set:

```env
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

The app id in API responses is safe to expose to clients.

---

## SDK references

| Platform | RTC | RTM |
|----------|-----|-----|
| Web | `agora-rtc-sdk-ng` | `agora-rtm-sdk` |
| Flutter | `agora_rtc_engine` | `agora_rtm` |
| React Native | `react-native-agora` | `react-native-agora-rtm` |

Follow Agora’s docs for **join channel** (RTC) and **login + join channel** (RTM). The **channel name string** for RTM must match **`channelName`** from this API.

---

## Checklist for your app

1. After payment + confirmed booking, call **`join-session`** with the correct **User** id and **role**.
2. Initialize **RTC** with `rtcToken` and `rtcUid`; join **`channelName`**.
3. Initialize **RTM**; login with `rtmToken` and `rtmUid`; join RTM channel **`channelName`**.
4. Refresh tokens with **`refresh-rtm-token`** (and re-call **`join-session`** if you need new RTC tokens) before expiry.
5. Ensure stylist devices use the **stylist’s user account id**, not the stylist profile document id, when `role` is `"stylist"`.

For booking creation and payment, see `BOOKING_AND_VIDEO_SESSION_GUIDE.md`. This file focuses on **Agora wiring** only.

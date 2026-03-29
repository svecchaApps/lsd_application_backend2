# Indigo Rhapsody — Backend API

Node.js / Express API for e‑commerce, stylist bookings, payments (Razorpay), and **Agora** live video + RTM chat for confirmed sessions.

---

## Requirements

- **Node.js** 18+
- **MongoDB** (connection string in env)
- Optional: **Firebase Admin** (for Firebase ID tokens), **Razorpay** keys, **Agora** app credentials

---

## Quick start

```bash
npm install
# Create .env with MONGODB_URI, JWT_SECRET, AGORA_APP_ID, AGORA_APP_CERTIFICATE, etc.
node index.js
```

Default port: **5000** (or `process.env.PORT`).

Health check: `GET /health`

---

## Environment variables (high level)

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | JWT signing |
| `AGORA_APP_ID` | Agora project (RTC + RTM tokens) |
| `AGORA_APP_CERTIFICATE` | Agora token generation |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments (where used) |
| Firebase / other keys | As required by `src/config` and controllers |

---

## Main feature areas

### 1. Stylist booking & Agora video + chat

- **Booking lifecycle**: create → pay → confirm → join live session.
- **Same channel for everyone**: Agora **RTC** (video/audio) and **RTM** (chat) use one `channelName` per booking: `session_<bookingIdString>` where `bookingIdString` is the human-readable id (e.g. `BOOK_…`), **not** the MongoDB `_id`.
- **Join session (recommended for both client and stylist)**  
  `POST /booking-video/bookings/:bookingId/join-session`  
  - `:bookingId` = **MongoDB booking document `_id`**.  
  - Body: `{ "userId": "<User _id>", "role": "user" | "stylist" }`.  
  - Stylist must send the **User** id linked to `StylistProfile`, not the profile id.  
  - Response includes `rtcToken`, `rtmToken`, `channelName`, `connection.video`, `connection.chat`, and `bookingIdString` for verification.

- **Chat-only / token refresh**  
  `POST /booking-chat/booking/:bookingId/rtm-config`  
  `POST /booking-chat/booking/:bookingId/refresh-rtm-token`

**Detailed client integration (SDK order, errors, checklist):**  
→ [`AGORA_VIDEO_CHAT_CLIENT_INTEGRATION.md`](./AGORA_VIDEO_CHAT_CLIENT_INTEGRATION.md)

**Booking + payment flow:**  
→ [`BOOKING_AND_VIDEO_SESSION_GUIDE.md`](./BOOKING_AND_VIDEO_SESSION_GUIDE.md)

Implementation notes:

- Tokens are generated in [`src/service/agoraService.js`](./src/service/agoraService.js) (`generateBookingSessionTokens`).
- Join handler: [`src/controllers/videoSessionController.js`](./src/controllers/videoSessionController.js).
- `startVideoCall` in [`src/controllers/stylistBookingController.js`](./src/controllers/stylistBookingController.js) uses the **same** token + channel logic as `join-session` so all parties stay in sync.

---

### 2. Stylist profiles & professional portal

- Public / admin routes under **`/stylist`** (see [`src/routes/stylistRoutes.js`](./src/routes/stylistRoutes.js)).
- **Professional dashboard** (bookings, clients, profile, availability) resolves the stylist from the **JWT** (`req.user._id` or `req.user.id`), not from trusting URL ids alone.
- Availability:
  - **Full schedule**: `POST /stylist/availability` (auth required) — weekly schedule, overrides, timezone; stylist inferred from token.
  - **Professional simplified schedule**: `PUT /stylist/availability` or `PUT /stylist/:stylistId/availability` — `dayAvailability`, `startTime`, `endTime`, `breaks`.

**Long-form integration:**  
→ [`PROFESSIONAL_STYLIST_INTEGRATION.md`](./PROFESSIONAL_STYLIST_INTEGRATION.md)  
→ [`STYLIST_JOINING_FEE_INTEGRATION.md`](./STYLIST_JOINING_FEE_INTEGRATION.md)  
→ [`STYLIST_APP_API_CHECKLIST.md`](./STYLIST_APP_API_CHECKLIST.md)

**Calendar (approved stylists):**  
→ [`/stylist-calendar`](./src/routes/stylistCalendarRoutes.js) (set/get availability, overrides, `authMiddleware` + stylist role).

---

### 3. Products (bulk import / update)

- **Bulk import** (spreadsheet URL + designer): `POST /products/uploadBulk` — body includes `fileUrl`, `designerRef`; sheet columns must match controller expectations (`productName`, `category`, `subCategory`, `color`, `size`, etc.).
- **Bulk update by product id**: `POST /products/bulk-update` — multipart `csvFile`; requires `Product ID` column (Mongo `_id`).

Column details are summarized in project docs / ask for the CSV template used by [`src/controllers/productsController.js`](./src/controllers/productsController.js).

---

## Project layout (abbreviated)

```
index.js                 # App entry, route mounting
src/
  config/                # DB, etc.
  controllers/           # Route handlers
  middleware/            # authMiddleware, roleMiddleware, uploads
  models/                # Mongoose schemas
  routes/                # Express routers
  service/               # AgoraService, Razorpay, etc.
```

---

## Authentication

- **`authMiddleware`** ([`src/middleware/authMiddleware.js`](./src/middleware/authMiddleware.js)): `Authorization: Bearer <token>` — tries **JWT** first, then **Firebase** ID token.
- JWT payloads may use `id` and/or `_id` for the Mongo user; professional stylist handlers normalize with `getAuthUserId(req)`.

---

## Documentation index

| Doc | Topic |
|-----|--------|
| [`AGORA_VIDEO_CHAT_CLIENT_INTEGRATION.md`](./AGORA_VIDEO_CHAT_CLIENT_INTEGRATION.md) | Agora RTC + RTM, same channel, join-session API |
| [`BOOKING_AND_VIDEO_SESSION_GUIDE.md`](./BOOKING_AND_VIDEO_SESSION_GUIDE.md) | Booking creation, payment, video session |
| [`BOOKING_CHAT_AGORA_SDK_GUIDE.md`](./BOOKING_CHAT_AGORA_SDK_GUIDE.md) | RTM chat endpoints |
| [`PROFESSIONAL_STYLIST_INTEGRATION.md`](./PROFESSIONAL_STYLIST_INTEGRATION.md) | Professional stylist app |
| [`STYLIST_JOINING_FEE_INTEGRATION.md`](./STYLIST_JOINING_FEE_INTEGRATION.md) | Joining fee flow |
| [`STYLIST_APP_API_CHECKLIST.md`](./STYLIST_APP_API_CHECKLIST.md) | API checklist for stylist app |

---

## Repository

Remote: see `package.json` `repository.url` — **Indigo_rhapsody_backend**.

---

## License

ISC (see `package.json`).

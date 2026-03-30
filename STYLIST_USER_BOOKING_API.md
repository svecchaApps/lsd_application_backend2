# Stylist & user booking API — reference

Standalone documentation for **reviews**, **past sessions**, **top stylists**, and related user booking routes.  
All paths are relative to your API origin (e.g. `https://your-api.com`).

**Mounted routers**

- Stylist booking: `app.use("/stylist-booking", stylistBookingRoutes)` → paths below prefixed with `/stylist-booking`
- Stylist discovery: `app.use("/stylist", stylistRoutes)` → paths prefixed with `/stylist`

---

## Authentication

Where **Auth: JWT** is required, send:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

The backend accepts Mongo JWT payloads with `id` and/or `_id` for the user.

---

## 1. Submit review (client only)

| | |
|---|---|
| **Method / path** | `POST /stylist-booking/:bookingId/review` |
| **Auth** | JWT (must be the booking’s client) |
| **`:bookingId`** | MongoDB `_id` of `StylistBooking` |

**Body**

| Field | Type | Required | Rules |
|-------|------|----------|--------|
| `rating` | number | Yes | 1–5 |
| `review` | string | No | Trimmed; max ~2000 chars |

**Success:** `201` — body includes `data.bookingId`, `data.rating`, `data.review`, `data.stylistAverageRating`.

**Errors:** `400` (invalid id, rating, not `completed`, already reviewed), `401`, `403`, `404`.

**Rules:** Only `status === "completed"`; one review per booking.

---

## 2. Public: stylist ratings & review list

| | |
|---|---|
| **Method / path** | `GET /stylist-booking/stylist/:stylistId/reviews` |
| **Auth** | None |
| **`:stylistId`** | **StylistProfile** Mongo `_id** (same as `available-slots`, profile cards) |

**Query**

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `limit` | 10 | 50 |

**Success:** `200` — `data.stylist` (name, image, `averageRating`, `totalReviews`), `data.ratingDistribution` (1–5 counts), `data.reviews[]`, `data.pagination`.

**Errors:** `400` (invalid id), `404` (stylist not found).

---

## 3. User past sessions (history)

| | |
|---|---|
| **Method / path** | `GET /stylist-booking/past-sessions` |
| **Auth** | JWT |

**Query**

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `limit` | 10 | 50 |

**Success:** `200`

- `data.sessions[]` — bookings with populated `stylistId` (name, image, bio, city, phone, email, `stylistRating`).
- Each item includes **`scheduledDateTime`** (combined local interpretation) and **`canReview`**: `true` when `status === "completed"` and no `userRating` yet.

- `data.pagination` — `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`.

Use **`canReview`** to show or hide the “Rate session” action without extra client logic.

---

## 4. User bookings (all statuses)

| | |
|---|---|
| **Method / path** | `GET /stylist-booking/user-bookings` |
| **Auth** | JWT |

Use for a full list including upcoming and completed; filter client-side or extend the API if you need status filters.

---

## 5. Top stylists (leaderboard)

Two equivalent entry points; same handler and response shape.

| Method / path | Auth |
|---------------|------|
| `GET /stylist/top` | None |
| `GET /stylist/top-stylists` | None |

**Query (all optional)**

| Param | Description |
|-------|-------------|
| `limit` | Default `10` — max rows returned |
| `minBookings` | Minimum completed bookings (default `1`) |
| `minRating` | Minimum rating filter (default `0`) |
| `categoryId` | Stylist category ObjectId |
| `city` | Case-insensitive match on `stylistCity` |
| `state` | Case-insensitive match on `stylistState` |

Response includes ranked stylists with **`stats`** (completed/total bookings, rating, rating count) and **`scores`** (booking score, rating score, combined score, `isTopStylist`).

---

## 6. ID cheat sheet

| Concept | ID type |
|---------|---------|
| Booking in review/history URLs | `StylistBooking._id` (Mongo) |
| Stylist in reviews / slots / discovery | `StylistProfile._id` (Mongo) |
| Logged-in user | `User._id` (JWT `id` / `_id`) |

---

## 7. Related docs

- `update3333.md` — original integration notes (may overlap; this file is the consolidated API reference).
- `BOOKING_AND_VIDEO_SESSION_GUIDE.md` — booking + payment flow.
- `AGORA_VIDEO_CHAT_CLIENT_INTEGRATION.md` — video/chat tokens.

---

*Last updated for: past sessions, top-stylists alias, reviews & ratings endpoints.*

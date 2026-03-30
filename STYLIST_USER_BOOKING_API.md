# Stylist & user booking API — reference

Standalone documentation for **reviews**, **past sessions**, **top stylists**, **stylist specialties** (list + filter params on discovery routes), and related user booking routes.  
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

**Query**

| Param | Required | Description |
|-------|----------|-------------|
| `userId` | **No** | If omitted, the server uses the **JWT user** (recommended). If provided, it **must** match the token user (same as `req.user`). |
| `page`, `limit`, `status` | No | Pagination and optional status filter |

Use for a full list including upcoming and completed; filter client-side or extend the API if you need status filters.

---

## 5. Stylist specialties (list & filter)

### List distinct specialties

| | |
|---|---|
| **Method / path** | `GET /stylist/specialties` |
| **Auth** | None |

Returns **`data.specialties`**: sorted distinct strings collected from approved, bookable stylists’ **`specialties`** and **`stylistSkills`** arrays (duplicates removed case-insensitively). **`data.count`** is the array length.

Use this to populate filter chips or dropdowns before calling the listing endpoints below.

### Filter stylists by specialty

Optional query parameters (same semantics everywhere):

| Param | Description |
|-------|-------------|
| `specialties` | Comma-separated list, e.g. `Color Analysis,Wardrobe` |
| `specialty` | Single value; may be repeated (`specialty=A&specialty=B`) |

A stylist matches if **any** requested value **exactly** matches (case-insensitive) **any** element in **`specialties`** or **`stylistSkills`**.

Supported on:

| Method / path | Notes |
|---------------|--------|
| `GET /stylist/approved` | Browsing with filters |
| `GET /stylist/search` | Combined with `q`: text search **and** specialty filter; `q` also matches **`specialties`** as substring |
| `GET /stylist/top` | Same as `/stylist/top-stylists` |
| `GET /stylist/top-stylists` | Leaderboard with optional specialty filter |
| `GET /stylist/category/:categoryId` | Category listing **and** optional specialty narrow |

**Examples**

```http
GET /stylist/specialties
GET /stylist/approved?specialties=Personal%20Styling,Bridal
GET /stylist/search?q=studio&specialty=Hair%20Styling
GET /stylist/top-stylists?specialty=Color%20Analysis&limit=5
GET /stylist/category/507f1f77bcf86cd799439011?specialties=Bridal
```

---

## 6. Top stylists (leaderboard)

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
| `specialties` | Comma-separated specialty filters (see **§5**) |
| `specialty` | Single specialty; repeatable (see **§5**) |

Response includes ranked stylists with **`stats`** (completed/total bookings, rating, rating count) and **`scores`** (booking score, rating score, combined score, `isTopStylist`).

---

## 7. ID cheat sheet

| Concept | ID type |
|---------|---------|
| Booking in review/history URLs | `StylistBooking._id` (Mongo) |
| Stylist in reviews / slots / discovery | `StylistProfile._id` (Mongo) |
| Logged-in user | `User._id` (JWT `id` / `_id`) |

---

## 8. Related docs

- `update3333.md` — original integration notes (may overlap; this file is the consolidated API reference).
- `BOOKING_AND_VIDEO_SESSION_GUIDE.md` — booking + payment flow.
- `AGORA_VIDEO_CHAT_CLIENT_INTEGRATION.md` — video/chat tokens.
- `STYLIST_SEARCH_API_DOCUMENTATION.md` — search query parameters in detail.
- `STYLIST_PROFILE_API_DOCUMENTATION.md` — approved listing and profile fields.

---

*Last updated for: stylist specialties (`GET /stylist/specialties`), specialty filters on discovery endpoints, past sessions, top-stylists alias, reviews & ratings.*

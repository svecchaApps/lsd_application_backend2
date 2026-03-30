# Past sessions API (`GET /stylist-booking/past-sessions`)

Documentation for the **past sessions** endpoint added for authenticated users to load booking history and drive **“Rate your stylist”** actions.

---

## Endpoint

| | |
|---|---|
| **URL** | `GET /stylist-booking/past-sessions` **or** `GET /stylist-booking/user/past-sessions` |
| **Router** | `src/routes/stylistBookingRoutes.js` |
| **Controller** | `StylistBookingController.getPastSessions` in `src/controllers/stylistBookingController.js` |
| **Base path** | Mounted at `/stylist-booking` in `index.js` |

Both paths are identical — they return **past sessions for the authenticated end-user (client)** who owns the bookings. The JWT `userId` is normalized to a Mongo `ObjectId` so it matches `StylistBooking.userId` reliably.

---

## Authentication

**Required:** `Authorization: Bearer <accessToken>`

The user is resolved from the JWT: `req.user._id` or `req.user.id`. No `userId` in the URL.

---

## Query parameters

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | `1` | — | Page number (≥ 1) |
| `limit` | `10` | `50` | Items per page |

Example:

```http
GET /stylist-booking/past-sessions?page=1&limit=20
Authorization: Bearer <token>
```

---

## What counts as a “past session”

Bookings are included if **any** of the following is true:

1. **Terminal / past outcome:** `status` is one of `completed`, `cancelled`, `no_show`.
2. **Or** scheduled date is **before now** and status is **not** one of `pending`, `confirmed`, `in_progress` (covers edge cases where date passed but status differs).

Implementation reference:

```1415:1421:c:\Users\offic\OneDrive\Desktop\lsdauth\src\controllers\stylistBookingController.js
            const query = {
                userId,
                $or: [
                    { status: { $in: ["completed", "cancelled", "no_show"] } },
                    { scheduledDate: { $lt: now }, status: { $nin: ["pending", "confirmed", "in_progress"] } }
                ]
            };
```

Results are sorted by **`scheduledDate`** desc, then **`scheduledTime`** desc (most recent first).

---

## Response

**Success — HTTP 200**

```json
{
  "success": true,
  "message": "Past sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "_id": "<booking Mongo _id>",
        "bookingId": "BOOK_...",
        "status": "completed",
        "userRating": null,
        "userReview": "",
        "scheduledDate": "2026-03-01T00:00:00.000Z",
        "scheduledTime": "14:00",
        "scheduledDateTime": "2026-03-01T14:00:00.000Z",
        "canReview": true,
        "stylistId": {
          "_id": "<StylistProfile _id>",
          "stylistName": "...",
          "stylistImage": "...",
          "stylistBio": "...",
          "stylistCity": "...",
          "stylistState": "...",
          "stylistPhone": "...",
          "stylistEmail": "...",
          "stylistRating": 4.7
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Fields added by the API

| Field | Meaning |
|-------|---------|
| `scheduledDateTime` | `scheduledDate` + `scheduledTime` combined for display/sorting on the client. |
| `canReview` | `true` only when `status === "completed"` **and** there is no `userRating` yet. Use this to show or hide the review CTA. |

**Errors**

| HTTP | When |
|------|------|
| `401` | Missing/invalid token or no user id on `req.user` |
| `500` | Server error |

---

## Related: all bookings without passing `userId`

`GET /stylist-booking/user-bookings` now works **only with the Bearer token**: you can omit `userId` in the query and the server loads bookings for **`req.user`**. If you still pass `userId`, it must match the token (you cannot read another user’s bookings).

---

## Related: submit a review

After a completed session, the client submits a review with:

- **`POST /stylist-booking/:bookingId/review`**  
- `:bookingId` = **booking** Mongo `_id` (same as `sessions[i]._id` from this list).

See **`STYLIST_USER_BOOKING_API.md`** and **`update3333.md`** for the review contract.

---

## Related: stylist specialties & discovery

These routes are on the **`/stylist`** router (not `/stylist-booking`). Use them when building **browse / search / leaderboard** flows alongside history and reviews.

### List distinct specialties (public)

| | |
|---|---|
| **URL** | `GET /stylist/specialties` |
| **Auth** | None |

Response includes **`data.specialties`** (sorted strings) and **`data.count`**. Values come from approved, bookable stylists’ **`specialties`** and **`stylistSkills`** arrays (deduplicated case-insensitively). Use for filter chips before calling listing endpoints.

### Filter stylists by specialty (optional query params)

| Param | Description |
|-------|-------------|
| `specialties` | Comma-separated, e.g. `Color Analysis,Wardrobe` |
| `specialty` | Single value; may repeat (`specialty=A&specialty=B`) |

A stylist matches if **any** requested value **exactly** matches (case-insensitive) **any** element in **`specialties`** or **`stylistSkills`**.

Supported on:

| URL | Role |
|-----|------|
| `GET /stylist/approved` | Browse with filters |
| `GET /stylist/search` | With `q`, text search and specialty filter are **AND**’d; `q` also matches **`specialties`** as substring |
| `GET /stylist/top` or `GET /stylist/top-stylists` | Leaderboard |
| `GET /stylist/category/:categoryId` | Stylists in category, optionally narrowed by specialty |

**Examples**

```http
GET /stylist/specialties
GET /stylist/approved?specialties=Personal%20Styling,Bridal
GET /stylist/search?q=studio&specialty=Hair%20Styling
GET /stylist/top-stylists?specialty=Color%20Analysis&limit=5
```

Full detail: **`STYLIST_USER_BOOKING_API.md`** §5, **`STYLIST_SEARCH_API_DOCUMENTATION.md`**, **`STYLIST_PROFILE_API_DOCUMENTATION.md`**.

---

## Frontend checklist

- [ ] Call `GET /stylist-booking/past-sessions` with the user’s Bearer token.
- [ ] Render history from `data.sessions`; use `pagination` for infinite scroll or page controls.
- [ ] Show **“Rate stylist”** only when `canReview === true`.
- [ ] On submit, call **`POST /stylist-booking/:bookingId/review`** with `bookingId` = `session._id`.
- [ ] Do not pass `userId` in the query string; identity comes only from the JWT.

---

*This file focuses on past sessions and related client flows. For **stylist specialties** (`GET /stylist/specialties`), specialty filters on discovery endpoints, **top stylists**, **reviews**, and **`user-bookings`**, see `STYLIST_USER_BOOKING_API.md`.*

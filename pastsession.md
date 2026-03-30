# Past sessions API (`GET /stylist-booking/past-sessions`)

Documentation for the **past sessions** endpoint added for authenticated users to load booking history and drive **“Rate your stylist”** actions.

---

## Endpoint

| | |
|---|---|
| **URL** | `GET /stylist-booking/past-sessions` |
| **Router** | `src/routes/stylistBookingRoutes.js` |
| **Controller** | `StylistBookingController.getPastSessions` in `src/controllers/stylistBookingController.js` |
| **Base path** | Mounted at `/stylist-booking` in `index.js` → full path **`/stylist-booking/past-sessions`** |

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

## Related: submit a review

After a completed session, the client submits a review with:

- **`POST /stylist-booking/:bookingId/review`**  
- `:bookingId` = **booking** Mongo `_id` (same as `sessions[i]._id` from this list).

See **`STYLIST_USER_BOOKING_API.md`** and **`update3333.md`** for the review contract.

---

## Frontend checklist

- [ ] Call `GET /stylist-booking/past-sessions` with the user’s Bearer token.
- [ ] Render history from `data.sessions`; use `pagination` for infinite scroll or page controls.
- [ ] Show **“Rate stylist”** only when `canReview === true`.
- [ ] On submit, call **`POST /stylist-booking/:bookingId/review`** with `bookingId` = `session._id`.
- [ ] Do not pass `userId` in the query string; identity comes only from the JWT.

---

*This file documents the past-sessions feature only. For top stylists, reviews, and other routes, see `STYLIST_USER_BOOKING_API.md`.*

# Frontend integration — stylist reviews & ratings (`update3333`)

This document describes the **user review/rating flow** and the **public ratings endpoint** for stylists, plus related fixes. Base URL examples use `https://api.example.com`; replace with your server origin.

---

## Overview

| Action | Who | Auth | Method & path |
|--------|-----|------|----------------|
| Submit rating + optional text review | Client (booking owner) | JWT | `POST /stylist-booking/:bookingId/review` |
| View aggregate + list of reviews | Anyone (e.g. profile screen) | None | `GET /stylist-booking/stylist/:stylistId/reviews` |

- **`:bookingId`** = MongoDB `_id` of the booking (24-char hex).
- **`:stylistId`** = MongoDB `_id` of **StylistProfile** (not User id). Use the same id you use for stylist profile cards and `available-slots`.

---

## 1. Submit review (after session is completed)

**When:** Booking `status` is `"completed"`, user has not reviewed yet (`userRating` not set).

**Endpoint:** `POST /stylist-booking/:bookingId/review`  

**Headers:** `Authorization: Bearer <accessToken>`  
**Content-Type:** `application/json`

**Body:**

```json
{
  "rating": 5,
  "review": "Great session, very professional."
}
```

| Field | Type | Required | Rules |
|-------|------|----------|--------|
| `rating` | number | Yes | 1–5 (integers; decimals are coerced via `Number()`) |
| `review` | string | No | Free text; server trims and caps length (≈2000 chars) |

**Success — 201**

```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "bookingId": "...",
    "rating": 5,
    "review": "Great session, very professional.",
    "stylistAverageRating": 4.7
  }
}
```

**Common errors**

| HTTP | Condition |
|------|------------|
| 400 | Invalid `bookingId`, invalid rating, booking not `completed`, review already exists |
| 401 | Missing/invalid token |
| 403 | Authenticated user is not the booking’s client |
| 404 | Booking not found |

**Frontend flow**

1. After payment + session, ensure booking is **completed** (stylist/system marks complete per your app).
2. Show “Rate your stylist” only for `status === 'completed'` and no existing `userRating` (from booking detail or user bookings list).
3. On submit, call the endpoint above, then refresh booking detail and optionally the stylist’s public reviews.

---

## 2. Public: stylist ratings & reviews list

**Endpoint:** `GET /stylist-booking/stylist/:stylistId/reviews`  

**Auth:** none  

**Query (optional):**

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `limit` | 10 | 50 |

**Example:** `GET /stylist-booking/stylist/507f1f77bcf86cd799439011/reviews?page=1&limit=10`

**Success — 200**

```json
{
  "success": true,
  "data": {
    "stylist": {
      "_id": "507f1f77bcf86cd799439011",
      "stylistName": "Jane Doe",
      "stylistImage": "https://...",
      "averageRating": 4.7,
      "totalReviews": 42
    },
    "ratingDistribution": {
      "1": 0,
      "2": 1,
      "3": 2,
      "4": 8,
      "5": 31
    },
    "reviews": [
      {
        "bookingId": "...",
        "bookingTitle": "Hair consultation",
        "bookingType": "consultation",
        "rating": 5,
        "review": "Loved it!",
        "completedAt": "2026-03-28T10:00:00.000Z",
        "client": {
          "displayName": "Alex",
          "profilePicture": null
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 42,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

Use **`stylist.averageRating`** and **`stylist.totalReviews`** on cards; use **`ratingDistribution`** for star histograms; use **`reviews`** for the list.

**Errors**

| HTTP | Meaning |
|------|---------|
| 400 | Invalid `stylistId` format |
| 404 | No StylistProfile with that id |

---

## 3. Data model (reference)

- Ratings are stored on **`StylistBooking`**: `userRating` (1–5), `userReview` (string).
- After each new review, the server updates **`StylistProfile`**:
  - `stylistRating`
  - `bookingStats.averageRating`  
  (both set to the same rolling average over all completed bookings that have a rating.)

---

## 4. Quick checklist for the app

- [ ] Stylist profile / discovery uses **StylistProfile `_id`** for `GET .../stylist/:stylistId/reviews`.
- [ ] Booking detail uses **booking `_id`** for `POST .../:bookingId/review`.
- [ ] JWT uses the **client’s User** id (same as booking `userId`).
- [ ] Show submit review UI only when `booking.status === 'completed'` and no `userRating` yet.
- [ ] Handle 400 “Review already submitted” idempotently (hide form or show “already reviewed”).

---

## 5. Past sessions endpoint (new)

Use this to render the user's booking history and show review CTAs.

**Endpoint:** `GET /stylist-booking/past-sessions`  
**Auth:** Bearer token required  

**Query params (optional):**

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `limit` | 10 | 50 |

**Success shape:**

```json
{
  "success": true,
  "message": "Past sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "_id": "bookingMongoId",
        "bookingId": "BOOK_...",
        "status": "completed",
        "userRating": 5,
        "userReview": "Great session",
        "scheduledDate": "2026-03-01T00:00:00.000Z",
        "scheduledTime": "14:00",
        "scheduledDateTime": "2026-03-01T14:00:00.000Z",
        "canReview": false,
        "stylistId": {
          "_id": "stylistProfileId",
          "stylistName": "Jane",
          "stylistImage": "https://...",
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

`canReview` is already computed by backend (`status === completed && no userRating`) so frontend can directly show/hide the review button.

---

## 6. Top stylists endpoint (new alias)

A dedicated frontend-friendly alias was added:

- `GET /stylist/top-stylists`

It uses the same logic/response as existing:

- `GET /stylist/top`

Supported query params remain the same (`limit`, `minBookings`, `minRating`, `categoryId`, `city`, `state`).

---

## 7. Related routes (same app)

- User bookings: `GET /stylist-booking/user-bookings` (auth) — use to find completed bookings and whether `userRating` is set.
- User past sessions (history): `GET /stylist-booking/past-sessions` (auth).
- Public stylist reviews: `GET /stylist-booking/stylist/:stylistId/reviews`.
- Submit review: `POST /stylist-booking/:bookingId/review`.

---

*End of `update3333.md`.*

# Stylist App — Pending Feature API Checklist

> **Scope:** This document covers the backend API endpoints for the **stylist booking application** (user + stylist flows). It is **not** for the designer/shopper application.

---

## Status Legend

- ✅ **Already existed** before this implementation
- 🆕 **Newly implemented** in this session
- ⚠️ **Partially available** — see notes

---

## 1. Reschedule Booking ✅

**Endpoint:** `POST /stylist-booking/reschedule/:bookingId`
**Auth:** Required (Bearer token)
**Status:** Already implemented.

**Request body:**
```json
{ "newDate": "2026-04-10", "newTime": "14:00", "reason": "Schedule conflict" }
```

**Business rules:**
- Booking must be `confirmed` + payment `completed`
- Must be > 24 hours before the session
- Creates a new booking record; marks original as `rescheduled`

---

## 2. Cancel Booking ✅

**Endpoint:** `POST /stylist-booking/cancel/:bookingId`
**Auth:** Required (Bearer token)
**Status:** Already implemented.

**Request body:**
```json
{ "reason": "Personal emergency" }
```

**Business rules:**
- Booking must be `confirmed` + payment `completed`
- Must be > 2 hours before the session
- Attempts Razorpay refund automatically if payment was completed

---

## 3. Review / Rating Submission 🆕

**Endpoint:** `POST /stylist-booking/:bookingId/review`
**Auth:** Required (Bearer token — user must be the booking owner)
**Status:** Newly implemented.

**Request body:**
```json
{ "rating": 5, "review": "Excellent session, very helpful!" }
```

**Rules:**
- Booking must be in `completed` status
- `rating` must be an integer 1–5
- Only one review per booking (idempotent guard)
- Automatically recalculates `stylistProfile.stylistRating` (rolling average)

**Success response `201`:**
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": { "bookingId": "...", "rating": 5, "review": "..." }
}
```

---

## 4. FCM Token Registration 🆕

**New endpoint:** `POST /user/:userId/fcm-token`
**Auth:** Not required (token passed in body)
**Status:** Newly implemented.

**Existing endpoint (still works):** `PUT /notification/update-fcm-token` (takes `userId` + `fcmToken` in body)

**Request body:**
```json
{ "fcmToken": "fcm_device_token_string" }
```

**Success response `200`:**
```json
{ "success": true, "message": "FCM token registered successfully", "data": { "userId": "...", "fcmToken": "..." } }
```

**Mobile integration note:**
Call this endpoint after `NotificationService.init()` retrieves the device token. Re-call on token refresh.

---

## 5. Notification Badge Count 🆕

**Endpoint:** `GET /notification/user/:userId/unread-count`
**Auth:** Not required
**Status:** Newly implemented.

**Success response `200`:**
```json
{ "success": true, "data": { "unreadCount": 3 } }
```

Poll this endpoint (or call on app foreground) to update the badge number.

---

## 6. Notifications Inbox 🆕

**Endpoint:** `GET /notification/user/:userId`
**Auth:** Not required
**Status:** Newly implemented.

**Query params:**

| Param  | Type    | Default | Description                        |
|--------|---------|---------|------------------------------------|
| page   | integer | 1       | Page number                        |
| limit  | integer | 20      | Items per page (max 100)           |
| seen   | boolean | —       | Filter by read status (`true`/`false`) |

**Mark as read:** `PATCH /notification/user/:userId/mark-read`
Body (optional — omit to mark all): `{ "notificationIds": ["id1", "id2"] }`

**Notification `notificationType` values:**
- `booking_confirmed` — booking payment completed
- `booking_cancelled` — booking cancelled
- `booking_rescheduled` — booking rescheduled
- `session_reminder` — upcoming session reminder
- `review_request` — prompt to leave a review after session
- `order` — e-commerce order update
- `return` — return request update
- `system` — general system message
- `broadcast` — sent to all users

---

## 7. Update User Profile ✅

**Endpoint:** `PUT /user/profile/:userId`
**Auth:** Not required (add `authMiddleware` if needed)
**Status:** Already implemented.

**Request body (all fields optional):**
```json
{ "displayName": "Jane Doe", "email": "jane@example.com", "phoneNumber": "+919876543210" }
```

---

## 8. Account Deletion 🆕

**Endpoint:** `DELETE /user/:userId`
**Auth:** Not required (add auth + ownership check in production)
**Status:** Newly implemented.

**Behaviour:**
- Cancels all `pending` / `confirmed` bookings with reason `"Account deleted by user"`
- Hard-deletes the User document
- Does **not** delete stylist profile (admin review recommended)

**Success response `200`:**
```json
{ "success": true, "message": "Account deleted successfully" }
```

---

## 9. Notification Preferences Sync 🆕

**Endpoint:** `PUT /user/:userId/notification-preferences`
**Auth:** Not required
**Status:** Newly implemented.

**Request body (send only fields you want to update):**
```json
{
  "bookingConfirmations": true,
  "sessionReminders": true,
  "cancellations": true,
  "promotions": false,
  "reviews": true
}
```

**Success response `200`:**
```json
{
  "success": true,
  "message": "Notification preferences updated successfully",
  "data": {
    "notificationPreferences": {
      "bookingConfirmations": true,
      "sessionReminders": true,
      "cancellations": true,
      "promotions": false,
      "reviews": true
    }
  }
}
```

**Mobile integration note:**
When the user toggles a preference in the app's settings screen, call this endpoint immediately (not just save to SharedPreferences) so the stylist-side systems reflect the correct preferences.

---

## Model Changes Made

### `notificationsModel.js`
Added fields:
- `bookingId` — ObjectId ref `StylistBooking`
- `stylistId` — ObjectId ref `StylistProfile`
- `notificationType` — enum (see list above), default `"system"`
- Compound index on `{ userId, seen, createdDate }` for inbox query performance

### `userModel.js`
Added field:
- `notificationPreferences` — embedded object with 5 boolean toggles (all default `true`)

---

## Quick Reference — All New/Updated Endpoints

| # | Method   | Path                                        | Controller                          |
|---|----------|---------------------------------------------|-------------------------------------|
| 3 | POST     | `/stylist-booking/:bookingId/review`        | `StylistBookingController.submitReview` |
| 4 | POST     | `/user/:userId/fcm-token`                   | `userController.registerFcmToken`   |
| 5 | GET      | `/notification/user/:userId/unread-count`   | `notificationController.getUnreadCount` |
| 6 | GET      | `/notification/user/:userId`                | `notificationController.getUserNotifications` |
| 6 | PATCH    | `/notification/user/:userId/mark-read`      | `notificationController.markNotificationsRead` |
| 8 | DELETE   | `/user/:userId`                             | `userController.deleteUserAccount`  |
| 9 | PUT      | `/user/:userId/notification-preferences`    | `userController.updateNotificationPreferences` |

> Features 1 (reschedule), 2 (cancel), and 7 (update profile) were already fully implemented.

---

## Testing Tips

Use the existing curl/http test files as a pattern. Key things to verify:

- [ ] `POST /stylist-booking/:bookingId/review` — returns 400 if booking not `completed`
- [ ] `POST /stylist-booking/:bookingId/review` — returns 400 on duplicate review
- [ ] `POST /stylist-booking/:bookingId/review` — updates `stylistRating` on stylist profile
- [ ] `GET /notification/user/:userId/unread-count` — returns 0 when no notifications
- [ ] `GET /notification/user/:userId?seen=false` — returns only unread
- [ ] `PATCH /notification/user/:userId/mark-read` — with no body marks all read
- [ ] `POST /user/:userId/fcm-token` — returns 400 if fcmToken missing
- [ ] `DELETE /user/:userId` — pending bookings are cancelled before deletion
- [ ] `PUT /user/:userId/notification-preferences` — partial update (single field) works

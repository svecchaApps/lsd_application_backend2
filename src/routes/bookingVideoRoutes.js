const express = require("express");
const router = express.Router();

const {
  joinSession,
  endSession,
  getSessionStatus
} = require("../controllers/videoSessionController.");

const authenticate = require("../middleware/authMiddleware");


/**
 * JOIN VIDEO + CHAT SESSION
 * POST /api/bookings/:bookingId/join-session
 * user | stylist
 */
router.post(
  "/bookings/:bookingId/join-session",
//   authenticate.authMiddleware,
  joinSession
);

/**
 * END SESSION (EARLY / MANUAL)
 * POST /api/bookings/:bookingId/end-session
 * stylist | admin
 */
router.post(
  "/bookings/:bookingId/end-session",
  endSession
);

/**
 * SESSION STATUS (Polling / Safety)
 * GET /api/bookings/:bookingId/session-status
 * user | stylist
 */
router.get(
  "/bookings/:bookingId/session-status",
  getSessionStatus
);

module.exports = router;

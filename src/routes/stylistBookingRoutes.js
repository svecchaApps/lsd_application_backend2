const express = require("express");
const router = express.Router();
const stylistBookingController = require("../controllers/stylistBookingController");
const razorpayBookingController = require("../controllers/razorpayBookingController");
const {
    authMiddleware,
    roleMiddleware,
} = require("../middleware/authMiddleware");

// Public routes (no authentication required)
router.get(
    "/available-slots/:stylistId",
    stylistBookingController.getAvailableSlots
);

// Public: ratings + reviews for a stylist (StylistProfile _id)
router.get(
    "/stylist/:stylistId/reviews",
    stylistBookingController.getStylistReviews
);

// User routes (authentication required)
router.post(
    "/create",
    authMiddleware,
    stylistBookingController.createBooking
);

// Payment routes - using new Razorpay booking controller
router.post(
    "/payment/initiate/:bookingId",
    authMiddleware,
    razorpayBookingController.initiatePayment
);

router.post(
    "/payment/verify",
    razorpayBookingController.verifyPayment
);

// Legacy callback route (kept for backward compatibility)
router.post(
    "/payment/callback",
    razorpayBookingController.verifyPayment
);

// Combined create booking and initiate payment
router.post(
    "/create-and-pay",
    authMiddleware,
    razorpayBookingController.createBookingAndInitiatePayment
);

// Get payment status
router.get(
    "/payment/status/:bookingId",
    authMiddleware,
    razorpayBookingController.getPaymentStatus
);

router.get(
    "/user-bookings",
    authMiddleware,
    stylistBookingController.getUserBookings
);

router.get(
    "/past-sessions",
    authMiddleware,
    stylistBookingController.getPastSessions
);

// Alias: same handler — past sessions for the authenticated client (user)
router.get(
    "/user/past-sessions",
    authMiddleware,
    stylistBookingController.getPastSessions
);

// Public route - accepts userId as parameter
router.get(
    "/upcoming-sessions",
    stylistBookingController.getUpcomingSessions
);

router.post(
    "/start-video-call/:bookingId",
    authMiddleware,
    stylistBookingController.startVideoCall
);

router.post(
    "/end-video-call/:bookingId",
    authMiddleware,
    stylistBookingController.endVideoCall
);

router.post(
    "/bookings/:bookingId/test-create-session",
    authMiddleware,
    stylistBookingController.testCreateAgoraSession
  );
  

router.post(
    "/reschedule/:bookingId",
    authMiddleware,
    stylistBookingController.rescheduleBooking
);

router.post(
    "/cancel/:bookingId",
    authMiddleware,
    stylistBookingController.cancelBooking
);

// Submit review / rating for a completed booking (user only)
router.post(
    "/:bookingId/review",
    authMiddleware,
    stylistBookingController.submitReview
);

// Stylist routes (authentication + stylist role required)
router.get(
    "/stylist-bookings",
    authMiddleware,
    roleMiddleware(["Stylist", "stylist"]),
    stylistBookingController.getStylistBookings
);

module.exports = router;

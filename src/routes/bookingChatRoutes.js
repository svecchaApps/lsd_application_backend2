const express = require("express");
const router = express.Router();
const BookingChatController = require("../controllers/bookingChatController");

/**
 * Get Agora Chat SDK (RTM) configuration for booking chat
 * POST /booking-chat/booking/:bookingId/rtm-config
 * Returns RTM tokens and channel info for client-side Agora Chat SDK integration
 */
router.post(
    "/booking/:bookingId/rtm-config",
    BookingChatController.getRtmConfig
);

/**
 * Get user's active booking chats
 * GET /booking-chat/user/:userId/chats
 * Returns list of bookings with chat access (for confirmed/in_progress bookings only)
 */
router.get(
    "/user/:userId/chats",
    BookingChatController.getUserChats
);

/**
 * Refresh RTM token for chat
 * POST /booking-chat/booking/:bookingId/refresh-rtm-token
 * Returns new RTM token when current one is about to expire
 */
router.post(
    "/booking/:bookingId/refresh-rtm-token",
    BookingChatController.refreshRtmToken
);

module.exports = router;

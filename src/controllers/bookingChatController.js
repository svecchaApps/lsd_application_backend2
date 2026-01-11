const mongoose = require("mongoose");
const StylistBooking = require("../models/stylistBooking");
const StylistProfile = require("../models/stylistProfile");
const User = require("../models/userModel");
const AgoraService = require("../service/agoraService");

class BookingChatController {

    /**
     * Get Agora Chat SDK (RTM) configuration for booking chat
     * POST /booking-chat/booking/:bookingId/rtm-config
     * Returns RTM tokens and channel info for Agora Chat SDK
     */
    static async getRtmConfig(req, res) {
        try {
            const { bookingId } = req.params;
            const { userId, role } = req.body;

            // Validate bookingId
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID format"
                });
            }

            // Validate userId and role
            if (!userId || !role) {
                return res.status(400).json({
                    success: false,
                    message: "userId and role are required"
                });
            }

            if (!["user", "stylist"].includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid role. Must be 'user' or 'stylist'"
                });
            }

            // Find booking and validate
            const booking = await StylistBooking.findById(bookingId)
                .populate('userId', 'displayName email')
                .populate('stylistId', 'stylistName stylistEmail');

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Validate booking is active/confirmed (only allow chat for active bookings)
            if (!['confirmed', 'in_progress'].includes(booking.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Chat is only available for confirmed or active bookings"
                });
            }

            // Validate user has access to this booking
            const isUser = booking.userId._id.toString() === userId.toString();
            const stylistProfile = await StylistProfile.findById(booking.stylistId._id);
            const isStylist = stylistProfile && stylistProfile.userId.toString() === userId.toString();

            if (!isUser && !isStylist) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized: You don't have access to this booking chat"
                });
            }

            // Generate Agora RTM tokens for chat
            const tokenResult = AgoraService.generateBookingSessionTokens({
                booking,
                userId,
                role
            });

            if (!tokenResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to generate RTM tokens",
                    error: tokenResult.message
                });
            }

            // Generate chat channel name (same as video channel for booking)
            const chatChannelName = AgoraService.generateChannelName(booking.bookingId);

            return res.status(200).json({
                success: true,
                message: "RTM configuration retrieved successfully",
                data: {
                    appId: tokenResult.data.appId,
                    rtmToken: tokenResult.data.rtmToken,
                    rtmUid: tokenResult.data.rtmUid,
                    channelName: chatChannelName,
                    expiresAt: tokenResult.data.expiresAt,
                    expiresIn: tokenResult.data.expiresIn,
                    booking: {
                        bookingId: booking._id,
                        bookingIdString: booking.bookingId,
                        status: booking.status,
                        paymentStatus: booking.paymentStatus,
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime
                    }
                }
            });

        } catch (error) {
            console.error("Get RTM config error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get RTM configuration",
                error: error.message
            });
        }
    }

    /**
     * Get user's active booking chats
     * GET /booking-chat/user/:userId/chats
     * Returns list of bookings with chat access
     */
    static async getUserChats(req, res) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 20, status } = req.query;

            // Validate userId
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid userId format"
                });
            }

            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Find if user is a stylist
            const stylistProfile = await StylistProfile.findOne({ userId: userId });

            const pageNum = parseInt(page);
            const limitNum = Math.min(parseInt(limit), 50);

            const skip = (pageNum - 1) * limitNum;

            // Build query - user can be either userId or stylist
            let query = {};
            if (stylistProfile) {
                // User is a stylist - get bookings where they are the stylist
                query.stylistId = stylistProfile._id;
            } else {
                // Regular user - get bookings where they are the user
                query.userId = userId;
            }

            // Only return active bookings (confirmed or in_progress)
            query.status = { $in: ['confirmed', 'in_progress'] };
            
            // Add status filter if provided
            if (status && ['confirmed', 'in_progress'].includes(status)) {
                query.status = status;
            }

            const bookings = await StylistBooking.find(query)
                .populate('userId', 'displayName email phoneNumber _id')
                .populate('stylistId', 'stylistName stylistImage stylistBio stylistEmail stylistPhone _id')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum);

            const totalBookings = await StylistBooking.countDocuments(query);

            // Format response with chat channel info
            const chats = bookings.map(booking => ({
                bookingId: booking._id,
                bookingIdString: booking.bookingId,
                channelName: AgoraService.generateChannelName(booking.bookingId),
                participant: stylistProfile 
                    ? booking.userId 
                    : booking.stylistId,
                booking: {
                    bookingTitle: booking.bookingTitle,
                    bookingType: booking.bookingType,
                    scheduledDate: booking.scheduledDate,
                    scheduledTime: booking.scheduledTime,
                    duration: booking.duration,
                    status: booking.status,
                    paymentStatus: booking.paymentStatus
                },
                createdAt: booking.createdAt,
                updatedAt: booking.updatedAt
            }));

            return res.status(200).json({
                success: true,
                message: "User chats retrieved successfully",
                data: {
                    chats,
                    pagination: {
                        currentPage: pageNum,
                        totalPages: Math.ceil(totalBookings / limitNum),
                        totalBookings,
                        limit: limitNum,
                        hasNextPage: skip + chats.length < totalBookings,
                        hasPrevPage: pageNum > 1
                    }
                }
            });

        } catch (error) {
            console.error("Get user chats error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get user chats",
                error: error.message
            });
        }
    }

    /**
     * Refresh RTM token for chat
     * POST /booking-chat/booking/:bookingId/refresh-rtm-token
     * Returns new RTM token when current one is about to expire
     */
    static async refreshRtmToken(req, res) {
        try {
            const { bookingId } = req.params;
            const { userId, role } = req.body;

            // Validate bookingId
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID format"
                });
            }

            // Validate userId and role
            if (!userId || !role) {
                return res.status(400).json({
                    success: false,
                    message: "userId and role are required"
                });
            }

            // Find booking
            const booking = await StylistBooking.findById(bookingId);

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Validate booking is active
            if (!['confirmed', 'in_progress'].includes(booking.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot refresh token. Booking is not active"
                });
            }

            // Generate new RTM token
            const tokenResult = AgoraService.generateBookingSessionTokens({
                booking,
                userId,
                role
            });

            if (!tokenResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to refresh RTM token",
                    error: tokenResult.message
                });
            }

            return res.status(200).json({
                success: true,
                message: "RTM token refreshed successfully",
                data: {
                    rtmToken: tokenResult.data.rtmToken,
                    rtmUid: tokenResult.data.rtmUid,
                    expiresAt: tokenResult.data.expiresAt,
                    expiresIn: tokenResult.data.expiresIn
                }
            });

        } catch (error) {
            console.error("Refresh RTM token error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to refresh RTM token",
                error: error.message
            });
        }
    }
}

module.exports = BookingChatController;

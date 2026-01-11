const StylistBooking = require("../models/stylistBooking");
const AgoraService = require("../service/agoraService");
exports.joinSession = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { userId, role } = req.body;
  
      if (!userId || !role) {
        return res.status(400).json({
          success: false,
          message: "userId and role are required"
        });
      }
  
      if (!["user", "stylist"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role"
        });
      }
  
      const booking = await StylistBooking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found"
        });
      }
  
      // 🔐 Ownership validation
    //   const isUser =
    //     role === "user" && booking.userId.toString() === userId;
  
    //   const isStylist =
    //     role === "stylist" && booking.stylistId.toString() === userId;
  
    //   if (!isUser && !isStylist) {
    //     return res.status(403).json({
    //       success: false,
    //       message: "Unauthorized"
    //     });
    //   }
  
      // 💰 Allow test + real payments
      if (!["completed", "test"].includes(booking.paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Payment not completed"
        });
      }
  
      if (!["confirmed", "in_progress"].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: "Session not active"
        });
      }

      // Validate required booking fields
      if (!booking.bookingId) {
        return res.status(400).json({
          success: false,
          message: "Booking ID is missing"
        });
      }

      if (!booking.scheduledDate || !booking.scheduledTime) {
        return res.status(400).json({
          success: false,
          message: "Booking schedule information is incomplete"
        });
      }

      if (!booking.duration || typeof booking.duration !== 'number') {
        return res.status(400).json({
          success: false,
          message: "Booking duration is invalid"
        });
      }

      // ⏱ Correct time handling
      const now = new Date();
      const start = booking.scheduledDateTime;
      
      // Validate scheduledDateTime virtual field
      if (!start || isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking scheduled date/time"
        });
      }

      const end = new Date(start.getTime() + booking.duration * 60000);

      // 🎥 Generate Agora tokens
      const tokenResult = AgoraService.generateBookingSessionTokens({
        booking,
        userId,
        role
      });
  
      if (!tokenResult.success) {
        return res.status(500).json(tokenResult);
      }
  
      // 🟢 Mark session live (only once)
      if (booking.videoCallStatus !== "in_progress") {
        booking.videoCallStatus = "in_progress";
        booking.status = "in_progress";
        booking.videoCallStartedAt = now;
        await booking.save();
      }
  
      return res.status(200).json({
        success: true,
        message: "Session joined",
        data: tokenResult.data
      });
  
    } catch (error) {
      console.error("Join session error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to join session",
        error: error.message
      });
    }
  };
  
  


exports.endSession = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const userId = req.user._id.toString();
      const role = req.user.role;
  
      const booking = await StylistBooking.findById(bookingId);
  
      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found" });
      }
  
      // Only stylist or admin can end early
      if (
        role !== "admin" &&
        !(role === "stylist" && booking.stylistId.toString() === userId)
      ) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
  
      if (booking.videoCallStatus !== "in_progress") {
        return res.status(400).json({ success: false, message: "Session not live" });
      }
  
      booking.videoCallStatus = "ended";
      booking.status = "completed";
      booking.videoCallEndedAt = new Date();
  
      const duration =
        (booking.videoCallEndedAt - booking.videoCallStartedAt) / 60000;
  
      booking.videoCallDuration = Math.round(duration);
      booking.completedAt = new Date();
  
      await booking.save();
  
      return res.json({
        success: true,
        message: "Session ended successfully"
      });
  
    } catch (error) {
      console.error("End session error:", error);
      res.status(500).json({ success: false, message: "Failed to end session" });
    }
  };

  
  exports.getSessionStatus = async (req, res) => {
    const booking = await StylistBooking.findById(req.params.bookingId);
  
    if (!booking) {
      return res.status(404).json({ success: false });
    }
  
    const now = new Date();
    const start = booking.scheduledDateTime;
    const end = new Date(start.getTime() + booking.duration * 60000);
  
    res.json({
      success: true,
      data: {
        status: booking.videoCallStatus,
        bookingStatus: booking.status,
        now,
        start,
        end,
        isLive: now >= start && now <= end
      }
    });
  };
  

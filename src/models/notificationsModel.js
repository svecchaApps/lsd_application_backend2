const mongoose = require("mongoose");

const notificationsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  designeref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Designer",
  },
  message: {
    type: String,
    required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  title: {
    type: String,
  },
  seen: {
    type: Boolean,
    default: false,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
  },
  returnId: {
    type: String,
  },
  // Stylist-booking notification fields
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StylistBooking",
  },
  stylistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StylistProfile",
  },
  notificationType: {
    type: String,
    enum: [
      "order",
      "return",
      "booking_confirmed",
      "booking_cancelled",
      "booking_rescheduled",
      "session_reminder",
      "review_request",
      "system",
      "broadcast",
    ],
    default: "system",
  },
});

notificationsSchema.index({ userId: 1, seen: 1, createdDate: -1 });

module.exports = mongoose.model("Notifications", notificationsSchema);

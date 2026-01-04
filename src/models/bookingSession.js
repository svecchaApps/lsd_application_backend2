const mongoose = require("mongoose");

const bookingSessionSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StylistBooking",
    required: true,
    unique: true
  },

  channelName: {
    type: String,
    required: true,
    unique: true
  },

  participants: [{
    userId: mongoose.Schema.Types.ObjectId,
    role: {
      type: String,
      enum: ["user", "stylist"]
    },
    joinedAt: Date,
    leftAt: Date
  }],

  sessionStatus: {
    type: String,
    enum: ["not_started", "live", "ended", "expired"],
    default: "not_started"
  },

  startTime: Date,
  endTime: Date,
  hardStopTime: Date, // start + duration

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("BookingSession", bookingSessionSchema);

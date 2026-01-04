const mongoose = require("mongoose");

const stylistBookingSchema = new mongoose.Schema({
    // Booking identification
    bookingId: {
        type: String,
        unique: true,
        required: true,
        default: () => `BOOK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },

    // User and Stylist references
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    stylistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StylistProfile",
        required: true
    },
    isTestBooking: {
        type: Boolean,
        default: false
      },
      
    // Booking details
    bookingType: {
        type: String,
        enum: ['consultation', 'styling_session', 'makeover', 'custom'],
        required: true,
        default: 'consultation'
    },
    bookingTitle: {
        type: String,
        required: true
    },
    bookingDescription: {
        type: String,
        required: true
    },
    agoraAppId: String, // optional if env-based
agoraChannelName: String,
agoraRtcToken: String,
agoraRtmToken: String,

sessionStartedAt: Date,
sessionEndedAt: Date,
allowedUntil: Date, // hard cutoff time

    // Scheduling
    scheduledDate: {
        type: Date,
        required: true
    },
    scheduledTime: {
        type: String, // Format: "HH:MM" (24-hour format)
        required: true
    },
    duration: {
        type: Number, // Duration in minutes
        required: true,
        default: 60
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    },

    // Booking status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'],
        default: 'pending'
    },

    // Payment details
    paymentStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending'
    },
    paymentAmount: {
        type: Number,
        required: true
    },
    paymentCurrency: {
        type: String,
        default: 'INR'
    },
    paymentMethod: {
        type: String,
        default: 'razorpay'
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    paymentCompletedAt: {
        type: Date
    },

    // Video call details
    videoCallStatus: {
        type: String,
        enum: ['not_started', 'initiated', 'in_progress', 'ended', 'failed'],
        default: 'not_started'
    },
    agoraChannelName: {
        type: String
    },
    agoraToken: {
        type: String
    },
    videoCallStartedAt: {
        type: Date
    },
    videoCallEndedAt: {
        type: Date
    },
    videoCallDuration: {
        type: Number // Duration in minutes
    },

    // Rescheduling
    isRescheduled: {
        type: Boolean,
        default: false
    },
    originalBookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StylistBooking"
    },
    rescheduleReason: {
        type: String
    },
    rescheduledAt: {
        type: Date
    },
    rescheduledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // Cancellation
    isCancelled: {
        type: Boolean,
        default: false
    },
    cancellationReason: {
        type: String
    },
    cancelledAt: {
        type: Date
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    cancellationFee: {
        type: Number,
        default: 0
    },

    // Completion and feedback
    completedAt: {
        type: Date
    },
    userRating: {
        type: Number,
        min: 1,
        max: 5
    },
    userReview: {
        type: String
    },
    stylistNotes: {
        type: String
    },

    // Notifications
    notificationsSent: [{
        type: {
            type: String,
            enum: ['booking_confirmed', 'reminder_24h', 'reminder_1h', 'session_starting', 'session_ended', 'payment_failed', 'rescheduled', 'cancelled']
        },
        sentAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Metadata
    metadata: {
        deviceInfo: {
            type: String
        },
        ipAddress: {
            type: String
        },
        userAgent: {
            type: String
        }
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better query performance
stylistBookingSchema.index({ userId: 1, status: 1 });
stylistBookingSchema.index({ stylistId: 1, status: 1 });
stylistBookingSchema.index({ scheduledDate: 1, scheduledTime: 1 });
stylistBookingSchema.index({ bookingId: 1 });
stylistBookingSchema.index({ razorpayOrderId: 1 });
stylistBookingSchema.index({ status: 1, paymentStatus: 1 });

// Pre-save middleware to update the updatedAt field
stylistBookingSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for formatted scheduled datetime
stylistBookingSchema.virtual('scheduledDateTime').get(function () {
    const date = new Date(this.scheduledDate);
    const [hours, minutes] = this.scheduledTime.split(':');
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
});

// Virtual for checking if booking is in the past
stylistBookingSchema.virtual('isPastBooking').get(function () {
    return this.scheduledDateTime < new Date();
});

// Virtual for checking if booking can be cancelled
stylistBookingSchema.virtual('canBeCancelled').get(function () {
    const now = new Date();
    const bookingTime = this.scheduledDateTime;
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    return this.status === 'confirmed' &&
        this.paymentStatus === 'completed' &&
        !this.isCancelled &&
        hoursUntilBooking > 2; // Can cancel if more than 2 hours before booking
});

// Virtual for checking if booking can be rescheduled
stylistBookingSchema.virtual('canBeRescheduled').get(function () {
    const now = new Date();
    const bookingTime = this.scheduledDateTime;
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    return this.status === 'confirmed' &&
        this.paymentStatus === 'completed' &&
        !this.isCancelled &&
        !this.isRescheduled &&
        hoursUntilBooking > 24; // Can reschedule if more than 24 hours before booking
});

// Static method to find available time slots
stylistBookingSchema.statics.findAvailableSlots = async function (stylistId, date, duration = 60) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await this.find({
        stylistId,
        scheduledDate: {
            $gte: startOfDay,
            $lte: endOfDay
        },
        status: { $in: ['confirmed', 'in_progress'] }
    }).sort({ scheduledTime: 1 });

    // Generate available slots (assuming 9 AM to 9 PM working hours)
    const availableSlots = [];
    const workingHours = { start: 9, end: 21 }; // 9 AM to 9 PM

    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
        for (let minute = 0; minute < 60; minute += 30) { // 30-minute intervals
            const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const slotDateTime = new Date(date);
            slotDateTime.setHours(hour, minute, 0, 0);

            // Check if this slot conflicts with existing bookings
            const hasConflict = existingBookings.some(booking => {
                const bookingStart = new Date(booking.scheduledDate);
                const [bookingHour, bookingMinute] = booking.scheduledTime.split(':');
                bookingStart.setHours(parseInt(bookingHour), parseInt(bookingMinute), 0, 0);

                const bookingEnd = new Date(bookingStart.getTime() + (booking.duration * 60000));
                const slotEnd = new Date(slotDateTime.getTime() + (duration * 60000));

                return (slotDateTime < bookingEnd && slotEnd > bookingStart);
            });

            if (!hasConflict && slotDateTime > new Date()) {
                availableSlots.push({
                    time: slotTime,
                    datetime: slotDateTime,
                    duration: duration
                });
            }
        }
    }

    return availableSlots;
};

module.exports = mongoose.model("StylistBooking", stylistBookingSchema);

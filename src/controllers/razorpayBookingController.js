const mongoose = require("mongoose");
const StylistBooking = require("../models/stylistBooking");
const StylistProfile = require("../models/stylistProfile");
const RazorpayService = require("../service/razorpayService");
const { createNotification, sendFcmNotification } = require("./notificationController");

/**
 * Razorpay Payment Controller for Stylist Bookings
 * Handles payment initiation and verification for stylist bookings
 */
class RazorpayBookingController {

    /**
     * Initiate Razorpay payment for a stylist booking
     * Creates a Razorpay order and returns payment options
     * 
     * POST /api/stylist-booking/payment/initiate/:bookingId
     * Headers: Authorization: Bearer <token>
     */
    static async initiatePayment(req, res) {
        try {
            const { bookingId } = req.params;
            const userId = req.user._id;

            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID format"
                });
            }

            // Find booking
            const booking = await StylistBooking.findById(bookingId)
                .populate('stylistId', 'stylistName stylistImage stylistPrice')
                .populate('userId', 'displayName email phoneNumber');

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Check if booking belongs to user
            if (booking.userId._id.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. This booking does not belong to you."
                });
            }

            // Check booking status
            if (booking.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: `Booking cannot be paid for. Current status: ${booking.status}`
                });
            }

            // Check if payment already completed
            if (booking.paymentStatus === 'completed') {
                return res.status(400).json({
                    success: false,
                    message: "Payment already completed for this booking",
                    data: {
                        bookingId: booking._id,
                        paymentStatus: booking.paymentStatus,
                        bookingStatus: booking.status
                    }
                });
            }

            // Check if payment order already exists
            if (booking.razorpayOrderId) {
                // Return existing order details
                const paymentOptions = RazorpayService.generatePaymentOptions({
                    orderId: booking.razorpayOrderId,
                    amount: booking.paymentAmount * 100, // Convert to paise
                    currency: 'INR',
                    name: 'IndigoRhapsody',
                    description: `Stylist Booking - ${booking.bookingTitle}`,
                    customerName: booking.userId.displayName || 'Customer',
                    customerEmail: booking.userId.email || '',
                    customerPhone: booking.userId.phoneNumber || ''
                });

                return res.status(200).json({
                    success: true,
                    message: "Payment order already exists",
                    data: {
                        bookingId: booking._id,
                        orderId: booking.razorpayOrderId,
                        amount: booking.paymentAmount,
                        currency: 'INR',
                        paymentOptions: paymentOptions,
                        expiresIn: 1800 // 30 minutes
                    }
                });
            }

            // Create Razorpay order
            const orderData = {
                amount: booking.paymentAmount,
                currency: 'INR',
                receipt: `booking_${bookingId}_${Date.now()}`,
                notes: {
                    bookingId: bookingId,
                    userId: userId.toString(),
                    stylistId: booking.stylistId._id.toString(),
                    bookingType: booking.bookingType,
                    bookingTitle: booking.bookingTitle
                },
                customerDetails: {
                    name: booking.userId.displayName || 'Customer',
                    email: booking.userId.email || '',
                    contact: booking.userId.phoneNumber || ''
                }
            };

            const orderResult = await RazorpayService.createOrder(orderData);

            if (!orderResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to create payment order",
                    error: orderResult.message
                });
            }

            // Update booking with payment order details
            booking.razorpayOrderId = orderResult.data.orderId;
            booking.paymentStatus = 'processing';
            booking.updatedAt = new Date();
            await booking.save();

            // Generate client payment options
            const paymentOptions = RazorpayService.generatePaymentOptions({
                ...orderResult.data,
                name: 'IndigoRhapsody',
                description: `Stylist Booking - ${booking.bookingTitle}`,
                customerName: booking.userId.displayName || 'Customer',
                customerEmail: booking.userId.email || '',
                customerPhone: booking.userId.phoneNumber || ''
            });

            return res.status(200).json({
                success: true,
                message: "Payment initiated successfully",
                data: {
                    bookingId: booking._id,
                    orderId: orderResult.data.orderId,
                    amount: booking.paymentAmount,
                    currency: 'INR',
                    paymentOptions: paymentOptions,
                    expiresIn: 1800, // 30 minutes
                    bookingDetails: {
                        bookingTitle: booking.bookingTitle,
                        bookingType: booking.bookingType,
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime,
                        duration: booking.duration,
                        stylistName: booking.stylistId.stylistName
                    }
                }
            });

        } catch (error) {
            console.error("Initiate payment error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to initiate payment",
                error: error.message
            });
        }
    }

    /**
     * Verify and handle Razorpay payment callback
     * Verifies payment signature and confirms booking
     * 
     * POST /api/stylist-booking/payment/verify
     * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
     */
    static async verifyPayment(req, res) {
        try {
            const { 
                razorpay_order_id, 
                razorpay_payment_id, 
                razorpay_signature 
            } = req.body;

            // Validate required fields
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required payment fields: razorpay_order_id, razorpay_payment_id, razorpay_signature"
                });
            }

            // Verify payment signature
            const isValidSignature = RazorpayService.verifyPaymentSignature({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            });

            if (!isValidSignature) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment signature. Payment verification failed."
                });
            }

            // Find booking by Razorpay order ID
            const booking = await StylistBooking.findOne({
                razorpayOrderId: razorpay_order_id
            })
                .populate('stylistId', 'stylistName stylistImage userId')
                .populate('userId', 'displayName email phoneNumber');

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found for this payment"
                });
            }

            // Check if payment already processed
            if (booking.paymentStatus === 'completed') {
                return res.status(200).json({
                    success: true,
                    message: "Payment already verified and booking confirmed",
                    data: {
                        bookingId: booking._id,
                        paymentStatus: booking.paymentStatus,
                        bookingStatus: booking.status,
                        paymentId: booking.razorpayPaymentId
                    }
                });
            }

            // Update booking with payment details and confirm
            booking.razorpayPaymentId = razorpay_payment_id;
            booking.razorpaySignature = razorpay_signature;
            booking.paymentStatus = 'completed';
            booking.paymentCompletedAt = new Date();
            booking.status = 'confirmed';
            booking.updatedAt = new Date();

            await booking.save();

            // Send notifications
            try {
                // Notify user
                const userNotification = {
                    userId: booking.userId._id,
                    title: "Booking Confirmed! 🎉",
                    message: `Your booking with ${booking.stylistId.stylistName} has been confirmed. Payment received successfully.`,
                    type: "booking_confirmed",
                    data: {
                        bookingId: booking._id,
                        stylistName: booking.stylistId.stylistName,
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime,
                        paymentAmount: booking.paymentAmount
                    }
                };

                await createNotification(userNotification);
                await sendFcmNotification(userNotification);

                // Notify stylist
                const stylistNotification = {
                    userId: booking.stylistId.userId,
                    title: "New Booking Received! 📅",
                    message: `You have a new confirmed booking from ${booking.userId.displayName}.`,
                    type: "new_booking_received",
                    data: {
                        bookingId: booking._id,
                        userName: booking.userId.displayName,
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime,
                        bookingType: booking.bookingType
                    }
                };

                await createNotification(stylistNotification);
                await sendFcmNotification(stylistNotification);

            } catch (notificationError) {
                console.error("Notification error:", notificationError);
                // Don't fail the payment if notifications fail
            }

            return res.status(200).json({
                success: true,
                message: "Payment verified successfully. Booking confirmed!",
                data: {
                    bookingId: booking._id,
                    bookingIdString: booking.bookingId,
                    paymentStatus: 'completed',
                    bookingStatus: 'confirmed',
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    bookingDetails: {
                        bookingTitle: booking.bookingTitle,
                        bookingType: booking.bookingType,
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime,
                        duration: booking.duration,
                        stylistName: booking.stylistId.stylistName,
                        paymentAmount: booking.paymentAmount
                    },
                    confirmedAt: booking.paymentCompletedAt
                }
            });

        } catch (error) {
            console.error("Payment verification error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to verify payment",
                error: error.message
            });
        }
    }

    /**
     * Create booking and initiate payment in one step
     * Creates a booking and immediately initiates Razorpay payment
     * 
     * POST /api/stylist-booking/create-and-pay
     * Headers: Authorization: Bearer <token>
     * Body: { stylistId, bookingType, bookingTitle, bookingDescription, scheduledDate, scheduledTime, duration }
     */
    static async createBookingAndInitiatePayment(req, res) {
        try {
            const {
                stylistId,
                bookingType = 'consultation',
                bookingTitle,
                bookingDescription,
                scheduledDate,
                scheduledTime,
                duration = 60
            } = req.body;

            const userId = req.user._id;

            // Validate required fields
            if (!stylistId || !bookingTitle || !bookingDescription || !scheduledDate || !scheduledTime) {
                return res.status(400).json({
                    success: false,
                    message: "All required fields must be provided: stylistId, bookingTitle, bookingDescription, scheduledDate, scheduledTime"
                });
            }

            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(stylistId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid stylist ID format"
                });
            }

            // Check if stylist exists and is approved
            const stylist = await StylistProfile.findOne({
                _id: stylistId,
                applicationStatus: 'approved',
                isApproved: true
            });

            if (!stylist) {
                return res.status(404).json({
                    success: false,
                    message: "Stylist not found or not approved"
                });
            }

            // Check if slot is available
            const slotDate = new Date(scheduledDate);
            const StylistAvailability = require("../models/stylistAvailability");
            const availability = await StylistAvailability.findOne({ stylistId });

            if (availability && !availability.isAvailableAt(slotDate, scheduledTime)) {
                return res.status(400).json({
                    success: false,
                    message: "Selected time slot is not available"
                });
            }

            // Check for existing bookings at the same time
            const existingBooking = await StylistBooking.findOne({
                stylistId,
                scheduledDate: slotDate,
                scheduledTime,
                status: { $in: ['confirmed', 'in_progress'] }
            });

            if (existingBooking) {
                return res.status(400).json({
                    success: false,
                    message: "Time slot is already booked"
                });
            }

            // Calculate payment amount
            const paymentAmount = stylist.stylistPrice || 1000; // Default price

            // Create booking
            const booking = new StylistBooking({
                userId,
                stylistId,
                bookingType,
                bookingTitle,
                bookingDescription,
                scheduledDate: slotDate,
                scheduledTime,
                duration,
                paymentAmount,
                status: 'pending',
                paymentStatus: 'pending'
            });

            await booking.save();

            // Create Razorpay order
            const orderData = {
                amount: paymentAmount,
                currency: 'INR',
                receipt: `booking_${booking._id}_${Date.now()}`,
                notes: {
                    bookingId: booking._id.toString(),
                    userId: userId.toString(),
                    stylistId: stylistId,
                    bookingType: bookingType
                },
                customerDetails: {
                    name: req.user.displayName || 'Customer',
                    email: req.user.email || '',
                    contact: req.user.phoneNumber || ''
                }
            };

            const orderResult = await RazorpayService.createOrder(orderData);

            if (!orderResult.success) {
                // If payment order creation fails, booking still exists but payment is pending
                return res.status(500).json({
                    success: false,
                    message: "Booking created but failed to initiate payment",
                    error: orderResult.message,
                    data: {
                        bookingId: booking._id,
                        bookingStatus: booking.status,
                        paymentStatus: booking.paymentStatus
                    }
                });
            }

            // Update booking with payment order details
            booking.razorpayOrderId = orderResult.data.orderId;
            booking.paymentStatus = 'processing';
            booking.updatedAt = new Date();
            await booking.save();

            // Generate client payment options
            const paymentOptions = RazorpayService.generatePaymentOptions({
                ...orderResult.data,
                name: 'IndigoRhapsody',
                description: `Stylist Booking - ${bookingTitle}`,
                customerName: req.user.displayName || 'Customer',
                customerEmail: req.user.email || '',
                customerPhone: req.user.phoneNumber || ''
            });

            return res.status(201).json({
                success: true,
                message: "Booking created and payment initiated successfully",
                data: {
                    bookingId: booking._id,
                    bookingIdString: booking.bookingId,
                    orderId: orderResult.data.orderId,
                    amount: paymentAmount,
                    currency: 'INR',
                    paymentOptions: paymentOptions,
                    expiresIn: 1800, // 30 minutes
                    bookingDetails: {
                        bookingTitle: booking.bookingTitle,
                        bookingType: booking.bookingType,
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime,
                        duration: booking.duration,
                        stylistName: stylist.stylistName,
                        status: booking.status,
                        paymentStatus: booking.paymentStatus
                    },
                    nextStep: "Complete payment to confirm your booking"
                }
            });

        } catch (error) {
            console.error("Create booking and initiate payment error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to create booking and initiate payment",
                error: error.message
            });
        }
    }

    /**
     * Get payment status for a booking
     * 
     * GET /api/stylist-booking/payment/status/:bookingId
     * Headers: Authorization: Bearer <token>
     */
    static async getPaymentStatus(req, res) {
        try {
            const { bookingId } = req.params;
            const userId = req.user._id;

            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID format"
                });
            }

            // Find booking
            const booking = await StylistBooking.findById(bookingId)
                .populate('stylistId', 'stylistName stylistImage')
                .populate('userId', 'displayName email');

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Check authorization
            if (booking.userId._id.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            // If payment is completed, verify with Razorpay
            let razorpayPaymentDetails = null;
            if (booking.paymentStatus === 'completed' && booking.razorpayPaymentId) {
                try {
                    const paymentDetails = await RazorpayService.getPaymentDetails(
                        booking.razorpayPaymentId
                    );
                    if (paymentDetails.success) {
                        razorpayPaymentDetails = paymentDetails.data;
                    }
                } catch (error) {
                    console.error("Error fetching Razorpay payment details:", error);
                }
            }

            return res.status(200).json({
                success: true,
                message: "Payment status retrieved successfully",
                data: {
                    bookingId: booking._id,
                    bookingIdString: booking.bookingId,
                    paymentStatus: booking.paymentStatus,
                    bookingStatus: booking.status,
                    paymentAmount: booking.paymentAmount,
                    paymentCurrency: booking.paymentCurrency,
                    razorpayOrderId: booking.razorpayOrderId,
                    razorpayPaymentId: booking.razorpayPaymentId,
                    paymentCompletedAt: booking.paymentCompletedAt,
                    razorpayPaymentDetails: razorpayPaymentDetails,
                    canRetryPayment: booking.paymentStatus !== 'completed' && 
                                    booking.status === 'pending',
                    bookingDetails: {
                        bookingTitle: booking.bookingTitle,
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime,
                        stylistName: booking.stylistId.stylistName
                    }
                }
            });

        } catch (error) {
            console.error("Get payment status error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get payment status",
                error: error.message
            });
        }
    }
}

module.exports = RazorpayBookingController;


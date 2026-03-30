const mongoose = require("mongoose");
const StylistBooking = require("../models/stylistBooking");
const StylistProfile = require("../models/stylistProfile");
const StylistAvailability = require("../models/stylistAvailability");
const { Chat, Message } = require("../models/chat");
const RazorpayService = require("../service/razorpayService");
const AgoraService = require("../service/agoraService");
const { createNotification, sendFcmNotification } = require("./notificationController");

class StylistBookingController {

    /**
     * Get available time slots for a stylist
     */
    static async getAvailableSlots(req, res) {
        try {
            const { stylistId } = req.params;
            const { date, duration = 60 } = req.query;

            if (!stylistId || !date) {
                return res.status(400).json({
                    success: false,
                    message: "Stylist ID and date are required"
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

            // Get stylist availability
            let availability = await StylistAvailability.findOne({ stylistId });

            if (!availability) {
                // Create default availability if not exists
                availability = new StylistAvailability({
                    stylistId,
                    isActive: true,
                    weeklySchedule: {
                        monday: { isAvailable: true, startTime: "09:00", endTime: "18:00", breaks: [] },
                        tuesday: { isAvailable: true, startTime: "09:00", endTime: "18:00", breaks: [] },
                        wednesday: { isAvailable: true, startTime: "09:00", endTime: "18:00", breaks: [] },
                        thursday: { isAvailable: true, startTime: "09:00", endTime: "18:00", breaks: [] },
                        friday: { isAvailable: true, startTime: "09:00", endTime: "18:00", breaks: [] },
                        saturday: { isAvailable: true, startTime: "09:00", endTime: "18:00", breaks: [] },
                        sunday: { isAvailable: false, startTime: "09:00", endTime: "18:00", breaks: [] }
                    },
                    dateOverrides: [],
                    bookingPreferences: {
                        minAdvanceBooking: 2,
                        maxAdvanceBooking: 30,
                        slotDuration: 60,
                        maxBookingsPerDay: 8,
                        bufferTime: 15
                    }
                });
                await availability.save();
            }

            // Get available slots
            const availableSlots = availability.getAvailableSlots(new Date(date), duration);

            // Filter out slots that are already booked
            const existingBookings = await StylistBooking.find({
                stylistId,
                scheduledDate: new Date(date),
                status: { $in: ['confirmed', 'in_progress'] }
            });

            const filteredSlots = availableSlots.filter(slot => {
                return !existingBookings.some(booking => {
                    const bookingStart = new Date(booking.scheduledDate);
                    const [bookingHour, bookingMinute] = booking.scheduledTime.split(':');
                    bookingStart.setHours(parseInt(bookingHour), parseInt(bookingMinute), 0, 0);

                    const bookingEnd = new Date(bookingStart.getTime() + (booking.duration * 60000));
                    const slotStart = new Date(slot.datetime);
                    const slotEnd = new Date(slotStart.getTime() + (duration * 60000));

                    return (slotStart < bookingEnd && slotEnd > bookingStart);
                });
            });

            return res.status(200).json({
                success: true,
                message: "Available slots retrieved successfully",
                data: {
                    stylistId,
                    date,
                    duration,
                    availableSlots: filteredSlots,
                    totalSlots: filteredSlots.length
                }
            });

        } catch (error) {
            console.error("Get available slots error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get available slots",
                error: error.message
            });
        }
    }

    /**
     * Create a new booking
     */
    static async createBooking(req, res) {
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
                    message: "All required fields must be provided"
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
            const availability = await StylistAvailability.findOne({ stylistId });

            // Check availability if it exists, but don't fail if check throws an error
            if (availability) {
                try {
                    const isAvailable = availability.isAvailableAt(slotDate, scheduledTime);
                    if (!isAvailable) {
                        return res.status(400).json({
                            success: false,
                            message: "Selected time slot is not available"
                        });
                    }
                } catch (availabilityError) {
                    // If availability check fails (e.g., day schedule not configured),
                    // log the error but continue with booking creation
                    console.warn("Availability check failed, proceeding with booking:", availabilityError.message);
                }
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
                status: 'pending'
            });

            await booking.save();

            // Create chat between user and stylist
            const chatResult = await Chat.findOrCreateChat(userId, stylistId, booking._id);

            if (chatResult.success) {
                // Send system message about booking creation
                const systemMessage = new Message({
                    chatId: chatResult.data._id,
                    senderId: userId,
                    content: `New booking created: ${bookingTitle}`,
                    messageType: 'system',
                    systemData: {
                        type: 'booking_created',
                        bookingId: booking._id,
                        metadata: {
                            bookingType,
                            scheduledDate: slotDate,
                            scheduledTime,
                            duration
                        }
                    }
                });
                await systemMessage.save();
            }

            return res.status(201).json({
                success: true,
                message: "Booking created successfully. Please complete payment to confirm.",
                data: {
                    bookingId: booking._id,
                    bookingType: booking.bookingType,
                    scheduledDate: booking.scheduledDate,
                    scheduledTime: booking.scheduledTime,
                    duration: booking.duration,
                    paymentAmount: booking.paymentAmount,
                    status: booking.status,
                    nextStep: 'payment'
                }
            });

        } catch (error) {
            console.error("Create booking error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to create booking",
                error: error.message
            });
        }
    }

    /**
     * Initiate payment for booking
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
            const booking = await StylistBooking.findById(bookingId).populate('stylistId');

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Check if booking belongs to user
            if (booking.userId.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            // Check booking status
            if (booking.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: `Booking cannot be paid for. Current status: ${booking.status}`
                });
            }

            if (booking.paymentStatus === 'completed') {
                return res.status(400).json({
                    success: false,
                    message: "Payment already completed for this booking"
                });
            }

            // Create Razorpay order
            const orderData = {
                amount: booking.paymentAmount,
                currency: 'INR',
                receipt: `booking_${bookingId}`,
                notes: {
                    bookingId: bookingId,
                    userId: userId.toString(),
                    stylistId: booking.stylistId.toString(),
                    bookingType: booking.bookingType
                },
                customerDetails: {
                    name: req.user.displayName,
                    email: req.user.email,
                    contact: req.user.phoneNumber
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

            // Update booking with payment details
            booking.razorpayOrderId = orderResult.data.orderId;
            booking.paymentStatus = 'processing';
            booking.updatedAt = new Date();

            await booking.save();

            // Generate client payment options
            const paymentOptions = RazorpayService.generatePaymentOptions({
                ...orderResult.data,
                name: 'IndigoRhapsody',
                description: `Stylist Booking - ${booking.bookingTitle}`,
                customerName: req.user.displayName,
                customerEmail: req.user.email,
                customerPhone: req.user.phoneNumber
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
                    expiresIn: 1800 // 30 minutes
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

    static async testCreateAgoraSession(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();
      
        try {
          const { bookingId } = req.params;
          const userId = req.user._id;
      
          // 1️⃣ Validate booking
          const booking = await StylistBooking.findById(bookingId)
            .populate("stylistId userId")
            .session(session);
      
          if (!booking) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
              success: false,
              message: "Booking not found"
            });
          }
      
          // 2️⃣ Ownership check (user or stylist)
        //   const isUser =
        //   booking.userId._id.toString() === userId.toString();
        
        // const isStylist =
        //   booking.stylistId._id.toString() === userId.toString();
        
      
        //   if (!isUser && !isStylist) {
        //     await session.abortTransaction();
        //     session.endSession();
        //     return res.status(403).json({
        //       success: false,
        //       message: "Unauthorized"
        //     });
        //   }
      
          // 3️⃣ Guard: don’t override real paid bookings
          if (booking.paymentStatus === "completed") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: "Paid booking already exists. Test session not allowed."
            });
          }
      
          // 4️⃣ Idempotency
          if (booking.videoCallStatus === "scheduled") {
            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({
              success: true,
              message: "Session already scheduled",
              data: {
                channelName: booking.agoraChannelName,
                sessionScheduledAt: booking.sessionScheduledAt,
                sessionEndsAt: booking.sessionEndsAt
              }
            });
          }
      
          // 5️⃣ Schedule session
          const scheduledStart = booking.scheduledDateTime;
          const scheduledEnd = new Date(
            scheduledStart.getTime() + booking.duration * 60000
          );
      
          booking.isTestBooking = true;
          booking.status = "confirmed";
          booking.paymentStatus = "test";
          booking.videoCallStatus = "scheduled";
          booking.sessionScheduledAt = scheduledStart;
          booking.sessionEndsAt = scheduledEnd;
          booking.agoraChannelName = AgoraService.generateChannelName(
            booking.bookingId
          );
          booking.updatedAt = new Date();
      
          await booking.save({ session });
      
          await session.commitTransaction();
          session.endSession();
      
          return res.status(200).json({
            success: true,
            message: "Test Agora session created successfully",
            data: {
              bookingId: booking._id,
              channelName: booking.agoraChannelName,
              sessionScheduledAt: booking.sessionScheduledAt,
              sessionEndsAt: booking.sessionEndsAt,
              isTestBooking: true
            }
          });
      
        } catch (error) {
          await session.abortTransaction();
          session.endSession();
      
          console.error("Test Agora session error:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to create test Agora session",
            error: error.message
          });
        }
      }
      

 
    static async handlePaymentCallback(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();
      
        try {
          const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
          } = req.body;
      
          // 1️⃣ Verify Razorpay signature
          const isValidSignature = RazorpayService.verifyPaymentSignature({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
          });
      
          if (!isValidSignature) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: "Invalid payment signature"
            });
          }
      
          // 2️⃣ Find booking
          const booking = await StylistBooking.findOne({
            razorpayOrderId: razorpay_order_id
          })
            .populate("stylistId userId")
            .session(session);
      
          if (!booking) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
              success: false,
              message: "Booking not found for this payment"
            });
          }
      
          // 3️⃣ Idempotency guard (MOST IMPORTANT)
          if (booking.paymentStatus === "completed") {
            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({
              success: true,
              message: "Payment already processed",
              data: {
                bookingId: booking._id,
                bookingStatus: booking.status,
                paymentStatus: booking.paymentStatus
              }
            });
          }
      
          // 4️⃣ Prevent confirming invalid bookings
          if (booking.isCancelled || booking.status === "cancelled") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: "Booking is cancelled. Payment cannot be applied."
            });
          }
      
          // 5️⃣ Update payment info
          booking.razorpayPaymentId = razorpay_payment_id;
          booking.razorpaySignature = razorpay_signature;
          booking.paymentStatus = "completed";
          booking.paymentCompletedAt = new Date();
          booking.status = "confirmed";
          booking.updatedAt = new Date();
      
          // 6️⃣ Schedule session ONLY IF NOT ALREADY SCHEDULED
          if (!booking.agoraChannelName) {
            const scheduledStart = booking.scheduledDateTime;
            const scheduledEnd = new Date(
              scheduledStart.getTime() + booking.duration * 60000
            );
      
            const channelName = AgoraService.generateChannelName(
              booking.bookingId // BOOK_xxx
            );
      
            booking.agoraChannelName = channelName;
            booking.videoCallStatus = "scheduled";
            booking.sessionScheduledAt = scheduledStart;
            booking.sessionEndsAt = scheduledEnd;
          }
      
          await booking.save({ session });
      
          await session.commitTransaction();
          session.endSession();
      
          // 7️⃣ Notifications (OUTSIDE transaction)
          try {
            await createNotification({
              userId: booking.userId._id,
              title: "Booking Confirmed",
              message: `Your booking with ${booking.stylistId.stylistName} has been confirmed.`,
              type: "booking_confirmed",
              data: {
                bookingId: booking._id,
                scheduledDate: booking.scheduledDate,
                scheduledTime: booking.scheduledTime
              }
            });
      
            await sendFcmNotification({
              userId: booking.userId._id,
              title: "Booking Confirmed",
              message: `Your booking with ${booking.stylistId.stylistName} has been confirmed.`,
              type: "booking_confirmed"
            });
      
            await createNotification({
              userId: booking.stylistId.userId,
              title: "New Booking Received",
              message: `You have a new booking from ${booking.userId.displayName}.`,
              type: "new_booking_received",
              data: {
                bookingId: booking._id
              }
            });
      
            await sendFcmNotification({
              userId: booking.stylistId.userId,
              title: "New Booking Received",
              message: `You have a new booking from ${booking.userId.displayName}.`,
              type: "new_booking_received"
            });
      
          } catch (notificationError) {
            console.error("Notification error:", notificationError);
          }
      
          return res.status(200).json({
            success: true,
            message: "Payment completed successfully. Booking confirmed.",
            data: {
              bookingId: booking._id,
              bookingStatus: booking.status,
              paymentStatus: booking.paymentStatus,
              sessionScheduledAt: booking.sessionScheduledAt,
              sessionEndsAt: booking.sessionEndsAt
            }
          });
      
        } catch (error) {
          await session.abortTransaction();
          session.endSession();
      
          console.error("Payment callback error:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to process payment callback",
            error: error.message
          });
        }
      }
      

    /**
     * Get user's bookings
     * Accepts userId as query parameter for reliability
     */
    static async getUserBookings(req, res) {
        try {
            const { userId, page = 1, limit = 10, status } = req.query;

            // Validate userId is provided
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: "userId is required as query parameter"
                });
            }

            // Validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid userId format"
                });
            }

            // Validate and parse pagination parameters
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (isNaN(pageNum) || pageNum < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid page number. Must be a positive integer"
                });
            }

            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid limit. Must be between 1 and 100"
                });
            }

            const skip = (pageNum - 1) * limitNum;

            // Build query
            let query = { userId: new mongoose.Types.ObjectId(userId) };
            if (status) {
                const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'];
                if (validStatuses.includes(status)) {
                    query.status = status;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                    });
                }
            }

            // Fetch bookings with populated fields
            const bookings = await StylistBooking.find(query)
                .populate('userId', 'displayName email phoneNumber _id')
                .populate('stylistId', 'stylistName stylistImage stylistBio stylistPhone stylistEmail stylistCity stylistState _id')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum);

            // Get total count for pagination
            const totalBookings = await StylistBooking.countDocuments(query);

            return res.status(200).json({
                success: true,
                message: "User bookings retrieved successfully",
                data: {
                    bookings,
                    pagination: {
                        currentPage: pageNum,
                        totalPages: Math.ceil(totalBookings / limitNum),
                        totalBookings,
                        limit: limitNum,
                        hasNextPage: skip + bookings.length < totalBookings,
                        hasPrevPage: pageNum > 1
                    }
                }
            });

        } catch (error) {
            console.error("Get user bookings error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get user bookings",
                error: error.message
            });
        }
    }

    /**
     * Get stylist's bookings
     */
    static async getStylistBookings(req, res) {
        try {
            const stylistId = req.user._id; // Assuming user is stylist
            const { page = 1, limit = 10, status } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            let query = { stylistId };
            if (status) {
                query.status = status;
            }

            const bookings = await StylistBooking.find(query)
                .populate('userId', 'displayName email phoneNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const totalBookings = await StylistBooking.countDocuments(query);

            return res.status(200).json({
                success: true,
                message: "Stylist bookings retrieved successfully",
                data: {
                    bookings,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalBookings / parseInt(limit)),
                        totalBookings,
                        hasNextPage: skip + bookings.length < totalBookings,
                        hasPrevPage: parseInt(page) > 1
                    }
                }
            });

        } catch (error) {
            console.error("Get stylist bookings error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get stylist bookings",
                error: error.message
            });
        }
    }

    /**
     * Start video call
     */
    static async startVideoCall(req, res) {
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
                .populate('stylistId userId');

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Check if user is authorized (either user or stylist)
            const isUser = booking.userId._id.toString() === userId.toString();
            const isStylist = booking.stylistId.userId.toString() === userId.toString();

            if (!isUser && !isStylist) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            if (!["completed", "test"].includes(booking.paymentStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Payment not completed"
                });
            }

            // Check booking status
            if (!['confirmed', 'in_progress'].includes(booking.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Video call cannot be started. Booking status: ${booking.status}`
                });
            }

            // Check if it's time for the call (allow 15 minutes before scheduled time)
            const now = new Date();
            const callTime = new Date(booking.scheduledDate);
            const [hours, minutes] = booking.scheduledTime.split(':');
            callTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const timeUntilCall = (callTime - now) / (1000 * 60); // minutes

            if (timeUntilCall > 15) {
                return res.status(400).json({
                    success: false,
                    message: "Video call can only be started 15 minutes before scheduled time"
                });
            }

            const role = isUser ? "user" : "stylist";
            const tokenResult = AgoraService.generateBookingSessionTokens({
                booking,
                userId,
                role
            });

            if (!tokenResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to generate video call tokens",
                    error: tokenResult.message
                });
            }

            const d = tokenResult.data;

            booking.videoCallStatus = "in_progress";
            booking.agoraChannelName = d.channelName;
            booking.agoraAppId = d.appId;
            booking.agoraToken = d.rtcToken;
            if (!booking.videoCallStartedAt) {
                booking.videoCallStartedAt = new Date();
            }
            booking.status = "in_progress";
            booking.updatedAt = new Date();

            await booking.save();

            return res.status(200).json({
                success: true,
                message: "Video call initiated successfully — same channel as POST /booking-video/.../join-session",
                data: {
                    bookingMongoId: booking._id,
                    bookingIdString: booking.bookingId,
                    ...d,
                    connection: {
                        sameChannelForVideoAndChat: true,
                        channelName: d.channelName,
                        video: {
                            appId: d.appId,
                            channelName: d.channelName,
                            token: d.rtcToken,
                            uid: d.rtcUid
                        },
                        chat: {
                            appId: d.appId,
                            channelName: d.channelName,
                            token: d.rtmToken,
                            uid: d.rtmUid
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Start video call error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to start video call",
                error: error.message
            });
        }
    }

    /**
     * End video call
     */
    static async endVideoCall(req, res) {
        try {
            const { bookingId } = req.params;
            const userId = req.user._id;

            // Find booking
            const booking = await StylistBooking.findById(bookingId);

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Check authorization
            const isUser = booking.userId.toString() === userId.toString();
            const isStylist = booking.stylistId.toString() === userId.toString();

            if (!isUser && !isStylist) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            // Update booking
            const callEndTime = new Date();
            const callDuration = booking.videoCallStartedAt ?
                Math.round((callEndTime - booking.videoCallStartedAt) / (1000 * 60)) : 0;

            booking.videoCallStatus = 'ended';
            booking.videoCallEndedAt = callEndTime;
            booking.videoCallDuration = callDuration;
            booking.status = 'completed';
            booking.completedAt = callEndTime;
            booking.updatedAt = callEndTime;

            await booking.save();

            return res.status(200).json({
                success: true,
                message: "Video call ended successfully",
                data: {
                    bookingId: booking._id,
                    callDuration: callDuration,
                    endedAt: callEndTime
                }
            });

        } catch (error) {
            console.error("End video call error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to end video call",
                error: error.message
            });
        }
    }

    /**
     * Reschedule booking
     */
    static async rescheduleBooking(req, res) {
        try {
            const { bookingId } = req.params;
            const { newDate, newTime, reason } = req.body;
            const userId = req.user._id;

            // Find booking
            const booking = await StylistBooking.findById(bookingId);

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Check authorization
            if (booking.userId.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            // Check if booking can be rescheduled
            if (!booking.canBeRescheduled) {
                return res.status(400).json({
                    success: false,
                    message: "Booking cannot be rescheduled at this time"
                });
            }

            // Create new booking for rescheduled time
            const rescheduledBooking = new StylistBooking({
                ...booking.toObject(),
                _id: new mongoose.Types.ObjectId(),
                scheduledDate: new Date(newDate),
                scheduledTime: newTime,
                isRescheduled: true,
                originalBookingId: booking._id,
                rescheduleReason: reason,
                rescheduledAt: new Date(),
                rescheduledBy: userId,
                status: 'pending',
                paymentStatus: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await rescheduledBooking.save();

            // Update original booking
            booking.status = 'rescheduled';
            booking.updatedAt = new Date();
            await booking.save();

            return res.status(200).json({
                success: true,
                message: "Booking rescheduled successfully",
                data: {
                    originalBookingId: booking._id,
                    rescheduledBookingId: rescheduledBooking._id,
                    newDate: rescheduledBooking.scheduledDate,
                    newTime: rescheduledBooking.scheduledTime,
                    reason: reason
                }
            });

        } catch (error) {
            console.error("Reschedule booking error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to reschedule booking",
                error: error.message
            });
        }
    }

    /**
     * Cancel booking
     */
    static async cancelBooking(req, res) {
        try {
            const { bookingId } = req.params;
            const { reason } = req.body;
            const userId = req.user._id;

            // Find booking
            const booking = await StylistBooking.findById(bookingId);

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            // Check authorization
            if (booking.userId.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            // Check if booking can be cancelled
            if (!booking.canBeCancelled) {
                return res.status(400).json({
                    success: false,
                    message: "Booking cannot be cancelled at this time"
                });
            }

            // Update booking
            booking.status = 'cancelled';
            booking.isCancelled = true;
            booking.cancellationReason = reason;
            booking.cancelledAt = new Date();
            booking.cancelledBy = userId;
            booking.updatedAt = new Date();

            await booking.save();

            // Process refund if payment was completed
            if (booking.paymentStatus === 'completed' && booking.razorpayPaymentId) {
                try {
                    const refundResult = await RazorpayService.createRefund(
                        booking.razorpayPaymentId,
                        booking.paymentAmount,
                        `Booking cancellation - ${reason}`
                    );

                    if (refundResult.success) {
                        booking.paymentStatus = 'refunded';
                        await booking.save();
                    }
                } catch (refundError) {
                    console.error("Refund error:", refundError);
                }
            }

            return res.status(200).json({
                success: true,
                message: "Booking cancelled successfully",
                data: {
                    bookingId: booking._id,
                    status: booking.status,
                    cancelledAt: booking.cancelledAt,
                    reason: reason
                }
            });

        } catch (error) {
            console.error("Cancel booking error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to cancel booking",
                error: error.message
            });
        }
    }

    /**
     * Get user's upcoming sessions
     * Returns upcoming bookings that are scheduled in the future
     * Returns dummy data if no bookings exist
     */
    static async getUpcomingSessions(req, res) {
        try {
            // Get userId from request body or query parameters
            const userId = req.body.userId || req.query.userId;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: "User ID is required. Please provide userId in request body or query parameters."
                });
            }
            
            // Convert userId to ObjectId if it's a string
            let userIdObjectId;
            try {
                userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
                    ? new mongoose.Types.ObjectId(userId) 
                    : userId;
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID format"
                });
            }
            
            const { limit = 10 } = req.query;

            const now = new Date();

            // Build query for upcoming sessions
            // Get bookings that are scheduled in the future and not cancelled/completed
            const query = {
                userId: userIdObjectId,
                status: { $in: ['pending', 'confirmed', 'in_progress'] },
                isCancelled: false
            };

            // Get all bookings matching the query
            const allBookings = await StylistBooking.find(query)
                .populate('stylistId', 'stylistName stylistImage stylistBio stylistCity stylistState stylistPhone stylistEmail')
                .sort({ scheduledDate: 1, scheduledTime: 1 });

            // Filter for upcoming sessions (scheduled date/time in the future)
            const upcomingSessions = allBookings.filter(booking => {
                const scheduledDate = new Date(booking.scheduledDate);
                const [hours, minutes] = booking.scheduledTime.split(':');
                scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                return scheduledDate > now;
            });

            // Limit results
            const limitedSessions = upcomingSessions.slice(0, parseInt(limit));

            // If no upcoming sessions, return dummy data
            if (limitedSessions.length === 0) {
                const dummySessions = [
                    {
                        _id: "507f1f77bcf86cd799439011",
                        bookingId: "BOOK_1703123456789_abc123def",
                        userId: userId,
                        stylistId: {
                            _id: "507f191e810c19729de860ea",
                            stylistName: "Sarah's Fashion Studio",
                            stylistImage: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400",
                            stylistBio: "Professional stylist with 8+ years of experience",
                            stylistCity: "Mumbai",
                            stylistState: "Maharashtra",
                            stylistPhone: "+1234567890",
                            stylistEmail: "sarah.stylist@example.com"
                        },
                        bookingType: "consultation",
                        bookingTitle: "Personal Styling Consultation",
                        bookingDescription: "Initial consultation to understand your style preferences and fashion goals",
                        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
                        scheduledTime: "14:00",
                        duration: 60,
                        timezone: "Asia/Kolkata",
                        status: "confirmed",
                        paymentStatus: "completed",
                        paymentAmount: 2000,
                        paymentCurrency: "INR",
                        paymentMethod: "razorpay",
                        videoCallStatus: "not_started",
                        isRescheduled: false,
                        isCancelled: false,
                        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
                    },
                    {
                        _id: "507f1f77bcf86cd799439012",
                        bookingId: "BOOK_1703123456790_def456ghi",
                        userId: userId,
                        stylistId: {
                            _id: "507f191e810c19729de860eb",
                            stylistName: "Michael's Style Lab",
                            stylistImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
                            stylistBio: "Award-winning stylist specializing in contemporary fashion",
                            stylistCity: "Delhi",
                            stylistState: "Delhi",
                            stylistPhone: "+1234567891",
                            stylistEmail: "michael.stylist@example.com"
                        },
                        bookingType: "styling_session",
                        bookingTitle: "Complete Wardrobe Makeover",
                        bookingDescription: "Full wardrobe consultation and styling session",
                        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                        scheduledTime: "10:00",
                        duration: 120,
                        timezone: "Asia/Kolkata",
                        status: "confirmed",
                        paymentStatus: "completed",
                        paymentAmount: 5000,
                        paymentCurrency: "INR",
                        paymentMethod: "razorpay",
                        videoCallStatus: "not_started",
                        isRescheduled: false,
                        isCancelled: false,
                        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                    },
                    {
                        _id: "507f1f77bcf86cd799439013",
                        bookingId: "BOOK_1703123456791_jkl789mno",
                        userId: userId,
                        stylistId: {
                            _id: "507f191e810c19729de860ec",
                            stylistName: "Emma's Wardrobe Consulting",
                            stylistImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
                            stylistBio: "Expert in wardrobe optimization and sustainable fashion",
                            stylistCity: "Bangalore",
                            stylistState: "Karnataka",
                            stylistPhone: "+1234567892",
                            stylistEmail: "emma.stylist@example.com"
                        },
                        bookingType: "makeover",
                        bookingTitle: "Special Event Makeover",
                        bookingDescription: "Complete makeover for upcoming special event",
                        scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                        scheduledTime: "16:00",
                        duration: 90,
                        timezone: "Asia/Kolkata",
                        status: "pending",
                        paymentStatus: "pending",
                        paymentAmount: 3500,
                        paymentCurrency: "INR",
                        paymentMethod: "razorpay",
                        videoCallStatus: "not_started",
                        isRescheduled: false,
                        isCancelled: false,
                        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                    }
                ];

                // Limit dummy data
                const limitedDummySessions = dummySessions.slice(0, parseInt(limit));

                return res.status(200).json({
                    success: true,
                    message: "Upcoming sessions retrieved successfully (dummy data - no actual bookings found)",
                    data: {
                        upcomingSessions: limitedDummySessions,
                        totalUpcoming: limitedDummySessions.length,
                        isDummyData: true
                    }
                });
            }

            // Format sessions with additional calculated fields
            const formattedSessions = limitedSessions.map(booking => {
                const scheduledDate = new Date(booking.scheduledDate);
                const [hours, minutes] = booking.scheduledTime.split(':');
                scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                const now = new Date();
                const hoursUntilBooking = Math.floor((scheduledDate - now) / (1000 * 60 * 60));
                const daysUntilBooking = Math.floor(hoursUntilBooking / 24);

                return {
                    ...booking.toObject(),
                    scheduledDateTime: scheduledDate,
                    hoursUntilBooking: hoursUntilBooking,
                    daysUntilBooking: daysUntilBooking,
                    isUpcoming: true,
                    canBeCancelled: booking.status === 'confirmed' && 
                                   booking.paymentStatus === 'completed' && 
                                   !booking.isCancelled && 
                                   hoursUntilBooking > 2,
                    canBeRescheduled: booking.status === 'confirmed' && 
                                     booking.paymentStatus === 'completed' && 
                                     !booking.isCancelled && 
                                     !booking.isRescheduled && 
                                     hoursUntilBooking > 24
                };
            });

            return res.status(200).json({
                success: true,
                message: "Upcoming sessions retrieved successfully",
                data: {
                    upcomingSessions: formattedSessions,
                    totalUpcoming: upcomingSessions.length,
                    isDummyData: false
                }
            });

        } catch (error) {
            console.error("Get upcoming sessions error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get upcoming sessions",
                error: error.message
            });
        }
    }

    /**
     * Get past sessions for authenticated user
     * GET /stylist-booking/past-sessions
     */
    static async getPastSessions(req, res) {
        try {
            const userId = req.user?._id || req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
            const skip = (page - 1) * limit;
            const now = new Date();

            const query = {
                userId,
                $or: [
                    { status: { $in: ["completed", "cancelled", "no_show"] } },
                    { scheduledDate: { $lt: now }, status: { $nin: ["pending", "confirmed", "in_progress"] } }
                ]
            };

            const [sessions, total] = await Promise.all([
                StylistBooking.find(query)
                    .populate(
                        "stylistId",
                        "stylistName stylistImage stylistBio stylistCity stylistState stylistPhone stylistEmail stylistRating"
                    )
                    .sort({ scheduledDate: -1, scheduledTime: -1 })
                    .skip(skip)
                    .limit(limit),
                StylistBooking.countDocuments(query)
            ]);

            const formatted = sessions.map((booking) => {
                const scheduledDateTime = new Date(booking.scheduledDate);
                if (booking.scheduledTime && booking.scheduledTime.includes(":")) {
                    const [h, m] = booking.scheduledTime.split(":").map(Number);
                    scheduledDateTime.setHours(h || 0, m || 0, 0, 0);
                }
                return {
                    ...booking.toObject(),
                    scheduledDateTime,
                    canReview:
                        booking.status === "completed" &&
                        (booking.userRating === null || booking.userRating === undefined)
                };
            });

            return res.status(200).json({
                success: true,
                message: "Past sessions retrieved successfully",
                data: {
                    sessions: formatted,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit) || 1,
                        hasNextPage: skip + formatted.length < total,
                        hasPrevPage: page > 1
                    }
                }
            });
        } catch (error) {
            console.error("Get past sessions error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to get past sessions",
                error: error.message
            });
        }
    }

    /**
     * Public: ratings summary + paginated reviews for a stylist (StylistProfile _id)
     * GET /stylist-booking/stylist/:stylistId/reviews
     */
    static async getStylistReviews(req, res) {
        try {
            const { stylistId } = req.params;
            const page = parseInt(req.query.page, 10) || 1;
            const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
            const skip = (page - 1) * limit;

            if (!mongoose.Types.ObjectId.isValid(stylistId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid stylist ID format"
                });
            }

            const profile = await StylistProfile.findById(stylistId).select(
                "stylistName stylistImage stylistRating bookingStats"
            );

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: "Stylist not found"
                });
            }

            const filter = {
                stylistId,
                userRating: { $exists: true, $ne: null }
            };

            const [reviews, total, distAgg] = await Promise.all([
                StylistBooking.find(filter)
                    .populate("userId", "displayName profilePicture")
                    .sort({ completedAt: -1, updatedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .select(
                        "userRating userReview completedAt updatedAt bookingTitle bookingType"
                    )
                    .lean(),
                StylistBooking.countDocuments(filter),
                StylistBooking.aggregate([
                    { $match: filter },
                    { $group: { _id: "$userRating", count: { $sum: 1 } } }
                ])
            ]);

            const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            distAgg.forEach((d) => {
                const k = d._id;
                if (k >= 1 && k <= 5) distribution[k] = d.count;
            });

            const avgFromProfile =
                profile.stylistRating ??
                profile.bookingStats?.averageRating ??
                0;

            return res.status(200).json({
                success: true,
                data: {
                    stylist: {
                        _id: profile._id,
                        stylistName: profile.stylistName,
                        stylistImage: profile.stylistImage,
                        averageRating: Number(avgFromProfile) || 0,
                        totalReviews: total
                    },
                    ratingDistribution: distribution,
                    reviews: reviews.map((r) => ({
                        bookingId: r._id,
                        bookingTitle: r.bookingTitle,
                        bookingType: r.bookingType,
                        rating: r.userRating,
                        review: r.userReview || "",
                        completedAt: r.completedAt,
                        client: r.userId
                            ? {
                                  displayName: r.userId.displayName || "Client",
                                  profilePicture: r.userId.profilePicture || null
                              }
                            : { displayName: "Client", profilePicture: null }
                    })),
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit) || 1,
                        hasNextPage: skip + reviews.length < total,
                        hasPrevPage: page > 1
                    }
                }
            });
        } catch (error) {
            console.error("getStylistReviews error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to load reviews",
                error: error.message
            });
        }
    }

    /**
     * Submit review and rating for a completed booking
     * POST /stylist-booking/:bookingId/review
     */
    static async submitReview(req, res) {
        try {
            const { bookingId } = req.params;
            const { rating, review } = req.body;
            const userId = req.user._id || req.user.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID format"
                });
            }

            const ratingNum = Number(rating);
            if (
                !Number.isFinite(ratingNum) ||
                ratingNum < 1 ||
                ratingNum > 5
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Rating must be a number between 1 and 5"
                });
            }

            const booking = await StylistBooking.findById(bookingId);

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            if (booking.userId.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            if (booking.status !== "completed") {
                return res.status(400).json({
                    success: false,
                    message: "Reviews can only be submitted for completed bookings"
                });
            }

            if (booking.userRating != null && booking.userRating !== undefined) {
                return res.status(400).json({
                    success: false,
                    message: "Review already submitted for this booking"
                });
            }

            booking.userRating = ratingNum;
            booking.userReview = typeof review === "string" ? review.trim().slice(0, 2000) : "";
            booking.updatedAt = new Date();
            await booking.save();

            const ratedBookings = await StylistBooking.find({
                stylistId: booking.stylistId,
                userRating: { $exists: true, $ne: null }
            }).select("userRating");

            if (ratedBookings.length > 0) {
                const avgRating =
                    ratedBookings.reduce((sum, b) => sum + b.userRating, 0) /
                    ratedBookings.length;
                const rounded = parseFloat(avgRating.toFixed(1));
                await StylistProfile.findByIdAndUpdate(booking.stylistId, {
                    $set: {
                        stylistRating: rounded,
                        "bookingStats.averageRating": rounded
                    }
                });
            }

            return res.status(201).json({
                success: true,
                message: "Review submitted successfully",
                data: {
                    bookingId: booking._id,
                    rating: booking.userRating,
                    review: booking.userReview,
                    stylistAverageRating:
                        ratedBookings.length > 0
                            ? parseFloat(
                                  (
                                      ratedBookings.reduce(
                                          (sum, b) => sum + b.userRating,
                                          0
                                      ) / ratedBookings.length
                                  ).toFixed(1)
                              )
                            : ratingNum
                }
            });

        } catch (error) {
            console.error("Submit review error:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to submit review",
                error: error.message
            });
        }
    }
}

module.exports = StylistBookingController;

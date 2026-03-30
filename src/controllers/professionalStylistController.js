const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/userModel");
const StylistProfile = require("../models/stylistProfile");
const StylistBooking = require("../models/stylistBooking");
const { admin } = require("../service/firebaseServices");
const { sendFcmNotification } = require("./notificationController");
const RazorpayService = require("../service/razorpayService");
require("dotenv").config();

const JOINING_FEE = parseInt(process.env.STYLIST_JOINING_FEE || "499", 10); // INR

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
const STYLIST_TOKEN_EXPIRY = "100d";

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a numeric price from strings like "₹1500 / 90 min" → 1500
 * Falls back to the raw value if it's already a number.
 */
const parsePriceFromFee = (feeStr) => {
    if (!feeStr) return 0;
    if (typeof feeStr === "number") return feeStr;
    const match = feeStr.replace(/,/g, "").match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

/**
 * Build a human-readable availability string from the day map + hours.
 * e.g. "Mon, Tue, Thu, Fri, Sat: 10:00 AM - 7:00 PM"
 */
const formatAvailabilityString = (dayAvailability, startTime, endTime) => {
    if (!dayAvailability || typeof dayAvailability !== "object") {
        return startTime && endTime ? `${startTime} - ${endTime}` : "Available";
    }
    const DAY_SHORT = { Monday:"Mon", Tuesday:"Tue", Wednesday:"Wed", Thursday:"Thu", Friday:"Fri", Saturday:"Sat", Sunday:"Sun" };
    const activeDays = Object.entries(dayAvailability)
        .filter(([, v]) => v === true)
        .map(([day]) => DAY_SHORT[day] || day);
    if (!activeDays.length) return "Not Available";
    const hours = startTime && endTime ? `: ${startTime} - ${endTime}` : "";
    return `${activeDays.join(", ")}${hours}`;
};

/**
 * Ensure portfolio is stored as an array of URLs only.
 * Filters out plain text (non-URL) values.
 */
const sanitisePortfolio = (value) => {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter((v) => typeof v === "string" && v.startsWith("http"));
};

/**
 * Build the full StylistProfile field object from resolved registration data.
 * Used by both registerProfessional and initiateJoiningFee to stay in sync.
 */
const buildProfileFields = ({ user, b, fullName, shortBio, specialties, yearsOfExperience,
    portfolioLink, baseSessionFee, addOnServices, paymentModes, profilePictureUrl,
    dayAvailability, startTime, endTime, applicationStatus, isApproved, approvalStatus,
    paymentStatus, registrationFee }) => ({
    userId: user._id,
    // ── Legacy fields (kept for backward compatibility with old app logic) ──
    stylistName: fullName,
    stylistBio: shortBio,
    stylistEmail: b.stylistEmail || b.email || "",
    stylistPhone: b.phoneNumber,
    stylistAddress: b.stylistAddress || "",
    stylistCity: b.stylistCity || "",
    stylistState: b.stylistState || "",
    stylistPincode: b.stylistPincode || "",
    stylistCountry: b.stylistCountry || "India",
    stylistImage: profilePictureUrl,
    stylistExperience: yearsOfExperience,
    stylistEducation: b.stylistEducation || "",
    stylistSkills: Array.isArray(specialties) ? specialties : [specialties].filter(Boolean),
    stylistPortfolio: sanitisePortfolio(b.stylistPortfolio || portfolioLink),
    stylistAvailability: formatAvailabilityString(dayAvailability, startTime, endTime),
    stylistPrice: parsePriceFromFee(baseSessionFee) || b.stylistPrice || 0,
    stylistRating: 0,
    stylistReviews: [],
    // ── New professional portal fields ──────────────────────────────────────
    fullName,
    shortBio,
    specialties: Array.isArray(specialties) ? specialties : [specialties].filter(Boolean),
    yearsOfExperience,
    portfolioLink: typeof portfolioLink === "string" && portfolioLink.startsWith("http") ? portfolioLink : "",
    baseSessionFee,
    addOnServices: Array.isArray(addOnServices) ? addOnServices : [],
    paymentModes: Array.isArray(paymentModes) ? paymentModes : [],
    profilePictureUrl,
    professionalAvailability: {
        dayAvailability: dayAvailability || {},
        startTime,
        endTime,
        breaks: b.breaks || [],
    },
    // ── Status ──────────────────────────────────────────────────────────────
    applicationStatus,
    isApproved,
    approvalStatus,
    registrationFee,
    paymentStatus,
});

const generateToken = (payload) =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: STYLIST_TOKEN_EXPIRY });

const generateRefreshToken = (payload) =>
    jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: STYLIST_TOKEN_EXPIRY });

const verifyFirebaseHeader = async (authHeader) => {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw Object.assign(new Error("No token provided"), { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    try {
        return await admin.auth().verifyIdToken(token);
    } catch {
        throw Object.assign(new Error("Invalid Firebase token"), { status: 401 });
    }
};

/** Mongo user id from JWT (`id` or `_id` depending on token type). */
const getAuthUserId = (req) => {
    if (!req.user) return null;
    const v = req.user._id ?? req.user.id;
    return v != null ? v : null;
};

/** Find StylistProfile by user._id (stylistId in URL = User._id per spec). */
const findProfileByUserId = async (userId) => {
    const profile = await StylistProfile.findOne({ userId });
    if (!profile) {
        const err = new Error("Stylist profile not found");
        err.status = 404;
        throw err;
    }
    return profile;
};

/** Build ISO scheduledAt from separate date + time fields. */
const toScheduledAt = (booking) => {
    if (!booking.scheduledDate) return null;
    const d = new Date(booking.scheduledDate);
    if (booking.scheduledTime) {
        const [h, m] = booking.scheduledTime.split(":");
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    }
    return d.toISOString();
};

/** Shape a booking document into the spec response shape. */
const formatBooking = (b) => ({
    _id: b._id,
    clientId: b.userId,        // populated as User object
    stylistId: b.stylistId,
    scheduledAt: toScheduledAt(b),
    durationMinutes: b.duration,
    status: b.status,
    sessionType: b.sessionType || "video",
    baseAmount: b.baseAmount ?? b.paymentAmount,
    addOnServices: b.addOnServices || [],
    totalAmount: b.totalAmount ?? b.paymentAmount,
    currency: b.paymentCurrency || "INR",
    notes: b.notes || "",
    createdAt: b.createdAt,
});

// Valid status transitions
const TRANSITIONS = {
    pending: ["confirmed", "rejected"],
    confirmed: ["completed", "cancelled"],
    completed: [],
    rejected: [],
    cancelled: [],
};

// ─── GET /stylist/check-professional/:phoneNumber ────────────────────────────

exports.checkProfessional = async (req, res) => {
    try {
        await verifyFirebaseHeader(req.headers.authorization);

        const phoneNumber = decodeURIComponent(req.params.phoneNumber);

        const user = await User.findOne({ phoneNumber, role: "Stylist" });
        if (!user) {
            return res.status(200).json({
                success: true,
                isProfessionalStylist: false,
                message: "Professional stylist not found",
            });
        }

        const profile = await StylistProfile.findOne({ userId: user._id });
        if (!profile) {
            return res.status(200).json({
                success: true,
                isProfessionalStylist: false,
                message: "Professional stylist not found",
            });
        }

        return res.status(200).json({
            success: true,
            isProfessionalStylist: true,
            message: "Professional stylist found",
        });
    } catch (err) {
        if (err.status === 401) {
            return res.status(401).json({ success: false, message: err.message });
        }
        console.error("checkProfessional:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── POST /stylist/register-professional ────────────────────────────────────

exports.registerProfessional = async (req, res) => {
    try {
        const b = req.body;

        // ── Resolve field names: accept both new API names and legacy Flutter names ──
        const phoneNumber      = b.phoneNumber;
        const firebaseIdToken  = b.firebaseIdToken;

        // Name: new → fullName, legacy → stylistName / displayName / name
        const fullName         = b.fullName || b.stylistName || b.displayName || b.name || "";

        // Bio: new → shortBio, legacy → stylistBio / bio
        const shortBio         = b.shortBio || b.stylistBio || b.bio || "";

        // Specialties: new → specialties, legacy → stylistSkills / skills / categories
        const specialties      = b.specialties || b.stylistSkills || b.skills || b.categories || [];

        // Experience: new → yearsOfExperience, legacy → stylistExperience / experience
        const yearsOfExperience = b.yearsOfExperience || b.stylistExperience || b.experience || "";

        // Portfolio: new → portfolioLink (string), legacy → stylistPortfolio (array) / portfolioUrl
        const portfolioLink    = b.portfolioLink || b.portfolioUrl ||
                                 (Array.isArray(b.stylistPortfolio) ? b.stylistPortfolio[0] : b.stylistPortfolio) || "";

        // Fee: new → baseSessionFee, legacy → stylistPrice / sessionFee / price
        const baseSessionFee   = b.baseSessionFee || b.sessionFee ||
                                 (b.stylistPrice ? `₹${b.stylistPrice}` : "") || "";

        // Add-ons & payments
        const addOnServices    = b.addOnServices  || b.addons  || [];
        const paymentModes     = b.paymentModes   || b.payment || [];

        // Availability: new → dayAvailability object, legacy → stylistAvailability string / availability
        let dayAvailability    = b.dayAvailability || b.availability || null;
        if (typeof dayAvailability === "string") {
            // Legacy: just a string like "Mon-Fri" — default all weekdays to true
            dayAvailability = {
                Monday: true, Tuesday: true, Wednesday: true,
                Thursday: true, Friday: true, Saturday: false, Sunday: false,
            };
        }
        if (!dayAvailability) {
            dayAvailability = {
                Monday: true, Tuesday: true, Wednesday: true,
                Thursday: true, Friday: true, Saturday: false, Sunday: false,
            };
        }

        const startTime        = b.startTime  || b.workStartTime  || "10:00 AM";
        const endTime          = b.endTime    || b.workEndTime    || "7:00 PM";

        // Profile picture: new → profilePictureUrl, legacy → stylistImage / profileImage / imageUrl
        const profilePictureUrl = b.profilePictureUrl || b.stylistImage || b.profileImage || b.imageUrl || "";

        // ── Required field validation ─────────────────────────────────────────
        const missing = [];
        if (!phoneNumber)      missing.push("phoneNumber");
        if (!firebaseIdToken)  missing.push("firebaseIdToken");
        if (!fullName)         missing.push("fullName (or stylistName)");
        if (!shortBio)         missing.push("shortBio (or stylistBio)");
        if (!specialties?.length) missing.push("specialties (or stylistSkills)");
        if (!yearsOfExperience)   missing.push("yearsOfExperience (or stylistExperience)");
        if (!baseSessionFee)      missing.push("baseSessionFee (or stylistPrice)");

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(", ")}`,
            });
        }

        // Verify Firebase token
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(firebaseIdToken);
        } catch {
            return res.status(401).json({ success: false, message: "Invalid Firebase token" });
        }

        if (decoded.phone_number !== phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Phone number does not match Firebase token",
            });
        }

        // Duplicate check: phone already registered as a professional stylist
        const existingUser = await User.findOne({ phoneNumber, role: "Stylist" });
        if (existingUser) {
            const existingProfile = await StylistProfile.findOne({ userId: existingUser._id });
            if (existingProfile) {
                return res.status(409).json({
                    success: false,
                    message: "Phone number already registered as a professional stylist",
                });
            }
        }

        // Upsert User with Stylist role
        let user = await User.findOne({ phoneNumber });
        if (user) {
            user.role = "Stylist";
            user.displayName = fullName;
            if (!user.firebaseUid) user.firebaseUid = decoded.uid;
            // Carry over email if provided in legacy fields
            if (!user.email && (b.stylistEmail || b.email)) {
                user.email = b.stylistEmail || b.email;
            }
        } else {
            user = new User({
                displayName: fullName,
                phoneNumber,
                email: b.stylistEmail || b.email || undefined,
                firebaseUid: decoded.uid,
                role: "Stylist",
            });
        }
        await user.save();

        // Create StylistProfile
        const profile = new StylistProfile(buildProfileFields({
            user, b, fullName, shortBio, specialties, yearsOfExperience,
            portfolioLink, baseSessionFee, addOnServices, paymentModes,
            profilePictureUrl, dayAvailability, startTime, endTime,
            applicationStatus: "approved",
            isApproved: true,
            approvalStatus: "approved",
            paymentStatus: "pending",
            registrationFee: JOINING_FEE,
        }));

        await profile.save();

        // Issue 100-day JWT
        const payload = {
            id: user._id,
            phoneNumber: user.phoneNumber,
            role: "stylist",
        };
        const accessToken = generateToken(payload);
        const refreshToken = generateRefreshToken(payload);

        return res.status(201).json({
            success: true,
            message: "Professional stylist registered successfully",
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                email: user.email || null,
                name: fullName,
                displayName: fullName,
                role: "stylist",
            },
            accessToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: "100d",
        });
    } catch (err) {
        console.error("registerProfessional:", err);
        return res.status(500).json({ success: false, message: "Registration failed", error: err.message });
    }
};

// ─── GET /stylist/dashboard-stats/:stylistId ────────────────────────────────

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const profile = await findProfileByUserId(userId);

        const profileId = profile._id;
        const now = new Date();

        const [
            totalBookings,
            completedBookings,
            pendingRequests,
            upcomingSessions,
            distinctClientsResult,
            earningsResult,
        ] = await Promise.all([
            StylistBooking.countDocuments({ stylistId: profileId }),
            StylistBooking.countDocuments({ stylistId: profileId, status: "completed" }),
            StylistBooking.countDocuments({ stylistId: profileId, status: "pending" }),
            StylistBooking.countDocuments({
                stylistId: profileId,
                status: "confirmed",
                scheduledDate: { $gt: now },
            }),
            StylistBooking.distinct("userId", { stylistId: profileId }),
            StylistBooking.aggregate([
                { $match: { stylistId: profileId, status: "completed" } },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: { $ifNull: ["$totalAmount", { $ifNull: ["$paymentAmount", 0] }] },
                        },
                    },
                },
            ]),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                totalClients: distinctClientsResult.length,
                upcomingSessions,
                totalSessions: totalBookings,
                completedSessions: completedBookings,
                pendingRequests,
                totalEarnings: earningsResult[0]?.total || 0,
                rating: profile.bookingStats?.averageRating || 0,
            },
        });
    } catch (err) {
        if (err.status === 401) return res.status(401).json({ success: false, message: err.message });
        if (err.status === 403) return res.status(403).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("getDashboardStats:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── GET /stylist/me/revenue ────────────────────────────────────────────────
// Total revenue from completed paid bookings for the authenticated stylist.

exports.getBookingRevenue = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const profile = await findProfileByUserId(userId);
        const stylistProfileId = profile._id;

        const baseMatch = {
            stylistId: stylistProfileId,
            status: "completed",
            paymentStatus: { $in: ["completed", "test"] },
        };

        const [totalsAgg, monthlyAgg] = await Promise.all([
            StylistBooking.aggregate([
                { $match: baseMatch },
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: {
                                $ifNull: ["$totalAmount", { $ifNull: ["$paymentAmount", 0] }],
                            },
                        },
                        completedBookingsCount: { $sum: 1 },
                    },
                },
            ]),
            StylistBooking.aggregate([
                { $match: baseMatch },
                {
                    $addFields: {
                        revenueDate: {
                            $ifNull: ["$completedAt", { $ifNull: ["$paymentCompletedAt", "$updatedAt"] }],
                        },
                    },
                },
                { $match: { revenueDate: { $ne: null } } },
                {
                    $group: {
                        _id: {
                            year: { $year: "$revenueDate" },
                            month: { $month: "$revenueDate" },
                        },
                        revenue: {
                            $sum: {
                                $ifNull: ["$totalAmount", { $ifNull: ["$paymentAmount", 0] }],
                            },
                        },
                        bookings: { $sum: 1 },
                    },
                },
                { $sort: { "_id.year": -1, "_id.month": -1 } },
                { $limit: 24 },
            ]),
        ]);

        const t = totalsAgg[0] || {};
        return res.status(200).json({
            success: true,
            data: {
                currency: "INR",
                totalRevenue: t.totalRevenue || 0,
                completedBookingsCount: t.completedBookingsCount || 0,
                byMonth: monthlyAgg.map((row) => ({
                    year: row._id.year,
                    month: row._id.month,
                    revenue: row.revenue,
                    bookings: row.bookings,
                })),
            },
        });
    } catch (err) {
        if (err.status === 401) return res.status(401).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("getBookingRevenue:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── GET /stylist/:stylistId/bookings ───────────────────────────────────────

exports.getStylistBookings = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const profile = await findProfileByUserId(userId);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = { stylistId: profile._id };
        if (req.query.status) filter.status = req.query.status;

        const [bookings, total] = await Promise.all([
            StylistBooking.find(filter)
                .populate("userId", "displayName phoneNumber profilePictureUrl")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            StylistBooking.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                bookings: bookings.map(formatBooking),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (err) {
        if (err.status === 401) return res.status(401).json({ success: false, message: err.message });
        if (err.status === 403) return res.status(403).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("getStylistBookings:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── GET /stylist/:stylistId/clients ────────────────────────────────────────

exports.getStylistClients = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const profile = await findProfileByUserId(userId);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Aggregate bookings to get unique client stats
        const pipeline = [
            { $match: { stylistId: profile._id } },
            {
                $group: {
                    _id: "$userId",
                    totalBookings: { $sum: 1 },
                    lastBookingDate: { $max: "$createdAt" },
                    totalSpent: {
                        $sum: { $ifNull: ["$totalAmount", { $ifNull: ["$paymentAmount", 0] }] },
                    },
                },
            },
            { $sort: { lastBookingDate: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userInfo",
                },
            },
            { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        ];

        const [clientsRaw, totalCountResult] = await Promise.all([
            StylistBooking.aggregate(pipeline),
            StylistBooking.aggregate([
                { $match: { stylistId: profile._id } },
                { $group: { _id: "$userId" } },
                { $count: "total" },
            ]),
        ]);

        const total = totalCountResult[0]?.total || 0;

        const clients = clientsRaw.map((c) => ({
            clientId: c._id,
            displayName: c.userInfo?.displayName || "",
            phoneNumber: c.userInfo?.phoneNumber || "",
            profilePictureUrl: c.userInfo?.profilePictureUrl || null,
            totalBookings: c.totalBookings,
            lastBookingDate: c.lastBookingDate,
            totalSpent: c.totalSpent,
        }));

        return res.status(200).json({
            success: true,
            data: {
                clients,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (err) {
        if (err.status === 401) return res.status(401).json({ success: false, message: err.message });
        if (err.status === 403) return res.status(403).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("getStylistClients:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── PUT /booking/:bookingId/status ─────────────────────────────────────────

exports.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status, reason } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: "status is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const booking = await StylistBooking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // Verify the requesting stylist owns this booking
        const uid = getAuthUserId(req);
        if (!uid) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const profile = await StylistProfile.findOne({ userId: uid });
        if (!profile || booking.stylistId.toString() !== profile._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorised to update this booking",
            });
        }

        // Validate transition
        const allowed = TRANSITIONS[booking.status] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot transition from '${booking.status}' to '${status}'`,
            });
        }

        // Apply update
        booking.status = status;
        if (status === "rejected") booking.rejectionReason = reason || "";
        if (status === "cancelled") booking.cancellationReason = reason || "";
        if (status === "completed") booking.completedAt = new Date();

        await booking.save();

        // FCM notification to client
        try {
            const clientUser = await User.findById(booking.userId).select("fcmToken displayName");
            if (clientUser?.fcmToken) {
                let title, body;
                if (status === "confirmed") {
                    title = "Booking Confirmed";
                    body = "Your booking has been confirmed by the stylist.";
                } else if (status === "rejected") {
                    title = "Booking Declined";
                    body = reason
                        ? `Your booking was declined: ${reason}`
                        : "Your booking was declined by the stylist.";
                } else if (status === "completed") {
                    title = "Session Completed";
                    body = "Your styling session has been marked as completed.";
                } else if (status === "cancelled") {
                    title = "Booking Cancelled";
                    body = reason
                        ? `Your booking was cancelled: ${reason}`
                        : "Your booking has been cancelled.";
                }
                if (title) await sendFcmNotification(clientUser.fcmToken, title, body);
            }
        } catch (fcmErr) {
            // Non-fatal — log and continue
            console.error("FCM notification failed:", fcmErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Booking status updated to ${status}`,
            data: {
                _id: booking._id,
                status: booking.status,
                updatedAt: booking.updatedAt,
            },
        });
    } catch (err) {
        console.error("updateBookingStatus:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── PUT /stylist/:stylistId/profile ────────────────────────────────────────

exports.updateProfile = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const profile = await findProfileByUserId(userId);

        const updatable = [
            "fullName", "shortBio", "specialties", "yearsOfExperience",
            "portfolioLink", "baseSessionFee", "addOnServices",
            "paymentModes", "profilePictureUrl",
        ];

        updatable.forEach((key) => {
            if (req.body[key] !== undefined) profile[key] = req.body[key];
        });

        // Keep legacy fields in sync
        if (req.body.fullName) {
            profile.stylistName = req.body.fullName;
            // Also update User displayName
            await User.findByIdAndUpdate(userId, {
                displayName: req.body.fullName,
            });
        }
        if (req.body.shortBio) profile.stylistBio = req.body.shortBio;
        if (req.body.profilePictureUrl) profile.stylistImage = req.body.profilePictureUrl;

        profile.updatedAt = new Date();
        await profile.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                _id: profile._id,
                fullName: profile.fullName,
                shortBio: profile.shortBio,
                specialties: profile.specialties,
                yearsOfExperience: profile.yearsOfExperience,
                portfolioLink: profile.portfolioLink,
                baseSessionFee: profile.baseSessionFee,
                addOnServices: profile.addOnServices,
                paymentModes: profile.paymentModes,
                profilePictureUrl: profile.profilePictureUrl,
                updatedAt: profile.updatedAt,
            },
        });
    } catch (err) {
        if (err.status === 403) return res.status(403).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("updateProfile:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── PUT /stylist/:stylistId/availability ───────────────────────────────────

exports.updateAvailability = async (req, res) => {
    try {
        const userIdFromToken = getAuthUserId(req);
        if (!userIdFromToken) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const profile = await findProfileByUserId(userIdFromToken);

        const { dayAvailability, startTime, endTime, breaks } = req.body;

        if (!dayAvailability || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "dayAvailability, startTime, and endTime are required",
            });
        }

        profile.professionalAvailability = {
            dayAvailability,
            startTime,
            endTime,
            breaks: breaks || [],
        };
        profile.updatedAt = new Date();
        await profile.save();

        return res.status(200).json({
            success: true,
            message: "Availability updated successfully",
            data: {
                dayAvailability,
                startTime,
                endTime,
                breaks: breaks || [],
                updatedAt: profile.updatedAt,
            },
        });
    } catch (err) {
        if (err.status === 403) return res.status(403).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("updateAvailability:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── POST /stylist/joining-fee/initiate ──────────────────────────────────────
//
// Called at the END of onboarding (before final registration).
// Creates a PENDING stylist profile and a Razorpay order for the joining fee.
// The app must complete payment then call /joining-fee/verify to activate the account.

exports.initiateJoiningFee = async (req, res) => {
    try {
        const b = req.body;

        const phoneNumber     = b.phoneNumber;
        const firebaseIdToken = b.firebaseIdToken;
        const fullName        = b.fullName || b.stylistName || b.displayName || b.name || "";
        const shortBio        = b.shortBio || b.stylistBio || b.bio || "";
        const specialties     = b.specialties || b.stylistSkills || b.skills || b.categories || [];
        const yearsOfExperience = b.yearsOfExperience || b.stylistExperience || b.experience || "";
        const portfolioLink   = b.portfolioLink || b.portfolioUrl ||
                                (Array.isArray(b.stylistPortfolio) ? b.stylistPortfolio[0] : b.stylistPortfolio) || "";
        const baseSessionFee  = b.baseSessionFee || b.sessionFee ||
                                (b.stylistPrice ? `₹${b.stylistPrice}` : "") || "";
        const addOnServices   = b.addOnServices  || b.addons  || [];
        const paymentModes    = b.paymentModes   || b.payment || [];
        const profilePictureUrl = b.profilePictureUrl || b.stylistImage || b.profileImage || b.imageUrl || "";
        const joiningFee      = b.joiningFee || JOINING_FEE;

        let dayAvailability = b.dayAvailability || b.availability || null;
        if (typeof dayAvailability === "string" || !dayAvailability) {
            dayAvailability = { Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false, Sunday: false };
        }
        const startTime = b.startTime || b.workStartTime || "10:00 AM";
        const endTime   = b.endTime   || b.workEndTime   || "7:00 PM";

        // Required field validation
        if (!phoneNumber || !firebaseIdToken || !fullName) {
            return res.status(400).json({ success: false, message: "phoneNumber, firebaseIdToken and fullName are required" });
        }

        // Verify Firebase token
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(firebaseIdToken);
        } catch {
            return res.status(401).json({ success: false, message: "Invalid Firebase token" });
        }

        if (decoded.phone_number !== phoneNumber) {
            return res.status(400).json({ success: false, message: "Phone number does not match Firebase token" });
        }

        // Check if already fully registered
        const existingUser = await User.findOne({ phoneNumber, role: "Stylist" });
        if (existingUser) {
            const existingProfile = await StylistProfile.findOne({
                userId: existingUser._id,
                applicationStatus: "approved",
            });
            if (existingProfile) {
                return res.status(409).json({ success: false, message: "Phone number already registered as a professional stylist" });
            }
        }

        // Upsert user
        let user = await User.findOne({ phoneNumber });
        if (user) {
            user.role = "Stylist";
            user.displayName = fullName;
            if (!user.firebaseUid) user.firebaseUid = decoded.uid;
            if (!user.email && (b.stylistEmail || b.email)) user.email = b.stylistEmail || b.email;
        } else {
            user = new User({
                displayName: fullName,
                phoneNumber,
                email: b.stylistEmail || b.email || undefined,
                firebaseUid: decoded.uid,
                role: "Stylist",
            });
        }
        await user.save();

        // Remove any previous incomplete payment attempt for this user
        await StylistProfile.deleteOne({ userId: user._id, applicationStatus: { $in: ["payment_pending", "draft"] } });

        // Create pending StylistProfile (not activated until payment verified)
        const profile = new StylistProfile(buildProfileFields({
            user, b, fullName, shortBio, specialties, yearsOfExperience,
            portfolioLink, baseSessionFee, addOnServices, paymentModes,
            profilePictureUrl, dayAvailability, startTime, endTime,
            applicationStatus: "payment_pending",
            isApproved: false,
            approvalStatus: "pending",
            paymentStatus: "pending",
            registrationFee: joiningFee,
        }));
        await profile.save();

        // Create Razorpay order
        const receipt = `sjoin_${profile._id.toString().slice(-8)}_${Date.now()}`;
        const orderResult = await RazorpayService.createOrder({
            amount: joiningFee,
            currency: "INR",
            receipt,
            notes: {
                type: "stylist_joining_fee",
                profileId: profile._id.toString(),
                userId: user._id.toString(),
                stylistName: fullName,
                phoneNumber,
            },
        });

        if (!orderResult.success) {
            // Clean up the pending profile if order creation fails
            await StylistProfile.findByIdAndDelete(profile._id);
            return res.status(500).json({ success: false, message: "Failed to create payment order. Please try again." });
        }

        // Store Razorpay order ID on the profile
        profile.razorpayOrderId = orderResult.data.orderId;
        await profile.save();

        return res.status(200).json({
            success: true,
            message: "Joining fee order created. Complete payment to activate your account.",
            data: {
                profileId: profile._id,
                joiningFee,
                currency: "INR",
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                orderId: orderResult.data.orderId,
                amount: orderResult.data.amount,       // in paise
                amountInRupees: joiningFee,
                // Pre-filled details for Razorpay checkout
                prefill: {
                    name: fullName,
                    contact: phoneNumber,
                    email: b.stylistEmail || b.email || "",
                },
                description: "Stylist Professional Account — Joining Fee",
            },
        });
    } catch (err) {
        console.error("initiateJoiningFee:", err);
        return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
    }
};

// ─── POST /stylist/joining-fee/verify ────────────────────────────────────────
//
// Called after the Razorpay payment sheet closes with a successful payment.
// Verifies the signature, activates the stylist profile, and issues the JWT.

exports.verifyJoiningFee = async (req, res) => {
    try {
        const {
            profileId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        if (!profileId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "profileId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(profileId)) {
            return res.status(400).json({ success: false, message: "Invalid profileId" });
        }

        // Find the pending profile
        const profile = await StylistProfile.findOne({
            _id: profileId,
            razorpayOrderId: razorpay_order_id,
            applicationStatus: "payment_pending",
        });

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Pending profile not found. It may have already been activated or the order ID is incorrect.",
            });
        }

        // Verify Razorpay signature
        const isValid = RazorpayService.verifyPaymentSignature({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        });

        if (!isValid) {
            return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
        }

        // Activate the profile
        profile.applicationStatus = "approved";
        profile.isApproved = true;
        profile.approvalStatus = "approved";
        profile.paymentStatus = "completed";
        profile.razorpayPaymentId = razorpay_payment_id;
        profile.razorpaySignature = razorpay_signature;
        profile.paymentCompletedAt = new Date();
        profile.approvedAt = new Date();
        profile.updatedAt = new Date();
        await profile.save();

        // Fetch the linked user
        const user = await User.findById(profile.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User account not found" });
        }

        // Issue 100-day JWT
        const tokenPayload = {
            id: user._id,
            phoneNumber: user.phoneNumber,
            role: "stylist",
        };
        const accessToken   = generateToken(tokenPayload);
        const refreshToken  = generateRefreshToken(tokenPayload);

        return res.status(200).json({
            success: true,
            message: "Payment verified. Your professional stylist account is now active!",
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                email: user.email || null,
                name: profile.fullName || user.displayName,
                displayName: profile.fullName || user.displayName,
                role: "stylist",
            },
            accessToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: "100d",
            payment: {
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                amount: profile.registrationFee,
                currency: "INR",
                paidAt: profile.paymentCompletedAt,
            },
        });
    } catch (err) {
        console.error("verifyJoiningFee:", err);
        return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
    }
};

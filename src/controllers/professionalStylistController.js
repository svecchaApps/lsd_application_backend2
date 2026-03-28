const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const StylistProfile = require("../models/stylistProfile");
const StylistBooking = require("../models/stylistBooking");
const { admin } = require("../service/firebaseServices");
const { sendFcmNotification } = require("./notificationController");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
const STYLIST_TOKEN_EXPIRY = "100d";

// ─── helpers ────────────────────────────────────────────────────────────────

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

/** Assert the JWT id in req.user matches the :stylistId path param. */
const assertStylistOwner = (req, stylistId) => {
    if (req.user.id.toString() !== stylistId.toString()) {
        const err = new Error("Forbidden");
        err.status = 403;
        throw err;
    }
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
        const profile = new StylistProfile({
            userId: user._id,
            // Legacy schema fields (keeps old queries working)
            stylistName: fullName,
            stylistBio: shortBio,
            stylistEmail: b.stylistEmail || b.email || "",
            stylistPhone: phoneNumber,
            stylistAddress: b.stylistAddress || "",
            stylistCity: b.stylistCity || "",
            stylistState: b.stylistState || "",
            stylistPincode: b.stylistPincode || "",
            stylistCountry: b.stylistCountry || "India",
            stylistImage: profilePictureUrl,
            stylistExperience: yearsOfExperience,
            stylistEducation: b.stylistEducation || "",
            stylistSkills: Array.isArray(specialties) ? specialties : [specialties],
            stylistPortfolio: portfolioLink ? [portfolioLink] : [],
            stylistAvailability: "Available",
            stylistPrice: b.stylistPrice || 0,
            // New professional portal fields
            fullName,
            shortBio,
            specialties: Array.isArray(specialties) ? specialties : [specialties],
            yearsOfExperience,
            portfolioLink,
            baseSessionFee,
            addOnServices: Array.isArray(addOnServices) ? addOnServices : [],
            paymentModes:  Array.isArray(paymentModes)  ? paymentModes  : [],
            profilePictureUrl,
            professionalAvailability: {
                dayAvailability,
                startTime,
                endTime,
                breaks: b.breaks || [],
            },
            applicationStatus: "approved",
            isApproved: true,
            approvalStatus: "approved",
        });

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
        assertStylistOwner(req, req.params.stylistId);
        const profile = await findProfileByUserId(req.params.stylistId);

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
        if (err.status === 403) return res.status(403).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("getDashboardStats:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── GET /stylist/:stylistId/bookings ───────────────────────────────────────

exports.getStylistBookings = async (req, res) => {
    try {
        assertStylistOwner(req, req.params.stylistId);
        const profile = await findProfileByUserId(req.params.stylistId);

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
        if (err.status === 403) return res.status(403).json({ success: false, message: err.message });
        if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
        console.error("getStylistBookings:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─── GET /stylist/:stylistId/clients ────────────────────────────────────────

exports.getStylistClients = async (req, res) => {
    try {
        assertStylistOwner(req, req.params.stylistId);
        const profile = await findProfileByUserId(req.params.stylistId);

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
            { $unwind: { path: "$userInfo", preserveNullAndEmpty: true } },
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
        const profile = await StylistProfile.findOne({ userId: req.user.id });
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
        assertStylistOwner(req, req.params.stylistId);
        const profile = await findProfileByUserId(req.params.stylistId);

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
            await User.findByIdAndUpdate(req.params.stylistId, {
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
        assertStylistOwner(req, req.params.stylistId);
        const profile = await findProfileByUserId(req.params.stylistId);

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

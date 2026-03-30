const express = require("express");
const router = express.Router();
const stylistController = require("../controllers/stylistController");
const professionalStylistController = require("../controllers/professionalStylistController");
const {
    authMiddleware,
    roleMiddleware,
} = require("../middleware/authMiddleware");

// ── Professional Stylist Portal (Firebase-auth'd) ─────────────────────────
// These specific string routes must come before any /:stylistId wildcards.

router.get(
    "/check-professional/:phoneNumber",
    professionalStylistController.checkProfessional
);

router.post(
    "/register-professional",
    professionalStylistController.registerProfessional
);

router.get(
    "/dashboard-stats/:stylistId",
    authMiddleware,
    professionalStylistController.getDashboardStats
);

// Joining fee payment (no JWT — happens before account is active)
router.post(
    "/joining-fee/initiate",
    professionalStylistController.initiateJoiningFee
);

router.post(
    "/joining-fee/verify",
    professionalStylistController.verifyJoiningFee
);
// ─────────────────────────────────────────────────────────────────────────

// Public routes (no authentication required)
router.get(
    "/approved",
    stylistController.getApprovedStylistProfiles
);

router.get(
    "/search",
    stylistController.searchStylists
);

router.get(
    "/top",
    stylistController.getTopStylists
);

// Dedicated top stylist endpoint for frontend leaderboard integration
router.get(
    "/top-stylists",
    stylistController.getTopStylists
);

router.get(
    "/categories",
    stylistController.getStylistCategories
);

router.get(
    "/specialties",
    stylistController.getStylistSpecialties
);

router.get(
    "/category/:categoryId",
    
    stylistController.getStylistsByCategory
);

// Registration — no auth required (userId resolved from token if present)
router.post(
    "/create",
    stylistController.createStylistProfile
);

router.get(
    "/my-profile",
    authMiddleware,
    stylistController.getMyStylistProfile
);

router.put(
    "/update",
    authMiddleware,
    stylistController.updateStylistProfile
);

router.delete(
    "/delete",
    authMiddleware,
    stylistController.deleteStylistProfile
);

// Admin routes (authentication + admin role required)
router.get(
    "/all",
    authMiddleware,
    roleMiddleware(["Admin"]),
    stylistController.getAllStylistProfiles
);

router.get(
    "/pending",
    authMiddleware,
    roleMiddleware(["Admin"]),
    stylistController.getPendingStylistProfiles
);

router.get(
    "/statistics",
    authMiddleware,
    roleMiddleware(["Admin"]),
    stylistController.getStylistStatistics
);

router.post(
    "/approve/:stylistId",
    authMiddleware,
    roleMiddleware(["Admin"]),
    stylistController.approveStylistProfile
);

router.post(
    "/reject/:stylistId",
    authMiddleware,
    roleMiddleware(["Admin"]),
    stylistController.rejectStylistProfile
);

// Get specific stylist profile by user ID (public)
router.get(
    "/profile/:userId",
    stylistController.getStylistProfile
);

// Admin routes for category management
router.post(
    "/category/create",
    authMiddleware,
    roleMiddleware(["Admin"]),
    stylistController.createStylistCategory
);

// Test endpoint: Create stylist profile (public, for testing)
router.post(
    "/test/create",
    stylistController.createTestStylistProfile
);

// Mark/unmark stylist as top stylist (public, for testing)
router.post(
    "/test/mark-top/:stylistId",
    stylistController.markAsTopStylist
);

// Stylist availability routes (stylist resolved from JWT user — do not trust body/URL stylist id)
router.post(
    "/availability",
    authMiddleware,
    stylistController.createOrUpdateAvailability
);

router.post(
    "/availability/:stylistId",
    authMiddleware,
    stylistController.createOrUpdateAvailability
);

router.get(
    "/availability/:stylistId",
    stylistController.getAvailabilityWithStylistInfo
);

router.get(
    "/availability",
    stylistController.getAvailabilityWithStylistInfo
);

// Professional portal: same body as PUT /:stylistId/availability; stylist from JWT only
router.put(
    "/availability",
    authMiddleware,
    professionalStylistController.updateAvailability
);

// Authenticated stylist (JWT user id only — must be registered before /:stylistId routes)
router.get(
    "/me/revenue",
    authMiddleware,
    professionalStylistController.getBookingRevenue
);
router.put(
    "/me/profile",
    authMiddleware,
    professionalStylistController.updateProfile
);

// ── Professional Dashboard ─────────────────────────────────────────────────
// /:stylistId sub-routes (stylistId = User._id from JWT)

router.get(
    "/:stylistId/bookings",
    authMiddleware,
    professionalStylistController.getStylistBookings
);

router.get(
    "/:stylistId/clients",
    authMiddleware,
    professionalStylistController.getStylistClients
);

router.put(
    "/:stylistId/profile",
    authMiddleware,
    professionalStylistController.updateProfile
);

router.put(
    "/:stylistId/availability",
    authMiddleware,
    professionalStylistController.updateAvailability
);
// ─────────────────────────────────────────────────────────────────────────

module.exports = router;

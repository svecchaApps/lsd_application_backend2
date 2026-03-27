const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/authMiddleware");
const { updateBookingStatus } = require("../controllers/professionalStylistController");

// PUT /booking/:bookingId/status
router.put("/:bookingId/status", authMiddleware, updateBookingStatus);

module.exports = router;

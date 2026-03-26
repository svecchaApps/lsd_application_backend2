const express = require("express");
const router = express.Router();
const {
  createOrderNotification,
  getAllNotifications,
  getNotificationByDesigner,
  createReturnNotification,
  updateFcmToken,
  getLatestBroadcastNotification,
  getAllBroadcastNotifications,
  sendNotificationToAllUsers,
  getUserNotifications,
  getUnreadCount,
  markNotificationsRead,
} = require("../controllers/notificationController");
const { authMiddleware, roleMiddleware } = require("../middleware/authMiddleware");

router.put("/update-fcm-token", updateFcmToken);

// User notifications inbox (stylist app)
router.get("/user/:userId", getUserNotifications);

// Unread badge count
router.get("/user/:userId/unread-count", getUnreadCount);

// Mark notifications as read
router.patch("/user/:userId/mark-read", markNotificationsRead);

router.post("/create-order-notification", createOrderNotification);
router.get("/broadcast/latest", getLatestBroadcastNotification);

router.get("/broadcast/all", getAllBroadcastNotifications);
router.get("/all", authMiddleware, roleMiddleware(["Admin"]), getAllNotifications);

router.get(
  "/designer/:designerId",
  authMiddleware,
  roleMiddleware(["Admin"]),
  getNotificationByDesigner
);

router.post("/create-return-notification", createReturnNotification);

router.post("/send-notification-to-all", sendNotificationToAllUsers);

module.exports = router;

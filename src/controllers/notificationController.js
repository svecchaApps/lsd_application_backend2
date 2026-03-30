const Notifications = require("../models/notificationsModel");
const User = require("../models/userModel");
const { admin } = require("../config/firebaseService");

const getAuthUserIdFromReq = (req) => {
  if (!req.user) return null;
  const v = req.user._id ?? req.user.id;
  return v != null ? v : null;
};

// Create a new order notification
exports.sendFcmNotification = async (fcmToken, title, body) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log("Notification sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending FCM notification:", error.message);
    throw error;
  }
};
exports.createNotification = async ({
  userId,
  designeref,
  message,
  orderId,
}) => {
  try {
    const newNotification = new Notifications({
      userId,
      designeref,
      message,
      orderId,
    });

    await newNotification.save();
    return { success: true, data: newNotification };
  } catch (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};
exports.createOrderNotification = async (req, res) => {
  try {
    const { userId, designeref, message, orderId } = req.body;

    const newNotification = new Notifications({
      userId,
      designeref,
      message,
      orderId,
    });

    await newNotification.save();

    res.status(201).json({
      success: true,
      message: "Order notification created successfully",
      data: newNotification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating order notification",
      error: error.message,
    });
  }
};

exports.getLatestBroadcastNotification = async (req, res) => {
  try {
    const latestNotification = await Notifications.findOne({
      userId: null, // Filter for broadcast notifications without specific userId
    }).sort({ createdDate: -1 }); // Sort by createdDate to get the latest

    if (!latestNotification) {
      return res.status(404).json({
        success: false,
        message: "No broadcast notifications found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Latest broadcast notification retrieved successfully",
      data: latestNotification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving broadcast notification",
      error: error.message,
    });
  }
};

// Get all broadcast notifications
exports.getAllBroadcastNotifications = async (req, res) => {
  try {
    const notifications = await Notifications.find({
      userId: null, // Filter for broadcast notifications without specific userId
    }).sort({ createdDate: -1 }); // Sort by createdDate to get in reverse chronological order

    res.status(200).json({
      success: true,
      message: "All broadcast notifications retrieved successfully",
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving broadcast notifications",
      error: error.message,
    });
  }
};

// Get all notifications
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notifications.find().populate(
      "userId designeref orderId"
    );

    res.status(200).json({
      success: true,
      message: "All notifications retrieved successfully",
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error.message,
    });
  }
};

// Get notifications by designer
exports.getNotificationByDesigner = async (req, res) => {
  try {
    const { designerId } = req.params;
    const notifications = await Notifications.find({
      designeref: designerId,
    }).populate("userId orderId");

    if (!notifications.length) {
      return res.status(404).json({
        success: false,
        message: "No notifications found for this designer",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving notifications for designer",
      error: error.message,
    });
  }
};

exports.updateFcmToken = async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({
        success: false,
        message: "User ID and FCM token are required",
      });
    }

    // Update user's FCM token
    const user = await User.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "FCM token updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FCM token",
      error: error.message,
    });
  }
};exports.sendNotificationToAllUsers = async (req, res) => {
  try {
    const { title, body, image } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Title and body are required",
      });
    }

    // Fetch all users with an FCM token
    const usersWithFcmTokens = await User.find({
      fcmToken: { $exists: true, $ne: null },
    }).select("fcmToken email displayName");

    if (!usersWithFcmTokens.length) {
      return res.status(404).json({
        success: false,
        message: "No users with FCM tokens found",
      });
    }

    // Prepare the FCM message with optional image
    const message = {
      notification: {
        title,
        body,
        ...(image && { image }), // Optional image field
      },
    };

    let successCount = 0;
    let failedCount = 0;
    const failedUsers = []; // To store users for whom notification failed

    // Send notifications to each user and handle individual errors
    const sendPromises = usersWithFcmTokens.map(async (user) => {
      try {
        const userMessage = { ...message, token: user.fcmToken };
        await admin.messaging().send(userMessage);
        successCount++; // Increment success count
      } catch (error) {
        console.error(
          `Failed to send notification to user: ${user.email}`,
          error.message
        );
        failedUsers.push({ email: user.email, fcmToken: user.fcmToken });
        failedCount++; // Increment failure count
      }
    });

    await Promise.all(sendPromises);

    // Save the notification in the database for record-keeping
    const newNotification = new Notifications({
      title,
      message: body,
      image: image || null,
    });

    await newNotification.save();

    // Extract the list of users to whom notifications were sent
    const sentUsers = usersWithFcmTokens.map((user) => ({
      email: user.email,
      displayName: user.displayName,
      fcmToken: user.fcmToken,
    }));

    res.status(200).json({
      success: true,
      message: `Notification sent successfully. Success: ${successCount}, Failed: ${failedCount}`,
      sentUsers,
      failedUsers,
      data: newNotification,
    });
  } catch (error) {
    console.error("Error in sending notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error sending notifications to all users",
      error: error.message,
    });
  }
};


/**
 * Authenticated notification inbox (stylist or end-user). userId comes from JWT only.
 * GET /notification/me?page&limit&seen&notificationType
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = getAuthUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { page = 1, limit = 20, seen, notificationType } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (seen === "true") query.seen = true;
    if (seen === "false") query.seen = false;
    if (notificationType && typeof notificationType === "string") {
      query.notificationType = notificationType;
    }

    const [notifications, total] = await Promise.all([
      Notifications.find(query)
        .sort({ createdDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("bookingId", "bookingId status scheduledDate scheduledTime")
        .populate("stylistId", "stylistName stylistImage")
        .lean(),
      Notifications.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        notifications,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum) || 1,
          total,
          limit: limitNum,
          hasNextPage: skip + notifications.length < total,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("getMyNotifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error.message,
    });
  }
};

exports.getMyUnreadNotificationCount = async (req, res) => {
  try {
    const userId = getAuthUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const count = await Notifications.countDocuments({ userId, seen: false });

    return res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching unread count",
      error: error.message,
    });
  }
};

exports.markMyNotificationsRead = async (req, res) => {
  try {
    const userId = getAuthUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { notificationIds } = req.body;
    const query = { userId, seen: false };
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }

    const result = await Notifications.updateMany(query, { $set: { seen: true } });

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error marking notifications as read",
      error: error.message,
    });
  }
};

// Get notifications inbox for a user (stylist app)
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, seen } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (seen === "true") query.seen = true;
    if (seen === "false") query.seen = false;

    const [notifications, total] = await Promise.all([
      Notifications.find(query)
        .sort({ createdDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notifications.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        notifications,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          total,
          limit: limitNum,
          hasNextPage: skip + notifications.length < total,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error.message,
    });
  }
};

// Get unread notification count (badge count)
exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const count = await Notifications.countDocuments({ userId, seen: false });

    return res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching unread count",
      error: error.message,
    });
  }
};

// Mark notifications as read
exports.markNotificationsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notificationIds } = req.body; // optional array; if omitted, mark all

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const query = { userId, seen: false };
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }

    const result = await Notifications.updateMany(query, { $set: { seen: true } });

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking notifications as read",
      error: error.message,
    });
  }
};

// Create a new return notification
exports.createReturnNotification = async (req, res) => {
  try {
    const { userId, designeref, message, returnId } = req.body;

    const newNotification = new Notifications({
      userId,
      designeref,
      message,
      returnId,
    });

    await newNotification.save();

    res.status(201).json({
      success: true,
      message: "Return notification created successfully",
      data: newNotification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating return notification",
      error: error.message,
    });
  }
};

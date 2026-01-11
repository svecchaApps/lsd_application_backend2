const {
    RtcTokenBuilder,
    RtcRole,
    RtmTokenBuilder,
    RtmRole
  } = require("agora-access-token");
  
  class AgoraService {
  
    /* ----------------------------------
     * Internal helpers
     * ---------------------------------- */
  
    static getAgoraConfig() {
      const appId = process.env.AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  
      if (!appId || !appCertificate) {
        throw new Error("Agora credentials not configured");
      }
  
      return { appId, appCertificate };
    }
  
    /**
     * Convert Mongo ObjectId → numeric UID for RTC
     * Agora RTC prefers numbers
     */
    static generateNumericUid(objectId) {
      if (!objectId) {
        throw new Error("ObjectId is required for UID generation");
      }
      const uid = parseInt(objectId.toString().slice(-8), 16);
      if (isNaN(uid)) {
        throw new Error("Failed to generate numeric UID from ObjectId");
      }
      return uid;
    }
  
    /**
     * Calculate token expiration based on booking
     */
    static calculateExpiration(booking) {
      const start = booking.scheduledDateTime;
      const end = new Date(start.getTime() + booking.duration * 60000);
      return Math.floor(end.getTime() / 1000);
    }
  
    /* ----------------------------------
     * Channel naming (SAFE)
     * ---------------------------------- */
  
    /**
     * Single channel per booking
     */
    static generateChannelName(bookingIdString) {
      return `session_${bookingIdString}`;
    }
  
    /* ----------------------------------
     * RTC TOKEN
     * ---------------------------------- */
  
    static generateRtcToken({
      channelName,
      numericUid,
      role = RtcRole.PUBLISHER,
      expiresAt
    }) {
      try {
        const { appId, appCertificate } = this.getAgoraConfig();
  
        const token = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          channelName,
          numericUid,
          role,
          expiresAt
        );
  
        return {
          success: true,
          data: {
            token,
            appId,
            channelName,
            uid: numericUid,
            role,
            expiresAt
          }
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to generate RTC token",
          error
        };
      }
    }
  
    /* ----------------------------------
     * RTM TOKEN
     * ---------------------------------- */
  
    static generateRtmToken({
      rtmUid,
      expiresAt
    }) {
      try {
        const { appId, appCertificate } = this.getAgoraConfig();
  
        const token = RtmTokenBuilder.buildToken(
          appId,
          appCertificate,
          rtmUid,
          RtmRole.Rtm_User,
          expiresAt
        );
  
        return {
          success: true,
          data: {
            token,
            appId,
            uid: rtmUid,
            expiresAt
          }
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to generate RTM token",
          error
        };
      }
    }
  
    /* ----------------------------------
     * MAIN ENTRY POINT
     * ---------------------------------- */
  
    /**
     * Generate Agora tokens strictly bound to booking
     */
    static generateBookingSessionTokens({
      booking,
      userId,
      role // "user" | "stylist"
    }) {
      try {
        // Validate required fields
        if (!booking || !booking.bookingId) {
          throw new Error("Booking ID is required");
        }

        if (!userId) {
          throw new Error("User ID is required");
        }

        if (!booking.scheduledDateTime || isNaN(new Date(booking.scheduledDateTime).getTime())) {
          throw new Error("Invalid booking scheduled date/time");
        }

        if (!booking.duration || typeof booking.duration !== 'number' || booking.duration <= 0) {
          throw new Error("Invalid booking duration");
        }

        const now = new Date();

        const start = booking.scheduledDateTime;
        const end = new Date(start.getTime() + booking.duration * 60000);

        if (isNaN(end.getTime())) {
          throw new Error("Invalid end time calculation");
        }

        const expiresAt = Math.floor(end.getTime() / 1000);

        if (!expiresAt || isNaN(expiresAt)) {
          throw new Error("Invalid expiration time");
        }

        const channelName = this.generateChannelName(
          booking.bookingId
        );

        if (!channelName) {
          throw new Error("Failed to generate channel name");
        }

        const rtcUid = this.generateNumericUid(userId);
        const rtmUid = `${role}_${userId}`;

        if (!rtcUid || isNaN(rtcUid)) {
          throw new Error("Failed to generate RTC UID");
        }
  
        const rtc = this.generateRtcToken({
          channelName,
          numericUid: rtcUid,
          expiresAt
        });
  
        const rtm = this.generateRtmToken({
          rtmUid,
          expiresAt
        });
  
        if (!rtc.success || !rtm.success) {
          throw new Error("Token generation failed");
        }

        // Validate tokens are present and valid
        if (!rtc.data || !rtc.data.token || !rtc.data.appId) {
          throw new Error("RTC token generation failed - invalid response");
        }

        if (!rtm.data || !rtm.data.token) {
          throw new Error("RTM token generation failed - invalid response");
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const expiresIn = expiresAt - currentTimestamp;

        return {
          success: true,
          data: {
            appId: String(rtc.data.appId),
            channelName: String(channelName),
            rtcToken: String(rtc.data.token),
            rtmToken: String(rtm.data.token),
            rtcUid: Number(rtcUid),
            rtmUid: String(rtmUid),
            expiresAt: Number(expiresAt),
            expiresIn: Number(expiresIn)
          }
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          error
        };
      }
    }
  
    /* ----------------------------------
     * Utility
     * ---------------------------------- */
  
    static isTokenExpired(expiresAt) {
      return Math.floor(Date.now() / 1000) >= expiresAt;
    }
  }
  
  module.exports = AgoraService;
  
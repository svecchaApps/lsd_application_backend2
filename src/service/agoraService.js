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
      return parseInt(objectId.toString().slice(-8), 16);
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
        const now = new Date();
  
        const start = booking.scheduledDateTime;
        const end = new Date(start.getTime() + booking.duration * 60000);
  
        if (now < start) {
          throw new Error("Session has not started yet");
        }
  
        if (now > end) {
          throw new Error("Session has already ended");
        }
  
        const expiresAt = Math.floor(end.getTime() / 1000);
  
        const channelName = this.generateChannelName(
          booking.bookingId
        );
  
        const rtcUid = this.generateNumericUid(userId);
        const rtmUid = `${role}_${userId}`;
  
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
  
        return {
          success: true,
          data: {
            appId: rtc.data.appId,
            channelName,
            rtcToken: rtc.data.token,
            rtmToken: rtm.data.token,
            rtcUid,
            rtmUid,
            expiresAt,
            expiresIn: expiresAt - Math.floor(Date.now() / 1000)
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
  
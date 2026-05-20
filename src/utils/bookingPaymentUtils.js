const Razorpay = require("razorpay");
const RazorpayService = require("../service/razorpayService");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PAID_PAYMENT_STATUSES = new Set(["completed", "test", "paid"]);

/**
 * Returns true when the booking is paid enough to join a video session.
 * Syncs from Razorpay when the DB is still "processing" but payment was captured.
 */
async function ensureBookingPaidForVideo(booking) {
  if (!booking) {
    return { ok: false, message: "Booking not found" };
  }

  if (PAID_PAYMENT_STATUSES.has(booking.paymentStatus)) {
    await confirmBookingIfNeeded(booking);
    return { ok: true };
  }

  if (booking.razorpayPaymentId) {
    const details = await RazorpayService.getPaymentDetails(booking.razorpayPaymentId);
    if (
      details.success &&
      (details.data.status === "captured" || details.data.captured === true)
    ) {
      await markBookingPaid(booking, booking.razorpayPaymentId);
      return { ok: true };
    }
  }

  if (booking.razorpayOrderId) {
    try {
      const payments = await razorpay.orders.fetchPayments(booking.razorpayOrderId);
      const captured = (payments.items || []).find(
        (p) => p.status === "captured" || p.captured === true,
      );
      if (captured) {
        await markBookingPaid(booking, captured.id);
        return { ok: true };
      }
    } catch (error) {
      console.error("Razorpay fetchPayments error:", error.message);
    }
  }

  return {
    ok: false,
    message: `Payment not completed (status: ${booking.paymentStatus || "unknown"})`,
  };
}

async function markBookingPaid(booking, razorpayPaymentId) {
  booking.razorpayPaymentId = booking.razorpayPaymentId || razorpayPaymentId;
  booking.paymentStatus = "completed";
  booking.paymentCompletedAt = booking.paymentCompletedAt || new Date();
  if (booking.status === "pending") {
    booking.status = "confirmed";
  }
  booking.updatedAt = new Date();
  await booking.save();
}

async function confirmBookingIfNeeded(booking) {
  if (booking.status === "pending" && PAID_PAYMENT_STATUSES.has(booking.paymentStatus)) {
    booking.status = "confirmed";
    booking.updatedAt = new Date();
    await booking.save();
  }
}

function isPaidPaymentStatus(paymentStatus) {
  return PAID_PAYMENT_STATUSES.has(paymentStatus);
}

module.exports = {
  ensureBookingPaidForVideo,
  isPaidPaymentStatus,
  PAID_PAYMENT_STATUSES,
};

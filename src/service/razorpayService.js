const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {

    // 🔐 Create instance only when needed
    static getInstance() {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys are missing in environment variables');
        }

        return new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    // 🧾 Create Order
    static async createOrder(orderData) {
        try {
            const razorpay = this.getInstance();

            const {
                amount,
                currency = 'INR',
                receipt,
                notes = {}
            } = orderData;

            const order = await razorpay.orders.create({
                amount: Math.round(amount * 100),
                currency,
                receipt,
                notes
            });

            return {
                success: true,
                data: {
                    orderId: order.id,
                    amount: order.amount,
                    currency: order.currency,
                    receipt: order.receipt,
                    status: order.status,
                    createdAt: order.created_at
                }
            };
        } catch (error) {
            console.error('Razorpay createOrder error:', error);
            return { success: false, message: error.message };
        }
    }

    // 🔏 Verify Payment Signature
    static verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
        try {
            const body = `${razorpay_order_id}|${razorpay_payment_id}`;

            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body)
                .digest('hex');

            return expectedSignature === razorpay_signature;
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }

    // 💰 Capture Payment
    static async capturePayment(paymentId, amount, currency = 'INR') {
        try {
            const razorpay = this.getInstance();

            const payment = await razorpay.payments.capture(
                paymentId,
                Math.round(amount * 100),
                currency
            );

            return { success: true, data: payment };
        } catch (error) {
            console.error('Capture payment error:', error);
            return { success: false, message: error.message };
        }
    }

    // 🔍 Fetch Payment Details
    static async getPaymentDetails(paymentId) {
        try {
            const razorpay = this.getInstance();
            const payment = await razorpay.payments.fetch(paymentId);
            return { success: true, data: payment };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // ↩ Refund Payment
    static async createRefund(paymentId, amount, reason = '') {
        try {
            const razorpay = this.getInstance();

            const refund = await razorpay.payments.refund(paymentId, {
                amount: Math.round(amount * 100),
                notes: { reason }
            });

            return { success: true, data: refund };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // 🎯 Webhook Handler
    static handleWebhook({ event, payload }) {
        switch (event) {
            case 'payment.captured':
                return {
                    type: 'PAYMENT_CAPTURED',
                    data: payload.payment.entity
                };

            case 'payment.failed':
                return {
                    type: 'PAYMENT_FAILED',
                    data: payload.payment.entity
                };

            case 'order.paid':
                return {
                    type: 'ORDER_PAID',
                    data: payload.order.entity
                };

            default:
                return { type: 'UNHANDLED_EVENT', event };
        }
    }

    // 💻 Client-side options
    static generatePaymentOptions(order) {
        return {
            key: process.env.RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: order.currency,
            name: 'IndigoRhapsody',
            description: 'Stylist Booking Payment',
            order_id: order.orderId,
            theme: { color: '#3399cc' }
        };
    }
}

module.exports = RazorpayService;

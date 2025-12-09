import express from "express";
import {
  viewCheckout,
  processPayment,
  handleVNPayReturn,
  successCheckout
} from "../controllers/checkoutController.js";

const router = express.Router();

// =============================
// VIEW CHECKOUT
// =============================
router.get("/", viewCheckout);

// =============================
// TẠO ĐƠN HÀNG + CHUYỂN SANG VNPay / MoMo
// =============================
router.post("/pay", processPayment);

// =============================
// VNPay RETURN URL (SDK VERIFY)
// =============================
router.get("/vnpay_return", handleVNPayReturn);

// =============================
// MoMo RETURN URL
// =============================
//router.get("/momo_return", handleMomoReturn);

// =============================
// MoMo IPN (SERVER → SERVER)
// =============================
//router.post("/momo_ipn", handleMomoIpn);

// =============================
// SUCCESS PAGE (sau thanh toán)
// =============================
router.get("/success", successCheckout);


export default router;

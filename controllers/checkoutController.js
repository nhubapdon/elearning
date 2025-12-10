import db from "../db.js";
import { vnpay, MOMO } from "../config/payment.js";
import fetch from "node-fetch";
import crypto from "crypto";

/* ================================
   1) VIEW CHECKOUT
================================ */
export const viewCheckout = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.redirect("/signin");

  const { rows } = await db.query(
    `SELECT c.id, c.title, c.price, c.thumbnail
     FROM cart_items ci
     JOIN courses c ON ci.course_id = c.id
     WHERE ci.user_id = $1`,
    [userId]
  );

  const total = rows.reduce((sum, i) => sum + Number(i.price), 0);

  res.render("checkout/index", {
    items: rows,
    total,
    user: req.session.user || null,
  });
};

/* ================================
   2) PROCESS PAYMENT
================================ */
export const processPayment = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.redirect("/signin");

  const { payment_method } = req.body;

  const { rows: items } = await db.query(
    `SELECT c.id, c.price 
     FROM cart_items ci 
     JOIN courses c ON ci.course_id = c.id
     WHERE ci.user_id = $1`,
    [userId]
  );

  if (!items.length) return res.redirect("/cart");

  const total = items.reduce((t, i) => t + Number(i.price), 0);

  // 1. Tạo order
  const orderRes = await db.query(
    `INSERT INTO orders (user_id,total_price,status,payment_method)
     VALUES ($1,$2,'pending',$3) RETURNING id`,
    [userId, total, payment_method]
  );

  const orderId = orderRes.rows[0].id;

  // 2. Thêm order_items
  for (const item of items) {
    await db.query(
      `INSERT INTO order_items(order_id,course_id,price)
       VALUES ($1,$2,$3)`,
      [orderId, item.id, item.price]
    );
  }

  // 3. Xoá giỏ hàng
  await db.query(`DELETE FROM cart_items WHERE user_id=$1`, [userId]);

  // =======================
  // 3.1 VNPay (SDK)
  // =======================
  if (payment_method === "vnpay") {
    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: total,
      vnp_IpAddr: req.ip,
      vnp_TxnRef: orderId.toString(),
      vnp_OrderInfo: `Thanh toán đơn hàng #${orderId}`,
      vnp_ReturnUrl: process.env.VNP_RETURN_URL,
    });

    return res.redirect(paymentUrl);
  }

  // =======================
  // 3.2 MoMo (nếu dùng)
  // =======================
  if (payment_method === "momo") {
    const body = {
      partnerCode: MOMO.partnerCode,
      accessKey: MOMO.accessKey,
      requestId: orderId.toString(),
      amount: total.toString(),
      orderId: orderId.toString(),
      orderInfo: "Thanh toán khóa học Elearning",
      redirectUrl: MOMO.redirectUrl,
      ipnUrl: MOMO.ipnUrl,
      requestType: "captureWallet",
      extraData: "",
    };

    const rawHash =
      `accessKey=${body.accessKey}` +
      `&amount=${body.amount}` +
      `&extraData=${body.extraData}` +
      `&ipnUrl=${body.ipnUrl}` +
      `&orderId=${body.orderId}` +
      `&orderInfo=${body.orderInfo}` +
      `&partnerCode=${body.partnerCode}` +
      `&redirectUrl=${body.redirectUrl}` +
      `&requestId=${body.requestId}` +
      `&requestType=${body.requestType}`;

    body.signature = crypto
      .createHmac("sha256", MOMO.secretKey)
      .update(rawHash)
      .digest("hex");

    const resApi = await fetch(
      "https://test-payment.momo.vn/v2/gateway/api/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await resApi.json();

    if (!data.payUrl) {
      console.error("MoMo response error:", data);
      return res.status(500).send("Không tạo được link thanh toán MoMo");
    }

    return res.redirect(data.payUrl);
  }

  // =======================
  // 3.3 Demo "card" (nếu có)
  // =======================
  if (payment_method === "card") {
    // Demo: coi như thanh toán thành công luôn
    await db.query(`UPDATE orders SET status='paid' WHERE id=$1`, [orderId]);

    const enrollItems = await db.query(
      `SELECT course_id FROM order_items WHERE order_id=$1`,
      [orderId]
    );

    for (const item of enrollItems.rows) {
      await db.query(
        `INSERT INTO enrollments(user_id, course_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, item.course_id]
      );
    }

    return res.redirect(`/checkout/success?order=${orderId}`);
  }

  return res.send("Phương thức thanh toán không hợp lệ.");
};

/* ================================
   3) VNPay RETURN (SDK verify)
================================ */
export const handleVNPayReturn = async (req, res) => {
  try {
    const verify = vnpay.verifyReturnUrl(req.query);

    console.log("VNPay Return Verify:", verify);

    const orderId = req.query.vnp_TxnRef;
    const amount = Number(req.query.vnp_Amount);

    if (!orderId) {
      return res.status(400).send("Thiếu mã đơn hàng");
    }

    // Check chữ ký
    if (!verify.isSuccess) {
      return res.render("checkout/secure", {
        orderId,
        total: amount,
        code: "97", // checksum fail
      });
    }

    // 🟢 Thanh toán thành công
    if (req.query.vnp_ResponseCode === "00") {
      // 1. Cập nhật trạng thái đơn hàng
      await db.query(`UPDATE orders SET status='paid' WHERE id=$1`, [orderId]);

      // 2. Lấy userId của đơn
      const userRes = await db.query(
        `SELECT user_id FROM orders WHERE id=$1`,
        [orderId]
      );
      const userId = userRes.rows[0]?.user_id;

      // 3. Lấy danh sách khóa học trong đơn
      const items = await db.query(
        `SELECT course_id FROM order_items WHERE order_id=$1`,
        [orderId]
      );

      // 4. Ghi vào enrollments
      for (const item of items.rows) {
        await db.query(
          `INSERT INTO enrollments(user_id, course_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [userId, item.course_id]
        );
      }

      // 5. CHỈ REDIRECT sang trang success (không render ở đây)
      return res.redirect(`/checkout/success?order=${orderId}`);
    }

    // ❌ Thanh toán thất bại
    return res.render("checkout/secure", {
      orderId,
      total: amount,
      code: req.query.vnp_ResponseCode,
    });
  } catch (err) {
    console.error("VNPay Return Error:", err);
    res.status(500).send("Error processing VNPay return");
  }
};

/* ================================
   4) SUCCESS PAGE — KHÔNG DÙNG SESSION
================================ */
export const successCheckout = async (req, res) => {
  try {
    const orderId = req.query.order;
    if (!orderId) return res.send("Order not found");

    // Lấy order
    const orderRes = await db.query(
      `SELECT * FROM orders WHERE id=$1`,
      [orderId]
    );

    if (!orderRes.rows.length) return res.send("Order not found");

    const order = orderRes.rows[0];

    // Lấy thông tin user
    const userRes = await db.query(
      `SELECT id, full_name, email FROM users WHERE id=$1`,
      [order.user_id]
    );
    const user = userRes.rows[0];

    // Lấy danh sách khóa học của đơn hàng
    const items = await db.query(
      `SELECT c.id, c.title, c.thumbnail 
       FROM order_items oi
       JOIN courses c ON oi.course_id = c.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    return res.render("checkout/secure", {
      orderId,
      total: order.total_price,
      user,
      items: items.rows,
      code: "00"
    });

  } catch (err) {
    console.error("Success page error:", err);
    return res.status(500).send("Server error on success page");
  }
};

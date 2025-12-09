export const checkAdmin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/signin");
  }

  if (req.session.user.role !== "admin") {
    req.flash("error_msg", "Bạn không có quyền truy cập.");
return res.redirect("/");

  }

  next();
};

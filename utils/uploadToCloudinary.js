import cloudinary from "../config/cloudinary.js";
import fs from "fs";

export const uploadToCloudinary = async (localFilePath, folder) => {
  try {
    const uploaded = await cloudinary.uploader.upload(localFilePath, {
      folder,
      resource_type: "auto",   // ⭐ Quan trọng: cho phép upload VIDEO, PDF, ZIP, IMAGE
    });

    // Xoá file tạm trên server sau khi upload
    fs.unlinkSync(localFilePath);

    return uploaded.secure_url;

  } catch (err) {
    console.error("❌ Cloudinary upload error:", err);
    return null;
  }
};

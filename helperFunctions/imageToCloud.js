import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

export const  storeImageToCloud = async (imageFils, destinationFolder) => {
  let imageUlr = null;
  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: destinationFolder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(imageFils.buffer).pipe(uploadStream);
  });
  imageUlr = result.secure_url;
  return imageUlr
};

import multer from "multer";
import { Request, Response, NextFunction } from "express";


const MAX_FILE_SIZE = 1 * 1024 * 1024;


const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// Middleware for handling single file upload
export const fileUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size should be less than 1MB" });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};
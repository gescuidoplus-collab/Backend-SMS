import express from "express";
import {
  getLogs,
  getLogById,
  deleteLog,
} from "../controllers/smsDeliveryController.js";

import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();


router.get("/", verifyToken, getLogs);
router.get("/:id", verifyToken, getLogById);
router.delete("/:id", verifyToken, deleteLog);

export default router;

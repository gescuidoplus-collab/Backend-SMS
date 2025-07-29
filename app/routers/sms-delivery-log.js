import express from "express";
import {
  createLog,
  getLogs,
  getLogById,
  updateLog,
  deleteLog,
} from "../controllers/smsDeliveryController.js";

import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// router.post("/", verifyToken, createLog);
router.get("/", verifyToken, getLogs);
router.get("/:id", verifyToken, getLogById);
// router.put("/:id", verifyToken, updateLog);
router.delete("/:id", verifyToken, deleteLog);

export default router;

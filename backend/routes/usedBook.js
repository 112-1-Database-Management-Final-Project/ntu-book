import {
  toLowerCase,
  getUsedBook,
  getComments,
  addUsedBook,
  addComment,
  updateUsedBook,
  deleteUsedBook,
} from "../controllers/usedBook.js";
import {
  getRequests,
  getRequest,
  addRequest,
  addRating,
  addPurchase,
  deleteRequest,
} from "../controllers/purchaseRequests.js";
import { authorization } from "../utils/authorization.js";
import express from "express";

const router = express.Router();

// "/" = "/api/usedbook"

// GET /api/usedbook/:id - Get used book details
router.get("/:id", getUsedBook);

// GET /api/usedbook/:id/comment - Get all comments for used book
router.get("/:id/comment", getComments);

// POST /api/usedbook/ - Add used book
router.post("/", authorization, toLowerCase, addUsedBook);

// POST /api/usedbook/:id/comment - Add comment to used book
router.post("/:id/comment", authorization, toLowerCase, addComment);

// PUT /api/usedbook/:id - Update used book details
router.put("/:id", authorization, toLowerCase, updateUsedBook);

// POST /api/usedbook/:id - Delete used book
router.delete("/:id", authorization, toLowerCase, deleteUsedBook);

// Purchase Request API

// GET /api/usedbook/:id/requests - Get all requests for used book
router.get("/:id/requests", authorization, toLowerCase, getRequests);

// GET /api/usedbook/:id/request - Get the request that a single user has made for a used book (if any)
router.get("/:id/request", authorization, toLowerCase, getRequest);

// POST /api/usedbook/:id/request - Add purchase request
router.post("/:id/request", authorization, toLowerCase, addRequest);

// POST /api/usedbook/:id/rate - Add rating
router.post("/:id/rate", authorization, toLowerCase, addRating);

// POST /api/usedbook/:id/purchase - Add a purchase (not request)
router.post("/:id/purchase", authorization, toLowerCase, addPurchase);

// DELETE /api/usedbook/:id/request - Delete a request
router.delete("/:id/request", authorization, toLowerCase, deleteRequest);

export default router;

import {
  addBook,
  addTextBookInfo,
  deleteBook,
  getBookInfoAndUsedBooks,
  searchBooks,
  updateBookDetails,
} from "../controllers/book.js";
import express from "express";
import { authorization } from "../utils/authorization.js";

// Create an express router
const router = express.Router();

// Every path we define here will get /api/book prefix as defined in index.js

// GET /api/book?search=...
// eg. GET /api/book?BookName=python&AuthorName=rob
router.get("", searchBooks);

// GET /api/book/:id
router.get("/:id", getBookInfoAndUsedBooks);

// POST /api/book/textbook
router.post("/textbook", authorization, addTextBookInfo);

// POST /api/book
router.post("", authorization, addBook);

// PUT /api/book/:id
router.put("/:id", authorization, updateBookDetails);

// DELETE /api/book/:id
router.delete("/:id", authorization, deleteBook);

// export the router
export default router;

import {
    signUp,
    signIn,
    updateProfile,
    getProfile,
    getPrivateProfile
} from "../controllers/users.js";
import { authorization } from "../utils/authorization.js";
import express from "express";

// Create an express router
const router = express.Router();

// Every path we define here will get /api/users prefix as defined in index.js

function toLower(req, res, next) {
    if (req.body.SchoolEmail) {
        req.body.SchoolEmail = req.body.SchoolEmail.toLowerCase();
    }
    if (req.body.StudentID) {
        req.body.StudentID = req.body.StudentID.toLowerCase();
    }
    if (req.params.id) {
        req.params.id = req.params.id.toLowerCase();
    }
    if (req.authorization_id) {
        req.authorization_id = req.authorization_id.toLowerCase();
    }
    next();
}

// POST /users/register

router.post("/register", toLower, signUp);

// POST /users/signin

router.post("/signin", toLower, signIn);

// PUT /users/edit

router.put("/edit", authorization, toLower, updateProfile);

// GET /users/:id/public

router.get("/:id/public", toLower, getProfile);

// GET /users/:id/private

router.get("/:id/private", authorization, toLower, getPrivateProfile);

// export the router
export default router;

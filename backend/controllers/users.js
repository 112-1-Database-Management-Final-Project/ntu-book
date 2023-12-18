import { generateJWT, hashPassword } from '../utils/authorization.js';
import model from "../model/users.js";

function check_email(email) {
    if (!email.match(/^[a-zA-Z0-9]+@ntu.edu.tw$/)) {
        return false;
    }
    return true;
}

export async function signUp(req, res) {
    if (!req.body.StudentID || !req.body.SchoolEmail || !req.body.Username || !req.body.Fname || !req.body.Lname || !req.body.Password) {
        return res.status(400).json({ error: 'Missing value' });
    }

    if (!check_email(req.body.SchoolEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await model.getUser('SchoolEmail', req.body.SchoolEmail);

    if (user) {
        return res.status(400).json({ error: 'Email already in use' });
    }

    const user_id = await model.createUser(req.body.StudentID, req.body.SchoolEmail, req.body.Username, req.body.Fname, req.body.Lname, hashPassword(req.body.Password));

    if (!user_id) {
        return res.status(500).json({ error: 'Internal server error' });
    }

    const result = await generateJWT(req.body.StudentID);

    return res.status(200).json({ data: { 'Token': result } });
}

export function signIn(req, res) {
    if (!req.body.StudentID || !req.body.Password) {
        return res.status(400).json({ error: 'Missing value' });
    }

    if (req.body.StudentID == 'admin') {
        if (req.body.Password !== process.env.ADMIN_PASSWORD) {
            return res.status(400).json({ error: 'Password does not match' });
        }
        const result = {
            data: {
                Token: generateJWT(req.body.StudentID)
            }
        }
        return res.status(200).json(result);
    }

    model.getUser('StudentID', req.body.StudentID).then((user) => {
        if (!user) {
            return res.status(404).json({ error: 'User does not exist' });
        }

        if (user.password !== hashPassword(req.body.Password) && user.password != req.body.Password) {
            return res.status(400).json({ error: 'Password does not match' });
        }

        const result = {
            data: {
                Token: generateJWT(req.body.StudentID)
            }
        }
        return res.status(200).json(result);
    }).catch((err) => {
        console.log(err);
        return res.status(500).json({ error: 'Internal server error' });
    });
}

export function updateProfile(req, res) {

    if (req.body.SchoolEmail && !check_email(req.body.SchoolEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    let user_id = req.authorization_id;

    let newPassword = null;
    if (req.body.Password) {
        newPassword = hashPassword(req.body.Password);
    }

    model.updateUser(user_id, req.body.SchoolEmail, req.body.Username, req.body.Fname, req.body.Lname, newPassword).then((result) => {
        if (!result) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        return res.status(200).json({ data: result });
    }).catch((err) => {
        return res.status(500).json({ error: 'Internal server error' });
    });
}

async function getPublicProfile(req, res){
    let result = {};

    const user_id = req.params.id;

    let user = await model.getUser('StudentID', user_id);
    if (!user) {
        return { content: {error: 'User does not exist'}, code: 404};
    }

    result.StudentID = user.studentid;
    result.Username = user.username;

    let rating = await model.getRating(user_id);

    if (!rating) {
        return { content: {error: 'User does not exist'}, code: 404};
    }

    result.AverageRating = rating.AverageRating;
    result.Ratings = rating.Ratings;

    let usedBooks = await model.getUsedBook(user_id);

    if (!usedBooks) {
        usedBooks = [];
    }

    result.UsedBooks = usedBooks;

    return { content: {data: result}, code: 200};
}

export async function getProfile(req, res) {
    let result = await getPublicProfile(req, res);
    return res.status(result.code).json(result.content);
}

export async function getPrivateProfile(req, res) {

    const user_id = req.params.id;

    if (user_id !== req.authorization_id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    let result = await getPublicProfile(req, res);

    if (result.code !== 200) {
        return res.status(result.code).json(result.content);
    }

    let purchaseRequests = await model.getPurchaseRequests(user_id);

    if (!purchaseRequests) {
        return res.status(500).json({ error: 'Internal server error' });
    }

    result.content.data.PurchaseRequests = purchaseRequests;

    return res.status(result.code).json(result.content);

}

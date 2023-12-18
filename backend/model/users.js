import {pool} from "../index.js";

export default {
    getUser,
    createUser,
    updateUser,
    getRating,
    getPurchaseRequests,
    getUsedBook
};

function reformatTimestamp(timestamp) {

    // Make the timestamp 2023-09-24T14:28:11.000Z (object type: timestamp) into 2023-09-24 14:28:11 format (object type: string)

    let year = timestamp.getFullYear();
    let month = timestamp.getMonth() + 1;
    let day = timestamp.getDate();
    let hour = timestamp.getHours();
    let minute = timestamp.getMinutes();
    let second = timestamp.getSeconds();
    
    if (month < 10) {
        month = '0' + month;
    }

    if (day < 10) {
        day = '0' + day;
    }

    if (hour < 10) {
        hour = '0' + hour;
    }

    if (minute < 10) {
        minute = '0' + minute;
    }

    if (second < 10) {
        second = '0' + second;
    }
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
}


async function getUser(column, value) {

    let db;
    db = await pool.connect();

    const query = {
        text: `SELECT * FROM users WHERE ${column} = $1`,
        values: [value],
    };

    return db.query(query)
        .then((result) => {
            db.release();
            return result.rows[0];
        })
        .catch((err) => {
            db.release();
            console.log(err);
            return null;
        });
}

async function createUser(StudentID, SchoolEmail, Username, Fname, Lname, Password) {

    let db;
    db = await pool.connect();

    const query = {
        text: `INSERT INTO users (StudentID, SchoolEmail, Username, Fname, Lname, Password) VALUES ($1, $2, $3, $4, $5, $6)`,
        values: [StudentID, SchoolEmail, Username, Fname, Lname, Password],
    };

    return db.query(query)
        .then((result) => {
            db.release();
            return StudentID;
        })
        .catch((err) => {
            db.release();
            console.log(err);
            return null;
        });

}

async function updateUser(StudentID, SchoolEmail, Username, Fname, Lname, Password) {
    // If an attribute is NULL or undefined, do not overwrite the existing column with None, just keep the original value

    let db;
    db = await pool.connect();

    const currentUser = await getUser('StudentID', StudentID);

    if (currentUser == null) {
        db.release();
        return null;
    }

    if (SchoolEmail == null) {
        SchoolEmail = currentUser.schoolemail;
    }

    if (Username == null) {
        Username = currentUser.username;
    }

    if (Fname == null) {
        Fname = currentUser.fname;
    }

    if (Lname == null) {
        Lname = currentUser.lname;
    }

    if (Password == null) {
        Password = currentUser.password;
    }

    const query = {
        text: `UPDATE users SET SchoolEmail = $1, Username = $2, Fname = $3, Lname = $4, Password = $5 WHERE StudentID = $6`,
        values: [SchoolEmail, Username, Fname, Lname, Password, StudentID],
    };

    return db.query(query)
        .then(() => {
            db.release();
            return {
                StudentID: StudentID,
                SchoolEmail: SchoolEmail,
                Username: Username,
                Fname: Fname,
                Lname: Lname
            };
        })
        .catch((err) => {
            db.release();
            console.log(err);
            return null;
        });
}

async function getRating(StudentID) {

    let db;
    db = await pool.connect();

    const currRatingQuery = `WITH currRating AS (
        SELECT r.*, ub.SellerID, p.BuyerID FROM rating AS r
        JOIN purchase AS p ON r.UsedBookID = p.UsedBookID 
        JOIN UsedBook AS ub ON p.UsedBookID = ub.UsedBookID
        WHERE ub.SellerID = $1
    )`;

    const ratingQuery = {
        text: `
        ${currRatingQuery}
        SELECT r.BuyerID AS StudentID, r.StarsCount, r.Review FROM currRating AS r
        `,
        values: [StudentID],
    };

    const avgRatingQuery = {
        text: `
        ${currRatingQuery}
        SELECT AVG(r.StarsCount) AS avgRating FROM currRating AS r LIMIT 1
        `,
        values: [StudentID],
    };

    let Ratings = [];
    let AverageRating = 0;

    Ratings =  await db.query(ratingQuery);

    AverageRating = await db.query(avgRatingQuery);

    for (let i = 0; i < Ratings.rows.length; i++) {
        Ratings.rows[i].StudentID = parseInt(Ratings.rows[i].studentid);
        Ratings.rows[i].StarsCount = parseInt(Ratings.rows[i].starscount);
        Ratings.rows[i].Review = Ratings.rows[i].review;
        delete Ratings.rows[i].studentid;
        delete Ratings.rows[i].starscount;
        delete Ratings.rows[i].review;
    }

    db.release();

    return {
        Ratings: Ratings.rows,
        AverageRating: AverageRating.rows[0].avgrating
    }
}

async function getPurchaseRequests(userID) {

    let db;
    db = await pool.connect();

    const query = {
        text: `SELECT pr.UsedBookID, pr.RequestTimestamp, b.Title As BookName, 
        CASE WHEN p.BuyerID IS NULL THEN 'Pending'
        WHEN p.BuyerID = $1 THEN 'Purchased'
        ELSE 'Denied'
        END AS Status
        FROM purchaserequest AS pr
        INNER JOIN usedbook AS ub ON pr.UsedBookID = ub.UsedBookID
        LEFT JOIN book AS b ON ub.BookID = b.ISBN
        LEFT JOIN purchase AS p ON pr.UsedBookID = p.UsedBookID
        WHERE pr.BuyerID = $1`,
        values: [ userID ],
    };

    return db.query(query)
        .then((result) => {
            db.release();

            for (let i = 0; i < result.rows.length; i++) {
                result.rows[i].UsedBookID = parseInt(result.rows[i].usedbookid);
                result.rows[i].RequestTimestamp = result.rows[i].requesttimestamp;
                result.rows[i].BookName = result.rows[i].bookname;
                result.rows[i].Status = result.rows[i].status;
                delete result.rows[i].usedbookid;
                delete result.rows[i].requesttimestamp;
                delete result.rows[i].bookname;
                delete result.rows[i].status;

                result.rows[i].RequestTimestamp = reformatTimestamp(result.rows[i].RequestTimestamp);

            }

            return result.rows;
        })
        .catch((err) => {
            db.release();
            console.log(err);
            return null;
        });
}

async function getUsedBook(userID) {

        let db;
        db = await pool.connect();
    
        const query = {
            text: `SELECT b.Title As BookName, ub.UsedBookID, ub.AskingPrice
            FROM usedbook AS ub
            INNER JOIN book AS b ON ub.BookID = b.ISBN
            LEFT JOIN purchase AS p ON ub.UsedBookID = p.UsedBookID
            WHERE ub.SellerID = $1 AND p.BuyerID IS NULL`,
            values: [ userID ],
        };
    
        return db.query(query)
            .then((result) => {
                db.release();
                for (let i = 0; i < result.rows.length; i++) {
                    result.rows[i].AskingPrice = parseInt(result.rows[i].askingprice);
                    result.rows[i].UsedBookID = parseInt(result.rows[i].usedbookid);
                    result.rows[i].BookName = result.rows[i].bookname;
                    delete result.rows[i].askingprice;
                    delete result.rows[i].usedbookid;
                    delete result.rows[i].bookname;
                }
                return result.rows;
            })
            .catch((err) => {
                db.release();
                console.log(err);
                return null;
            });

}
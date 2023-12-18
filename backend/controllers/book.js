import { pool } from "../index.js";

export const searchBooks = async (req, res) => {
  const bookName = req.query.BookName;
  const authorName = req.query.AuthorName;
  const courseName = req.query.CourseName;
  const deptCode = req.query.DeptCode;
  const isbn = req.query.ISBN;
  if (!bookName && !authorName && !courseName && !deptCode && !isbn) {
    return res
      .status(400)
      .json({ error: "At least one search parameter is required." });
  }

  let db;
  try {    
    db = await pool.connect();

    const bookQueryValues = [
      bookName ? "%" + bookName + "%" : "%",
      authorName ? "%" + authorName + "%" : "%",
    ];
    let index = 3;
    const indices = [];
    if (deptCode) {
      bookQueryValues.push(deptCode);
      indices["deptCode"] = index++;
    }
    if (courseName) {
      bookQueryValues.push("%" + courseName + "%");
      indices["courseName"] = index++;
    }
    bookQueryValues.push(isbn ? "%" + isbn + "%" : "%");
    indices["isbn"] = index++;

    const booksQuery = await db.query({
      text: `
        SELECT b.ISBN, b.Title, b.PublisherName, b.AuthorName, MIN(ub.AskingPrice) AS LowestPrice, MAX(ub.AskingPrice) AS HighestPrice 
        FROM BOOK AS b
          JOIN USEDBOOK AS ub ON ub.bookID = b.ISBN
          LEFT JOIN TEXTBOOK AS tb ON tb.bookID = b.ISBN
          LEFT JOIN COURSEDEPT AS cd ON cd.serialNumber = tb.serialNumber AND cd.semester = tb.semester
          LEFT JOIN COURSE AS c ON c.serialNumber = tb.serialNumber AND c.semester = tb.semester
        WHERE b.Title ILIKE $1
        AND b.AuthorName ILIKE $2
        ${deptCode ? `AND cd.departmentCode = $${indices["deptCode"]}` : ``}
        ${
          courseName
            ? `AND LOWER(c.courseName) LIKE LOWER($${indices["courseName"]})`
            : ``
        }
        AND b.ISBN LIKE $${indices["isbn"]}
        GROUP BY b.ISBN
      `,
      values: bookQueryValues,
    });

    const books = await Promise.all(
      booksQuery.rows.map(async (book) => {
        const genreQuery = await db.query({
          text: `
            SELECT g.genre
            FROM GENRE AS g
            WHERE g.bookID = $1
          `,
          values: [book.isbn],
        });
        const genre = genreQuery.rows.map((row) => row.genre);
        const deptQuery = await db.query({
          text: `
            SELECT cd.departmentCode
            FROM COURSEDEPT AS cd
              JOIN TEXTBOOK AS tb ON tb.serialNumber = cd.serialNumber AND tb.semester = cd.semester
            WHERE tb.bookID = $1
          `,
          values: [book.isbn],
        });
        const dept = deptQuery.rows.map((row) => row.departmentcode);
        return {
          ISBN: book.isbn,
          Title: book.title,
          PublisherName: book.publishername,
          AuthorName: book.authorname,
          Genres: genre,
          Departments: dept,
          LowestPrice: book.lowestprice,
          HighestPrice: book.highestprice,
        };
      })
    );
    db.release();
    return res.status(200).json({ data: books });
  } catch (error) {
    db.release();
    return res.status(500).json({ error: error.message });
  }
};

export const getBookInfoAndUsedBooks = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res
      .status(400)
      .json({ error: "ID of the book (ISBN) is required." });
  }

  let db;
  try {
    db = await pool.connect();
    const bookInfoQuery = await db.query({
      text: `
        SELECT b.Title, b.PublisherName
        FROM BOOK AS b
        WHERE b.ISBN = $1
      `,
      values: [id],
    });
    if (bookInfoQuery.rows.length === 0) {
      db.release();
      return res.status(404).json({ error: "Book not found." });
    }
    const bookInfo = bookInfoQuery.rows[0];

    const genreQuery = await db.query({
      text: `
        SELECT g.genre
        FROM GENRE AS g
        WHERE g.bookID = $1
      `,
      values: [id],
    });
    const genre = genreQuery.rows.map((row) => row.genre);

    const departmentsQuery = await db.query({
      text: `
        SELECT dept.departmentCode
        FROM COURSEDEPT AS dept
          JOIN TEXTBOOK AS tb ON tb.serialNumber = dept.serialNumber AND tb.semester = dept.semester
        WHERE tb.bookID = $1
      `,
      values: [id],
    });
    const departments = departmentsQuery.rows.map((row) => row.departmentcode);

    const usedBooksQuery = await db.query({
      text: `
        SELECT ub.usedBookID AS UsedBookID, 
          ub.bookPicture AS BookPicture, 
          ub.askingPrice AS AskingPrice, 
          ub.bookCondition AS BookCondition
        FROM USEDBOOK AS ub
        LEFT JOIN Purchase AS p ON ub.UsedBookID = p.UsedBookID
        WHERE ub.BookID = $1 AND p.UsedBookID IS NULL
      `,
      values: [id],
    });
    const usedBooks = usedBooksQuery.rows.map((book) => ({
      UsedBookID: book.usedbookid,
      BookPicture: book.bookpicture,
      AskingPrice: book.askingprice,
      BookCondition: book.bookcondition,
    }));

    db.release();
    return res.status(200).json({
      data: {
        Title: bookInfo.title,
        Publisher: bookInfo.publishername,
        Genres: genre,
        Departments: departments,
        UsedBooks: usedBooks,
      },
    });
  } catch (error) {
    db.release();
    return res.status(500).json({ error: error.message });
  }
};

export const addTextBookInfo = async (req, res) => {
  // Auth
  const user_id = req.authorization_id;
  if (!user_id) {
    return res.status(401).json({ error: "Must be logged in." });
  }

  const { BookID, SerialNumber, Semester } = req.body;
  if (!BookID || !SerialNumber || !Semester) {
    return res.status(400).json({ error: "All fields are required." });
  }

  let db;
  try {
    db = await pool.connect();
    const checkBook = await db.query({
      text: `
        SELECT * FROM BOOK WHERE ISBN = $1
      `,
      values: [BookID],
    });
    if (checkBook.rows.length === 0) {
      db.release();
      return res
        .status(404)
        .json({ error: "Book with that ISBN does not exist." });
    }

    const checkCourse = await db.query({
      text: `
        SELECT * FROM COURSE WHERE SerialNumber = $1 AND Semester = $2
      `,
      values: [SerialNumber, Semester],
    });
    if (checkCourse.rows.length === 0) {
      db.release();
      return res.status(404).json({
        error: "Course with that SerialNumber and Semester does not exist.",
      });
    }

    await db.query({
      text: `
        INSERT INTO TEXTBOOK (BookID, SerialNumber, Semester)
        VALUES ($1, $2, $3)
      `,
      values: [BookID, SerialNumber, Semester],
    });

    db.release();
    return res.status(200).json({
      data: {
        BookID: BookID,
      },
    });
  } catch (error) {
    db.release();
    return res.status(500).json({ error: error.message });
  }
};

export const addBook = async (req, res) => {
  // Auth of admin
  const user_id = req.authorization_id;
  if (user_id !== "admin") {
    return res.status(403).json({ error: "You are not authorized." });
  }

  const { ISBN, Title, Author, Genre, PublisherName, SuggestedRetailPrice } =
    req.body;
  if (
    !ISBN ||
    !Title ||
    !Author ||
    !Genre ||
    !PublisherName ||
    !SuggestedRetailPrice
  ) {
    return res.status(400).json({ error: "All fields are required." });
  }

  let db;
  try {
    db = await pool.connect();

    await db.query({
      text: "BEGIN"
    });

    await db.query({
      text: `
        INSERT INTO BOOK (ISBN, Title, PublisherName, SuggestedRetailPrice, AuthorName)
        VALUES ($1, $2, $3, $4, $5)
      `,
      values: [ISBN, Title, PublisherName, SuggestedRetailPrice, Author],
    });

    for (let g of Genre) {
      await db.query({
        text: `
          INSERT INTO GENRE (bookID, genre)
          VALUES ($1, $2)
        `,
        values: [ISBN, g],
      });
    }

    await db.query({
      text: "COMMIT"
    });
    db.release();
    return res.status(200).json({
      data: {
        ISBN: ISBN,
      },
    });
  } catch (error) {
    await db.query({
      text: "ROLLBACK"
    });
    db.release();
    return res.status(500).json({ error: error.message });
  }
};

export const updateBookDetails = async (req, res) => {
  // Auth of admin
  const user_id = req.authorization_id;
  if (user_id !== "admin") {
    return res.status(403).json({ error: "You are not authorized." });
  }

  const { id } = req.params; // ISBN of the book
  let { ISBN, Title, Genre, AuthorName, PublisherName, SuggestedRetailPrice } = req.body; // Updated values
   
  if (
    !ISBN &&
    !Title &&
    !Genre &&
    !AuthorName &&
    !PublisherName &&
    !SuggestedRetailPrice
  ) {
    return res.status(400).json({ error: "At least one field is required." });
  }

  let db;
  try {
    db = await pool.connect();
    const checkBook = await db.query({
      text: `
        SELECT * FROM BOOK WHERE ISBN = $1
      `,
      values: [id],
    });
    if (checkBook.rows.length === 0) {
      db.release();
      return res.status(404).json({ error: "Book not found." });
    }

    await db.query({
      text: "BEGIN"
    });

    if (ISBN || Title || AuthorName || PublisherName || SuggestedRetailPrice) {
      await db.query({
        text: `
          UPDATE BOOK
          SET 
            ISBN = $1,
            Title = $2,
            AuthorName = $3,
            PublisherName = $4,
            SuggestedRetailPrice = $5           
          WHERE ISBN = $6
        `,
        values: [
          ISBN ?? checkBook.rows[0].isbn,
          Title ?? checkBook.rows[0].title,
          AuthorName ?? checkBook.rows[0].authorname,
          PublisherName ?? checkBook.rows[0].publishername,
          SuggestedRetailPrice ?? checkBook.rows[0].suggestedretailprice,
          id,
        ],
      });
    }

    if (Genre) {      
      await db.query({
        text: `
          DELETE FROM GENRE
          WHERE bookID = $1
        `,
        values: [ISBN ?? id],
      });
      for (let g of Genre) {
        await db.query({
          text: `
            INSERT INTO GENRE (bookID, genre)
            VALUES ($1, $2)
          `,
          values: [ISBN ?? id, g],
        });
      }
    }

    await db.query({
      text: "COMMIT"
    });    
    db.release();
    return res.status(200).json({
      data: {
        BookID: ISBN ?? id,
      },
    });
  } catch (error) {
    await db.query({
      text: "ROLLBACK"
    });
    db.release();
    return res.status(500).json({ error: error.message });
  }
};

export const deleteBook = async (req, res) => {
  // Auth of admin
  const user_id = req.authorization_id;
  if (user_id !== "admin") {
    return res.status(403).json({ error: "You are not authorized." });
  }

  const { id } = req.params; // ISBN of the book

  let db;
  try {
    db = await pool.connect();
    const checkBook = await db.query({
      text: `
        SELECT * FROM BOOK WHERE ISBN = $1
      `,
      values: [id],
    });
    if (checkBook.rows.length === 0) {
      db.release();
      return res.status(404).json({ error: "Book not found." });
    }

    await db.query({
      text: `
        DELETE FROM BOOK
        WHERE ISBN = $1
      `,
      values: [id],
    });

    db.release();
    return res.status(200).json({
      data: {
        BookID: id,
      },
    });
  } catch (error) {
    db.release();
    return res.status(500).json({ error: error.message });
  }
};

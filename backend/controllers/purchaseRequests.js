import { pool } from "../index.js";

// Get all requests for used book
export const getRequests = async (req, res) => {
  const { id: usedBookId } = req.params;
  const SellerID = req.authorization_id;

  try {
    const db = await pool.connect();
    try {
      const existenceQuery = {
        text: "SELECT * FROM usedbook WHERE usedbookid = $1",
        values: [usedBookId],
      };
      const existenceResult = await db.query(existenceQuery);
      if (!existenceResult.rows.length) {
        db.release();
        return res.status(404).json({ error: "Used book not found" });
      }
      if (
        SellerID !== existenceResult.rows[0].sellerid &&
        SellerID !== "admin"
      ) {
        db.release();
        return res.status(403).json({ error: "You do not own this used book" });
      }
      const query = {
        text: "SELECT * FROM purchaserequest WHERE usedbookid = $1",
        values: [usedBookId],
      };
      const result = await db.query(query);
      const requests = result.rows.map((req) => ({
        BuyerID: req.buyerid,
        RequestTimestamp: req.requesttimestamp,
      }));
      db.release();
      return res.status(200).json({
        data: requests,
      });
    } catch (error) {
      db.release();
      return res.status(500).json({ error });
    }
  } catch (error) {
    return res.status(500).json({ error });
  }
};

// Get the request that a single user has made for a used book (if any)
export const getRequest = async (req, res) => {
  const { id: usedBookId } = req.params;
  const BuyerID = req.authorization_id;

  try {
    const db = await pool.connect();
    try {
      const existenceQuery = {
        text: "SELECT * FROM usedbook WHERE usedbookid = $1",
        values: [usedBookId],
      };
      const existenceResult = await db.query(existenceQuery);
      if (!existenceResult.rows.length) {
        db.release();
        return res.status(404).json({ error: "Used book not found" });
      }
      const query = {
        text: `
        SELECT * FROM purchaserequest 
        WHERE usedbookid = $1
        AND buyerid = $2
      `,
        values: [usedBookId, BuyerID],
      };
      const result = await db.query(query);
      db.release();
      return res.status(200).json({
        data: result.rowCount
          ? {
              RequestTimestamp: result.rows[0].requesttimestamp,
            }
          : {},
      });
    } catch (error) {
      db.release();
      return res.status(500).json({ error });
    }
  } catch (error) {
    return res.status(500).json({ error });
  }
};

// Add purchase request
export const addRequest = async (req, res) => {
  const { id: usedBookId } = req.params;
  const BuyerID = req.authorization_id;

  try {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const usedBookExistenceQuery = {
        text: "SELECT * FROM usedbook WHERE usedbookid = $1 FOR UPDATE",
        values: [usedBookId],
      };
      const usedBookExistenceResult = await db.query(usedBookExistenceQuery);
      if (!usedBookExistenceResult.rowCount) {
        await db.query("ROLLBACK");
        db.release();
        return res.status(404).json({ error: "Used book not found" });
      }
      const soldCheckQuery = {
        text: "SELECT * FROM purchase WHERE usedbookid = $1",
        values: [usedBookId],
      };
      const soldCheckResult = await db.query(soldCheckQuery);
      if (soldCheckResult.rowCount) {
        await db.query("ROLLBACK");
        db.release();
        return res
          .status(400)
          .json({ error: "Used book has already been sold" });
      }
      const requestExistenceQuery = {
        text: `
        SELECT * FROM purchaserequest 
        WHERE usedbookid = $1
        AND buyerid = $2
      `,
        values: [usedBookId, BuyerID],
      };
      const requestExistenceResult = await db.query(requestExistenceQuery);
      if (requestExistenceResult.rowCount) {
        await db.query("ROLLBACK");
        db.release();
        return res
          .status(400)
          .json({ error: "You have already requested this used book" });
      }
      const query = {
        text: `INSERT INTO purchaserequest 
      (buyerid, usedbookid) 
      VALUES ($1, $2) RETURNING requesttimestamp`,
        values: [BuyerID, usedBookId],
      };
      const result = await db.query(query);
      await db.query("COMMIT");
      db.release();
      return res.status(200).json({
        data: {
          UsedBookID: usedBookId,
          BuyerID,
          RequestTimestamp: result.rows[0].requesttimestamp,
        },
      });
    } catch (error) {
      await db.query("ROLLBACK");
      db.release();
      return res.status(500).json({ error });
    }
  } catch (error) {
    return res.status(500).json({ error });
  }
};

// Delete purchase request
export const deleteRequest = async (req, res) => {
  const { id: usedBookId } = req.params;
  const BuyerID = req.authorization_id;

  try {
    const db = await pool.connect();
    try {
      const usedBookExistenceQuery = {
        text: "SELECT * FROM usedbook WHERE usedbookid = $1",
        values: [usedBookId],
      };
      const usedBookExistenceResult = await db.query(usedBookExistenceQuery);
      if (!usedBookExistenceResult.rowCount) {
        db.release();
        return res.status(404).json({ error: "Used book not found" });
      }
      const requestExistenceQuery = {
        text: `
        SELECT * FROM purchaserequest 
        WHERE usedbookid = $1
        AND buyerid = $2
      `,
        values: [usedBookId, BuyerID],
      };
      const requestExistenceResult = await db.query(requestExistenceQuery);
      if (!requestExistenceResult.rowCount) {
        db.release();
        return res
          .status(404)
          .json({ error: "Purchase request for this used book not found" });
      }
      const query = {
        text: `
      DELETE FROM purchaserequest
      WHERE buyerid = $1 AND usedbookid = $2`,
        values: [BuyerID, usedBookId],
      };
      await db.query(query);
      db.release();
      return res.status(200).json();
    } catch (error) {
      db.release();
      return res.status(500).json({ error });
    }
  } catch (error) {
    return res.status(500).json({ error });
  }
};

// Add rating
export const addRating = async (req, res) => {
  const { id: usedBookId } = req.params;
  const { StarsCount, Review } = req.body;
  if (!StarsCount)
    return res.status(400).json({ error: "Missing stars count" });
  if (!(0 <= StarsCount && StarsCount <= 5))
    return res
      .status(400)
      .json({ error: "Stars count must be between 0 and 5 inclusive" });
  const BuyerID = req.authorization_id;

  try {
    const db = await pool.connect();
    try {
      const usedBookExistenceQuery = {
        text: "SELECT * FROM usedbook WHERE usedbookid = $1",
        values: [usedBookId],
      };
      const usedBookExistenceResult = await db.query(usedBookExistenceQuery);
      if (!usedBookExistenceResult.rowCount) {
        db.release();
        return res.status(404).json({ error: "Used book not found" });
      }
      const purchaseExistenceQuery = {
        text: `
        SELECT * FROM purchase 
        WHERE usedbookid = $1
        AND buyerid = $2
      `,
        values: [usedBookId, BuyerID],
      };
      const purchaseExistenceResult = await db.query(purchaseExistenceQuery);
      if (!purchaseExistenceResult.rowCount) {
        db.release();
        return res
          .status(403)
          .json({ error: "You have not purchased this used book" });
      }
      const ratingExistenceQuery = {
        text: `
        SELECT * FROM rating 
        WHERE usedbookid = $1
      `,
        values: [usedBookId],
      };
      const ratingExistenceResult = await db.query(ratingExistenceQuery);
      if (ratingExistenceResult.rowCount) {
        db.release();
        return res
          .status(400)
          .json({ error: "You have already rated this used book" });
      }

      const query = {
        text: `INSERT INTO rating 
      (usedbookid, starscount, review)
      VALUES ($1, $2, $3)`,
        values: [usedBookId, StarsCount, Review ?? ""],
      };
      await db.query(query);
      db.release();
      return res.status(200).json({
        data: {
          UsedBookID: usedBookId,
          StarsCount: StarsCount,
          Review: Review ?? "",
        },
      });
    } catch (error) {
      db.release();
      return res.status(500).json({ error });
    }
  } catch (error) {
    return res.status(500).json({ error });
  }
};

// Add a purchase
export const addPurchase = async (req, res) => {
  const { id: usedBookId } = req.params;
  const { BuyerID } = req.body;
  if (!BuyerID) return res.status(400).json({ error: "Missing buyer ID" });
  const SellerID = req.authorization_id;

  try {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const usedBookExistenceQuery = {
        text: "SELECT * FROM usedbook WHERE usedbookid = $1 FOR UPDATE",
        values: [usedBookId],
      };
      const usedBookExistenceResult = await db.query(usedBookExistenceQuery);
      if (!usedBookExistenceResult.rowCount) {
        await db.query("ROLLBACK");
        db.release();
        return res.status(404).json({ error: "Used book not found" });
      }
      if (
        SellerID !== usedBookExistenceResult.rows[0].sellerid &&
        SellerID !== "admin"
      ) {
        await db.query("ROLLBACK");
        db.release();
        return res.status(403).json({ error: "You do not own this used book" });
      }
      const purchaseExistenceQuery = {
        text: `
          SELECT * FROM purchase 
          WHERE usedbookid = $1
        `,
        values: [usedBookId],
      };
      const purchaseExistenceResult = await db.query(purchaseExistenceQuery);
      if (purchaseExistenceResult.rowCount) {
        await db.query("ROLLBACK");
        db.release();
        return res
          .status(400)
          .json({ error: "This used book has already been sold" });
      }
      const requestExistenceQuery = {
        text: `
          SELECT * FROM purchaserequest 
          WHERE usedbookid = $1
          AND buyerid = $2
        `,
        values: [usedBookId, BuyerID],
      };
      const requestExistenceResult = await db.query(requestExistenceQuery);
      if (!requestExistenceResult.rowCount) {
        await db.query("ROLLBACK");
        db.release();
        return res.status(404).json({ error: "Request not found" });
      }
      const query = {
        text: `INSERT INTO purchase 
      (usedbookid, buyerid)
      VALUES ($1, $2) RETURNING purchasetimestamp`,
        values: [usedBookId, BuyerID],
      };
      const result = await db.query(query);
      await db.query("COMMIT");
      db.release();
      return res.status(200).json({
        data: {
          UsedBookID: usedBookId,
          BuyerID,
          PurchaseTimeStamp: result.rows[0].purchasetimestamp,
        },
      });
    } catch (error) {
      await db.query("ROLLBACK");
      db.release();
      return res.status(500).json({ error });
    }
  } catch (error) {
    return res.status(500).json({ error });
  }
};

import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "insightflow-secret-key";

// Database Abstraction Layer
interface DbProvider {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
  connect?: () => Promise<any>;
}

let db: DbProvider;
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  console.log("Using PostgreSQL database");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  });
  db = {
    query: (text: string, params?: any[]) => pool.query(text.replace(/\$\d+/g, (match) => match), params),
    connect: () => pool.connect()
  };
} else {
  console.log("Using SQLite database (fallback for preview)");
  const sqlite = new Database("insightflow.db");
  db = {
    query: async (text: string, params: any[] = []) => {
      // Convert PostgreSQL $1, $2 syntax to SQLite ? syntax and remove RETURNING
      const sqliteQuery = text.replace(/\$\d+/g, "?").replace(/RETURNING\s+\w+/i, "");
      if (text.trim().toUpperCase().startsWith("SELECT")) {
        const rows = sqlite.prepare(sqliteQuery).all(...params);
        return { rows };
      } else {
        const result = sqlite.prepare(sqliteQuery).run(...params);
        return { rows: [{ id: Number(result.lastInsertRowid) }] };
      }
    }
  };
}

// Initialize Database Schema
async function initDb() {
  try {
    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id ${isPostgres ? "SERIAL" : "INTEGER"} PRIMARY KEY ${isPostgres ? "" : "AUTOINCREMENT"},
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        bio TEXT,
        created_at ${isPostgres ? "TIMESTAMP" : "DATETIME"} DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS communities (
        id ${isPostgres ? "SERIAL" : "INTEGER"} PRIMARY KEY ${isPostgres ? "" : "AUTOINCREMENT"},
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        image TEXT
      );

      CREATE TABLE IF NOT EXISTS polls (
        id ${isPostgres ? "SERIAL" : "INTEGER"} PRIMARY KEY ${isPostgres ? "" : "AUTOINCREMENT"},
        title TEXT NOT NULL,
        description TEXT,
        creator_id INTEGER NOT NULL REFERENCES users(id),
        community_id INTEGER REFERENCES communities(id),
        created_at ${isPostgres ? "TIMESTAMP" : "DATETIME"} DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comments (
        id ${isPostgres ? "SERIAL" : "INTEGER"} PRIMARY KEY ${isPostgres ? "" : "AUTOINCREMENT"},
        poll_id INTEGER NOT NULL REFERENCES polls(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        text TEXT NOT NULL,
        created_at ${isPostgres ? "TIMESTAMP" : "DATETIME"} DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS choices (
        id ${isPostgres ? "SERIAL" : "INTEGER"} PRIMARY KEY ${isPostgres ? "" : "AUTOINCREMENT"},
        poll_id INTEGER NOT NULL REFERENCES polls(id),
        text TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS votes (
        id ${isPostgres ? "SERIAL" : "INTEGER"} PRIMARY KEY ${isPostgres ? "" : "AUTOINCREMENT"},
        user_id INTEGER NOT NULL REFERENCES users(id),
        choice_id INTEGER NOT NULL REFERENCES choices(id),
        poll_id INTEGER NOT NULL REFERENCES polls(id),
        UNIQUE(user_id, poll_id)
      );

      CREATE TABLE IF NOT EXISTS saved_polls (
        id ${isPostgres ? "SERIAL" : "INTEGER"} PRIMARY KEY ${isPostgres ? "" : "AUTOINCREMENT"},
        user_id INTEGER NOT NULL REFERENCES users(id),
        poll_id INTEGER NOT NULL REFERENCES polls(id),
        created_at ${isPostgres ? "TIMESTAMP" : "DATETIME"} DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, poll_id)
      );
    `;

    if (isPostgres) {
      await db.query(schema);
    } else {
      // SQLite better-sqlite3 doesn't support multiple statements in one query easily via prepare
      const sqlite = new Database("insightflow.db");
      sqlite.exec(schema);
    }
    console.log("Database initialized");
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}

initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // SSE Notification Clients
  const clients = new Set<any>();

  app.get("/api/notifications/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    clients.add(res);

    req.on("close", () => {
      clients.delete(res);
    });
  });

  const broadcastNotification = (data: any) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach((client) => client.write(message));
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        const result = await db.query(
          "INSERT INTO users (username, password, avatar) VALUES ($1, $2, $3) RETURNING id",
          [username, hashedPassword, avatar]
        );
        const userId = result.rows[0].id;
        const token = jwt.sign({ id: userId, username }, JWT_SECRET);
        res.cookie("token", token, { httpOnly: true, sameSite: "none", secure: true });
        res.json({ id: userId, username });
      } catch (err: any) {
        res.status(400).json({ error: "Username already exists" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, sameSite: "none", secure: true });
      res.json({ id: user.id, username: user.username });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = req.cookies.token;
      if (!token) return res.json(null);
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const result = await db.query("SELECT id, username, avatar, bio FROM users WHERE id = $1", [decoded.id]);
        res.json(result.rows[0] || null);
      } catch (err) {
        res.json(null);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/auth/profile", authenticate, async (req: any, res) => {
    try {
      const { username, bio, avatar, password } = req.body;
      try {
        if (password) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await db.query(
            "UPDATE users SET username = $1, bio = $2, avatar = $3, password = $4 WHERE id = $5",
            [username, bio, avatar, hashedPassword, req.user.id]
          );
        } else {
          await db.query(
            "UPDATE users SET username = $1, bio = $2, avatar = $3 WHERE id = $4",
            [username, bio, avatar, req.user.id]
          );
        }
        res.json({ success: true });
      } catch (err) {
        res.status(400).json({ error: "Username already taken or update failed" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // Public User Route
  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const result = await db.query(`
        SELECT u.id, u.username, u.avatar, u.bio, u.created_at,
        (SELECT COUNT(*) FROM polls WHERE creator_id = u.id) as poll_count
        FROM users u WHERE u.id = $1
      `, [userId]);
      
      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      user.poll_count = parseInt(user.poll_count || '0');
      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Poll Routes
  app.get("/api/polls", async (req, res) => {
    try {
      const token = req.cookies.token;
      let currentUserId: any = null;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          currentUserId = decoded.id;
        } catch (err) {}
      }

      const pollsResult = await db.query(`
        SELECT p.*, u.username as creator_name, u.avatar as creator_avatar
        FROM polls p
        JOIN users u ON p.creator_id = u.id
        ORDER BY p.created_at DESC
      `);

      const getSaved = currentUserId 
        ? await db.query("SELECT poll_id FROM saved_polls WHERE user_id = $1", [currentUserId])
        : { rows: [] };
      const savedPollIds = new Set(getSaved.rows.map((row: any) => row.poll_id));

      const pollsWithDetails = await Promise.all(pollsResult.rows.map(async (poll: any) => {
        const choicesResult = await db.query(`
          SELECT c.*, (SELECT COUNT(*) FROM votes v WHERE v.choice_id = c.id) as vote_count
          FROM choices c
          WHERE c.poll_id = $1
        `, [poll.id]);

        const userVoteResult = currentUserId 
          ? await db.query("SELECT choice_id FROM votes WHERE user_id = $1 AND poll_id = $2", [currentUserId, poll.id])
          : { rows: [] };

        const choices = choicesResult.rows.map(c => ({ ...c, vote_count: parseInt(c.vote_count) }));
        const userVote = userVoteResult.rows[0];

        return {
          ...poll,
          choices,
          hasVoted: !!userVote,
          userVoteId: userVote ? userVote.choice_id : null,
          totalVotes: choices.reduce((sum: number, c: any) => sum + c.vote_count, 0),
          isSaved: savedPollIds.has(poll.id)
        };
      }));

      res.json(pollsWithDetails);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/polls/trending", async (req, res) => {
    try {
      const token = req.cookies.token;
      let currentUserId: any = null;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          currentUserId = decoded.id;
        } catch (err) {}
      }

      const pollsResult = await db.query(`
        SELECT p.*, u.username as creator_name, u.avatar as creator_avatar,
        (SELECT COUNT(*) FROM votes v WHERE v.poll_id = p.id) as total_votes
        FROM polls p
        JOIN users u ON p.creator_id = u.id
        ORDER BY total_votes DESC, p.created_at DESC
        LIMIT 20
      `);

      const getSaved = currentUserId 
        ? await db.query("SELECT poll_id FROM saved_polls WHERE user_id = $1", [currentUserId])
        : { rows: [] };
      const savedPollIds = new Set(getSaved.rows.map((row: any) => row.poll_id));

      const pollsWithDetails = await Promise.all(pollsResult.rows.map(async (poll: any) => {
        const choicesResult = await db.query(`
          SELECT c.*, (SELECT COUNT(*) FROM votes v WHERE v.choice_id = c.id) as vote_count
          FROM choices c
          WHERE c.poll_id = $1
        `, [poll.id]);

        const userVoteResult = currentUserId 
          ? await db.query("SELECT choice_id FROM votes WHERE user_id = $1 AND poll_id = $2", [currentUserId, poll.id])
          : { rows: [] };

        const choices = choicesResult.rows.map(c => ({ ...c, vote_count: parseInt(c.vote_count) }));
        const userVote = userVoteResult.rows[0];

        return {
          ...poll,
          choices,
          hasVoted: !!userVote,
          userVoteId: userVote ? userVote.choice_id : null,
          totalVotes: parseInt(poll.total_votes),
          isSaved: savedPollIds.has(poll.id)
        };
      }));

      res.json(pollsWithDetails);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/polls/me", authenticate, async (req: any, res) => {
    try {
      const pollsResult = await db.query(`
        SELECT p.*, u.username as creator_name, u.avatar as creator_avatar
        FROM polls p
        JOIN users u ON p.creator_id = u.id
        WHERE p.creator_id = $1
        ORDER BY p.created_at DESC
      `, [req.user.id]);

      const getSaved = await db.query("SELECT poll_id FROM saved_polls WHERE user_id = $1", [req.user.id]);
      const savedPollIds = new Set(getSaved.rows.map((row: any) => row.poll_id));

      const pollsWithDetails = await Promise.all(pollsResult.rows.map(async (poll: any) => {
        const choicesResult = await db.query(`
          SELECT c.*, (SELECT COUNT(*) FROM votes v WHERE v.choice_id = c.id) as vote_count
          FROM choices c
          WHERE c.poll_id = $1
        `, [poll.id]);

        const userVoteResult = await db.query("SELECT choice_id FROM votes WHERE user_id = $1 AND poll_id = $2", [req.user.id, poll.id]);

        const choices = choicesResult.rows.map(c => ({ ...c, vote_count: parseInt(c.vote_count) }));
        const userVote = userVoteResult.rows[0];

        return {
          ...poll,
          choices,
          hasVoted: !!userVote,
          userVoteId: userVote ? userVote.choice_id : null,
          totalVotes: choices.reduce((sum: number, c: any) => sum + c.vote_count, 0),
          isSaved: savedPollIds.has(poll.id)
        };
      }));

      res.json(pollsWithDetails);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/communities", async (req, res) => {
    try {
      const countResult = await db.query("SELECT COUNT(*) as count FROM communities");
      if (parseInt(countResult.rows[0].count) === 0) {
        const seed = [
          ["Tech & AI", "Discuss the latest in technology", "https://picsum.photos/seed/tech/400/200"],
          ["Design", "Creative UI/UX and Graphic Design", "https://picsum.photos/seed/design/400/200"],
          ["Politics", "Global and local political discussions", "https://picsum.photos/seed/politics/400/200"],
          ["Gaming", "All things video games", "https://picsum.photos/seed/gaming/400/200"]
        ];
        for (const c of seed) {
          await db.query("INSERT INTO communities (name, description, image) VALUES ($1, $2, $3)", c);
        }
      }
      const communitiesResult = await db.query("SELECT * FROM communities");
      res.json(communitiesResult.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/polls/:id/comments", async (req, res) => {
    try {
      const commentsResult = await db.query(`
        SELECT c.*, u.username, u.avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.poll_id = $1
        ORDER BY c.created_at DESC
      `, [req.params.id]);
      res.json(commentsResult.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/polls/:id/comments", authenticate, async (req: any, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Comment text is required" });
      await db.query("INSERT INTO comments (poll_id, user_id, text) VALUES ($1, $2, $3)", [req.params.id, req.user.id, text]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/polls", authenticate, async (req: any, res) => {
    try {
      const { title, description, choices } = req.body;
      if (!title || choices.length < 2) {
        return res.status(400).json({ error: "Invalid poll data" });
      }

      try {
        // Simple transaction-like behavior for hybrid db
        const pollResult = await db.query(
          "INSERT INTO polls (title, description, creator_id) VALUES ($1, $2, $3) RETURNING id",
          [title, description, req.user.id]
        );
        const pollId = pollResult.rows[0].id;

        for (const choice of choices) {
          await db.query("INSERT INTO choices (poll_id, text) VALUES ($1, $2)", [pollId, choice]);
        }

        // Broadcast notification to all users
        const userResult = await db.query("SELECT username FROM users WHERE id = $1", [req.user.id]);
        if (userResult.rows[0]) {
          broadcastNotification({
            id: Date.now(),
            type: 'NEW_POLL',
            username: userResult.rows[0].username,
            pollId: pollId,
            timestamp: new Date().toISOString()
          });
        }

        res.json({ id: pollId });
      } catch (err) {
        res.status(500).json({ error: "Failed to create poll" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/polls/:id/vote", authenticate, async (req: any, res) => {
    try {
      const pollId = req.params.id;
      const { choiceId } = req.body;

      try {
        await db.query(
          "INSERT INTO votes (user_id, choice_id, poll_id) VALUES ($1, $2, $3)",
          [req.user.id, choiceId, pollId]
        );
        res.json({ success: true });
      } catch (err) {
        res.status(400).json({ error: "Already voted or invalid choice" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/polls/:id/save", authenticate, async (req: any, res) => {
    try {
      const pollId = req.params.id;
      
      const exists = await db.query(
        "SELECT id FROM saved_polls WHERE user_id = $1 AND poll_id = $2",
        [req.user.id, pollId]
      );

      if (exists.rows.length > 0) {
        // Unsave
        await db.query("DELETE FROM saved_polls WHERE user_id = $1 AND poll_id = $2", [req.user.id, pollId]);
        res.json({ saved: false });
      } else {
        // Save
        await db.query("INSERT INTO saved_polls (user_id, poll_id) VALUES ($1, $2)", [req.user.id, pollId]);
        res.json({ saved: true });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/polls/saved", authenticate, async (req: any, res) => {
    try {
      const pollsResult = await db.query(`
        SELECT p.*, u.username as creator_name, u.avatar as creator_avatar
        FROM polls p
        JOIN users u ON p.creator_id = u.id
        JOIN saved_polls sp ON p.id = sp.poll_id
        WHERE sp.user_id = $1
        ORDER BY sp.created_at DESC
      `, [req.user.id]);

      const pollsWithDetails = await Promise.all(pollsResult.rows.map(async (poll: any) => {
        const choicesResult = await db.query(`
          SELECT c.*, (SELECT COUNT(*) FROM votes v WHERE v.choice_id = c.id) as vote_count
          FROM choices c
          WHERE c.poll_id = $1
        `, [poll.id]);

        const userVoteResult = await db.query("SELECT choice_id FROM votes WHERE user_id = $1 AND poll_id = $2", [req.user.id, poll.id]);

        const choices = choicesResult.rows.map(c => ({ ...c, vote_count: parseInt(c.vote_count) }));
        const userVote = userVoteResult.rows[0];

        return {
          ...poll,
          choices,
          hasVoted: !!userVote,
          userVoteId: userVote ? userVote.choice_id : null,
          totalVotes: choices.reduce((sum: number, c: any) => sum + c.vote_count, 0),
          isSaved: true
        };
      }));

      res.json(pollsWithDetails);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 404 handler for API routes
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Custom error handler to ensure JSON responses instead of HTML
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error:", err);
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    res.status(500).json({ error: "Internal server error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

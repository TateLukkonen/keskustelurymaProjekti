import express from "express";
import session from "express-session";
import mysql from "mysql2/promise";
import path from "node:path";
import bcrypt from "bcrypt";
import http from "node:http";
import { Server } from "socket.io";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";

import config from "./config.json" with { type: "json" };
import dbconfig from "./dbconfig.json" with { type: "json" };
import db from "./db.js";

const regEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const { host, port } = config;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = mysql.createPool({
  host: dbconfig.host,
  user: dbconfig.user,
  password: dbconfig.password,
  database: dbconfig.database,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }),
);

app.use(express.static("public"));
app.use("/styles", express.static("public/styles"));
app.use("/uploads", express.static("uploads"));

function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

app.get("/", isLoggedIn, (req, res) => {
  res.redirect("/home");
});

app.get("/login", (req, res) => {
  res.render("login", { path: req.path });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/home", isLoggedIn, async (req, res) => {
  try {
    const sessionUser = await db.getCurrentSessionUser(req.session.user.id);
    const servers = await db.getServers();

    res.render("home", {
      user: sessionUser[0],
      servers,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/main_page", isLoggedIn, async (req, res) => {
  try {
    const channelMessages = await db.getChannelMessages(1);
    const servers = await db.getServers();
    const sessionUser = await db.getCurrentSessionUser(req.session.user.id);

    res.render("main_page", {
      channelMessages,
      servers,
      sessionUser: sessionUser[0],
      path: req.path,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/chat", isLoggedIn, (req, res) => {
  res.render("chat", { path: req.path });
});

app.get("/posts", isLoggedIn, (req, res) => {
  res.render("posts", { path: req.path });
});

app.get("/servers", isLoggedIn, async (req, res) => {
  try {
    const servers = await db.getServers();

    res.render("servers", {
      servers,
      path: req.path,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading servers");
  }
});

app.get("/create_server_settings", isLoggedIn, (req, res) => {
  res.render("create_server_settings", { path: req.path });
});

app.get("/server/:id", isLoggedIn, async (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.user.id;

  try {
    const serverData = await db.getServerById(serverId);
    const serverInfo = Array.isArray(serverData) ? serverData[0] : serverData;

    if (!serverInfo) {
      return res.status(404).send("Server not found");
    }

    const sessionUserData = await db.getCurrentSessionUser(userId);
    const sessionUser = Array.isArray(sessionUserData)
      ? sessionUserData[0]
      : sessionUserData;

    const joined = await db.isMember(serverId, userId);
    const isModerator = await db.isServerModerator(serverId, userId);

    const joinedServers = await db.getJoinedServers(userId);
    const memberList = await db.getMemberList(serverId);

    const [posts] = await pool.query(
      `
      SELECT 
        p.post_id,
        p.server_id,
        p.user_id,
        p.title,
        p.img,
        p.text_content,
        p.creation_date,
        p.upvotes,
        p.downvotes,
        u.username,
        u.display_name,
        u.avatar_url
      FROM posts p
      JOIN users u ON u.user_id = p.user_id
      WHERE p.server_id = ?
      ORDER BY p.creation_date DESC
      `,
      [serverId],
    );

    const [comments] = await pool.query(
      `
      SELECT 
        pc.comment_id,
        pc.post_id,
        pc.user_id,
        pc.text_content,
        pc.creation_date,
        u.username,
        u.display_name,
        u.avatar_url
      FROM post_comments pc
      JOIN users u ON u.user_id = pc.user_id
      JOIN posts p ON p.post_id = pc.post_id
      WHERE p.server_id = ?
      ORDER BY pc.creation_date ASC
      `,
      [serverId],
    );

    const [members] = await pool.query(
      `
      SELECT 
        u.user_id,
        u.display_name AS name,
        u.avatar_url AS pfp,
        u.status,
        u.bio
      FROM member_list ml
      JOIN users u ON u.user_id = ml.user_id
      WHERE ml.server_id = ?
      ORDER BY u.display_name
      `,
      [serverId],
    );

    res.render("server", {
      serverName: serverInfo.name,
      serverId,
      joined,
      isModerator,
      joinedServers,
      memberList,
      posts,
      comments,
      members,
      sessionUser,
      path: req.path,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/join_server", isLoggedIn, async (req, res) => {
  try {
    const serverId = req.body.server_id;
    const userId = req.session.user.id;

    await db.joinServer(serverId, userId);

    res.redirect(`/server/${serverId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to join server");
  }
});

app.post(
  "/servers/:serverId/posts",
  isLoggedIn,
  upload.single("img"),
  async (req, res) => {
    const serverId = req.params.serverId;
    const userId = req.session.user.id;

    try {
      const joined = await db.isMember(serverId, userId);

      if (!joined) {
        return res.redirect(`/server/${serverId}`);
      }

      const img = req.file ? `/uploads/${req.file.filename}` : null;

      await pool.query(
        `
      INSERT INTO posts 
      (server_id, user_id, title, img, text_content, creation_date)
      VALUES (?, ?, ?, ?, ?, NOW())
      `,
        [serverId, userId, req.body.title, img, req.body.text_content],
      );

      res.redirect(`/server/${serverId}`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Failed to create post");
    }
  },
);

app.post("/posts/:postId/comments", isLoggedIn, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.session.user.id;

  try {
    const [posts] = await pool.query(
      "SELECT server_id FROM posts WHERE post_id = ?",
      [postId],
    );

    if (posts.length === 0) {
      return res.redirect("/home");
    }

    await pool.query(
      `
      INSERT INTO post_comments
      (post_id, user_id, text_content, creation_date)
      VALUES (?, ?, ?, NOW())
      `,
      [postId, userId, req.body.text_content],
    );

    res.redirect(`/server/${posts[0].server_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to comment");
  }
});

app.post("/posts/:postId/upvote", isLoggedIn, async (req, res) => {
  const postId = req.params.postId;

  try {
    const [posts] = await pool.query(
      "SELECT server_id FROM posts WHERE post_id = ?",
      [postId],
    );

    if (posts.length === 0) {
      return res.redirect("/home");
    }

    await pool.query(
      "UPDATE posts SET upvotes = upvotes + 1 WHERE post_id = ?",
      [postId],
    );

    res.redirect(`/server/${posts[0].server_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to upvote");
  }
});

app.post("/posts/:postId/downvote", isLoggedIn, async (req, res) => {
  const postId = req.params.postId;

  try {
    const [posts] = await pool.query(
      "SELECT server_id FROM posts WHERE post_id = ?",
      [postId],
    );

    if (posts.length === 0) {
      return res.redirect("/home");
    }

    await pool.query(
      "UPDATE posts SET downvotes = downvotes + 1 WHERE post_id = ?",
      [postId],
    );

    res.redirect(`/server/${posts[0].server_id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to downvote");
  }
});

app.post("/update_display_name", isLoggedIn, async (req, res) => {
  try {
    const newName = req.body.display_name;
    const userId = req.session.user.id;

    await db.updateDisplayName(newName, userId);

    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error changing display name");
  }
});

app.post("/register", upload.single("pfp"), async (req, res) => {
  try {
    const { full_name, username, password, display_name, email, bio } =
      req.body;

    const pfpPath = req.file
      ? `/uploads/${req.file.filename}`
      : "/uploads/default_icon.png";

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.registerAccount(
      full_name,
      username,
      display_name,
      email,
      hashedPassword,
      false,
      false,
      "offline",
      pfpPath,
      bio,
    );

    res.redirect("/login");
  } catch (err) {
    console.error("User registration failed:", err);
    res.redirect("/register");
  }
});

app.post(
  "/create_server",
  isLoggedIn,
  upload.single("pfp"),
  async (req, res) => {
    try {
      const pfpPath = req.file
        ? `/uploads/${req.file.filename}`
        : "/uploads/default_icon.png";

      const serverLink = crypto.randomBytes(8).toString("hex");
      const isPrivate = req.body.pub_priv === "private_choice" ? 1 : 0;
      const inviteLink = isPrivate
        ? crypto.randomBytes(8).toString("hex")
        : null;

      const data = {
        name: req.body.server_name,
        short_name: req.body.short_name,
        server_picture_url: pfpPath,
        private: isPrivate,
        server_link: serverLink,
        invite_link: inviteLink,
        owner: req.session.user.id,
      };

      await db.createServer(data);

      res.redirect("/home");
    } catch (err) {
      console.error(err);
      res.status(500).send("Error creating server");
    }
  },
);

app.post("/login", async (req, res) => {
  const login = req.body.login;
  const password = req.body.password;

  try {
    const hashedPass = regEmail.test(login)
      ? await db.attemptLogin(false, login, password)
      : await db.attemptLogin(login, false, password);

    bcrypt.compare(password, hashedPass, async (err, bcryptResult) => {
      if (err || !bcryptResult) {
        delete req.session;
        return res.redirect("/login");
      }

      const userId = regEmail.test(login)
        ? await db.getIdByEmail(login)
        : await db.getIdByUsername(login);

      req.session.user = { id: userId };
      res.redirect("/home");
    });
  } catch (err) {
    console.error(err);
    delete req.session;
    res.redirect("/login");
  }
});

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("join_server_room", (serverId) => {
    socket.join(`server_${serverId}`);
    console.log("joined room:", serverId);
  });

  socket.on("chat message", async (msg) => {
    try {
      const isMember = await db.isMember(msg.serverId, msg.userId);

      if (!isMember) return;

      const msgId = await db.setChannelMessages(msg);
      const msgInfo = await db.getChannelMessage(msgId.message_id);

      io.to(`server_${msg.serverId}`).emit("chat message", msgInfo[0]);
    } catch (err) {
      console.error("Socket message error:", err);
    }
  });

  socket.on("delete message", async (messageId) => {
    await db.deleteMessage(messageId);
    io.emit("delete message", messageId);
  });

  socket.on("upvote", async (postId, serverId) => {
    try {
      await db.upvotePost(postId);
      io.to(`server_${serverId}`).emit("post upvote", postId);
    } catch (err) {
      console.error("Socket upvote error:", err);
    }
  });

  socket.on("downvote", async (postId, serverId) => {
    try {
      await db.downvotePost(postId);
      io.to(`server_${serverId}`).emit("post downvote", postId);
    } catch (err) {
      console.error("Socket downvote error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

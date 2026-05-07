// Imports
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

const dbHost = dbconfig.host;
const dbName = dbconfig.database;
const dbUser = dbconfig.user;
const dbPwd = dbconfig.password;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPwd,
  database: dbName,
});

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

app.get("/", isLoggedIn, (req, res) => {
  res.redirect("/home");
});

app.get("/login", (req, res) => {
  res.render("login", { path: req.path });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/create_server_settings", isLoggedIn, (req, res) => {
  res.render("create_server_settings", { path: req.path });
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

app.get("/posts", isLoggedIn, (req, res) => {
  res.render("posts", { path: req.path });
});

app.get("/main_page", isLoggedIn, async (req, res) => {
  try {
    const channelMsg = await db.getChannelMessages(1);
    const servers = await db.getServers();
    const sessionUser = await db.getCurrentSessionUser(req.session.user.id);

    res.render("main_page", {
      channelMessages: channelMsg,
      servers,
      sessionUser: sessionUser[0],
      path: req.path,
    });
  } catch (err) {
    console.error("Database error: " + err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/home", isLoggedIn, async (req, res) => {
  try {
    const sessionUser = await db.getCurrentSessionUser(req.session.user.id);
    const serversList = await db.getServers();

    res.render("home", {
      user: {
        username: sessionUser.username,
        display_name: sessionUser.display_name,
        online: sessionUser.status,
        bio: sessionUser.bio,
      },
      servers: serversList,
    });
  } catch (err) {
    console.error("Database error: " + err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/chat", isLoggedIn, (req, res) => {
  res.render("chat", { path: req.path });
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

app.post("/register", upload.single("pfp"), async (req, res) => {
  try {
    const { full_name, username, password, display_name, email, bio } =
      req.body;

    const pfp_path = req.file
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
      pfp_path,
      bio,
    );

    res.redirect("/login");
  } catch (err) {
    console.error("User registration failed:", err);
    return res.redirect("/register");
  }
});

app.post("/create_server", upload.single("pfp"), async (req, res) => {
  try {
    const pfp_path = req.file
      ? `/uploads/${req.file.filename}`
      : "/uploads/default_icon.png";

    const serverLink = crypto.randomBytes(8).toString("hex");
    const isPrivate = req.body.pub_priv === "private_choice" ? 1 : 0;

    let inviteLink;

    if (isPrivate == 1) {
      inviteLink = crypto.randomBytes(8).toString("hex");
    } else {
      inviteLink = null;
    }

    const data = {
      name: req.body.server_name,
      short_name: req.body.short_name,
      server_picture_url: pfp_path,
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
});

app.post("/login", async (req, res) => {
  const login = req.body.login;
  const password = req.body.password;

  if (regEmail.test(login) === true) {
    try {
      const hashedPass = await db.attemptLogin(false, login, password);

      bcrypt.compare(password, hashedPass, async function (err, bcryptRes) {
        if (err) {
          console.log("Password comparison went wrong: ", err);
          delete req.session;
          return res.redirect("/login");
        }

        if (bcryptRes) {
          const userId = await db.getIdByEmail(login);
          req.session.user = { id: userId };
          return res.redirect("/home");
        }

        delete req.session;
        return res.redirect("/login");
      });
    } catch (err) {
      console.log(err);
      delete req.session;
      res.redirect("/login");
    }
  } else {
    try {
      const hashedPass = await db.attemptLogin(login, false, password);

      bcrypt.compare(password, hashedPass, async function (err, bcryptRes) {
        if (err) {
          console.log("Password comparison went wrong: ", err);
          delete req.session;
          return res.redirect("/login");
        }

        if (bcryptRes) {
          const userId = await db.getIdByUsername(login);
          req.session.user = { id: userId };
          return res.redirect("/home");
        }

        delete req.session;
        return res.redirect("/login");
      });
    } catch (err) {
      console.log(err);
      delete req.session;
      res.redirect("/login");
    }
  }
});

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("join_server_room", (serverId) => {
    socket.join(`server_${serverId}`);
    console.log("joined room:", serverId);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
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

  socket.on("delete message", async (message_id) => {
    await db.deleteMessage(message_id);
    io.emit("delete message", message_id);
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

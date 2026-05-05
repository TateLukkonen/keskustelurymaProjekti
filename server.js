// Imports
import express from "express";
import session from "express-session";
import mysql from "mysql2/promise";
import path from "node:path";
import bcrypt from "bcrypt";
import http from "node:http";
import { Server } from "socket.io";
import crypto from "node:crypto";

import config from "./config.json" with { type: "json" };
import dbconfig from "./dbconfig.json" with { type: "json" };
import db from "./db.js";
import { fileURLToPath } from "node:url";
import multer from "multer";

// RegEx
const regEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Constants
const { host, port } = config;

// Database information
const dbHost = dbconfig.host;
const dbName = dbconfig.database;
const dbUser = dbconfig.user;
const dbPwd = dbconfig.password;

const app = express();

const server = http.createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server configuration
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static
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

// uploads folder for profile pictures
app.use("/uploads", express.static("uploads"));

// Functions
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  } else {
    next();
  }
}

// Paths
app.get("/", isLoggedIn, (req, res) => {
  res.redirect("/main_page");
});

app.get("/login", (req, res) => {
  res.render("login", { path: req.path });
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

app.get("/Post", isLoggedIn, (req, res) => {
  res.render("Post", { path: req.path });
});
app.get("/register", (req, res) => {
  res.render("register");
});

//  GET METHODS
app.get("/main_page", isLoggedIn, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPwd,
      database: dbName,
    });

    const channelMsg = await db.getChannelMessages(1);
    const servers = await db.getServers();
    const sessionUser = await db.getCurrentSessionUser(req.session.user.id);

    res.render("main_page", {
      channelMessages: channelMsg,
      servers: servers,
      sessionUser: sessionUser[0],
      path: req.path,
    });
  } catch (err) {
    console.error("Database error: " + err);
    res.status(500).send("Internal Server Error");
  }
  if (connection) {
    try {
      await connection.end();
    } catch (closeError) {
      console.error("Error closing connection:", closeError);
    }
  }
});

app.get("/home", isLoggedIn, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPwd,
      database: dbName,
    });

    const sessionUser = await db.getCurrentSessionUser(req.session.user.id);

    res.render("home", {
      user: {
        username: sessionUser.username,
        display_name: sessionUser.display_name,
        online: sessionUser.status,
        bio: sessionUser.bio,
      },
      servers: [{ name: "Test Server", members: 10, createdAt: new Date() }],
    });
  } catch (err) {
    console.error("Database error: " + err);
    res.status(500).send("Internal Server Error");
  }
});

// ... muiden app.get-reittien jatkoksi
app.get("/chat", isLoggedIn, (req, res) => {
  res.render("chat", { path: req.path });
});

app.get("/server/:id", isLoggedIn, async (req, res) => {
  const serverId = req.params.id;

  try {
    console.log("Server ID:", serverId);

    if (!serverId) {
      return res.status(400).send("Server ID missing");
    }

    const channelMessages = await db.getChannelMessages(serverId); // gotta change to posts on db level
    const sessionUser = await db.getCurrentSessionUser(req.session.user.id);

    const userId = req.session.user.id;

    const joined = await db.isMember(channelId, userId);

    const userId = req.session.user.id;

    const joined = await db.isMember(channelId, userId);

    res.render("server", {
      channelMessages, // change to posts after
      sessionUser: sessionUser[0],
      serverId,
      joined,
      path: req.path,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Socket.IO events

io.on("connection", (socket) => {
  console.log("a user connected");
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

io.on("connection", (socket) => {
  socket.on("join_server_room", (serverId) => {
    socket.join(`server_${serverId}`);
    console.log("joined room:", serverId);
  });
});

// POST METHODS

app.post("/create_server", async (req, res) => {
  try {
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
      server_pfp: req.body.server_pfp,
      private: isPrivate,
      server_link: serverLink,
      invite_link: inviteLink,
      owner: req.session.user.id,
    };

    await db.createServer(data);

    res.redirect("/main_page");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating server");
  }
});

app.post("/join_server", isLoggedIn, async (req, res) => {
  try {
    const serverId = req.body.server_id;
    const userId = req.session.user.id;

    await db.joinServer(serverId, userId);

    res.redirect(`/channel/${serverId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to join server");
  }
});

/*
app.post('/main_page_send_message', async (req, res) => {
    const message = req.body.message

    await db.setChannelMessages(message)

    res.redirect('/main_page')
})

app.post('/delete_message', async (req, res) => {
    const message_id = req.body.message_id

    await db.deleteMessage(message_id)

    res.redirect('/main_page')
})
*/

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

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
    console.error(err);
    res.status(500).send("Registration failed");
  }
});

app.post("/login", async (req, res) => {
  const login = req.body.login;
  const password = req.body.password;

  if (regEmail.test(login) === true) {
    try {
      async function loginFunction(login, password) {
        const foundUserHashedPass = await db.attemptLogin(
          false,
          login,
          password,
        );
        return foundUserHashedPass;
      }

      const hashedPass = await loginFunction(login, password);

      bcrypt.compare(password, hashedPass, async function (err, bcryptRes) {
        if (err) {
          console.log("Password comparison went wrong: ", err);
          delete req.session;
          res.redirect("/login");
        }
        if (bcryptRes) {
          console.log("Passwords match");
          const userId = await db.getIdByEmail(login);
          req.session.user = { id: userId };
          res.redirect("/main_page"); // main chat view
        } else {
          console.log("Passwords do not match");
          delete req.session;
          res.redirect("/login");
        }
      });
    } catch (err) {
      console.log(err);
    }
  } else if (regEmail.test(login) === false) {
    try {
      async function loginFunction(login, password) {
        const foundUserHashedPass = await db.attemptLogin(
          login,
          false,
          password,
        );
        return foundUserHashedPass;
      }

      const hashedPass = await loginFunction(login, password);

      bcrypt.compare(password, hashedPass, async function (err, bcryptRes) {
        if (err) {
          console.log("Password comparison went wrong: ", err);
          delete req.session;
          res.redirect("/login");
        }
        if (bcryptRes) {
          console.log("Passwords match");
          const userId = await db.getIdByUsername(login);
          req.session.user = { id: userId };
          res.redirect("/main_page"); // main chat view
        } else {
          console.log("Passwords do not match");
          delete req.session;
          res.redirect("/login");
        }
      });
    } catch (err) {
      console.log(err);
    }
  }
});

server.listen(port, host, (req, res) => {
  console.log(`Server running at http://${host}:${port}`);
});

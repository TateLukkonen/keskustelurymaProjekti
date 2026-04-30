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

// Lets
//let loggedIn = false

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

app.get("/chat", isLoggedIn, (req, res) => {
  res.render("chat", { path: req.path });
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

    app.get("/home", (req, res) => {
      res.render("home", {
        user: {
          username: "DemoUser",
          displayName: "Demo Name",
          online: true,
          bio: "This is a test user",
        },
        servers: [{ name: "Test Server", members: 10, createdAt: new Date() }],
      });
    });

    // ... muiden app.get-reittien jatkoksi
    app.get("/chat", isLoggedIn, (req, res) => {
      res.render("chat", { path: req.path });
    });

    const channelMsg = await db.getChannelMessages();
    const servers = await db.getServers();
    const sessionUser = await db.getCurrentSessionUser(req.session.user.email)

    res.render("main_page", {
      channelMessages: channelMsg,
      servers: servers,
      sessionUser: sessionUser[0],
      path: req.path
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

// Socket.IO events

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("chat message", async (msg) => {
    const msgId = await db.setChannelMessages(msg);
    const msgInfo = await db.getChannelMessage(msgId.message_id);
    io.emit("chat message", msgInfo[0]);
  });

  socket.on("delete message", async (message_id) => {
    await db.deleteMessage(message_id);
    io.emit("delete message", message_id);
  });
})

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
      server_pfp: req.body.server_pfp,
      private: isPrivate,
      server_link: serverLink,
      invite_link: inviteLink,
    };

    await db.createServer(data);

    res.redirect("/main_page");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating server");
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

    const pfp_path = req.file ? `/uploads/${req.file.filename}` : '/uploads/default_icon.png';

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.registerAccount(
      full_name,
      username,
      display_name,
      email,
      hashedPassword,
      false,
      false,
      'offline',
      pfp_path,
      bio
    );

    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Registration failed");
  }
});

app.post("/login", async (req, res) => {
    if (req.body.email.length != 0 && req.body.password.length != 0) {
        const email = req.body.email
        const password = req.body.password

        async function login(email, password) {
            const foundUserHashedPass = await db.attemptLogin(email, password)
            return foundUserHashedPass
        }

        const hashedPass = await login(email, password)

        bcrypt.compare(password, hashedPass, function(err, bcryptRes) {
            if (err) {
                console.log('Password comparison went wrong: ', err);
                delete req.session
                res.redirect('/login')
            }
            if (bcryptRes) {
                console.log('Passwords match');
                req.session.user = { email: email } 
                res.redirect('/main_page') // main chat view
            }
            else {
                console.log('Passwords do not match');
                delete req.session
                res.redirect('/login')
            }
        })
    }
    else {
        console.log('email or password not filled in');
        res.redirect('/login')
    }
  }
);

server.listen(port, host, (req, res) => {
  console.log(`Server running at http://${host}:${port}`);
});

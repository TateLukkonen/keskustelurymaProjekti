// Imports
import express from "express";
import session from "express-session";
import mysql from "mysql2/promise";
import path from "node:path";
import bcrypt from "bcrypt";
import http from "node:http";
import { Server } from "socket.io";

import config from "./config.json" with { type: "json" };
import dbconfig from "./dbconfig.json" with { type: "json" };
import db from "./db.js";
import { fileURLToPath } from "node:url";

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

app.get("/create_server_settings", (req, res) => {
  res.render("create_server_settings", { path: req.path });
});

app.get("/register", (req, res) => {
  res.render("register");
});

//  EXAMPLE GET AND POST METHODS BELOW
app.get("/main_page", isLoggedIn, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPwd,
      database: dbName,
    });

    const channelMsg = await db.getChannelMessages();
    const servers = await db.getServers();

    res.render("main_page", {
      channelMessages: channelMsg,
      servers: servers,
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

  socket.on("create-server", async (data) => {
    console.log("new server created:", data);
    await db.createServer(data);
    io.emit("server-created", data);
  });
});

// OLD POST METHODS

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
})*/

app.post("/register", upload.single("pfp"), async (req, res) => {
  const { full_name, email, password, username, display_name, bio } = req.body;
  const pfp_path = req.file ? `/uploads/${req.file.filename}` : null;
});

app.post("/login", async (req, res) => {
  req.session.user = { user: "user" };
  res.redirect("/main_page"); // main chat view
  /*
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
                loggedIn = false
                res.redirect('/login')
            }
            if (bcryptRes) {
                console.log('Passwords match');
                loggedIn = true
                req.session.user = { email: email } 
                res.redirect('/users') // main chat view
            }
            else {
                console.log('Passwords do not match');
                loggedIn = false
                res.redirect('/login')
            }
        })
    }
    else {
        console.log('email or password not filled in');
        res.redirect('/login')
    */
});

server.listen(port, host, (req, res) => {
  console.log(`Server running at http://${host}:${port}`);
});

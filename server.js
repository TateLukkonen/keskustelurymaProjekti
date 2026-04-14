// Imports
import express from 'express'
import session from 'express-session'
import mysql from 'mysql2/promise'
import path from 'node:path'
import bcrypt from 'bcrypt'


import config from './config.json' with { type: 'json' }
import dbconfig from './dbconfig.json' with { type: 'json' }
import db from './db.js'
import { fileURLToPath } from 'node:url'

// Lets
let loggedIn = false

// Constants
const { host, port } = config

// Database information
const dbHost = dbconfig.host
const dbName= dbconfig.database
const dbUser = dbconfig.user
const dbPwd = dbconfig.password

const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Server configuration
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Static
app.use(express.urlencoded({extended: true}))
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.static('public'))
app.use('/styles', express.static('public/styles'));


// Functions
function isLoggedIn(req, res, next) {
    if (!loggedIn) {
        return res.redirect('/login')
    } else {
        next()
    }
}

// Paths
app.get('/', isLoggedIn, async (req, res) => {
    res.redirect('users')
})

app.get('/users', isLoggedIn, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPwd,
        database: dbName
        });
          
        const rows = await db.getUsers()
        
        res.render('users', { rows: rows, path: req.path })
    }
    catch (err) {
        console.error('Database error: ' + err);
        res.status(500).send('Internal Server Error');
    }
    if (connection) {
        try {
            await connection.end();
        } 
        catch (closeError) {
            console.error('Error closing connection:', closeError);
        }
    }
})

app.post('/login', async (req, res) => {
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
                res.redirect('/users')
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
    }
})

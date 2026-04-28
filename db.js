import mysql from "mysql2/promise"
import dbconfig from "./dbconfig.json" with { type: "json" }
const pool = mysql.createPool(dbconfig)

const getConnection = async () => {
  try {
    const connection = await pool.getConnection()
    return connection
  } catch (error) {
    console.error("Error getting MySQL connection:", error)
    throw error
  }
}

//  EXAMPLE FUNCTION BELOW
const getUsers = async () => {
  try {
    const connection = await getConnection()
    const sql = `
                    SELECT customer.name AS 'customer',
                    system_user.id AS 'id',
                    system_user.fullname AS 'full name',
                    system_user.email AS 'email',
                    CASE 
                        WHEN system_user.admin = 0 THEN 'false'
                        ELSE 'true'
                    END AS 'admin'
                    FROM customer
                    RIGHT JOIN system_user
                    ON customer.id = system_user.customer_id
                    `
    const [users] = await connection.execute(sql)
    connection.release()
    return users
  } catch (error) {
    console.error("Error getting users:", error)
    throw error
  }
}

const getChannelMessages = async () => {
  try {
    const connection = await getConnection()
    const sql = `
                    SELECT channel_messages.message_id,
                    users.display_name,
                    channel_messages.user_id,
                    channel_messages.message,
                    channel_messages.creation_date
                    FROM channel_messages
                    JOIN users
                    WHERE channel_messages.channel_id = 1                    
                    `
    const [users] = await connection.execute(sql)
    connection.release()
    return users
  } catch (error) {
    console.error("Error getting channel messages:", error)
    throw error
  }
}

const getChannelMessage = async (message_id) => {
  try {
    const connection = await getConnection()
    const sql = `
                    SELECT channel_messages.message_id,
                    users.display_name,
                    channel_messages.user_id,
                    channel_messages.message,
                    channel_messages.creation_date
                    FROM channel_messages
                    JOIN users
                    ON users.user_id = channel_messages.user_id
                    WHERE channel_messages.channel_id = 1 
                    AND channel_messages.message_id = ?                   
                    `
    const [users] = await connection.execute(sql, [message_id])
    connection.release()
    return users
  } catch (error) {
    console.error("Error getting channel messages:", error)
    throw error
  }
}

const setChannelMessages = async (message) => {
  try {
    const connection = await getConnection()
    const sql = `
                    INSERT INTO channel_messages (channel_id, user_id, message, creation_date) VALUES
                    (1, 1, ?, NOW())                    
                    `
    const [result] = await connection.execute(sql, [message])
    const newMessage = {
      message_id: result.insertId,
    }

    connection.release()
    return newMessage
  } catch (error) {
    console.error("Error getting channel messages:", error)
    throw error
  }
}

const deleteMessage = async (message_id) => {
  try {
    const connection = await getConnection()
    const sql = `
                DELETE FROM channel_messages
                WHERE message_id = ?                   
                `
    await connection.execute(sql, [message_id])
    connection.release()
  } catch (error) {
    console.error("Error getting channel messages:", error)
    throw error
  }
}

export async function createServer(data) {

  const connection = await getConnection();

  const sql = `
    INSERT INTO server (name, private, server_link, creation_date)
    VALUES (?, ?, ?, NOW())
  `;

  const [result] = await connection.execute(sql, [
    data.name,
    data.private,
    data.invite_link,
  ]);

  connection.release();
  return result;
  const connection = await mysql.createConnection(dbconfig)
  const [result] = await connection.execute(
    "INSERT INTO server (name, private, creation_date) VALUES (?, ?, NOW())",
    [data.name, data.private],
  )
  await connection.end()
  return result
}


export async function getServers() {
  const connection = await mysql.createConnection(dbconfig)
  const [rows] = await connection.execute("SELECT * FROM server")
  await connection.end()
  return rows
}

const registerAccount = async (full_name, username, display_name, email, password, admin, creation_date, blacklist, servers_created, servers_joined, status, avatar_url, bio) => {
    try {
        const connection = await getConnection()
        const sql = `
                    INSERT INTO users (full_name, username, display_name, email, password, admin, creation_date, blacklist, servers_created, servers_joined, status, avatar_url, bio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `
        await connection.execute(sql, [full_name, username, display_name, email, password, admin, creation_date, blacklist, servers_created, servers_joined, status, avatar_url, bio])
        connection.release()
    } catch (error) {
        console.error('Error registering account:', error)
        throw error
    }
}

export default {
  getUsers,
  getChannelMessages,
  getChannelMessage,
  setChannelMessages,
  deleteMessage,
  createServer,
  getServers,
  registerAccount
}
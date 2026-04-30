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
    INSERT INTO server (name, private, server_link, invite_link, creation_date)
    VALUES (?, ?, ?, ?, NOW())
  `;

  const [result] = await connection.execute(sql, [
    data.name,
    data.private,
    data.server_link,
    data.invite_link,
  ]);

  const serverId = result.insertId;

  await connection.execute(
    `INSERT INTO member_list (server_id, user_id, owner, moderator, join_date)
   VALUES (?, ?, 1, 1, NOW())`,
    [serverId, data.owner],
  );

  connection.release();
  return result;
}

export async function getServers() {
  const connection = await getConnection();

  const sql = `
    SELECT server.*,
           member_list.user_id AS owner_id
    FROM server
    LEFT JOIN member_list 
      ON member_list.server_id = server.server_id
     AND member_list.owner = 1
  `;

  const [rows] = await connection.execute(sql);
  connection.release();
  return rows;
}

const registerAccount = async (full_name, username, display_name, email, password, admin, blacklist, status, avatar_url, bio) => {
    try {
        const connection = await getConnection()
        const sql = `
                    INSERT INTO users (full_name, username, display_name, email, password, admin, blacklist, status, avatar_url, bio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `
        await connection.execute(sql, [full_name, username, display_name, email, password, admin, blacklist, status, avatar_url, bio])
        connection.release()
    } catch (error) {
        console.error('Error registering account:', error)
        throw error
    }
}

const attemptLogin = async (email, password) => {
    try {
        const connection = await getConnection()
        const sql = `
                    SELECT email AS 'email',
                    password AS 'password'
                    FROM users
                    WHERE email = ?                    
                    `
        const [bool] = await connection.execute(sql, [email])
        connection.release()

        if (bool[0] != undefined) {
            console.log('User found');
            return bool[0].password
        } else {
            console.log('No user found')
            return false
        }
    } catch (error) {
        console.log('Error attempting login:', error);
    }
}

const getCurrentSessionUser = async (email) => {
  try {
    const connection = await getConnection()
    const sql = `
                SELECT user_id,
                full_name,
                username,
                display_name,
                email,
                admin,
                creation_date,
                blacklist,
                status,
                avatar_url,
                bio
                FROM users
                WHERE email = ?                 
                `
    const [user] = await connection.execute(sql, [email])
    connection.release()
    return user
  } catch (error) {
    console.error("Error getting current session user:", error)
    throw error
  }
}

export default {
  getChannelMessages,
  getChannelMessage,
  setChannelMessages,
  deleteMessage,
  createServer,
  getServers,
  registerAccount,
  attemptLogin,
  getCurrentSessionUser
}
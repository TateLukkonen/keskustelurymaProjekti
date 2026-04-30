import mysql from "mysql2/promise";
import dbconfig from "./dbconfig.json" with { type: "json" };

const pool = mysql.createPool(dbconfig);

const getConnection = async () => {
  try {
    return await pool.getConnection();
  } catch (error) {
    console.error("Error getting MySQL connection:", error);
    throw error;
  }
};

const getUsers = async () => {
  try {
    const connection = await getConnection();
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
    `;
    const [users] = await connection.execute(sql);
    connection.release();
    return users;
  } catch (error) {
    console.error("Error getting users:", error);
    throw error;
  }
};

const registerAccount = async (
  full_name,
  username,
  display_name,
  email,
  password,
  admin,
  blacklist,
  status,
  avatar_url,
  bio,
) => {
  try {
    const connection = await getConnection();
    const sql = `
      INSERT INTO users 
      (full_name, username, display_name, email, password, admin, blacklist, status, avatar_url, bio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await connection.execute(sql, [
      full_name,
      username,
      display_name,
      email,
      password,
      admin,
      blacklist,
      status,
      avatar_url,
      bio,
    ]);
    connection.release();
  } catch (error) {
    console.error("Error registering account:", error);
    throw error;
  }
};

const attemptLogin = async (email) => {
  try {
    const connection = await getConnection();
    const sql = `
      SELECT email, password
      FROM users
      WHERE email = ?
    `;
    const [rows] = await connection.execute(sql, [email]);
    connection.release();

    if (rows[0]) {
      return rows[0].password;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error attempting login:", error);
    throw error;
  }
};

const getCurrentSessionUser = async (email) => {
  try {
    const connection = await getConnection();
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
    `;
    const [user] = await connection.execute(sql, [email]);
    connection.release();
    return user;
  } catch (error) {
    console.error("Error getting current session user:", error);
    throw error;
  }
};

const getChannelMessages = async () => {
  try {
    const connection = await getConnection();
    const sql = `
      SELECT channel_messages.message_id,
      users.display_name,
      channel_messages.user_id,
      channel_messages.message,
      channel_messages.creation_date
      FROM channel_messages
      JOIN users
      WHERE channel_messages.channel_id = 1
    `;
    const [rows] = await connection.execute(sql);
    connection.release();
    return rows;
  } catch (error) {
    console.error("Error getting channel messages:", error);
    throw error;
  }
};

const getChannelMessage = async (message_id) => {
  try {
    const connection = await getConnection();
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
    `;
    const [rows] = await connection.execute(sql, [message_id]);
    connection.release();
    return rows;
  } catch (error) {
    console.error("Error getting channel messages:", error);
    throw error;
  }
};

const setChannelMessages = async (message) => {
  try {
    const connection = await getConnection();
    const sql = `
      INSERT INTO channel_messages (channel_id, user_id, message, creation_date)
      VALUES (1, 1, ?, NOW())
    `;
    const [result] = await connection.execute(sql, [message]);
    connection.release();
    return { message_id: result.insertId };
  } catch (error) {
    console.error("Error setting channel messages:", error);
    throw error;
  }
};

const deleteMessage = async (message_id) => {
  try {
    const connection = await getConnection();
    const sql = `
      DELETE FROM channel_messages
      WHERE message_id = ?
    `;
    await connection.execute(sql, [message_id]);
    connection.release();
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
};

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

  connection.release();
  return result;
}

export async function getServers() {
  const connection = await mysql.createConnection(dbconfig);
  const [rows] = await connection.execute("SELECT * FROM server");
  await connection.end();
  return rows;
}

export default {
  getUsers,
  registerAccount,
  attemptLogin,
  getCurrentSessionUser,
  getChannelMessages,
  getChannelMessage,
  setChannelMessages,
  deleteMessage,
  createServer,
  getServers,
};

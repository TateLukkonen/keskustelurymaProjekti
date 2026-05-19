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

const getChannelMessages = async (channel_id) => {
  try {
    const connection = await getConnection();

    const sql = `
      SELECT 
        channel_messages.message_id,
        users.display_name,
        channel_messages.user_id,
        channel_messages.message,
        channel_messages.creation_date
      FROM channel_messages
      JOIN users 
        ON users.user_id = channel_messages.user_id
      WHERE channel_messages.channel_id = ?
    `;

    const [rows] = await connection.execute(sql, [channel_id]);
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
      SELECT 
        channel_messages.message_id,
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
    INSERT INTO server (name, short_name, private, server_link, invite_link, server_picture_url, creation_date)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;

  const [result] = await connection.execute(sql, [
    data.name,
    data.short_name,
    data.private,
    data.server_link,
    data.invite_link,
    data.server_picture_url,
  ]);

  const serverId = result.insertId;

  await connection.execute(
    `
    INSERT INTO member_list (server_id, user_id, owner, moderator, join_date)
    VALUES (?, ?, 1, 1, NOW())
    `,
    [serverId, data.owner],
  );

  connection.release();

  return result;
}

export async function getServers() {
  const connection = await getConnection();

  const sql = `
    SELECT 
      server.server_id,
      server.name,
      server.short_name,
      server.private,
      server.invite_link,
      server.server_link,
      server.creation_date,
      server.server_picture_url,
      users.user_id AS owner_id,
      users.username AS owner_username,
      (
        SELECT COUNT(*) 
        FROM member_list
        WHERE member_list.server_id = server.server_id
      ) AS member_count
    FROM server
    JOIN member_list 
      ON member_list.server_id = server.server_id
    JOIN users
      ON users.user_id = member_list.user_id
    WHERE member_list.owner = 1
  `;

  const [rows] = await connection.execute(sql);
  connection.release();

  return rows;
}

const getJoinedServers = async (user_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT 
      member_list.server_id, 
      member_list.user_id,
      server.server_id,
      server.name,
      server.short_name,
      server.private,
      server.invite_link,
      server.server_link,
      server.creation_date,
      server.server_picture_url
    FROM member_list
    JOIN server 
      ON server.server_id = member_list.server_id
    JOIN users 
      ON users.user_id = member_list.user_id
    WHERE users.user_id = ?
  `;

  const [rows] = await connection.execute(sql, [user_id]);
  connection.release();

  return rows;
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

const attemptLogin = async (username, email, password) => {
  if (username == false) {
    try {
      const connection = await getConnection();

      const sql = `
        SELECT 
          email AS email,
          password AS password
        FROM users
        WHERE email = ?
      `;

      const [rows] = await connection.execute(sql, [email]);
      connection.release();

      if (rows[0] !== undefined) {
        console.log("User found");
        return rows[0].password;
      }

      console.log("No user found");
      return false;
    } catch (error) {
      console.log("Error attempting login:", error);
    }
  } else if (email == false) {
    try {
      const connection = await getConnection();

      const sql = `
        SELECT 
          username,
          password
        FROM users
        WHERE username = ?
      `;

      const [rows] = await connection.execute(sql, [username]);
      connection.release();

      if (rows[0] !== undefined) {
        console.log("User found");
        return rows[0].password;
      }

      console.log("No user found");
      return false;
    } catch (error) {
      console.log("Error attempting login:", error);
    }
  }
};

const getCurrentSessionUser = async (user_id) => {
  try {
    const connection = await getConnection();

    const sql = `
      SELECT 
        user_id,
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
      WHERE user_id = ?
    `;

    const [user] = await connection.execute(sql, [user_id]);
    connection.release();

    return user;
  } catch (error) {
    console.error("Error getting current session user:", error);
    throw error;
  }
};

const getIdByEmail = async (email) => {
  try {
    const connection = await getConnection();

    const sql = `
      SELECT user_id
      FROM users
      WHERE email = ?
    `;

    const [rows] = await connection.execute(sql, [email]);
    connection.release();

    return rows[0]?.user_id;
  } catch (error) {
    console.error("Error getting user ID by email:", error);
    throw error;
  }
};

const getIdByUsername = async (username) => {
  try {
    const connection = await getConnection();

    const sql = `
      SELECT user_id
      FROM users
      WHERE username = ?
    `;

    const [rows] = await connection.execute(sql, [username]);
    connection.release();

    return rows[0]?.user_id;
  } catch (error) {
    console.error("Error getting user ID by username:", error);
    throw error;
  }
};

const joinServer = async (server_id, user_id) => {
  const connection = await getConnection();

  const sql = `
    INSERT INTO member_list (server_id, user_id, owner, moderator, join_date)
    VALUES (?, ?, 0, 0, NOW())
  `;

  await connection.execute(sql, [server_id, user_id]);
  connection.release();
};

const isMember = async (server_id, user_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT 1 
    FROM member_list
    WHERE server_id = ? 
    AND user_id = ?
    LIMIT 1
  `;

  const [rows] = await connection.execute(sql, [server_id, user_id]);
  connection.release();

  return rows.length > 0;
};

const isServerModerator = async (server_id, user_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT moderator
    FROM member_list
    WHERE server_id = ? 
    AND user_id = ?
    LIMIT 1
  `;

  const [rows] = await connection.execute(sql, [server_id, user_id]);
  connection.release();

  if (rows.length === 0) {
    return false;
  }

  return rows[0].moderator === 1;
};

const isServerOwner = async (server_id, user_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT owner
    FROM member_list
    WHERE server_id = ?
    AND user_id = ?
    LIMIT 1
  `;

  const [rows] = await connection.execute(sql, [server_id, user_id]);
  connection.release();

  if (rows.length === 0) {
    return false;
  }

  return rows[0].owner === 1;
};

const promoteMemberToModerator = async (server_id, user_id) => {
  const connection = await getConnection();

  const sql = `
    UPDATE member_list
    SET moderator = 1
    WHERE server_id = ?
    AND user_id = ?
    AND owner = 0
  `;

  await connection.execute(sql, [server_id, user_id]);
  connection.release();
};

const getServerById = async (server_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT 
      server.server_id,
      server.name,
      server.short_name,
      server.private,
      server.invite_link,
      server.server_link
    FROM server
    WHERE server.server_id = ?
    LIMIT 1
  `;

  const [rows] = await connection.execute(sql, [server_id]);
  connection.release();

  return rows[0];
};

const updateDisplayName = async (new_name, user_id) => {
  const connection = await getConnection();

  const sql = `
    UPDATE users 
    SET display_name = ? 
    WHERE user_id = ?
  `;

  await connection.execute(sql, [new_name, user_id]);
  connection.release();
};

const getMemberList = async (server_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT 
      member_list.server_id, 
      member_list.user_id,
      users.display_name,
      users.avatar_url,
      users.status,
      users.bio
    FROM member_list
    JOIN server 
      ON server.server_id = member_list.server_id
    JOIN users 
      ON users.user_id = member_list.user_id
    WHERE server.server_id = ?
  `;

  const [rows] = await connection.execute(sql, [server_id]);
  connection.release();

  return rows;
};

const countMembers = async (server_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT COUNT(*) 
    FROM member_list
    JOIN server 
      ON server.server_id = member_list.server_id
    WHERE server.server_id = ?
  `;

  const count = await connection.execute(sql, [server_id]);
  connection.release();

  return count;
};

const votePost = async (post_id, user_id, vote) => {
  const connection = await getConnection();

  const sql = `
    INSERT INTO post_votes (post_id, user_id, vote)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE vote = VALUES(vote)
  `;

  await connection.execute(sql, [post_id, user_id, vote]);
  connection.release();
};

const getPosts = async (server_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT 
      posts.post_id,
      posts.title,
      posts.text_content,
      users.display_name,
      users.avatar_url,
      posts.img,
      posts.creation_date,
      posts.upvotes,
      posts.downvotes
    FROM posts
    JOIN users
      ON users.user_id = posts.user_id
    WHERE posts.server_id = ?
  `;

  const [rows] = await connection.execute(sql, [server_id]);
  connection.release();

  return rows;
};

const getPost = async (post_id) => {
  const connection = await getConnection();

  const sql = `
    SELECT 
      p.post_id,
      p.server_id,
      p.user_id,
      p.title,
      p.img,
      p.text_content,
      p.creation_date,
      u.username,
      u.display_name,
      u.avatar_url,
      SUM(pv.vote = 'upvote')   AS upvotes,
      SUM(pv.vote = 'downvote') AS downvotes
    FROM posts p
    JOIN users u 
      ON u.user_id = p.user_id
    LEFT JOIN post_votes pv 
      ON pv.post_id = p.post_id
    WHERE p.post_id = ?
    GROUP BY p.post_id
    ORDER BY p.creation_date DESC
  `;

  const [rows] = await connection.execute(sql, [post_id]);
  connection.release();

  return rows;
};

const getMember = async (user_id) => {
  const connection = await getConnection()

  const sql = `
      SELECT *
      FROM users
      WHERE user_id = ?
      `
  const [info] = await connection.execute(sql, [user_id])
  connection.release()

  return info[0]
}

export default {
  getChannelMessages,
  getChannelMessage,
  setChannelMessages,
  deleteMessage,
  createServer,
  getServers,
  attemptLogin,
  getCurrentSessionUser,
  getIdByEmail,
  getIdByUsername,
  registerAccount,
  joinServer,
  isMember,
  getServerById,
  getJoinedServers,
  updateDisplayName,
  getMemberList,
  countMembers,
  votePost,
  getPosts,
  isServerModerator,
  isServerOwner,
  promoteMemberToModerator,
  getPost,
  getMember
};

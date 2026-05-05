DROP DATABASE IF EXISTS chatting_platform;
CREATE DATABASE chatting_platform;
USE chatting_platform;

DROP TABLE IF EXISTS server;
CREATE TABLE server (
   server_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
   name VARCHAR(100) NOT NULL,
   short_name VARCHAR(7) NOT NULL,
   creation_date DATETIME NOT NULL,
   server_link VARCHAR(100) UNIQUE NOT NULL,
   invite_link VARCHAR(100) UNIQUE NULL,
   private BOOLEAN NOT NULL,
   server_picture_url VARCHAR(255) NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS users;
CREATE TABLE users (
	user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	full_name VARCHAR(100) NOT NULL,
	username VARCHAR(100) UNIQUE NOT NULL,
	display_name VARCHAR(100) NOT NULL,
	email VARCHAR(255) UNIQUE NOT NULL,
	password VARCHAR(255) NOT NULL,
	admin BOOLEAN NOT NULL,
	creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	blacklist BOOLEAN NOT NULL,
	status ENUM('online', 'offline', 'incognito') NOT NULL,
	avatar_url VARCHAR(255) NOT NULL,
	bio TEXT NOT NULL,
	reputation INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

DROP TABLE IF EXISTS ban_list;
CREATE TABLE ban_list (
    ban_list_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	server_id INT NOT NULL,
	user_id INT NOT NULL,
	ban_expiry DATETIME NULL,
	
	FOREIGN KEY (server_id)
	REFERENCES server (server_id)
    ON DELETE CASCADE,
	
	FOREIGN KEY (user_id)
	REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS member_list;
CREATE TABLE member_list (
    member_list_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	server_id INT NOT NULL,
	user_id INT NOT NULL,
	owner BOOLEAN NOT NULL,
	moderator BOOLEAN NOT NULL,
	join_date DATETIME NOT NULL,
	
	FOREIGN KEY (server_id)
	REFERENCES server (server_id)
    ON DELETE CASCADE,
	
	FOREIGN KEY (user_id)
	REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS channel;
CREATE TABLE channel (
	channel_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	server_id INT NOT NULL,
	name VARCHAR(50) NOT NULL,
	visibility ENUM('public', 'read_only', 'private') NOT NULL,
	creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (server_id)
	REFERENCES server (server_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS channel_messages;
CREATE TABLE channel_messages (
	message_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	channel_id INT NOT NULL,
	user_id INT NULL,
	message MEDIUMTEXT NOT NULL,
	creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (channel_id)
	REFERENCES channel (channel_id)
    ON DELETE CASCADE,
	
	FOREIGN KEY (user_id)
	REFERENCES users (user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
	post_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	server_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    img VARCHAR(255) NULL,
    text_content TEXT NULL,
    creation_date DATETIME NOT NULL,
	upvotes INT NOT NULL DEFAULT 0,
	downvotes INT NOT NULL DEFAULT 0,
	
	FOREIGN KEY (server_id)
	REFERENCES server (server_id)
    ON DELETE CASCADE,
	
	FOREIGN KEY (user_id)
	REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS post_comments;
CREATE TABLE post_comments(
    comment_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    text_content TEXT NOT NULL,
    creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (post_id)
	REFERENCES posts (post_id)
    ON DELETE CASCADE,
	
	FOREIGN KEY (user_id)
	REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;



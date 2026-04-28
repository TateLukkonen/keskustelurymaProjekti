DROP DATABASE IF EXISTS chatting_platform;
CREATE DATABASE chatting_platform;
USE chatting_platform;

DROP TABLE IF EXISTS server;
CREATE TABLE server (
   server_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
   name VARCHAR(100) NOT NULL,
   creation_date DATETIME NOT NULL,
   server_link VARCHAR(100) UNIQUE NOT NULL,
   private BOOLEAN NOT NULL,
   server_picture_url VARCHAR(255) NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS invite_links;
CREATE TABLE invite_links (
   invite_links_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
   server_id INT NOT NULL,
   invite_link VARCHAR(255) NULL,

   UNIQUE (invite_link),

   FOREIGN KEY (server_id)
   REFERENCES server (server_id)
   ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS users;
CREATE TABLE users (
	user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	full_name VARCHAR(100) NOT NULL,
	username VARCHAR(100) UNIQUE NOT NULL,
	display_name VARCHAR(100) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password VARCHAR(255) NOT NULL,
	admin BOOLEAN NOT NULL,
	creation_date DATETIME NOT NULL,
	blacklist BOOLEAN NOT NULL,
	status ENUM('online', 'offline', 'away', 'busy') NOT NULL,
	avatar_url VARCHAR(255) NOT NULL,
	bio TEXT NOT NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS user_relationship;
CREATE TABLE user_relationship (
    relationship_id INT AUTO_INCREMENT PRIMARY KEY,
    user_1 INT NOT NULL,
    user_2 INT NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') NOT NULL,
    requester_id INT NOT NULL,
    friends_since DATETIME NULL,

    UNIQUE (user_1, user_2),

    FOREIGN KEY (user_1)
        REFERENCES users (user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_2)
        REFERENCES users (user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (requester_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS  dms;
CREATE TABLE dms (
	dm_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	user_1 INT NOT NULL,
	user_2 INT NOT NULL,
	creation_date DATETIME NOT NULL,

    UNIQUE (user_1, user_2),
	
	FOREIGN KEY (user_1)
	REFERENCES users (user_id)
    ON DELETE CASCADE,
	
	FOREIGN KEY (user_2)
	REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS dm_messages;
CREATE TABLE dm_messages (
	message_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	dm_id INT NOT NULL,
	user_id INT NULL,
	message MEDIUMTEXT NOT NULL,
	creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (dm_id)
	REFERENCES dms (dm_id)
    ON DELETE CASCADE,
	
	FOREIGN KEY (user_id)
	REFERENCES users (user_id)
    ON DELETE SET NULL
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


DROP DATABASE IF EXISTS chatting_platform;
CREATE DATABASE chatting_platform;
USE chatting_platform;

DROP TABLE IF EXISTS server;
CREATE TABLE server (
   server_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
   name VARCHAR(100) NOT NULL,
   creation_date DATETIME NOT NULL,
   invite_link VARCHAR(100) UNIQUE NOT NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS user;
CREATE TABLE user (
	user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	full_name VARCHAR(100) NOT NULL,
	username VARCHAR(100) UNIQUE NOT NULL,
	display_name VARCHAR(100) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password VARCHAR(255) NOT NULL,
	admin TINYINT NOT NULL,
	creation_date DATETIME NOT NULL,
	blacklist TINYINT NOT NULL,
	servers_created TINYINT NOT NULL,
	servers_joined TINYINT NOT NULL,
	status TINYTEXT NOT NULL,
	avatar_url TEXT NOT NULL,
	bio TEXT NOT NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS friend_list;
CREATE TABLE friend_list (
	friend_list_id INT NOT NULL PRIMARY KEY,
	user_id INT NOT NULL,
	pending TINYINT NOT NULL,
	friends_since DATETIME NULL,
	
	FOREIGN KEY (friend_list_id)
	REFERENCES user (user_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS block_list;
CREATE TABLE block_list (
	block_list_id INT NOT NULL PRIMARY KEY,
	user_id INT NOT NULL,
	
	FOREIGN KEY (block_list_id)
	REFERENCES user (user_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS  dms;
CREATE TABLE dms (
	dm_id INT UNIQUE NOT NULL PRIMARY KEY,
	user_1 INT NOT NULL,
	user_2 INT NOT NULL,
	creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (user_1)
	REFERENCES user (user_id),
	
	FOREIGN KEY (user_2)
	REFERENCES user (user_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS dm_messages;
CREATE TABLE dm_messages (
	message_id INT UNIQUE NOT NULL PRIMARY KEY,
	dm_id INT NOT NULL,
	user_id INT NOT NULL,
	message MEDIUMTEXT NOT NULL,
	creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (dm_id)
	REFERENCES dms (dm_id),
	
	FOREIGN KEY (user_id)
	REFERENCES USER (user_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS ban_list;
CREATE TABLE ban_list (
	server_id INT NOT NULL,
	user_id INT NOT NULL,
	ban_duration DATETIME NULL,
	
	FOREIGN KEY (server_id)
	REFERENCES server (server_id),
	
	FOREIGN KEY (user_id)
	REFERENCES user (user_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS member_list;
CREATE TABLE member_list (
	server_id INT NOT NULL,
	user_id INT NOT NULL,
	owner TINYINT NOT NULL,
	moderator TINYINT NOT NULL,
	join_date DATETIME NOT NULL,
	
	FOREIGN KEY (server_id)
	REFERENCES server (server_id),
	
	FOREIGN KEY (user_id)
	REFERENCES user (user_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS channel;
CREATE TABLE channel (
	channel_id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
	server_id INT NOT NULL,
	name VARCHAR(50) NOT NULL,
	private TINYINT NOT NULL,
	creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (server_id)
	REFERENCES server (server_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS channel_messages;
CREATE TABLE channel_messages (
	message_id INT UNIQUE NOT NULL PRIMARY KEY,
	channel_id INT NOT NULL,
	user_id INT NOT NULL,
	message MEDIUMTEXT NOT NULL,
	creation_date DATETIME NOT NULL,
	
	FOREIGN KEY (channel_id)
	REFERENCES channel (channel_id),
	
	FOREIGN KEY (user_id)
	REFERENCES USER (user_id)
) ENGINE=InnoDB;


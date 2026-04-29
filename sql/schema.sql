-- Qira'ah - Database Schema
-- Plateforme de correction de récitation du Coran

CREATE DATABASE IF NOT EXISTS qiraah
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE qiraah;

-- Utilisateurs (apprenants et relecteurs)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  role ENUM('learner', 'reviewer') NOT NULL DEFAULT 'learner',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Récitations audio
CREATE TABLE IF NOT EXISTS recitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  duration FLOAT NOT NULL DEFAULT 0,
  status ENUM('draft', 'submitted', 'reviewed') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pins (repères temporels)
CREATE TABLE IF NOT EXISTS pins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recitation_id INT NOT NULL,
  time_position FLOAT NOT NULL,
  label VARCHAR(100) DEFAULT NULL,
  is_auto TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recitation_id) REFERENCES recitations(id) ON DELETE CASCADE,
  INDEX idx_pins_recitation (recitation_id),
  INDEX idx_pins_time (recitation_id, time_position)
) ENGINE=InnoDB;

-- Segments (calculés à partir des pins)
CREATE TABLE IF NOT EXISTS segments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recitation_id INT NOT NULL,
  segment_index INT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  FOREIGN KEY (recitation_id) REFERENCES recitations(id) ON DELETE CASCADE,
  INDEX idx_segments_recitation (recitation_id)
) ENGINE=InnoDB;

-- Corrections (une par relecteur par récitation)
CREATE TABLE IF NOT EXISTS corrections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recitation_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  verdict ENUM('ok', 'to_correct', 'redo') DEFAULT NULL,
  global_comment TEXT DEFAULT NULL,
  checklist_madd TINYINT(1) NOT NULL DEFAULT 0,
  checklist_emphase TINYINT(1) NOT NULL DEFAULT 0,
  checklist_makhraj TINYINT(1) NOT NULL DEFAULT 0,
  checklist_ghunnah TINYINT(1) NOT NULL DEFAULT 0,
  checklist_waqf TINYINT(1) NOT NULL DEFAULT 0,
  checklist_fluidite TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recitation_id) REFERENCES recitations(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_corrections_recitation (recitation_id)
) ENGINE=InnoDB;

-- Points de correction horodatés
CREATE TABLE IF NOT EXISTS correction_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  correction_id INT NOT NULL,
  time_position FLOAT NOT NULL,
  category ENUM('madd', 'emphase', 'makhraj', 'ghunnah', 'waqf', 'fluidite') NOT NULL,
  comment TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (correction_id) REFERENCES corrections(id) ON DELETE CASCADE,
  INDEX idx_correction_points_correction (correction_id)
) ENGINE=InnoDB;

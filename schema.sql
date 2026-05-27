-- Create Database
CREATE DATABASE IF NOT EXISTS wellnest_db;
USE wellnest_db;

-- Create Health Logs Table
CREATE TABLE IF NOT EXISTS health_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_type VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL,
    heart_rate INT,
    date DATE NOT NULL,
    notes TEXT
);

-- Insert Seed Data
INSERT INTO health_logs (activity_type, duration_minutes, heart_rate, date, notes) VALUES
('Gym', 60, 145, '2026-05-15', 'Full body workout, felt strong.'),
('Running', 30, 160, '2026-05-16', 'Morning run at the park.'),
('Hiking', 120, 110, '2026-05-17', 'Trail hike, moderate incline.');

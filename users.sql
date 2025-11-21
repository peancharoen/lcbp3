-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: mariadb
-- Generation Time: Nov 21, 2025 at 03:33 AM
-- Server version: 11.8.5-MariaDB-ubu2404
-- PHP Version: 8.3.27
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */
;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */
;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */
;
/*!40101 SET NAMES utf8mb4 */
;
--
-- Database: `lcbp3_dev`
--

-- --------------------------------------------------------
--
-- Table structure for table `users`
--

CREATE TABLE `users` (
    `user_id` int(11) NOT NULL COMMENT 'ID ของตาราง',
    `username` varchar(50) NOT NULL COMMENT 'ชื่อผู้ใช้งาน',
    `password_hash` varchar(255) NOT NULL COMMENT 'รหัสผ่าน (Hashed)',
    `first_name` varchar(50) DEFAULT NULL COMMENT 'ชื่อจริง',
    `last_name` varchar(50) DEFAULT NULL COMMENT 'นามสกุล',
    `email` varchar(100) NOT NULL COMMENT 'อีเมล',
    `line_id` varchar(100) DEFAULT NULL COMMENT 'LINE ID',
    `primary_organization_id` int(11) DEFAULT NULL COMMENT 'สังกัดองค์กร',
    `is_active` tinyint(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
    `failed_attempts` int(11) DEFAULT 0 COMMENT 'จำนวนครั้งที่ล็อกอินล้มเหลว',
    `locked_until` datetime DEFAULT NULL COMMENT 'ล็อกอินไม่ได้จนถึงเวลา',
    `last_login_at` timestamp NULL DEFAULT NULL COMMENT 'วันที่และเวลาที่ล็อกอินล่าสุด',
    `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT 'วันที่สร้าง',
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'วันที่แก้ไขล่าสุด',
    `deleted_at` datetime DEFAULT NULL COMMENT 'วันที่ลบ'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลผู้ใช้งาน (User)';
--
-- Dumping data for table `users`
--

INSERT INTO `users` (
        `user_id`,
        `username`,
        `password_hash`,
        `first_name`,
        `last_name`,
        `email`,
        `line_id`,
        `primary_organization_id`,
        `is_active`,
        `failed_attempts`,
        `locked_until`,
        `last_login_at`,
        `created_at`,
        `updated_at`,
        `deleted_at`
    )
VALUES (
        1,
        'superadmin',
        '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
        'Super',
        'Admin',
        'superadmin @example.com',
        NULL,
        NULL,
        1,
        0,
        NULL,
        NULL,
        '2025-11-19 08:47:47',
        '2025-11-21 03:02:20',
        NULL
    ),
    (
        2,
        'editor01',
        '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
        'DC',
        'C1',
        'editor01 @example.com',
        NULL,
        41,
        1,
        0,
        NULL,
        NULL,
        '2025-11-19 08:47:47',
        '2025-11-20 02:57:04',
        NULL
    ),
    (
        3,
        'viewer01',
        '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
        'Viewer',
        'สคฉ.03',
        'viewer01 @example.com',
        NULL,
        10,
        1,
        0,
        NULL,
        NULL,
        '2025-11-19 08:47:47',
        '2025-11-20 02:55:50',
        NULL
    ),
    (
        5,
        'admin',
        '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
        'Admin',
        'คคง.',
        'admin@example.com',
        NULL,
        1,
        1,
        0,
        NULL,
        NULL,
        '2025-11-19 08:57:20',
        '2025-11-21 02:56:02',
        NULL
    );
--
-- Indexes for dumped tables
--

--
-- Indexes for table `users`
--
ALTER TABLE `users`
ADD PRIMARY KEY (`user_id`),
    ADD UNIQUE KEY `username` (`username`),
    ADD UNIQUE KEY `email` (`email`),
    ADD KEY `primary_organization_id` (`primary_organization_id`);
--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID ของตาราง',
    AUTO_INCREMENT = 6;
--
-- Constraints for dumped tables
--

--
-- Constraints for table `users`
--
ALTER TABLE `users`
ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`primary_organization_id`) REFERENCES `organizations` (`id`) ON DELETE
SET NULL;
COMMIT;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */
;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */
;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */
;
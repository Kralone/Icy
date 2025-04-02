-- V4__add_pwd_reset_flag.sql

ALTER TABLE users
    ADD COLUMN pwd_reset BOOLEAN NOT NULL DEFAULT FALSE;

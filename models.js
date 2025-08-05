const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ADMIN_EMAIL, JWT_SECRET } = require('./config');

let db;

// Initialize and return the database connection
function initDb() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database('./database.sqlite', (err) => {
      if (err) return reject(err);

      // Create tables if they don't exist
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          isAdmin INTEGER DEFAULT 0,
          isBanned INTEGER DEFAULT 0
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          categoryId INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          imageUrl TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id),
          FOREIGN KEY(categoryId) REFERENCES categories(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS replies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          postId INTEGER NOT NULL,
          userId INTEGER NOT NULL,
          content TEXT NOT NULL,
          imageUrl TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(postId) REFERENCES posts(id),
          FOREIGN KEY(userId) REFERENCES users(id)
        )`, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });
    });
  });
}

// Create a new user with hashed password
async function createUser(email, password, isAdmin = false) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (email, password, isAdmin) VALUES (?, ?, ?)`,
      [email, hashedPassword, isAdmin ? 1 : 0],
      function (err) {
        if (err) return reject(err);
        // Return the new user object
        resolve({ id: this.lastID, email, isAdmin });
      }
    );
  });
}

// Find user by email
function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Verify password hash
function verifyPassword(plain, hash) {
  return bcry

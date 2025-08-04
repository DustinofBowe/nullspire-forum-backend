const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { JWT_SECRET } = require('./config');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'forum.db');
let db;

function initDb() {
  return new Promise((resolve, reject) => {
    const exists = fs.existsSync(DB_FILE);
    db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) return reject(err);

      if (!exists) {
        db.serialize(() => {
          db.run(`
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE,
              password TEXT,
              isAdmin INTEGER DEFAULT 0,
              isBanned INTEGER DEFAULT 0
            )
          `);

          db.run(`
            CREATE TABLE categories (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT UNIQUE
            )
          `);

          db.run(`
            CREATE TABLE posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              userId INTEGER,
              categoryId INTEGER,
              title TEXT,
              content TEXT,
              imageUrl TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(userId) REFERENCES users(id),
              FOREIGN KEY(categoryId) REFERENCES categories(id)
            )
          `);

          db.run(`
            CREATE TABLE replies (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              postId INTEGER,
              userId INTEGER,
              content TEXT,
              imageUrl TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(postId) REFERENCES posts(id),
              FOREIGN KEY(userId) REFERENCES users(id)
            )
          `);

          // Insert default categories
          const defaultCategories = [
            'Lore & Worldbuilding',
            'Character Builds',
            'Character Tutorials',
            'Bug Reports & Fixes',
            'Suggestions & Feedback',
            'Announcements & News',
            'Fan Art & Screenshots',
            'Meta & Strategy',
            'Off-Topic Lounge'
          ];

          const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
          defaultCategories.forEach(cat => stmt.run(cat));
          stmt.finalize();

          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Helper functions for user auth

function createUser(email, password, isAdmin = false) {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, 10).then(hashed => {
      db.run(
        `INSERT INTO users (email, password, isAdmin) VALUES (?, ?, ?)`,
        [email, hashed, isAdmin ? 1 : 0],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, email, isAdmin });
        }
      );
    });
  });
}

function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: !!user.isAdmin, isBanned: !!user.isBanned },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function banUser(userId) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET isBanned = 1 WHERE id = ?`, [userId], function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = {
  initDb,
  db,
  createUser,
  findUserByEmail,
  verifyPassword,
  generateToken,
  verifyToken,
  banUser
};

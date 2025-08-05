const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initDb, User, Category, Post, Reply, banUser } = require('./models');
const { authMiddleware, adminMiddleware } = require('./middleware');
const createRoutes = require('./routes'); // <-- important: import as function

const app = express();
const PORT = process.env.PORT || 5000;

// Allow frontend access
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nullspire-forum-frontend.vercel.app';
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password']
}));

app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only image files a

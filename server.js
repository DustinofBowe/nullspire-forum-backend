const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initDb, User, Category, Post, Reply, banUser } = require('./models');
const { authMiddleware, adminMiddleware } = require('./middleware');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'https://nullspire-forum-frontend-d78vb0ftg-dustinofbowes-projects.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password']
}));

// Static folder for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only images allowed (jpeg, jpg, png, gif).'));
  }
});

app.post('/upload-image', authMiddleware, upload.single('image'), (req, res) => {
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// Use routes for auth, posts, replies, categories, admin
app.use('/api', routes);

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`NullSpire Forum backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize DB:', err);
  });

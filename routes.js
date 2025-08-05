const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  const {
    createUser,
    findUserByEmail,
    verifyPassword,
    generateToken,
    banUser
  } = require('./models');

  const { authMiddleware, adminMiddleware } = require('./middleware');

  router.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    try {
      const existing = await findUserByEmail(email);
      if (existing) return res.status(400).json({ error: 'Email already in use' });

      const isAdmin = email.toLowerCase() === require('./config').ADMIN_EMAIL.toLowerCase();

      const user = await createUser(email, password, isAdmin);
      const token = generateToken(user);
      res.json({ token, isAdmin: user.isAdmin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Signup failed' });
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    try {
      const user = await findUserByEmail(email);
      if (!user) return res.status(400).json({ error: 'Invalid email or password' });
      if (user.isBanned) return res.status(403).json({ error: 'User is banned' });

      const valid = await verifyPassword(password, user.password);
      if (!valid) return res.status(400).json({ error: 'Invalid email or password' });

      const token = generateToken(user);
      res.json({ token, isAdmin: user.isAdmin });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  router.get('/categories', (req, res) => {
    db.all('SELECT * FROM categories ORDER BY id', [], (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to get categories' });
      }
      res.json(rows);
    });
  });

  router.get('/categories/:categoryId/posts', (req, res) => {
    const categoryId = req.params.categoryId;
    db.all(
      `SELECT posts.*, users.email as authorEmail FROM posts 
       JOIN users ON posts.userId = users.id
       WHERE categoryId = ?
       ORDER BY createdAt DESC`,
      [categoryId],
      (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to get posts' });
        }
        res.json(rows);
      }
    );
  });

  router.get('/posts/:postId', (req, res) => {
    const postId = req.params.postId;

    db.get(
      `SELECT posts.*, users.email as authorEmail FROM posts 
       JOIN users ON posts.userId = users.id
       WHERE posts.id = ?`,
      [postId],
      (err, post) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to get post' });
        }
        if (!post) return res.status(404).json({ error: 'Post not found' });

        db.all(
          `SELECT replies.*, users.email as authorEmail FROM replies 
           JOIN users ON replies.userId = users.id
           WHERE postId = ?
           ORDER BY createdAt ASC`,
          [postId],
          (err, replies) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Failed to get replies' });
            }
            res.json({ post, replies });
          }
        );
      }
    );
  });

  router.post('/posts', authMiddleware, (req, res) => {
    const { categoryId, title, content, imageUrl } = req.body;
    const userId = req.user.id;

    if (!categoryId || !title || !content) {
      return res.status(400).json({ error: 'Category, title, and content required' });
    }

    db.run(
      `INSERT INTO posts (userId, categoryId, title, content, imageUrl) VALUES (?, ?, ?, ?, ?)`,
      [userId, categoryId, title, content, imageUrl || null],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to create post' });
        }
        res.json({ postId: this.lastID });
      }
    );
  });

  router.post('/posts/:postId/replies', authMiddleware, (req, res) => {
    const postId = req.params.postId;
    const { content, imageUrl } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    db.run(
      `INSERT INTO replies (postId, userId, content, imageUrl) VALUES (?, ?, ?, ?)`,
      [postId, userId, content, imageUrl || null],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to create reply' });
        }
        res.json({ replyId: this.lastID });
      }
    );
  });

  router.delete('/admin/posts/:postId', authMiddleware, adminMiddleware, (req, res) => {
    const postId = req.params.postId;
    db.run(`DELETE FROM posts WHERE id = ?`, [postId], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to delete post' });
      }
      res.json({ success: true });
    });
  });

  router.delete('/admin/replies/:replyId', authMiddleware, adminMiddleware, (req, res) => {
    const replyId = req.params.replyId;
    db.run(`DELETE FROM replies WHERE id = ?`, [replyId], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to delete reply' });
      }
      res.json({ success: true });
    });
  });

  router.post('/admin/users/:userId/ban', authMiddleware, adminMiddleware, async (req, res) => {
    const userId = req.params.userId;
    try {
      await banUser(userId);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  });

  return router;
};

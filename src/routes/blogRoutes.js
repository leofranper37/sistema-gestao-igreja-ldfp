const express = require('express');
const router = express.Router();
const { listPublic, getBySlug } = require('../controllers/blogController');

router.get('/api/blog/posts', listPublic);
router.get('/api/blog/posts/:slug', getBySlug);

module.exports = router;

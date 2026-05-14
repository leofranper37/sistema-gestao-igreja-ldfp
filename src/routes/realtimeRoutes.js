const express = require('express');

const { requireAuth } = require('../middlewares/auth');
const { streamEvents } = require('../controllers/realtimeController');

const router = express.Router();

router.get('/realtime/events', requireAuth, streamEvents);

module.exports = router;

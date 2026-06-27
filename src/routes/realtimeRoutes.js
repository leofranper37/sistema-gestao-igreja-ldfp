const express = require('express');

const { requireAuthSSE } = require('../middlewares/auth');
const { streamEvents } = require('../controllers/realtimeController');

const router = express.Router();

router.get('/realtime/events', requireAuthSSE, streamEvents);

module.exports = router;

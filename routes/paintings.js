const express = require('express');
const { generatePaintings, getPaintings, regenerateImage } = require('../controllers/paintingController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authMiddleware);

router.post('/generate', generatePaintings);
router.post('/regenerate', regenerateImage);
router.get('/:titleId', getPaintings);

module.exports = router; 
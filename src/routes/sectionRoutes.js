const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const sectionCommentController = require('../controllers/sectionCommentController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadTheory = require('../config/uploadTheory');

router.use(authMiddleware.verifyToken);

router.get('/sections/:sectionId/comments', sectionCommentController.listComments);
router.post('/sections/:sectionId/comments', sectionCommentController.createComment);
router.delete('/sections/:sectionId/comments/:commentId', sectionCommentController.deleteComment);
// НОВЫЙ МАРШРУТ - получаем раздел с контентом
router.get('/sections/:sectionId', sectionController.getSectionById);
router.get('/blocks/:blockId/sections', sectionController.getSectionsByBlock);
router.post('/blocks/:blockId/sections', sectionController.createSection);
router.put('/sections/:sectionId/theory', sectionController.updateTheorySection);
router.put('/sections/:sectionId/exercise', sectionController.updateExerciseSection);
router.put('/sections/:sectionId/test', sectionController.updateTestSection);
router.delete('/sections/:sectionId', sectionController.deleteSection);
router.put('/blocks/:blockId/sections/reorder', sectionController.reorderSections);

// Добавь этот маршрут
router.post('/sections/:sectionId/upload-file',
    authMiddleware.verifyToken,
    authMiddleware.checkRole(['teacher']),
    uploadTheory.single('file'),
    sectionController.uploadTheoryFile
);

module.exports = router;
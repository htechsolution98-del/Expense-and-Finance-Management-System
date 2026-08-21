import { Router } from 'express';
import { login, refresh, logout, getMe, changePassword, getNotifications } from '../../controllers/auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.get('/notifications', authenticate, getNotifications);

export default router;

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { authorize } from '../../middleware/permission.middleware';
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../controllers/announcement.controller';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

router.get('/', authorize('ANNOUNCEMENT_VIEW'), getAnnouncements);
router.post('/', authorize('SUPER_ADMIN_ONLY'), createAnnouncement);
router.put('/:id', authorize('SUPER_ADMIN_ONLY'), updateAnnouncement);
router.delete('/:id', authorize('SUPER_ADMIN_ONLY'), deleteAnnouncement);

export default router;

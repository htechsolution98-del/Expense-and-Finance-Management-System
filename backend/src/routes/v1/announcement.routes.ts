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
router.post('/', authorize('ANNOUNCEMENT_CREATE'), createAnnouncement);
router.put('/:id', authorize('ANNOUNCEMENT_CREATE'), updateAnnouncement);
router.delete('/:id', authorize('ANNOUNCEMENT_CREATE'), deleteAnnouncement);

export default router;

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule
} from '../../controllers/approval-rule.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('SUPER_ADMIN_ONLY'));

router.get('/', getRules);
router.post('/', createRule);
router.put('/:id', updateRule);
router.delete('/:id', deleteRule);

export default router;

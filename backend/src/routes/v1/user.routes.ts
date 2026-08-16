import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateStatus,
  updateRoles,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
  updateRolePermissions,
  deleteUser,
  getUserExtraPermissions,
  setUserExtraPermissions,
} from '../../controllers/user.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

// Apply auth and tenant scope isolation middlewares globally on user routes
router.use(authenticate);
router.use(tenantScopeMiddleware);

router.get('/', authorize('USER_VIEW'), getUsers);
router.get('/roles', authorize(['ROLE_VIEW', 'USER_CREATE']), getRoles);
router.post('/roles', authorize('ROLE_CREATE'), createRole);
router.put('/roles/:id', authorize('ROLE_UPDATE'), updateRole);
router.delete('/roles/:id', authorize('ROLE_UPDATE'), deleteRole);
router.get('/permissions', authorize('ROLE_VIEW'), getPermissions);
router.get('/:id', authorize('USER_VIEW'), getUserById);
router.post('/', authorize('USER_CREATE'), createUser);
router.patch('/:id', authorize('USER_UPDATE'), updateUser);
router.patch('/:id/status', authorize('USER_DISABLE'), updateStatus);
router.patch('/:id/roles', authorize('ROLE_UPDATE'), updateRoles);
router.put('/roles/:id/permissions', authorize('ROLE_UPDATE'), updateRolePermissions);
router.delete('/:id', authorize('USER_DISABLE'), deleteUser);

// User-specific extra permissions (individual grants beyond role)
router.get('/:id/extra-permissions', authorize('ROLE_VIEW'), getUserExtraPermissions);
router.put('/:id/extra-permissions', authorize('ROLE_UPDATE'), setUserExtraPermissions);

export default router;

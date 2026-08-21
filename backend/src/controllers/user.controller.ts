import { Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors';
import { generateNextEmployeeCode } from '../utils/employeeCode';
import { sendWelcomeEmail } from '../utils/mailer';

const createUserSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  roleName: z.string(),
  employeeCode: z.string().optional(),
  autoGenerateCode: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional(),
  employeeCode: z.string().min(2).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

const updateRolesSchema = z.object({
  roleName: z.string(),
});

// Helper to fetch single user and verify tenant bounds
async function getTenantScopedUser(userId: string, companyId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.companyId !== companyId) {
    throw new ForbiddenError('Access Denied: Tenant boundary mismatch');
  }

  return user;
}

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;

    // Non-Super-Admins should not see SUPER_ADMIN users
    let superAdminFilter: any = {};
    if (req.user!.role !== 'SUPER_ADMIN') {
      superAdminFilter = {
        userRoles: {
          none: {
            role: {
              name: 'SUPER_ADMIN'
            }
          }
        }
      };
    }

    const users = await prisma.user.findMany({
      where: {
        companyId,
        status: { not: 'DELETED' },
        ...superAdminFilter
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        employee: {
          select: {
            employeeCode: true,
          },
        },
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      employeeCode: user.employee?.employeeCode || null,
      role: user.userRoles[0]?.role.name || 'STAFF',
    }));

    sendSuccess(res, 'Users retrieved successfully', formattedUsers);
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    const user = await getTenantScopedUser(id, companyId);

    sendSuccess(res, 'User retrieved successfully', {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      role: user.userRoles[0]?.role.name || 'STAFF',
    });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone, email, password, roleName, employeeCode, autoGenerateCode } = createUserSchema.parse(req.body);
    const companyId = req.companyId!;
    const currentUserId = req.user!.id;

    if (req.user!.role !== 'SUPER_ADMIN' && roleName === 'SUPER_ADMIN') {
      throw new ForbiddenError('Only Super Admin is authorized to assign the SUPER_ADMIN role');
    }

    // Check if email already taken
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('Email is already registered');
    }

    // Check if phone already taken
    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        throw new ConflictError('Phone number is already registered');
      }
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new BadRequestError(`Role not found: ${roleName}`);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.$transaction(async (tx) => {
      // Determine employeeCode
      let finalEmpCode = employeeCode;
      const isAuto = autoGenerateCode === undefined ? true : autoGenerateCode;

      if (isAuto || !finalEmpCode) {
        finalEmpCode = await generateNextEmployeeCode(companyId, tx);
      } else {
        // Check if employeeCode already exists in this company
        const existingEmp = await tx.employee.findUnique({
          where: {
            companyId_employeeCode: {
              companyId,
              employeeCode: finalEmpCode,
            },
          },
        });
        if (existingEmp) {
          throw new BadRequestError(`Employee code "${finalEmpCode}" already exists`);
        }
      }

      // 1. Create Employee
      const employee = await tx.employee.create({
        data: {
          companyId,
          employeeCode: finalEmpCode,
          name: name || email.split('@')[0],
          joiningDate: new Date(),
          mobile: phone || 'N/A',
          email,
          address: 'N/A',
          status: 'ACTIVE',
        },
      });

      // 2. Create user
      const user = await tx.user.create({
        data: {
          name: name || null,
          phone: phone || null,
          email,
          passwordHash: hashedPassword,
          companyId,
          employeeId: employee.id,
          status: 'ACTIVE',
        },
      });

      // 2. Link user role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: currentUserId,
          module: 'USER_MGMT',
          recordId: user.id,
          action: 'USER_CREATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      return user;
    });

    sendSuccess(
      res,
      'User created successfully',
      {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        status: newUser.status,
        role: role.name,
      },
      201
    );

    // Send welcome email with login credentials (non-blocking)
    prisma.company.findUnique({ where: { id: companyId } })
      .then((company) => {
        sendWelcomeEmail(
          email,
          name || email.split('@')[0],
          password,
          role.name,
          company || undefined
        ).catch(() => {});
      })
      .catch(() => {});
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone, email, employeeCode } = updateUserSchema.parse(req.body);
    const companyId = req.companyId!;
    const currentUserId = req.user!.id;

    const user = await getTenantScopedUser(id, companyId);

    if (req.user!.role !== 'SUPER_ADMIN') {
      const userRole = user.userRoles[0]?.role.name;
      if (userRole === 'SUPER_ADMIN') {
        throw new ForbiddenError('Only Super Admin is authorized to modify a SUPER_ADMIN user');
      }
    }

    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictError('Email is already registered');
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(phone && { phone }),
          ...(email && { email }),
        },
      });

      if (u.employeeId) {
        let employeeCodeUpdate = {};
        if (employeeCode) {
          const currentEmp = await tx.employee.findUnique({
            where: { id: u.employeeId }
          });
          if (currentEmp && currentEmp.employeeCode !== employeeCode) {
            const existingEmp = await tx.employee.findUnique({
              where: {
                companyId_employeeCode: {
                  companyId,
                  employeeCode,
                }
              }
            });
            if (existingEmp) {
              throw new BadRequestError(`Employee code "${employeeCode}" already exists`);
            }
            employeeCodeUpdate = { employeeCode };
          }
        }

        await tx.employee.update({
          where: { id: u.employeeId },
          data: {
            ...(name && { name }),
            ...(phone && { mobile: phone }),
            ...(email && { email }),
            ...employeeCodeUpdate,
          }
        });
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: currentUserId,
          module: 'USER_MGMT',
          recordId: id,
          action: 'USER_UPDATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          oldData: JSON.stringify({ email: user.email }),
          newData: JSON.stringify({ email: u.email }),
        },
      });

      return u;
    });

    sendSuccess(res, 'User updated successfully', {
      id: updatedUser.id,
      email: updatedUser.email,
    });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);
    const companyId = req.companyId!;
    const currentUserId = req.user!.id;

    if (id === currentUserId) {
      throw new BadRequestError('You cannot deactivate your own account');
    }

    const user = await getTenantScopedUser(id, companyId);

    if (req.user!.role !== 'SUPER_ADMIN') {
      const userRole = user.userRoles[0]?.role.name;
      if (userRole === 'SUPER_ADMIN') {
        throw new ForbiddenError('Only Super Admin is authorized to modify a SUPER_ADMIN user status');
      }
    }

    if (user.status === status) {
      sendSuccess(res, `User status is already ${status}`, { id: user.id, status: user.status });
      return;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { status },
      });

      // Write status audit log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: currentUserId,
          module: 'USER_MGMT',
          recordId: id,
          action: status === 'ACTIVE' ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          oldData: JSON.stringify({ status: user.status }),
          newData: JSON.stringify({ status: u.status }),
        },
      });

      return u;
    });

    sendSuccess(res, `User status updated to ${status} successfully`, {
      id: updatedUser.id,
      status: updatedUser.status,
    });
  } catch (err) {
    next(err);
  }
};

export const updateRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { roleName } = updateRolesSchema.parse(req.body);
    const companyId = req.companyId!;
    const currentUserId = req.user!.id;

    const user = await getTenantScopedUser(id, companyId);

    if (req.user!.role !== 'SUPER_ADMIN') {
      if (roleName === 'SUPER_ADMIN') {
        throw new ForbiddenError('Only Super Admin is authorized to assign the SUPER_ADMIN role');
      }
      const userRole = user.userRoles[0]?.role.name;
      if (userRole === 'SUPER_ADMIN') {
        throw new ForbiddenError('Only Super Admin is authorized to edit a SUPER_ADMIN user');
      }
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new BadRequestError(`Role not found: ${roleName}`);
    }

    const currentRole = user.userRoles[0]?.role.name || 'STAFF';
    if (currentRole === roleName) {
      sendSuccess(res, 'User is already in this role', { id: user.id, role: roleName });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Clear previous roles mappings
      await tx.userRole.deleteMany({
        where: { userId: id },
      });

      // Link new role
      await tx.userRole.create({
        data: {
          userId: id,
          roleId: role.id,
        },
      });

      // Log role assignment change
      await tx.auditLog.create({
        data: {
          companyId,
          userId: currentUserId,
          module: 'USER_MGMT',
          recordId: id,
          action: 'ROLE_ASSIGNMENT',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          oldData: JSON.stringify({ role: currentRole }),
          newData: JSON.stringify({ role: roleName }),
        },
      });
    });

    sendSuccess(res, `User role updated to ${roleName} successfully`, {
      id: user.id,
      role: roleName,
    });
  } catch (err) {
    next(err);
  }
};

const updateRolePermissionsSchema = z.object({
  permissionNames: z.array(z.string()),
});

export const getRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      where: req.user!.role !== 'SUPER_ADMIN' ? { name: { not: 'SUPER_ADMIN' } } : undefined,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formattedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map((rp) => rp.permission.name),
    }));

    sendSuccess(res, 'Roles retrieved successfully', formattedRoles);
  } catch (err) {
    next(err);
  }
};

const createRoleSchema = z.object({
  name: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_\s-]+$/, 'Role name can only contain letters, numbers, spaces, underscores, or hyphens'),
  description: z.string().max(200).optional(),
});

export const createRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description } = createRoleSchema.parse(req.body);
    const companyId = req.companyId!;
    const currentUserId = req.user!.id;

    const formattedName = name.toUpperCase().trim().replace(/\s+/g, '_');

    if (formattedName === 'SUPER_ADMIN') {
      throw new BadRequestError('Cannot create another SUPER_ADMIN role');
    }

    const existingRole = await prisma.role.findUnique({
      where: { name: formattedName },
    });

    if (existingRole) {
      throw new ConflictError('A role with this name already exists');
    }

    const newRole = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: formattedName,
          description: description || `Custom role ${formattedName}`,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: currentUserId,
          module: 'USER_MGMT',
          recordId: role.id,
          action: 'ROLE_CREATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          newData: JSON.stringify({ name: role.name, description: role.description }),
        },
      });

      return role;
    });

    sendSuccess(res, 'Role created successfully', {
      id: newRole.id,
      name: newRole.name,
      description: newRole.description,
      permissions: [],
    });
  } catch (err) {
    next(err);
  }
};

const SYSTEM_ROLES = ['SUPER_ADMIN']; // Only protect the root super admin role

export const updateRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.permissions.includes('*')) {
      throw new ForbiddenError('Only SUPER_ADMIN can modify custom roles');
    }

    const { id } = req.params;
    const { name, description } = createRoleSchema.parse(req.body);
    const formattedName = name.toUpperCase().trim().replace(/\s+/g, '_');

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    if (SYSTEM_ROLES.includes(role.name)) {
      throw new ForbiddenError(`Cannot rename system role: ${role.name}`);
    }
    if (SYSTEM_ROLES.includes(formattedName)) {
      throw new BadRequestError(`Cannot use a reserved system role name: ${formattedName}`);
    }

    const existingRole = await prisma.role.findFirst({
      where: { name: formattedName, id: { not: id } },
    });
    if (existingRole) {
      throw new ConflictError('A role with this name already exists');
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: formattedName,
        description,
      },
    });

    sendSuccess(res, 'Role updated successfully', {
      id: updatedRole.id,
      name: updatedRole.name,
      description: updatedRole.description,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.permissions.includes('*')) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete custom roles');
    }

    const { id } = req.params;
    
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    if (SYSTEM_ROLES.includes(role.name)) {
      throw new ForbiddenError(`Cannot delete system role: ${role.name}`);
    }

    // Check if role is assigned to any active/inactive users (exclude DELETED)
    const usersWithRole = await prisma.userRole.count({
      where: {
        roleId: id,
        user: { status: { not: 'DELETED' } },
      },
    });
    if (usersWithRole > 0) {
      throw new BadRequestError(`Cannot delete role. It is assigned to ${usersWithRole} user(s).`);
    }

    await prisma.role.delete({ where: { id } });

    sendSuccess(res, 'Role deleted successfully', null);
  } catch (err) {
    next(err);
  }
};

export const getPermissions = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    sendSuccess(res, 'Permissions retrieved successfully', permissions);
  } catch (err) {
    next(err);
  }
};

export const updateRolePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { permissionNames } = updateRolePermissionsSchema.parse(req.body);
    const companyId = req.companyId!;
    const currentUserId = req.user!.id;

    const role = await prisma.role.findFirst({
      where: {
        OR: [
          { id },
          { name: id },
        ],
      },
    });

    if (!role) {
      throw new NotFoundError(`Role not found: ${id}`);
    }

    if (req.user!.role !== 'SUPER_ADMIN') {
      if (role.name === 'SUPER_ADMIN') {
        throw new ForbiddenError('Only Super Admin is authorized to modify SUPER_ADMIN permissions');
      }
      if (role.name === req.user!.role) {
        throw new ForbiddenError('You cannot modify the permissions of your own role');
      }
    }

    const permissions = await prisma.permission.findMany({
      where: {
        name: { in: permissionNames },
      },
    });

    const updatedPermissions = await prisma.$transaction(async (tx) => {
      // 1. Delete all existing mappings for this role
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      // 2. Insert new mappings
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
        });
      }

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: currentUserId,
          module: 'USER_MGMT',
          recordId: role.id,
          action: 'ROLE_PERMISSIONS_UPDATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          newData: JSON.stringify({ role: role.name, permissions: permissionNames }),
        },
      });

      return permissions.map((p) => p.name);
    });

    sendSuccess(res, `Permissions updated for role ${role.name} successfully`, {
      role: role.name,
      permissions: updatedPermissions,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const currentUserId = req.user!.id;

    // Enforce Super Admin only
    if (req.user!.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only Super Admin is authorized to delete users');
    }

    if (id === currentUserId) {
      throw new BadRequestError('You cannot delete your own account');
    }

    const user = await getTenantScopedUser(id, companyId);

    if (user.status === 'DELETED') {
      throw new BadRequestError('User is already deleted');
    }

    const deletedUser = await prisma.$transaction(async (tx) => {
      // Append timestamp suffix to email to free it up for re-registration
      const softDeletedEmail = `${user.email}_deleted_${Date.now()}`;

      const u = await tx.user.update({
        where: { id },
        data: {
          status: 'DELETED',
          email: softDeletedEmail,
          phone: null, // Release unique phone number constraint on deletion
        },
      });

      // Write status audit log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: currentUserId,
          module: 'USER_MGMT',
          recordId: id,
          action: 'USER_DELETE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          oldData: JSON.stringify({ status: user.status, email: user.email }),
          newData: JSON.stringify({ status: u.status, email: u.email }),
        },
      });

      return u;
    });

    sendSuccess(res, 'User soft-deleted successfully', {
      id: deletedUser.id,
      email: deletedUser.email,
      status: deletedUser.status,
    });
  } catch (err) {
    next(err);
  }
};

// ─── User-Specific Extra Permissions ────────────────────────────────────────

/**
 * GET /users/:id/extra-permissions
 * Returns the list of individually-granted permissions for a specific user
 * (on top of their role permissions).
 */
export const getUserExtraPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;

    // Verify user is in the same company
    await getTenantScopedUser(id, companyId);

    const userPerms = await prisma.userPermission.findMany({
      where: { userId: id },
      include: { permission: true },
    });

    const extraPermissions = userPerms.map((up) => up.permission.name);

    sendSuccess(res, 'User extra permissions retrieved', { extraPermissions });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /users/:id/extra-permissions
 * Replaces all individually-granted permissions for a user.
 * Body: { permissions: string[] }  (array of permission names)
 */
export const setUserExtraPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const grantedBy = req.user!.id;

    const { permissions } = z
      .object({ permissions: z.array(z.string()) })
      .parse(req.body);

    // Verify target user belongs to same company
    const targetUser = await getTenantScopedUser(id, companyId);

    // Cannot grant permissions to SUPER_ADMIN (they already have '*')
    if (targetUser.userRoles[0]?.role?.name === 'SUPER_ADMIN') {
      throw new ForbiddenError('Cannot modify permissions of a SUPER_ADMIN user');
    }

    // Resolve permission names to IDs
    const permRecords = await prisma.permission.findMany({
      where: { name: { in: permissions } },
    });

    const validPermNames = permRecords.map((p) => p.name);
    const invalidPerms = permissions.filter((p) => !validPermNames.includes(p));
    if (invalidPerms.length > 0) {
      throw new BadRequestError(`Unknown permissions: ${invalidPerms.join(', ')}`);
    }

    // Replace all user permissions atomically
    const updatedPerms = await prisma.$transaction(async (tx) => {
      // Delete existing user-specific permissions
      await tx.userPermission.deleteMany({ where: { userId: id } });

      // Insert new ones
      if (permRecords.length > 0) {
        await tx.userPermission.createMany({
          data: permRecords.map((p) => ({
            userId: id,
            permissionId: p.id,
            grantedBy,
          })),
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: grantedBy,
          module: 'USER_MGMT',
          recordId: id,
          action: 'USER_EXTRA_PERMISSIONS_UPDATE',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          newData: JSON.stringify({ extraPermissions: validPermNames }),
        },
      });

      return validPermNames;
    });

    sendSuccess(res, 'User extra permissions updated successfully', {
      userId: id,
      extraPermissions: updatedPerms,
    });
  } catch (err) {
    next(err);
  }
};

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const resetUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const companyId = req.companyId!;

    // Restrict this to Super Admin only
    if (req.user!.role !== 'SUPER_ADMIN' && !req.user!.permissions.includes('*')) {
      throw new ForbiddenError('Only Super Admin can reset user passwords');
    }

    const user = await getTenantScopedUser(id, companyId);

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: req.user!.id,
        module: 'USER',
        recordId: id,
        action: 'PASSWORD_RESET',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        newData: JSON.stringify({ resetTargetEmail: user.email }),
      },
    });

    sendSuccess(res, 'User password reset successfully');
  } catch (err) {
    next(err);
  }
};

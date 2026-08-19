import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { NotFoundError } from '../utils/errors';

const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  attachment: z.string().optional().nullable(),
  targetRoles: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  expiresAt: z.preprocess((val) => (val ? new Date(val as string) : null), z.date().nullable().optional()),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  attachment: z.string().optional().nullable(),
  targetRoles: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  expiresAt: z.preprocess((val) => (val ? new Date(val as string) : null), z.date().nullable().optional()),
});

export const getAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const user = req.user!;

    // Check if the user has management permissions (SUPER_ADMIN only)
    const canManage =
      user.permissions.includes('*') ||
      user.role === 'SUPER_ADMIN';

    let announcements;

    if (canManage) {
      // Admins see all announcements
      announcements = await prisma.announcement.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });
    } else {
      // Staff see only ACTIVE and non-expired announcements
      const now = new Date();
      const rawAnnouncements = await prisma.announcement.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      // Filter by targetRoles
      announcements = rawAnnouncements.filter((ann) => {
        if (!ann.targetRoles) return true;
        const roles = ann.targetRoles
          .split(',')
          .map((r) => r.trim().toUpperCase());
        return roles.includes(user.role.toUpperCase());
      });
    }

    sendSuccess(res, 'Announcements retrieved successfully', announcements);
  } catch (err) {
    next(err);
  }
};

export const createAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const creatorId = req.user!.id;
    const data = createAnnouncementSchema.parse(req.body);

    const announcement = await prisma.announcement.create({
      data: {
        companyId,
        createdById: creatorId,
        title: data.title,
        content: data.content,
        attachment: data.attachment,
        targetRoles: data.targetRoles,
        status: data.status,
        expiresAt: data.expiresAt,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: creatorId,
        module: 'ANNOUNCEMENT',
        recordId: announcement.id,
        action: 'CREATE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        newData: JSON.stringify(announcement),
      },
    });

    sendSuccess(res, 'Announcement created successfully', announcement, 201);
  } catch (err) {
    next(err);
  }
};

export const updateAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const userId = req.user!.id;
    const data = updateAnnouncementSchema.parse(req.body);

    const existing = await prisma.announcement.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Announcement not found');
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.attachment !== undefined && { attachment: data.attachment }),
        ...(data.targetRoles !== undefined && { targetRoles: data.targetRoles }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        module: 'ANNOUNCEMENT',
        recordId: id,
        action: 'UPDATE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        oldData: JSON.stringify(existing),
        newData: JSON.stringify(updated),
      },
    });

    sendSuccess(res, 'Announcement updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.companyId!;
    const userId = req.user!.id;

    const existing = await prisma.announcement.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Announcement not found');
    }

    await prisma.announcement.delete({
      where: { id },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        module: 'ANNOUNCEMENT',
        recordId: id,
        action: 'DELETE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        oldData: JSON.stringify(existing),
      },
    });

    sendSuccess(res, 'Announcement deleted successfully');
  } catch (err) {
    next(err);
  }
};

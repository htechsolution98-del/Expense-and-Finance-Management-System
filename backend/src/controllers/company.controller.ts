import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { NotFoundError } from '../utils/errors';

export const getCompanyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        logo: true,
        gstin: true,
        timezone: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) throw new NotFoundError('Company profile not found.');

    sendSuccess(res, 'Company profile retrieved successfully', company, 200);
  } catch (error) {
    next(error);
  }
};

export const updateCompanyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { name, phone, email, address, gstin } = req.body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (email !== undefined) dataToUpdate.email = email;
    if (address !== undefined) dataToUpdate.address = address;
    if (gstin !== undefined) dataToUpdate.gstin = gstin;

    if (req.file) {
      dataToUpdate.logo = `uploads/${req.file.filename}`;
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: dataToUpdate,
    });

    sendSuccess(res, 'Company profile updated successfully', updatedCompany, 200);
  } catch (error) {
    next(error);
  }
};

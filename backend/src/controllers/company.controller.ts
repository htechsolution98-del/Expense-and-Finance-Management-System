import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/apiResponse';
import { NotFoundError } from '../utils/errors';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

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
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        subscriptionPlanId: true,
        subscriptionPlan: {
          select: {
            name: true,
            months: true,
          }
        },
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

export const createSubscriptionOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { planId } = req.body;
    if (!planId) {
      res.status(400).json({ success: false, message: 'planId is required.' });
      return;
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      res.status(404).json({ success: false, message: 'Active subscription plan not found.' });
      return;
    }

    let finalAmount = plan.price;
    if (plan.hasGst) {
      finalAmount = finalAmount + (finalAmount * 0.18);
    }

    const options = {
      amount: Math.round(finalAmount * 100), // amount in the smallest currency unit
      currency: "INR",
      receipt: `rcpt_${planId.slice(0, 8)}_${Date.now().toString().slice(-10)}`
    };

    let order;
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpError: any) {
      console.error('[Razorpay] Order creation failed:', JSON.stringify(rzpError));
      const errorMsg = rzpError?.error?.description || rzpError?.message || 'Razorpay order creation failed.';
      res.status(502).json({ success: false, message: `Payment gateway error: ${errorMsg}` });
      return;
    }

    sendSuccess(res, 'Razorpay order created successfully', {
      orderId: order.id,
      amount: options.amount,
      currency: options.currency,
      planId: plan.id,
      keyId: process.env.RAZORPAY_KEY_ID
    }, 200);
  } catch (error) {
    next(error);
  }
};

export const subscribeToCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { planId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!planId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      res.status(400).json({ success: false, message: 'Missing required payment parameters.' });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
      return;
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      res.status(404).json({ success: false, message: 'Active subscription plan not found.' });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionEndsAt: true },
    });

    if (!company) {
      res.status(404).json({ success: false, message: 'Company not found.' });
      return;
    }

    const now = new Date();
    let currentEnd = company.subscriptionEndsAt && company.subscriptionEndsAt > now
      ? new Date(company.subscriptionEndsAt)
      : now;

    // Extend subscription by the plan's number of months
    currentEnd.setMonth(currentEnd.getMonth() + plan.months);

    // Calculate amount paid (including GST if applicable)
    let amountPaid = plan.price;
    if (plan.hasGst) amountPaid = amountPaid + (amountPaid * 0.18);

    const [updatedCompany] = await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt: currentEnd,
          subscriptionPlanId: planId,
        },
      }),
      prisma.subscriptionPayment.create({
        data: {
          companyId,
          planId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          amountPaid: Math.round(amountPaid * 100) / 100,
          currency: 'INR',
          status: 'SUCCESS',
        },
      }),
    ]);

    sendSuccess(res, `Subscription plan "${plan.name}" activated successfully`, updatedCompany, 200);

  } catch (error) {
    next(error);
  }
};

export const getActivePlans = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { months: 'asc' },
    });
    sendSuccess(res, 'Active subscription plans retrieved successfully', plans, 200);
  } catch (error) {
    next(error);
  }
};


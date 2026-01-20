import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with this email, you will receive a password reset link',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Set token expiry (1 hour from now)
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // Save hashed token and expiry to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/${user.locale}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // Log reset URL for development (in production, send email)
    console.log('[Password Reset] Reset URL for', user.email, ':', resetUrl);

    // TODO: Send email with reset link
    // For now, we'll log the URL. In production, integrate with an email service:
    // - Resend (recommended): npm install resend
    // - SendGrid: npm install @sendgrid/mail
    // - Nodemailer with SMTP
    //
    // Example with Resend:
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'FamilyFolio <noreply@yourdomain.com>',
    //   to: user.email,
    //   subject: 'Reset your password',
    //   html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    // });

    return NextResponse.json({
      message: 'If an account exists with this email, you will receive a password reset link',
      // Include resetUrl in development for testing
      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    });
  } catch (error) {
    console.error('[Forgot Password API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

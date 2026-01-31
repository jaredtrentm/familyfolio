import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendPasswordResetEmail } from '@/lib/email';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (!payload.userId) return false;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: { role: true, email: true },
    });

    return user?.role === 'admin' || user?.email === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

// GET /api/admin/users - List all users
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            transactions: true,
            accounts: true,
            dataUploads: true,
            chatMessages: true,
          },
        },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[Admin API] Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users - Perform actions on users
export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, action, data } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId and action are required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'updateName': {
        await prisma.user.update({
          where: { id: userId },
          data: { name: data.name },
        });
        return NextResponse.json({ success: true });
      }

      case 'updateRole': {
        await prisma.user.update({
          where: { id: userId },
          data: { role: data.role },
        });
        return NextResponse.json({ success: true });
      }

      case 'sendPasswordReset': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, locale: true },
        });

        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(resetToken, 10);
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
          where: { id: userId },
          data: {
            passwordResetToken: hashedToken,
            passwordResetExpires: resetExpires,
          },
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetUrl = `${baseUrl}/${user.locale}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

        // Send email
        const emailResult = await sendPasswordResetEmail(user.email, resetUrl, user.locale);

        if (!emailResult.success) {
          console.error('[Admin API] Failed to send password reset email:', emailResult.error);
        }

        return NextResponse.json({
          success: true,
          message: 'Password reset email sent',
          // Include URL in development for testing
          ...(process.env.NODE_ENV === 'development' && { resetUrl }),
        });
      }

      case 'delete': {
        // Delete user and all related data
        // Due to cascading, we need to delete in order
        await prisma.$transaction(async (tx) => {
          // Delete chat messages
          await tx.chatMessage.deleteMany({ where: { userId } });

          // Delete share requests
          await tx.shareRequest.deleteMany({
            where: { OR: [{ requesterId: userId }, { targetId: userId }] },
          });

          // Delete links
          await tx.link.deleteMany({ where: { userId } });

          // Get user's accounts
          const accounts = await tx.account.findMany({
            where: { userId },
            select: { id: true },
          });

          const accountIds = accounts.map((a) => a.id);

          // Delete transactions from user's accounts
          await tx.transaction.deleteMany({
            where: { OR: [{ claimedById: userId }, { accountId: { in: accountIds } }] },
          });

          // Delete data uploads from user's accounts
          await tx.dataUpload.deleteMany({
            where: { OR: [{ userId }, { accountId: { in: accountIds } }] },
          });

          // Delete accounts
          await tx.account.deleteMany({ where: { userId } });

          // Finally delete the user
          await tx.user.delete({ where: { id: userId } });
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Admin API] Action failed:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}

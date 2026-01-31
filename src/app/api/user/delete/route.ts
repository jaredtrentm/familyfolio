import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export async function DELETE() {
  try {
    const session = await verifySession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;

    // Delete all user data in order (respecting foreign keys)
    // Prisma cascade should handle most of this, but we do it explicitly
    await prisma.$transaction(async (tx) => {
      // Delete Plaid connections (cascades to PlaidAccounts)
      await tx.plaidConnection.deleteMany({ where: { userId } });

      // Delete share requests
      await tx.shareRequest.deleteMany({
        where: { OR: [{ requesterId: userId }, { targetId: userId }] },
      });

      // Delete chat messages
      await tx.chatMessage.deleteMany({ where: { userId } });

      // Delete links
      await tx.link.deleteMany({ where: { userId } });

      // Unclaim transactions (set claimedById to null instead of deleting)
      await tx.transaction.updateMany({
        where: { claimedById: userId },
        data: { claimedById: null },
      });

      // Delete data uploads
      await tx.dataUpload.deleteMany({ where: { userId } });

      // Delete accounts
      await tx.account.deleteMany({ where: { userId } });

      // Finally delete user
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}

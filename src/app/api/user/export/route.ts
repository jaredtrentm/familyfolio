import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.id;

    // Fetch all user data for GDPR export
    const [
      user,
      accounts,
      transactions,
      dataUploads,
      chatMessages,
      links,
      shareRequests,
      plaidConnections,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.account.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          cashBalance: true,
          isShared: true,
          createdAt: true,
        },
      }),
      prisma.transaction.findMany({
        where: { claimedById: userId },
        select: {
          id: true,
          date: true,
          type: true,
          symbol: true,
          description: true,
          quantity: true,
          price: true,
          amount: true,
          fees: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.dataUpload.findMany({
        where: { userId },
        select: {
          id: true,
          filename: true,
          fileType: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.chatMessage.findMany({
        where: { userId },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      }),
      prisma.link.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          url: true,
          category: true,
          createdAt: true,
        },
      }),
      prisma.shareRequest.findMany({
        where: { OR: [{ requesterId: userId }, { targetId: userId }] },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.plaidConnection.findMany({
        where: { userId },
        select: {
          id: true,
          institutionName: true,
          status: true,
          createdAt: true,
          accounts: {
            select: {
              id: true,
              name: true,
              type: true,
              mask: true,
            },
          },
        },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      accounts,
      transactions,
      dataUploads,
      chatMessages,
      links,
      shareRequests,
      plaidConnections,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="familyfolio-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}

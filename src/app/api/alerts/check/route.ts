import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchMultipleStocks } from '@/lib/stock-data';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@familyfolio.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url: string
) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    const notifications = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title,
            body,
            url,
            tag: 'price-alert',
          })
        );
      } catch (error: unknown) {
        // Remove invalid subscriptions
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          }
        }
        console.error(`Failed to send push to ${sub.endpoint}:`, error);
      }
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

// This endpoint should be called by a cron job (e.g., every 5 minutes)
export async function GET() {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({
      checked: false,
      error: 'Push notifications not configured',
    });
  }

  try {
    // Get all active alerts
    const activeAlerts = await prisma.priceAlert.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    if (activeAlerts.length === 0) {
      return NextResponse.json({ checked: true, triggeredCount: 0 });
    }

    // Get unique symbols
    const symbols = [...new Set(activeAlerts.map((a) => a.symbol))];

    // Fetch current prices
    const stockData = await fetchMultipleStocks(symbols);

    let triggeredCount = 0;

    // Check each alert
    for (const alert of activeAlerts) {
      const stock = stockData.get(alert.symbol);
      if (!stock) continue;

      const currentPrice = stock.currentPrice;
      let triggered = false;

      if (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        triggeredCount++;

        // Update alert as triggered
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: {
            isActive: false,
            triggeredAt: new Date(),
          },
        });

        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: alert.userId,
            type: 'PRICE_ALERT',
            title: `${alert.symbol} Price Alert`,
            message: `${alert.symbol} is now $${currentPrice.toFixed(2)} (${alert.condition === 'ABOVE' ? 'above' : 'below'} your target of $${alert.targetPrice.toFixed(2)})`,
            actionUrl: `/alerts`,
          },
        });

        // Send push notification
        await sendPushNotification(
          alert.userId,
          `${alert.symbol} Price Alert`,
          `${alert.symbol} is now $${currentPrice.toFixed(2)} (${alert.condition === 'ABOVE' ? 'above' : 'below'} $${alert.targetPrice.toFixed(2)})`,
          '/alerts'
        );

        console.log(`[Alerts Check] Triggered: ${alert.symbol} ${alert.condition} ${alert.targetPrice} (current: ${currentPrice})`);
      }
    }

    // Update stock cache
    for (const [symbol, data] of stockData) {
      await prisma.stockCache.upsert({
        where: { symbol },
        update: {
          currentPrice: data.currentPrice,
          dayChange: data.dayChange,
          dayChangePercent: data.dayChangePercent,
        },
        create: {
          symbol,
          name: data.name,
          currentPrice: data.currentPrice,
          dayChange: data.dayChange,
          dayChangePercent: data.dayChangePercent,
          sector: data.sector,
        },
      });
    }

    return NextResponse.json({
      checked: true,
      totalAlerts: activeAlerts.length,
      triggeredCount,
      symbolsChecked: symbols.length,
    });
  } catch (error) {
    console.error('[Alerts Check] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check alerts' },
      { status: 500 }
    );
  }
}

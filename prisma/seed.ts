import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash passwords
  const password = await bcrypt.hash('password123', 12);

  // Create 3 users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'dad@family.com' },
      update: {},
      create: {
        email: 'dad@family.com',
        password,
        name: 'Dad',
        pin: '1234',
        locale: 'en',
      },
    }),
    prisma.user.upsert({
      where: { email: 'mom@family.com' },
      update: {},
      create: {
        email: 'mom@family.com',
        password,
        name: 'Mom',
        pin: '5678',
        locale: 'zh',
      },
    }),
    prisma.user.upsert({
      where: { email: 'kid@family.com' },
      update: {},
      create: {
        email: 'kid@family.com',
        password,
        name: 'Junior',
        pin: '9012',
        locale: 'en',
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // Create sample transactions (unclaimed - shared pool)
  const transactions = [
    // Tech stocks
    { date: daysAgo(90), type: 'BUY', symbol: 'AAPL', quantity: 50, price: 175.50, amount: 8775 },
    { date: daysAgo(85), type: 'BUY', symbol: 'MSFT', quantity: 30, price: 380.00, amount: 11400 },
    { date: daysAgo(80), type: 'BUY', symbol: 'GOOGL', quantity: 20, price: 140.00, amount: 2800 },
    { date: daysAgo(75), type: 'BUY', symbol: 'NVDA', quantity: 15, price: 450.00, amount: 6750 },
    { date: daysAgo(70), type: 'BUY', symbol: 'META', quantity: 25, price: 350.00, amount: 8750 },

    // More AAPL
    { date: daysAgo(60), type: 'BUY', symbol: 'AAPL', quantity: 30, price: 178.00, amount: 5340 },
    { date: daysAgo(55), type: 'DIVIDEND', symbol: 'AAPL', quantity: 80, price: 0.24, amount: 19.20 },

    // ETFs
    { date: daysAgo(50), type: 'BUY', symbol: 'VOO', quantity: 20, price: 430.00, amount: 8600 },
    { date: daysAgo(45), type: 'BUY', symbol: 'QQQ', quantity: 15, price: 380.00, amount: 5700 },
    { date: daysAgo(40), type: 'BUY', symbol: 'VTI', quantity: 25, price: 240.00, amount: 6000 },

    // Consumer stocks
    { date: daysAgo(35), type: 'BUY', symbol: 'AMZN', quantity: 40, price: 175.00, amount: 7000 },
    { date: daysAgo(30), type: 'BUY', symbol: 'TSLA', quantity: 20, price: 250.00, amount: 5000 },
    { date: daysAgo(25), type: 'BUY', symbol: 'DIS', quantity: 50, price: 95.00, amount: 4750 },

    // Some sells
    { date: daysAgo(20), type: 'SELL', symbol: 'TSLA', quantity: 10, price: 265.00, amount: 2650 },
    { date: daysAgo(15), type: 'SELL', symbol: 'NVDA', quantity: 5, price: 480.00, amount: 2400 },

    // Recent buys
    { date: daysAgo(10), type: 'BUY', symbol: 'AMD', quantity: 30, price: 155.00, amount: 4650 },
    { date: daysAgo(5), type: 'BUY', symbol: 'COST', quantity: 10, price: 720.00, amount: 7200 },
    { date: daysAgo(2), type: 'BUY', symbol: 'JPM', quantity: 25, price: 185.00, amount: 4625 },

    // Dividends
    { date: daysAgo(1), type: 'DIVIDEND', symbol: 'VOO', quantity: 20, price: 1.60, amount: 32.00 },
    { date: daysAgo(1), type: 'DIVIDEND', symbol: 'MSFT', quantity: 30, price: 0.75, amount: 22.50 },
  ];

  // Clear existing transactions
  await prisma.transaction.deleteMany();

  // Create transactions
  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        date: tx.date,
        type: tx.type,
        symbol: tx.symbol,
        quantity: tx.quantity,
        price: tx.price,
        amount: tx.amount,
        fees: Math.random() > 0.7 ? Math.round(Math.random() * 10 * 100) / 100 : 0,
        claimedById: null, // All start unclaimed
      },
    });
  }

  console.log(`Created ${transactions.length} transactions`);

  // Pre-populate some stock cache data
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 182.50, change: 2.30, changePercent: 1.27, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', price: 395.00, change: 5.50, changePercent: 1.41, sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 145.00, change: -1.20, changePercent: -0.82, sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 520.00, change: 15.00, changePercent: 2.97, sector: 'Technology' },
    { symbol: 'META', name: 'Meta Platforms Inc.', price: 380.00, change: 8.50, changePercent: 2.29, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 185.00, change: 3.20, changePercent: 1.76, sector: 'Consumer Cyclical' },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 260.00, change: -5.00, changePercent: -1.89, sector: 'Consumer Cyclical' },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', price: 445.00, change: 4.00, changePercent: 0.91, sector: 'ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 395.00, change: 6.00, changePercent: 1.54, sector: 'ETF' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', price: 250.00, change: 2.00, changePercent: 0.81, sector: 'ETF' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', price: 165.00, change: 3.50, changePercent: 2.17, sector: 'Technology' },
    { symbol: 'COST', name: 'Costco Wholesale', price: 735.00, change: 8.00, changePercent: 1.10, sector: 'Consumer Defensive' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 192.00, change: 2.50, changePercent: 1.32, sector: 'Financial Services' },
    { symbol: 'DIS', name: 'The Walt Disney Company', price: 98.00, change: -1.50, changePercent: -1.51, sector: 'Communication Services' },
  ];

  for (const stock of stocks) {
    await prisma.stockCache.upsert({
      where: { symbol: stock.symbol },
      update: {
        currentPrice: stock.price,
        dayChange: stock.change,
        dayChangePercent: stock.changePercent,
      },
      create: {
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.price,
        dayChange: stock.change,
        dayChangePercent: stock.changePercent,
        previousClose: stock.price - stock.change,
        sector: stock.sector,
      },
    });
  }

  console.log(`Created ${stocks.length} stock cache entries`);
  console.log('Seeding complete!');
  console.log('\nTest accounts:');
  console.log('  dad@family.com / password123 (PIN: 1234)');
  console.log('  mom@family.com / password123 (PIN: 5678)');
  console.log('  kid@family.com / password123 (PIN: 9012)');
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

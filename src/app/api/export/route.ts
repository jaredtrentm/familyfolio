import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';

    // Get user's transactions
    const transactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      orderBy: { date: 'desc' },
    });

    // Get stock cache for current prices
    const symbols = [...new Set(transactions.map((tx) => tx.symbol))];
    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
    });
    const priceMap = new Map(stockCache.map((s) => [s.symbol, s]));

    // Calculate holdings
    const holdingsMap = new Map<string, { symbol: string; quantity: number; costBasis: number }>();

    for (const tx of transactions) {
      const existing = holdingsMap.get(tx.symbol) || { symbol: tx.symbol, quantity: 0, costBasis: 0 };

      switch (tx.type) {
        case 'BUY':
        case 'TRANSFER_IN':
          existing.quantity += tx.quantity;
          existing.costBasis += tx.amount;
          break;
        case 'SELL':
        case 'TRANSFER_OUT':
          const ratio = tx.quantity / existing.quantity;
          existing.quantity -= tx.quantity;
          existing.costBasis -= existing.costBasis * ratio;
          break;
      }

      if (existing.quantity > 0) {
        holdingsMap.set(tx.symbol, existing);
      } else {
        holdingsMap.delete(tx.symbol);
      }
    }

    const holdings = Array.from(holdingsMap.values()).map((h) => {
      const stock = priceMap.get(h.symbol);
      const currentPrice = stock?.currentPrice || h.costBasis / h.quantity;
      const currentValue = h.quantity * currentPrice;

      return {
        Symbol: h.symbol,
        Name: stock?.name || h.symbol,
        Shares: h.quantity,
        'Avg Cost': h.costBasis / h.quantity,
        'Current Price': currentPrice,
        'Cost Basis': h.costBasis,
        'Current Value': currentValue,
        'Gain/Loss': currentValue - h.costBasis,
        'Gain/Loss %': ((currentValue - h.costBasis) / h.costBasis) * 100,
      };
    });

    // Format transactions for export
    const txData = transactions.map((tx) => ({
      Date: tx.date.toISOString().split('T')[0],
      Type: tx.type,
      Symbol: tx.symbol,
      Description: tx.description || '',
      Quantity: tx.quantity,
      Price: tx.price,
      Amount: tx.amount,
      Fees: tx.fees,
      Currency: tx.currency,
    }));

    if (format === 'excel') {
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();

      // Add holdings sheet
      const holdingsSheet = XLSX.utils.json_to_sheet(holdings);
      XLSX.utils.book_append_sheet(workbook, holdingsSheet, 'Holdings');

      // Add transactions sheet
      const txSheet = XLSX.utils.json_to_sheet(txData);
      XLSX.utils.book_append_sheet(workbook, txSheet, 'Transactions');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="portfolio-export.xlsx"',
        },
      });
    }

    if (format === 'pdf') {
      // For PDF, we'll return a simple HTML that can be printed
      // In production, you'd use a PDF library like pdfkit or puppeteer
      const totalValue = holdings.reduce((sum, h) => sum + h['Current Value'], 0);
      const totalCost = holdings.reduce((sum, h) => sum + h['Cost Basis'], 0);

      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Portfolio Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    .summary { margin: 20px 0; }
    .positive { color: green; }
    .negative { color: red; }
  </style>
</head>
<body>
  <h1>Portfolio Report</h1>
  <p>Generated: ${new Date().toLocaleDateString()}</p>

  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Total Value:</strong> $${totalValue.toFixed(2)}</p>
    <p><strong>Total Cost:</strong> $${totalCost.toFixed(2)}</p>
    <p><strong>Total Gain/Loss:</strong> <span class="${totalValue - totalCost >= 0 ? 'positive' : 'negative'}">$${(totalValue - totalCost).toFixed(2)} (${(((totalValue - totalCost) / totalCost) * 100).toFixed(2)}%)</span></p>
  </div>

  <h2>Holdings</h2>
  <table>
    <tr>
      <th>Symbol</th>
      <th>Shares</th>
      <th>Current Price</th>
      <th>Current Value</th>
      <th>Gain/Loss</th>
    </tr>
    ${holdings.map((h) => `
      <tr>
        <td>${h.Symbol}</td>
        <td>${h.Shares.toFixed(2)}</td>
        <td>$${h['Current Price'].toFixed(2)}</td>
        <td>$${h['Current Value'].toFixed(2)}</td>
        <td class="${h['Gain/Loss'] >= 0 ? 'positive' : 'negative'}">$${h['Gain/Loss'].toFixed(2)} (${h['Gain/Loss %'].toFixed(2)}%)</td>
      </tr>
    `).join('')}
  </table>

  <h2>Recent Transactions</h2>
  <table>
    <tr>
      <th>Date</th>
      <th>Type</th>
      <th>Symbol</th>
      <th>Quantity</th>
      <th>Price</th>
      <th>Amount</th>
    </tr>
    ${txData.slice(0, 20).map((tx) => `
      <tr>
        <td>${tx.Date}</td>
        <td>${tx.Type}</td>
        <td>${tx.Symbol}</td>
        <td>${tx.Quantity}</td>
        <td>$${tx.Price.toFixed(2)}</td>
        <td>$${tx.Amount.toFixed(2)}</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>`;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': 'attachment; filename="portfolio-report.html"',
        },
      });
    }

    if (format === 'zip') {
      const zip = new JSZip();

      // Add JSON data
      zip.file('holdings.json', JSON.stringify(holdings, null, 2));
      zip.file('transactions.json', JSON.stringify(txData, null, 2));

      // Add CSV
      const holdingsCsv = [
        Object.keys(holdings[0] || {}).join(','),
        ...holdings.map((h) => Object.values(h).join(',')),
      ].join('\n');
      zip.file('holdings.csv', holdingsCsv);

      const txCsv = [
        Object.keys(txData[0] || {}).join(','),
        ...txData.map((tx) => Object.values(tx).join(',')),
      ].join('\n');
      zip.file('transactions.csv', txCsv);

      // Generate ZIP
      const buffer = await zip.generateAsync({ type: 'uint8array' });
      const blob = new Blob([buffer], { type: 'application/zip' });

      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="portfolio-export.zip"',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('[Export API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

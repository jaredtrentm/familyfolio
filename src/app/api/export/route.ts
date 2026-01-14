import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  calculatePortfolioFromTransactions,
  formatClosedPositionsForExport,
  type Transaction as PortfolioTransaction,
} from '@/lib/portfolio-utils';

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
    const symbols = [...new Set(transactions.map((tx) => tx.symbol.toUpperCase().trim()))];
    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
    });
    const priceMap = new Map(stockCache.map((s) => [s.symbol.toUpperCase().trim(), s]));

    // Calculate holdings and closed positions using utility
    const portfolioTx: PortfolioTransaction[] = transactions.map(tx => ({
      id: tx.id,
      symbol: tx.symbol,
      type: tx.type,
      quantity: tx.quantity,
      price: tx.price,
      amount: tx.amount,
      fees: tx.fees,
      date: tx.date,
    }));

    const portfolioData = calculatePortfolioFromTransactions(portfolioTx);
    const currentHoldings = Array.from(portfolioData.currentHoldings.values());
    const closedPositions = portfolioData.closedPositions;

    const holdings = currentHoldings.map((h) => {
      const stock = priceMap.get(h.symbol);
      const currentPrice = stock?.currentPrice || h.avgCost;
      const currentValue = h.quantity * currentPrice;

      return {
        Symbol: h.symbol,
        Name: stock?.name || h.symbol,
        Shares: h.quantity,
        'Avg Cost': h.avgCost,
        'Current Price': currentPrice,
        'Cost Basis': h.costBasis,
        'Current Value': currentValue,
        'Gain/Loss (Unrealized)': currentValue - h.costBasis,
        'Gain/Loss %': ((currentValue - h.costBasis) / h.costBasis) * 100,
        Status: 'OPEN',
      };
    });

    // Format closed positions for export
    const closedPositionsData = formatClosedPositionsForExport(closedPositions);

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

      // Add holdings sheet (current positions)
      const holdingsSheet = XLSX.utils.json_to_sheet(holdings);
      XLSX.utils.book_append_sheet(workbook, holdingsSheet, 'Current Holdings');

      // Add closed positions sheet (realized gains)
      if (closedPositionsData.length > 0) {
        const closedSheet = XLSX.utils.json_to_sheet(closedPositionsData);
        XLSX.utils.book_append_sheet(workbook, closedSheet, 'Closed Positions');
      }

      // Add summary sheet
      const totalUnrealized = holdings.reduce((sum, h) => sum + (h['Gain/Loss (Unrealized)'] || 0), 0);
      const summaryData = [
        { Category: 'Current Holdings', Count: holdings.length },
        { Category: 'Closed Positions', Count: closedPositionsData.length },
        { Category: 'Total Transactions', Count: txData.length },
        { Category: '', Count: '' },
        { Category: 'Unrealized Gain/Loss', Count: totalUnrealized.toFixed(2) },
        { Category: 'Total Realized Gain/Loss', Count: portfolioData.totalRealizedGain.toFixed(2) },
        { Category: 'Realized (Long-term)', Count: portfolioData.totalRealizedGainLongTerm.toFixed(2) },
        { Category: 'Realized (Short-term)', Count: portfolioData.totalRealizedGainShortTerm.toFixed(2) },
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

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
      const totalUnrealized = totalValue - totalCost;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Portfolio Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #444; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    .summary { margin: 20px 0; background: #f9f9f9; padding: 15px; border-radius: 8px; }
    .positive { color: green; }
    .negative { color: red; }
    .section { page-break-inside: avoid; }
  </style>
</head>
<body>
  <h1>Portfolio Report</h1>
  <p>Generated: ${new Date().toLocaleDateString()}</p>

  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Current Holdings:</strong> ${holdings.length} positions</p>
    <p><strong>Total Value:</strong> $${totalValue.toFixed(2)}</p>
    <p><strong>Total Cost Basis:</strong> $${totalCost.toFixed(2)}</p>
    <p><strong>Unrealized Gain/Loss:</strong> <span class="${totalUnrealized >= 0 ? 'positive' : 'negative'}">$${totalUnrealized.toFixed(2)} (${totalCost > 0 ? ((totalUnrealized / totalCost) * 100).toFixed(2) : 0}%)</span></p>
    <hr/>
    <p><strong>Closed Positions:</strong> ${closedPositionsData.length}</p>
    <p><strong>Total Realized Gain/Loss:</strong> <span class="${portfolioData.totalRealizedGain >= 0 ? 'positive' : 'negative'}">$${portfolioData.totalRealizedGain.toFixed(2)}</span></p>
    <p><strong>&nbsp;&nbsp;- Long-term (>1 year):</strong> <span class="${portfolioData.totalRealizedGainLongTerm >= 0 ? 'positive' : 'negative'}">$${portfolioData.totalRealizedGainLongTerm.toFixed(2)}</span></p>
    <p><strong>&nbsp;&nbsp;- Short-term (<1 year):</strong> <span class="${portfolioData.totalRealizedGainShortTerm >= 0 ? 'positive' : 'negative'}">$${portfolioData.totalRealizedGainShortTerm.toFixed(2)}</span></p>
  </div>

  <div class="section">
    <h2>Current Holdings</h2>
    <table>
      <tr>
        <th>Symbol</th>
        <th>Shares</th>
        <th>Avg Cost</th>
        <th>Current Price</th>
        <th>Current Value</th>
        <th>Unrealized Gain/Loss</th>
      </tr>
      ${holdings.map((h) => `
        <tr>
          <td>${h.Symbol}</td>
          <td>${h.Shares.toFixed(4)}</td>
          <td>$${h['Avg Cost'].toFixed(2)}</td>
          <td>$${h['Current Price'].toFixed(2)}</td>
          <td>$${h['Current Value'].toFixed(2)}</td>
          <td class="${h['Gain/Loss (Unrealized)'] >= 0 ? 'positive' : 'negative'}">$${h['Gain/Loss (Unrealized)'].toFixed(2)} (${h['Gain/Loss %'].toFixed(2)}%)</td>
        </tr>
      `).join('')}
    </table>
  </div>

  ${closedPositionsData.length > 0 ? `
  <div class="section">
    <h2>Closed Positions (Realized Gains)</h2>
    <table>
      <tr>
        <th>Symbol</th>
        <th>Shares</th>
        <th>Cost Basis</th>
        <th>Proceeds</th>
        <th>Realized Gain/Loss</th>
        <th>Holding Period</th>
        <th>Tax Treatment</th>
      </tr>
      ${closedPositionsData.map((cp) => `
        <tr>
          <td>${cp.symbol}</td>
          <td>${Number(cp.sharesSold).toFixed(4)}</td>
          <td>$${Number(cp.costBasis).toFixed(2)}</td>
          <td>$${Number(cp.proceeds).toFixed(2)}</td>
          <td class="${Number(cp.realizedGain) >= 0 ? 'positive' : 'negative'}">$${Number(cp.realizedGain).toFixed(2)} (${Number(cp.realizedGainPercent).toFixed(2)}%)</td>
          <td>${cp.holdingPeriodDays} days</td>
          <td>${cp.taxTreatment}</td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}

  <div class="section">
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
  </div>
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
      zip.file('current-holdings.json', JSON.stringify(holdings, null, 2));
      zip.file('closed-positions.json', JSON.stringify(closedPositionsData, null, 2));
      zip.file('transactions.json', JSON.stringify(txData, null, 2));

      // Add summary JSON
      const totalUnrealized = holdings.reduce((sum, h) => sum + (h['Gain/Loss (Unrealized)'] || 0), 0);
      const summaryJson = {
        generatedAt: new Date().toISOString(),
        currentHoldings: {
          count: holdings.length,
          totalValue: holdings.reduce((sum, h) => sum + h['Current Value'], 0),
          totalCostBasis: holdings.reduce((sum, h) => sum + h['Cost Basis'], 0),
          unrealizedGainLoss: totalUnrealized,
        },
        closedPositions: {
          count: closedPositionsData.length,
          totalRealizedGainLoss: portfolioData.totalRealizedGain,
          longTermGains: portfolioData.totalRealizedGainLongTerm,
          shortTermGains: portfolioData.totalRealizedGainShortTerm,
        },
        totalTransactions: txData.length,
      };
      zip.file('summary.json', JSON.stringify(summaryJson, null, 2));

      // Add CSV files
      const holdingsCsv = [
        Object.keys(holdings[0] || {}).join(','),
        ...holdings.map((h) => Object.values(h).join(',')),
      ].join('\n');
      zip.file('current-holdings.csv', holdingsCsv);

      if (closedPositionsData.length > 0) {
        const closedCsv = [
          Object.keys(closedPositionsData[0] || {}).join(','),
          ...closedPositionsData.map((cp) => Object.values(cp).join(',')),
        ].join('\n');
        zip.file('closed-positions.csv', closedCsv);
      }

      const txCsv = [
        Object.keys(txData[0] || {}).join(','),
        ...txData.map((tx) => Object.values(tx).join(',')),
      ].join('\n');
      zip.file('transactions.csv', txCsv);

      // Generate ZIP as blob directly
      const blob = await zip.generateAsync({ type: 'blob' });

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

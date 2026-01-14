import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
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
      // Generate actual PDF using jsPDF
      const totalValue = holdings.reduce((sum, h) => sum + h['Current Value'], 0);
      const totalCost = holdings.reduce((sum, h) => sum + h['Cost Basis'], 0);
      const totalUnrealized = totalValue - totalCost;

      const doc = new jsPDF();
      let y = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Helper to add new page if needed
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
      };

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Portfolio Report', margin, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
      y += 15;

      // Summary Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryLines = [
        `Current Holdings: ${holdings.length} positions`,
        `Total Value: $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Total Cost Basis: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Unrealized Gain/Loss: $${totalUnrealized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalCost > 0 ? ((totalUnrealized / totalCost) * 100).toFixed(2) : 0}%)`,
        ``,
        `Closed Positions: ${closedPositionsData.length}`,
        `Total Realized Gain/Loss: $${portfolioData.totalRealizedGain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `  - Long-term (>1 year): $${portfolioData.totalRealizedGainLongTerm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `  - Short-term (<1 year): $${portfolioData.totalRealizedGainShortTerm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ];

      for (const line of summaryLines) {
        doc.text(line, margin, y);
        y += 5;
      }
      y += 10;

      // Current Holdings Table
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Current Holdings', margin, y);
      y += 8;

      // Table headers
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const holdingsCols = ['Symbol', 'Shares', 'Avg Cost', 'Price', 'Value', 'Gain/Loss'];
      const colWidths = [25, 25, 25, 25, 30, 40];
      let x = margin;
      for (let i = 0; i < holdingsCols.length; i++) {
        doc.text(holdingsCols[i], x, y);
        x += colWidths[i];
      }
      y += 5;

      // Table rows
      doc.setFont('helvetica', 'normal');
      for (const h of holdings) {
        checkPageBreak(8);
        x = margin;
        doc.text(h.Symbol, x, y);
        x += colWidths[0];
        doc.text(h.Shares.toFixed(2), x, y);
        x += colWidths[1];
        doc.text(`$${h['Avg Cost'].toFixed(2)}`, x, y);
        x += colWidths[2];
        doc.text(`$${h['Current Price'].toFixed(2)}`, x, y);
        x += colWidths[3];
        doc.text(`$${h['Current Value'].toFixed(2)}`, x, y);
        x += colWidths[4];
        const gainText = `$${h['Gain/Loss (Unrealized)'].toFixed(2)} (${h['Gain/Loss %'].toFixed(1)}%)`;
        doc.text(gainText, x, y);
        y += 5;
      }
      y += 10;

      // Closed Positions Table (if any)
      if (closedPositionsData.length > 0) {
        checkPageBreak(50);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Closed Positions (Realized Gains)', margin, y);
        y += 8;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const closedCols = ['Symbol', 'Shares', 'Cost', 'Proceeds', 'Gain/Loss', 'Tax'];
        x = margin;
        for (let i = 0; i < closedCols.length; i++) {
          doc.text(closedCols[i], x, y);
          x += colWidths[i];
        }
        y += 5;

        doc.setFont('helvetica', 'normal');
        for (const cp of closedPositionsData) {
          checkPageBreak(8);
          x = margin;
          doc.text(String(cp.symbol), x, y);
          x += colWidths[0];
          doc.text(Number(cp.sharesSold).toFixed(2), x, y);
          x += colWidths[1];
          doc.text(`$${Number(cp.costBasis).toFixed(2)}`, x, y);
          x += colWidths[2];
          doc.text(`$${Number(cp.proceeds).toFixed(2)}`, x, y);
          x += colWidths[3];
          doc.text(`$${Number(cp.realizedGain).toFixed(2)}`, x, y);
          x += colWidths[4];
          doc.text(String(cp.taxTreatment), x, y);
          y += 5;
        }
        y += 10;
      }

      // Recent Transactions
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Recent Transactions', margin, y);
      y += 8;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const txCols = ['Date', 'Type', 'Symbol', 'Qty', 'Price', 'Amount'];
      x = margin;
      for (let i = 0; i < txCols.length; i++) {
        doc.text(txCols[i], x, y);
        x += colWidths[i];
      }
      y += 5;

      doc.setFont('helvetica', 'normal');
      for (const tx of txData.slice(0, 20)) {
        checkPageBreak(8);
        x = margin;
        doc.text(tx.Date, x, y);
        x += colWidths[0];
        doc.text(tx.Type, x, y);
        x += colWidths[1];
        doc.text(tx.Symbol, x, y);
        x += colWidths[2];
        doc.text(String(tx.Quantity), x, y);
        x += colWidths[3];
        doc.text(`$${tx.Price.toFixed(2)}`, x, y);
        x += colWidths[4];
        doc.text(`$${tx.Amount.toFixed(2)}`, x, y);
        y += 5;
      }

      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="portfolio-report.pdf"',
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

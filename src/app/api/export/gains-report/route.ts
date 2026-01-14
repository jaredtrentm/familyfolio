import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface Lot {
  quantity: number;
  price: number;
  date: Date;
  symbol: string;
}

interface RealizedGainDetail {
  symbol: string;
  saleDate: Date;
  acquisitionDate: Date;
  holdingDays: number;
  isLongTerm: boolean;
  sharesSold: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const format = searchParams.get('format') || 'html';
    const locale = searchParams.get('locale') || 'en';

    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();

    // Define date range for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    // Get all transactions for the user
    const allTransactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      orderBy: { date: 'asc' },
    });

    // Calculate realized gains with lot-level detail
    const { gains, summary } = calculateDetailedRealizedGains(allTransactions, yearStart, yearEnd);

    // Get AI summary if available
    let aiSummary = null;
    if (anthropic && gains.length > 0) {
      aiSummary = await generateTaxSummary(year, gains, summary, locale);
    }

    // Generate report based on format
    if (format === 'excel') {
      return generateExcelReport(year, gains, summary, aiSummary, locale);
    } else if (format === 'pdf') {
      return generateHtmlReport(year, gains, summary, aiSummary, session.name || 'Investor', locale, true);
    } else {
      return generateHtmlReport(year, gains, summary, aiSummary, session.name || 'Investor', locale, false);
    }
  } catch (error) {
    console.error('[Gains Report API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate gains report' },
      { status: 500 }
    );
  }
}

function calculateDetailedRealizedGains(
  transactions: Array<{
    id: string;
    symbol: string;
    type: string;
    quantity: number;
    price: number;
    amount: number;
    date: Date;
  }>,
  yearStart: Date,
  yearEnd: Date
): { gains: RealizedGainDetail[]; summary: ReturnType<typeof calculateSummary> } {
  const lots = new Map<string, Lot[]>();
  const gains: RealizedGainDetail[] = [];

  for (const tx of transactions) {
    const symbol = tx.symbol.toUpperCase().trim();

    if (tx.type === 'BUY' || tx.type === 'TRANSFER_IN') {
      const symbolLots = lots.get(symbol) || [];
      symbolLots.push({
        quantity: tx.quantity,
        price: tx.price,
        date: tx.date,
        symbol,
      });
      lots.set(symbol, symbolLots);
    } else if (tx.type === 'SELL' || tx.type === 'TRANSFER_OUT') {
      const symbolLots = lots.get(symbol) || [];
      let remainingToSell = tx.quantity;
      const saleDate = tx.date;

      // Only record gains for sales within the target year
      const isInTargetYear = saleDate >= yearStart && saleDate <= yearEnd;

      while (remainingToSell > 0 && symbolLots.length > 0) {
        const lot = symbolLots[0];
        const sellFromLot = Math.min(remainingToSell, lot.quantity);

        const proceeds = sellFromLot * tx.price;
        const costBasis = sellFromLot * lot.price;
        const gain = proceeds - costBasis;
        const holdingDays = Math.floor(
          (saleDate.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (isInTargetYear) {
          gains.push({
            symbol,
            saleDate,
            acquisitionDate: lot.date,
            holdingDays,
            isLongTerm: holdingDays > 365,
            sharesSold: sellFromLot,
            proceeds,
            costBasis,
            gain,
            gainPercent: costBasis > 0 ? (gain / costBasis) * 100 : 0,
          });
        }

        lot.quantity -= sellFromLot;
        remainingToSell -= sellFromLot;

        if (lot.quantity <= 0.0001) {
          symbolLots.shift();
        }
      }

      lots.set(symbol, symbolLots);
    }
  }

  // Sort by sale date
  gains.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());

  return { gains, summary: calculateSummary(gains) };
}

function calculateSummary(gains: RealizedGainDetail[]) {
  const longTermGains = gains.filter(g => g.isLongTerm);
  const shortTermGains = gains.filter(g => !g.isLongTerm);

  return {
    totalGain: gains.reduce((sum, g) => sum + g.gain, 0),
    totalProceeds: gains.reduce((sum, g) => sum + g.proceeds, 0),
    totalCostBasis: gains.reduce((sum, g) => sum + g.costBasis, 0),
    longTermGain: longTermGains.reduce((sum, g) => sum + g.gain, 0),
    longTermProceeds: longTermGains.reduce((sum, g) => sum + g.proceeds, 0),
    longTermCostBasis: longTermGains.reduce((sum, g) => sum + g.costBasis, 0),
    shortTermGain: shortTermGains.reduce((sum, g) => sum + g.gain, 0),
    shortTermProceeds: shortTermGains.reduce((sum, g) => sum + g.proceeds, 0),
    shortTermCostBasis: shortTermGains.reduce((sum, g) => sum + g.costBasis, 0),
    totalTransactions: gains.length,
    longTermCount: longTermGains.length,
    shortTermCount: shortTermGains.length,
  };
}

async function generateTaxSummary(
  year: number,
  gains: RealizedGainDetail[],
  summary: ReturnType<typeof calculateSummary>,
  locale: string
) {
  if (!anthropic) return null;

  const language = locale === 'zh' ? 'Chinese' : 'English';

  const prompt = `You are a tax advisor providing a gains/loss summary for ${year} tax preparation. Write in ${language}.

Data:
- Total Realized Gain/Loss: $${summary.totalGain.toFixed(2)}
- Total Proceeds: $${summary.totalProceeds.toFixed(2)}
- Total Cost Basis: $${summary.totalCostBasis.toFixed(2)}

Long-term Capital Gains (held >1 year):
- Gain/Loss: $${summary.longTermGain.toFixed(2)}
- ${summary.longTermCount} transactions

Short-term Capital Gains (held <1 year):
- Gain/Loss: $${summary.shortTermGain.toFixed(2)}
- ${summary.shortTermCount} transactions

Top transactions:
${gains.slice(0, 5).map(g => `${g.symbol}: ${g.isLongTerm ? 'Long-term' : 'Short-term'} ${g.gain >= 0 ? 'gain' : 'loss'} of $${Math.abs(g.gain).toFixed(2)}`).join('\n')}

Write a professional 2-3 paragraph summary covering:
1. Overall tax implications (long-term vs short-term rates)
2. Key observations about the gains/losses
3. A reminder to consult a tax professional

Use HTML paragraph tags. Do not use emojis.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].type === 'text' ? message.content[0].text : null;
  } catch (error) {
    console.error('AI tax summary error:', error);
    return null;
  }
}

function generateExcelReport(
  year: number,
  gains: RealizedGainDetail[],
  summary: ReturnType<typeof calculateSummary>,
  aiSummary: string | null,
  locale: string
) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    { Category: 'Total Realized Gain/Loss', Amount: summary.totalGain },
    { Category: 'Total Proceeds', Amount: summary.totalProceeds },
    { Category: 'Total Cost Basis', Amount: summary.totalCostBasis },
    { Category: '', Amount: '' },
    { Category: 'Long-term Capital Gains (>1 year)', Amount: summary.longTermGain },
    { Category: 'Long-term Proceeds', Amount: summary.longTermProceeds },
    { Category: 'Long-term Cost Basis', Amount: summary.longTermCostBasis },
    { Category: 'Long-term Transactions', Amount: summary.longTermCount },
    { Category: '', Amount: '' },
    { Category: 'Short-term Capital Gains (<1 year)', Amount: summary.shortTermGain },
    { Category: 'Short-term Proceeds', Amount: summary.shortTermProceeds },
    { Category: 'Short-term Cost Basis', Amount: summary.shortTermCostBasis },
    { Category: 'Short-term Transactions', Amount: summary.shortTermCount },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Detailed gains sheet
  const gainsData = gains.map(g => ({
    Symbol: g.symbol,
    'Sale Date': g.saleDate.toISOString().split('T')[0],
    'Acquisition Date': g.acquisitionDate.toISOString().split('T')[0],
    'Holding Period (Days)': g.holdingDays,
    'Tax Treatment': g.isLongTerm ? 'Long-term' : 'Short-term',
    'Shares Sold': g.sharesSold,
    Proceeds: g.proceeds,
    'Cost Basis': g.costBasis,
    'Gain/Loss': g.gain,
    'Gain %': g.gainPercent,
  }));
  const gainsSheet = XLSX.utils.json_to_sheet(gainsData);
  XLSX.utils.book_append_sheet(workbook, gainsSheet, 'Realized Gains Detail');

  // Long-term only
  const longTermData = gains.filter(g => g.isLongTerm).map(g => ({
    Symbol: g.symbol,
    'Sale Date': g.saleDate.toISOString().split('T')[0],
    'Acquisition Date': g.acquisitionDate.toISOString().split('T')[0],
    'Holding Period (Days)': g.holdingDays,
    'Shares Sold': g.sharesSold,
    Proceeds: g.proceeds,
    'Cost Basis': g.costBasis,
    'Gain/Loss': g.gain,
  }));
  if (longTermData.length > 0) {
    const longTermSheet = XLSX.utils.json_to_sheet(longTermData);
    XLSX.utils.book_append_sheet(workbook, longTermSheet, 'Long-term Gains');
  }

  // Short-term only
  const shortTermData = gains.filter(g => !g.isLongTerm).map(g => ({
    Symbol: g.symbol,
    'Sale Date': g.saleDate.toISOString().split('T')[0],
    'Acquisition Date': g.acquisitionDate.toISOString().split('T')[0],
    'Holding Period (Days)': g.holdingDays,
    'Shares Sold': g.sharesSold,
    Proceeds: g.proceeds,
    'Cost Basis': g.costBasis,
    'Gain/Loss': g.gain,
  }));
  if (shortTermData.length > 0) {
    const shortTermSheet = XLSX.utils.json_to_sheet(shortTermData);
    XLSX.utils.book_append_sheet(workbook, shortTermSheet, 'Short-term Gains');
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="gains-report-${year}.xlsx"`,
    },
  });
}

function generateHtmlReport(
  year: number,
  gains: RealizedGainDetail[],
  summary: ReturnType<typeof calculateSummary>,
  aiSummary: string | null,
  userName: string,
  locale: string,
  isPdf: boolean
) {
  const t = getTranslations(locale);
  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  const formatCurrency = (value: number) =>
    value.toLocaleString(localeCode, { style: 'currency', currency: 'USD' });

  const formatDate = (date: Date) =>
    date.toLocaleDateString(localeCode, { year: 'numeric', month: 'short', day: 'numeric' });

  const longTermGains = gains.filter(g => g.isLongTerm);
  const shortTermGains = gains.filter(g => !g.isLongTerm);

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <title>${t.title} - ${year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
    }
    .header h1 { font-size: 28px; color: #0f172a; margin-bottom: 8px; }
    .header .subtitle { color: #64748b; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-card .label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
    .summary-card .value { font-size: 24px; font-weight: 600; }
    .summary-card.long-term { border-left: 4px solid #3b82f6; }
    .summary-card.short-term { border-left: 4px solid #f59e0b; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { font-size: 18px; margin-bottom: 16px; color: #0f172a; }
    .ai-summary { background: linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%); border-left: 4px solid #7c3aed; }
    .ai-summary p { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 500; background: #f8fafc; }
    .text-right { text-align: right; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge-long { background: #dbeafe; color: #1d4ed8; }
    .badge-short { background: #fef3c7; color: #b45309; }
    .tax-note {
      background: #fefce8;
      border: 1px solid #fef08a;
      border-radius: 8px;
      padding: 16px;
      margin-top: 24px;
      font-size: 14px;
    }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px; }
    @media print {
      body { background: white; padding: 20px; }
      .summary-grid { grid-template-columns: repeat(3, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${t.title}</h1>
      <p class="subtitle">${year} ${t.forTaxPreparation} - ${userName}</p>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">${t.totalRealizedGain}</div>
        <div class="value ${summary.totalGain >= 0 ? 'positive' : 'negative'}">
          ${summary.totalGain >= 0 ? '+' : ''}${formatCurrency(summary.totalGain)}
        </div>
      </div>
      <div class="summary-card long-term">
        <div class="label">${t.longTermGains}</div>
        <div class="value ${summary.longTermGain >= 0 ? 'positive' : 'negative'}">
          ${summary.longTermGain >= 0 ? '+' : ''}${formatCurrency(summary.longTermGain)}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${summary.longTermCount} ${t.transactions}</div>
      </div>
      <div class="summary-card short-term">
        <div class="label">${t.shortTermGains}</div>
        <div class="value ${summary.shortTermGain >= 0 ? 'positive' : 'negative'}">
          ${summary.shortTermGain >= 0 ? '+' : ''}${formatCurrency(summary.shortTermGain)}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${summary.shortTermCount} ${t.transactions}</div>
      </div>
    </div>

    ${aiSummary ? `
    <div class="section ai-summary">
      <h2>${t.aiTaxAnalysis}</h2>
      ${aiSummary}
    </div>
    ` : ''}

    <div class="tax-note">
      <strong>${t.taxNote}:</strong> ${t.taxNoteText}
    </div>

    ${longTermGains.length > 0 ? `
    <div class="section">
      <h2>${t.longTermGainsDetail} <span class="badge badge-long">${t.heldOverYear}</span></h2>
      <table>
        <thead>
          <tr>
            <th>${t.symbol}</th>
            <th>${t.saleDate}</th>
            <th>${t.acquisitionDate}</th>
            <th class="text-right">${t.holdingPeriod}</th>
            <th class="text-right">${t.shares}</th>
            <th class="text-right">${t.proceeds}</th>
            <th class="text-right">${t.costBasis}</th>
            <th class="text-right">${t.gainLoss}</th>
          </tr>
        </thead>
        <tbody>
          ${longTermGains.map(g => `
          <tr>
            <td><strong>${g.symbol}</strong></td>
            <td>${formatDate(g.saleDate)}</td>
            <td>${formatDate(g.acquisitionDate)}</td>
            <td class="text-right">${g.holdingDays} ${t.days}</td>
            <td class="text-right">${g.sharesSold.toFixed(4)}</td>
            <td class="text-right">${formatCurrency(g.proceeds)}</td>
            <td class="text-right">${formatCurrency(g.costBasis)}</td>
            <td class="text-right ${g.gain >= 0 ? 'positive' : 'negative'}">
              ${g.gain >= 0 ? '+' : ''}${formatCurrency(g.gain)}
            </td>
          </tr>
          `).join('')}
          <tr style="font-weight: 600; background: #f8fafc;">
            <td colspan="5">${t.subtotal}</td>
            <td class="text-right">${formatCurrency(summary.longTermProceeds)}</td>
            <td class="text-right">${formatCurrency(summary.longTermCostBasis)}</td>
            <td class="text-right ${summary.longTermGain >= 0 ? 'positive' : 'negative'}">
              ${summary.longTermGain >= 0 ? '+' : ''}${formatCurrency(summary.longTermGain)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    ${shortTermGains.length > 0 ? `
    <div class="section">
      <h2>${t.shortTermGainsDetail} <span class="badge badge-short">${t.heldUnderYear}</span></h2>
      <table>
        <thead>
          <tr>
            <th>${t.symbol}</th>
            <th>${t.saleDate}</th>
            <th>${t.acquisitionDate}</th>
            <th class="text-right">${t.holdingPeriod}</th>
            <th class="text-right">${t.shares}</th>
            <th class="text-right">${t.proceeds}</th>
            <th class="text-right">${t.costBasis}</th>
            <th class="text-right">${t.gainLoss}</th>
          </tr>
        </thead>
        <tbody>
          ${shortTermGains.map(g => `
          <tr>
            <td><strong>${g.symbol}</strong></td>
            <td>${formatDate(g.saleDate)}</td>
            <td>${formatDate(g.acquisitionDate)}</td>
            <td class="text-right">${g.holdingDays} ${t.days}</td>
            <td class="text-right">${g.sharesSold.toFixed(4)}</td>
            <td class="text-right">${formatCurrency(g.proceeds)}</td>
            <td class="text-right">${formatCurrency(g.costBasis)}</td>
            <td class="text-right ${g.gain >= 0 ? 'positive' : 'negative'}">
              ${g.gain >= 0 ? '+' : ''}${formatCurrency(g.gain)}
            </td>
          </tr>
          `).join('')}
          <tr style="font-weight: 600; background: #f8fafc;">
            <td colspan="5">${t.subtotal}</td>
            <td class="text-right">${formatCurrency(summary.shortTermProceeds)}</td>
            <td class="text-right">${formatCurrency(summary.shortTermCostBasis)}</td>
            <td class="text-right ${summary.shortTermGain >= 0 ? 'positive' : 'negative'}">
              ${summary.shortTermGain >= 0 ? '+' : ''}${formatCurrency(summary.shortTermGain)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    ${gains.length === 0 ? `
    <div class="section" style="text-align: center; padding: 40px;">
      <p style="color: #64748b;">${t.noRealizedGains}</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>${t.generatedBy} FamilyFolio - ${new Date().toLocaleDateString(localeCode)}</p>
      <p>${t.disclaimer}</p>
    </div>
  </div>
</body>
</html>`;

  const filename = isPdf ? `gains-report-${year}.html` : `gains-report-${year}.html`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function getTranslations(locale: string) {
  if (locale === 'zh') {
    return {
      title: '资本利得/损失报告',
      forTaxPreparation: '税务准备',
      totalRealizedGain: '已实现收益/损失总额',
      longTermGains: '长期资本利得',
      shortTermGains: '短期资本利得',
      transactions: '笔交易',
      aiTaxAnalysis: 'AI 税务分析',
      taxNote: '税务提示',
      taxNoteText: '长期资本利得（持有超过一年）通常享受较低税率。短期资本利得按普通收入税率征税。请咨询税务专业人士获取具体建议。',
      longTermGainsDetail: '长期资本利得明细',
      shortTermGainsDetail: '短期资本利得明细',
      heldOverYear: '持有超过1年',
      heldUnderYear: '持有少于1年',
      symbol: '代码',
      saleDate: '卖出日期',
      acquisitionDate: '买入日期',
      holdingPeriod: '持有天数',
      shares: '股数',
      proceeds: '卖出所得',
      costBasis: '成本基础',
      gainLoss: '收益/损失',
      days: '天',
      subtotal: '小计',
      noRealizedGains: '本年度没有已实现的收益或损失',
      generatedBy: '由以下服务生成',
      disclaimer: '本报告仅供参考。请咨询税务专业人士获取税务建议。',
    };
  }

  return {
    title: 'Capital Gains/Loss Report',
    forTaxPreparation: 'For Tax Preparation',
    totalRealizedGain: 'Total Realized Gain/Loss',
    longTermGains: 'Long-term Capital Gains',
    shortTermGains: 'Short-term Capital Gains',
    transactions: 'transactions',
    aiTaxAnalysis: 'AI Tax Analysis',
    taxNote: 'Tax Note',
    taxNoteText: 'Long-term capital gains (held over 1 year) are typically taxed at lower rates. Short-term gains are taxed as ordinary income. Consult a tax professional for specific advice.',
    longTermGainsDetail: 'Long-term Capital Gains Detail',
    shortTermGainsDetail: 'Short-term Capital Gains Detail',
    heldOverYear: 'Held >1 year',
    heldUnderYear: 'Held <1 year',
    symbol: 'Symbol',
    saleDate: 'Sale Date',
    acquisitionDate: 'Acquisition Date',
    holdingPeriod: 'Holding Period',
    shares: 'Shares',
    proceeds: 'Proceeds',
    costBasis: 'Cost Basis',
    gainLoss: 'Gain/Loss',
    days: 'days',
    subtotal: 'Subtotal',
    noRealizedGains: 'No realized gains or losses for this year',
    generatedBy: 'Generated by',
    disclaimer: 'This report is for informational purposes only. Consult a tax professional for tax advice.',
  };
}

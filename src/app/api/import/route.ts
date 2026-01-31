import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { checkAndFlagDuplicates } from '@/lib/duplicate-detection';

// Parse date from various formats including Excel serial numbers
function parseDate(value: unknown): Date {
  if (!value) return new Date();

  // If it's already a Date
  if (value instanceof Date) return value;

  const str = String(value).trim();
  const currentYear = new Date().getFullYear();

  // Check if it's an Excel serial number (a number between 1 and 100000)
  const num = Number(str);
  if (!isNaN(num) && num > 0 && num < 100000) {
    // Excel serial date: days since 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
  }

  // Handle dates without year like "Jan 7" or "January 7" or "1/7"
  const monthDayPatterns = [
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})$/i,
    /^(\d{1,2})\/(\d{1,2})$/,
  ];

  for (const pattern of monthDayPatterns) {
    const match = str.match(pattern);
    if (match) {
      // Add current year and try parsing
      const withYear = `${str}, ${currentYear}`;
      const parsed = new Date(withYear);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  // Try parsing as ISO date or common formats
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    return parsed;
  }

  // Default to today if parsing fails
  return new Date();
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ParsedTransaction {
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  symbol: string;
  description?: string;
  quantity: number;
  price: number;
  amount: number;
  fees?: number;
}

async function parseCSV(content: string): Promise<ParsedTransaction[]> {
  const workbook = XLSX.read(content, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

  const transactions: ParsedTransaction[] = [];

  for (const row of data) {
    // Try to map common column names
    const date = row['Date'] || row['date'] || row['Trade Date'] || row['Transaction Date'];
    const type = row['Type'] || row['type'] || row['Action'] || row['Transaction Type'];
    const symbol = row['Symbol'] || row['symbol'] || row['Ticker'] || row['Stock'];
    const quantity = row['Quantity'] || row['quantity'] || row['Shares'] || row['Qty'];
    const price = row['Price'] || row['price'] || row['Unit Price'];
    const amount = row['Amount'] || row['amount'] || row['Total'] || row['Value'];
    const fees = row['Fees'] || row['fees'] || row['Commission'] || 0;
    const description = row['Description'] || row['description'] || '';

    if (date && symbol && quantity) {
      const typeStr = String(type || 'BUY').toUpperCase();
      const mappedType = mapTransactionType(typeStr);

      transactions.push({
        date: String(date),
        type: mappedType,
        symbol: String(symbol).toUpperCase(),
        description: String(description),
        quantity: Number(quantity) || 0,
        price: Number(price) || 0,
        amount: Number(amount) || Number(quantity) * Number(price),
        fees: Number(fees) || 0,
      });
    }
  }

  return transactions;
}

function mapTransactionType(type: string): ParsedTransaction['type'] {
  const typeMap: Record<string, ParsedTransaction['type']> = {
    BUY: 'BUY',
    BOUGHT: 'BUY',
    PURCHASE: 'BUY',
    SELL: 'SELL',
    SOLD: 'SELL',
    SALE: 'SELL',
    DIVIDEND: 'DIVIDEND',
    DIV: 'DIVIDEND',
  };

  return typeMap[type] || 'BUY';
}

// Map file extension to correct MIME type for Claude API
function getImageMimeType(fileType: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  const mimeMap: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeMap[fileType] || null;
}

// Extract text content from PDF
async function extractPdfText(_buffer: Buffer): Promise<string> {
  // PDF parsing is not available - requires pdf-parse package to be installed
  console.warn('PDF parsing not available - pdf-parse package not installed');
  return '';
}

async function parseWithAI(content: string, fileType: string): Promise<ParsedTransaction[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  const prompt = `Parse the following ${fileType} data into stock transactions.
Extract each transaction with these fields:
- date (ISO format YYYY-MM-DD)
- type (BUY, SELL, or DIVIDEND only)
- symbol (stock ticker, uppercase)
- description (optional)
- quantity (number of shares)
- price (price per share)
- amount (total value)
- fees (optional, default 0)

Data to parse:
${content.slice(0, 10000)}

Return ONLY a valid JSON array of transactions, nothing else.
Example: [{"date":"2024-01-15","type":"BUY","symbol":"AAPL","quantity":10,"price":185.50,"amount":1855.00}]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI parsing error:', error);
  }

  return [];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountId = formData.get('accountId') as string | null;
    const claimImmediately = formData.get('claimImmediately') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const filename = file.name;
    const fileType = filename.split('.').pop()?.toLowerCase() || 'unknown';

    // Create upload record
    const upload = await prisma.dataUpload.create({
      data: {
        userId: session.id,
        accountId: accountId || null,
        filename,
        fileType,
        status: 'processing',
      },
    });

    try {
      let transactions: ParsedTransaction[] = [];

      if (fileType === 'csv') {
        const content = await file.text();
        transactions = await parseCSV(content);

        // If CSV parsing didn't work well, try AI
        if (transactions.length === 0) {
          transactions = await parseWithAI(content, 'CSV');
        }
      } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType)) {
        // For images, use AI to extract data
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = getImageMimeType(fileType);

        if (!mimeType) {
          throw new Error(`Unsupported image format: ${fileType}. Supported formats: jpg, jpeg, png, gif, webp`);
        }

        if (process.env.ANTHROPIC_API_KEY) {
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mimeType,
                      data: base64,
                    },
                  },
                  {
                    type: 'text',
                    text: `Extract all stock transactions from this brokerage statement image.
Return a JSON array with each transaction having:
- date (ISO format YYYY-MM-DD) - IMPORTANT: If the year is not visible in the image, use ${new Date().getFullYear()} as the year
- type (BUY, SELL, or DIVIDEND only)
- symbol (stock ticker, uppercase)
- quantity (number of shares)
- price (price per share)
- amount (total value)

Today's date is ${new Date().toISOString().split('T')[0]}. Use this year (${new Date().getFullYear()}) for any dates that don't show a year.

Return ONLY the JSON array, nothing else. If no transactions found, return [].`,
                  },
                ],
              },
            ],
          });

          const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);

          if (jsonMatch) {
            try {
              transactions = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
              console.error('Failed to parse AI response:', parseErr);
            }
          }
        }
      } else if (fileType === 'pdf') {
        // Parse PDF and extract text
        const arrayBuffer = await file.arrayBuffer();
        const pdfText = await extractPdfText(Buffer.from(arrayBuffer));

        if (pdfText && pdfText.trim().length > 0) {
          // Use AI to parse the extracted text
          transactions = await parseWithAI(pdfText, 'PDF brokerage statement');
        } else {
          throw new Error('Could not extract text from PDF. The PDF may be image-based - please try uploading as an image instead.');
        }
      }

      // Save transactions to database and check for duplicates
      if (transactions.length > 0) {
        let duplicateCount = 0;

        for (const tx of transactions) {
          const txDate = parseDate(tx.date);

          // Create the transaction
          const created = await prisma.transaction.create({
            data: {
              dataUploadId: upload.id,
              accountId: accountId || null,
              claimedById: claimImmediately ? session.id : null,
              date: txDate,
              type: tx.type,
              symbol: tx.symbol,
              description: tx.description || null,
              quantity: tx.quantity,
              price: tx.price,
              amount: tx.amount,
              fees: tx.fees || 0,
            },
          });

          // Check for duplicates if not claimed immediately
          if (!claimImmediately) {
            const result = await checkAndFlagDuplicates(created.id, {
              date: txDate,
              symbol: tx.symbol,
              type: tx.type,
              quantity: tx.quantity,
              price: tx.price,
            });

            if (result.isDuplicate) {
              duplicateCount++;
            }
          }
        }

        if (duplicateCount > 0) {
          console.log(`[Import API] Found ${duplicateCount} potential duplicates`);
        }
      }

      // Update upload status
      await prisma.dataUpload.update({
        where: { id: upload.id },
        data: {
          status: 'completed',
          rawData: JSON.stringify(transactions),
        },
      });

      return NextResponse.json({
        success: true,
        uploadId: upload.id,
        transactionCount: transactions.length,
        claimedImmediately: claimImmediately,
      });
    } catch (parseError) {
      // Update upload with error
      await prisma.dataUpload.update({
        where: { id: upload.id },
        data: {
          status: 'failed',
          errorMessage: parseError instanceof Error ? parseError.message : 'Parsing failed',
        },
      });

      throw parseError;
    }
  } catch (error) {
    console.error('[Import API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import file' },
      { status: 500 }
    );
  }
}

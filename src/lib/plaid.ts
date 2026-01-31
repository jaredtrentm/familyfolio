import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID!;
const PLAID_SECRET = process.env.PLAID_SECRET!;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export const PLAID_PRODUCTS: Products[] = [Products.Investments];
export const PLAID_COUNTRY_CODES: CountryCode[] = [CountryCode.Us];

// Create a link token for the Plaid Link flow
export async function createLinkToken(userId: string, accessToken?: string) {
  const request = {
    user: {
      client_user_id: userId,
    },
    client_name: 'FamilyFolio',
    products: PLAID_PRODUCTS,
    country_codes: PLAID_COUNTRY_CODES,
    language: 'en',
    ...(accessToken && { access_token: accessToken }),
  };

  const response = await plaidClient.linkTokenCreate(request);
  return response.data;
}

// Exchange public token for access token
export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return response.data;
}

// Get item details
export async function getItem(accessToken: string) {
  const response = await plaidClient.itemGet({
    access_token: accessToken,
  });
  return response.data;
}

// Get accounts for an item
export async function getAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });
  return response.data;
}

// Get investment holdings
export async function getInvestmentHoldings(accessToken: string) {
  const response = await plaidClient.investmentsHoldingsGet({
    access_token: accessToken,
  });
  return response.data;
}

// Get investment transactions
export async function getInvestmentTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
) {
  const response = await plaidClient.investmentsTransactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });
  return response.data;
}

// Remove an item (disconnect)
export async function removeItem(accessToken: string) {
  const response = await plaidClient.itemRemove({
    access_token: accessToken,
  });
  return response.data;
}

// Get institution details
export async function getInstitution(institutionId: string) {
  const response = await plaidClient.institutionsGetById({
    institution_id: institutionId,
    country_codes: PLAID_COUNTRY_CODES,
  });
  return response.data;
}

// Simple encryption for access tokens (in production, use proper encryption)
// This is a basic implementation - consider using a proper encryption library
export function encryptToken(token: string): string {
  // In production, use proper encryption with a secret key from env
  // For now, we'll use base64 encoding as a placeholder
  return Buffer.from(token).toString('base64');
}

export function decryptToken(encryptedToken: string): string {
  // In production, use proper decryption
  return Buffer.from(encryptedToken, 'base64').toString('utf-8');
}

# FamilyFolio Improvement Plan

Based on user feedback, here are the recommended improvements organized by priority and effort.

---

## 1. Authentication Improvements

### Current State
- Password validation: minimum 6 characters only
- No confirmation password field
- No password reset functionality
- Custom JWT-based auth with bcrypt

### Feedback
> "Unconventional to not have enforced password regular expressions or a confirmation password field. Password reset would be helpful. Consider Auth0 or similar."

### Recommendations

#### 1.1 Add Password Strength Requirements (Medium Priority)
**Files to modify:**
- `src/app/api/auth/register/route.ts`
- `src/app/[locale]/(auth)/register/page.tsx` (add client-side validation UI)

**Changes:**
- Add regex validation requiring: 8+ chars, uppercase, lowercase, number, special character
- Show password strength indicator on registration form
- Display requirements checklist that updates as user types

#### 1.2 Add Confirm Password Field (High Priority)
**Files to modify:**
- `src/app/[locale]/(auth)/register/page.tsx`

**Changes:**
- Add "Confirm Password" input field
- Validate match before form submission
- Show inline error if passwords don't match

#### 1.3 Add Password Reset Flow (Medium Priority)
**New files needed:**
- `src/app/api/auth/forgot-password/route.ts` - Generate reset token
- `src/app/api/auth/reset-password/route.ts` - Validate token and update password
- `src/app/[locale]/(auth)/forgot-password/page.tsx` - Request reset form
- `src/app/[locale]/(auth)/reset-password/page.tsx` - New password form

**Database changes:**
- Add `passwordResetToken` and `passwordResetExpires` fields to User model

**Implementation:**
- Generate secure random token, store hashed version with expiry
- Send email via configured email service (Resend, SendGrid, etc.)
- Token valid for 1 hour
- Invalidate token after use

#### 1.4 Auth Provider Integration (Low Priority - Future Enhancement)
**Recommendation:** Keep current auth for simplicity. Auth0/social login adds complexity and cost. Current implementation is secure (bcrypt, JWT, HTTP-only cookies). Consider only if users specifically request social login.

---

## 2. Dashboard Equity Pie Chart

### Current State
- AllocationChart shows **sector allocation** (Technology, Healthcare, etc.)
- AssetTypeChart shows **asset classes** (Stocks, Bonds, Cash, etc.)
- No chart showing **individual equity holdings**

### Feedback
> "A pie chart of the equity holdings could be nice."

### Recommendation

#### 2.1 Add Holdings Pie Chart (Medium Priority)
**Files to modify:**
- `src/components/dashboard/DashboardClient.tsx`

**New file:**
- `src/components/charts/HoldingsPieChart.tsx`

**Changes:**
- Create new pie chart component showing individual holdings by value
- Display symbol names with percentage and dollar amounts
- Group holdings <3% into "Other" to avoid clutter
- Add to dashboard grid alongside existing charts

---

## 3. Historical Performance Data Issues

### Current State
- `effectiveStartDate` is set to the later of: first transaction date OR selected period start
- Historical prices fetched from Yahoo Finance
- Falls back to current price or average cost if historical data unavailable

### Feedback
> "Historical performance didn't go back to early dates from years ago. Portfolio value flatlined and didn't account for equity valuation changes."

### Root Causes Identified
1. `effectiveStartDate` logic truncates data if first transaction is after period start
2. Yahoo Finance may not return historical data for some symbols/date ranges
3. When historical price is 0, falls back to cost basis (causing "flatline")
4. MAX period uses yearly intervals - too sparse for accuracy

### Recommendations

#### 3.1 Fix Date Range Handling (High Priority)
**File:** `src/app/api/portfolio/history/route.ts`

**Changes:**
- Always start from first transaction date for MAX period
- For other periods, show data from max(periodStart, firstTxDate) but label appropriately
- Add data point at exact first transaction date

#### 3.2 Improve Historical Price Fetching (High Priority)
**File:** `src/app/api/portfolio/history/route.ts`

**Changes:**
- Fetch historical data in parallel (Promise.all) for better performance
- Extend date range buffer when fetching (start 7 days earlier)
- Better interpolation: if no price on exact date, find closest available date before/after
- Log warnings when falling back to estimated prices
- Consider caching historical prices in database to avoid repeated API calls

#### 3.3 Fix MAX Period Granularity (Medium Priority)
**File:** `src/app/api/portfolio/history/route.ts`

**Changes:**
- For MAX period, use monthly intervals instead of yearly
- Increase data points for long periods to show meaningful trends
- Current: yearly intervals create large gaps
- Proposed: monthly intervals for 5+ years, quarterly for 10+ years

#### 3.4 Add Visual Indicator for Estimated Data (Low Priority)
**File:** `src/components/charts/PerformanceChart.tsx`

**Changes:**
- Different line style (dashed) for periods with estimated prices
- Tooltip shows "Estimated" vs "Market" price source

---

## 4. Gains Tab Enhancements

### Current State
- Unrealized: Shows current holdings with gain/loss
- Realized: Shows individual SELL transactions
- Closed Positions: Shows aggregated by symbol with tax treatment
- No per-lot detail view
- No annualized returns

### Feedback
> "I like to look at gains per lot. Also year or annualized performance could be added."

### Recommendations

#### 4.1 Add Per-Lot Gains View (Medium Priority)
**Files to modify:**
- `src/app/[locale]/(protected)/gains/page.tsx` - Add lot data to props
- `src/app/[locale]/(protected)/gains/GainsClient.tsx` - Add new tab/view
- `src/lib/portfolio-utils.ts` - Add lot-level calculation function

**Changes:**
- New "Tax Lots" tab showing each purchase lot with:
  - Acquisition date
  - Quantity remaining
  - Cost basis per share
  - Current value
  - Unrealized gain/loss
  - Long-term vs short-term status
  - Days until long-term (if short-term)
- Helps with tax-loss harvesting decisions

#### 4.2 Add Annualized Returns (Medium Priority)
**Files to modify:**
- `src/app/[locale]/(protected)/gains/page.tsx`
- `src/app/[locale]/(protected)/gains/GainsClient.tsx`

**Changes:**
- Add new summary cards showing:
  - YTD Return %
  - 1-Year Annualized Return %
  - Since Inception Annualized Return (CAGR)
- Formula: `CAGR = (EndValue/StartValue)^(1/years) - 1`
- Calculate based on cost basis and current value with time weighting

---

## 5. Transaction Filter UX Issue

### Current State
- Filter persists when adding transaction
- New transaction may not appear if filtered out
- No visual feedback about active filters affecting view

### Feedback
> "Added a transaction while I had a filter set, didn't see it, added it again. Then realized what happened."

### Recommendations

#### 5.1 Clear Filter After Adding Transaction (High Priority)
**File:** `src/app/[locale]/(protected)/transactions/TransactionsClient.tsx`

**Changes:**
- After successful transaction add, reset filters (`setSearch('')`, `setTypeFilter(null)`)
- Show success toast: "Transaction added successfully"

#### 5.2 Add Active Filter Warning (High Priority)
**File:** `src/app/[locale]/(protected)/transactions/TransactionsClient.tsx`

**Changes:**
- When form opens with active filters, show warning banner:
  "Note: You have filters active. New transaction may not appear in current view."
- Add button to "Clear filters" in the warning
- Highlight active filters more prominently (badge count, different color)

#### 5.3 Highlight Newly Added Transaction (Medium Priority)
**File:** `src/app/[locale]/(protected)/transactions/TransactionsClient.tsx`

**Changes:**
- After adding, temporarily highlight the new row (flash animation)
- Scroll to the new transaction in the list
- If filtered out, show notification: "Transaction added but hidden by current filter"

---

## 6. Console Error Messages

### Current State
- Various console.error calls throughout codebase
- Some validation errors may surface in console for optional fields

### Feedback
> "Got some console error messages around fields that I hadn't entered data for."

### Likely Causes
1. Optional fields being validated as if required
2. Number parsing on empty strings
3. Date parsing issues
4. API calls with undefined/null values

### Recommendations

#### 6.1 Audit and Fix Form Validation (High Priority)
**Files to audit:**
- `src/app/api/transactions/route.ts`
- `src/app/api/import/route.ts`
- `src/app/api/accounts/route.ts`
- All form components

**Changes:**
- Ensure optional fields (`fees`, `description`, etc.) use proper defaults
- Convert empty strings to null/0 before validation
- Add proper type coercion: `Number(fees) || 0` instead of `Number(fees)`
- Wrap optional field access in null checks

#### 6.2 Improve Client-Side Error Handling (Medium Priority)
**Files:** All client components with fetch calls

**Changes:**
- Catch and handle errors gracefully instead of logging to console
- Show user-friendly error messages in UI
- Only log to console in development mode

#### 6.3 Add Input Sanitization (Medium Priority)
**Files:** Form components and API routes

**Changes:**
- Trim whitespace from text inputs
- Handle edge cases: negative numbers, extremely large values
- Validate date formats before parsing

---

## Implementation Priority Summary

### Phase 1 - Quick Wins (High Impact, Low Effort)
1. Add confirm password field
2. Clear filters after adding transaction
3. Add active filter warning
4. Fix optional field validation errors

### Phase 2 - Core Improvements (High Impact, Medium Effort)
1. Fix historical data date range handling
2. Improve historical price fetching reliability
3. Add holdings pie chart
4. Add password strength requirements

### Phase 3 - Enhanced Features (Medium Impact, Medium Effort)
1. Add per-lot gains view
2. Add annualized returns
3. Fix MAX period granularity
4. Add password reset flow

### Phase 4 - Polish (Lower Priority)
1. Visual indicator for estimated data
2. Highlight newly added transactions
3. Auth provider integration (if requested)

---

## Technical Notes

### Dependencies to Add (if implementing password reset)
- `resend` or `@sendgrid/mail` for email sending
- `crypto` (built-in Node.js) for token generation

### Database Migration (if implementing password reset)
```prisma
model User {
  // ... existing fields
  passwordResetToken   String?
  passwordResetExpires DateTime?
}
```

### Testing Recommendations
- Add unit tests for password validation regex
- Add integration tests for password reset flow
- Test historical data with various date ranges
- Test transaction form with filters active

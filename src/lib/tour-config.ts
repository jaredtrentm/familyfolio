import type { DriveStep, Config } from "driver.js";

export const TOUR_IDS = {
  DASHBOARD: "dashboard-tour",
  IMPORT: "import-tour",
  CLAIMING: "claiming-tour",
  PORTFOLIO: "portfolio-tour",
} as const;

export type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS];

export const driverConfig: Config = {
  showProgress: true,
  showButtons: ["next", "previous", "close"],
  steps: [],
  animate: true,
  overlayColor: "rgba(0, 0, 0, 0.75)",
  stagePadding: 10,
  stageRadius: 8,
  popoverClass: "familyfolio-tour-popover",
  progressText: "{{current}} of {{total}}",
  nextBtnText: "Next →",
  prevBtnText: "← Back",
  doneBtnText: "Done",
};

export const dashboardTourSteps: DriveStep[] = [
  {
    element: '[data-tour="portfolio-summary"]',
    popover: {
      title: "Portfolio Summary",
      description:
        "Track your total holdings value, gains/losses, and overall allocation at a glance.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="holdings-table"]',
    popover: {
      title: "Holdings Table",
      description:
        "View detailed information for each position including current value, cost basis, and performance metrics.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="allocation-chart"]',
    popover: {
      title: "Sector Allocation",
      description:
        "See how your portfolio is distributed across different sectors and industries.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="asset-type-chart"]',
    popover: {
      title: "Asset Type Distribution",
      description:
        "Understand your asset allocation by type - stocks, bonds, ETFs, and more.",
      side: "left",
      align: "center",
    },
  },
];

export const importTourSteps: DriveStep[] = [
  {
    element: '[data-tour="import-dropzone"]',
    popover: {
      title: "Import Transactions",
      description:
        "Drag and drop CSV files from your bank or brokerage, or upload PDF statements and images for AI parsing.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="account-select"]',
    popover: {
      title: "Select Account",
      description:
        "Choose or create an account to organize your imported transactions.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="claim-immediately"]',
    popover: {
      title: "Claim Immediately",
      description:
        "Enable this to automatically claim imported transactions for your portfolio. Otherwise, they'll go to the unclaimed queue.",
      side: "bottom",
      align: "center",
    },
  },
];

export const claimingTourSteps: DriveStep[] = [
  {
    element: '[data-tour="unclaimed-list"]',
    popover: {
      title: "Unclaimed Transactions",
      description:
        "These are transactions shared by family members waiting to be claimed. Review and claim the ones that belong to you.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="duplicate-flag"]',
    popover: {
      title: "Duplicate Detection",
      description:
        "Potential duplicates are flagged to help you identify matching transactions and avoid double-counting.",
      side: "right",
      align: "center",
    },
  },
];

export const portfolioTourSteps: DriveStep[] = [
  {
    element: '[data-tour="performance-chart"]',
    popover: {
      title: "Performance Over Time",
      description:
        "Track your portfolio's historical performance with this interactive chart.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="accounts-manager"]',
    popover: {
      title: "Account Management",
      description:
        "Manage your investment accounts, track cash balances, and organize your holdings.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="holdings-pie"]',
    popover: {
      title: "Holdings Breakdown",
      description:
        "Visualize your top holdings and their relative sizes in your portfolio.",
      side: "right",
      align: "center",
    },
  },
];

export const tourSteps: Record<TourId, DriveStep[]> = {
  [TOUR_IDS.DASHBOARD]: dashboardTourSteps,
  [TOUR_IDS.IMPORT]: importTourSteps,
  [TOUR_IDS.CLAIMING]: claimingTourSteps,
  [TOUR_IDS.PORTFOLIO]: portfolioTourSteps,
};

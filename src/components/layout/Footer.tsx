"use client";

import { ExternalLink, AlertTriangle } from "lucide-react";

const OTHER_APPS = [
  {
    name: "NextNest",
    description: "Life Decisions",
    url: "https://nextnest-production-9abe.up.railway.app",
  },
  {
    name: "ThesisTracks",
    description: "Investment Research",
    url: "https://convictiqn-production.up.railway.app",
  },
  {
    name: "PropertyPro",
    description: "Real Estate Analysis",
    url: "https://propertypro-production-1490.up.railway.app",
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Demo Disclaimer Banner */}
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Demo App:</span> This is a beta version for testing and demonstration purposes only.
              Not intended for production use. Data may be reset. Not financial advice.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mb-4">
          For informational purposes only. Not financial advice. &copy; {new Date().getFullYear()} FamilyFolio
        </p>

        <div className="border-t border-border pt-4">
          <p className="text-center text-xs text-muted-foreground mb-2">
            Also by Jared
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {OTHER_APPS.map((app) => (
              <a
                key={app.name}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="font-medium">{app.name}</span>
                <span className="hidden sm:inline">- {app.description}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";

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
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-muted-foreground mb-4">
          {t('disclaimer')} &copy; {new Date().getFullYear()} FamilyFolio
        </p>

        <div className="border-t border-border pt-4">
          <p className="text-center text-xs text-muted-foreground mb-2">
            {t('alsoByJared')}
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

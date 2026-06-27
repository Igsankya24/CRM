"use client";

import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { BrandingSettingsCard } from "./branding-settings";

/**
 * Appearance panel — theme mode + dynamic branding controls.
 * Click a theme card → applies immediately via next-themes.
 */
export function AppearancePanel() {
  const { themeMode, setThemeMode } = useTheme();

  return (
    <section className="space-y-8">
      {/* Theme Mode Selector */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Theme Mode</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose whether the application should render in light, dark, or follow your system theme preference.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { id: "light", name: "Light Mode", icon: Sun, desc: "Bright and clean workspace view." },
            { id: "dark", name: "Dark Mode", icon: Moon, desc: "Classic low-light developer theme." },
            { id: "system", name: "System Default", icon: Laptop, desc: "Match your operating system settings." }
          ].map((mode) => {
            const Icon = mode.icon;
            const isActive = themeMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setThemeMode(mode.id)}
                aria-pressed={isActive}
                aria-label={`Use ${mode.name}`}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-5 text-center transition-all hover:bg-muted/30 cursor-pointer",
                  isActive
                    ? "border-primary/60 ring-2 ring-primary/45 text-foreground font-semibold"
                    : "border-border text-muted-foreground"
                )}
              >
                <Icon className={cn("h-6 w-6", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">{mode.name}</span>
                <span className="text-xs text-muted-foreground">{mode.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Branding settings */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Custom Branding</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalize the workspace branding with a custom name, logo, and browser favicon.
          </p>
        </div>
        <BrandingSettingsCard />
      </div>
    </section>
  );
}

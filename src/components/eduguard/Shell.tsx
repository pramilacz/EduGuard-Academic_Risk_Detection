import { useState, type FormEvent, type ReactNode } from "react";
import { Menu, Moon, PanelLeftOpen, Search, Sun } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { Sidebar } from "./Sidebar";
import { useTheme } from "@/components/theme-provider";

export function Shell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const submitStudentSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const student = studentSearch.trim();

    if (!student) {
      return;
    }

    void navigate({
      to: "/student-profile",
      search: { student },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {desktopSidebarOpen && (
          <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">
            <Sidebar onClose={() => setDesktopSidebarOpen(false)} />
          </aside>
        )}

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 h-full">
              <Sidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground lg:hidden"
            >
              <Menu className="size-4" />
            </button>

            {!desktopSidebarOpen && (
              <button
                onClick={() => setDesktopSidebarOpen(true)}
                aria-label="Open sidebar"
                className="hidden size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground lg:flex"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            )}

            <form
              onSubmit={submitStudentSearch}
              className="relative hidden max-w-[340px] flex-1 items-center sm:flex"
            >
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Open student by ID…"
                aria-label="Open student by ID"
                className="h-10 w-full rounded-full border border-border bg-secondary/70 pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-ring/60"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggle}
                aria-label="Toggle theme"
                className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <span
                aria-label="EduGuard"
                className="flex size-9 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
              >
                EG
              </span>
            </div>
          </header>

          <main className="px-4 pb-10 pt-6 sm:px-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">{title}</h1>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Early Academic Risk Detection &amp; Learning Analytics
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

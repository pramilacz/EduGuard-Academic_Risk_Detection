import { Link, useRouterState } from "@tanstack/react-router";
import {
  BrainCircuit,
  GraduationCap,
  LayoutDashboard,
  ListFilter,
  PanelLeftClose,
  ShieldCheck,
  UserSearch,
} from "lucide-react";

const nav = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Student Risk List", url: "/risk-list", icon: ListFilter },
  { title: "Student Profile", url: "/student-profile", icon: UserSearch },
  { title: "Explainable AI", url: "/explainable-ai", icon: BrainCircuit },
  { title: "Model Information", url: "/model-information", icon: ShieldCheck },
] as const;

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full w-[270px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-[95px] items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[12px] bg-primary text-primary-foreground">
            <GraduationCap className="size-[22px]" />
          </span>
          <span className="text-[22px] font-bold tracking-tight text-sidebar-foreground">
            EduGuard
          </span>
        </Link>

        <button
          onClick={onClose}
          aria-label="Collapse sidebar"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pt-6">
        {nav.map((item) => {
          const active = pathname === item.url;

          return (
            <Link
              key={item.url}
              to={item.url}
              onClick={onClose}
              className={[
                "flex items-center gap-3 rounded-[10px] px-4 py-3 text-[15px] font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              ].join(" ")}
            >
              <item.icon
                className={["size-[18px]", active ? "text-primary" : ""].join(" ")}
                strokeWidth={active ? 2.3 : 1.9}
              />
              {item.title}
            </Link>
          );
        })}

        <div className="mt-8 space-y-3 border-t border-sidebar-border pt-6">
          <Meta label="Final Model" value="XGBoost" />
          <Meta label="Prediction Window" value="First 8 Weeks" />
        </div>
      </nav>

      <div className="p-3">
        <div className="rounded-[14px] bg-primary p-4 text-primary-foreground shadow-soft">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary-foreground/15">
            <ShieldCheck className="size-4" />
          </span>
          <p className="mt-3 text-[13.5px] font-semibold">Decision Support System</p>
          <p className="mt-1 text-[11.5px] leading-relaxed opacity-80">
            Supports academic judgement — never the sole basis for a decision.
          </p>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold text-sidebar-foreground">{value}</p>
    </div>
  );
}
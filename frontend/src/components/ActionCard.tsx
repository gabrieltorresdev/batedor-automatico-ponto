import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface ActionCardProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function ActionCard({
  icon,
  label,
  onClick,
  disabled = false
}: ActionCardProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-24 flex flex-col items-center justify-center gap-2 p-2 transition-all",
        "border shadow-sm hover:shadow-md hover:scale-[.98] active:scale-[0.98]",
        "bg-card/50 hover:bg-card"
      )}
      variant="outline"
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10">
        {icon}
      </div>
      <div className="text-xs font-medium text-center line-clamp-2">
        {label}
      </div>
    </Button>
  );
}

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";
import { Loader2 } from "lucide-react";

interface StatusCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  variant?: "default" | "warning" | "error" | "success";
  isRetrying?: boolean;
  retryAttempt?: number;
  maxRetryAttempts?: number;
}

export default function StatusCard({ 
  icon, 
  title, 
  children, 
  variant = "default",
  isRetrying = false,
  retryAttempt = 0,
  maxRetryAttempts = 0
}: StatusCardProps) {
  return (
    <div className={cn(
      "flex items-center transition-all duration-200 rounded-md shadow-none h-12 px-2",
      variant === "warning" && "bg-yellow-500/5",
      variant === "error" && "bg-red-500/5",
      variant === "success" && "bg-green-500/5",
    )}>
      <div className="flex items-center flex-1 gap-3">
        <div className={cn(
          "flex-shrink-0",
          variant === "warning" && "text-yellow-500",
          variant === "error" && "text-red-500",
          variant === "success" && "text-green-500",
          variant === "default" && "text-muted-foreground"
        )}>
          {isRetrying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            icon
          )}
        </div>
        <div className="flex-1 flex justify-between items-center" >
          <div className="flex flex-col">
            <h3 className={cn(
              "text-xs font-medium text-start line-clamp-2",
              variant === "warning" && "text-yellow-500",
              variant === "error" && "text-red-500",
              variant === "success" && "text-green-500"
            )}>
              {title}
            </h3>
            {isRetrying && retryAttempt > 0 && (
              <span className="text-[10px] text-muted-foreground text-start">
                Tentativa {retryAttempt}/{maxRetryAttempts}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

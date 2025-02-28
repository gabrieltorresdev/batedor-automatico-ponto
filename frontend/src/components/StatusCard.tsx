import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";

interface StatusCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  variant?: "default" | "warning" | "error" | "success";
}

export default function StatusCard({ 
  icon, 
  title, 
  children, 
  variant = "default" 
}: StatusCardProps) {
  return (
    <div className={cn(
      "flex items-center transition-all duration-200 rounded-md shadow-none h-10 px-2",
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
          {icon}
        </div>
        <div className="flex-1 flex justify-between items-center" >
          <h3 className={cn(
            "text-xs font-medium text-start",
            variant === "warning" && "text-yellow-500",
            variant === "error" && "text-red-500",
            variant === "success" && "text-green-500"
          )}>
            {title}
          </h3>
          <div className="text-xs text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

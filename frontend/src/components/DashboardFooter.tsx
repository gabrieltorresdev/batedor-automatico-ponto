interface DashboardFooterProps {
  className?: string;
}

export const DashboardFooter = ({
  className = '',
}: DashboardFooterProps) => {
  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 w-full bg-background border-t border-border/50 shadow-md transition-transform duration-300 ease-in-out z-10 ${className}`} 
    >
      <div className="p-3 text-xs text-center text-muted-foreground">
        BatPonto Fintools © {new Date().getFullYear()}
      </div>
    </div>
  );
}; 
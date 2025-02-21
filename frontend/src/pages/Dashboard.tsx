import { useMainMenu } from "@/hooks/useMainMenu";
import { Loader2, Slack, Menu, Clock, AlertCircle, ExternalLink, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSlackStore } from "@/store/slackStore";
import { useNotifyStore } from "@/store/notifyStore";
import { useNavigate } from "react-router-dom";
import { MainMenuActionType } from "@/types/ponto";
import StatusDetails from "@/components/StatusDetails";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/authStore";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function ActionSkeleton() {
  return (
    <Button
      disabled
      className="h-12 w-full flex items-center gap-2"
      variant="outline"
    >
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-24" />
    </Button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const addNotification = useNotifyStore((state) => state.addNotification);
  const { isBlocked } = useAuthStore();
  const {
    actions,
    isLoading: isMenuLoading,
    executeAction,
    refreshActions,
  } = useMainMenu();
  const {
    isAuthenticated: isSlackAuthenticated,
    configureSlack,
    isLoading: isSlackLoading,
  } = useSlackStore();

  async function handleConfigureSlack() {
    try {
      await configureSlack();
      await refreshActions();
      addNotification("Slack configurado!", "success");
    } catch (error) {
      addNotification("Erro ao configurar Slack", "error");
    }
  }

  async function handleReconfigurePonto() {
    try {
      navigate("/");
    } catch (error) {
      addNotification("Erro ao reconfigurar ponto", "error");
    }
  }

  async function handleActionClick(type: MainMenuActionType) {
    try {
      const route = await executeAction(type);
      if (route) {
        navigate(route);
      }
    } catch (error) {
      console.debug("Erro:", error);
    }
  }

  if (isMenuLoading) {
    return (
      <div className="flex flex-col gap-2">
        <ActionSkeleton />
        <ActionSkeleton />
        <ActionSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isBlocked && (
        <div className="border-y border-dashed border-border py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-muted-foreground text-start">
                Sistema de Ponto bloqueado
              </span>
            </div>
            <Button
              onClick={handleReconfigurePonto}
              variant="outline"
              size="icon"
              disabled={false}
              className="h-8 w-8 rounded-full"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!isSlackAuthenticated && (
        <div className="border-y border-dashed border-border py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground text-start">
              É preciso autenticar no Slack para usar todas as funcionalidades
            </span>
            <Button
              onClick={handleConfigureSlack}
              variant="outline"
              size="icon"
              disabled={isSlackLoading}
              className="h-8 w-8 rounded-full"
            >
              {isSlackLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {isSlackAuthenticated && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Slack className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Status Atual
            </span>
          </div>
          <StatusDetails />
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Menu className="h-4 w-4" />
          <span className="text-sm font-medium text-muted-foreground">
            Ações
          </span>
        </div>

        <div className="flex flex-col">
          {actions.map((action) => {
            const isDisabled = isBlocked
              ? action.type.includes("ponto")
              : !action.isAvailable;
            const tooltipText =
              isBlocked && action.type.includes("ponto")
                ? "Sistema bloqueado"
                : undefined;

            return (
              <Button
                key={action.type}
                onClick={() => handleActionClick(action.type)}
                disabled={isDisabled}
                className="flex h-12 items-center gap-3 p-3 rounded-lg duration-200 hover:bg-accent cursor-pointer transition-colors justify-start w-full"
                variant="ghost"
                title={tooltipText}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium line-clamp-1 text-start">
                    {action.label}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

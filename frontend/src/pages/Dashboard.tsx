import { useMainMenu } from "@/hooks/useMainMenu";
import { Loader2, Slack } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSlackStore } from "@/store/slackStore";
import { useNotifyStore } from "@/store/notifyStore";
import { useNavigate } from "react-router-dom";
import { MainMenuActionType } from "@/types/ponto";
import StatusDetails from "@/components/StatusDetails";

export default function Dashboard() {
  const navigate = useNavigate();
  const addNotification = useNotifyStore((state) => state.addNotification);
  const { actions, isLoading: isMenuLoading, executeAction, refreshActions } = useMainMenu();
  const {
    isAuthenticated: isSlackAuthenticated,
    configureSlack,
    isLoading: isSlackLoading,
  } = useSlackStore();

  async function handleConfigureSlack() {
    await configureSlack();
    await refreshActions();
    addNotification('Slack configurado com sucesso!', 'success');
  }

  async function handleActionClick(type: MainMenuActionType) {
    try {
      const route = await executeAction(type);
      if (route) {
        navigate(route);
      }
    } catch (error) {
      // O erro já é tratado no executeAction
      console.debug('Erro ao executar ação:', error);
    }
  }

  if (isMenuLoading || isSlackLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!isSlackAuthenticated && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground line-clamp-1">
            Configure o Slack para usar todas as funcionalidades.
          </p>
          <Button
            disabled={isSlackLoading}
            onClick={handleConfigureSlack}
            variant="ghost"
            size="sm"
            className="cursor-pointer"
          >
            <Slack className="h-4 w-4" />
            {isSlackLoading ? "Autenticando..." : "Configurar"}
          </Button>
        </div>
      )}
      {isSlackAuthenticated && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground text-start">Status Atual</h3>
          <StatusDetails />
        </div>
      )}
      <Separator />
      <div className="grid grid-cols-1 gap-4">
        {actions.map((action) => (
          <div key={action.type}>
            <Button
              onClick={() => handleActionClick(action.type)}
              disabled={!action.isAvailable}
              className="h-12 w-full cursor-pointer transition-opacity justify-start items-center select-none"
              variant="outline"
            >
              <span className="text-sm mr-2">{action.icon}</span>
              {action.label}
            </Button>
            {action.fixed && <Separator />}
          </div>
        ))}
      </div>
    </div>
  );
}

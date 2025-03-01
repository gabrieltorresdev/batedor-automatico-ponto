import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Slack, AlertCircle, InfoIcon, Settings, ExternalLink, RefreshCw } from "lucide-react";

import { useMainMenu } from "@/hooks/useMainMenu";
import { useSlackManager } from "@/hooks/useSlackManager";
import { useNotifyStore } from "@/store/notifyStore";
import { useAuthManager } from "@/hooks/useAuthManager";
import { withRuntime } from "@/lib/wailsRuntime";
import { VerificarCredenciaisSalvas } from "../../wailsjs/go/main/App";
import { RetryStatus } from "@/lib/initializationQueue";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StatusCard from "@/components/StatusCard";
import StatusDetails from "@/components/StatusDetails";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { MainMenuActionType } from "@/types/ponto";
import { cn } from "@/lib/utils";

// Helper function to map RetryStatus to StatusCard props format
const mapRetryStatus = (status: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; } | null | undefined) => {
  if (!status) return undefined;
  
  // Check if it's the RetryStatus type from initializationQueue
  if ('attempt' in status && 'maxAttempts' in status) {
    return {
      isRetrying: status.isRetrying,
      attempt: status.attempt,
      maxAttempts: status.maxAttempts
    };
  }
  
  // Otherwise it's the object with retryAttempt/maxRetries properties
  return {
    isRetrying: status.isRetrying,
    attempt: status.retryAttempt,
    maxAttempts: status.maxRetries
  };
};

// Components
const StatusCards = ({ 
  isPontoInitialized, 
  pontoError,
  isSlackInitialized,
  isSlackAuthenticated,
  isSlackLoading,
  slackError,
  onRetrySlack,
  onLogin,
  onReinitializeAuth,
  isReinitializing,
  authRetryStatus
}: {
  isPontoInitialized: boolean;
  pontoError: { type: string; message: string } | null;
  isSlackInitialized: boolean;
  isSlackAuthenticated: boolean;
  isSlackLoading: boolean;
  slackError: { type: string; message: string } | null;
  onRetrySlack: () => void;
  onLogin: () => void;
  onReinitializeAuth: () => void;
  isReinitializing: boolean;
  authRetryStatus?: { isRetrying: boolean; attempt: number; maxAttempts: number };
}) => {
  const hasError = pontoError || (isSlackInitialized && !isSlackAuthenticated);
  const isLoading = !isPontoInitialized || !isSlackInitialized || isReinitializing;
  const isRetrying = authRetryStatus?.isRetrying || false;

  if (!hasError && !isLoading && !isRetrying) {
    return null;
  }

  return (
    <div className="space-y-2">
      {(isReinitializing || !isPontoInitialized || isRetrying) && (
        <StatusCard 
          icon={<Skeleton className="h-3 w-3 rounded-full" />}
          title={isRetrying 
            ? "Tentando Reconectar ao Sistema" 
            : isReinitializing 
              ? "Reconectando ao Sistema" 
              : "Inicializando"}
          variant="default"
          isRetrying={isRetrying}
          retryAttempt={authRetryStatus?.attempt || 0}
          maxRetryAttempts={authRetryStatus?.maxAttempts || 0}
        >
          <div className="space-y-1">
            <Skeleton className="h-2 w-24" />
          </div>
        </StatusCard>
      )}

      {!isReinitializing && !isRetrying && pontoError && pontoError.type === 'invalid_credentials' && (
        <StatusCard 
          icon={<InfoIcon className="h-4 w-4" />}
          title="Configuração Necessária do Ponto"
          variant="warning"
        >
          <div className="flex items-center justify-between">
            <span>Configure suas credenciais do ponto</span>
            <Button
              onClick={onLogin}
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-full"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </StatusCard>
      )}

      {!isReinitializing && !isRetrying && pontoError && pontoError.type === 'blocked' && (
        <StatusCard 
          icon={<AlertCircle className="h-4 w-4" />}
          title="Sistema Temporariamente Bloqueado"
          variant="error"
        >
          <div className="flex items-center justify-between">
            <Button
              onClick={onReinitializeAuth}
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-full"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </StatusCard>
      )}

      {!isReinitializing && !isRetrying && pontoError && pontoError.type === 'network' && (
        <StatusCard 
          icon={<AlertCircle className="h-4 w-4" />}
          title="Erro de Conexão"
          variant="error"
        >
          <div className="flex items-center justify-between">
            <Button
              onClick={onReinitializeAuth}
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-full"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </StatusCard>
      )}

      {!isReinitializing && !isRetrying && pontoError && pontoError.type === 'runtime' && (
        <StatusCard 
          icon={<AlertCircle className="h-4 w-4" />}
          title="Sistema Indisponível"
          variant="error"
        >
          <div className="flex items-center justify-between">
            <Button
              onClick={onReinitializeAuth}
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-full"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </StatusCard>
      )}

      {!isSlackInitialized && (
        <StatusCard 
          icon={<Skeleton className="h-3 w-3 rounded-full" />}
          title="Inicializando Slack"
          variant="default"
        >
          <div className="space-y-1">
            <Skeleton className="h-2 w-20" />
          </div>
        </StatusCard>
      )}

      {isSlackInitialized && !isSlackAuthenticated && (
        <StatusCard 
          icon={<InfoIcon className="h-3 w-3" />}
          title="Slack Desconectado"
          variant={slackError?.type === 'network' ? 'error' : 'warning'}
        >
          <div className="flex items-center justify-between">
            <span>
              {slackError?.type === 'network' 
                ? 'Erro de conexão com Slack'
                : 'Conecte ao Slack'}
            </span>
            <Button
              onClick={onRetrySlack}
              variant="outline"
              size="icon"
              disabled={isSlackLoading}
              className="h-6 w-6 rounded-full ml-2"
            >
              {isSlackLoading ? (
                <Skeleton className="h-3 w-3 rounded-full" />
              ) : (
                <Slack className="h-3 w-3" />
              )}
            </Button>
          </div>
        </StatusCard>
      )}
    </div>
  );
};

const SlackStatus = ({ isAuthenticated }: { isAuthenticated: boolean }) => {
  const navigate = useNavigate();
  
  return isAuthenticated && (
    <Button
      variant="ghost"
      className="w-full flex items-center justify-between gap-2 h-12 shadow-none !p-2"
      onClick={() => navigate('/slack/status')}
    >
      <StatusDetails />
      <div className=" p-1">
        <Slack className="h-6 w-6 text-primary flex-shrink-0" />
      </div>
    </Button>
  );
};

const ActionButton = ({ 
  action, 
  isDisabled,
  tooltipText,
  onClick 
}: { 
  action: any, 
  isDisabled: boolean,
  tooltipText?: string,
  onClick: () => void 
}) => {
  const button = (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "h-20 flex flex-col items-center justify-center gap-2",
        "bg-card"
      )}
      variant="ghost"
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/2">
        {action.icon}
      </div>
      <div className="text-xs font-medium text-center line-clamp-1">
        {action.label}
      </div>
    </Button>
  );

  if (isDisabled && tooltipText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const addNotification = useNotifyStore((state) => state.addNotification);
  const authManager = useAuthManager();
  const { 
    isInitialized: isPontoInitialized,
    error: pontoError,
    isLoading: isAuthLoading,
    reinitializeAuth,
    verifyCredentials
  } = authManager;
  
  const [isReinitializing, setIsReinitializing] = useState(false);
  
  const {
    actions,
    isLoading: isMenuLoading,
    executeAction,
    refreshActions,
  } = useMainMenu();
  
  const {
    isAuthenticated: isSlackAuthenticated,
    isLoading: isSlackLoading,
    isInitialized: isSlackInitialized,
    error: slackError,
    verifySlackSession
  } = useSlackManager();

  const authRetryStatus = mapRetryStatus(authManager.retryStatus.active || authManager.retryStatus.verification);

  useEffect(() => {
    let isMounted = true;
    let initializationPromise: Promise<void> | null = null;
    
    const initializeModules = async () => {
      if (initializationPromise) return initializationPromise;
      
      // Only initialize if not already initialized and not loading
      if ((!isPontoInitialized && !isAuthLoading) || (!isSlackInitialized && !isSlackLoading)) {
        initializationPromise = (async () => {
          try {
            if (!isPontoInitialized && !isAuthLoading) {
              const success = await verifyCredentials();
              // No need to navigate since we're already on the dashboard
            }
            
            if (!isSlackInitialized && !isSlackLoading && isMounted) {
              await verifySlackSession();
            }
            
            if (isMounted) {
              await refreshActions();
            }
          } catch (error) {
            if (error instanceof Error) {
              const errorMessage = error.message.replace('erro ao fazer login: ', '');
              addNotification(errorMessage, 'warning');
            }
            console.debug('Erro ao inicializar módulos:', error);
          }
        })();
        
        return initializationPromise;
      }
    };

    initializeModules();
    
    return () => {
      isMounted = false;
    };
  }, [isPontoInitialized, isSlackInitialized, verifyCredentials, verifySlackSession, refreshActions, addNotification, isAuthLoading, isSlackLoading]);

  const handleRetrySlack = async () => {
    try {
      await verifySlackSession();
      await refreshActions();
      addNotification("Slack reconectado!", "success");
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message.replace('erro ao fazer login: ', '');
        addNotification(errorMessage, 'error');
      } else {
        addNotification("Erro ao conectar com Slack", "error");
      }
    }
  };

  const handleReinitializeAuth = async () => {
    try {
      setIsReinitializing(true);
      await reinitializeAuth();
      
      // Refresh actions after successful reinitialization
      await refreshActions();
    } catch (error) {
      console.debug('Erro ao reinicializar autenticação:', error);
    } finally {
      setIsReinitializing(false);
    }
  };

  const handleActionClick = async (type: MainMenuActionType) => {
    try {
      const route = await executeAction(type);
      if (route) navigate(route);
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message.replace('erro ao fazer login: ', '');
        addNotification(errorMessage, 'error');
      }
      console.debug("Erro:", error);
    }
  };

  const checkActionAvailability = (action: any) => {
    // If the action is not available by its own definition, disable it
    if (!action.isAvailable) {
      return { isDisabled: true, tooltipText: undefined };
    }

    // Disable ponto actions during reinitialization or auth loading
    if ((isReinitializing || isAuthLoading) && action.type.includes("ponto")) {
      return { isDisabled: true, tooltipText: "Reconectando ao sistema..." };
    }

    // Check if modules are still initializing
    if (!isPontoInitialized && action.type.includes("ponto")) {
      return { isDisabled: true, tooltipText: "Módulo de ponto carregando..." };
    }

    if (!isSlackInitialized && (action.type.includes("slack") || action.type === "ponto_slack")) {
      return { isDisabled: true, tooltipText: "Módulo do Slack carregando..." };
    }

    // Check for Ponto module errors - disable ponto actions if there are errors
    if (action.type.includes("ponto") && pontoError) {
      if (pontoError.type === 'blocked') {
        return { isDisabled: true, tooltipText: "Sistema temporariamente bloqueado" };
      } else {
        return { isDisabled: true, tooltipText: "Sistema de ponto indisponível" };
      }
    }

    // Check for Slack module errors - disable slack actions if not authenticated or there are errors
    if ((action.type.includes("slack") || action.type === "ponto_slack") && 
        (!isSlackAuthenticated || slackError)) {
      return { isDisabled: true, tooltipText: "Slack indisponível" };
    }

    // If all checks pass, the action is enabled
    return { isDisabled: false, tooltipText: undefined };
  };

  return (
    <div className="flex flex-col gap-2">
      <StatusCards
        isPontoInitialized={isPontoInitialized}
        pontoError={pontoError}
        isSlackInitialized={isSlackInitialized}
        isSlackAuthenticated={isSlackAuthenticated}
        isSlackLoading={isSlackLoading}
        slackError={slackError}
        onRetrySlack={handleRetrySlack}
        onLogin={() => navigate('/login-ponto')}
        onReinitializeAuth={handleReinitializeAuth}
        isReinitializing={isReinitializing}
        authRetryStatus={authRetryStatus}
      />

      <SlackStatus isAuthenticated={isSlackAuthenticated} />

      {isMenuLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const { isDisabled, tooltipText } = checkActionAvailability(action);
            return (
              <ActionButton
                key={action.type}
                action={action}
                isDisabled={isDisabled}
                tooltipText={tooltipText}
                onClick={() => handleActionClick(action.type)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}


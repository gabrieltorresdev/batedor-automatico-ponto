import { useAuthStore } from "@/store/authStore";
import { Button } from "./ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, ArrowLeft, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSlackStore } from "@/store/slackStore";
import { useMainMenu } from "@/hooks/useMainMenu";
import { cn } from "@/lib/utils";
import { VerificarCredenciaisSalvas } from "../../wailsjs/go/main/App";
import { useNotifyStore } from "@/store/notifyStore";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { WindowReload } from "../../wailsjs/runtime/runtime";
import { initializationQueue } from "@/lib/initializationQueue";

export default function Header() {
  const { 
    username,
    lastKnownUsername, 
    formatDisplayName, 
    logout, 
    setUnauthenticated,
    setLoading: setAuthLoading
  } = useAuthStore();
  const { 
    verifySlackSession, 
    setLoading: setSlackLoading,
    reset: resetSlack 
  } = useSlackStore();
  const { verifyCredentials } = useAuth();
  const { refreshActions } = useMainMenu();
  const addNotification = useNotifyStore(state => state.addNotification);
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [isReloading, setIsReloading] = useState(false);

  const phrases = [
    "A que PONTO você chegou?",
    "Qual é o seu PONTO forte hoje?", 
    "PONTO por PONTO, vamos chegar lá!",
    "Está tudo no PONTO para você?",
    "Chegou em PONTO de bala!",
    "PONTO final ou só uma vírgula?",
    "Direto ao PONTO!",
    "PONTO de encontro com o sucesso!",
  ];

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let currentIndex = 0;

    const typeNextCharacter = () => {
      if (currentIndex < phrases[currentPhrase].length) {
        setDisplayText(phrases[currentPhrase].slice(0, currentIndex + 1));
        currentIndex++;
        timeout = setTimeout(typeNextCharacter, 50);
      } else {
        setIsTyping(false);
      }
    };

    setIsTyping(true);
    currentIndex = 0;
    typeNextCharacter();

    const phraseInterval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % phrases.length);
      setIsTyping(true);
    }, 5000);

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(phraseInterval);
      clearInterval(timeInterval);
      clearTimeout(timeout);
    };
  }, [currentPhrase]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  // Função para limpar os estados de forma síncrona
  const resetStates = useCallback(() => {
    setAuthLoading(true);
    setSlackLoading(true);
    setUnauthenticated();
    resetSlack();
  }, [setAuthLoading, setSlackLoading, setUnauthenticated, resetSlack]);

  const handleReload = useCallback(async () => {
    if (isReloading) return;

    try {
      setIsReloading(true);
      
      // Clear any pending tasks first
      initializationQueue.clear();
      
      // Reset all states synchronously
      resetStates();
      
      // Navigate to home and wait a bit for state updates
      navigate("/");
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        // Force a complete context refresh with proper error handling
        setAuthLoading(true);
        setSlackLoading(true);
        
        // First verify credentials with timeout handling
        try {
          await Promise.race([
            verifyCredentials(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout verifying credentials')), 10000)
            )
          ]);
        } catch (error: any) {
          console.debug('Error verifying credentials during reload:', error);
          
          // Handle blocked user error specifically
          const errorMessage = error?.message?.toLowerCase() || '';
          if (errorMessage.includes('bloqueado') || errorMessage.includes('blocked')) {
            setUnauthenticated({
              type: 'blocked',
              message: 'Sistema temporariamente bloqueado. Tente novamente em alguns minutos.'
            });
          }
          // Continue with Slack verification even if credentials fail
        }
        
        // Then verify Slack with timeout handling
        try {
          await Promise.race([
            verifySlackSession(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout verifying Slack')), 10000)
            )
          ]);
        } catch (error) {
          console.debug('Error verifying Slack during reload:', error);
          // Continue with actions refresh even if Slack fails
        }
        
        // Finally refresh actions
        try {
          await Promise.race([
            refreshActions(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout refreshing actions')), 5000)
            )
          ]);
        } catch (error) {
          console.debug('Error refreshing actions during reload:', error);
        }
      } catch (error) {
        console.debug('Error during context refresh:', error);
      }
      
      // Wait for runtime to be available before reloading
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for runtime to stabilize
        if (window?.go?.main) {
          WindowReload();
        } else {
          // If runtime is not available, do a regular page reload
          window.location.reload();
        }
      } catch (error) {
        console.debug('Error during window reload:', error);
        window.location.reload();
      }
    } catch (error) {
      console.error('Critical error during reload:', error);
      addNotification("Erro ao recarregar aplicação", "error");
      setIsReloading(false);
    }
  }, [
    isReloading,
    resetStates,
    navigate,
    addNotification,
    setAuthLoading,
    setSlackLoading,
    verifyCredentials,
    verifySlackSession,
    refreshActions,
    setUnauthenticated
  ]);

  const showBackButton = location.pathname !== "/" && location.pathname !== "/dashboard";
  const showLogoutButton = location.pathname !== "/";
  const showReloadButton = location.pathname === "/" || location.pathname === "/dashboard";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-12 gap-1">
        <h1 className="text-sm font-medium tracking-wide col-span-8 text-start">
          Fala,{" "}
          <span className="bg-gradient-to-r from-[#D40000] to-green-500 text-transparent bg-clip-text font-bold">
            {(username || lastKnownUsername) ? 
              `${formatDisplayName(username || lastKnownUsername || '')}!` : 
              "Fintoolsiano!"
            }
          </span>
        </h1>
        
        <div className="flex gap-1.5 justify-end items-center col-span-4">
          <ThemeToggle />
          {showReloadButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReload}
              disabled={isReloading}
              className="h-7 w-7 cursor-pointer"
            >
              <RefreshCw className={cn("h-4 w-4", isReloading && "animate-spin")} />
            </Button>
          )}
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-7 w-7 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {showLogoutButton && !showBackButton && (
            <Button
              variant="ghost" 
              size="icon"
              onClick={handleLogout}
              className="h-7 w-7 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center col-span-11">
          <h3 className="text-left tracking-wide text-xs text-muted-foreground">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentPhrase}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {displayText}
                {isTyping && <span className="animate-pulse">|</span>}
              </motion.span>
            </AnimatePresence>
          </h3>
        </div>

        <div className="col-span-1 flex items-center justify-end">
          <span className="text-xs font-medium">
            {currentTime.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

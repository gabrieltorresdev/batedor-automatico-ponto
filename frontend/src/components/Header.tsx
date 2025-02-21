import { useAuthStore } from "@/store/authStore";
import { Button } from "./ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const PHRASES = [
  "A que PONTO você chegou?",
  "Qual é o seu PONTO forte hoje?", 
  "PONTO por PONTO, vamos chegar lá!",
  "Está tudo no PONTO para você?",
  "Chegou em PONTO de bala!",
  "PONTO final ou só uma vírgula?",
  "Direto ao PONTO!",
  "PONTO de encontro com o sucesso!",
] as const;

interface NavigationButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
}

const NavigationButton = ({ onClick, icon }: NavigationButtonProps) => (
  <Button
    variant="ghost"
    size="icon"
    onClick={onClick}
    className="h-7 w-7 cursor-pointer"
  >
    {icon}
  </Button>
);

const UserGreeting = ({ username, formatDisplayName }: {
  username: string | null;
  formatDisplayName: (name: string) => string;
}) => (
  <h1 className="text-lg font-medium tracking-wide col-span-8 text-start">
    Fala,{" "}
    <span className="bg-gradient-to-r from-[#D40000] to-green-500 text-transparent bg-clip-text font-bold">
      {username ? `${formatDisplayName(username)}!` : "Fintoolsiano!"}
    </span>
  </h1>
);

export default function Header() {
  const { username, formatDisplayName, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  // Clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Typewriter effect
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentPhrase = PHRASES[currentPhraseIndex];
    let currentIndex = 0;

    const type = () => {
      if (currentIndex <= currentPhrase.length) {
        setDisplayText(currentPhrase.slice(0, currentIndex));
        setIsTyping(true);
        currentIndex++;
        timeout = setTimeout(type, 50);
      } else {
        setIsTyping(false);
        timeout = setTimeout(() => {
          setCurrentPhraseIndex((prev) => (prev + 1) % PHRASES.length);
          currentIndex = 0;
        }, 5000);
      }
    };

    type();
    return () => clearTimeout(timeout);
  }, [currentPhraseIndex]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const showBackButton = location.pathname !== "/" && location.pathname !== "/dashboard";
  const showLogoutButton = location.pathname !== "/";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-12 gap-2">
        <UserGreeting username={username} formatDisplayName={formatDisplayName} />
        
        <div className="flex gap-1.5 justify-end items-center col-span-4">
          {showBackButton && (
            <NavigationButton 
              onClick={() => navigate("/dashboard")}
              icon={<ArrowLeft className="h-4 w-4" />}
            />
          )}
          {showLogoutButton && !showBackButton && (
            <NavigationButton
              onClick={handleLogout}
              icon={<LogOut className="h-4 w-4" />}
            />
          )}
        </div>

        <div className="flex items-center col-span-11">
          <h3 className="text-left tracking-wide text-xs text-muted-foreground min-h-[1rem]">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentPhraseIndex}
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

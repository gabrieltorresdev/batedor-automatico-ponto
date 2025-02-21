import { useAuthStore } from "@/store/authStore";
import { Button } from "./ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Header() {
  const { username, formatDisplayName, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

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

  const showBackButton =
    location.pathname !== "/" && location.pathname !== "/dashboard";
  const showLogoutButton = location.pathname !== "/";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-12 gap-2">
        <h1 className="text-lg font-medium tracking-wide col-span-8 text-start">
          Fala,{" "}
          <span className="bg-gradient-to-r from-[#D40000] to-green-500 text-transparent bg-clip-text font-bold">
            {username ? `${formatDisplayName(username)}!` : "Fintoolsiano!"}
          </span>
        </h1>
        
        <div className="flex gap-1.5 justify-end items-center col-span-4">
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
          <h3 className="text-left tracking-wide text-xs text-muted-foreground min-h-[1rem]">
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

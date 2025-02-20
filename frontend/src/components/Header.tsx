import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { LogOut, ArrowLeft } from "lucide-react";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    // TODO: Implementar lógica de logout quando necessário
    navigate("/");
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  const showBackButton =
    location.pathname !== "/" && location.pathname !== "/dashboard";
  const showLogoutButton = location.pathname !== "/";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-left tracking-wide">
            Olá,{" "}
            <span className="bg-gradient-to-r from-[#D40000] to-green-500 text-transparent bg-clip-text font-bold">
              Fintoolsiano !
            </span>
          </h1>
          <h3 className="text-left tracking-wide text-xs opacity-70">
            A que <span className="font-bold">PONTO</span> você chegou?
          </h3>
        </div>
        <div className="flex gap-2">
          {showBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          {showLogoutButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

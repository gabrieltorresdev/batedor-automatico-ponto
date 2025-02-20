import LoginForm from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";
import { Loader2 } from "lucide-react";

function Home() {
    const { login, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Verificando credenciais...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <LoginForm onSubmit={login} />
        </div>
    )
}

export default Home 
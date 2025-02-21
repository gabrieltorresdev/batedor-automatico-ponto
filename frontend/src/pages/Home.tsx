import { Button } from "@/components/ui/button";
import LoginForm from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Home() {
  const { login, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Button
            disabled
            className="h-12 w-full cursor-pointer transition-opacity justify-start items-center select-none"
            variant="outline"
          >
            <Skeleton className="h-4 w-4 mr-2" />
            <Skeleton className="h-4 w-32" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <LoginForm onSubmit={login} />
    </div>
  );
}

export default Home;

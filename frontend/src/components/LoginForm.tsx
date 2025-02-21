import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, LogIn } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmitForm = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data.username, data.password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-muted-foreground text-center">
        Insira suas credenciais do Ponto
      </h3>
      <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Input
            type="text"
            placeholder="Usuário"
            disabled={isSubmitting}
            className="p-8 text-lg"
            {...register("username")}
          />
          {errors.username && (
            <span className="text-sm text-red-500 text-start">{errors.username.message}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            type="password"
            placeholder="Senha"
            disabled={isSubmitting}
            className="p-8 text-lg"
            {...register("password")}
          />
          {errors.password && (
            <span className="text-sm text-red-500 text-start">{errors.password.message}</span>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting} className="p-8 text-xl cursor-pointer">
          {isSubmitting ? (
            <>
            Entrando...
            <Loader2 className="h-8 w-8 animate-spin" />
            </>
          ) : (
            <>
            Entrar
            <LogIn className="h-8 w-8" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default LoginForm;

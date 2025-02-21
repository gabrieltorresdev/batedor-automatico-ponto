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

// Componente para reduzir a duplicação dos campos do formulário
const FormField = ({
  type,
  placeholder,
  errorMessage,
  registerProps,
  disabled,
}: {
  type: string;
  placeholder: string;
  errorMessage?: string;
  registerProps: any;
  disabled: boolean;
}) => (
  <div className="flex flex-col gap-1">
    <Input
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      className="p-4 text-lg"
      {...registerProps}
    />
    {errorMessage && (
      <span className="text-sm text-red-500 text-start">{errorMessage}</span>
    )}
  </div>
);

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleFormSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data.username, data.password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-y border-dashed border-border py-4">
      <h3 className="text-sm font-semibold text-muted-foreground text-start">
        Insira suas credenciais do Ponto
      </h3>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
        <FormField
          type="text"
          placeholder="Usuário"
          disabled={isSubmitting}
          registerProps={register("username")}
          errorMessage={errors.username?.message}
        />
        <FormField
          type="password"
          placeholder="Senha"
          disabled={isSubmitting}
          registerProps={register("password")}
          errorMessage={errors.password?.message}
        />
        <Button type="submit" variant="secondary" disabled={isSubmitting} className="p-4 text-xl cursor-pointer">
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

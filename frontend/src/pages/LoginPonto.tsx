import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, KeyRound, UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifyStore } from '@/store/notifyStore';
import { useAuthManager } from '@/hooks/useAuthManager';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  username: z.string().min(1, { message: 'O nome de usuário é obrigatório' }),
  password: z.string().min(1, { message: 'A senha é obrigatória' }),
});

export default function LoginPonto() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addNotification = useNotifyStore((state) => state.addNotification);
  const authManager = useAuthManager();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await authManager.login(data.username, data.password);
      addNotification('Login realizado com sucesso!', 'success');
      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login';
      addNotification(errorMessage, 'error');
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
      <Card className="w-full max-w-md border shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">BatPonto</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuário</FormLabel>
                    <FormControl>
                      <div className="flex items-center border rounded-md focus-within:ring-1 focus-within:ring-primary">
                        <div className="px-3 py-2 text-muted-foreground">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                        <Input 
                          placeholder="Seu nome de usuário" 
                          {...field} 
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="flex items-center border rounded-md focus-within:ring-1 focus-within:ring-primary">
                        <div className="px-3 py-2 text-muted-foreground">
                          <KeyRound className="h-5 w-5" />
                        </div>
                        <Input 
                          type="password" 
                          placeholder="Sua senha" 
                          {...field} 
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full mt-4" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
          Fintools &copy; {new Date().getFullYear()}
        </CardFooter>
      </Card>
    </div>
  );
} 
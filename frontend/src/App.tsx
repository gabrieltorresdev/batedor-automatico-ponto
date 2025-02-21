import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AlertContainer from "./components/AlertContainer";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import PontoView from "./components/PontoView";
import SlackStatusView from "./components/SlackStatusView";
import SlackMessageView from "./components/SlackMessageView";
import PontoSlackView from "./components/PontoSlackView";
import Header from "./components/Header";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1, // Limita o número de retentativas
            retryDelay: 1000, // Espera 1 segundo entre as tentativas
            refetchOnWindowFocus: true,
            refetchOnReconnect: false, // Não refetch ao reconectar
            staleTime: 5000, // 5 segundos
            gcTime: 0, // Remove do cache imediatamente quando não estiver em uso
            enabled: true, // Habilita queries por padrão
        },
        mutations: {
            retry: 1, // Limita o número de retentativas para mutations
            retryDelay: 1000, // Espera 1 segundo entre as tentativas
        },
    },
});

// Limpa todas as queries quando a janela é fechada
window.addEventListener('beforeunload', () => {
    queryClient.clear();
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <main id='app' className="p-4 flex flex-col gap-4 border-4 max-h-screen overflow-hidden">
                    <Header />
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/ponto" element={<PontoView />} />
                        <Route path="/ponto/slack" element={<PontoSlackView />} />
                        <Route path="/slack/status" element={<SlackStatusView />} />
                        <Route path="/slack/message" element={<SlackMessageView />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    <AlertContainer />
                </main>
            </BrowserRouter>
        </QueryClientProvider>
    )
}

export default App

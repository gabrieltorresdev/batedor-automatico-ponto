import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AlertContainer from "./components/AlertContainer";
import Dashboard from "./pages/Dashboard";
import LoginPonto from "./pages/LoginPonto";
import PontoView from "./components/PontoView";
import SlackStatusView from "./components/SlackStatusView";
import SlackMessageView from "./components/SlackMessageView";
import PontoSlackView from "./components/PontoSlackView";
import Header from "./components/Header";
import { ThemeProvider } from "./components/ui/theme-provider";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: 5000, // 5 segundos
        },
    },
});

function App() {
    return (
        <ThemeProvider defaultTheme="dark">
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <main id='app' className="p-4 flex flex-col gap-4 max-h-screen overflow-hidden bg-background text-foreground">
                        <Header />
                        <div className="flex-1 overflow-y-auto">
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/login-ponto" element={<LoginPonto />} />
                                <Route path="/ponto" element={<PontoView />} />
                                <Route path="/ponto/slack" element={<PontoSlackView />} />
                                <Route path="/slack/status" element={<SlackStatusView />} />
                                <Route path="/slack/message" element={<SlackMessageView />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </div>
                        <AlertContainer />
                    </main>
                </BrowserRouter>
            </QueryClientProvider>
        </ThemeProvider>
    )
}

export default App

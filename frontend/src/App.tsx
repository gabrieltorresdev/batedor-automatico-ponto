import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import AlertContainer from "./components/AlertContainer";
import Dashboard from "./pages/Dashboard";
import LoginPonto from "./pages/LoginPonto";
import Header from "./components/Header";
import { ThemeProvider } from "./components/ui/theme-provider";
import { CompactPunchTimeline } from "./components/CompactPunchTimeline";
import { useTimeline } from "./hooks/useTimeline";

const PontoView = lazy(() => import("./components/PontoView"));
const SlackStatusView = lazy(() => import("./components/SlackStatusView"));
const SlackMessageView = lazy(() => import("./components/SlackMessageView"));
const PontoSlackView = lazy(() => import("./components/PontoSlackView"));

const LoadingFallback = () => (
    <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
    </div>
);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: 5000,
        },
    },
});

function App() {
    const timeline = useTimeline();
    
    useEffect(() => {
        window.addEventListener('refresh_timeline', () => {
            setTimeout(() => {
                console.log('EVENTOS DO TIMELINE APÓS REFRESH:', 
                    document.querySelector('.timeline-debug') ? 
                    JSON.parse(document.querySelector('.timeline-debug')?.getAttribute('data-events') || '{}') : 
                    'Elemento não encontrado'
                );
            }, 1000);
        });
        
        return () => {
            window.removeEventListener('refresh_timeline', () => {});
        };
    }, []);
    
    return (
        <ThemeProvider defaultTheme="dark">
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <main id='app' className="p-4 flex flex-col gap-4 max-h-screen overflow-hidden bg-background text-foreground">
                        <Header />
                        
                        <CompactPunchTimeline
                          clockInTime={timeline.clockInTime}
                          lunchStartTime={timeline.lunchStartTime}
                          lunchEndTime={timeline.lunchEndTime}
                          clockOutTime={timeline.clockOutTime}
                          specialEvents={timeline.specialEvents}
                          onRefresh={timeline.refresh}
                        />
                        
                        <div className="flex-1 overflow-y-auto pb-12 relative">
                            <Suspense fallback={<LoadingFallback />}>
                                <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/login-ponto" element={<LoginPonto />} />
                                    <Route path="/ponto" element={<PontoView />} />
                                    <Route path="/ponto/slack" element={<PontoSlackView />} />
                                    <Route path="/slack/status" element={<SlackStatusView />} />
                                    <Route path="/slack/message" element={<SlackMessageView />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Suspense>
                        </div>
                        
                        <AlertContainer />
                    </main>
                </BrowserRouter>
            </QueryClientProvider>
        </ThemeProvider>
    )
}

export default App

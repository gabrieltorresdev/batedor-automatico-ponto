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

// Configurações padrão do QueryClient
const DEFAULT_QUERY_CONFIG = {
  retry: 1,
  retryDelay: 1000,
  enabled: true
};

const QUERY_CLIENT_CONFIG = {
  defaultOptions: {
    queries: {
      ...DEFAULT_QUERY_CONFIG,
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
      staleTime: 10000,
      gcTime: 0
    },
    mutations: {
      ...DEFAULT_QUERY_CONFIG
    }
  }
};

// Criação do QueryClient com as configurações
const queryClient = new QueryClient(QUERY_CLIENT_CONFIG);

// Limpeza do cache ao fechar
window.addEventListener('beforeunload', () => queryClient.clear());

// Definição das rotas da aplicação
const APP_ROUTES = [
  { path: "/", element: <Home /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/ponto", element: <PontoView /> },
  { path: "/ponto/slack", element: <PontoSlackView /> },
  { path: "/slack/status", element: <SlackStatusView /> },
  { path: "/slack/message", element: <SlackMessageView /> },
  { path: "*", element: <Navigate to="/" replace /> }
];

// Componente de Layout que envolve as rotas
const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <main id='app' className="p-4 flex flex-col gap-4 border-4 max-h-screen overflow-hidden">
    <Header />
    {children}
    <AlertContainer />
  </main>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            {APP_ROUTES.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

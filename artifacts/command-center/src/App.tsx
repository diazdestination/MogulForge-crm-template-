import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { useAuth } from '@workspace/replit-auth-web';
import { Shell } from '@/components/shell';
import { AccessGate } from '@/components/access-gate';
import { Loader2 } from 'lucide-react';

// Pages
import Dashboard from '@/pages/dashboard';
import Assistant from '@/pages/assistant';
import Pipeline from '@/pages/pipeline';
import LeadDetail from '@/pages/lead-detail';
import Contacts from '@/pages/contacts';
import Properties from '@/pages/properties';
import Estimates from '@/pages/estimates';
import Projects from '@/pages/projects';
import Tasks from '@/pages/tasks';
import Appointments from '@/pages/appointments';
import AuditLog from '@/pages/audit';
import Settings from '@/pages/settings';

const queryClient = new QueryClient();

function LoginScreen() {
  const { login } = useAuth();
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="max-w-md w-full px-8 py-12 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-primary-foreground text-3xl font-bold mb-8 shadow-xl shadow-primary/20">
          P
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-center">Painless Command Center</h1>
        <p className="text-muted-foreground text-center mb-10 text-sm">
          Mission control for roofing & water restoration sales. Secure access required.
        </p>
        
        <button 
          onClick={login}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-md font-semibold text-sm tracking-wide transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98]"
        >
          AUTHENTICATE
        </button>
        
        <div className="mt-12 flex items-center gap-4 text-xs font-mono text-muted-foreground opacity-50 uppercase tracking-widest">
          <div className="h-[1px] w-8 bg-border" />
          Authorized Personnel Only
          <div className="h-[1px] w-8 bg-border" />
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <AccessGate>
      <Shell>
        <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/assistant" component={Assistant} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/leads/:id" component={LeadDetail} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/properties" component={Properties} />
        <Route path="/estimates" component={Estimates} />
        <Route path="/projects" component={Projects} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/appointments" component={Appointments} />
        <Route path="/audit" component={AuditLog} />
        <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </AccessGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

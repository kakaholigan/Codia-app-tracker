import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { GapDashboard } from './components/GapDashboard';
import { AIActivityStream } from './components/AIActivityStream';
import './App.css';

function App() {
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'tasks':
        return <TasksPage />;
      case 'analytics':
        return <GapDashboard />;
      case 'activity':
        return (
          <div className="p-6">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Activity Logs</h1>
            <p className="text-text-secondary mb-6">Real-time AI agent execution logs and task activity</p>
            <AIActivityStream />
          </div>
        );
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="h-screen flex bg-background-primary text-text-secondary">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;

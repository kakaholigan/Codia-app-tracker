import React from 'react';
import { LayoutDashboard, CheckSquare, BarChart2, Activity } from 'lucide-react';

const NavItem = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-brand-primary text-white shadow-lg'
        : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary'
    }`}
  >
    <Icon className="w-5 h-5 mr-3" />
    <span>{label}</span>
  </button>
);

export const Sidebar = ({ activePage, setActivePage }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'activity', label: 'Activity Logs', icon: Activity },
  ];

  return (
    <div className="w-64 bg-background-secondary p-4 flex flex-col border-r border-border-default">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="flex items-center justify-center w-10 h-10 bg-brand-primary rounded-xl">
          {/* Logo will be here */}
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-text-primary">CODIA TRACKER</h1>
          <p className="text-xs text-text-tertiary">V10 Infrastructure</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activePage === item.id}
            onClick={() => setActivePage(item.id)}
          />
        ))}
      </nav>

      {/* Footer/User Info (Placeholder) */}
      <div className="mt-auto">
        {/* User profile can go here */}
      </div>
    </div>
  );
};

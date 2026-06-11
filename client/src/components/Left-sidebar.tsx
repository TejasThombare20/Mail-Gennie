import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Paperclip,
  LayoutTemplate,
  Clock,
  Mail,
  BarChart,
  Settings,
  ChevronRight,
  ChevronLeft,
  Users
} from 'lucide-react';
import { Button } from './ui-component/Button';
import { cn } from '../lib/utils';
import { ScrollArea } from './ui-component/Scroll-Area';


interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const location = useLocation();

  const sidebarItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: <BarChart className="h-5 w-5" />
    },
    {
      title: 'Send Emails',
      href: '/dashboard/send',
      icon: <Mail className="h-5 w-5" />
    },
    {
      title: 'Templates',
      href: '/dashboard/templates',
      icon: <LayoutTemplate className="h-5 w-5" />
    },
    {
      title: 'Attachments',
      href: '/dashboard/attachments',
      icon: <Paperclip className="h-5 w-5" />
    },
    {
      title: 'History',
      href: '/dashboard/history',
      icon: <Clock className="h-5 w-5" />
    },
    {
      title: 'Sent Records',
      href: '/dashboard/records',
      icon: <Users className="h-5 w-5" />
    },
    {
      title: 'Settings',
      href: '/dashboard/settings',
      icon: <Settings className="h-5 w-5" />
    }
  ];

  return (
    <div className={cn(
      "flex h-screen border-r bg-background",
      collapsed ? "w-16" : "w-64",
      "transition-width duration-200 ease-in-out",
      className
    )}>
      <div className="flex h-full w-full flex-col">
        <div className="flex h-14 items-center px-3 border-b">
          {!collapsed && (
            <span className="text-lg font-semibold">Email Platform</span>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("ml-auto", collapsed && "mx-auto")}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-1 p-2">
            {sidebarItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  location.pathname === item.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.icon}
                {!collapsed && <span>{item.title}</span>}
              </Link>
            ))}
          </nav>
        </ScrollArea>
      </div>
    </div>
  );
}
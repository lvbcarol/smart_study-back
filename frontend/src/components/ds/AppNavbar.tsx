// src/components/ds/AppNavbar.tsx — barra de navegação com menu diferente por perfil
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from './BrandMark';
import { Button, buttonVariants } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';

const AppNavbar: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  const isTeacher = user?.role === 'teacher';
  const links = user
    ? isTeacher
      ? [
          { to: '/home', label: t('navbar.teacherHome') },
          { to: '/classes', label: t('navbar.teacherClasses') },
          { to: '/my-notebooks', label: t('navbar.teacherNotebooks') },
          { to: '/tasks', label: t('navbar.tasks') },
        ]
      : [
          { to: '/home', label: t('navbar.home') },
          { to: '/my-notebooks', label: t('navbar.myNotebooks') },
          { to: '/tasks', label: t('navbar.tasks') },
          { to: '/progress', label: t('navbar.progress') },
        ]
    : [{ to: '/about-us', label: t('navbar.aboutUs') }];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors',
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 pl-4 pr-16">
        <Link to={user ? '/home' : '/login'} aria-label="Smart Study" className="rounded-lg">
          <BrandLogo markClassName="h-9 w-9" />
        </Link>

        <nav aria-label={t('navbar.main')} className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <>
              <Link
                to="/my-account"
                className="hidden items-center gap-2 rounded-xl px-2 py-1 hover:bg-secondary md:flex"
                aria-label={t('navbar.profile')}
              >
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-sm font-semibold">{user.name.split(' ')[0]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {isTeacher ? t('navbar.roleTeacher') : t('navbar.roleStudent')}
                  </span>
                </span>
              </Link>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={handleLogout} aria-label={t('navbar.logout')} title={t('navbar.logout')}>
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>{t('navbar.login')}</Link>
              <Link to="/register" className={buttonVariants({ size: 'sm' })}>{t('navbar.register')}</Link>
            </div>
          )}
          <Button
            variant="ghost" size="icon" className="md:hidden"
            aria-expanded={open} aria-controls="mobile-menu"
            aria-label={open ? t('navbar.closeMenu') : t('navbar.openMenu')}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label={t('navbar.main')} className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.to}><NavLink to={l.to} className={(s) => cn(linkClass(s), 'w-full')}>{l.label}</NavLink></li>
            ))}
            {user ? (
              <>
                <li><NavLink to="/my-account" className={(s) => cn(linkClass(s), 'w-full')}>{t('navbar.profile')}</NavLink></li>
                <li><button onClick={handleLogout} className="inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><LogOut className="h-4 w-4" aria-hidden="true" />{t('navbar.logout')}</button></li>
              </>
            ) : (
              <>
                <li><NavLink to="/login" className={(s) => cn(linkClass(s), 'w-full')}>{t('navbar.login')}</NavLink></li>
                <li><NavLink to="/register" className={(s) => cn(linkClass(s), 'w-full')}>{t('navbar.register')}</NavLink></li>
              </>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
};

export default AppNavbar;

// src/pages/MyAccount.tsx — Perfil: conta, aparência (tema/paleta/texto), idioma, acessibilidade, senha
import React, { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PALETTES } from '../theme/palettes';
import type { ThemeMode } from '../types';
import JoinClassSection from '../components/JoinClassSection';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { Badge, Switch } from '../components/ds/Misc';
import { PageHeader } from '../components/ds/PageParts';
import { cn } from '@/lib/utils';

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
    <h2 className="text-xl font-bold">{title}</h2>
    {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    <div className="mt-5 space-y-5">{children}</div>
  </section>
);

const Choice: React.FC<{ checked: boolean; onSelect: () => void; label: string; children?: React.ReactNode; className?: string; disabled?: boolean }> = ({
  checked, onSelect, label, children, className, disabled,
}) => (
  <button
    type="button" role="radio" aria-checked={checked} aria-label={label} onClick={onSelect} disabled={disabled}
    className={cn(
      'relative rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-secondary',
      className
    )}
  >
    {children}
    {checked && <Check className="absolute right-2.5 top-2.5 h-4 w-4 text-primary" aria-hidden="true" />}
  </button>
);

const MyAccount: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, savePreferences } = useAuth();
  const { mode, palette, fontScale, resolvedMode, modeLocked, setMode, setPalette, setFontScale } = useTheme();

  const [name, setName] = useState(user?.name ?? '');
  const [language, setLanguage] = useState(user?.language ?? 'pt-BR');
  const [audio, setAudio] = useState(user?.accessibility.audioDescription ?? false);
  const [sign, setSign] = useState(user?.accessibility.signLanguage ?? false);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const dirty = !!user && (
    name.trim() !== user.name || language !== user.language ||
    audio !== user.accessibility.audioDescription || sign !== user.accessibility.signLanguage ||
    mode !== user.theme || palette !== user.palette || fontScale !== user.fontScale
  );

  // Se sair da página sem salvar, a pré-visualização volta para o que está salvo
  const latest = useRef({ user, dirty });
  latest.current = { user, dirty };
  useEffect(() => () => {
    const { user: u, dirty: d } = latest.current;
    if (u && d) {
      setMode(u.theme);
      setPalette(u.palette as typeof palette);
      setFontScale(u.fontScale);
      i18n.changeLanguage(u.language.split('-')[0]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const discard = () => {
    setName(user.name);
    setLanguage(user.language);
    setAudio(user.accessibility.audioDescription);
    setSign(user.accessibility.signLanguage);
    setMode(user.theme);
    setPalette(user.palette as typeof palette);
    setFontScale(user.fontScale);
    i18n.changeLanguage(user.language.split('-')[0]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await savePreferences({
        name: name.trim(), language, theme: mode, palette, fontScale,
        accessibility: { audioDescription: audio, signLanguage: sign },
      });
      toast.success(t('profile.saved'));
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      await api.put('/usuario/me/password', { currentPassword, newPassword });
      toast.success(t('profile.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      toast.error(t('profile.passwordError'));
    } finally {
      setPwSaving(false);
    }
  };

  const modes: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: t('profile.modeLight'), icon: <Sun className="h-5 w-5" aria-hidden="true" /> },
    { id: 'dark', label: t('profile.modeDark'), icon: <Moon className="h-5 w-5" aria-hidden="true" /> },
    { id: 'system', label: t('profile.modeSystem'), icon: <Monitor className="h-5 w-5" aria-hidden="true" /> },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <Section title={t('profile.account')}>
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-semibold">{user.email}</p>
            <Badge variant="primary">{user.role === 'teacher' ? t('profile.roleTeacher') : t('profile.roleStudent')}</Badge>
          </div>
        </div>
        <Field label={t('profile.name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Section>

      {user.role === 'student' && (
        <Section title={t('joinClass.title')} description={t('joinClass.description')}>
          <JoinClassSection />
        </Section>
      )}

      <Section title={t('profile.appearance')} description={t('profile.appearanceDesc')}>
        {modeLocked && <p role="note" className="rounded-xl bg-accent px-4 py-2 text-sm text-accent-foreground">{t('profile.modeLocked')}</p>}
        <div role="radiogroup" aria-label={t('profile.mode')} className="grid grid-cols-3 gap-3">
          {modes.map((m) => (
            <Choice key={m.id} checked={mode === m.id} onSelect={() => setMode(m.id)} label={m.label} disabled={modeLocked}>
              <span className="flex flex-col items-center gap-1.5 py-1 text-sm font-semibold">{m.icon}{m.label}</span>
            </Choice>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{t('profile.palette')}</p>
          <div role="radiogroup" aria-label={t('profile.palette')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PALETTES.map((p) => (
              <Choice key={p.id} checked={palette === p.id} onSelect={() => setPalette(p.id)} label={t('profile.paletteOption', { name: p.name })}>
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  {[p[resolvedMode].primary, p[resolvedMode].accent, p[resolvedMode].charts[1], p[resolvedMode].charts[2]].map((c, i) => (
                    <span key={i} className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span className="mt-2 block font-semibold">{p.name}</span>
                <span className={cn('block text-xs', palette === p.id ? '' : 'text-muted-foreground')}>{p.description}</span>
              </Choice>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="font-scale" className="mb-2 block text-sm font-medium">{t('profile.textSize')}</label>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-sm">A</span>
            <input
              id="font-scale" type="range" min={0.85} max={1.4} step={0.05} value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              aria-valuetext={`${Math.round(fontScale * 100)}%`}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <span aria-hidden="true" className="text-2xl">A</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t('profile.textSizeSample')}</p>
        </div>
      </Section>

      <Section title={t('profile.language')}>
        <div role="radiogroup" aria-label={t('profile.language')} className="grid gap-3 sm:grid-cols-3">
          {([['pt-BR', 'Português (BR)'], ['es-ES', 'Español'], ['en-US', 'English (US)']] as const).map(([id, label]) => (
            <Choice
              key={id} checked={language === id} label={label}
              onSelect={() => { setLanguage(id); i18n.changeLanguage(id.split('-')[0]); }}
            >
              <span className="font-semibold">{label}</span>
            </Choice>
          ))}
        </div>
      </Section>

      <Section title={t('profile.accessibility')} description={t('myAccount.accessibilityHelpText')}>
        <Switch label={t('myAccount.audioDescription')} checked={audio} onCheckedChange={setAudio} />
        <Switch label={t('myAccount.signLanguage')} checked={sign} onCheckedChange={setSign} />
      </Section>

      <Section title={t('profile.changePassword')}>
        <form onSubmit={changePassword} className="space-y-4">
          <Field label={t('profile.currentPassword')} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <Field label={t('profile.newPassword')} type="password" autoComplete="new-password" hint={t('auth.passwordHint')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          <Button type="submit" variant="outline" loading={pwSaving}>{t('profile.updatePassword')}</Button>
        </form>
      </Section>

      {dirty && (
        <div role="region" aria-label={t('profile.unsaved')} className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{t('profile.unsaved')}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={discard} disabled={saving}>{t('profile.discard')}</Button>
              <Button onClick={save} loading={saving}>{t('profile.save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAccount;

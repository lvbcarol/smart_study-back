// src/components/PrivacySection.tsx — privacidade e direitos do titular (LGPD): compartilhamento, exportar e excluir a conta
import React, { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ds/Button';
import { Field } from './ds/Field';
import { Modal } from './ds/Modal';
import { Switch } from './ds/Misc';

const PrivacySection: React.FC = () => {
  const { t } = useTranslation();
  const { user, savePreferences, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  if (!user) return null;
  const isStudent = user.role === 'student';

  const toggle = async (changes: { shareStudyTimeWithTeacher?: boolean; showLearningProfile?: boolean }) => {
    try {
      await savePreferences(changes);
      toast.success(t('privacy.saved'));
    } catch {
      toast.error(t('privacy.saveError'));
    }
  };

  const download = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/usuario/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smart-study-meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('privacy.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await api.delete('/usuario/me', { data: { password } });
      toast.success(t('privacy.deleted'));
      logout();
    } catch {
      toast.error(t('privacy.deleteError'));
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        {isStudent && (
          <>
            <Switch label={t('privacy.shareTime')} description={t('privacy.shareTimeDesc')} checked={!!user.shareStudyTimeWithTeacher} onCheckedChange={(v) => toggle({ shareStudyTimeWithTeacher: v })} />
            <Switch label={t('privacy.showProfile')} description={t('privacy.showProfileDesc')} checked={user.showLearningProfile !== false} onCheckedChange={(v) => toggle({ showLearningProfile: v })} />
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="max-w-md text-sm text-muted-foreground">{t('privacy.exportDesc')}</p>
          <Button variant="outline" onClick={download} loading={exporting}><Download className="h-4 w-4" aria-hidden="true" /> {exporting ? t('privacy.exporting') : t('privacy.export')}</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-muted-foreground">{t('privacy.deleteDesc')}</p>
          <Button variant="destructive" onClick={() => { setPassword(''); setOpen(true); }}><Trash2 className="h-4 w-4" aria-hidden="true" /> {t('privacy.delete')}</Button>
        </div>
      </div>

      <Modal open={open} onOpenChange={setOpen} title={t('privacy.deleteTitle')} description={t(isStudent ? 'privacy.deleteBody' : 'privacy.deleteTeacherBody')} closeLabel={t('common.close')}>
        <form onSubmit={remove} className="space-y-5">
          <Field label={t('privacy.passwordLabel')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="destructive" loading={deleting} disabled={!password}>{t('privacy.deleteConfirm')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default PrivacySection;

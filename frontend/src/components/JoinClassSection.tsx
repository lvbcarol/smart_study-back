// src/components/JoinClassSection.tsx — o aluno entra (ou sai) de uma turma pelo código que o professor passou
import React, { useState } from 'react';
import { LogOut, School } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import axios from 'axios';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ds/Button';
import { Field } from './ds/Field';
import { Badge } from './ds/Misc';
import { Modal } from './ds/Modal';

const JoinClassSection: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshLinks } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState<{ _id: string; name: string } | null>(null);
  const turmas = user?.turmas ?? [];

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    try {
      const { data } = await api.post<{ already: boolean; turma: { name: string } }>('/turmas/join', { code });
      toast.success(data.already ? t('joinClass.already', { name: data.turma.name }) : t('joinClass.joined', { name: data.turma.name }));
      setCode('');
      await refreshLinks();
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      toast.error(status === 404 ? t('joinClass.invalid') : status === 429 ? t('joinClass.tooMany') : t('joinClass.error'));
    } finally {
      setJoining(false);
    }
  };

  const leave = async () => {
    if (!leaving) return;
    try {
      await api.delete(`/turmas/${leaving._id}/leave`);
      toast.success(t('joinClass.left', { name: leaving.name }));
      setLeaving(null);
      await refreshLinks();
    } catch {
      toast.error(t('joinClass.error'));
    }
  };

  return (
    <>
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm">
          <Badge variant={turmas.length ? 'success' : 'neutral'}>{turmas.length ? t('joinClass.linked') : t('joinClass.independent')}</Badge>
          <span className="text-muted-foreground">{turmas.length ? t('joinClass.linkedHint') : t('joinClass.independentHint')}</span>
        </p>

        {turmas.length > 0 && (
          <ul className="space-y-2" aria-label={t('joinClass.title')}>
            {turmas.map((x) => (
              <li key={x._id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                <span className="flex items-center gap-3">
                  <School className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold">{x.name}</span>
                    {x.teacherName && <span className="text-sm text-muted-foreground">{t('joinClass.teacher', { name: x.teacherName })}</span>}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setLeaving({ _id: x._id, name: x.name })}>
                  <LogOut className="h-4 w-4" aria-hidden="true" /> {t('joinClass.leave')}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={join} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Field
              label={t('joinClass.codeLabel')} hint={t('joinClass.codeHint')} value={code} maxLength={12} autoComplete="off" autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234"
            />
          </div>
          <Button type="submit" loading={joining} disabled={!code.trim()}>{t('joinClass.join')}</Button>
        </form>
      </div>

      <Modal
        open={!!leaving} onOpenChange={(o) => !o && setLeaving(null)}
        title={t('joinClass.leaveTitle', { name: leaving?.name ?? '' })} description={t('joinClass.leaveText')} closeLabel={t('common.close')}
        footer={<><Button variant="ghost" onClick={() => setLeaving(null)}>{t('common.cancel')}</Button><Button variant="destructive" onClick={leave}>{t('joinClass.leave')}</Button></>}
      />
    </>
  );
};

export default JoinClassSection;

/**
 * AdminSettings — /admin/settings
 *
 * Single-form editor for every value exposed through `useSettings()`:
 *   - academy name (AR / EN)
 *   - academy description (AR / EN)
 *   - contact channels (facebook / instagram / whatsapp / email)
 *
 * Reads current values from SettingsContext (which in turn hydrates from
 * the `settings` table), writes via `settingsApi.update()`, then calls
 * `reload()` so the rest of the app sees new values immediately.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Card, CardContent } from '../components/molecules/Card';
import { FormField } from '../components/molecules/FormField';
import { Button } from '../components/atoms/Button';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../locales/i18n';
import { settingsApi } from '../lib/supabase/api/settings';
import type { SettingsMap } from '../lib/supabase/api/settings';

type FormState = {
  [K in keyof SettingsMap]-?: string;
};

const EMPTY: FormState = {
  academy_name_ar: '',
  academy_name_en: '',
  academy_description_ar: '',
  academy_description_en: '',
  facebook_url: '',
  instagram_url: '',
  whatsapp_number: '',
  email: '',
};

export function AdminSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const { raw, reload } = useSettings();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Sync form state whenever SettingsContext hydrates or reloads.
  useEffect(() => {
    setForm({
      academy_name_ar:        raw.academy_name_ar ?? '',
      academy_name_en:        raw.academy_name_en ?? '',
      academy_description_ar: raw.academy_description_ar ?? '',
      academy_description_en: raw.academy_description_en ?? '',
      facebook_url:           raw.facebook_url ?? '',
      instagram_url:          raw.instagram_url ?? '',
      whatsapp_number:        raw.whatsapp_number ?? '',
      email:                  raw.email ?? '',
    });
  }, [raw]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const patch: Partial<SettingsMap> = {};
      for (const key of Object.keys(form) as Array<keyof FormState>) {
        // Empty strings are persisted as NULL so clearing a value in the
        // admin UI actually removes the icon/text from every consumer.
        const value = form[key].trim();
        patch[key] = value === '' ? undefined : value;
      }

      const { error } = await settingsApi.update(patch);
      if (error) {
        toast.error(t('adminSettings.saveError'));
        return;
      }
      await reload();
      toast.success(t('adminSettings.saveSuccess'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title={t('adminSettings.title')}
      subtitle={t('adminSettings.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <PageSection title={t('adminSettings.branding')}>
          <Card>
            <CardContent className="p-6 space-y-4">
              <FormField
                label={t('adminSettings.academyNameAr')}
                name="academy_name_ar"
                value={form.academy_name_ar}
                onChange={(e) => setField('academy_name_ar', e.target.value)}
              />
              <FormField
                label={t('adminSettings.academyNameEn')}
                name="academy_name_en"
                value={form.academy_name_en}
                onChange={(e) => setField('academy_name_en', e.target.value)}
              />
              <FormField
                label={t('adminSettings.descriptionAr')}
                name="academy_description_ar"
                type="textarea"
                rows={3}
                value={form.academy_description_ar}
                onChange={(e) => setField('academy_description_ar', e.target.value)}
              />
              <FormField
                label={t('adminSettings.descriptionEn')}
                name="academy_description_en"
                type="textarea"
                rows={3}
                value={form.academy_description_en}
                onChange={(e) => setField('academy_description_en', e.target.value)}
              />
            </CardContent>
          </Card>
        </PageSection>

        <PageSection title={t('adminSettings.contact')}>
          <Card>
            <CardContent className="p-6 space-y-4">
              <FormField
                label={t('adminSettings.facebookUrl')}
                name="facebook_url"
                type="url"
                placeholder="https://facebook.com/..."
                value={form.facebook_url}
                onChange={(e) => setField('facebook_url', e.target.value)}
              />
              <FormField
                label={t('adminSettings.instagramUrl')}
                name="instagram_url"
                type="url"
                placeholder="https://instagram.com/..."
                value={form.instagram_url}
                onChange={(e) => setField('instagram_url', e.target.value)}
              />
              <FormField
                label={t('adminSettings.whatsappNumber')}
                name="whatsapp_number"
                type="tel"
                placeholder="+9665..."
                value={form.whatsapp_number}
                onChange={(e) => setField('whatsapp_number', e.target.value)}
              />
              <FormField
                label={t('adminSettings.emailAddress')}
                name="email"
                type="email"
                placeholder="contact@example.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </CardContent>
          </Card>
        </PageSection>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {t('adminSettings.save')}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}

export default AdminSettings;

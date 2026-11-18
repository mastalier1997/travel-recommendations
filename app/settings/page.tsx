import { isSupabaseConfigured } from '@/lib/supabase/config';
import { SettingsScreen } from '@/components/settings/SettingsScreen';

export const metadata = { title: 'Settings · Wanderlist' };

/**
 * Appearance settings: theme and accent colour. Both are stored on this device
 * (lib/theme/themeStore.ts), so the page needs no account — it works the same in
 * the no-Supabase demo, where "back" is the demo planner on `/`.
 */
export default function SettingsPage() {
  return isSupabaseConfigured ? (
    <SettingsScreen backHref="/plans" backLabel="Your plans" />
  ) : (
    <SettingsScreen backHref="/" backLabel="Back to the planner" />
  );
}

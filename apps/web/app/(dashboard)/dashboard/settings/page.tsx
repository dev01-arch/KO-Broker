import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { IntegrationsSettingsPanel } from '@/components/dashboard/integrations-settings-panel';

function SettingsFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-60">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading settings…
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <IntegrationsSettingsPanel />
    </Suspense>
  );
}

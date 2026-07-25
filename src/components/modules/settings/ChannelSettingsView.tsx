"use client";

import type { getChannelSettings } from "@/lib/settings/channels";
import { FacebookPageSettings } from "./FacebookPageSettings";
import { GoogleBusinessSettings } from "./GoogleBusinessSettings";
import { InstagramSettings } from "./InstagramSettings";
import { TelegramSettings } from "./TelegramSettings";
import { TikTokSettings } from "./TikTokSettings";
import { ZaloSettingsForm } from "./ZaloSettingsForm";

type ChannelSettings = Awaited<ReturnType<typeof getChannelSettings>>;

export function ChannelSettingsView({ initialSettings }: { initialSettings: ChannelSettings }) {
  return (
    <div className="max-w-4xl space-y-4">
      <FacebookPageSettings initialPages={initialSettings.facebookPages} />
      <InstagramSettings initialPages={initialSettings.instagramPages} />
      <ZaloSettingsForm initialSettings={initialSettings.zalo} />
      <TikTokSettings initialAccounts={initialSettings.tikTokAccounts} />
      <GoogleBusinessSettings initialAccounts={initialSettings.googleAccounts} />
      <TelegramSettings initialConfig={initialSettings.telegram} />
    </div>
  );
}

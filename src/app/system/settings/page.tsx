import { SettingsWorkspace, type SettingsWorkspaceProps } from "@/components/modules/settings/SettingsWorkspace";

export default function Page({ searchParams }: SettingsWorkspaceProps) {
  return <SettingsWorkspace searchParams={searchParams} />;
}

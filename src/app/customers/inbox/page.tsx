import { CustomerInboxWorkspace, type CustomerInboxWorkspaceProps } from "@/components/modules/inbox/CustomerInboxWorkspace";

export default function Page({ searchParams }: CustomerInboxWorkspaceProps) {
  return <CustomerInboxWorkspace searchParams={searchParams} />;
}

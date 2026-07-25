import { CustomerWorkspace, type CustomerWorkspaceProps } from "@/components/modules/customers/CustomerWorkspaces";

export default function Page({ searchParams }: Omit<CustomerWorkspaceProps, "routeId">) {
  return <CustomerWorkspace routeId="customers-crm" searchParams={searchParams} />;
}

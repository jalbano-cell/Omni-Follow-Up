import { PageHeader } from "@/components/layout/page-header";
import { ProvisionWorkspaceForm } from "@/components/admin/provision-workspace-form";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewWorkspacePage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="New workspace"
        description="Creates the workspace active immediately and gives you a claim link to send the client."
      />
      <div className="max-w-md">
        <ProvisionWorkspaceForm />
      </div>
    </>
  );
}

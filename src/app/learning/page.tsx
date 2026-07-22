import { LearningDashboard } from "@/components/modules/learning/LearningDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/page-access";

export default async function LearningPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="AI Self-Learning"
        description="5 vòng lặp tự học — Content Memory · Lead Attribution · A/B Learning · Decision Outcomes · Customer Behavior"
      />
      <LearningDashboard canMutate={user.role === "owner"} />
    </>
  );
}

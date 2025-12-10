import { correspondenceApi } from "@/lib/api/correspondences";
import { CorrespondenceDetail } from "@/components/correspondences/detail";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CorrespondenceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    notFound();
  }

  const correspondence = await correspondenceApi.getById(id);

  if (!correspondence) {
    notFound();
  }

  return <CorrespondenceDetail data={correspondence} />;
}

import { rfaApi } from "@/lib/api/rfas";
import { RFADetail } from "@/components/rfas/detail";
import { notFound } from "next/navigation";

export default async function RFADetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    notFound();
  }

  const rfa = await rfaApi.getById(id);

  if (!rfa) {
    notFound();
  }

  return <RFADetail data={rfa} />;
}

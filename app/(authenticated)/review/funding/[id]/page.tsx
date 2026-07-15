import { ReviewEntryDetailRoute } from "@/routes/review-entry-detail";

export default async function ReviewFundingEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewEntryDetailRoute mode={{ kind: "funding", entryId: id }} />;
}

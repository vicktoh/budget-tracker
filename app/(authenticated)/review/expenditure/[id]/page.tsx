import { ReviewEntryDetailRoute } from "@/routes/review-entry-detail";

export default async function ReviewExpenditureEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewEntryDetailRoute mode={{ kind: "expenditure", entryId: id }} />;
}

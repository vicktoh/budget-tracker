import { EntryDetailRoute } from "@/routes/entry-detail";

export default async function ExpenditureEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntryDetailRoute mode={{ kind: "expenditure", entryId: id }} />;
}

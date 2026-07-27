import { EntryDetailRoute } from "@/routes/entry-detail";

export default async function FundingEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntryDetailRoute mode={{ kind: "funding", entryId: id }} />;
}

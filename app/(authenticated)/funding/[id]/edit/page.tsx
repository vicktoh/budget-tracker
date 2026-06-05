import { FundingEntryPage } from "@/routes/funding-entry-page";

export default async function EditFundingEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FundingEntryPage mode={{ kind: "edit", entryId: id }} />;
}

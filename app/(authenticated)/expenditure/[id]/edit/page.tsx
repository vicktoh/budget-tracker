import { ExpenditureEntryPage } from "@/routes/expenditure-entry-page";

export default async function EditExpenditureEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExpenditureEntryPage mode={{ kind: "edit", entryId: id }} />;
}

import { redirect } from "next/navigation";

export default async function ReviewExpenditureEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/entries/expenditure/${id}`);
}

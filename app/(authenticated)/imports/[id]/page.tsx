import { ImportBatchRoute } from "@/routes/import-batch";

export default async function ImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ImportBatchRoute id={id} />;
}

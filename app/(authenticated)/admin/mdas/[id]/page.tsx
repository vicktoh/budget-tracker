import { MdaDetailRoute } from "@/components/executive/mda-detail";

export default async function AdminMdaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MdaDetailRoute mdaId={id} />;
}

import { ProgrammeDetailRoute } from "@/components/executive/programme-detail";

export default async function AdminProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProgrammeDetailRoute slug={slug} />;
}

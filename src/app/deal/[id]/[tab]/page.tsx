import { DealWorkspace } from "../workspace";

export default async function DealTabPage({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params;
  return <DealWorkspace id={id} tab={tab} />;
}

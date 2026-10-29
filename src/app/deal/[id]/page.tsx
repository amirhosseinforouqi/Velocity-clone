import { DealWorkspace } from "./workspace";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  return <DealWorkspace id={(await params).id} />;
}

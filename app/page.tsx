import SalesApp from "./sales-app";
import { requireChatGPTUser } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <SalesApp userName={user.displayName} />;
}

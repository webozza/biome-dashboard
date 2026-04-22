import { redirect } from "next/navigation";

export default function LegacyBoxPage() {
  redirect("/dashboard/bmid-box/requests");
}

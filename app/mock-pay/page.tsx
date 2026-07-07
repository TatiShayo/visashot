import { Suspense } from "react";
import { MockPayClient } from "./MockPayClient";

export const metadata = { title: "Dev mock payment" };

export default function MockPayPage() {
  return (
    <Suspense>
      <MockPayClient />
    </Suspense>
  );
}

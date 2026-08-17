"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Wird abgemeldet…" : "Ja, abmelden"}
    </Button>
  );
}

export function UnsubscribeButton({
  token,
  action,
}: {
  token: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <Submit />
    </form>
  );
}

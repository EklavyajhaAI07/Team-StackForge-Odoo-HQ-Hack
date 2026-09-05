export default async function PortalInvalidPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const expired = reason === "expired";
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[720px] flex-col justify-center px-6 py-16">
      <p className="text-[13px] text-muted">DealFlow360 customer portal</p>
      <h1 className="mt-2 text-[24px]">{expired ? "This link has expired" : "This link is not valid"}</h1>
      <p className="mt-3 text-[14px] text-muted">
        {expired
          ? "Quotation links are valid for 72 hours. Ask your account manager to send a fresh one."
          : "Check that you copied the whole link, or ask your account manager for a new one."}
      </p>
    </main>
  );
}

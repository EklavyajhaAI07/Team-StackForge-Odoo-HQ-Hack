import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[480px] py-24">
      <h1>Not found</h1>
      <p className="mt-2 text-muted">That page or record does not exist. It may have been deleted, or the link is wrong.</p>
      <div className="mt-6">
        <LinkButton href="/quotations" variant="primary">
          Back to quotations
        </LinkButton>
      </div>
    </div>
  );
}

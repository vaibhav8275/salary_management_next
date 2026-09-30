import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { SearchIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="card">
          <EmptyState
            icon={<SearchIcon className="size-5" />}
            title="Page not found"
            description="That employee or page does not exist. It may have been removed, or the link may be out of date."
            action={
              <Link href="/employees" className="btn btn-primary">
                Back to employees
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}

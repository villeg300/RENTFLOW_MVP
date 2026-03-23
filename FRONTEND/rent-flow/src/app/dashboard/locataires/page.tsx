import { Skeleton } from "@/components/ui/skeleton";

export default function LocatairesPage() {
  return (
    <div className="flex w-full flex-col gap-7 mx-auto mt-10 px-4 lg:px-6">
        <div className="flex w-fit items-center gap-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="grid gap-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
        </div>
        </div>
        <div className="flex w-fit items-center gap-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="grid gap-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
        </div>
        </div>
        <div className="flex w-fit items-center gap-4">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="grid gap-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
        </div>
        </div>
        
    </div>
  )
}
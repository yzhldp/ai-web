export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  );
}

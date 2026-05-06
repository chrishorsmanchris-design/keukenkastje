export default function Loading() {
  return (
    <div className="px-4 pt-10 pb-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-20 bg-stone-200 rounded-xl" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-stone-200 rounded-full" />
          <div className="h-9 w-28 bg-stone-200 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        {[1,2,3,4,5,6,7,8].map(i => (
          <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-stone-100">
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-stone-200 rounded-lg w-3/5" />
              <div className="h-3 bg-stone-100 rounded-lg w-1/4" />
            </div>
            <div className="h-5 w-8 bg-stone-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

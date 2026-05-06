export default function Loading() {
  return (
    <div className="px-4 pt-10 pb-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 bg-stone-200 rounded-xl" />
        <div className="h-8 w-20 bg-stone-200 rounded-full" />
      </div>
      <div className="h-10 bg-stone-200 rounded-2xl" />
      <div className="flex gap-2 overflow-hidden">
        {[1,2,3,4].map(i => <div key={i} className="h-8 w-20 bg-stone-200 rounded-full flex-shrink-0" />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden border border-stone-100">
            <div className="w-full h-28 bg-stone-200" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-stone-200 rounded-lg w-4/5" />
              <div className="h-3 bg-stone-100 rounded-lg w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

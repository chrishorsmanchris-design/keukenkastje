export default function Loading() {
  return (
    <div className="px-4 pt-10 pb-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-stone-200 rounded-xl" />
        <div className="h-9 w-28 bg-stone-200 rounded-full" />
      </div>
      <div className="space-y-2">
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-stone-100 p-3 space-y-2">
            <div className="h-4 w-24 bg-stone-200 rounded-lg" />
            <div className="h-14 bg-stone-100 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="px-4 pt-10 pb-4 space-y-4 animate-pulse">
      <div className="h-8 w-36 bg-stone-200 rounded-xl" />
      <div className="h-10 bg-stone-200 rounded-2xl" />
      <div className="h-10 bg-stone-200 rounded-2xl" />
      <div className="space-y-5">
        {[1,2,3].map(cat => (
          <div key={cat} className="space-y-2">
            <div className="h-3 w-24 bg-stone-200 rounded-lg" />
            {[1,2,3].map(i => (
              <div key={i} className="h-12 bg-white rounded-xl border border-stone-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

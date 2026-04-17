export default function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === tab.id
              ? 'border-[#EC4899] text-[#EC4899]'
              : 'border-transparent text-[#6B7280] hover:text-[#333333]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

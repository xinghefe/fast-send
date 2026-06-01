import React, { useRef } from 'react'
import { Paperclip, Image, LucideIcon } from 'lucide-react'

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  color?: string
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  color = 'blue',
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 group active:opacity-70 transition-opacity"
  >
    <div
      className={`w-14 h-14 rounded-2xl text-${color}-600 flex items-center justify-center group-active:scale-90 transition-all border border-${color}-100/10`}
    >
      <Icon size={26} />
    </div>
    <span className="text-[11px] font-bold text-slate-500">{label}</span>
  </button>
)

interface ActionPanelProps {
  isOpen: boolean
  onChangeAction: (files: File[]) => void
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ isOpen, onChangeAction }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)

  const onActionClick = (type: string) => {
    if (type === 'file') fileInputRef.current?.click()
    if (type === 'album') albumInputRef.current?.click()
  }

  return (
    <div
      className={`bg-white border-t border-slate-100 transition-all duration-300 linear overflow-hidden action-panel-container ${
        isOpen ? 'max-h-[150px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="p-8 mx-auto">
        <div className="grid gap-x-8 gap-y-6 grid-cols-2">
          <ActionButton icon={Paperclip} label="文件" onClick={() => onActionClick('file')} />
          <ActionButton
            icon={Image}
            label="相册"
            color="emerald"
            onClick={() => onActionClick('album')}
          />
        </div>
      </div>

      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={(e) => e.target.files && onChangeAction(Array.from(e.target.files))}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        multiple
        ref={albumInputRef}
        onChange={(e) => e.target.files && onChangeAction(Array.from(e.target.files))}
        className="hidden"
      />
    </div>
  )
}

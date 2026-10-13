import { motion, useReducedMotion } from 'motion/react'

// The card's hold menu, as Magic ships it: Share card, Copy text, Delete, Cancel.

interface Props {
  onShare: () => void
  onCopy: () => void
  onDelete: () => void
  onCancel: () => void
}

export function CardMenu({ onShare, onCopy, onDelete, onCancel }: Props) {
  const reduced = useReducedMotion()
  const spring = { type: 'spring' as const, visualDuration: 0.3, bounce: 0.1 }
  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Stop catching taps the moment it starts to leave.
      exit={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ duration: 0.18 }}
      onClick={onCancel}
    >
      <motion.div
        className="sheet"
        role="menu"
        onClick={(e) => e.stopPropagation()}
        initial={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { y: 40, opacity: 0, transition: { duration: 0.15 } }}
        transition={reduced ? { duration: 0.01 } : spring}
      >
        <div className="sheet-group">
          <button type="button" role="menuitem" onClick={onShare}>Share card</button>
          <button type="button" role="menuitem" onClick={onCopy}>Copy text</button>
          <button type="button" role="menuitem" className="danger" onClick={onDelete}>Delete</button>
        </div>
        <div className="sheet-group">
          <button type="button" className="strong" onClick={onCancel}>Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

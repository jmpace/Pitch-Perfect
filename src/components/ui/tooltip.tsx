'use client'

import React from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  theme?: 'light' | 'dark'
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  theme = 'dark'
}) => {
  return (
    <div className="tooltip-wrapper relative inline-block">
      {children}
      <div
        role="tooltip"
        className={`tooltip tooltip-${position} tooltip-${theme} absolute z-10 px-2 py-1 text-xs rounded ${
          theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'
        } ${
          position === 'top' ? 'bottom-full left-1/2 transform -translate-x-1/2 mb-1' :
          position === 'bottom' ? 'top-full left-1/2 transform -translate-x-1/2 mt-1' :
          position === 'left' ? 'right-full top-1/2 transform -translate-y-1/2 mr-1' :
          'left-full top-1/2 transform -translate-y-1/2 ml-1'
        }`}
        data-content={content}
      >
        {content}
      </div>
    </div>
  )
}
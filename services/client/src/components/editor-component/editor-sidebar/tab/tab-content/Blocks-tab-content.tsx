import React from 'react'
import { BLOCK_LAYOUTS } from 'src/lib/constants'

type Props = {}


const BlockLayout = ({ name, columns }  :any) => {
    return (
      <div 
        className="border rounded-md p-3 cursor-pointer hover:bg-muted transition-colors"
        draggable
      >
        <p className="text-sm mb-2">{name}</p>
        <div className="flex h-10 gap-1">
          {columns.map(({width, index} : any) => (
            <div 
              key={index} 
              className="bg-muted-foreground/20 rounded" 
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
    );
  };

const BlocksTabContent = (props: Props) => {
  return (
    <div className="grid gap-4 p-4">
    {BLOCK_LAYOUTS.map((layout) => (
      <BlockLayout
        key={layout.name}
        name={layout.name}
        columns={layout.columns}
      />
    ))}
  </div>
  )
}

export default BlocksTabContent
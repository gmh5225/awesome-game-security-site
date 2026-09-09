'use client';

import type { ReactElement } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export default function Tooltip({ content, children }: { content: string; children: ReactElement }) {
  return <TooltipPrimitive.Provider delayDuration={300}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="ui-tooltip" sideOffset={7} collisionPadding={12}>
          {content}
          <TooltipPrimitive.Arrow className="ui-tooltip-arrow"/>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>;
}

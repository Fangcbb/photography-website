"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResponsiveModalProps {
  children: React.ReactNode;
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  className?: string;
  dismissible?: boolean;
}

export const ResponsiveModal = ({
  children,
  open,
  title,
  onOpenChange,
  className,
  dismissible = true,
}: ResponsiveModalProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={dismissible}>
        <DrawerContent className={cn("p-4 max-h-[92dvh]", className)}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription></DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-h-[90vh] flex flex-col sm:flex-col", className)}
        onEscapeKeyDown={(event) => {
          if (!dismissible) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (!dismissible) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (!dismissible) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto min-h-0 -mx-1 px-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
};

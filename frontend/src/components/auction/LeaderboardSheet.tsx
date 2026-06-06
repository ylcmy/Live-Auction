import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../design-system/components/ui/sheet';
import Leaderboard from './Leaderboard';
import { Award } from 'lucide-react';

interface LeaderboardSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function LeaderboardSheet({ open, onClose }: LeaderboardSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="bg-white border-gray-200 rounded-t-2xl h-[60vh] flex flex-col p-0 overflow-hidden"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <SheetHeader className="px-5 pb-3 border-b border-gray-100 flex-shrink-0 flex flex-row items-center justify-between">
          <SheetTitle className="text-gray-900 text-base font-semibold flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            出价排行榜
          </SheetTitle>
          <SheetDescription className="sr-only">
            查看当前竞拍的实时出价排名
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-5 py-3">
          <Leaderboard />
        </div>
      </SheetContent>
    </Sheet>
  );
}

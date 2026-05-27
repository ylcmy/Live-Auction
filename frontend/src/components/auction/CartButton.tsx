import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';

interface CartButtonProps {
  productCount: number;
  onClick: () => void;
}

export default function CartButton({ productCount, onClick }: CartButtonProps) {
  if (productCount === 0) return null;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="fixed bottom-24 right-4 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-brand text-white shadow-[0_4px_20px_rgba(254,44,85,0.4)] hover:shadow-[0_6px_28px_rgba(254,44,85,0.55)] active:shadow-[0_2px_12px_rgba(254,44,85,0.3)] transition-shadow"
    >
      <ShoppingCart className="w-6 h-6" />
      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-white text-brand text-[11px] font-bold px-1 shadow-sm">
        {productCount > 99 ? '99+' : productCount}
      </span>
    </motion.button>
  );
}

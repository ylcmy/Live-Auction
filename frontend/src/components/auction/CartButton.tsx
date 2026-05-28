import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';

interface CartButtonProps {
  productCount: number;
  onClick: () => void;
}

export default function CartButton({ productCount, onClick }: CartButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-brand-hover text-white shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/35 active:shadow-md transition-all duration-200"
    >
      <ShoppingBag className="w-5 h-5" />
      {productCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-md border-2 border-white">
          {productCount > 99 ? '99+' : productCount}
        </span>
      )}
    </motion.button>
  );
}

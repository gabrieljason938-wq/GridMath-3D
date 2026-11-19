import { useState } from 'react';
import { Building2 } from 'lucide-react';

export function HeroCityShowcase() {
  const [imageError, setImageError] = useState(false);

  return (
    <figure className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-[0_20px_50px_-24px_rgba(15,23,42,0.22)] dark:border-[#334155] dark:bg-[#172033] dark:shadow-[0_24px_56px_-24px_rgba(2,6,23,0.75)]">
      {imageError ? (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[#F1F5F9] px-6 text-center text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]">
          <Building2 className="h-9 w-9 text-[#2563EB] dark:text-[#60A5FA]" />
          <span className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
            GRIDMATH 3D Smart City Visualization
          </span>
        </div>
      ) : (
        <img
          src="/assets/aistudio/image_25e9d109.png"
          alt="GRIDMATH 3D smart city visualization featuring solar arrays, wind turbines, battery storage, waterways, and urban power grid infrastructure"
          width={1920}
          height={1080}
          decoding="async"
          fetchPriority="high"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="block h-auto w-full"
        />
      )}
    </figure>
  );
}

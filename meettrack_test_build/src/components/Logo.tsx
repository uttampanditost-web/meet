import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = "md", className = "" }) => {
  const sizeMap = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-14 h-14 text-2xl",
    xl: "w-16 h-16 text-3xl",
  };

  const containerSizes = {
    sm: "w-8 h-8 rounded-lg",
    md: "w-10 h-10 rounded-xl",
    lg: "w-16 h-16 rounded-2xl",
    xl: "w-20 h-20 rounded-2xl",
  };

  return (
    <div
      className={`relative flex items-center justify-center bg-slate-950 border border-slate-800 shadow-md ${containerSizes[size]} ${className}`}
    >
      {/* Outer circular black badge matching uploaded logo */}
      <div className="w-full h-full p-1.5 flex items-center justify-center">
        <div className="w-full h-full rounded-full bg-black border border-slate-700/50 flex items-center justify-center shadow-inner">
          <span
            className="font-serif font-bold text-white select-none leading-none transform translate-y-[-0.5px]"
            style={{
              fontFamily: '"Playfair Display", "Times New Roman", "Georgia", serif',
              letterSpacing: "-0.05em",
            }}
          >
            H
          </span>
        </div>
      </div>
    </div>
  );
};

"use client";

import Image from "next/image";

interface TokenHeaderProps {
  name: string;
  address: string;
  logoUrl?: string;
}

export function TokenHeader({ name, address, logoUrl }: TokenHeaderProps) {
  const truncatedAddress = `${address.slice(0, 5)}...${address.slice(-4)}`;

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <Image
          src={logoUrl || "/placeholder.svg"}
          alt={`${name} logo`}
          width={48}
          height={48}
          className="rounded-full border-2 border-cyan-400/30"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center border-2 border-cyan-400/30">
          <span className="text-lg font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-xl font-bold text-white">{name}</span>
        <span className="text-sm text-slate-400 font-mono">
          {truncatedAddress}
        </span>
      </div>
    </div>
  );
}

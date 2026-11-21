"use client";

import React from "react";
import dynamic from "next/dynamic";

const FileConverter = dynamic(() => import("@/components/FileConverter"), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center animate-pulse">
      <p className="text-sm text-slate-400">
        Loading Client-Side Media Converter Engine...
      </p>
    </div>
  ),
});

export default function FileConverterWorkspace() {
  return <FileConverter />;
}

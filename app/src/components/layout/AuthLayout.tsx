import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-x-hidden selection:bg-blue-600/20 selection:text-blue-600">
      {/* Shared background decorations */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-slate-50 to-white" />
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
      <div className="relative z-10 flex flex-col min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}

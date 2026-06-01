import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NAV, AUTH } from "@/constants/testIds";
import { Horse as Knight, SignOut, ShieldCheck, List, X } from "@phosphor-icons/react";

const linkClass = ({ isActive }) =>
  `text-sm uppercase tracking-[0.18em] px-3 py-2 transition-colors ${
    isActive ? "text-[#FCD34D]" : "text-zinc-400 hover:text-white"
  }`;

const mobileLinkClass = ({ isActive }) =>
  `block px-4 py-3 text-base uppercase tracking-[0.18em] border-b border-white/5 ${
    isActive ? "text-[#FCD34D] bg-[#FCD34D]/5" : "text-zinc-300 hover:text-white hover:bg-white/5"
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const onLogout = async () => {
    close();
    await logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-30 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link
          to={user ? "/dashboard" : "/"}
          data-testid={NAV.brand}
          className="flex items-center gap-2"
          onClick={close}
        >
          <Knight size={32} weight="duotone" className="text-[#FCD34D]" />
          <span className="font-display text-2xl">Knight<span className="text-[#FCD34D]">.</span></span>
        </Link>

        {user && (
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" data-testid={NAV.dashboard} className={linkClass}>Dashboard</NavLink>
            <NavLink to="/play/ai" data-testid={NAV.playAi} className={linkClass}>vs Engine</NavLink>
            <NavLink to="/play/local" data-testid={NAV.playLocal} className={linkClass}>Local</NavLink>
            <NavLink to="/play/online" data-testid={NAV.playOnline} className={linkClass}>Online</NavLink>
            <NavLink to="/friends" data-testid={NAV.friends} className={linkClass}>Friends</NavLink>
            <NavLink to="/profile" data-testid={NAV.profile} className={linkClass}>Profile</NavLink>
            <NavLink to="/settings" data-testid={NAV.settings} className={linkClass}>Settings</NavLink>
            {isAdmin && (
              <NavLink to="/admin" data-testid={NAV.admin} className={linkClass}>
                <ShieldCheck size={14} weight="duotone" className="inline mr-1 -mt-0.5" />Admin
              </NavLink>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right leading-tight">
                  <div className="text-sm">{user.username}</div>
                  <div className="text-xs font-mono text-[#FCD34D]">{user.rating}</div>
                </div>
                {user.avatar ? (
                  <img src={user.avatar} alt="avatar" className="h-9 w-9 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-[#FCD34D] border border-white/10">
                    {user.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <button
                data-testid="nav-mobile-toggle"
                onClick={() => setOpen((o) => !o)}
                className="md:hidden text-zinc-300 hover:text-white p-2"
                aria-label="Menu"
              >
                {open ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
              </button>
              <button
                data-testid={AUTH.logoutBtn}
                onClick={onLogout}
                className="hidden md:inline-block text-zinc-400 hover:text-white p-2"
              >
                <SignOut size={20} weight="duotone" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-zinc-300 hover:text-white">Log in</Link>
              <Link to="/register" className="btn-gold !px-5 !py-2 !text-xs">Sign up</Link>
            </>
          )}
        </div>
      </div>

      {user && open && (
        <div data-testid="nav-mobile-panel" className="md:hidden border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl">
          <NavLink to="/dashboard" onClick={close} className={mobileLinkClass}>Dashboard</NavLink>
          <NavLink to="/play/ai" onClick={close} className={mobileLinkClass}>vs Engine</NavLink>
          <NavLink to="/play/local" onClick={close} className={mobileLinkClass}>Local</NavLink>
          <NavLink to="/play/online" onClick={close} className={mobileLinkClass}>Online</NavLink>
          <NavLink to="/friends" onClick={close} className={mobileLinkClass}>Friends</NavLink>
          <NavLink to="/profile" onClick={close} className={mobileLinkClass}>Profile</NavLink>
          <NavLink to="/settings" onClick={close} className={mobileLinkClass}>Settings</NavLink>
          {isAdmin && (
            <NavLink
              to="/admin"
              data-testid={`${NAV.admin}-mobile`}
              onClick={close}
              className={mobileLinkClass}
            >
              <ShieldCheck size={16} weight="duotone" className="inline mr-2 -mt-0.5" />Admin
            </NavLink>
          )}
          <button
            data-testid={`${AUTH.logoutBtn}-mobile`}
            onClick={onLogout}
            className="w-full text-left px-4 py-3 text-base uppercase tracking-[0.18em] text-red-300 hover:bg-red-500/10 border-b border-white/5"
          >
            <SignOut size={16} weight="duotone" className="inline mr-2 -mt-0.5" />Sign out
          </button>
        </div>
      )}
    </nav>
  );
}

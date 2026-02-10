import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  /** minutes before logout */
  timeoutMinutes?: number;
  /** routes that should NOT trigger idle logout */
  excludePaths?: string[];
};

export function IdleLogout({
  timeoutMinutes = 10,
  excludePaths = ["/login"],
}: Props) {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const timerRef = useRef<number | null>(null);

  const isAdmin = userRole?.role === "ADMIN";
  const isExcluded = excludePaths.some((p) => location.pathname.startsWith(p));

  // Reset the inactivity timer
  const resetTimer = async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(async () => {
      // Double-check we are still admin (avoid stale state issues)
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      // If no session, just go login
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      // Sign out and redirect
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    // Only apply to logged-in admin and not on excluded paths
    if (!isAdmin || isExcluded) return;

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    const onActivity = () => {
      void resetTimer();
    };

    // Start timer immediately on mount
    void resetTimer();

    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, onActivity as any));
    };
    // re-run if admin role changes or route changes
  }, [isAdmin, isExcluded, timeoutMinutes]);

  return null;
}

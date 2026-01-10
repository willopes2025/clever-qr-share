import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserRole = 'admin' | 'member' | 'viewer';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      // Check team_members table for role
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (teamMember?.role === 'admin') {
        setRole('admin');
        setIsAdmin(true);
      } else if (teamMember?.role === 'viewer') {
        setRole('viewer');
        setIsAdmin(false);
      } else {
        // Default: if no team member record, assume admin (owner)
        setRole('admin');
        setIsAdmin(true);
      }

      setLoading(false);
    };

    fetchRole();
  }, [user?.id]);

  return { role, isAdmin, loading };
};

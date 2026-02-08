import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_primary: string | null;
  theme_secondary: string | null;
  created_by: string | null;
  created_at: string;
}

interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  created_at: string;
  companies?: Company;
}

interface CompanyContextType {
  currentCompany: Company | null;
  currentRole: 'OWNER' | 'ADMIN' | 'STAFF' | null;
  userCompanies: CompanyMember[];
  loading: boolean;
  switchCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
  createCompany: (name: string, slug: string, logoUrl?: string) => Promise<Company | null>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentRole, setCurrentRole] = useState<'OWNER' | 'ADMIN' | 'STAFF' | null>(null);
  const [userCompanies, setUserCompanies] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserCompanies();
    } else {
      setCurrentCompany(null);
      setCurrentRole(null);
      setUserCompanies([]);
      setLoading(false);
    }
  }, [user]);

  const loadUserCompanies = async () => {
    try {
      setLoading(true);

      const { data: memberships, error } = await supabase
        .from('company_members')
        .select(`
          *,
          companies (*)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setUserCompanies(memberships || []);

      const savedCompanyId = localStorage.getItem('currentCompanyId');
      let selectedMembership = memberships?.find(m => m.company_id === savedCompanyId);

      if (!selectedMembership && memberships && memberships.length > 0) {
        selectedMembership = memberships[0];
      }

      if (selectedMembership && selectedMembership.companies) {
        setCurrentCompany(selectedMembership.companies);
        setCurrentRole(selectedMembership.role);
        localStorage.setItem('currentCompanyId', selectedMembership.company_id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = (companyId: string) => {
    const membership = userCompanies.find(m => m.company_id === companyId);
    if (membership && membership.companies) {
      setCurrentCompany(membership.companies);
      setCurrentRole(membership.role);
      localStorage.setItem('currentCompanyId', companyId);
      window.location.reload();
    }
  };

  const refreshCompanies = async () => {
    await loadUserCompanies();
  };

  const createCompany = async (name: string, slug: string, logoUrl?: string): Promise<Company | null> => {
    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name,
          slug,
          logo_url: logoUrl || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: company.id,
          user_id: user?.id,
          role: 'OWNER',
        });

      if (memberError) throw memberError;

      await refreshCompanies();
      switchCompany(company.id);

      return company;
    } catch (error: any) {
      console.error('Error creating company:', error);
      throw error;
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        currentRole,
        userCompanies,
        loading,
        switchCompany,
        refreshCompanies,
        createCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

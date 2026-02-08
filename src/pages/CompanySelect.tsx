import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../contexts/ToastContext';
import { Building2, Plus, ArrowRight } from 'lucide-react';

export function CompanySelect() {
  const navigate = useNavigate();
  const { userCompanies, switchCompany, createCompany } = useCompany();
  const { showToast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(userCompanies.length === 0);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim() || !companySlug.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(companySlug)) {
      showToast('Slug can only contain lowercase letters, numbers, and hyphens', 'error');
      return;
    }

    try {
      setCreating(true);
      await createCompany(companyName, companySlug);
      showToast(`Company "${companyName}" created successfully!`, 'success');
      navigate('/');
    } catch (error: any) {
      if (error.code === '23505') {
        showToast('This company slug is already taken', 'error');
      } else {
        showToast(error.message || 'Error creating company', 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSelectCompany = (companyId: string) => {
    switchCompany(companyId);
    navigate('/');
  };

  const handleCompanyNameChange = (name: string) => {
    setCompanyName(name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setCompanySlug(slug);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-600 rounded-2xl">
              <Building2 className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {userCompanies.length === 0 ? 'Create Your Company' : 'Select a Company'}
          </h1>
          <p className="text-gray-600">
            {userCompanies.length === 0
              ? 'Get started by creating your company workspace'
              : 'Choose a company to continue'}
          </p>
        </div>

        {!showCreateForm && userCompanies.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Your Companies</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {userCompanies.map((membership) => (
                <button
                  key={membership.id}
                  onClick={() => handleSelectCompany(membership.company_id)}
                  className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-green-600 hover:bg-green-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {membership.companies?.logo_url ? (
                      <img
                        src={membership.companies.logo_url}
                        alt={membership.companies.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-green-600" />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="font-semibold text-gray-800">{membership.companies?.name}</p>
                      <p className="text-sm text-gray-500 capitalize">{membership.role.toLowerCase()}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-600 hover:bg-green-50 text-gray-600 hover:text-green-600 transition-all"
            >
              <Plus className="w-5 h-5" />
              Create New Company
            </button>
          </div>
        )}

        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Company</h2>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Slug *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm px-3 py-3 bg-gray-100 rounded-lg">app.com/</span>
                  <input
                    type="text"
                    value={companySlug}
                    onChange={(e) => setCompanySlug(e.target.value.toLowerCase())}
                    placeholder="acme-corporation"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    pattern="[a-z0-9-]+"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {creating ? 'Creating...' : 'Create Company'}
                </button>
                {userCompanies.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

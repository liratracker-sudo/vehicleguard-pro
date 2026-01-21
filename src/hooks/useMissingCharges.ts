import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from '@/hooks/useCompanyId';

export interface ClientWithoutCharge {
  id: string;
  name: string;
  phone: string | null;
  company_id: string;
  company_name: string;
  vehicle_count: number;
  has_contract: boolean;
  contract_value: number | null;
  estimated_value: number;
  created_at: string;
}

export interface CompanySummary {
  company_name: string;
  client_count: number;
  total_value: number;
}

const DEFAULT_VEHICLE_VALUE = 53.90;

export const useMissingCharges = () => {
  const [clients, setClients] = useState<ClientWithoutCharge[]>([]);
  const [companySummary, setCompanySummary] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { companyId } = useCompanyId();

  useEffect(() => {
    const fetchMissingCharges = async () => {
      if (!companyId) return;

      try {
        setLoading(true);

        // Check if user is super_admin to fetch all companies
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        
        let isSuperAdmin = false;
        if (userId) {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .single();
          isSuperAdmin = userRoles?.role === 'super_admin';
        }

        // Fetch active clients with company info
        let clientsQuery = supabase
          .from('clients')
          .select('id, name, phone, company_id, created_at')
          .eq('status', 'active');

        if (!isSuperAdmin) {
          clientsQuery = clientsQuery.eq('company_id', companyId);
        }

        const { data: activeClients, error: clientsError } = await clientsQuery;

        if (clientsError) throw clientsError;

        if (!activeClients || activeClients.length === 0) {
          setClients([]);
          setCompanySummary([]);
          setLoading(false);
          return;
        }

        // Get company names
        const companyIds = [...new Set(activeClients.map(c => c.company_id))];
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);

        const companyNameMap = new Map<string, string>();
        companiesData?.forEach(c => {
          companyNameMap.set(c.id, c.name);
        });

        const clientIds = activeClients.map(c => c.id);

        // Fetch pending/overdue payments for these clients
        const { data: pendingPayments, error: paymentsError } = await supabase
          .from('payment_transactions')
          .select('client_id')
          .in('client_id', clientIds)
          .in('status', ['pending', 'overdue']);

        if (paymentsError) throw paymentsError;

        const clientsWithPayments = new Set(pendingPayments?.map(p => p.client_id) || []);

        // Filter clients without pending payments
        const clientsWithoutCharges = activeClients.filter(c => !clientsWithPayments.has(c.id));

        if (clientsWithoutCharges.length === 0) {
          setClients([]);
          setCompanySummary([]);
          setLoading(false);
          return;
        }

        const clientIdsWithoutCharges = clientsWithoutCharges.map(c => c.id);

        // Fetch vehicles for these clients - cast to any to avoid TS2589
        const { data: vehiclesData } = await (supabase as any)
          .from('vehicles')
          .select('client_id')
          .in('client_id', clientIdsWithoutCharges)
          .eq('status', 'active');

        const vehicleCountMap = new Map<string, number>();
        vehiclesData?.forEach((v: any) => {
          const clientId = v.client_id as string;
          vehicleCountMap.set(clientId, (vehicleCountMap.get(clientId) || 0) + 1);
        });

        // Fetch active contracts
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('client_id, monthly_value')
          .in('client_id', clientIdsWithoutCharges)
          .eq('status', 'active');

        const contractMap = new Map<string, number>();
        contractsData?.forEach((ct: any) => {
          const clientId = ct.client_id as string;
          contractMap.set(clientId, ct.monthly_value || DEFAULT_VEHICLE_VALUE);
        });

        // Build final list
        const result: ClientWithoutCharge[] = clientsWithoutCharges.map(client => {
          const vehicleCount = vehicleCountMap.get(client.id) || 0;
          const hasContract = contractMap.has(client.id);
          const contractValue = contractMap.get(client.id) || null;
          const estimatedValue = hasContract && contractValue 
            ? contractValue 
            : Math.max(vehicleCount, 1) * DEFAULT_VEHICLE_VALUE;

          return {
            id: client.id,
            name: client.name,
            phone: client.phone,
            company_id: client.company_id,
            company_name: companyNameMap.get(client.company_id) || 'Empresa não identificada',
            vehicle_count: vehicleCount,
            has_contract: hasContract,
            contract_value: contractValue,
            estimated_value: estimatedValue,
            created_at: client.created_at || ''
          };
        });

        // Sort by company name, then by client name
        result.sort((a, b) => {
          const companyCompare = a.company_name.localeCompare(b.company_name);
          if (companyCompare !== 0) return companyCompare;
          return a.name.localeCompare(b.name);
        });

        // Calculate company summary
        const summaryMap = new Map<string, CompanySummary>();
        result.forEach(client => {
          const existing = summaryMap.get(client.company_name);
          if (existing) {
            existing.client_count += 1;
            existing.total_value += client.estimated_value;
          } else {
            summaryMap.set(client.company_name, {
              company_name: client.company_name,
              client_count: 1,
              total_value: client.estimated_value
            });
          }
        });

        const summary = Array.from(summaryMap.values())
          .sort((a, b) => b.client_count - a.client_count);

        setClients(result);
        setCompanySummary(summary);
      } catch (error) {
        console.error('Error fetching missing charges:', error);
        setClients([]);
        setCompanySummary([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMissingCharges();
  }, [companyId]);

  const totalEstimatedValue = clients.reduce((sum, c) => sum + c.estimated_value, 0);
  const totalVehicles = clients.reduce((sum, c) => sum + c.vehicle_count, 0);
  const clientsWithoutContract = clients.filter(c => !c.has_contract).length;

  return { 
    clients, 
    companySummary,
    loading,
    totalEstimatedValue,
    totalVehicles,
    clientsWithoutContract
  };
};
